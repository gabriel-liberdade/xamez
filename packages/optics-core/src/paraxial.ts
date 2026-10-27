import { dot, matmul, matrixIdentity, refractionMatrix, translation, type Mat2 } from './math';
import type { System } from './types';
export type Conjugate =
  | {
      status: 'real' | 'virtual';
      distanceMm: number;
      magnification: number;
      matrix: Mat2;
      eflMm: number | null;
      bflMm: number | null;
      referenceSurfaceId: string;
      screenDistanceMm: number;
      outputIndex: number;
    }
  | { status: 'infinite' | 'unavailable'; reason: string };
export function solveConjugate(system: System, objectSurfaceId: string | undefined): Conjugate {
  const object = system.surfaces.findIndex((s) => s.id === objectSurfaceId);
  if (object < 0)
    return {
      status: 'unavailable',
      reason: 'Selecione uma máscara como objeto.',
    };
  const list = system.surfaces.slice(object + 1);
  const powered = list.filter((s) => s.kind === 'interface' || s.kind === 'thin-lens');
  if (!powered.length) return { status: 'unavailable', reason: 'Nenhuma lente depois do objeto.' };
  if (
    list.some(
      (s) =>
        s.kind === 'mirror' ||
        dot(s.frame.basis[2], system.surfaces[object].frame.basis[2]) < 1 - 1e-12,
    )
  )
    return {
      status: 'unavailable',
      reason: 'Fórmula paraxial indisponível para trecho dobrado ou inclinado.',
    };
  let m = matrixIdentity(),
    lens = matrixIdentity(),
    previous = system.surfaces[object],
    seenPower = false;
  const last = powered.at(-1)!;
  for (const s of list) {
    const t = translation(previous.gapAfterMm!, s.nBefore);
    m = matmul(t, m);
    if (seenPower) lens = matmul(t, lens);
    let op: Mat2 = matrixIdentity();
    if (s.kind === 'interface' && s.shape.kind === 'sphere')
      op = refractionMatrix(s.shape.radiusMm, s.nBefore, s.nAfter);
    if (s.kind === 'thin-lens') op = [1, 0, -1 / s.focalLengthMm, 1];
    m = matmul(op, m);
    lens = matmul(op, lens);
    if (s.kind === 'interface' || s.kind === 'thin-lens') seenPower = true;
    if (![...m, ...lens].every(Number.isFinite))
      return { status: 'unavailable', reason: 'Matriz fora do domínio numérico suportado.' };
    if (s === last) break;
    previous = s;
  }
  const [a, b, c, d] = m,
    n = last.nAfter;
  if (Math.abs(d) < 1e-12)
    return {
      status: 'infinite',
      reason: 'Conjugado no infinito (sistema afocal para este objeto).',
    };
  const distanceMm = (-n * b) / d,
    magnification = a + (distanceMm / n) * c;
  if (![distanceMm, magnification].every(Number.isFinite))
    return { status: 'unavailable', reason: 'Conjugação fora do domínio numérico suportado.' };
  let screenDistanceMm = 0,
    index = system.surfaces.indexOf(last);
  for (let i = index; i < system.surfaces.length - 1; i++)
    screenDistanceMm += system.surfaces[i].gapAfterMm!;
  return {
    status: distanceMm > 0 ? 'real' : 'virtual',
    distanceMm,
    magnification,
    matrix: m,
    eflMm: Math.abs(lens[2]) < 1e-12 ? null : -n / lens[2],
    bflMm: Math.abs(lens[2]) < 1e-12 ? null : (-n * lens[0]) / lens[2],
    referenceSurfaceId: last.id,
    screenDistanceMm,
    outputIndex: n,
  };
}
