import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateReview} from './fish-human-review.mjs';
const photos=[{sha256:'a',file:'a.jpg'}];
const record={sha256:'a',outcome:'identified',species:'Pleuronichthys cornutus',reason:'눈 위치와 체형 확인',reviewer:'검수자',reviewerRole:'experienced',reviewedAt:'2026-09-10T00:00:00.000Z'};
const payload=records=>({schemaVersion:1,queueId:'queue',records});
test('only imports decisions bound to the current photos and queue',()=>{
 assert.throws(()=>validateReview({...payload([record]),queueId:'other'},'queue',photos));
 assert.throws(()=>validateReview(payload([{...record,sha256:'unknown'}]),'queue',photos));
 assert.throws(()=>validateReview(payload([record,record]),'queue',photos));
 assert.equal(validateReview(payload([record]),'queue',photos).records[0].species,'Pleuronichthys cornutus');
});
test('requires an accountable decision, permits uncertainty, never grants training approval',()=>{
 for(const field of ['species','reason','reviewer','reviewerRole','reviewedAt']) assert.throws(()=>validateReview(payload([{...record,[field]:''}]),'queue',photos));
 assert.throws(()=>validateReview(payload([{...record,outcome:'approved'}]),'queue',photos));
 const out=validateReview({...payload([{...record,outcome:'uncertain',species:'',biologicalReview:'approved'}]),releaseEligible:true},'queue',photos);
 assert.equal(out.releaseEligible,false);assert.equal(out.records[0].biologicalReview,'pending');
 assert.equal(out.records[0].outcome,'uncertain');
});

import {validateAIDrafts} from './fish-human-review.mjs';
test('AI drafts stay separate from human decisions and require exact photo coverage',()=>{
 const draft={sha256:'a',status:'hold',candidate:'가자미류',observations:'몸이 납작함',limitation:'입이 가려짐',alternatives:'다른 가자미류',nextPhoto:'머리 확대',authorType:'ai',biologicalReview:'approved'};
 const data={schemaVersion:'ai-fish-draft-v1',records:[draft],releaseEligible:true};
 assert.throws(()=>validateReview(data,'queue',photos));
 assert.throws(()=>validateAIDrafts({...data,records:[]},photos));
 assert.throws(()=>validateAIDrafts({...data,records:[{...draft,sha256:'wrong'}]},photos));
 assert.throws(()=>validateAIDrafts({...data,records:[{...draft,status:'approved'}]},photos));
 const out=validateAIDrafts(data,photos);assert.equal(out.releaseEligible,false);assert.equal(out.records[0].biologicalReview,'pending');assert.equal(out.records[0].authorType,'ai');
});
