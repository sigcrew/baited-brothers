import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const assetDir = join(root, "assets", "images", "design", "catch-stamps");
const masterPath = join(assetDir, "master", "catch-stamp-master.svg");
const monoFontPath = join(root, "assets", "fonts", "SpaceMono-Regular.ttf");
const koreanFontPath = join(
  root,
  "node_modules",
  "@expo-google-fonts",
  "noto-sans-kr",
  "900Black",
  "NotoSansKR_900Black.ttf",
);

const variants = [
  {
    key: "general",
    label: "기록",
    ink: "#E95A28",
    labelSize: 86,
  },
  {
    key: "verified",
    label: "인증",
    ink: "#217B73",
    labelSize: 86,
  },
  {
    key: "corrected",
    label: "정정",
    ink: "#B84C3B",
    labelSize: 86,
  },
  {
    key: "pending",
    label: "확인",
    ink: "#55777A",
    labelSize: 86,
  },
];

const [master, monoFont, koreanFont] = await Promise.all([
  readFile(masterPath, "utf8"),
  readFile(monoFontPath),
  readFile(koreanFontPath),
]);

const fontFace = `
  @font-face {
    font-family: "BaitedStampMono";
    src: url("data:font/ttf;base64,${monoFont.toString("base64")}") format("truetype");
  }
  @font-face {
    font-family: "BaitedStampKorean";
    src: url("data:font/ttf;base64,${koreanFont.toString("base64")}") format("truetype");
  }`;

await mkdir(assetDir, { recursive: true });

for (const variant of variants) {
  const svg = master
    .replace("__FONT_FACE__", fontFace)
    .replaceAll("__INK__", variant.ink)
    .replace("__LABEL_SIZE__", String(variant.labelSize))
    .replace("__LABEL__", variant.label);
  const outputPath = join(assetDir, `catch-stamp-${variant.key}.png`);

  await sharp(Buffer.from(svg))
    .resize(512, 512, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toFile(outputPath);

  console.log(`generated ${outputPath.replace(`${root}/`, "")}`);
}
