const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const ROOT = path.resolve("assets/images/species/field60-illustrated");
const COLOR_DIR = path.join(ROOT, "color");
const OUTLINE_DIR = path.join(ROOT, "outline");
const REVIEW_DIR = path.join(ROOT, "review");
const manifest = require(path.resolve("tmp/field60-illustrations/manifest.json"));

const CELL_WIDTH = 720;
const CELL_HEIGHT = 300;
const IMAGE_SIZE = 270;
const SHEET_COLUMNS = 2;
const SHEET_ROWS = 5;
const BACKGROUND = [247, 250, 250, 255];
const INK = [23, 48, 55, 255];
const DIVIDER = [207, 222, 224, 255];

const DIGITS = {
  0: ["111", "101", "101", "101", "111"],
  1: ["010", "110", "010", "010", "111"],
  2: ["111", "001", "111", "100", "111"],
  3: ["111", "001", "111", "001", "111"],
  4: ["101", "101", "111", "001", "001"],
  5: ["111", "100", "111", "001", "111"],
  6: ["111", "100", "111", "101", "111"],
  7: ["111", "001", "010", "010", "010"],
  8: ["111", "101", "111", "101", "111"],
  9: ["111", "101", "111", "001", "111"],
};

function fill(png, color) {
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = color[0];
    png.data[i + 1] = color[1];
    png.data[i + 2] = color[2];
    png.data[i + 3] = color[3];
  }
}

function setPixel(png, x, y, color) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const i = (y * png.width + x) * 4;
  png.data[i] = color[0];
  png.data[i + 1] = color[1];
  png.data[i + 2] = color[2];
  png.data[i + 3] = color[3];
}

function drawRect(png, x, y, width, height, color) {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) setPixel(png, px, py, color);
  }
}

function drawNumber(png, number, x, y, scale = 4) {
  const text = String(number).padStart(2, "0");
  for (let index = 0; index < text.length; index += 1) {
    const glyph = DIGITS[text[index]];
    for (let row = 0; row < glyph.length; row += 1) {
      for (let column = 0; column < glyph[row].length; column += 1) {
        if (glyph[row][column] === "1") {
          drawRect(
            png,
            x + index * 4 * scale + column * scale,
            y + row * scale,
            scale,
            scale,
            INK,
          );
        }
      }
    }
  }
}

function resizeNearest(source, width, height) {
  const output = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    const sy = Math.min(source.height - 1, Math.floor((y * source.height) / height));
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(source.width - 1, Math.floor((x * source.width) / width));
      const sourceIndex = (sy * source.width + sx) * 4;
      const outputIndex = (y * width + x) * 4;
      source.data.copy(output.data, outputIndex, sourceIndex, sourceIndex + 4);
    }
  }
  return output;
}

function composite(destination, source, offsetX, offsetY) {
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const sourceIndex = (y * source.width + x) * 4;
      const destinationIndex =
        ((offsetY + y) * destination.width + offsetX + x) * 4;
      source.data.copy(
        destination.data,
        destinationIndex,
        sourceIndex,
        sourceIndex + 4,
      );
    }
  }
}

function readAndResize(filePath) {
  return resizeNearest(PNG.sync.read(fs.readFileSync(filePath)), IMAGE_SIZE, IMAGE_SIZE);
}

fs.mkdirSync(REVIEW_DIR, { recursive: true });

for (let sheetIndex = 0; sheetIndex < 6; sheetIndex += 1) {
  const sheet = new PNG({
    width: CELL_WIDTH * SHEET_COLUMNS,
    height: CELL_HEIGHT * SHEET_ROWS,
  });
  fill(sheet, BACKGROUND);

  const entries = manifest.slice(sheetIndex * 10, sheetIndex * 10 + 10);
  entries.forEach((entry, index) => {
    const column = index % SHEET_COLUMNS;
    const row = Math.floor(index / SHEET_COLUMNS);
    const cellX = column * CELL_WIDTH;
    const cellY = row * CELL_HEIGHT;
    const filename = `${entry.fileStem}.png`;
    const color = readAndResize(path.join(COLOR_DIR, filename));
    const outline = readAndResize(path.join(OUTLINE_DIR, filename));

    drawNumber(sheet, entry.sortOrder, cellX + 12, cellY + 14, 4);
    composite(sheet, color, cellX + 52, cellY + 15);
    composite(sheet, outline, cellX + 342, cellY + 15);

    drawRect(sheet, cellX + 331, cellY + 20, 1, CELL_HEIGHT - 40, DIVIDER);
    if (row < SHEET_ROWS - 1) {
      drawRect(sheet, cellX + 12, cellY + CELL_HEIGHT - 1, CELL_WIDTH - 24, 1, DIVIDER);
    }
  });

  const first = String(sheetIndex * 10 + 1).padStart(2, "0");
  const last = String(sheetIndex * 10 + 10).padStart(2, "0");
  const outputPath = path.join(REVIEW_DIR, `pairs-${first}-${last}.png`);
  fs.writeFileSync(outputPath, PNG.sync.write(sheet));
  console.log(`wrote ${outputPath}`);
}
