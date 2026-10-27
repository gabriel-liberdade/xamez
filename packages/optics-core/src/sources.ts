import { rad, unit, v, type Vec3 } from './math';
import type { Aperture, Ray, Source } from './types';
export const SAMPLING_VERSION = 'mulberry32-v1';
export function randomSequence(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function sampleAperture(a: Aperture, rng: () => number): Vec3 {
  if (a.kind === 'rectangle') return v((rng() - 0.5) * a.widthMm, (rng() - 0.5) * a.heightMm, 0);
  const r = a.radiusMm * Math.sqrt(rng()),
    phi = 2 * Math.PI * rng();
  return v(r * Math.cos(phi), r * Math.sin(phi), 0);
}
export function sourceRay(source: Source, rng: () => number, weight: number): Ray {
  if (source.kind === 'collimated')
    return {
      position: {
        ...sampleAperture(source.launchAperture, rng),
        z: source.launchPlaneZMm,
      },
      direction: unit(
        v(Math.tan(rad(source.fieldAnglesDeg.x)), Math.tan(rad(source.fieldAnglesDeg.y)), 1),
      ),
      weight,
    };
  const angular = source.angular,
    u = rng(),
    phi = 2 * Math.PI * rng();
  const cosine =
    angular.model === 'uniform-cone'
      ? 1 - u * (1 - Math.cos(rad(angular.halfAngleDeg)))
      : (1 - u) **
        (1 / (Math.log(0.5) / Math.log(Math.cos(rad(angular.fullWidthHalfMaxDeg / 2))) + 1));
  const sine = Math.sqrt(Math.max(0, 1 - cosine * cosine));
  return {
    position: source.positionMm,
    direction: v(sine * Math.cos(phi), sine * Math.sin(phi), cosine),
    weight,
  };
}
export function meridionalRays(source: Source, count = 41, axis: 'x' | 'y' = 'y'): Ray[] {
  if (count < 1) return [];
  return Array.from({ length: count }, (_, i) => {
    const h = count === 1 ? 0 : (2 * i) / (count - 1) - 1;
    if (source.kind === 'collimated') {
      const a = source.launchAperture,
        extent = a.kind === 'circle' ? a.radiusMm : (axis === 'y' ? a.heightMm : a.widthMm) / 2;
      return {
        position: { ...v(), [axis]: h * extent, z: source.launchPlaneZMm },
        direction: unit(
          v(Math.tan(rad(source.fieldAnglesDeg.x)), Math.tan(rad(source.fieldAnglesDeg.y)), 1),
        ),
        weight: 1 / count,
      };
    }
    const angle =
      rad(source.angular.model === 'uniform-cone' ? source.angular.halfAngleDeg : 85) * h;
    return {
      position: source.positionMm,
      direction:
        axis === 'y'
          ? v(0, Math.sin(angle), Math.cos(angle))
          : v(Math.sin(angle), 0, Math.cos(angle)),
      weight: 1 / count,
    };
  });
}
