const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const ROOT = path.resolve(
  __dirname,
  "../assets/images/species/field60-illustrated",
);

function colorDistance(data, a, b) {
  const dr = data[a] - data[b];
  const dg = data[a + 1] - data[b + 1];
  const db = data[a + 2] - data[b + 2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function isPaleBlueBackground(data, offset) {
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  const average = (r + g + b) / 3;

  return (
    average > 168 &&
    r > 150 &&
    g > 165 &&
    b > 172 &&
    b - r > -4 &&
    g - r > -8
  );
}

function buildProtectedInterior(outlinePng) {
  const { width, height, data } = outlinePng;
  const pixelCount = width * height;
  const barrier = new Uint8Array(pixelCount);
  const radius = 11;

  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const average = (r + g + b) / 3;
    const score = (g + b) / 2 - r + (255 - average) * 0.34;

    if (score < 65) continue;

    const x = index % width;
    const y = Math.floor(index / width);
    for (let dy = -radius; dy <= radius; dy += 1) {
      const py = y + dy;
      if (py < 0 || py >= height) continue;
      const span = Math.floor(Math.sqrt(radius * radius - dy * dy));
      const start = Math.max(0, x - span);
      const end = Math.min(width - 1, x + span);
      barrier.fill(1, py * width + start, py * width + end + 1);
    }
  }

  const exterior = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let head = 0;
  let tail = 0;

  function enqueue(index) {
    if (barrier[index] || exterior[index]) return;
    exterior[index] = 1;
    queue[tail++] = index;
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y + 1 < height) enqueue(index + width);
  }

  const distance = new Uint16Array(pixelCount);
  distance.fill(65535);
  for (let index = 0; index < pixelCount; index += 1) {
    if (exterior[index]) distance[index] = 0;
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (x > 0) distance[index] = Math.min(distance[index], distance[index - 1] + 1);
      if (y > 0) distance[index] = Math.min(distance[index], distance[index - width] + 1);
    }
  }
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const index = y * width + x;
      if (x + 1 < width) distance[index] = Math.min(distance[index], distance[index + 1] + 1);
      if (y + 1 < height) distance[index] = Math.min(distance[index], distance[index + width] + 1);
    }
  }

  const protectedInterior = new Uint8Array(pixelCount);
  for (let index = 0; index < pixelCount; index += 1) {
    if (distance[index] > 24) protectedInterior[index] = 1;
  }
  return protectedInterior;
}

function removeColorBackground(png, outlinePng) {
  const { width, height, data } = png;
  const pixelCount = width * height;
  const protectedInterior = buildProtectedInterior(outlinePng);
  const background = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let head = 0;
  let tail = 0;

  function enqueue(index) {
    if (background[index] || protectedInterior[index]) return;
    const offset = index * 4;
    if (!isPaleBlueBackground(data, offset)) return;
    background[index] = 1;
    queue[tail++] = index;
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    const offset = index * 4;

    const neighbors = [];
    if (x > 0) neighbors.push(index - 1);
    if (x + 1 < width) neighbors.push(index + 1);
    if (y > 0) neighbors.push(index - width);
    if (y + 1 < height) neighbors.push(index + width);

    for (const neighbor of neighbors) {
      if (background[neighbor]) continue;
      const neighborOffset = neighbor * 4;
      if (
        !protectedInterior[neighbor] &&
        isPaleBlueBackground(data, neighborOffset) &&
        colorDistance(data, offset, neighborOffset) < 42
      ) {
        background[neighbor] = 1;
        queue[tail++] = neighbor;
      }
    }
  }

  for (let index = 0; index < pixelCount; index += 1) {
    if (background[index]) {
      data[index * 4 + 3] = 0;
    }
  }
}

function removeOutlineBackground(png) {
  const { data } = png;

  for (let offset = 0; offset < data.length; offset += 4) {
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const average = (r + g + b) / 3;
    const cyanStrength = (g + b) / 2 - r;
    const darkness = 255 - average;
    const score = cyanStrength + darkness * 0.34;
    const alpha = Math.max(0, Math.min(255, ((score - 30) / 65) * 255));

    data[offset + 3] = Math.round(alpha);
  }
}

function convertDirectory(kind) {
  const inputDir = path.join(ROOT, `${kind}-background`);
  const outputDir = path.join(ROOT, kind);
  fs.mkdirSync(outputDir, { recursive: true });

  const files = fs
    .readdirSync(inputDir)
    .filter((file) => file.endsWith(".png"))
    .sort();

  for (const file of files) {
    const inputPath = path.join(inputDir, file);
    const outputPath = path.join(outputDir, file);
    const png = PNG.sync.read(fs.readFileSync(inputPath));

    if (kind === "color") {
      const outlinePath = path.join(ROOT, "outline-background", file);
      const outlinePng = PNG.sync.read(fs.readFileSync(outlinePath));
      removeColorBackground(png, outlinePng);
    } else {
      removeOutlineBackground(png);
    }

    fs.writeFileSync(outputPath, PNG.sync.write(png));
  }

  console.log(`Converted ${files.length} ${kind} images to ${outputDir}`);
}

convertDirectory("outline");
