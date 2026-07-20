import { createClient } from "npm:@supabase/supabase-js@2.49.1";

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

const revokeAppleAuthorization = async (authorizationCode: string) => {
  const clientId = Deno.env.get("APPLE_CLIENT_ID");
  const clientSecret = Deno.env.get("APPLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("Apple revocation secrets are not configured.");
  }

  const tokenResponse = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: authorizationCode,
      grant_type: "authorization_code",
    }),
  });
  const tokenBody = await tokenResponse.json();
  const revocationToken =
    typeof tokenBody.refresh_token === "string"
      ? tokenBody.refresh_token
      : typeof tokenBody.access_token === "string"
        ? tokenBody.access_token
        : null;
  if (!tokenResponse.ok || !revocationToken) {
    throw new Error("Apple authorization code exchange failed.");
  }

  const revokeResponse = await fetch("https://appleid.apple.com/auth/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      token: revocationToken,
      token_type_hint:
        typeof tokenBody.refresh_token === "string"
          ? "refresh_token"
          : "access_token",
    }),
  });
  if (!revokeResponse.ok) {
    throw new Error("Apple token revocation failed.");
  }
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
    const body = await req.json().catch(() => ({}));
    const isAppleUser = user.identities?.some(
      (identity) => identity.provider === "apple",
    );
    if (isAppleUser) {
      if (typeof body.appleAuthorizationCode !== "string") {
        return json({ error: "Apple reauthentication required." }, 400);
      }
      await revokeAppleAuthorization(body.appleAuthorizationCode);
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

    return json({ deleted: true });
  } catch (error) {
    console.error("Account deletion failed", error);
    return json({ error: "Account deletion failed." }, 500);
  }
});
