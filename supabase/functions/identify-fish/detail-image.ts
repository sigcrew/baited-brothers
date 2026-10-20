// Optional detail view: keep the original, never upscale or synthesize pixels.
export async function createDetailImage(base64: string, value: unknown): Promise<string | undefined> {
  if (!value || typeof value !== "object" || base64.length > 4_000_000) return;
  const { x, y, width, height, confidence } = value as Record<string, number>;
  if (![x, y, width, height, confidence].every(Number.isFinite) || confidence < 0.8 ||
    x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1 || y + height > 1 ||
    width * height < 0.025 || width * height > 0.8) return;
  try {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    // Bound decoded memory before importing the codec. Camera/library images are
    // normalized JPEGs in the app; other formats keep the original-only path.
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return;
    const view = new DataView(bytes.buffer);
    let dimensions: { width: number; height: number } | undefined;
    for (let offset = 2; offset + 4 <= bytes.length;) {
      if (bytes[offset++] !== 0xff) return;
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xda || marker === 0xd9) break;
      const size = view.getUint16(offset);
      if (size < 2 || offset + size > bytes.length) return;
      // Refuse EXIF-bearing uploads: the model may auto-orient them differently.
      // The mobile encoder strips EXIF before identification.
      if (marker === 0xe1) return;
      if ([0xc0, 0xc1, 0xc2].includes(marker)) {
        if (size < 8) return;
        dimensions = { height: view.getUint16(offset + 3), width: view.getUint16(offset + 5) };
        break;
      }
      offset += size;
    }
    if (!dimensions || dimensions.width < 1 || dimensions.height < 1 ||
      dimensions.width > 2048 || dimensions.height > 2048 || dimensions.width * dimensions.height > 2_000_000) return;
    const left = Math.max(0, Math.floor((x - width * .06) * dimensions.width));
    const top = Math.max(0, Math.floor((y - height * .06) * dimensions.height));
    const right = Math.min(dimensions.width, Math.ceil((x + width * 1.06) * dimensions.width));
    const bottom = Math.min(dimensions.height, Math.ceil((y + height * 1.06) * dimensions.height));
    if (right - left < 96 || bottom - top < 96) return;
    const { Image } = await import("https://deno.land/x/imagescript@1.3.0/mod.ts");
    const image = await Image.decode(bytes);
    if (image.width !== dimensions.width || image.height !== dimensions.height) return;
    const detail = await image.crop(left, top, right - left, bottom - top).encodeJPEG(85);
    let binary = "";
    for (let offset = 0; offset < detail.length; offset += 8192) {
      binary += String.fromCharCode(...detail.subarray(offset, offset + 8192));
    }
    return btoa(binary);
  } catch {
    // A failed optional crop must not turn a usable original into an error.
    console.warn("Fish detail unavailable; using original image");
    return;
  }
}
