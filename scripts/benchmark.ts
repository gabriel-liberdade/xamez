import { cpus, totalmem, platform, arch } from 'node:os';
import { readFileSync, writeFileSync } from 'node:fs';
import { traceBatch } from '@xamez/optics-core';
import { compileProject, validateProject, type Project } from '@xamez/project-format';
const p = JSON.parse(readFileSync('examples/collimated-focus.json', 'utf8')) as Project;
// 18 refractive plane faces + a passive aperture + terminal detector = 20 surfaces.
// Keep all rays so the benchmark exercises 20 sequential intersections per ray.
p.lensGroups = [];
p.firstVertexZMm = 0;
p.surfaces = Array.from({ length: 18 }, (_, i) => ({
  id: `face-${i}`,
  label: `Face ${i}`,
  kind: 'interface' as const,
  shape: { kind: 'plane' as const },
  mediumAfterId: i % 2 === 0 ? 'demo-n150' : 'air-ideal',
  aperture: { kind: 'circle' as const, radiusMm: 6 },
  gapAfterMm: 5,
}));
p.surfaces.push({
  id: 'mask',
  label: 'Abertura',
  kind: 'mask',
  aperture: { kind: 'circle', radiusMm: 6 },
  gapAfterMm: 5,
});
p.surfaces.push({
  id: 'screen',
  label: 'Tela',
  kind: 'detector',
  aperture: { kind: 'rectangle', widthMm: 20, heightMm: 20 },
  gapAfterMm: null,
});
p.analysis.footprintSurfaceId = 'screen';
const validation = validateProject(p);
if (!validation.ok) throw Error(JSON.stringify(validation.diagnostics));
const system = compileProject(validation.project);
const samples = (n: number) => {
  const values: number[] = [];
  let peak = 0;
  for (let i = 0; i < 12; i++) {
    const result = traceBatch(system, { ...p.sampling, illuminationRayCount: n }, p.analysis);
    if (i > 1) values.push(result.elapsedMs);
    peak = Math.max(peak, process.memoryUsage().heapUsed);
  }
  values.sort((a, b) => a - b);
  return {
    rays: n,
    surfaces: 20,
    iterations: 10,
    medianMs: values[4],
    p95Ms: values[9],
    maxObservedHeapMiB: peak / 1024 ** 2,
  };
};
const report = {
  measuredAt: new Date().toISOString(),
  runtime: process.version,
  platform: platform(),
  arch: arch(),
  cpu: cpus()[0]?.model,
  logicalCpus: cpus().length,
  totalMemoryGiB: totalmem() / 1024 ** 3,
  kind: 'Node, síncrono, 18 interfaces refrativas planas + máscara + detector, todos os raios sobrevivem; heap total do processo, não memória exclusiva do motor.',
  results: [samples(200), samples(100000)],
};
writeFileSync('docs/benchmark.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
