import { add, cross, dot, mul, norm, sub, unit, v, type Vec3 } from './math';
import type { Aperture, Shape } from './types';
export function apertureRadius(a: Aperture): number {
  return a.kind === 'circle' ? a.radiusMm : Math.hypot(a.widthMm, a.heightMm) / 2;
}
export function inAperture(p: Vec3, a: Aperture): boolean {
  // Inclusive edge, only a roundoff-sized relative tolerance.
  const e = 1 + 32 * Number.EPSILON;
  return a.kind === 'circle'
    ? Math.hypot(p.x, p.y) <= a.radiusMm * e
    : Math.abs(p.x) <= (a.widthMm / 2) * e && Math.abs(p.y) <= (a.heightMm / 2) * e;
}
export function sag(shape: Shape, r: number): number {
  if (shape.kind === 'plane') return 0;
  const c = 1 / shape.radiusMm;
  return (c * r * r) / (1 + Math.sqrt(Math.max(0, 1 - c * c * r * r)));
}
export type Intersection = { point: Vec3; normal: Vec3; t: number } | null;
export function intersect(p: Vec3, d: Vec3, shape: Shape): Intersection {
  const scale = Math.max(1, norm(p), shape.kind === 'sphere' ? Math.abs(shape.radiusMm) : 0),
    eps = 64 * Number.EPSILON * scale;
  if (shape.kind === 'plane') {
    if (Math.abs(d.z) < 1e-14) return null;
    const t = -p.z / d.z;
    if (t < -eps) return null;
    return {
      point: add(p, mul(d, Math.max(0, t))),
      normal: v(0, 0, 1),
      t: Math.max(0, t),
    };
  }
  const r = shape.radiusMm,
    oc = sub(p, v(0, 0, r)),
    a = dot(d, d),
    b = dot(oc, d),
    c = dot(p, p) - 2 * r * p.z;
  // Lagrange's identity avoids subtracting two ~distance² terms when the
  // sphere is small compared with the distance from the ray origin.
  const perpendicular = cross(oc, d),
    perpendicular2 = dot(perpendicular, perpendicular);
  let disc = a * r * r - perpendicular2;
  const discEps = 32 * Number.EPSILON * (a * r * r + perpendicular2);
  if (disc < -discEps) return null;
  disc = Math.max(0, disc);
  const root = Math.sqrt(disc),
    q = -b - (b >= 0 ? root : -root);
  const roots = q === 0 ? [-b / a] : [q / a, c / q];
  roots.sort((a, b) => a - b);
  for (const raw of roots) {
    if (raw < -eps) continue;
    const t = Math.max(0, raw),
      h = add(p, mul(d, t));
    // Select the vertex hemisphere, including its rim. Never the remote sphere cap.
    if ((h.z - r) * Math.sign(r) > eps) continue;
    const residual = Math.abs(dot(sub(h, v(0, 0, r)), sub(h, v(0, 0, r))) - r * r);
    if (residual > 256 * Number.EPSILON * Math.max(r * r, Math.abs(r) * scale)) continue;
    return { point: h, normal: unit(mul(sub(v(0, 0, r), h), Math.sign(r))), t };
  }
  return null;
}
export function refract(
  d: Vec3,
  forwardNormal: Vec3,
  n1: number,
  n2: number,
): { direction: Vec3; reflectance: number } | 'tir' | 'unsupported_direction' {
  const incidence = dot(d, forwardNormal);
  if (incidence < -1e-12) return 'unsupported_direction';
  if (n1 === n2) return { direction: d, reflectance: 0 };
  const ci = Math.max(0, Math.min(1, incidence)),
    eta = n1 / n2,
    k = 1 - eta * eta * (1 - ci * ci);
  if (k < -1e-12) return 'tir';
  const ct = Math.sqrt(Math.max(0, k)),
    n = mul(forwardNormal, -1);
  const direction = unit(add(mul(d, eta), mul(n, eta * ci - ct)));
  const rs = (n1 * ci - n2 * ct) / (n1 * ci + n2 * ct),
    rp = (n2 * ci - n1 * ct) / (n2 * ci + n1 * ct);
  return {
    direction,
    reflectance: Math.max(0, Math.min(1, (rs * rs + rp * rp) / 2)),
  };
}
