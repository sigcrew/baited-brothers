import 'dotenv/config';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
const [ownerPath,otherPath]=process.argv.slice(2);
if(!ownerPath || !otherPath) throw Error('Two existing QA account files required');
const url=process.env.EXPO_PUBLIC_SUPABASE_URL,anon=process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const clients=[];
for(const p of [ownerPath,otherPath]) {const a=JSON.parse(await fs.readFile(p));if(!a.email.startsWith('codex-'))throw Error('Only QA accounts');const c=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});const r=await c.auth.signInWithPassword(a);if(r.error)throw r.error;clients.push(c);}
const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const maintenance=createClient(url,anon,{auth:{persistSession:false}});
const call=async(c,body)=>{const r=await c.functions.invoke('recognition-contributions',{body});return {data:r.data,status:r.error?.context?.status??200,error:r.error};};
const bytes=await fs.readFile('qa/fish-recognition/input-model-comparison/inputs/reviewed-13-full.jpg');
const prefix=`qa-contribution-${Date.now()}`;
const make=(suffix)=>({action:'submit',consent:true,consentVersion:'recognition-photo-v1',analysisId:`${prefix}-${suffix}`,clientRequestId:prefix,imageBase64:bytes.toString('base64'),analysis:{status:'rejected',candidates:[],model:'QA fixture',version:'collection-test',note:'Public fixture; not biological ground truth',durationMs:1234}});
const gone=async(path)=>{
 const response=await fetch(url+'/storage/v1/object/authenticated/user-uploads/'+path+'?check='+Date.now(),{headers:{Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY,apikey:anon},cache:'no-store'});
 assert.ok(!response.ok,'Deleted object remains available at origin');
};
const created=[];const results=[];
try {
 assert.equal((await call(clients[0],{...make('denied'),consent:false})).status,400);results.push('absent consent rejected');
 const row=await call(clients[0],make('withdraw'));assert.ifError(row.error);created.push(row.data.id);
 const duplicate=await call(clients[0],make('withdraw'));assert.ifError(duplicate.error);assert.equal(duplicate.data.id,row.data.id);results.push('idempotent explicit submission');
 const stored=await admin.from('recognition_contributions').select('*').eq('id',row.data.id).single();assert.ifError(stored.error);assert.equal(stored.data.review_status,'unreviewed');assert.equal(stored.data.prediction_source,'client_reported');assert.equal(stored.data.consent_version,'recognition-photo-v1');
 const read=await admin.storage.from('user-uploads').download(stored.data.image_path);assert.ifError(read.error);assert.equal((await read.data.arrayBuffer()).byteLength,bytes.length);results.push('photo and unreviewed analysis stored');
 const other=await call(clients[1],{action:'list'});assert.ifError(other.error);assert.ok(!other.data.items.some(x=>x.id===row.data.id));
 const forbidden=await call(clients[1],{action:'delete',id:row.data.id});assert.ifError(forbidden.error);assert.equal(forbidden.data.deleted,0);results.push('cross-account list/delete isolated');
 const direct=await clients[1].from('recognition_contributions').select('id').eq('id',row.data.id);assert.ok(direct.error || direct.data.length===0);results.push('direct table access protected');
 const removal=await call(clients[0],{action:'delete',id:row.data.id});assert.ifError(removal.error);assert.equal(removal.data.deleted,1);
 await gone(stored.data.image_path);results.push('withdrawal removes photo');
 const exp=await call(clients[0],make('expiry'));assert.ifError(exp.error);created.push(exp.data.id);
 const expRow=await admin.from('recognition_contributions').select('image_path').eq('id',exp.data.id).single();assert.ifError(expRow.error);
 const age=await admin.from('recognition_contributions').update({expires_at:new Date(Date.now()-1000).toISOString()}).eq('id',exp.data.id);assert.ifError(age.error);
 assert.ok(!(await call(clients[0],{action:'list'})).data.items.some(x=>x.id===exp.data.id));
 const cleanup=await call(maintenance,{action:'cleanup'});assert.ifError(cleanup.error);assert.ok(cleanup.data.removed>=1);
 await gone(expRow.data.image_path);results.push('expired data excluded and physically purged');
 console.log(JSON.stringify({passed:results},null,2));
 await fs.mkdir('qa/fish-recognition/collection-audit/implementation',{recursive:true});await fs.writeFile('qa/fish-recognition/collection-audit/implementation/live-checks.json',JSON.stringify({checkedAt:new Date().toISOString(),passed:results},null,2)+'\n');
} finally {
 for(const id of created) {const r=await call(clients[0],{action:'delete',id});if(r.error)throw Error('QA contribution cleanup failed');}
}
