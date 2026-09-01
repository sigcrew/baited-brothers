import "dotenv/config";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error(
    "Supabase URL, anon key, service role key가 모두 필요합니다.",
  );
}

const testRunId = randomUUID();
const email = `codex-catch-qa-${testRunId}@example.invalid`;
const password = `Qa-${randomUUID()}-9a!`;
const initialMemo = `codex catch crud qa ${testRunId}`;
const updatedMemo = `${initialMemo} updated`;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const createAuthenticatedClient = () =>
  createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

let userId;
let catchId;

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

try {
  const { data: createdUser, error: createUserError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: "Codex Catch QA" },
    });
  if (createUserError) throw createUserError;
  userId = createdUser.user?.id;
  assert(userId, "임시 테스트 사용자를 만들지 못했습니다.");

  const client = createAuthenticatedClient();
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw signInError;

  const { data: fish, error: fishError } = await client
    .from("fishes")
    .select("id")
    .limit(1)
    .single();
  if (fishError) throw fishError;

  const caughtAt = new Date().toISOString();
  const { data: inserted, error: insertError } = await client
    .from("user_catches")
    .insert({
      user_id: userId,
      fish_id: fish.id,
      size_cm: 31.5,
      caught_at: caughtAt,
      memo: initialMemo,
    })
    .select("id, user_id, size_cm, memo")
    .single();
  if (insertError) throw insertError;
  catchId = inserted.id;
  assert(inserted.user_id === userId, "생성된 조과의 소유자가 다릅니다.");

  const { data: updated, error: updateError } = await client
    .from("user_catches")
    .update({ size_cm: 32.5, memo: updatedMemo })
    .eq("id", catchId)
    .eq("user_id", userId)
    .select("id, size_cm, memo")
    .single();
  if (updateError) throw updateError;
  assert(Number(updated.size_cm) === 32.5, "수정한 크기가 반영되지 않았습니다.");
  assert(updated.memo === updatedMemo, "수정한 메모가 반영되지 않았습니다.");

  await client.auth.signOut();
  const reloadedClient = createAuthenticatedClient();
  const { error: reSignInError } =
    await reloadedClient.auth.signInWithPassword({ email, password });
  if (reSignInError) throw reSignInError;

  const { data: persisted, error: persistedError } = await reloadedClient
    .from("user_catches")
    .select("id, size_cm, memo")
    .eq("id", catchId)
    .eq("user_id", userId)
    .single();
  if (persistedError) throw persistedError;
  assert(Number(persisted.size_cm) === 32.5, "재로그인 후 크기가 유지되지 않았습니다.");
  assert(persisted.memo === updatedMemo, "재로그인 후 메모가 유지되지 않았습니다.");

  const { data: deleted, error: deleteError } = await reloadedClient
    .from("user_catches")
    .delete()
    .eq("id", catchId)
    .eq("user_id", userId)
    .select("id");
  if (deleteError) throw deleteError;
  assert(deleted?.length === 1, "삭제된 조과를 확인하지 못했습니다.");
  catchId = undefined;

  const { data: remaining, error: remainingError } = await reloadedClient
    .from("user_catches")
    .select("id")
    .eq("user_id", userId);
  if (remainingError) throw remainingError;
  assert(remaining.length === 0, "삭제 후 테스트 조과가 남아 있습니다.");

  console.log("PASS: create -> update -> re-authenticate -> read -> delete");
} finally {
  if (catchId) {
    await admin.from("user_catches").delete().eq("id", catchId);
  }
  if (userId) {
    await admin.auth.admin.deleteUser(userId);
  }
}
