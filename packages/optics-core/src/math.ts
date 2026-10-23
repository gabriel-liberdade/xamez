export type Vec3 = { x: number; y: number; z: number };
export const v = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const add = (a: Vec3, b: Vec3): Vec3 => v(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: Vec3, b: Vec3): Vec3 => v(a.x - b.x, a.y - b.y, a.z - b.z);
export const mul = (a: Vec3, s: number): Vec3 => v(a.x * s, a.y * s, a.z * s);
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 =>
  v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const norm = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
export const unit = (a: Vec3): Vec3 => {
  const n = norm(a);
  if (!Number.isFinite(n) || n < 1e-300) throw new Error('Vetor degenerado');
  return mul(a, 1 / n);
};
export const rad = (d: number): number => (d * Math.PI) / 180;
export type Basis = [Vec3, Vec3, Vec3]; // columns: right-handed orthonormal basis
export type Frame = { origin: Vec3; basis: Basis };
export const identity = (): Basis => [v(1, 0, 0), v(0, 1, 0), v(0, 0, 1)];
export const transform = (b: Basis, p: Vec3): Vec3 =>
  add(add(mul(b[0], p.x), mul(b[1], p.y)), mul(b[2], p.z));
export const inverse = (b: Basis, p: Vec3): Vec3 => v(dot(b[0], p), dot(b[1], p), dot(b[2], p));
export const localPoint = (f: Frame, p: Vec3): Vec3 => inverse(f.basis, sub(p, f.origin));
export const worldPoint = (f: Frame, p: Vec3): Vec3 => add(f.origin, transform(f.basis, p));
export const rotateX = (b: Basis, angle: number): Basis => {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return [b[0], add(mul(b[1], c), mul(b[2], s)), add(mul(b[1], -s), mul(b[2], c))];
};
export const reflect = (d: Vec3, n: Vec3): Vec3 => sub(d, mul(n, 2 * dot(d, n)));
export function rotateBetween(b: Basis, to: Vec3): Basis {
  const from = b[2],
    c = Math.max(-1, Math.min(1, dot(from, to))),
    a = cross(from, to),
    s = norm(a);
  if (s < 1e-12) return c > 0 ? b : [b[0], mul(b[1], -1), mul(b[2], -1)];
  const k = mul(a, 1 / s);
  const rot = (p: Vec3) => add(add(mul(p, c), mul(cross(k, p), s)), mul(k, dot(k, p) * (1 - c)));
  return b.map(rot) as Basis;
}
export type Mat2 = [number, number, number, number];
export const matrixIdentity = (): Mat2 => [1, 0, 0, 1];
export const matmul = (a: Mat2, b: Mat2): Mat2 => [
  a[0] * b[0] + a[1] * b[2],
  a[0] * b[1] + a[1] * b[3],
  a[2] * b[0] + a[3] * b[2],
  a[2] * b[1] + a[3] * b[3],
];
export const translation = (d: number, n = 1): Mat2 => [1, d / n, 0, 1];
export const refractionMatrix = (r: number, n1: number, n2: number): Mat2 => [
  1,
  0,
  -(n2 - n1) / r,
  1,
];
