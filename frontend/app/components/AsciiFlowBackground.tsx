'use client';

import { useEffect, useRef } from 'react';

type GlyphCell = {
  column: number;
  row: number;
  seed: number;
};

const glyphs = ['·', '.', ':', '+', '=', '×', '○', 'ŷ', 'λ', 'σ', '∂', '0', '1'];
const matrixGlyphs = ['[0.84]', '[-.21]', '[1 0]', '[0 1]', 'μ=0.62', 'wᵢ'];
const palette = [
  [92, 106, 126], // graphite pearl
  [28, 118, 228], // blue
  [18, 158, 118], // green
  [138, 72, 205], // purple
] as const;

function hash(value: number) {
  const x = Math.sin(value * 91.345 + 17.31) * 43758.5453;
  return x - Math.floor(x);
}

function smoothstep(value: number) {
  return value * value * (3 - 2 * value);
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

// Interpolated value noise gives the color field broad, organic regions instead
// of assigning a color independently to each glyph.
function smoothNoise(x: number, y: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const xBlend = smoothstep(x - x0);
  const yBlend = smoothstep(y - y0);
  const top = lerp(hash(x0 * 37.71 + y0 * 91.17), hash((x0 + 1) * 37.71 + y0 * 91.17), xBlend);
  const bottom = lerp(hash(x0 * 37.71 + (y0 + 1) * 91.17), hash((x0 + 1) * 37.71 + (y0 + 1) * 91.17), xBlend);

  return lerp(top, bottom, yBlend);
}

/** A deliberately subtle, Home-page-only canvas background. */
export default function AsciiFlowBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = { x: -1000, y: -1000 };
    let cells: GlyphCell[] = [];
    let width = 0;
    let height = 0;
    let animationFrame = 0;
    let previousFrame = 0;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const columnCount = Math.ceil(width / 19) + 1;
      const rowCount = Math.ceil(height / 19) + 1;
      cells = Array.from({ length: columnCount * rowCount }, (_, index) => ({
        column: index % columnCount,
        row: Math.floor(index / columnCount),
        seed: hash(index + columnCount * 0.31),
      }));
    };

    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);
      context.font = '500 11.5px var(--font-geist-mono), ui-monospace, monospace';
      context.textBaseline = 'middle';

      for (const cell of cells) {
        const baseX = cell.column * 19;
        const baseY = cell.row * 19;
        const dx = baseX - pointer.x;
        const dy = baseY - pointer.y;
        const mouseInfluence = Math.exp(-(dx * dx + dy * dy) / 26000);
        const wave =
          Math.sin(cell.column * 0.23 + time * 0.00052 + cell.seed * 7) * 0.55 +
          Math.cos(cell.row * 0.19 - time * 0.00038 + cell.seed * 11) * 0.45;
        const flow = (wave + 1) / 2;
        const drift = time * 0.000018;
        const broadRegion = smoothNoise(cell.column * 0.034 + drift, cell.row * 0.034 - drift * 0.7);
        const detailRegion = smoothNoise(cell.column * 0.075 - drift * 1.2, cell.row * 0.075 + drift);
        const colorField = broadRegion * 0.74 + detailRegion * 0.26;

        const colorIndex = colorField < 0.14
          ? 0
          : colorField < 0.42
            ? 1
            : colorField < 0.68
              ? 2
              : 3;
        const color = palette[colorIndex];
        // Neutral areas stay airy; colored regions read closer to Warp's richer blobs.
        const opacity = (colorIndex === 0 ? 0.08 : 0.24) + flow * (colorIndex === 0 ? 0.14 : 0.28) + mouseInfluence * 0.38;
        if (opacity < 0.11 && cell.seed > 0.72) continue;
        context.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${Math.min(opacity, 0.72)})`;

        const displacement = mouseInfluence * 9;
        const x = baseX + Math.sin(time * 0.0012 + cell.row) * flow * 2 + (dx / (Math.abs(dx) + 40)) * displacement;
        const y = baseY + Math.cos(time * 0.001 + cell.column) * flow * 2 + (dy / (Math.abs(dy) + 40)) * displacement;
        const glyphIndex = Math.floor(cell.seed * 37 + flow * 8 + time * 0.0015) % glyphs.length;
        const isMatrixValue = cell.seed > 0.91 && flow > 0.48;

        if (isMatrixValue) {
          context.font = '500 8px var(--font-geist-mono), ui-monospace, monospace';
          context.fillText(matrixGlyphs[Math.floor(cell.seed * matrixGlyphs.length) % matrixGlyphs.length], x - 7, y);
          context.font = '500 11.5px var(--font-geist-mono), ui-monospace, monospace';
        } else {
          context.fillText(glyphs[glyphIndex], x, y);
        }
      }
    };

    const animate = (time: number) => {
      // Thirty fps is visually fluid for this treatment and keeps the Home page inexpensive.
      if (!previousFrame || time - previousFrame > 33) {
        draw(time);
        previousFrame = time;
      }
      animationFrame = window.requestAnimationFrame(animate);
    };

    const onPointerMove = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    };
    const onPointerLeave = () => {
      pointer.x = -1000;
      pointer.y = -1000;
    };

    resize();
    draw(0);
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('mouseleave', onPointerLeave);

    if (!mediaQuery.matches) animationFrame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('mouseleave', onPointerLeave);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0" />;
}
