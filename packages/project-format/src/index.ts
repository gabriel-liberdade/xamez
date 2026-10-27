import { z } from 'zod';
import {
  apertureRadius,
  add,
  dot,
  identity,
  inverse,
  localPoint,
  mul,
  norm,
  rad,
  reflect,
  refractiveIndex,
  rotateBetween,
  rotateX,
  sag,
  sub,
  transform,
  v,
  worldPoint,
  type Basis,
  type Frame,
  type Surface,
  type System,
} from '@xamez/optics-core';
import { projectSchema, type Project } from './schema';
export * from './schema';
export * from './catalog';
export type Diagnostic = {
  code: string;
  severity: 'error' | 'warning';
  path: string;
  message: string;
  surfaceId?: string;
};
export type Validation =
  | { ok: true; project: Project; diagnostics: Diagnostic[] }
  | { ok: false; diagnostics: Diagnostic[] };
export const MAX_FILE_BYTES = 2_000_000;
export function compileProject(p: Project): System {
  let basis: Basis = identity(),
    origin = v(0, 0, p.firstVertexZMm),
    medium = p.initialMediumId;
  const surfaces: Surface[] = p.surfaces.map((s) => {
    const nBefore = refractiveIndex(p.materials[medium], p.wavelengthNm);
    const frame: Frame = { origin, basis },
      incomingAxis = basis[2];
    if (s.kind === 'interface') medium = s.mediumAfterId;
    const nAfter = refractiveIndex(p.materials[medium], p.wavelengthNm);
    let result: Surface;
    if (s.kind === 'mirror') {
      frame.basis = rotateX(basis, rad(s.tiltDeg.x));
      const outgoing = reflect(incomingAxis, frame.basis[2]);
      basis = rotateBetween(basis, outgoing);
      result = { ...s, frame, nBefore, nAfter, incomingAxis };
    } else result = { ...s, frame, nBefore, nAfter };
    if (s.gapAfterMm !== null) origin = add(origin, mul(basis[2], s.gapAfterMm));
    return result;
  });
  for (const group of p.lensGroups ?? []) {
    const front = surfaces.find((s) => s.id === group.surfaceIds[0])!,
      back = surfaces.find((s) => s.id === group.surfaceIds[1])!;
    const base = front.frame.basis,
      rotated = rotateX(base, rad(group.tiltDeg.x));
    const displacement = inverse(base, sub(back.frame.origin, front.frame.origin));
    back.frame = {
      origin: add(front.frame.origin, transform(rotated, displacement)),
      basis: rotated,
    };
    front.frame = { origin: front.frame.origin, basis: rotated };
  }
  return {
    surfaces,
    source: p.source,
    modelKind: p.modelKind,
    transmission: p.physics.transmission,
    wavelengthNm: p.wavelengthNm,
  };
}
export function validateProject(input: unknown): Validation {
  const parsed = projectSchema.safeParse(input, {
    errorMap: (issue) => {
      switch (issue.code) {
        case z.ZodIssueCode.invalid_type:
          return {
            message: `Tipo inválido: esperado ${issue.expected}, recebido ${issue.received}.`,
          };
        case z.ZodIssueCode.invalid_literal:
          return { message: `Valor esperado: ${String(issue.expected)}.` };
        case z.ZodIssueCode.unrecognized_keys:
          return { message: `Campos desconhecidos: ${issue.keys.join(', ')}.` };
        case z.ZodIssueCode.invalid_enum_value:
          return { message: `Opção inválida. Valores aceitos: ${issue.options.join(', ')}.` };
        case z.ZodIssueCode.invalid_union_discriminator:
          return {
            message: `Tipo de elemento inválido. Valores aceitos: ${issue.options.join(', ')}.`,
          };
        case z.ZodIssueCode.too_small:
          return {
            message: `Valor, tamanho ou contagem abaixo do mínimo ${String(issue.minimum)}${issue.inclusive ? ' (inclusive)' : ' (exclusivo)'}.`,
          };
        case z.ZodIssueCode.too_big:
          return {
            message: `Valor, tamanho ou contagem acima do máximo ${String(issue.maximum)}${issue.inclusive ? ' (inclusive)' : ' (exclusivo)'}.`,
          };
        case z.ZodIssueCode.not_finite:
          return { message: 'Use um número finito.' };
        default:
          return { message: issue.message ?? 'Valor inválido para este campo.' };
      }
    },
  });
  if (!parsed.success)
    return {
      ok: false,
      diagnostics: parsed.error.issues.map((e) => ({
        code: 'INVALID_FIELD',
        severity: 'error',
        path: e.path.join('.'),
        message: e.message,
      })),
    };
  const p = parsed.data,
    diagnostics: Diagnostic[] = [];
  const error = (code: string, path: string, message: string, surfaceId?: string) =>
    diagnostics.push({ code, severity: 'error', path, message, surfaceId });
  const ids = new Set<string>(),
    groups = new Set<string>(),
    grouped = new Set<string>();
  if (!Object.hasOwn(p.materials, p.initialMediumId))
    error('UNKNOWN_MATERIAL', 'initialMediumId', 'Meio inicial não encontrado.');
  for (const [key, m] of Object.entries(p.materials))
    try {
      if (m.model === 'sellmeier3' && m.validWavelengthNm[0] >= m.validWavelengthNm[1])
        throw new Error('Faixa espectral invertida');
      refractiveIndex(m, p.wavelengthNm);
    } catch (e) {
      error('MATERIAL_DOMAIN', `materials.${key}`, (e as Error).message);
    }
  p.surfaces.forEach((s, i) => {
    const path = `surfaces.${i}`;
    if (ids.has(s.id)) error('DUPLICATE_ID', `${path}.id`, 'ID repetido.', s.id);
    ids.add(s.id);
    if ((s.kind === 'detector') !== (i === p.surfaces.length - 1))
      error('INVALID_TERMINAL', `${path}.kind`, 'Exatamente um detector, na última linha.', s.id);
    if (s.kind === 'detector' && s.aperture.kind !== 'rectangle')
      error('INVALID_APERTURE', `${path}.aperture`, 'Tela deve ser retangular.', s.id);
    if (['interface', 'thin-lens'].includes(s.kind) && s.aperture.kind !== 'circle')
      error(
        'INVALID_APERTURE',
        `${path}.aperture`,
        'Lente/interface exige abertura circular.',
        s.id,
      );
    if (s.kind === 'interface') {
      if (!Object.hasOwn(p.materials, s.mediumAfterId))
        error('UNKNOWN_MATERIAL', `${path}.mediumAfterId`, 'Meio posterior não encontrado.', s.id);
      if (
        s.shape.kind === 'sphere' &&
        apertureRadius(s.aperture) >= Math.abs(s.shape.radiusMm) * (1 - 1e-10)
      )
        error(
          'INVALID_SPHERE',
          `${path}.aperture`,
          'Raio útil deve ser menor que |raio de curvatura|.',
          s.id,
        );
    }
    if (p.modelKind === 'real-surfaces' && s.kind === 'thin-lens')
      error('MIXED_MODE', `${path}.kind`, 'Lente fina exige modo de exploração ideal.', s.id);
    if (p.modelKind === 'paraxial-exploration' && ['interface', 'mirror'].includes(s.kind))
      error(
        'MIXED_MODE',
        `${path}.kind`,
        'Modo ideal aceita apenas lentes finas, máscaras e tela.',
        s.id,
      );
  });
  if (!ids.has(p.analysis.footprintSurfaceId))
    error(
      'UNKNOWN_SURFACE',
      'analysis.footprintSurfaceId',
      'Superfície de footprint não encontrada.',
    );
  if (
    p.analysis.objectSurfaceId &&
    !p.surfaces.some((s) => s.id === p.analysis.objectSurfaceId && s.kind === 'mask')
  )
    error('INVALID_OBJECT', 'analysis.objectSurfaceId', 'Objeto deve apontar para uma máscara.');
  for (const [i, g] of (p.lensGroups ?? []).entries()) {
    const path = `lensGroups.${i}`,
      a = p.surfaces.findIndex((s) => s.id === g.surfaceIds[0]),
      b = p.surfaces.findIndex((s) => s.id === g.surfaceIds[1]);
    if (groups.has(g.id)) error('DUPLICATE_ID', `${path}.id`, 'ID de grupo repetido.');
    groups.add(g.id);
    if (
      a < 0 ||
      b !== a + 1 ||
      p.surfaces[a]?.kind !== 'interface' ||
      p.surfaces[b]?.kind !== 'interface'
    )
      error(
        'INVALID_LENS_GROUP',
        `${path}.surfaceIds`,
        'Grupo exige duas interfaces consecutivas.',
      );
    for (const id of g.surfaceIds) {
      if (grouped.has(id))
        error('OVERLAPPING_GROUP', `${path}.surfaceIds`, 'Interface em mais de um grupo.');
      grouped.add(id);
    }
  }
  if (p.modelKind === 'paraxial-exploration') {
    if (p.lensGroups?.length)
      error('MIXED_MODE', 'lensGroups', 'Grupos rígidos exigem superfícies reais.');
    if (p.physics.transmission !== 'ideal')
      error('MIXED_MODE', 'physics.transmission', 'Modo ideal não tem Fresnel.');
    if (Object.values(p.materials).some((m) => m.model !== 'constant' || m.n !== 1))
      error('MIXED_MODE', 'materials', 'Modo ideal exige ar n=1.');
  }
  if (p.source.kind === 'point' && (p.source.positionMm.x !== 0 || p.source.positionMm.y !== 0))
    error('SOURCE_OFF_AXIS', 'source.positionMm', 'Fonte deve ser centrada nesta versão.');
  // Sag differences are monotone in radius for concentric spheres: d(sag1-sag2)/dr
  // has the sign of c1-c2. Checking both endpoints therefore certifies the whole interval.
  for (let i = 0; i < p.surfaces.length - 1; i++) {
    const a = p.surfaces[i],
      b = p.surfaces[i + 1],
      r = Math.min(apertureRadius(a.aperture), apertureRadius(b.aperture));
    const sa = a.kind === 'interface' ? a.shape : { kind: 'plane' as const },
      sb = b.kind === 'interface' ? b.shape : { kind: 'plane' as const };
    if (
      (sa.kind === 'sphere' && r >= Math.abs(sa.radiusMm)) ||
      (sb.kind === 'sphere' && r >= Math.abs(sb.radiusMm))
    )
      continue;
    if (Math.min(a.gapAfterMm!, a.gapAfterMm! + sag(sb, r) - sag(sa, r)) <= 1e-9)
      error(
        'SURFACE_OVERLAP',
        `surfaces.${i}.gapAfterMm`,
        'Superfícies se cruzam ou têm espessura nula na abertura comum.',
        a.id,
      );
  }
  const objectAperture = p.surfaces.find((s) => s.id === p.analysis.objectSurfaceId)?.aperture;
  if (objectAperture?.kind === 'circle')
    p.analysis.objectProbeFractions.forEach((f, i) => {
      if (Math.hypot(f.x, f.y) > 1)
        error(
          'PROBE_OUTSIDE_OBJECT',
          `analysis.objectProbeFractions.${i}`,
          'Ponto diagnóstico fora da abertura circular do objeto.',
        );
    });
  if (diagnostics.length) return { ok: false, diagnostics };
  const system = compileProject(p);
  const first = system.surfaces[0],
    launch = p.source.kind === 'point' ? p.source.positionMm : v(0, 0, p.source.launchPlaneZMm);
  const minSag =
    first.kind === 'interface' ? Math.min(0, sag(first.shape, apertureRadius(first.aperture))) : 0;
  const launchDepth =
    p.source.kind === 'collimated'
      ? apertureRadius(p.source.launchAperture) *
        Math.hypot(first.frame.basis[2].x, first.frame.basis[2].y)
      : 0;
  if (localPoint(first.frame, launch).z + launchDepth >= minSag - 1e-9)
    error(
      'SOURCE_POSITION',
      'source',
      'Fonte/plano de lançamento deve estar antes da primeira calota.',
    );
  // A rigidly tilted body needs a surrounding nominal segment in the same medium.
  for (const [i, g] of (p.lensGroups ?? []).entries()) {
    const a = system.surfaces.find((s) => s.id === g.surfaceIds[0])!,
      b = system.surfaces.find((s) => s.id === g.surfaceIds[1])!;
    if (a.nBefore !== b.nAfter)
      error('GROUP_MEDIUM', `lensGroups.${i}`, 'As faces do grupo devem retornar ao meio externo.');
  }
  // Conservative broad phase for folded/tilted assemblies. Overlapping enclosing
  // balls mean clearance is unverified, not that a collision has been proved.
  if (
    p.surfaces.some((s) => s.kind === 'mirror') ||
    (p.lensGroups ?? []).some((g) => g.tiltDeg.x !== 0)
  ) {
    const bodies: {
      center: ReturnType<typeof v>;
      radius: number;
      ids: string[];
    }[] = [];
    const consumed = new Set<string>();
    for (const s of system.surfaces) {
      if (consumed.has(s.id)) continue;
      const group = p.lensGroups?.find((g) => g.surfaceIds[0] === s.id);
      const members = group
        ? group.surfaceIds.map((id) => system.surfaces.find((x) => x.id === id)!)
        : [s];
      members.forEach((x) => consumed.add(x.id));
      const center = mul(add(members[0].frame.origin, members.at(-1)!.frame.origin), 0.5);
      const radius = Math.max(
        ...members.map(
          (x) =>
            norm(sub(x.frame.origin, center)) +
            Math.hypot(
              apertureRadius(x.aperture),
              x.kind === 'interface' ? sag(x.shape, apertureRadius(x.aperture)) : 0,
            ),
        ),
      );
      bodies.push({ center, radius, ids: members.map((x) => x.id) });
    }
    for (let i = 0; i < bodies.length; i++)
      for (let j = i + 1; j < bodies.length; j++)
        if (
          norm(sub(bodies[i].center, bodies[j].center)) <=
          bodies[i].radius + bodies[j].radius + 1e-9
        )
          error(
            'CLEARANCE_UNVERIFIED',
            'surfaces',
            `Folga não verificada entre ${bodies[i].ids.join('/')} e ${bodies[j].ids.join('/')}. Aumente o espaçamento ou reduza a abertura.`,
          );
  }
  return diagnostics.length ? { ok: false, diagnostics } : { ok: true, project: p, diagnostics };
}
export function parseProject(text: string): Validation {
  if (new TextEncoder().encode(text).length > MAX_FILE_BYTES)
    return {
      ok: false,
      diagnostics: [
        {
          code: 'FILE_TOO_LARGE',
          severity: 'error',
          path: '',
          message: 'Arquivo excede o limite de 2 MB.',
        },
      ],
    };
  try {
    return validateProject(JSON.parse(text));
  } catch {
    return {
      ok: false,
      diagnostics: [
        {
          code: 'INVALID_JSON',
          severity: 'error',
          path: '',
          message: 'JSON inválido. O projeto atual foi preservado.',
        },
      ],
    };
  }
}
export function serializeProject(p: Project): string {
  return JSON.stringify(p, null, 2) + '\n';
}
