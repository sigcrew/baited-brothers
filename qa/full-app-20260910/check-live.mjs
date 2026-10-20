import 'dotenv/config';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
const clients=[];
for(const p of ['/private/tmp/bb-fish-review-account.json','/private/tmp/bb-sim17-account.json']){
 const a=JSON.parse(await fs.readFile(p));assert.ok(a.email.startsWith('codex-'));
 const c=createClient(process.env.EXPO_PUBLIC_SUPABASE_URL,process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const auth=await c.auth.signInWithPassword(a);assert.ifError(auth.error);clients.push(c);
}
const owner=clients[0],other=clients[1],checks=[];
const catchResult=await owner.from('user_catches').select('id,size_cm,verification_status').order('created_at',{ascending:false}).limit(1).single();
assert.ifError(catchResult.error);assert.equal(Number(catchResult.data.size_cm),32.5);checks.push('UI catch edit 32.5cm persisted after re-login');
const trips=await owner.from('fishing_trips').select('id,status,spot_lat,spot_lng').order('created_at',{ascending:false}).limit(1).single();
assert.ifError(trips.error);assert.equal(trips.data.status,'done');assert.ok(trips.data.spot_lat);checks.push('UI map-linked trip and completed status persisted');
const favorites=await owner.from('favorite_fishing_spots').select('id');assert.ifError(favorites.error);assert.ok(favorites.data.length);checks.push('UI map favorite persisted');
for(const [table,id] of [['user_catches',catchResult.data.id],['fishing_trips',trips.data.id],['favorite_fishing_spots',favorites.data[0].id]]){
 const r=await other.from(table).select('id').eq('id',id);assert.ifError(r.error);assert.equal(r.data.length,0);checks.push(table+' isolated from other QA account');
}
const result={checkedAt:new Date().toISOString(),checks};
await fs.writeFile('qa/full-app-20260910/live-results.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
