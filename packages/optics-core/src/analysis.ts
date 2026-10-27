import { localPoint, sub, unit, v, worldPoint, type Vec3 } from './math';
import { apertureRadius } from './geometry';
import {
  meridionalRays,
  randomSequence,
  sampleAperture,
  SAMPLING_VERSION,
  sourceRay,
} from './sources';
import { ENGINE_VERSION, traceRay } from './trace';
import type { System, Termination, Trace } from './types';
export type Sampling = {
  seed: number;
  illuminationRayCount: number;
  diagnosticRayCount: number;
  maxStoredPaths: number;
};
export type AnalysisRequest = {
  objectSurfaceId?: string;
  footprintSurfaceId: string;
  detectorGrid: { width: number; height: number };
  objectProbeFractions: { x: number; y: number }[];
};
export type SurfaceFlow = {
  id: string;
  incident: number;
  blocked: number;
  fresnel: number;
  mirrorAbsorption: number;
  transmitted: number;
  missed: number;
  other: number;
};
export type Spot = {
  objectPoint: { x: number; y: number };
  launched: number;
  received: number;
  centroid: { x: number; y: number } | null;
  rmsMm: number | null;
  r50Mm: number | null;
  r80Mm: number | null;
  points: Float64Array;
};
export type BatchResult = {
  engineVersion: string;
  samplingVersion: string;
  seed: number;
  launched: number;
  receivedCount: number;
  received: number;
  geometricReceived: number;
  standardError: number;
  energy: Record<Termination | 'fresnel' | 'mirror_absorption', number>;
  surfaceFlows: SurfaceFlow[];
  grid: Float64Array;
  gridWidth: number;
  gridHeight: number;
  pixelAreaMm2: number;
  footprint: Float64Array;
  footprintTruncated: boolean;
  paths: Trace[];
  pathsXZ: Trace[];
  paraxialWarning: boolean;
  spots: Spot[];
  aberration: { heightMm: number; interceptMm: number | null }[];
  elapsedMs: number;
};
const terminations: Termination[] = [
  'received',
  'outside_detector',
  'blocked_aperture',
  'missed_surface',
  'tir',
  'unsupported_direction',
  'numerical_failure',
];
function accumulator(system: System, sampling: Sampling, request: AnalysisRequest) {
  const n = sampling.illuminationRayCount,
    rng = randomSequence(sampling.seed),
    screen = system.surfaces.at(-1)!;
  const width =
      screen.aperture.kind === 'rectangle' ? screen.aperture.widthMm : 2 * screen.aperture.radiusMm,
    height =
      screen.aperture.kind === 'rectangle'
        ? screen.aperture.heightMm
        : 2 * screen.aperture.radiusMm;
  const gw = request.detectorGrid.width,
    gh = request.detectorGrid.height,
    pixelAreaMm2 = (width * height) / (gw * gh);
  const result: BatchResult = {
    engineVersion: ENGINE_VERSION,
    samplingVersion: SAMPLING_VERSION,
    seed: sampling.seed,
    launched: n,
    receivedCount: 0,
    received: 0,
    geometricReceived: 0,
    standardError: 0,
    energy: Object.fromEntries(
      [...terminations, 'fresnel', 'mirror_absorption'].map((t) => [t, 0]),
    ) as BatchResult['energy'],
    surfaceFlows: system.surfaces.map((s) => ({
      id: s.id,
      incident: 0,
      blocked: 0,
      fresnel: 0,
      mirrorAbsorption: 0,
      transmitted: 0,
      missed: 0,
      other: 0,
    })),
    grid: new Float64Array(gw * gh),
    gridWidth: gw,
    gridHeight: gh,
    pixelAreaMm2,
    footprint: new Float64Array(),
    footprintTruncated: false,
    paths: [],
    pathsXZ: [],
    paraxialWarning: false,
    spots: [],
    aberration: [],
    elapsedMs: 0,
  };
  const indices = new Map(system.surfaces.map((s, i) => [s.id, i])),
    footprint: number[] = [];
  let sumSquares = 0,
    footprintHits = 0;
  const step = () => {
    const trace = traceRay(system, sourceRay(system.source, rng, 1 / n), false);
    result.energy[trace.termination] += trace.weight;
    for (const h of trace.hits) {
      const flow = result.surfaceFlows[indices.get(h.surfaceId)!];
      flow.incident += h.incident;
      flow.transmitted += h.transmitted;
      flow.fresnel += h.fresnel;
      flow.mirrorAbsorption += h.mirrorAbsorption;
      if (!h.accepted) flow.blocked += h.incident;
      result.energy.fresnel += h.fresnel;
      result.energy.mirror_absorption += h.mirrorAbsorption;
      result.paraxialWarning ||= h.paraxialWarning;
      if (h.surfaceId === request.footprintSurfaceId) {
        footprintHits++;
        if (footprint.length < 18000) footprint.push(h.local.x, h.local.y, h.accepted ? 1 : 0);
      }
    }
    if (trace.termination === 'missed_surface') {
      const i = trace.hits.length;
      if (result.surfaceFlows[i]) {
        result.surfaceFlows[i].incident += trace.weight;
        result.surfaceFlows[i].missed += trace.weight;
      }
    }
    if (['tir', 'unsupported_direction', 'numerical_failure'].includes(trace.termination)) {
      const id = trace.hits.at(-1)?.surfaceId;
      if (id) result.surfaceFlows[indices.get(id)!].other += trace.weight;
    }
    if (trace.termination === 'received') {
      result.receivedCount++;
      result.received += trace.weight;
      sumSquares += trace.weight ** 2;
      result.geometricReceived += 1 / n;
      const p = trace.hits.at(-1)!.local;
      const ix = Math.max(0, Math.min(gw - 1, Math.floor((p.x / width + 0.5) * gw))),
        iy = Math.max(0, Math.min(gh - 1, Math.floor((p.y / height + 0.5) * gh)));
      result.grid[iy * gw + ix] += trace.weight / pixelAreaMm2;
    }
  };
  const finish = () => {
    result.standardError = Math.sqrt(
      Math.max(0, (n * sumSquares - result.received ** 2) / (n - 1)),
    );
    result.footprint = new Float64Array(footprint);
    result.footprintTruncated = footprintHits > 6000;
    const pathsPerPlane = Math.min(Math.floor(sampling.maxStoredPaths / 2), 61);
    result.paths = meridionalRays(system.source, pathsPerPlane, 'y').map((r) =>
      traceRay(system, r),
    );
    result.pathsXZ = meridionalRays(system.source, pathsPerPlane, 'x').map((r) =>
      traceRay(system, r),
    );
    result.spots = diagnosticSpots(system, sampling, request);
    result.aberration =
      system.modelKind === 'real-surfaces' ? aberrationCurve(system, request) : [];
    return result;
  };
  return { step, finish };
}
export function traceBatch(
  system: System,
  sampling: Sampling,
  request: AnalysisRequest,
): BatchResult {
  const start = performance.now(),
    a = accumulator(system, sampling, request);
  for (let i = 0; i < sampling.illuminationRayCount; i++) a.step();
  const result = a.finish();
  result.elapsedMs = performance.now() - start;
  return result;
}
export async function traceBatchAsync(
  system: System,
  sampling: Sampling,
  request: AnalysisRequest,
  control: {
    cancelled: () => boolean;
    yield: () => Promise<void>;
    progress?: (fraction: number) => void;
  },
): Promise<BatchResult | null> {
  const start = performance.now(),
    a = accumulator(system, sampling, request),
    n = sampling.illuminationRayCount;
  for (let i = 0; i < n; i++) {
    if (i % 1024 === 0) {
      if (control.cancelled()) return null;
      control.progress?.(i / n);
      await control.yield();
      if (control.cancelled()) return null;
    }
    a.step();
  }
  if (control.cancelled()) return null;
  const result = a.finish();
  result.elapsedMs = performance.now() - start;
  return result;
}
function diagnosticSetup(system: System, request: AnalysisRequest) {
  const index = system.surfaces.findIndex(
    (s) => s.id === request.objectSurfaceId && s.kind === 'mask',
  );
  if (index < 0 || index >= system.surfaces.length - 1) return null;
  return {
    object: system.surfaces[index],
    target: system.surfaces[index + 1],
    segment: {
      ...system,
      transmission: 'ideal' as const,
      surfaces: system.surfaces.slice(index + 1),
    },
  };
}
export function diagnosticSpots(
  system: System,
  sampling: Sampling,
  request: AnalysisRequest,
): Spot[] {
  const setup = diagnosticSetup(system, request);
  if (!setup) return [];
  const { object, target, segment } = setup,
    screen = system.surfaces.at(-1)!,
    rng = randomSequence(sampling.seed ^ 0xa51c);
  return request.objectProbeFractions.map((f) => {
    const a = object.aperture,
      x = f.x * (a.kind === 'circle' ? a.radiusMm : a.widthMm / 2),
      y = f.y * (a.kind === 'circle' ? a.radiusMm : a.heightMm / 2),
      origin = worldPoint(object.frame, v(x, y, 0));
    const points: number[] = [];
    for (let i = 0; i < sampling.diagnosticRayCount; i++) {
      const aimed = worldPoint(target.frame, sampleAperture(target.aperture, rng)),
        direction = unit(sub(aimed, origin));
      const trace = traceRay(
        segment,
        {
          position: origin,
          direction,
          weight: 1 / sampling.diagnosticRayCount,
        },
        false,
      );
      if (trace.termination === 'received') {
        const local = localPoint(screen.frame, trace.ray.position);
        points.push(local.x, local.y);
      }
    }
    const received = points.length / 2;
    if (!received)
      return {
        objectPoint: { x, y },
        launched: sampling.diagnosticRayCount,
        received,
        centroid: null,
        rmsMm: null,
        r50Mm: null,
        r80Mm: null,
        points: new Float64Array(),
      };
    let cx = 0,
      cy = 0;
    for (let i = 0; i < points.length; i += 2) {
      cx += points[i] / received;
      cy += points[i + 1] / received;
    }
    const radii = [];
    for (let i = 0; i < points.length; i += 2)
      radii.push(Math.hypot(points[i] - cx, points[i + 1] - cy));
    radii.sort((a, b) => a - b);
    const rmsMm = Math.sqrt(radii.reduce((s, r) => s + r * r, 0) / received);
    return {
      objectPoint: { x, y },
      launched: sampling.diagnosticRayCount,
      received,
      centroid: { x: cx, y: cy },
      rmsMm,
      r50Mm: radii[Math.ceil(received * 0.5) - 1],
      r80Mm: radii[Math.ceil(received * 0.8) - 1],
      points: new Float64Array(points),
    };
  });
}
function aberrationCurve(
  system: System,
  request: AnalysisRequest,
): { heightMm: number; interceptMm: number | null }[] {
  const setup = diagnosticSetup(system, request);
  if (!setup) return [];
  const { object, target, segment } = setup,
    origin = object.frame.origin,
    r =
      target.aperture.kind === 'rectangle'
        ? target.aperture.heightMm / 2
        : target.aperture.radiusMm;
  return Array.from({ length: 41 }, (_, i) => {
    const h = ((2 * i) / 40 - 1) * r * 0.999,
      aimed = worldPoint(target.frame, v(0, h, 0));
    const trace = traceRay(
      segment,
      { position: origin, direction: unit(sub(aimed, origin)), weight: 1 },
      false,
    );
    return {
      heightMm: h,
      interceptMm: trace.termination === 'received' ? trace.hits.at(-1)!.local.y : null,
    };
  });
}
