const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync('supabase/functions/search-places/index.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function setup({user=true,status=200,documents=[]}={}) {
 let handler,calls=0;
 vm.runInNewContext(code,{exports:{},require:()=>({createClient:()=>({auth:{getUser:async()=>({data:{user:user?{id:'qa'}:null},error:null})}})}),Deno:{env:{get:()=> 'test'},serve:fn=>handler=fn},URL,Response,Request,AbortSignal,fetch:async(url)=>{calls++;assert.equal(url.searchParams.get('query'),'대천항');return Response.json({documents},{status});}});
 return {call:(body,auth=true)=>handler(new Request('https://test',{method:'POST',headers:auth?{Authorization:'Bearer test'}:{},body:JSON.stringify(body)})),calls:()=>calls};
}
test('rejects absent and invalid sessions before provider use',async()=>{for(const auth of [true,false]){const s=setup({user:false});assert.equal((await s.call({query:'대천항'},auth)).status,401);assert.equal(s.calls(),0);}});
test('rejects empty or excessive queries',async()=>{const s=setup();for(const query of ['', ' '.repeat(2),'x'.repeat(101),null])assert.equal((await s.call({query})).status,400);assert.equal(s.calls(),0);});
test('returns named candidates with numeric coordinates and filters invalid locations',async()=>{const s=setup({documents:[{id:'1',place_name:'대천항',address_name:'충남 보령시',x:'126.502',y:'36.327'},{id:'2',place_name:'bad',x:'bad',y:'0'}]});assert.deepEqual(await (await s.call({query:' 대천항 '})).json(),{places:[{id:'1',name:'대천항',address:'충남 보령시',latitude:36.327,longitude:126.502}]});});
test('quota exhaustion is an error rather than an empty successful search',async()=>{const s=setup({status:429});assert.equal((await s.call({query:'대천항'})).status,429);});
