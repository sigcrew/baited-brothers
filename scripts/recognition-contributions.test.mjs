import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeContribution } from '../supabase/functions/recognition-contributions/policy.ts';
const input = () => ({ consent: true, consentVersion: 'recognition-photo-v1', analysisId: 'attempt-1', clientRequestId:'photo-1', imageBase64:'/9j/2Q==', analysis:{ status:'succeeded', candidates:[{fishId:'11111111-1111-4111-8111-111111111111',confidence:.6,reason:'무늬가 보임'}], model:'test-model',version:'test-v1',durationMs:1300,note:'참고 후보' } });
test('requires explicit current consent before accepting a contribution',()=>{
 for (const extra of [{consent:false},{consent:undefined},{consentVersion:'old'}]) assert.throws(()=>normalizeContribution({...input(),...extra}),/consent/i);
});
test('preserves ordered predictions but never accepts client identity, coordinates or verified labels',()=>{
 const data=normalizeContribution({...input(),userId:'another-user',latitude:37,reviewStatus:'verified',analysis:{...input().analysis,location:'private',verified:true}});
 assert.equal(data.analysis.candidates[0].confidence,.6);
 assert.equal(data.analysis.candidates[0].reason,'무늬가 보임');
 assert.equal(data.userId,undefined);assert.equal(data.latitude,undefined);assert.equal(data.reviewStatus,undefined);assert.equal(data.analysis.location,undefined);assert.equal(data.analysis.verified,undefined);
});
test('validates images, predictions, status and correlation keys at the boundary',()=>{
 for (const extra of [{imageBase64:'not-an-image'},{imageBase64:'a'.repeat(3_000_001)},{analysisId:''},{analysis:{status:'verified'}},{analysis:{...input().analysis,candidates:[{fishId:'bad',confidence:2}]}}]) assert.throws(()=>normalizeContribution({...input(),...extra}));
 const rejected=normalizeContribution({...input(),analysis:{status:'rejected',candidates:[],version:'v1'}});assert.deepEqual(rejected.analysis.candidates,[]);
});

import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function loadEndpoint() {
 let handler;const writes=[];
 const admin={rpc:async()=>({data:[],error:null}),from:()=>{throw Error('Unexpected database mutation');},storage:{from:()=>{throw Error('Unexpected storage access');}}};
 const user={auth:{getUser:async()=>({data:{user:{id:'owner'}}})}};
 const source=fs.readFileSync('supabase/functions/recognition-contributions/index.ts','utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(js,{exports:{},require:(name)=>name==='./policy.ts'?{normalizeContribution}:{createClient:(_url,key)=>key==='service'?admin:user},Deno:{env:{get:key=>({'SUPABASE_URL':'https://example.test','SUPABASE_ANON_KEY':'anon','SUPABASE_SERVICE_ROLE_KEY':'service','RECOGNITION_CLEANUP_SECRET':'cleanup-secret'}[key])},serve:fn=>handler=fn},Request,Response,URL,console,atob,Uint8Array,TextEncoder});
 return {handler,writes};
}
test('endpoint requires authentication and rejects absent consent before touching storage',async()=>{
 const {handler}=loadEndpoint();
 assert.equal((await handler(new Request('https://test',{method:'POST',body:'{}'}))).status,401);
 assert.equal((await handler(new Request('https://test',{method:'POST',headers:{Authorization:'Bearer user'},body:JSON.stringify({action:'submit',...input(),consent:false})}))).status,400);
});

test('cleanup requires the dedicated maintenance secret; the project anon JWT alone is not enough',async()=>{
 const {handler}=loadEndpoint();
 const anon='header.'+Buffer.from(JSON.stringify({role:'anon',ref:'example'})).toString('base64url')+'.gateway-verified-signature';
 const cleanup=(headers)=>handler(new Request('https://test',{method:'POST',headers:{Authorization:'Bearer '+anon,...headers},body:JSON.stringify({action:'cleanup'})}));
 assert.equal((await cleanup({})).status,403);
 assert.equal((await cleanup({'x-cleanup-secret':'wrong-secret'})).status,403);
 const ok=await cleanup({'x-cleanup-secret':'cleanup-secret'});
 assert.equal(ok.status,200);
 assert.deepEqual(await ok.json(),{removed:0});
});
