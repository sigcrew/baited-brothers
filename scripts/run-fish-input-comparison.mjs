import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const [accountPath, variantList = 'sonnet-full,sonnet-detail', outputName = 'sonnet-comparison'] = process.argv.slice(2);
if (!accountPath || !/^[a-z0-9-]+$/.test(outputName)) throw Error('Usage: node scripts/run-fish-input-comparison.mjs <temporary-account.json> <variants> <output-name>');
const functionName = process.env.QA_FUNCTION_NAME ?? 'identify-fish-qa';
if (!/^identify-fish-qa(?:-[a-z0-9-]+)?$/.test(functionName)) throw Error('QA endpoint required');
const choices = { 'sonnet-full': { model: 'claude-sonnet-5', detail: false },
  'sonnet-detail': { model: 'claude-sonnet-5', detail: true }, 'sonnet-auto': { model: 'claude-sonnet-5', detail: false, auto: true }, 'opus-full': { model: 'claude-opus-5', detail: false } };
const variants = variantList.split(',');
if (variants.some(v => !choices[v]) || new Set(variants).size !== variants.length) throw Error('Unknown or repeated variant');
const dir = path.resolve('qa/fish-recognition/input-model-comparison');
const manifest = JSON.parse(await fs.readFile(path.join(dir, 'prepared-manifest.json')));
const cases = process.env.QA_CASE_IDS ? manifest.cases.filter(c => process.env.QA_CASE_IDS.split(',').includes(c.id)) : manifest.cases;
if (!cases.length || cases.length * variants.length > 30) throw Error('Empty experiment or exceeds temporary account quota');
const client = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const account = JSON.parse(await fs.readFile(accountPath));
const { error: signInError } = await client.auth.signInWithPassword({ email: account.email, password: account.password });
if (signInError) throw signInError;
const { data: fishes, error } = await client.from('fishes').select('id,name,name_ko,collection_group,identification_features,similar_species_notes').eq('catalog_status', 'core').order('catalog_sort_order');
if (error) throw error;
const catalog = fishes.map(f => ({ id: f.id, nameKo: f.name_ko, scientificName: f.name, group: f.collection_group,
  identificationFeatures: f.identification_features, similarSpeciesNotes: f.similar_species_notes }));
const normalize = s => s.split(/\s+/).slice(0, 2).join(' ').toLowerCase();
const byName = new Map(fishes.map(f => [normalize(f.name), f.id]));
for (const c of cases) if (c.kind === 'fish' && !byName.has(normalize(c.expectedScientificName))) throw Error(`Missing expected species: ${c.id}`);
const jobs = cases.flatMap(c => variants.map(variant => ({ c, variant })));
const rows = [];
const journal = path.join(dir, `${outputName}.jsonl`);
await fs.writeFile(journal, '');
let next = 0;
const worker = async () => {
  while (next < jobs.length) {
    const { c, variant } = jobs[next++];
    const setting = choices[variant];
    const bytes = await fs.readFile(path.join(dir, c.path));
    const detail = await fs.readFile(path.join(dir, c.detailPath));
    const hash = b => crypto.createHash('sha256').update(b).digest('hex');
    if (hash(bytes) !== c.sha256 || hash(detail) !== c.detailSha256) throw Error(`Input changed: ${c.id}`);
    const started = Date.now();
    const expectedId = c.kind === 'fish' ? byName.get(normalize(c.expectedScientificName)) : null;
    let row;
    try {
      const { data, error } = await client.functions.invoke(functionName, { body: {
        imageBase64: bytes.toString('base64'), mimeType: 'image/jpeg', catalog, qaModel: setting.model, qaAutoDetail: setting.auto === true,
        ...(setting.detail ? { detailImageBase64: detail.toString('base64') } : {}),
      }, signal: AbortSignal.timeout(90000) });
      if (error) { let detail = ''; try { detail = await error.context.text(); } catch {} throw Error(`${error.message}: ${detail.slice(0, 250)}`); }
      if (!Array.isArray(data?.candidates) || data.qa?.model !== setting.model) throw Error('Unexpected QA response');
      const candidates = data.candidates.map(c => ({ ...c, nameKo: fishes.find(f => f.id === c.fish_id)?.name_ko }));
      row = { id: c.id, kind: c.kind, variant, expectedId, expected: c.expectedScientificName ?? 'reject',
        top1: expectedId ? candidates[0]?.fish_id === expectedId : null,
        top3: expectedId ? candidates.some(x => x.fish_id === expectedId) : null,
        rejected: data.needs_retake === true && candidates.length === 0,
        sourceSha256: c.sourceSha256, inputSha256: c.sha256,
        detailSha256: setting.detail ? c.detailSha256 : null, response: { ...data, candidates } };
    } catch (error) { row = { id: c.id, kind: c.kind, variant, error: error.message }; }
    row.seconds = (Date.now() - started) / 1000;
    rows.push(row);
    await fs.appendFile(journal, JSON.stringify(row) + '\n');
    console.log(`${rows.length}/${jobs.length} ${variant} ${c.id}: ${row.error ? 'ERROR '+row.error : row.rejected ? 'retake' : row.top1 ? 'top1' : row.top3 ? 'top3' : 'miss'}`);
  }
};
await Promise.all([worker(), worker()]);
const summaries = variants.map(variant => {
  const selected = rows.filter(r => r.variant === variant);
  const fish = selected.filter(r => r.kind === 'fish');
  const reject = selected.filter(r => r.kind !== 'fish');
  const strong = fish.filter(r => r.response?.candidates[0]?.confidence >= 0.8);
  const usage = selected.flatMap(r => r.response?.qa?.usage ?? []);
  return { variant, fish: fish.length, top1: fish.filter(r => r.top1).length, top3: fish.filter(r => r.top3).length,
    rejectedFish: fish.filter(r => r.rejected).length, rejectionCases: reject.length, correctRejections: reject.filter(r => r.rejected).length,
    highConfidencePredictions: strong.length, highConfidenceErrors: strong.filter(r => !r.top1).length,
    errors: selected.filter(r => r.error).length, meanSeconds: selected.reduce((s,r) => s + r.seconds, 0) / selected.length,
    inputTokens: usage.reduce((s,u) => s+(u.input_tokens??0),0), outputTokens: usage.reduce((s,u) => s+(u.output_tokens??0),0) };
});
await fs.writeFile(path.join(dir, `${outputName}.json`), JSON.stringify({ generatedAt: new Date().toISOString(), releaseEligible: false,
  catalogSha256: crypto.createHash('sha256').update(JSON.stringify(catalog)).digest('hex'), inputPolicy: manifest.inputPolicy, summaries, rows }, null, 2)+'\n');
console.log(JSON.stringify(summaries, null, 2));
if (rows.some(r => r.error)) process.exitCode = 1;
