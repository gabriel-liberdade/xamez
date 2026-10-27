import {
  add,
  dot,
  inverse,
  localPoint,
  mul,
  norm,
  reflect,
  transform,
  unit,
  v,
  worldPoint,
} from './math';
import { inAperture, intersect, refract } from './geometry';
import type { Ray, System, Termination, Trace, Hit } from './types';
export const ENGINE_VERSION = '0.1.0';
export function traceRay(system: System, input: Ray, storePath = true): Trace {
  let position = input.position,
    direction = input.direction,
    weight = input.weight;
  const path = storePath ? [position] : [],
    hits: Hit[] = [];
  const end = (termination: Termination): Trace => ({
    termination,
    weight,
    geometricWeight: input.weight,
    hits,
    path,
    ray: { position, direction, weight },
  });
  if (
    ![position.x, position.y, position.z, direction.x, direction.y, direction.z, weight].every(
      Number.isFinite,
    ) ||
    Math.abs(norm(direction) - 1) > 1e-9 ||
    weight < 0
  ) {
    // Invalid inputs are classified without exposing NaN/Infinity in a result.
    return {
      termination: 'numerical_failure',
      weight: Number.isFinite(weight) && weight >= 0 ? weight : 0,
      geometricWeight: 0,
      hits: [],
      path: [],
      ray: { position: v(), direction: v(0, 0, 1), weight: 0 },
    };
  }
  for (const s of system.surfaces) {
    const p = localPoint(s.frame, position),
      d = inverse(s.frame.basis, direction);
    const intersection = intersect(p, d, s.kind === 'interface' ? s.shape : { kind: 'plane' });
    if (!intersection) return end('missed_surface');
    const { point: local, normal } = intersection;
    position = worldPoint(s.frame, local);
    if (storePath) path.push(position);
    const accepted = inAperture(local, s.aperture);
    const h: Hit = {
      surfaceId: s.id,
      point: position,
      local,
      accepted,
      incident: weight,
      transmitted: weight,
      fresnel: 0,
      mirrorAbsorption: 0,
      paraxialWarning: false,
    };
    hits.push(h);
    if (!accepted) {
      h.transmitted = 0;
      return end(s.kind === 'detector' ? 'outside_detector' : 'blocked_aperture');
    }
    if (s.kind === 'detector') return end('received');
    if (s.kind === 'interface') {
      const result = refract(d, normal, s.nBefore, s.nAfter);
      if (typeof result === 'string') {
        h.transmitted = 0;
        return end(result);
      }
      if (result.direction.z <= 1e-12) {
        h.transmitted = 0;
        return end('unsupported_direction');
      }
      direction = transform(s.frame.basis, result.direction);
      if (system.transmission === 'fresnel-uncoated') {
        h.fresnel = weight * result.reflectance;
        weight -= h.fresnel;
      }
    } else if (s.kind === 'mirror') {
      if (dot(direction, s.incomingAxis) <= 0 || d.z <= 1e-12) {
        h.transmitted = 0;
        return end('unsupported_direction');
      }
      direction = unit(reflect(direction, transform(s.frame.basis, v(0, 0, 1))));
      h.mirrorAbsorption = weight * (1 - s.reflectance);
      weight *= s.reflectance;
    } else if (s.kind === 'thin-lens') {
      if (d.z <= 1e-12) {
        h.transmitted = 0;
        return end('unsupported_direction');
      }
      h.paraxialWarning = Math.atan(Math.hypot(d.x / d.z, d.y / d.z)) > 0.1;
      direction = transform(
        s.frame.basis,
        unit(v(d.x / d.z - local.x / s.focalLengthMm, d.y / d.z - local.y / s.focalLengthMm, 1)),
      );
    }
    if (s.kind === 'thin-lens') {
      const outgoing = inverse(s.frame.basis, direction);
      h.paraxialWarning ||=
        Math.atan(Math.hypot(outgoing.x / outgoing.z, outgoing.y / outgoing.z)) > 0.1;
    }
    h.transmitted = weight;
    if (!Number.isFinite(weight) || ![direction.x, direction.y, direction.z].every(Number.isFinite))
      return end('numerical_failure');
  }
  return end('missed_surface');
}
