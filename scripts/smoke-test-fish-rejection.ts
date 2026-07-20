import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error("Supabase 환경 변수가 필요합니다.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const publicClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const run = async () => {
  const email = `fish-rejection-${crypto.randomUUID()}@example.com`;
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
    const accessToken = signedIn.session.access_token;

    const { data: fishes, error: catalogError } = await admin
      .from("fishes")
      .select(
        "id,name,name_ko,collection_group,identification_features,similar_species_notes",
      )
      .eq("catalog_status", "core")
      .order("catalog_sort_order");
    if (catalogError || !fishes?.length) throw catalogError;

    const catalog = fishes.map((fish) => ({
      id: fish.id,
      nameKo: fish.name_ko ?? fish.name,
      scientificName: fish.name,
      group: fish.collection_group,
      identificationFeatures: fish.identification_features,
      similarSpeciesNotes: fish.similar_species_notes,
    }));
    const cases = [
      {
        id: "non-fish",
        file: "qa/fish-recognition/rejection-data/non-fish/non-fish-cat-01.jpg",
      },
      {
        id: "low-quality",
        file: "qa/fish-recognition/rejection-data/low-quality/low-quality-blur-01.jpg",
      },
    ];

    for (const testCase of cases) {
      const bytes = await fs.readFile(path.join(process.cwd(), testCase.file));
      const response = await fetch(
        `${supabaseUrl}/functions/v1/identify-fish`,
        {
          method: "POST",
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            imageBase64: bytes.toString("base64"),
            mimeType: "image/jpeg",
            catalog,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(`${testCase.id} 호출 실패: ${JSON.stringify(result)}`);
      }
      const candidateCount = Array.isArray(result.candidates)
        ? result.candidates.length
        : -1;
      const passed = result.needs_retake === true && candidateCount === 0;
      console.log(
        JSON.stringify({
          id: testCase.id,
          passed,
          subjectPresent: result.subject_present,
          imageQuality: result.image_quality,
          needsRetake: result.needs_retake,
          candidateCount,
        }),
      );
      if (!passed) throw new Error(`${testCase.id} 거부 기준 실패`);
    }
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
