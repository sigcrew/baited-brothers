import type { ImagePickerAsset } from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";

export type LibraryPhotoMetadata = {
  capturedAt: string | null;
  latitude: number | null;
  longitude: number | null;
};

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};

const asFiniteNumber = (value: unknown) => {
  const number = typeof value === "string" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) ? number : null;
};

const signedCoordinate = (
  value: unknown,
  reference: unknown,
  negativeReference: "S" | "W",
) => {
  const coordinate = asFiniteNumber(value);
  if (coordinate == null) return null;
  return String(reference).toUpperCase() === negativeReference
    ? -Math.abs(coordinate)
    : coordinate;
};

const parseExifLocation = (exif: unknown) => {
  const root = asRecord(exif);
  const gps = asRecord(root.GPS);
  const latitude =
    asFiniteNumber(gps.Latitude) ??
    signedCoordinate(
      root.GPSLatitude,
      root.GPSLatitudeRef,
      "S",
    );
  const longitude =
    asFiniteNumber(gps.Longitude) ??
    signedCoordinate(
      root.GPSLongitude,
      root.GPSLongitudeRef,
      "W",
    );

  return {
    latitude:
      latitude != null && latitude >= -90 && latitude <= 90 ? latitude : null,
    longitude:
      longitude != null && longitude >= -180 && longitude <= 180
        ? longitude
        : null,
  };
};

const parseExifDate = (exif: unknown) => {
  const root = asRecord(exif);
  const raw =
    root.DateTimeOriginal ??
    root.DateTimeDigitized ??
    root.DateTime ??
    null;
  if (typeof raw !== "string" || !raw.trim()) return null;
  const normalized = raw
    .trim()
    .replace(
      /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/,
      "$1-$2-$3T$4:$5:$6",
    );
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const extractLibraryPhotoMetadata = async (
  asset: ImagePickerAsset,
): Promise<LibraryPhotoMetadata> => {
  let creationTime: number | null = null;
  let location: { latitude: number; longitude: number } | null = null;
  let fullExif: unknown = asset.exif;

  if (asset.assetId) {
    try {
      const permission = await MediaLibrary.requestPermissionsAsync(false, [
        "photo",
      ]);
      if (permission.granted) {
        const info = await MediaLibrary.getAssetInfoAsync(asset.assetId);
        creationTime = info.creationTime;
        location = info.location ?? null;
        fullExif = info.exif ?? fullExif;
      }
    } catch {
      // 선택한 사진 자체는 계속 기록하고 ImagePicker EXIF를 폴백으로 사용한다.
    }
  }

  const exifLocation = parseExifLocation(fullExif);
  const latitude = asFiniteNumber(location?.latitude) ?? exifLocation.latitude;
  const longitude =
    asFiniteNumber(location?.longitude) ?? exifLocation.longitude;
  const capturedAt =
    creationTime != null && Number.isFinite(creationTime)
      ? new Date(creationTime).toISOString()
      : parseExifDate(fullExif);

  return { capturedAt, latitude, longitude };
};
