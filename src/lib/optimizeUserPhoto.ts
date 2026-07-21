import {
  ImageManipulator,
  SaveFormat,
  type ImageResult,
} from "expo-image-manipulator";

type OptimizeUserPhotoOptions = {
  uri: string;
  width?: number | null;
  height?: number | null;
  maxDimension?: number;
  compress?: number;
  includeBase64?: boolean;
};

export type OptimizedUserPhoto = ImageResult & {
  mimeType: "image/jpeg";
};

export const optimizeUserPhoto = async ({
  uri,
  width,
  height,
  maxDimension = 1280,
  compress = 0.75,
  includeBase64 = false,
}: OptimizeUserPhotoOptions): Promise<OptimizedUserPhoto> => {
  const context = ImageManipulator.manipulate(uri);
  const sourceWidth = width ?? 0;
  const sourceHeight = height ?? 0;
  const longestSide = Math.max(sourceWidth, sourceHeight);

  if (longestSide > maxDimension) {
    if (sourceWidth >= sourceHeight) {
      context.resize({ width: maxDimension, height: null });
    } else {
      context.resize({ width: null, height: maxDimension });
    }
  }

  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({
    base64: includeBase64,
    compress,
    format: SaveFormat.JPEG,
  });

  if (includeBase64 && !result.base64) {
    throw new Error("최적화된 사진 데이터를 만들지 못했습니다.");
  }

  return {
    ...result,
    mimeType: "image/jpeg",
  };
};
