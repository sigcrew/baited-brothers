import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { normalizeContribution } from "./policy.ts";
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Content-Type": "application/json" };
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), {status,headers});
const timingSafeEqual = (a: string, b: string) => {
  const left=new TextEncoder().encode(a), right=new TextEncoder().encode(b);
  if(left.length!==right.length) return false;
  let diff=0; for(let i=0;i<left.length;i++) diff|=left[i]^right[i];
  return diff===0;
};
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok",{headers});
  if (req.method !== "POST") return json({error:"Method not allowed"},405);
  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({error:"Authentication required"},401);
  const url=Deno.env.get("SUPABASE_URL")!, anon=Deno.env.get("SUPABASE_ANON_KEY")!, service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
  const admin=createClient(url,service,{auth:{persistSession:false}});
  let body: Record<string,unknown>;
  try { const raw=await req.text(); if(raw.length>3_100_000) return json({error:"Image too large"},413); body=JSON.parse(raw); if(!body || typeof body!=="object" || Array.isArray(body)) throw Error(); }
  catch {return json({error:"Invalid request"},400);}
  try {
    // Public project anon JWT may only trigger deletion of already-expired data.
    // Every user action below requires an authenticated user, never a body userId.
    if(body.action==="cleanup") {
      // The anon JWT only gets the request past the gateway; it ships inside the
      // app bundle, so it cannot authorize maintenance. The cron job sends a
      // dedicated secret (Vault: recognition_cleanup_secret) that must match the
      // function secret RECOGNITION_CLEANUP_SECRET.
      const expected=Deno.env.get("RECOGNITION_CLEANUP_SECRET") ?? "";
      const provided=req.headers.get("x-cleanup-secret") ?? "";
      if(!expected || !timingSafeEqual(provided,expected)) return json({error:"Maintenance credential required"},403);
      let total=0;
      for(let batch=0;batch<10;batch++) {
        const {data,error}=await admin.rpc("recognition_cleanup_paths"); if(error) throw error;
        const paths=(data??[]).map((row:{image_path:string})=>row.image_path);
        if(!paths.length) break;
        const removed=await admin.storage.from("user-uploads").remove(paths); if(removed.error) throw removed.error;
        const deleted=await admin.from("recognition_contributions").delete().in("image_path",paths); if(deleted.error) throw deleted.error;
        total+=paths.length;
        if(paths.length<100) break;
      }
      return json({removed:total});
    }
    const {data:{user},error:authError}=await userClient.auth.getUser();
    if(authError || !user) return json({error:"Invalid session"},401);
    if(body.action==="list") {
      const {data,error,count}=await admin.from("recognition_contributions").select("id,consented_at,expires_at,analysis,review_status,selected_fish_id,selected_custom_name",{count:"exact"}).eq("user_id",user.id).eq("state","ready").gt("expires_at",new Date().toISOString()).order("consented_at",{ascending:false}).limit(50);
      if(error) throw error; return json({items:data,count});
    }
    if(body.action==="delete") {
      if(body.id!==undefined && (typeof body.id!=="string" || !/^[0-9a-f-]{36}$/i.test(body.id))) return json({error:"Invalid contribution ID"},400);
      let removed=0;
      for(;;){
        let query=admin.from("recognition_contributions").select("id,image_path").eq("user_id",user.id).limit(100);
        if(body.id) query=query.eq("id",body.id);
        const {data,error}=await query; if(error) throw error; if(!data?.length) break;
        const ids=data.map(row=>row.id);
        // Remove review access first; failed physical deletion remains retryable.
        const marked=await admin.from("recognition_contributions").update({state:"withdrawn",analysis:{},selected_fish_id:null,selected_custom_name:null,selected_at:null}).eq("user_id",user.id).in("id",ids); if(marked.error) throw marked.error;
        const files=await admin.storage.from("user-uploads").remove(data.map(row=>row.image_path)); if(files.error) throw files.error;
        const deleted=await admin.from("recognition_contributions").delete().eq("user_id",user.id).in("id",ids); if(deleted.error) throw deleted.error;
        removed+=data.length; if(body.id) break;
      }
      return json({deleted:removed});
    }
    if(body.action!=="submit") return json({error:"Unknown action"},400);
    let input;
    try {input=normalizeContribution(body);} catch(error){return json({error:(error as Error).message},400);}
    const {data:entry,error}=await admin.rpc("reserve_recognition_contribution",{p_owner_id:user.id,p_analysis_id:input.analysisId,p_client_request_id:input.clientRequestId,p_analysis:input.analysis,p_consent_version:"recognition-photo-v1"});
    if(error) return json({error:error.message.includes("limit")?"Daily contribution limit reached":"Unable to reserve contribution"},error.message.includes("limit")?429:400);
    if(!entry?.inserted) return entry?.state==="ready" ? json({id:entry.id,provided:true}) : json({error:"Submission already in progress. Try again later."},409);
    try {
      const bytes=Uint8Array.from(atob(input.imageBase64),c=>c.charCodeAt(0));
      const upload=await admin.storage.from("user-uploads").upload(entry.image_path,bytes,{contentType:"image/jpeg",cacheControl:"0",upsert:false}); if(upload.error) throw upload.error;
      const ready=await admin.from("recognition_contributions").update({state:"ready"}).eq("id",entry.id).eq("user_id",user.id).eq("state","uploading").select("id").maybeSingle();
      if(ready.error || !ready.data) throw Error("Submission was withdrawn");
      return json({id:entry.id,provided:true},201);
    } catch(error) {
      // A concurrent withdrawal cannot be undone by a late upload completion.
      await admin.storage.from("user-uploads").remove([entry.image_path]);
      await admin.from("recognition_contributions").delete().eq("id",entry.id).eq("user_id",user.id);
      throw error;
    }
  } catch {return json({error:"자료 처리에 실패했습니다. 잠시 후 다시 시도해 주세요."},500);}
});
