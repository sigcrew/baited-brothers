import { createDetailImage } from '../supabase/functions/identify-fish/detail-image.ts';
const box = { x: .25, y: .25, width: .5, height: .5, confidence: .95 };
const assert = (ok: unknown, message: string) => { if (!ok) throw Error(message); };
Deno.test('crops actual JPEG pixels with padding without inventing detail', async () => {
  const { Image } = await import('https://deno.land/x/imagescript@1.3.0/mod.ts');
  const source = new Image(400, 200).fill(0xff0000ff);
  const encoded = btoa(String.fromCharCode(...await source.encodeJPEG(85)));
  const detail = await createDetailImage(encoded, box);
  assert(detail, 'Expected detail for a clear centered subject');
  const cropped = await Image.decode(Uint8Array.from(atob(detail!), c => c.charCodeAt(0)));
  assert(cropped.width === 224 && cropped.height === 112, 'Expected 6% subject padding on each side');
  const pixel = cropped.getPixelAt(100, 50);
  assert(((pixel >>> 24) & 255) > 230 && ((pixel >>> 16) & 255) < 20, 'Original red pixels retained');
  for (const bad of [null, {...box, confidence:.3}, {...box, x:-.1}, {...box, width:NaN}, {...box, x:.8}, {...box, width:.01}, {x:0,y:0,width:1,height:1,confidence:1}]) {
    assert(await createDetailImage(encoded, bad) === undefined, 'Unsafe/unhelpful boxes must fall back');
  }
});
Deno.test('malformed, unsupported and excessive JPEG dimensions fall back before decoding', async () => {
  for (const input of ['', 'not base64!', btoa('not an image'), btoa(String.fromCharCode(255,216,255,192,0,17,8,255,255,255,255,3,1,17,0,2,17,0,3,17,0))]) {
    assert(await createDetailImage(input, box) === undefined, 'Invalid/oversized image must be skipped');
  }
});
