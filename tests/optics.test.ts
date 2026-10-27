import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  add,
  dot,
  identity,
  inAperture,
  intersect,
  localPoint,
  matmul,
  mul,
  norm,
  rad,
  randomSequence,
  refract,
  refractiveIndex,
  refractionMatrix,
  reflect,
  rotateX,
  SAMPLING_VERSION,
  sag,
  solveConjugate,
  sourceRay,
  sub,
  traceBatch,
  traceBatchAsync,
  traceRay,
  transform,
  translation,
  unit,
  v,
  worldPoint,
  type System,
} from '@xamez/optics-core';
import {
  compileProject,
  materialCatalog,
  parseProject,
  projectSchema,
  serializeProject,
  validateProject,
  type Project,
} from '@xamez/project-format';
import { zodToJsonSchema } from 'zod-to-json-schema';
const load = (name: string) => JSON.parse(readFileSync(`examples/${name}`, 'utf8')) as Project;
const real = () => load('slit-projection.proposed.json');
const ideal = () => load('user-system.paraxial.proposed.json');
const sampling = {
  seed: 42,
  illuminationRayCount: 30000,
  diagnosticRayCount: 256,
  maxStoredPaths: 16,
};
const request = {
  footprintSurfaceId: 'mask',
  detectorGrid: { width: 32, height: 32 },
  objectProbeFractions: [{ x: 0, y: 0 }],
};
function maskProject(): Project {
  const p = real();
  p.lensGroups = [];
  p.source = {
    kind: 'collimated',
    launchPlaneZMm: -10,
    launchAperture: { kind: 'circle', radiusMm: 10 },
    fieldAnglesDeg: { x: 0, y: 0 },
  };
  p.surfaces = [
    {
      id: 'mask',
      label: 'Máscara',
      kind: 'mask',
      aperture: { kind: 'circle', radiusMm: 5 },
      gapAfterMm: 20,
    },
    {
      id: 'screen',
      label: 'Tela',
      kind: 'detector',
      aperture: { kind: 'rectangle', widthMm: 40, heightMm: 40 },
      gapAfterMm: null,
    },
  ];
  p.analysis = { ...request };
  return p;
}
function plate(tilt = 0): Project {
  const p = maskProject();
  p.source = {
    kind: 'collimated',
    launchPlaneZMm: -20,
    launchAperture: { kind: 'circle', radiusMm: 1 },
    fieldAnglesDeg: { x: 0, y: 0 },
  };
  p.surfaces = [
    {
      id: 'front',
      label: 'Frente',
      kind: 'interface',
      shape: { kind: 'plane' },
      mediumAfterId: 'demo-n150',
      aperture: { kind: 'circle', radiusMm: 2 },
      gapAfterMm: 5,
    },
    {
      id: 'back',
      label: 'Trás',
      kind: 'interface',
      shape: { kind: 'plane' },
      mediumAfterId: 'air-ideal',
      aperture: { kind: 'circle', radiusMm: 2 },
      gapAfterMm: 30,
    },
    p.surfaces[1],
  ];
  p.surfaces.at(-1)!.aperture = {
    kind: 'rectangle',
    widthMm: 20,
    heightMm: 20,
  };
  p.lensGroups = [{ id: 'plate', surfaceIds: ['front', 'back'], tiltDeg: { x: tilt, y: 0 } }];
  p.analysis.footprintSurfaceId = 'back';
  return p;
}
describe('Snell e Fresnel: oráculos analíticos', () => {
  it('propaga em plano sem mudar direção', () => {
    const d = unit(v(0.1, 0.2, 1));
    const hit = intersect(v(2, 3, -10), d, { kind: 'plane' })!;
    expect(hit.point.x).toBeCloseTo(3, 12);
    expect(hit.point.y).toBeCloseTo(5, 12);
    expect(hit.point.z).toBeCloseTo(0, 12);
  });
  it('índices iguais transmitem inclusive no limite rasante', () => {
    const d = v(1, 0, 0);
    expect(refract(d, v(0, 0, 1), 1, 1)).toEqual({
      direction: d,
      reflectance: 0,
    });
  });
  it('ar para 1.5 a 30 graus', () => {
    const r = refract(v(0.5, 0, Math.sqrt(0.75)), v(0, 0, 1), 1, 1.5);
    if (typeof r === 'string') throw Error(r);
    expect(Math.asin(r.direction.x)).toBeCloseTo(Math.asin(1 / 3), 12);
    expect(norm(r.direction)).toBeCloseTo(1, 14);
  });
  it('refletância normal é 4%', () => {
    const r = refract(v(0, 0, 1), v(0, 0, 1), 1, 1.5);
    expect(typeof r === 'object' && r.reflectance).toBeCloseTo(0.04, 14);
  });
  it('reflexão interna total a 45 graus', () => {
    expect(refract(unit(v(1, 0, 1)), v(0, 0, 1), 1.5, 1)).toBe('tir');
  });
  it('estável dos dois lados do crítico', () => {
    const a = Math.asin(2 / 3);
    for (const offset of [-1e-8, 0, 1e-8]) {
      const r = refract(v(Math.sin(a + offset), 0, Math.cos(a + offset)), v(0, 0, 1), 1.5, 1);
      if (offset > 0) expect(r).toBe('tir');
      else {
        expect(typeof r).toBe('object');
        if (typeof r === 'object') expect(norm(r.direction)).toBeCloseTo(1, 12);
      }
    }
  });
  it('rejeita chegada pelo lado incorreto', () => {
    expect(refract(v(0, 0, -1), v(0, 0, 1), 1, 1.5)).toBe('unsupported_direction');
  });
  it('invariante de Snell e simetria para múltiplos ângulos', () => {
    for (const angle of [-70, -40, -10, 0, 10, 40, 70]) {
      const r = refract(v(Math.sin(rad(angle)), 0, Math.cos(rad(angle))), v(0, 0, 1), 1, 1.5);
      if (typeof r === 'string') throw Error(r);
      expect(1.5 * r.direction.x).toBeCloseTo(Math.sin(rad(angle)), 12);
    }
  });
  it('placa paralela conserva direção e deslocamento analítico', () => {
    const p = plate(),
      system = compileProject(p),
      theta = rad(10),
      r = traceRay(system, {
        position: v(0, 0, -1),
        direction: v(0, Math.sin(theta), Math.cos(theta)),
        weight: 1,
      });
    expect(r.termination).toBe('received');
    expect(r.ray.direction.y).toBeCloseTo(Math.sin(theta), 12);
    const front = r.hits[0].local,
      back = r.hits[1].local;
    expect(back.y - front.y).toBeCloseTo(5 * Math.tan(Math.asin(Math.sin(theta) / 1.5)), 11);
    expect(r.weight).toBeLessThan(1);
  });
});
describe('calotas e tolerâncias', () => {
  it.each([50, -50])('seleciona calota do vértice para R=%s', (radiusMm) => {
    const h = intersect(v(0, 1, -100), v(0, 0, 1), {
      kind: 'sphere',
      radiusMm,
    })!;
    expect(h.point.z).toBeCloseTo(sag({ kind: 'sphere', radiusMm }, 1), 11);
    expect(norm(h.normal)).toBeCloseTo(1, 14);
    expect(h.normal.z).toBeGreaterThan(0);
  });
  it('origem dentro da esfera completa não aceita a calota remota', () => {
    expect(intersect(v(0, 0, 10), v(0, 0, 1), { kind: 'sphere', radiusMm: 50 })).toBeNull();
  });
  it('origem dentro da esfera pode atingir a calota do vértice', () => {
    const h = intersect(v(0, 0, 10), v(0, 0, -1), {
      kind: 'sphere',
      radiusMm: 50,
    })!;
    expect(h.point.z).toBeCloseTo(0, 12);
  });
  it('tangência, quase tangência e erro de alvo são definidos', () => {
    expect(intersect(v(50, 0, -10), v(0, 0, 1), { kind: 'sphere', radiusMm: 50 })).not.toBeNull();
    expect(intersect(v(51, 0, -10), v(0, 0, 1), { kind: 'sphere', radiusMm: 50 })).toBeNull();
  });
  it('plano quase paralelo não gera infinito', () => {
    expect(intersect(v(0, 0, -1), unit(v(1, 0, 1e-16)), { kind: 'plane' })).toBeNull();
  });
  it('abertura inclui a borda', () => {
    expect(inAperture(v(1, 0, 0), { kind: 'circle', radiusMm: 1 })).toBe(true);
    expect(inAperture(v(1.00001, 0, 0), { kind: 'circle', radiusMm: 1 })).toBe(false);
  });
  it.each([0.001, 1, 1000])('escala geométrica %s mantém sag e interseção', (scale) => {
    const r = 50 * scale,
      h = intersect(v(0, scale, -100 * scale), v(0, 0, 1), {
        kind: 'sphere',
        radiusMm: r,
      })!;
    expect(h.point.z / scale).toBeCloseTo(sag({ kind: 'sphere', radiusMm: 50 }, 1), 8);
  });
});
describe('matrizes e conjugados', () => {
  it('lente espessa confere com frações independentes', () => {
    const m = matmul(
      refractionMatrix(-50, 1.5, 1),
      matmul(translation(5, 1.5), refractionMatrix(50, 1, 1.5)),
    );
    [29 / 30, 10 / 3, -59 / 3000, 29 / 30].forEach((x, i) => expect(m[i]).toBeCloseTo(x, 13));
    expect(m[0] * m[3] - m[1] * m[2]).toBeCloseTo(1, 13);
    const c = solveConjugate(compileProject(real()), 'slit');
    if (c.status !== 'real') throw Error(c.status);
    expect(c.distanceMm).toBeCloseTo(100, 11);
    expect(c.magnification).toBeCloseTo(-1, 12);
    expect(c.eflMm).toBeCloseTo(3000 / 59, 11);
    expect(c.bflMm).toBeCloseTo(2900 / 59, 11);
  });
  it('exemplo do usuário: tela 90, conjugado 210 e m=-14', () => {
    const c = solveConjugate(compileProject(ideal()), 'slit');
    if (c.status !== 'real') throw Error(c.status);
    expect(c.distanceMm).toBeCloseTo(210, 10);
    expect(c.screenDistanceMm).toBe(90);
    expect(c.magnification).toBeCloseTo(-14, 11);
  });
  it('imagem infinita e virtual sem NaN', () => {
    for (const gap of [14, 13]) {
      const p = ideal();
      p.surfaces[1].gapAfterMm = gap;
      const c = solveConjugate(compileProject(p), 'slit');
      expect(c.status).toBe(gap === 14 ? 'infinite' : 'virtual');
      expect(JSON.stringify(c)).not.toContain('null,"magnification"');
    }
  });
  it('LED antes da fenda não muda a conjugação', () => {
    const p = ideal(),
      a = solveConjugate(compileProject(p), 'slit');
    if (p.source.kind === 'point') p.source.positionMm.z = -10;
    expect(solveConjugate(compileProject(p), 'slit')).toEqual(a);
  });
  it('lente fina f=50 conjuga 100 para 100 com m=-1', () => {
    const p = ideal();
    p.surfaces = p.surfaces.slice(1);
    p.surfaces[0].gapAfterMm = 100;
    if (p.surfaces[1].kind === 'thin-lens') p.surfaces[1].focalLengthMm = 50;
    const c = solveConjugate(compileProject(p), 'slit');
    if (c.status !== 'real') throw Error(c.status);
    expect(c.distanceMm).toBeCloseTo(100, 12);
    expect(c.magnification).toBeCloseTo(-1, 12);
  });
  it('lente fina colima ponto focal', () => {
    const p = ideal();
    p.surfaces = p.surfaces.slice(2);
    p.firstVertexZMm = 50;
    if (p.surfaces[0].kind === 'thin-lens') p.surfaces[0].focalLengthMm = 50;
    const s = compileProject(p),
      r = traceRay(s, {
        position: v(),
        direction: unit(v(0, 1, 50)),
        weight: 1,
      });
    expect(r.termination).toBe('received');
    expect(r.ray.direction.y).toBeCloseTo(0, 13);
  });
  it('raios reais convergem ao limite paraxial', () => {
    const s = compileProject(real());
    const errors = [1e-2, 1e-3, 1e-4].map((h) => {
      const r = traceRay(
        { ...s, surfaces: s.surfaces.slice(1) },
        { position: v(), direction: unit(v(0, h, 100)), weight: 1 },
      );
      expect(r.termination).toBe('received');
      return Math.abs(r.hits.at(-1)!.local.y);
    });
    expect(errors[1]).toBeLessThan(errors[0] / 100);
    expect(errors[2]).toBeLessThan(1e-10);
  });
});
describe('fontes, energia e mapas', () => {
  it('seed reproduz exatamente e muda sequência', () => {
    const a = randomSequence(1),
      b = randomSequence(1),
      c = randomSequence(2);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
    expect(b()).not.toBe(c());
    expect(SAMPLING_VERSION).toBe('mulberry32-v1');
  });
  it('cone uniforme não ultrapassa ângulo e tem média de cos correta', () => {
    const rng = randomSequence(42),
      source = {
        kind: 'point' as const,
        positionMm: v(),
        angular: { model: 'uniform-cone' as const, halfAngleDeg: 60 },
      };
    let mean = 0;
    for (let i = 0; i < 20000; i++) {
      const r = sourceRay(source, rng, 1);
      expect(r.direction.z).toBeGreaterThanOrEqual(0.5);
      mean += r.direction.z / 20000;
    }
    expect(mean).toBeCloseTo(0.75, 2);
  });
  it('Lambertiano coleta 75% até 60° sem pesar cosseno duas vezes', () => {
    const p = maskProject();
    p.source = {
      kind: 'point',
      positionMm: v(0, 0, -10),
      angular: { model: 'cosine-power', fullWidthHalfMaxDeg: 120 },
    };
    p.surfaces[0].aperture = { kind: 'circle', radiusMm: 10 * Math.sqrt(3) };
    p.surfaces[1].aperture = { kind: 'rectangle', widthMm: 200, heightMm: 200 };
    const r = traceBatch(compileProject(p), sampling, request);
    expect(Math.abs(r.received - 0.75)).toBeLessThan(
      5 * Math.sqrt((0.75 * 0.25) / sampling.illuminationRayCount),
    );
  });
  it('máscara uniforme segue razão de áreas e balanço unitário', () => {
    const r = traceBatch(compileProject(maskProject()), sampling, request);
    expect(Math.abs(r.received - 0.25)).toBeLessThan(5 * r.standardError);
    expect(Object.values(r.energy).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 11);
    expect(r.energy.numerical_failure).toBe(0);
    expect(r.grid.reduce((a, b) => a + b, 0) * r.pixelAreaMm2).toBeCloseTo(r.received, 12);
  });
  it('abrir máscara passiva não reduz fluxo com a mesma seed', () => {
    const p = maskProject(),
      a = traceBatch(compileProject(p), sampling, request);
    p.surfaces[0].aperture = { kind: 'circle', radiusMm: 7 };
    const b = traceBatch(compileProject(p), sampling, request);
    expect(b.received).toBeGreaterThan(a.received);
  });
  it('Fresnel conserva fluxo e geometria usa os mesmos raios', () => {
    const p = plate(),
      s = compileProject(p),
      r = traceBatch(s, sampling, { ...request, footprintSurfaceId: 'back' });
    expect(r.received).toBeCloseTo(0.96 ** 2, 10);
    expect(r.geometricReceived).toBeCloseTo(1, 10);
    expect(Object.values(r.energy).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(r.surfaceFlows[0].fresnel).toBeCloseTo(0.04, 11);
  });
  it('nenhuma chegada deixa mapa zero e métricas indisponíveis', () => {
    const p = maskProject();
    p.surfaces[0].aperture = { kind: 'circle', radiusMm: 1e-8 };
    const r = traceBatch(compileProject(p), sampling, request);
    expect(r.receivedCount).toBe(0);
    expect(r.grid.every((x) => x === 0)).toBe(true);
    expect(r.standardError).toBe(0);
    expect(
      r.paths.filter((t) => t.termination === 'blocked_aperture').every((t) => t.hits.length === 1),
    ).toBe(true);
  });
  it('manchas no conjugado ideal representam pontos separados', () => {
    const p = ideal();
    p.surfaces[2].gapAfterMm = 210;
    const r = traceBatch(
      compileProject(p),
      { ...sampling, illuminationRayCount: 1000 },
      p.analysis,
    );
    expect(r.spots).toHaveLength(2);
    for (const spot of r.spots) {
      expect(spot.received).toBeGreaterThan(0);
      expect(spot.rmsMm).toBeLessThan(1e-10);
      expect(spot.centroid!.y).toBeCloseTo(-14 * spot.objectPoint.y, 10);
    }
    expect(r.aberration).toHaveLength(0);
  });
  it('cancela execução entre lotes', async () => {
    let cancelled = false,
      yields = 0;
    const r = await traceBatchAsync(compileProject(maskProject()), sampling, request, {
      cancelled: () => cancelled,
      yield: async () => {
        if (++yields === 2) cancelled = true;
      },
    });
    expect(r).toBeNull();
    expect(yields).toBe(2);
  });
});
describe('espelhos e inclinação rígida', () => {
  function mirrorProject(two = false) {
    const p = maskProject();
    p.source = {
      kind: 'collimated',
      launchPlaneZMm: -20,
      launchAperture: { kind: 'circle', radiusMm: 1 },
      fieldAnglesDeg: { x: 0, y: 0 },
    };
    p.surfaces = [
      {
        id: 'm1',
        label: 'Espelho',
        kind: 'mirror',
        shape: { kind: 'plane' },
        tiltDeg: { x: 45, y: 0 },
        reflectance: 0.8,
        aperture: { kind: 'circle', radiusMm: 2 },
        gapAfterMm: 20,
      },
      ...(two
        ? [
            {
              id: 'm2',
              label: 'Espelho 2',
              kind: 'mirror' as const,
              shape: { kind: 'plane' as const },
              tiltDeg: { x: 45, y: 0 as const },
              reflectance: 1,
              aperture: { kind: 'circle' as const, radiusMm: 2 },
              gapAfterMm: 20,
            },
          ]
        : []),
      {
        id: 'screen',
        label: 'Tela',
        kind: 'detector',
        aperture: { kind: 'rectangle', widthMm: 4, heightMm: 4 },
        gapAfterMm: null,
      },
    ];
    p.analysis.footprintSurfaceId = 'm1';
    return p;
  }
  it('espelho 45° dobra para +y; perdas 80/20', () => {
    const p = mirrorProject();
    expect(validateProject(p).ok).toBe(true);
    const s = compileProject(p),
      r = traceRay(s, {
        position: v(0, 0, -10),
        direction: v(0, 0, 1),
        weight: 1,
      });
    expect(r.termination).toBe('received');
    expect(r.ray.direction.y).toBeCloseTo(1, 12);
    expect(r.ray.position.y).toBeCloseTo(20, 12);
    expect(r.weight).toBeCloseTo(0.8, 12);
    expect(r.hits[0].mirrorAbsorption).toBeCloseTo(0.2, 12);
    expect(r.hits.at(-1)!.local.x).toBeCloseTo(0, 12);
  });
  it('dois espelhos permitem z global negativo', () => {
    const p = mirrorProject(true);
    expect(validateProject(p).ok).toBe(true);
    const r = traceRay(compileProject(p), {
      position: v(0, 0, -10),
      direction: v(0, 0, 1),
      weight: 1,
    });
    expect(r.termination).toBe('received');
    expect(r.ray.direction.z).toBeCloseTo(-1, 12);
  });
  it('lente/placa inclinada move ambas faces e conserva espessura', () => {
    const p = plate(20);
    expect(validateProject(p).ok).toBe(true);
    const s = compileProject(p),
      [a, b] = s.surfaces;
    expect(norm(sub(b.frame.origin, a.frame.origin))).toBeCloseTo(5, 13);
    expect(a.frame.basis).toEqual(b.frame.basis);
    const r = traceRay(s, {
      position: v(0, 0, -10),
      direction: v(0, 0, 1),
      weight: 1,
    });
    expect(r.termination).toBe('received');
    expect(r.ray.direction.y).toBeCloseTo(0, 12);
    const shift =
      (5 * Math.sin(rad(20) - Math.asin(Math.sin(rad(20)) / 1.5))) /
      Math.cos(Math.asin(Math.sin(rad(20)) / 1.5));
    expect(r.ray.position.y).toBeCloseTo(-shift, 10);
  });
  it('tilt zero recupera frames retos', () => {
    const p = plate(),
      a = compileProject(p);
    p.lensGroups = [];
    expect(compileProject(p)).toEqual(a);
  });
  it('rotação rígida global mantém coordenadas locais e pesos', () => {
    const s = compileProject(plate()),
      basis = rotateX(identity(), 0.4),
      offset = v(20, 30, 40),
      rotated: System = {
        ...s,
        surfaces: s.surfaces.map((x) => ({
          ...x,
          frame: {
            origin: add(offset, transform(basis, x.frame.origin)),
            basis: x.frame.basis.map((c) => transform(basis, c)) as typeof basis,
          },
        })),
      };
    const a = traceRay(s, {
        position: v(0, 0, -10),
        direction: v(0, 0, 1),
        weight: 1,
      }),
      b = traceRay(rotated, {
        position: add(offset, transform(basis, v(0, 0, -10))),
        direction: transform(basis, v(0, 0, 1)),
        weight: 1,
      });
    expect(b.termination).toBe(a.termination);
    expect(b.weight).toBeCloseTo(a.weight, 12);
    expect(b.hits.at(-1)!.local.y).toBeCloseTo(a.hits.at(-1)!.local.y, 10);
  });
  it('solver centrado fica indisponível com tilt posterior ao objeto', () => {
    const p = real();
    p.lensGroups![0].tiltDeg.x = 5;
    expect(solveConjugate(compileProject(p), 'slit').status).toBe('unavailable');
  });
  it('folga de corpos próximos é rejeitada conservadoramente', () => {
    const p = plate(20);
    p.surfaces[1].gapAfterMm = 1;
    const r = validateProject(p);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => d.code === 'CLEARANCE_UNVERIFIED')).toBe(true);
  });
});
describe('formato seguro e catálogo', () => {
  it.each(['slit-projection.proposed.json', 'user-system.paraxial.proposed.json'])(
    'round trip de %s mantém sistema e resultados',
    (name) => {
      const p = load(name),
        r = parseProject(serializeProject(p));
      expect(r.ok).toBe(true);
      if (r.ok) expect(compileProject(r.project)).toEqual(compileProject(p));
    },
  );
  it('JSON Schema gerado corresponde ao contrato', () => {
    expect(JSON.parse(readFileSync('packages/project-format/project.schema.json', 'utf8'))).toEqual(
      zodToJsonSchema(projectSchema, { name: 'XamezProject' }),
    );
  });
  it.each([
    ['versão futura', (p: any) => (p.schemaVersion = 2)],
    ['campo desconhecido', (p: any) => (p.surfaces[0].typo = 1)],
    ['NaN', (p: any) => (p.wavelengthNm = NaN)],
    ['gaps negativos', (p: any) => (p.surfaces[0].gapAfterMm = -1)],
    ['contagem excessiva', (p: any) => (p.sampling.illuminationRayCount = 1e10)],
    ['ids repetidos', (p: any) => (p.surfaces[1].id = p.surfaces[0].id)],
    ['detector antecipado', (p: any) => p.surfaces.reverse()],
    ['abertura impossível', (p: any) => (p.surfaces[1].aperture.radiusMm = 60)],
    ['material ausente', (p: any) => (p.initialMediumId = 'missing')],
    ['objeto inválido', (p: any) => (p.analysis.objectSurfaceId = 'screen')],
    ['y tilt não suportado', (p: any) => (p.lensGroups[0].tiltDeg.y = 2)],
  ])('rejeita %s com caminho', (_, edit) => {
    const p = real();
    edit(p);
    const r = validateProject(p);
    expect(r.ok).toBe(false);
    expect(r.diagnostics[0].path.length).toBeGreaterThan(0);
  });
  it('vértices crescentes não ocultam cruzamento nas bordas', () => {
    const p = real();
    p.surfaces[1].gapAfterMm = 0.01;
    const r = validateProject(p);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => d.code === 'SURFACE_OVERLAP')).toBe(true);
  });
  it('rejeita arquivo grande e JSON malformado', () => {
    expect(parseProject('x'.repeat(2000001)).diagnostics[0].code).toBe('FILE_TOO_LARGE');
    expect(parseProject('{oops').ok).toBe(false);
  });
  it('modelos não se misturam', () => {
    const p = ideal();
    p.modelKind = 'real-surfaces';
    expect(validateProject(p).ok).toBe(false);
  });
  it.each([
    ['N-BK7', [1.51432, 1.5168, 1.52238]],
    ['SF1', [1.71031, 1.71736, 1.73462]],
    ['SF2', [1.6421, 1.64769, 1.66123]],
  ] as [string, number[]][])('%s confere com três índices tabulados SCHOTT', (name, indices) => {
    [656.2725, 587.5618, 486.1327].forEach((wl, i) =>
      expect(Math.abs(refractiveIndex(materialCatalog[name], wl) - indices[i])).toBeLessThan(6e-6),
    );
  });
  it('catálogo preserva nomes exatos, unidades e domínio', () => {
    expect(materialCatalog.SF1.label).toBe('SF1');
    expect(materialCatalog['N-SF1']).toBeUndefined();
    expect(() => refractiveIndex(materialCatalog.SF1, 300)).toThrow();
    expect(refractiveIndex(materialCatalog['N-BK7'], 587.6)).toBeCloseTo(1.5168, 5);
    const p = real();
    p.materials = structuredClone(materialCatalog);
    p.surfaces.forEach((s) => {
      if (s.kind === 'interface' && s.mediumAfterId === 'demo-n150') s.mediumAfterId = 'SF2';
    });
    const r = parseProject(serializeProject(p));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.project.materials).toEqual(p.materials);
  });
  it('singularidade Sellmeier não produz NaN público', () => {
    expect(() =>
      refractiveIndex(
        {
          model: 'sellmeier3',
          label: 'Teste',
          b: [1, 1, 1],
          cUm2: [0.25, 1, 2],
          validWavelengthNm: [400, 600],
          provenance: { reference: 'Sintético' },
        },
        500,
      ),
    ).toThrow('Polo');
  });
});

describe('regressões de consolidação', () => {
  it.each(['collimated-focus.json', 'mirror.json', 'tilted-plate.json', 'vignetting.json'])(
    'exemplo %s é válido e conserva energia',
    (name) => {
      const p = load(name),
        r = validateProject(p);
      expect(r.ok, r.diagnostics.map((d) => d.message).join('; ')).toBe(true);
      const batch = traceBatch(
        compileProject(p),
        { ...sampling, illuminationRayCount: 2000 },
        p.analysis,
      );
      expect(Object.values(batch.energy).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
      expect(batch.energy.numerical_failure).toBe(0);
    },
  );
  it('trecho reto após espelho anterior ao objeto mantém a conjugação', () => {
    const p = real();
    p.surfaces.unshift({
      id: 'upstream-mirror',
      label: 'Espelho anterior',
      kind: 'mirror',
      shape: { kind: 'plane' },
      tiltDeg: { x: 45, y: 0 },
      reflectance: 1,
      aperture: { kind: 'circle', radiusMm: 2 },
      gapAfterMm: 20,
    });
    const r = validateProject(p);
    expect(r.ok).toBe(true);
    const c = solveConjugate(compileProject(p), 'slit');
    expect(c.status).toBe('real');
    if (c.status === 'real') expect(c.distanceMm).toBeCloseTo(100, 10);
  });
  it('saída de raio inválido não carrega NaN nem Infinity', () => {
    const r = traceRay(compileProject(maskProject()), {
      position: v(NaN, 0, -10),
      direction: v(0, 0, 1),
      weight: 1,
    });
    expect(r.termination).toBe('numerical_failure');
    const numbers: number[] = [];
    JSON.stringify(r, (_, value) => {
      if (typeof value === 'number') numbers.push(value);
      return value;
    });
    expect(numbers.every(Number.isFinite)).toBe(true);
  });
  it('lançamento colimado inteiro deve anteceder primeira face inclinada', () => {
    const p = plate(20);
    p.source = {
      kind: 'collimated',
      launchPlaneZMm: -1,
      launchAperture: { kind: 'circle', radiusMm: 20 },
      fieldAnglesDeg: { x: 0, y: 0 },
    };
    const r = validateProject(p);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => d.code === 'SOURCE_POSITION')).toBe(true);
  });
  it('dimensões subnormais são rejeitadas antes de cálculos', () => {
    const p = real();
    p.surfaces[1].aperture = { kind: 'circle', radiusMm: 1e-300 };
    expect(validateProject(p).ok).toBe(false);
  });
  it('oráculo de condensadora isolada tem conjugado virtual -8/3', () => {
    const p = ideal();
    p.surfaces = p.surfaces.slice(0, 1).concat(p.surfaces.at(-1)!);
    p.surfaces.unshift({
      id: 'object',
      label: 'Objeto LED de referência',
      kind: 'mask',
      aperture: { kind: 'circle', radiusMm: 1 },
      gapAfterMm: 2,
    });
    p.firstVertexZMm = 0;
    const c = solveConjugate(compileProject(p), 'object');
    expect(c.status).toBe('virtual');
    if (c.status === 'virtual') expect(c.distanceMm).toBeCloseTo(-8 / 3, 12);
  });
});
it('YZ e XZ usam leques distintos sem ultrapassar limite de captura', () => {
  const p = maskProject(),
    r = traceBatch(compileProject(p), { ...sampling, illuminationRayCount: 1000 }, request);
  expect(r.paths.length + r.pathsXZ.length).toBeLessThanOrEqual(sampling.maxStoredPaths);
  expect(r.paths.every((t) => t.path.every((p) => p.x === 0))).toBe(true);
  expect(r.pathsXZ.every((t) => t.path.every((p) => p.y === 0))).toBe(true);
  expect(r.pathsXZ.some((t) => t.path.some((p) => p.x !== 0))).toBe(true);
});
it('discriminante não cria interseção por cancelamento com origem distante', () => {
  expect(intersect(v(1.001, 0, -1e6), v(0, 0, 1), { kind: 'sphere', radiusMm: 1 })).toBeNull();
  const h = intersect(v(0.9, 0, -1e6), v(0, 0, 1), { kind: 'sphere', radiusMm: 1 })!;
  expect(h.point.z).toBeCloseTo(1 - Math.sqrt(1 - 0.9 ** 2), 8);
});
