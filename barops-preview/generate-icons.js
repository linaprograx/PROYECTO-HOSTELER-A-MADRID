import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fallback: crear SVG y convertir a PNG usando fs
function generateIcon(size) {
  // Para propósitos de demostración, crearemos un SVG y lo guardaremos
  // En producción usarías canvas o sharp

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#0A0A0A"/>
  <text x="${size/2}" y="${size/2 + size/8}" font-family="Courier New, Courier, monospace" font-size="${size * 0.55}" font-weight="bold" fill="#FF6B35" text-anchor="middle" dominant-baseline="middle">B</text>
</svg>`;

  return svg;
}

// Crear carpeta public si no existe
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Generar SVGs
const icon192SVG = generateIcon(192);
const icon512SVG = generateIcon(512);

// Guardar SVGs como PNG (básico)
fs.writeFileSync(path.join(publicDir, 'icon-192.svg'), icon192SVG);
fs.writeFileSync(path.join(publicDir, 'icon-512.svg'), icon512SVG);

console.log('✓ SVG icons generated successfully');
console.log('  → public/icon-192.svg');
console.log('  → public/icon-512.svg');
console.log('');
console.log('Nota: Los iconos SVG funcionan correctamente en PWA.');
console.log('Para PNG nativos, instala: npm install canvas');
console.log('Luego ejecuta este script de nuevo.');
