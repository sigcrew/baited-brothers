import "dotenv/config";

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { promisify } from "node:util";

import { createClient } from "@supabase/supabase-js";

const run = promisify(execFile);
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Supabase URL과 service_role 키가 필요합니다.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const bucket = admin.storage.from("user-uploads");
const cacheControl = "31536000";

type MediaFolder = "catches" | "trips" | "profile";

const thumbnailPathFor = (path: string) => {
  if (path.endsWith("/detail.jpg")) return path.replace(/detail\.jpg$/, "thumbnail.jpg");
  const extension = extname(path);
  return `${path.slice(0, extension ? -extension.length : undefined)}-thumbnail.jpg`;
};

const createThumbnail = async (path: string) => {
  const { data, error } = await bucket.download(path);
  if (error) throw error;

  const directory = await mkdtemp(join(tmpdir(), "baited-media-"));
  const sourcePath = join(directory, "source");
  const outputPath = join(directory, "thumbnail.jpg");
  try {
    const source = Buffer.from(await data.arrayBuffer());
    await writeFile(sourcePath, source);
    await run("sips", [
      "--resampleHeightWidthMax",
      "480",
      "--setProperty",
      "format",
      "jpeg",
      "--setProperty",
      "formatOptions",
      "72",
      sourcePath,
      "--out",
      outputPath,
    ]);
    const thumbnail = await readFile(outputPath);
    const thumbnailPath = thumbnailPathFor(path);
    const { error: uploadError } = await bucket.upload(thumbnailPath, thumbnail, {
      cacheControl,
      contentType: "image/jpeg",
      upsert: true,
    });
    if (uploadError) throw uploadError;

    const contentType = extname(path).toLowerCase() === ".png" ? "image/png" : "image/jpeg";
    const { error: cacheError } = await bucket.update(path, source, {
      cacheControl,
      contentType,
    });
    if (cacheError) throw cacheError;
    return thumbnailPath;
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
};

const downloadBuffer = async (path: string) => {
  const { data, error } = await bucket.download(path);
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
};

const isPrivateVariantPath = (path: string, folder: MediaFolder) =>
  path.includes(`/${folder}/`) && path.endsWith("/detail.jpg");

const relocateLegacyPair = async (
  userId: string,
  folder: MediaFolder,
  imagePath: string,
  thumbnailPath: string,
) => {
  if (isPrivateVariantPath(imagePath, folder)) {
    return { imagePath, thumbnailPath, legacyPaths: [] as string[] };
  }

  const [detail, thumbnail] = await Promise.all([
    downloadBuffer(imagePath),
    downloadBuffer(thumbnailPath),
  ]);
  const objectId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const basePath = `${userId}/${folder}/${objectId}`;
  const nextImagePath = `${basePath}/detail.jpg`;
  const nextThumbnailPath = `${basePath}/thumbnail.jpg`;
  const uploaded: string[] = [];
  try {
    const { error: detailError } = await bucket.upload(nextImagePath, detail, {
      cacheControl,
      contentType: extname(imagePath).toLowerCase() === ".png" ? "image/png" : "image/jpeg",
      upsert: false,
    });
    if (detailError) throw detailError;
    uploaded.push(nextImagePath);
    const { error: thumbnailError } = await bucket.upload(nextThumbnailPath, thumbnail, {
      cacheControl,
      contentType: "image/jpeg",
      upsert: false,
    });
    if (thumbnailError) throw thumbnailError;
    uploaded.push(nextThumbnailPath);
    return {
      imagePath: nextImagePath,
      thumbnailPath: nextThumbnailPath,
      legacyPaths: [imagePath, thumbnailPath],
    };
  } catch (error) {
    if (uploaded.length) await bucket.remove(uploaded);
    throw error;
  }
};

const backfillCatches = async () => {
  const { data, error } = await admin
    .from("user_catches")
    .select("id, user_id, image_path, thumbnail_path")
    .not("image_path", "is", null);
  if (error) throw error;

  for (const item of data ?? []) {
    if (!item.image_path) continue;
    const thumbnailPath = item.thumbnail_path ?? await createThumbnail(item.image_path);
    const relocated = await relocateLegacyPair(
      item.user_id,
      "catches",
      item.image_path,
      thumbnailPath,
    );
    const { error: updateError } = await admin
      .from("user_catches")
      .update({
        image_path: relocated.imagePath,
        thumbnail_path: relocated.thumbnailPath,
      })
      .eq("id", item.id);
    if (updateError) throw updateError;
    if (relocated.legacyPaths.length) await bucket.remove(relocated.legacyPaths);
  }
};

const backfillTrips = async () => {
  const { data, error } = await admin
    .from("fishing_trips")
    .select("id, user_id, cover_image_path, cover_thumbnail_path")
    .not("cover_image_path", "is", null);
  if (error) throw error;

  const processed = new Set<string>();
  for (const item of data ?? []) {
    if (!item.cover_image_path || processed.has(item.cover_image_path)) continue;
    processed.add(item.cover_image_path);
    const thumbnailPath = item.cover_thumbnail_path ?? await createThumbnail(item.cover_image_path);
    const relocated = await relocateLegacyPair(
      item.user_id,
      "trips",
      item.cover_image_path,
      thumbnailPath,
    );
    const { error: updateError } = await admin
      .from("fishing_trips")
      .update({
        cover_image_path: relocated.imagePath,
        cover_thumbnail_path: relocated.thumbnailPath,
      })
      .eq("cover_image_path", item.cover_image_path);
    if (updateError) throw updateError;
    if (relocated.legacyPaths.length) await bucket.remove(relocated.legacyPaths);
  }
};

const backfillProfiles = async () => {
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    for (const user of data.users) {
      const avatarPath =
        typeof user.user_metadata?.avatar_path === "string"
          ? user.user_metadata.avatar_path
          : null;
      const existingThumbnail =
        typeof user.user_metadata?.avatar_thumbnail_path === "string"
          ? user.user_metadata.avatar_thumbnail_path
          : null;
      if (!avatarPath) continue;
      const thumbnailPath = existingThumbnail ?? await createThumbnail(avatarPath);
      const relocated = await relocateLegacyPair(
        user.id,
        "profile",
        avatarPath,
        thumbnailPath,
      );
      const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          avatar_url: null,
          avatar_path: relocated.imagePath,
          avatar_thumbnail_path: relocated.thumbnailPath,
        },
      });
      if (updateError) throw updateError;
      if (relocated.legacyPaths.length) await bucket.remove(relocated.legacyPaths);
    }
    if (data.users.length < 100) break;
    page += 1;
  }
};

const main = async () => {
  await backfillCatches();
  await backfillTrips();
  await backfillProfiles();
  console.log("사용자 사진 썸네일과 장기 캐시 백필을 완료했습니다.");
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
