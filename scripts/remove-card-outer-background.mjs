import fs from "fs";
import path from "path";
import sharp from "sharp";

const ROOT = process.cwd();

const inputDir = path.join(ROOT, "public", "cards");
const outputDir = path.join(ROOT, "public", "cards_clean");
const backupDir = path.join(ROOT, "public", "cards_backup_before_outer_bg_cleanup");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyAll(src, dest) {
  ensureDir(dest);

  for (const file of fs.readdirSync(src)) {
    const sourcePath = path.join(src, file);
    const destPath = path.join(dest, file);

    if (fs.statSync(sourcePath).isFile()) {
      fs.copyFileSync(sourcePath, destPath);
    }
  }
}

async function detectBorderBox(image) {
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;

  const isDarkPixel = (x, y) => {
    const index = (y * width + x) * 4;

    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = data[index + 3];

    if (a < 30) return false;

    return r < 85 && g < 85 && b < 85;
  };

  const minRun = Math.max(8, Math.floor(Math.min(width, height) * 0.06));

  let left = 0;
  for (let x = 0; x < width; x++) {
    let run = 0;
    let maxRun = 0;

    for (let y = 0; y < height; y++) {
      if (isDarkPixel(x, y)) {
        run++;
        maxRun = Math.max(maxRun, run);
      } else {
        run = 0;
      }
    }

    if (maxRun >= minRun) {
      left = x;
      break;
    }
  }

  let right = width - 1;
  for (let x = width - 1; x >= 0; x--) {
    let run = 0;
    let maxRun = 0;

    for (let y = 0; y < height; y++) {
      if (isDarkPixel(x, y)) {
        run++;
        maxRun = Math.max(maxRun, run);
      } else {
        run = 0;
      }
    }

    if (maxRun >= minRun) {
      right = x;
      break;
    }
  }

  let top = 0;
  for (let y = 0; y < height; y++) {
    let run = 0;
    let maxRun = 0;

    for (let x = 0; x < width; x++) {
      if (isDarkPixel(x, y)) {
        run++;
        maxRun = Math.max(maxRun, run);
      } else {
        run = 0;
      }
    }

    if (maxRun >= minRun) {
      top = y;
      break;
    }
  }

  let bottom = height - 1;
  for (let y = height - 1; y >= 0; y--) {
    let run = 0;
    let maxRun = 0;

    for (let x = 0; x < width; x++) {
      if (isDarkPixel(x, y)) {
        run++;
        maxRun = Math.max(maxRun, run);
      } else {
        run = 0;
      }
    }

    if (maxRun >= minRun) {
      bottom = y;
      break;
    }
  }

  if (right <= left || bottom <= top) {
    return {
      left: 4,
      top: 4,
      right: width - 5,
      bottom: height - 5,
    };
  }

  return {
    left: Math.max(0, left - 2),
    top: Math.max(0, top - 2),
    right: Math.min(width - 1, right + 2),
    bottom: Math.min(height - 1, bottom + 2),
  };
}

function makeMaskSvg(width, height, box) {
  const rectWidth = box.right - box.left + 1;
  const rectHeight = box.bottom - box.top + 1;

  const radius = Math.round(Math.min(width, height) * 0.035);

  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect x="0" y="0" width="${width}" height="${height}" fill="black"/>
      <rect
        x="${box.left}"
        y="${box.top}"
        width="${rectWidth}"
        height="${rectHeight}"
        rx="${radius}"
        ry="${radius}"
        fill="white"
      />
    </svg>
  `);
}

async function processOne(fileName) {
  const inputPath = path.join(inputDir, fileName);
  const outputPath = path.join(outputDir, fileName);

  const image = sharp(inputPath).ensureAlpha();
  const metadata = await image.metadata();

  const width = metadata.width;
  const height = metadata.height;

  if (!width || !height) {
    throw new Error(`${fileName}: 画像サイズを取得できませんでした`);
  }

  const borderBox = await detectBorderBox(image.clone());
  const maskSvg = makeMaskSvg(width, height, borderBox);

  await image
    .composite([
      {
        input: maskSvg,
        blend: "dest-in",
      },
    ])
    .png()
    .toFile(outputPath);

  console.log(`OK: ${fileName}`);
}

async function main() {
  if (!fs.existsSync(inputDir)) {
    console.error("public/cards が見つかりません。");
    process.exit(1);
  }

  ensureDir(outputDir);
  ensureDir(backupDir);

  const files = fs
    .readdirSync(inputDir)
    .filter((file) => file.toLowerCase().endsWith(".png"))
    .sort();

  if (files.length === 0) {
    console.error("public/cards に PNG が見つかりません。");
    process.exit(1);
  }

  if (fs.readdirSync(backupDir).length === 0) {
    copyAll(inputDir, backupDir);
    console.log("元画像を public/cards_backup_before_outer_bg_cleanup にバックアップしました。");
  }

  console.log(`対象: ${files.length}枚`);

  for (const file of files) {
    await processOne(file);
  }

  console.log("完了しました。");
  console.log("出力先: public/cards_clean");
  console.log("確認後、public/cards_clean の中身で public/cards を上書きしてください。");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});