import { z } from 'zod';
const number = z.number().finite();
const length = number.min(-1e6).max(1e6);
const positive = number.min(1e-6, 'Mínimo suportado: 0,000001 mm.').max(1e6);
const id = z.string().min(1).max(100);
const text = z.string().max(4000);
const vec = z.object({ x: length, y: length, z: length }).strict();
const tilt = z.object({ x: number.min(-80).max(80), y: z.literal(0) }).strict();
export const apertureSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('circle'), radiusMm: positive }).strict(),
  z
    .object({
      kind: z.literal('rectangle'),
      widthMm: positive,
      heightMm: positive,
    })
    .strict(),
]);
const shape = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('plane') }).strict(),
  z
    .object({
      kind: z.literal('sphere'),
      radiusMm: length.refine(
        (n) => Math.abs(n) >= 1e-6,
        '|R| mínimo: 0,000001 mm; use plano para face plana.',
      ),
    })
    .strict(),
]);
const provenance = z
  .object({
    reference: text.min(1),
    url: z.string().url().max(2000).optional(),
    retrievedOn: z.string().max(30).optional(),
    note: text.optional(),
  })
  .strict();
const commonMaterial = { label: text, provenance };
const material = z.discriminatedUnion('model', [
  z
    .object({
      ...commonMaterial,
      model: z.literal('constant'),
      n: number.min(1).max(5),
    })
    .strict(),
  z
    .object({
      ...commonMaterial,
      model: z.literal('sellmeier3'),
      b: z.tuple([number, number, number]),
      cUm2: z.tuple([number, number, number]),
      validWavelengthNm: z.tuple([positive, positive]),
    })
    .strict(),
]);
const common = {
  id,
  label: text,
  aperture: apertureSchema,
  gapAfterMm: positive,
};
const surface = z.discriminatedUnion('kind', [
  z
    .object({
      ...common,
      kind: z.literal('interface'),
      shape,
      mediumAfterId: id,
    })
    .strict(),
  z.object({ ...common, kind: z.literal('mask') }).strict(),
  z.object({ ...common, kind: z.literal('detector'), gapAfterMm: z.null() }).strict(),
  z
    .object({
      ...common,
      kind: z.literal('thin-lens'),
      focalLengthMm: length.refine((n) => Math.abs(n) >= 1e-6, '|f| mínimo: 0,000001 mm.'),
    })
    .strict(),
  z
    .object({
      ...common,
      kind: z.literal('mirror'),
      shape: z.object({ kind: z.literal('plane') }).strict(),
      tiltDeg: tilt,
      reflectance: number.min(0).max(1),
    })
    .strict(),
]);
const angular = z.discriminatedUnion('model', [
  z
    .object({
      model: z.literal('uniform-cone'),
      halfAngleDeg: number.min(0.001).lt(90),
    })
    .strict(),
  z
    .object({
      model: z.literal('cosine-power'),
      fullWidthHalfMaxDeg: number.min(0.001).lt(180),
    })
    .strict(),
]);
export const projectSchema = z
  .object({
    schemaVersion: z.literal(1),
    modelKind: z.enum(['real-surfaces', 'paraxial-exploration']).default('real-surfaces'),
    name: z.string().min(1).max(200),
    description: text,
    units: z.object({ length: z.literal('mm'), wavelength: z.literal('nm') }).strict(),
    wavelengthNm: number.min(100).max(10000),
    materials: z
      .record(id, material)
      .refine((m) => Object.keys(m).length <= 100, 'Máximo de 100 materiais.'),
    initialMediumId: id,
    firstVertexZMm: length,
    source: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('point'), positionMm: vec, angular }).strict(),
      z
        .object({
          kind: z.literal('collimated'),
          launchPlaneZMm: length,
          launchAperture: apertureSchema,
          fieldAnglesDeg: z
            .object({ x: number.min(-80).max(80), y: number.min(-80).max(80) })
            .strict(),
        })
        .strict(),
    ]),
    surfaces: z.array(surface).min(1).max(100),
    lensGroups: z
      .array(z.object({ id, surfaceIds: z.tuple([id, id]), tiltDeg: tilt }).strict())
      .max(50)
      .optional(),
    analysis: z
      .object({
        objectSurfaceId: id.optional(),
        footprintSurfaceId: id,
        detectorGrid: z
          .object({
            width: z.number().int().min(8).max(512),
            height: z.number().int().min(8).max(512),
          })
          .strict(),
        objectProbeFractions: z
          .array(z.object({ x: number.min(-1).max(1), y: number.min(-1).max(1) }).strict())
          .min(1)
          .max(9),
      })
      .strict(),
    sampling: z
      .object({
        algorithm: z.literal('mulberry32-v1'),
        seed: z.number().int().min(0).max(4294967295),
        illuminationRayCount: z.number().int().min(100).max(1000000),
        diagnosticRayCount: z.number().int().min(16).max(10000),
        maxStoredPaths: z.number().int().min(0).max(256),
      })
      .strict(),
    physics: z.object({ transmission: z.enum(['ideal', 'fresnel-uncoated']) }).strict(),
  })
  .strict();
export type Project = z.infer<typeof projectSchema>;
export type ProjectSurface = Project['surfaces'][number];
