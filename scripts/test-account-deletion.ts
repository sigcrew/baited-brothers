import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error("Supabase 테스트 환경 변수가 필요합니다.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const run = async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `deletion-test-${suffix}@example.invalid`;
  const password = `Delete-${suffix}-A!`;
  let userId: string | null = null;
  let objectPath: string | null = null;

  try {
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { integration_test: true },
      });
    if (createError || !created.user) throw createError;
    userId = created.user.id;
    objectPath = `${userId}/account-deletion-test.png`;

    const { data: fish, error: fishError } = await admin
      .from("fishes")
      .select("id")
      .eq("catalog_status", "core")
      .order("catalog_sort_order")
      .limit(1)
      .single();
    if (fishError) throw fishError;

    const { error: catchError } = await admin.from("user_catches").insert({
      user_id: userId,
      fish_id: fish.id,
      image_url: `${supabaseUrl}/storage/v1/object/public/user-uploads/${objectPath}`,
      capture_method: "development_upload",
      id_method: "fallback_catalog",
      candidate_fish_ids: [],
      verification_status: "verified",
      verification_reason: "account deletion integration test",
      client_request_id: `delete-test-${suffix}`,
    });
    if (catchError) throw catchError;

    const { error: uploadError } = await admin.storage
      .from("user-uploads")
      .upload(objectPath, Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), {
        contentType: "image/png",
      });
    if (uploadError) throw uploadError;

    const client = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signIn, error: signInError } =
      await client.auth.signInWithPassword({ email, password });
    if (signInError || !signIn.session) throw signInError;

    const response = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${signIn.session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ confirm: true }),
    });
    const body = await response.json();
    if (!response.ok || body.deleted !== true) {
      throw new Error(`delete-account 실패: ${response.status}`);
    }

    const [{ data: catchRows }, { data: storageRows }] = await Promise.all([
      admin.from("user_catches").select("id").eq("user_id", userId),
      admin.storage.from("user-uploads").list(userId),
    ]);
    const { data: deletedUser } = await admin.auth.admin.getUserById(userId);

    const verification = {
      authDeleted: !deletedUser.user,
      catchesDeleted: (catchRows ?? []).length === 0,
      storageDeleted: (storageRows ?? []).length === 0,
    };
    console.log(JSON.stringify(verification, null, 2));
    if (Object.values(verification).some((value) => !value)) {
      throw new Error("계정 삭제 검증 중 남은 데이터가 있습니다.");
    }

    userId = null;
    objectPath = null;
  } finally {
    if (objectPath) {
      await admin.storage.from("user-uploads").remove([objectPath]);
    }
    if (userId) {
      await admin.auth.admin.deleteUser(userId);
    }
  }
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
