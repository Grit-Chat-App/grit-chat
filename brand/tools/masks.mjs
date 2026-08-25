// The real platform icon masks and safe zones, so an icon is checked rather than hoped about.
//
// ANDROID adaptive icons: the foreground and background layers are 108dp square, the system may mask
// down to 72dp, and only a centred 66dp CIRCLE is guaranteed visible across every OEM mask shape.
// So the safe zone is 66/108 = 61.1% of the width, and it is a circle, not a square.
// Source: developer.android.com adaptive icon design guidance.
//
// iOS: submit a square with 90 degree corners and let the system apply its own mask. The mask is a
// continuous-corner squircle whose effective corner radius sits near 22.37% of the width. Apple does
// not publish the curve, so this module offers both a superellipse approximation and a plain rounded
// rect at 22.37%, and content is expected to clear the harsher of the two.

export const ANDROID = { canvas: 108, mask: 72, safeCircle: 66 };
export const IOS = { radiusRatio: 0.2237, superellipseExponent: 5 };

/** A superellipse standing in for iOS's continuous-corner mask. Stated as an approximation. */
export function squirclePath(size, exp = IOS.superellipseExponent, steps = 240) {
  const c = size / 2;
  const pts = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * 2 * Math.PI;
    const ct = Math.cos(t);
    const st = Math.sin(t);
    const x = c + c * Math.sign(ct) * Math.abs(ct) ** (2 / exp);
    const y = c + c * Math.sign(st) * Math.abs(st) ** (2 / exp);
    pts.push(`${x.toFixed(3)} ${y.toFixed(3)}`);
  }
  return `M ${pts.join(' L ')} Z`;
}

/**
 * Largest rect of a given aspect that fits inside a circle of diameter D.
 * w = D*a/sqrt(1+a^2), h = D/sqrt(1+a^2).
 */
export function inscribeInCircle(aspect, diameter) {
  const k = Math.sqrt(1 + aspect * aspect);
  return { w: (diameter * aspect) / k, h: diameter / k };
}

/**
 * Does a centred rect clear a rounded-rect corner of radius r inside a square of side S?
 * Only the corner arcs can clip, so check the rect's corner against the arc centre.
 */
export function clearsRoundedRect(w, h, S, r) {
  const dx = w / 2;
  const dy = h / 2;
  const cx = S / 2 - r;
  const cy = S / 2 - r;
  if (dx <= cx || dy <= cy) return true; // corner sits inside the straight edges
  const ox = dx - cx;
  const oy = dy - cy;
  return Math.hypot(ox, oy) <= r;
}

/** Does a centred rect clear the superellipse |2x/S|^n + |2y/S|^n = 1? */
export function clearsSuperellipse(w, h, S, exp = IOS.superellipseExponent) {
  const nx = w / S;
  const ny = h / S;
  return nx ** exp + ny ** exp <= 1;
}

/** Overlay showing the Android guaranteed circle and maximum mask, for eyeballing clearance. */
export function androidZoneOverlay() {
  const { canvas, mask, safeCircle } = ANDROID;
  const c = canvas / 2;
  return (
    `<circle cx="${c}" cy="${c}" r="${safeCircle / 2}" fill="none" stroke="#F2A93B" ` +
    `stroke-width="0.7" stroke-dasharray="2 2"/>` +
    `<rect x="${(canvas - mask) / 2}" y="${(canvas - mask) / 2}" width="${mask}" height="${mask}" ` +
    `fill="none" stroke="#E2603C" stroke-width="0.7" stroke-dasharray="4 3"/>`
  );
}
