import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import {
  decryptAppleRefreshToken,
  isAppleUser,
  revokeAppleRefreshToken,
} from "../_shared/appleAuth.ts";

type AppleTokenRow = {
  client_id: string;
  refresh_token_ciphertext: string;
  refresh_token_iv: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const listObjectPaths = async (
  client: ReturnType<typeof createClient>,
  bucket: string,
  prefix: string,
): Promise<string[]> => {
  const paths: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await client.storage.from(bucket).list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    if (!data?.length) break;

    for (const item of data) {
      const path = `${prefix}/${item.name}`;
      if (item.id) paths.push(path);
      else paths.push(...(await listObjectPaths(client, bucket, path)));
    }
    if (data.length < 100) break;
    offset += data.length;
  }

  return paths;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("Authorization");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Server secrets are not configured." }, 500);
  }
  if (!authorization) return json({ error: "Authentication required." }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: "Invalid session." }, 401);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    let appleRevocation: "not_applicable" | "revoked" | "manual_action_required" =
      "not_applicable";
    if (isAppleUser(user)) {
      const { data: appleToken, error: appleTokenError } = await adminClient
        .from("apple_auth_tokens")
        .select("client_id, refresh_token_ciphertext, refresh_token_iv")
        .eq("user_id", user.id)
        .maybeSingle();
      if (appleTokenError) throw appleTokenError;

      const storedToken = appleToken as AppleTokenRow | null;
      if (storedToken) {
        try {
          const refreshToken = await decryptAppleRefreshToken({
            ciphertext: storedToken.refresh_token_ciphertext,
            iv: storedToken.refresh_token_iv,
          });
          await revokeAppleRefreshToken({
            clientId: storedToken.client_id,
            refreshToken,
          });
          appleRevocation = "revoked";
        } catch (revocationError) {
          console.error("Apple token revocation failed", revocationError);
          appleRevocation = "manual_action_required";
        }
      } else {
        appleRevocation = "manual_action_required";
      }
    }

    const paths = await listObjectPaths(adminClient, "user-uploads", user.id);
    for (let index = 0; index < paths.length; index += 100) {
      const { error } = await adminClient.storage
        .from("user-uploads")
        .remove(paths.slice(index, index + 100));
      if (error) throw error;
    }

    const { error: deleteError } =
      await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return json({ appleRevocation, deleted: true });
  } catch (error) {
    console.error("Account deletion failed", error);
    return json({ error: "Account deletion failed." }, 500);
  }
});
