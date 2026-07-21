import type { ImageResult } from "expo-image-manipulator";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "@/src/lib/supabase";
import { optimizeUserPhoto } from "@/src/lib/optimizeUserPhoto";

export const USER_MEDIA_BUCKET = "user-uploads";
export const USER_MEDIA_CACHE_CONTROL = "31536000";
export const USER_MEDIA_URL_TTL_SECONDS = 60 * 60 * 24 * 7;
const SIGNED_URL_REFRESH_MARGIN_MS = 5 * 60 * 1000;

const signedUrlCacheKey = (path: string) =>
  `@baited-brothers/signed-media/${encodeURIComponent(path)}`;

type PreparedPhoto = Pick<ImageResult, "uri" | "width" | "height"> & {
  mimeType: "image/jpeg";
};

type UploadUserPhotoVariantsInput = {
  userId: string;
  folder: "catches" | "trips" | "profile";
  photo: PreparedPhoto;
};

export type UploadedUserPhotoVariants = {
  imagePath: string;
  thumbnailPath: string;
};

const readPhoto = async (uri: string) => {
  const response = await fetch(uri);
  if (!response.ok) throw new Error("사진 파일을 읽지 못했습니다.");
  return response.arrayBuffer();
};

export const uploadUserPhotoVariants = async ({
  userId,
  folder,
  photo,
}: UploadUserPhotoVariantsInput): Promise<UploadedUserPhotoVariants> => {
  const thumbnail = await optimizeUserPhoto({
    uri: photo.uri,
    width: photo.width,
    height: photo.height,
    maxDimension: 480,
    compress: 0.72,
  });
  const objectId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const basePath = `${userId}/${folder}/${objectId}`;
  const imagePath = `${basePath}/detail.jpg`;
  const thumbnailPath = `${basePath}/thumbnail.jpg`;
  const uploadedPaths: string[] = [];

  try {
    const detailBuffer = await readPhoto(photo.uri);
    const { error: detailError } = await supabase.storage
      .from(USER_MEDIA_BUCKET)
      .upload(imagePath, detailBuffer, {
        cacheControl: USER_MEDIA_CACHE_CONTROL,
        contentType: photo.mimeType,
        upsert: false,
      });
    if (detailError) throw detailError;
    uploadedPaths.push(imagePath);

    const thumbnailBuffer = await readPhoto(thumbnail.uri);
    const { error: thumbnailError } = await supabase.storage
      .from(USER_MEDIA_BUCKET)
      .upload(thumbnailPath, thumbnailBuffer, {
        cacheControl: USER_MEDIA_CACHE_CONTROL,
        contentType: thumbnail.mimeType,
        upsert: false,
      });
    if (thumbnailError) throw thumbnailError;
    uploadedPaths.push(thumbnailPath);

    return { imagePath, thumbnailPath };
  } catch (error) {
    if (uploadedPaths.length) {
      await supabase.storage.from(USER_MEDIA_BUCKET).remove(uploadedPaths);
    }
    throw error;
  }
};

export const removeUserMedia = async (
  paths: Array<string | null | undefined>,
) => {
  const validPaths = Array.from(new Set(paths.filter((path): path is string => Boolean(path))));
  if (!validPaths.length) return;
  await supabase.storage.from(USER_MEDIA_BUCKET).remove(validPaths);
  await Promise.all(
    validPaths.map((path) => AsyncStorage.removeItem(signedUrlCacheKey(path))),
  );
};

export const createSignedUserMediaUrls = async (
  paths: Array<string | null | undefined>,
) => {
  const validPaths = Array.from(new Set(paths.filter((path): path is string => Boolean(path))));
  const urls = new Map<string, string>();
  if (!validPaths.length) return urls;

  const cachedEntries = await Promise.all(
    validPaths.map(async (path) => {
      try {
        const raw = await AsyncStorage.getItem(signedUrlCacheKey(path));
        if (!raw) return { path, url: null };
        const cached = JSON.parse(raw) as { url?: unknown; expiresAt?: unknown };
        if (
          typeof cached.url === "string" &&
          typeof cached.expiresAt === "number" &&
          cached.expiresAt - SIGNED_URL_REFRESH_MARGIN_MS > Date.now()
        ) {
          return { path, url: cached.url };
        }
      } catch {
        await AsyncStorage.removeItem(signedUrlCacheKey(path));
      }
      return { path, url: null };
    }),
  );
  const missingPaths: string[] = [];
  for (const entry of cachedEntries) {
    if (entry.url) urls.set(entry.path, entry.url);
    else missingPaths.push(entry.path);
  }
  if (!missingPaths.length) return urls;

  const { data, error } = await supabase.storage
    .from(USER_MEDIA_BUCKET)
    .createSignedUrls(missingPaths, USER_MEDIA_URL_TTL_SECONDS);
  if (error) throw error;

  const expiresAt = Date.now() + USER_MEDIA_URL_TTL_SECONDS * 1000;
  const cacheWrites: Promise<void>[] = [];
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) {
      urls.set(item.path, item.signedUrl);
      cacheWrites.push(
        AsyncStorage.setItem(
          signedUrlCacheKey(item.path),
          JSON.stringify({ url: item.signedUrl, expiresAt }),
        ),
      );
    }
  }
  await Promise.all(cacheWrites);
  return urls;
};

export const createSignedUserMediaUrl = async (path?: string | null) => {
  if (!path) return null;
  const urls = await createSignedUserMediaUrls([path]);
  return urls.get(path) ?? null;
};
