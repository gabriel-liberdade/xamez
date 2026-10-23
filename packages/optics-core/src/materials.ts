import type { Material } from './types';
export function refractiveIndex(m: Material, wavelengthNm: number): number {
  if (!Number.isFinite(wavelengthNm) || wavelengthNm <= 0)
    throw new Error('Comprimento de onda inválido');
  if (m.model === 'constant') return m.n;
  if (wavelengthNm < m.validWavelengthNm[0] || wavelengthNm > m.validWavelengthNm[1])
    throw new Error('Comprimento de onda fora da faixa do vidro');
  const l2 = (wavelengthNm / 1000) ** 2;
  let n2 = 1;
  for (let i = 0; i < 3; i++) {
    const denominator = l2 - m.cUm2[i];
    if (Math.abs(denominator) < 1e-14) throw new Error('Polo de Sellmeier');
    n2 += (m.b[i] * l2) / denominator;
  }
  if (!Number.isFinite(n2) || n2 <= 0) throw new Error('Índice de refração inválido');
  return Math.sqrt(n2);
}
