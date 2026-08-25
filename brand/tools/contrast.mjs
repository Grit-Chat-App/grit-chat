// WCAG contrast, computed. Every ratio this brand claims is produced here rather than asserted.
//
// WCAG 2.x relative luminance: linearize each sRGB channel, then weight 0.2126 R, 0.7152 G, 0.0722 B.
// Ratio is (lighter + 0.05) / (darker + 0.05), so it runs from 1 to 21.
//
// Thresholds used in the report:
//   4.5  normal body text, AA
//   3.0  large text (>=24px, or >=19px bold) and non-text UI components, AA
//   7.0  normal body text, AAA

export function parseHex(hex) {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

export function relativeLuminance(hex) {
  const [r, g, b] = parseHex(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** Verdict against the thresholds that actually apply to the thing being coloured. */
export function verdict(ratio, kind) {
  if (kind === 'body') {
    if (ratio >= 7) return 'AAA';
    if (ratio >= 4.5) return 'AA';
    return 'FAIL';
  }
  // Large text and non-text components: 3:1 is the bar.
  if (ratio >= 4.5) return 'AA (also passes body)';
  if (ratio >= 3) return 'AA large';
  return 'FAIL';
}

export function table(pairs) {
  const rows = pairs.map((p) => {
    const ratio = contrast(p.fg, p.bg);
    return { ...p, ratio, verdict: verdict(ratio, p.kind ?? 'body') };
  });
  const w1 = Math.max(...rows.map((r) => r.label.length));
  const lines = rows.map(
    (r) =>
      `${r.label.padEnd(w1)}  ${r.fg} on ${r.bg}  ${r.ratio.toFixed(2).padStart(6)}:1  ${r.verdict}`,
  );
  return { rows, text: lines.join('\n') };
}
