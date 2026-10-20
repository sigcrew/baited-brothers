import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {validateReview, validateAIDrafts} from './fish-human-review.mjs';
const dir='qa/fish-recognition/supplemental-review';
const queue=JSON.parse(await fs.readFile(dir+'/expert-review-queue.json'));
const photos=[];
for(const r of queue.images){
 const bytes=await fs.readFile(r.file);
 if(crypto.createHash('sha256').update(bytes).digest('hex')!==r.sha256)throw Error('Changed photo: '+r.file);
 const mime=r.file.toLowerCase().endsWith('.png')?'image/png':'image/jpeg';
 photos.push({sha256:r.sha256,sourceUrl:r.sourceUrl,nameKo:r.nameKo,scientificName:r.scientificName,creator:r.creator,license:r.license,licenseUrl:r.licenseUrl,src:`data:${mime};base64,${bytes.toString('base64')}`});
}
const queueId=crypto.createHash('sha256').update(photos.map(r=>r.sha256).sort().join('\n')).digest('hex');
const aiDrafts=validateAIDrafts(JSON.parse(await fs.readFile(dir+'/ai-review-drafts.json')), photos);
const template=await fs.readFile('scripts/fish-human-review.html','utf8');
const page=template.replace('/*VALIDATOR*/',validateReview.toString()).replace('/*DATA*/',JSON.stringify({queueId,photos,aiDrafts}).replace(/</g,'\\u003c'));
await fs.writeFile(dir+'/expert-review.html',page);
console.log(JSON.stringify({photos:photos.length,queueId,bytes:Buffer.byteLength(page)}));
