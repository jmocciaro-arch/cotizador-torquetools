#!/usr/bin/env node

// ============================================================================
// TorqueTools ERP — Generador de iconos PWA
// Genera iconos PNG desde SVG usando Canvas (requiere Node 18+ con canvas, o
// si no hay canvas disponible, genera archivos SVG como fallback).
//
// Uso: node scripts/generate-icons.js
// O mejor: abrir /public/icons/generate.html en el navegador y descargar.
// ============================================================================

const fs = require('fs');
const path = require('path');

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');

// Asegurar que el directorio existe
if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

function generateSVG(size) {
  const radius = Math.round(size * 0.1875);
  const fontSize = Math.round(size * 0.55);
  const textY = Math.round(size * 0.66);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="#FF6600"/>
  <text x="${size / 2}" y="${textY}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="${fontSize}" font-weight="900" fill="white">TT</text>
</svg>`;
}

console.log('Generando iconos PWA para TorqueTools ERP...\n');

// Intentar usar canvas nativo (Node 18+ experimental)
let hasCanvas = false;
try {
  const { createCanvas } = require('canvas');
  hasCanvas = true;

  SIZES.forEach((size) => {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Fondo con esquinas redondeadas
    const radius = Math.round(size * 0.1875);
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(size - radius, 0);
    ctx.quadraticCurveTo(size, 0, size, radius);
    ctx.lineTo(size, size - radius);
    ctx.quadraticCurveTo(size, size, size - radius, size);
    ctx.lineTo(radius, size);
    ctx.quadraticCurveTo(0, size, 0, size - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.fillStyle = '#FF6600';
    ctx.fill();

    // Texto TT
    const fontSize = Math.round(size * 0.55);
    ctx.font = `900 ${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('TT', size / 2, size / 2);

    const buffer = canvas.toBuffer('image/png');
    const filePath = path.join(ICONS_DIR, `icon-${size}.png`);
    fs.writeFileSync(filePath, buffer);
    console.log(`  OK  icon-${size}.png (${buffer.length} bytes)`);
  });

  console.log(`\nListo! ${SIZES.length} iconos PNG generados en /public/icons/`);
} catch {
  // Sin paquete canvas: generar SVGs como placeholder
  console.log('  Nota: paquete "canvas" no disponible. Generando SVGs como placeholder.\n');
  console.log('  Para PNGs reales, abri /public/icons/generate.html en el navegador.\n');

  SIZES.forEach((size) => {
    const svg = generateSVG(size);
    const filePath = path.join(ICONS_DIR, `icon-${size}.svg`);
    fs.writeFileSync(filePath, svg);
    console.log(`  OK  icon-${size}.svg`);
  });

  // También generar un PNG de 1x1 como placeholder para que no rompa el manifest
  // En producción el usuario debería usar generate.html o instalar canvas
  console.log(`\nListo! SVGs placeholder generados en /public/icons/`);
  console.log('Para iconos PNG reales:');
  console.log('  1. Abri /public/icons/generate.html en el navegador');
  console.log('  2. Click en "Descargar todos los iconos"');
  console.log('  3. Mover los PNGs a /public/icons/');
  console.log('  O instalar: npm install canvas && node scripts/generate-icons.js');
}
