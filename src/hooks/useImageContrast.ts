import { useEffect, useState } from "react";
import {
  Platform,
  type ImageSourcePropType,
} from "react-native";
import { Asset } from "expo-asset";
import { Image as ExpoImage } from "expo-image";

const BASE83 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~";
const DARK_IMAGE_THRESHOLD = 0.28;
const contrastCache = new Map<string, boolean>();

const srgbToLinear = (value: number) => {
  const channel = value / 255;
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
};

const relativeLuminance = (red: number, green: number, blue: number) =>
  0.2126 * srgbToLinear(red) +
  0.7152 * srgbToLinear(green) +
  0.0722 * srgbToLinear(blue);

const decode83 = (value: string) => {
  let result = 0;
  for (const character of value) {
    result = result * 83 + BASE83.indexOf(character);
  }
  return result;
};

const luminanceFromBlurhash = (blurhash: string) => {
  if (blurhash.length < 6) return null;
  const dc = decode83(blurhash.slice(2, 6));
  return relativeLuminance((dc >> 16) & 255, (dc >> 8) & 255, dc & 255);
};

const analyzeWebImage = (uri: string) =>
  new Promise<number | null>((resolve) => {
    const image = document.createElement("img");
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 24;
        canvas.height = 24;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
          resolve(null);
          return;
        }

        // Header and trip copy occupy roughly the upper half of the cover.
        context.drawImage(
          image,
          0,
          0,
          image.naturalWidth,
          image.naturalHeight * 0.48,
          0,
          0,
          canvas.width,
          canvas.height
        );

        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let luminance = 0;
        let sampleCount = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          if (pixels[index + 3] < 128) continue;
          luminance += relativeLuminance(
            pixels[index],
            pixels[index + 1],
            pixels[index + 2]
          );
          sampleCount += 1;
        }
        resolve(sampleCount ? luminance / sampleCount : null);
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = uri;
  });

const analyzeNativeImage = async (uri: string) => {
  try {
    const blurhash = await ExpoImage.generateBlurhashAsync(uri, [1, 1]);
    return blurhash ? luminanceFromBlurhash(blurhash) : null;
  } catch {
    return null;
  }
};

const analyzeImage = async (uri: string) =>
  Platform.OS === "web" ? analyzeWebImage(uri) : analyzeNativeImage(uri);

const resolveImageUri = (source: ImageSourcePropType) => {
  const candidate = Array.isArray(source) ? source[0] : source;
  if (typeof candidate === "number") return Asset.fromModule(candidate).uri;
  if (typeof candidate === "string") return candidate;
  return candidate?.uri ?? "";
};

export const useImageContrast = (source: ImageSourcePropType) => {
  const uri = resolveImageUri(source);
  const [isDark, setIsDark] = useState(() => contrastCache.get(uri) ?? false);

  useEffect(() => {
    let active = true;
    const cached = contrastCache.get(uri);
    if (cached !== undefined) {
      setIsDark(cached);
      return () => {
        active = false;
      };
    }

    setIsDark(false);
    void analyzeImage(uri).then((luminance) => {
      if (luminance === null) return;
      const nextIsDark = luminance < DARK_IMAGE_THRESHOLD;
      contrastCache.set(uri, nextIsDark);
      if (active) setIsDark(nextIsDark);
    });

    return () => {
      active = false;
    };
  }, [uri]);

  return isDark;
};
