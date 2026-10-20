import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

// Exercise the deployed handler; only network/auth boundaries are mocked.
function loadHandler(results, sourceOverride, userId = 'test-user', autoDetail = false) {
  let handler;
  const requests = [];
  const context = {
    Request, Response, console,
    Deno: { env: { get: key => key === 'FISH_AUTO_DETAIL' ? String(autoDetail) : 'test-secret' }, serve: fn => { handler = fn; } },
    fetch: async (_url, options) => {
      requests.push(JSON.parse(options.body));
      const result = results.shift();
      return Response.json(result?.rawResponse ?? { content: [{ type: 'tool_use', name: 'submit_identification', input: result }] });
    },
  };
  const load = name => {
    if (name === './detail-image.ts') return { createDetailImage: async (_image, box) => box?.confidence >= 0.8 ? 'Y3JvcA==' : undefined };
    if (name.startsWith('npm:')) return { createClient: () => ({
      auth: { getUser: async () => ({ data: { user: { id: userId } } }) },
      rpc: async () => ({ data: [{ allowed: true, remaining: 29, reset_at: null }] }),
    }) };
    const filename = new URL(`../supabase/functions/identify-fish/${name}`, import.meta.url);
    const source = name === 'index.ts' && sourceOverride ? sourceOverride : fs.readFileSync(filename, 'utf8');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    const exports = {};
    vm.runInNewContext(outputText, { ...context, exports, require: load }, { filename: filename.pathname });
    return exports;
  };
  load('index.ts');
  return { handler, requests };
}

const catalog = [
  ['black-bream', 'bream'], ['red-bream', 'bream'], ['yellow-bream', 'bream'],
  ['croaker', 'seabass_croaker'], ['large-croaker', 'seabass_croaker'],
].map(([id, group]) => ({ id, nameKo: id, scientificName: id, group }));
const gate = {
  subject_present: true, subject_type: 'finfish', image_quality: 0.9,
  subject_size: 'large', visible_features: { head: true, body: true, fins_or_arms: true, tail_or_mantle: true },
  quality_issues: [], suggested_groups: ['bream'], needs_retake: false, note: 'Clear fish',
};
const candidate = (fish_id, confidence) => ({ fish_id, confidence, reason: 'Visible features' });
const request = (extra = {}) => new Request('https://example.test/identify-fish', {
  method: 'POST', headers: { Authorization: 'Bearer test' },
  body: JSON.stringify({ imageBase64: 'test-image', mimeType: 'image/jpeg', catalog, ...extra }),
});

test('keeps jointly ranked candidates instead of forcing adjacent species into slots 2 and 3', async () => {
  const primary = [candidate('black-bream', 0.55), candidate('red-bream', 0.4), candidate('yellow-bream', 0.2)];
  const { handler, requests } = loadHandler([
    gate, { candidates: primary, needs_retake: false },
    { candidates: [candidate('croaker', 0.1), candidate('large-croaker', 0.05)], needs_retake: false },
  ]);
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).candidates, primary);
  assert.equal(requests.length, 2);
  assert.match(requests[1].messages[0].content[1].text, /croaker/);
});

test('rejects an unsuitable photo without invoking species classification', async () => {
  const { handler, requests } = loadHandler([{ ...gate, subject_type: 'other', subject_present: false }]);
  const body = await (await handler(request())).json();
  assert.equal(body.needs_retake, true);
  assert.deepEqual(body.candidates, []);
  assert.equal(requests.length, 1);
});

test('a truncated model response is an upstream error, not a request to retake the photo', async () => {
  const truncated = { rawResponse: { stop_reason: 'max_tokens', content: [{ type: 'tool_use', name: 'submit_identification', input: {} }] } };
  const { handler } = loadHandler([gate, truncated, truncated]);
  const response = await handler(request());
  assert.equal(response.status, 502);
  const body = await response.json();
  assert.equal(body.needs_retake, undefined);
  assert.match(body.error_code, /output limit/);
});

test('isolated comparison endpoint restricts users/models and forwards both views together', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fish-qa-test-'));
  try {
    const id = '11111111-1111-4111-8111-111111111111';
    const output = path.join(dir, 'function.json');
    execFileSync(process.execPath, ['scripts/build-fish-comparison-function.mjs', id, output]);
    const source = JSON.parse(fs.readFileSync(output)).files[0].content;
    const denied = loadHandler([], source);
    assert.equal((await denied.handler(request())).status, 403);
    assert.equal(denied.requests.length, 0);
    const allowed = loadHandler([gate, { candidates: [candidate('red-bream', 0.8)], needs_retake: false }], source, id);
    assert.equal((await allowed.handler(request({ qaModel: 'arbitrary-model' }))).status, 400);
    assert.equal(allowed.requests.length, 0);
    const response = await allowed.handler(request({ qaModel: 'claude-opus-5', detailImageBase64: 'dGVzdA==' }));
    const body = await response.json();
    assert.equal(body.candidates[0].fish_id, 'red-bream');
    assert.equal(body.qa.mode, 'full-plus-detail');
    assert.ok(allowed.requests.every(r => r.model === 'claude-opus-5' && r.messages[0].content.filter(c => c.type === 'image').length === 2));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// Network and JPEG decoding are boundaries here; real image bytes are tested separately.
test('automatic detail keeps the original quality gate and sends both views only to classification', async () => {
  const { handler, requests } = loadHandler([
    { ...gate, subject_box: { x: 0.1, y: 0.2, width: 0.6, height: 0.5, confidence: 0.95 } },
    { candidates: [candidate('black-bream', 0.7)], needs_retake: false },
  ], undefined, 'test-user', true);
  assert.equal((await handler(request())).status, 200);
  assert.equal(requests[0].messages[0].content.filter(c => c.type === 'image').length, 1);
  assert.deepEqual(requests[1].messages[0].content.filter(c => c.type === 'image').map(c => c.source.data), ['test-image', 'Y3JvcA==']);
});

test('uncertain or unavailable detail retains original-only classification', async () => {
  const { handler, requests } = loadHandler([gate, { candidates: [candidate('black-bream', 0.7)], needs_retake: false }], undefined, 'test-user', true);
  assert.equal((await handler(request())).status, 200);
  assert.equal(requests[1].messages[0].content.filter(c => c.type === 'image').length, 1);
});
