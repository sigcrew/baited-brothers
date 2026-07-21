import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import {
  encryptAppleRefreshToken,
  exchangeAppleAuthorizationCode,
  getAppleClientId,
  getAppleIdentitySubject,
  isAppleUser,
} from "../_shared/appleAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = request.headers.get("Authorization");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: "Server secrets are not configured" }, 500);
    }
    if (!authorization) return json({ error: "Authentication required" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);
    if (!isAppleUser(userData.user)) return json({ error: "Apple account required" }, 403);

    const body = await request.json().catch(() => null) as {
      authorizationCode?: unknown;
      clientId?: unknown;
    } | null;
    const authorizationCode =
      typeof body?.authorizationCode === "string" ? body.authorizationCode.trim() : "";
    if (authorizationCode.length < 20 || authorizationCode.length > 8192) {
      return json({ error: "Invalid Apple authorization code" }, 400);
    }

    const requestedClientId = typeof body?.clientId === "string" ? body.clientId : undefined;
    const clientId = getAppleClientId(requestedClientId);
    const appleCredential = await exchangeAppleAuthorizationCode({
      authorizationCode,
      clientId,
    });
    const expectedSubject = getAppleIdentitySubject(userData.user);
    if (!expectedSubject || appleCredential.subject !== expectedSubject) {
      return json({ error: "Apple credential does not match the signed-in user" }, 403);
    }

    const encrypted = await encryptAppleRefreshToken(appleCredential.refreshToken);
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: upsertError } = await adminClient
      .from("apple_auth_tokens")
      .upsert({
        user_id: userData.user.id,
        client_id: clientId,
        refresh_token_ciphertext: encrypted.ciphertext,
        refresh_token_iv: encrypted.iv,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    if (upsertError) throw upsertError;

    return json({ stored: true });
  } catch (error) {
    console.error("Apple token storage failed", error);
    return json({ error: "Apple account connection could not be stored" }, 500);
  }
});
