const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const ROOT = path.resolve("assets/images/species/field60-illustrated");
const COLOR_DIR = path.join(ROOT, "color");
const OUTLINE_DIR = path.join(ROOT, "outline");
const TEAL = [35, 143, 149, 255];

function largestComponent(mask, width, height) {
  const seen = new Uint8Array(mask.length);
  let best = [];
  const queue = new Int32Array(mask.length);
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || seen[start]) continue;
    let head = 0;
    let tail = 0;
    const component = [];
    queue[tail++] = start;
    seen[start] = 1;
    while (head < tail) {
      const current = queue[head++];
      component.push(current);
      const x = current % width;
      const y = Math.floor(current / width);
      const neighbors = [
        x > 0 ? current - 1 : -1,
        x + 1 < width ? current + 1 : -1,
        y > 0 ? current - width : -1,
        y + 1 < height ? current + width : -1,
      ];
      for (const next of neighbors) {
        if (next >= 0 && mask[next] && !seen[next]) {
          seen[next] = 1;
          queue[tail++] = next;
        }
      }
    }
    if (component.length > best.length) best = component;
  }
  const result = new Uint8Array(mask.length);
  for (const index of best) result[index] = 1;
  return result;
}

function dilate(mask, width, height, radius = 2) {
  const result = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let filled = 0;
      for (let dy = -radius; dy <= radius && !filled; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (
            nx >= 0 &&
            ny >= 0 &&
            nx < width &&
            ny < height &&
            mask[ny * width + nx]
          ) {
            filled = 1;
            break;
          }
        }
      }
      result[y * width + x] = filled;
    }
  }
  return result;
}

function fillHoles(mask, width, height) {
  const outside = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  let head = 0;
  let tail = 0;
  function push(index) {
    if (!mask[index] && !outside[index]) {
      outside[index] = 1;
      queue[tail++] = index;
    }
  }
  for (let x = 0; x < width; x += 1) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    push(y * width);
    push(y * width + width - 1);
  }
  while (head < tail) {
    const current = queue[head++];
    const x = current % width;
    const y = Math.floor(current / width);
    if (x > 0) push(current - 1);
    if (x + 1 < width) push(current + 1);
    if (y > 0) push(current - width);
    if (y + 1 < height) push(current + width);
  }
  const result = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i += 1) result[i] = outside[i] ? 0 : 1;
  return result;
}

function boundaryPoints(mask, width, height) {
  const points = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      if (
        mask[i] &&
        (!mask[i - 1] ||
          !mask[i + 1] ||
          !mask[i - width] ||
          !mask[i + width])
      ) {
        points.push([x, y]);
      }
    }
  }
  return points;
}

function drawDot(png, cx, cy, radius = 2) {
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      if (x < 0 || y < 0 || x >= png.width || y >= png.height) continue;
      if ((x - cx) ** 2 + (y - cy) ** 2 > radius ** 2) continue;
      const i = (y * png.width + x) * 4;
      png.data[i] = TEAL[0];
      png.data[i + 1] = TEAL[1];
      png.data[i + 2] = TEAL[2];
      png.data[i + 3] = TEAL[3];
    }
  }
}

function createOutline(inputPath, outputPath) {
  const source = PNG.sync.read(fs.readFileSync(inputPath));
  const rawMask = new Uint8Array(source.width * source.height);
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const i = (y * source.width + x) * 4;
      rawMask[y * source.width + x] = source.data[i + 3] > 24 ? 1 : 0;
    }
  }
  let mask = largestComponent(rawMask, source.width, source.height);
  mask = dilate(mask, source.width, source.height, 1);
  mask = fillHoles(mask, source.width, source.height);
  const boundary = boundaryPoints(mask, source.width, source.height);

  const output = new PNG({ width: source.width, height: source.height });
  for (let i = 0; i < output.data.length; i += 4) {
    output.data[i] = 0;
    output.data[i + 1] = 0;
    output.data[i + 2] = 0;
    output.data[i + 3] = 0;
  }

  // Direction-independent stippling avoids long gaps on curves that happen to
  // follow the same coordinate phase while retaining a dotted silhouette.
  for (const [x, y] of boundary) {
    const hash = ((x * 73856093) ^ (y * 19349663)) >>> 0;
    if (hash % 5 < 2) drawDot(output, x, y, 3.4);
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, PNG.sync.write(output));
}

const requested = process.argv.slice(2);
const files = fs
  .readdirSync(COLOR_DIR)
  .filter((file) => file.endsWith(".png"))
  .filter((file) => requested.length === 0 || requested.includes(file));

for (const file of files) {
  createOutline(path.join(COLOR_DIR, file), path.join(OUTLINE_DIR, file));
  console.log(`outlined ${file}`);
}
