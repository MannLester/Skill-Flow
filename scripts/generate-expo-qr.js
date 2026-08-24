const fs = require('node:fs');
const path = require('node:path');
const QRCode = require('qrcode-terminal/vendor/QRCode');
const QRErrorCorrectLevel = require('qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel');
const { PNG } = require('pngjs');

const value = process.argv[2];

if (!value) {
  throw new Error('Usage: node scripts/generate-expo-qr.js <expo-url>');
}

const qr = new QRCode(-1, QRErrorCorrectLevel.M);
qr.addData(value);
qr.make();

const quietZone = 4;
const scale = 12;
const moduleCount = qr.getModuleCount();
const imageSize = (moduleCount + quietZone * 2) * scale;
const cells = [];

for (let row = 0; row < moduleCount; row += 1) {
  for (let column = 0; column < moduleCount; column += 1) {
    if (qr.isDark(row, column)) {
      cells.push(`<rect x="${column + quietZone}" y="${row + quietZone}" width="1" height="1"/>`);
    }
  }
}

const svg = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  `<svg xmlns="http://www.w3.org/2000/svg" width="${imageSize}" height="${imageSize}" viewBox="0 0 ${moduleCount + quietZone * 2} ${moduleCount + quietZone * 2}" shape-rendering="crispEdges">`,
  '<rect width="100%" height="100%" fill="#fff"/>',
  '<g fill="#000">',
  ...cells,
  '</g>',
  '</svg>',
].join('\n');

const outputPath = path.join(process.cwd(), '.codex-run', 'expo-go-qr.svg');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, svg);

const png = new PNG({ width: imageSize, height: imageSize });

for (let y = 0; y < imageSize; y += 1) {
  for (let x = 0; x < imageSize; x += 1) {
    const moduleX = Math.floor(x / scale) - quietZone;
    const moduleY = Math.floor(y / scale) - quietZone;
    const dark = moduleX >= 0
      && moduleY >= 0
      && moduleX < moduleCount
      && moduleY < moduleCount
      && qr.isDark(moduleY, moduleX);
    const offset = (y * imageSize + x) * 4;
    const color = dark ? 0 : 255;
    png.data[offset] = color;
    png.data[offset + 1] = color;
    png.data[offset + 2] = color;
    png.data[offset + 3] = 255;
  }
}

const pngOutputPath = path.join(process.cwd(), '.codex-run', 'expo-go-qr.png');
fs.writeFileSync(pngOutputPath, PNG.sync.write(png));
console.log(pngOutputPath);
