import "dotenv/config";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error(
    "EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY가 필요합니다.",
  );
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const publicClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const deleteTemporaryUser = async (userId: string) => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (!error) return;
      lastError = error;
    } catch (error) {
      lastError = error;
    }
    if (attempt === 3) throw lastError;
    await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
  }
};

const run = async () => {
  const email = `fish-evaluation-${crypto.randomUUID()}@example.com`;
  const password = `Qa-${crypto.randomUUID()}!`;
  let userId: string | undefined;

  try {
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
    if (createError || !created.user) throw createError;
    userId = created.user.id;

    const { data: signedIn, error: signInError } =
      await publicClient.auth.signInWithPassword({ email, password });
    if (signInError || !signedIn.session) throw signInError;

    const exitCode = await new Promise<number>((resolve, reject) => {
      const child = spawn(
        process.platform === "win32" ? "npm.cmd" : "npm",
        ["run", "qa:fish-recognition"],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            AI_TEST_USER_JWT: signedIn.session.access_token,
          },
          stdio: "inherit",
        },
      );
      child.once("error", reject);
      child.once("exit", (code) => resolve(code ?? 1));
    });

    if (exitCode !== 0) {
      throw new Error(`어종 판별 평가가 종료 코드 ${exitCode}로 실패했습니다.`);
    }
  } finally {
    if (userId) {
      try {
        await deleteTemporaryUser(userId);
      } catch (error) {
        console.error(
          `임시 QA 계정 삭제 실패: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
