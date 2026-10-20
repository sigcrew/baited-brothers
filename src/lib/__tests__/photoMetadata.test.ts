jest.mock("expo-media-library", () => ({
  requestPermissionsAsync: jest.fn(),
  getAssetInfoAsync: jest.fn(),
}));

import * as MediaLibrary from "expo-media-library";
import {
  extractLibraryPhotoMetadata,
  parseExifDate,
  parseExifLocation,
} from "@/src/lib/photoMetadata";

const requestPermissions = MediaLibrary.requestPermissionsAsync as jest.Mock;
const getAssetInfo = MediaLibrary.getAssetInfoAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("parseExifDate", () => {
  it("normalises the EXIF 'YYYY:MM:DD HH:mm:ss' form", () => {
    const iso = parseExifDate({ DateTimeOriginal: "2026:10:20 06:30:15" });
    expect(iso).not.toBeNull();
    expect(new Date(iso!).getFullYear()).toBe(2026);
    expect(new Date(iso!).getMonth()).toBe(9);
    expect(new Date(iso!).getDate()).toBe(20);
  });

  it("falls back through DateTimeDigitized and DateTime, and rejects garbage", () => {
    expect(parseExifDate({ DateTime: "2026:01:02 03:04:05" })).not.toBeNull();
    expect(parseExifDate({ DateTimeOriginal: "not a date" })).toBeNull();
    expect(parseExifDate(undefined)).toBeNull();
  });
});

describe("parseExifLocation", () => {
  it("applies S/W references as negative coordinates", () => {
    expect(
      parseExifLocation({
        GPSLatitude: 33.5,
        GPSLatitudeRef: "S",
        GPSLongitude: 151.2,
        GPSLongitudeRef: "W",
      }),
    ).toEqual({ latitude: -33.5, longitude: -151.2 });
  });

  it("prefers the nested iOS GPS block and clamps out-of-range values", () => {
    expect(
      parseExifLocation({ GPS: { Latitude: 35.1, Longitude: 129.1 } }),
    ).toEqual({ latitude: 35.1, longitude: 129.1 });
    expect(parseExifLocation({ GPSLatitude: 95, GPSLongitude: 200 })).toEqual({
      latitude: null,
      longitude: null,
    });
  });
});

describe("extractLibraryPhotoMetadata", () => {
  const asset = (exif: unknown) =>
    ({ uri: "file:///photo.jpg", width: 10, height: 10, assetId: "asset-1", exif }) as never;

  it("uses the picker EXIF alone and never asks for library permission when it is complete", async () => {
    const result = await extractLibraryPhotoMetadata(
      asset({
        DateTimeOriginal: "2026:10:20 06:30:15",
        GPS: { Latitude: 35.1, Longitude: 129.1 },
      }),
    );
    expect(result.latitude).toBe(35.1);
    expect(result.longitude).toBe(129.1);
    expect(result.capturedAt).not.toBeNull();
    expect(requestPermissions).not.toHaveBeenCalled();
    expect(getAssetInfo).not.toHaveBeenCalled();
  });

  it("escalates to MediaLibrary only when the picker EXIF lacks GPS or time", async () => {
    requestPermissions.mockResolvedValue({ granted: true });
    getAssetInfo.mockResolvedValue({
      creationTime: Date.parse("2026-10-20T00:00:00Z"),
      location: { latitude: 34.9, longitude: 128.6 },
      exif: null,
    });
    const result = await extractLibraryPhotoMetadata(
      asset({ DateTimeOriginal: "2026:10:20 06:30:15" }),
    );
    expect(requestPermissions).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      capturedAt: "2026-10-20T00:00:00.000Z",
      latitude: 34.9,
      longitude: 128.6,
    });
  });

  it("keeps the picker EXIF when the library permission is denied", async () => {
    requestPermissions.mockResolvedValue({ granted: false });
    const result = await extractLibraryPhotoMetadata(
      asset({ DateTimeOriginal: "2026:10:20 06:30:15" }),
    );
    expect(getAssetInfo).not.toHaveBeenCalled();
    expect(result.capturedAt).not.toBeNull();
    expect(result.latitude).toBeNull();
  });
});
