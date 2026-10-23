import { apertureRadius } from '@xamez/optics-core';
import type { Project } from '@xamez/project-format';
import { Field, NumberField, fmt } from './components';
import type { ProjectEdit } from './ui';
export function SourcePanel({ project, edit }: { project: Project; edit: ProjectEdit }) {
  const realMode = project.modelKind === 'real-surfaces';
  return (
    <div className="panel">
      <div className="panel-heading">
        <div>
          <h2>Iluminação</h2>
        </div>
      </div>
      <div className="controls">
        <Field label="Tipo de fonte">
          <select
            aria-label="Tipo de fonte"
            value={project.source.kind}
            onChange={(e) =>
              edit((p) => {
                p.source =
                  e.target.value === 'point'
                    ? {
                        kind: 'point',
                        positionMm: {
                          x: 0,
                          y: 0,
                          z: Math.min(-5, p.firstVertexZMm - 5),
                        },
                        angular: {
                          model: 'uniform-cone',
                          halfAngleDeg: 60,
                        },
                      }
                    : {
                        kind: 'collimated',
                        launchPlaneZMm: Math.min(-5, p.firstVertexZMm - 5),
                        launchAperture: { kind: 'circle', radiusMm: 2 },
                        fieldAnglesDeg: { x: 0, y: 0 },
                      };
              })
            }
          >
            <option value="point">LED pontual</option>
            <option value="collimated">Feixe colimado</option>
          </select>
        </Field>
        <div className="two-fields">
          <Field label="Comprimento de onda (nm)">
            <NumberField
              label="Comprimento de onda (nm)"
              value={project.wavelengthNm}
              onCommit={(n) =>
                edit((p) => {
                  p.wavelengthNm = n;
                })
              }
            />
          </Field>
          <Field label="z da fonte (mm)">
            <NumberField
              label="Posição da fonte (mm)"
              value={
                project.source.kind === 'point'
                  ? project.source.positionMm.z
                  : project.source.launchPlaneZMm
              }
              onCommit={(n) =>
                edit((p) => {
                  if (p.source.kind === 'point') p.source.positionMm.z = n;
                  else p.source.launchPlaneZMm = n;
                })
              }
            />
          </Field>
        </div>
        {project.source.kind === 'point' ? (
          <>
            <Field label="Distribuição angular">
              <select
                aria-label="Distribuição angular"
                value={project.source.angular.model}
                onChange={(e) =>
                  edit((p) => {
                    if (p.source.kind === 'point')
                      p.source.angular =
                        e.target.value === 'uniform-cone'
                          ? { model: 'uniform-cone', halfAngleDeg: 60 }
                          : {
                              model: 'cosine-power',
                              fullWidthHalfMaxDeg: 120,
                            };
                  })
                }
              >
                <option value="uniform-cone">Cone uniforme em ângulo sólido</option>
                <option value="cosine-power">Cosseno elevado / Lambertiano</option>
              </select>
            </Field>
            <Field
              label={
                project.source.angular.model === 'uniform-cone'
                  ? 'Ângulo TOTAL de emissão (°)'
                  : 'Ângulo TOTAL FWHM (°)'
              }
              hint={
                project.source.angular.model === 'uniform-cone'
                  ? `Semiângulo: ${fmt(project.source.angular.halfAngleDeg)}°. Aproximação sem datasheet.`
                  : 'FWHM 120° = Lambertiano. Emissão no hemisfério, sem corte em 60°.'
              }
            >
              <NumberField
                label="Ângulo total (graus)"
                value={
                  project.source.angular.model === 'uniform-cone'
                    ? 2 * project.source.angular.halfAngleDeg
                    : project.source.angular.fullWidthHalfMaxDeg
                }
                onCommit={(n) =>
                  edit((p) => {
                    if (p.source.kind === 'point') {
                      if (p.source.angular.model === 'uniform-cone')
                        p.source.angular.halfAngleDeg = n / 2;
                      else p.source.angular.fullWidthHalfMaxDeg = n;
                    }
                  })
                }
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="Diâmetro de lançamento (mm)">
              <NumberField
                label="Diâmetro de lançamento (mm)"
                value={2 * apertureRadius(project.source.launchAperture)}
                onCommit={(n) =>
                  edit((p) => {
                    if (p.source.kind === 'collimated')
                      p.source.launchAperture = {
                        kind: 'circle',
                        radiusMm: n / 2,
                      };
                  })
                }
              />
            </Field>
            <div className="two-fields">
              {(['x', 'y'] as const).map((a) => (
                <Field label={`Direção ${a} (°)`} key={a}>
                  <NumberField
                    label={`Direção ${a} (graus)`}
                    value={
                      project.source.kind === 'collimated' ? project.source.fieldAnglesDeg[a] : 0
                    }
                    onCommit={(n) =>
                      edit((p) => {
                        if (p.source.kind === 'collimated') p.source.fieldAnglesDeg[a] = n;
                      })
                    }
                  />
                </Field>
              ))}
            </div>
            <small>
              O disco de lançamento define o fluxo considerado, sem onda infinita de potência
              infinita.
            </small>
          </>
        )}
        <Field label="Transmissão">
          <select
            aria-label="Modelo de transmissão"
            disabled={!realMode}
            value={project.physics.transmission}
            onChange={(e) =>
              edit((p) => {
                p.physics.transmission = e.target.value as Project['physics']['transmission'];
              })
            }
          >
            <option value="ideal">Ideal · sem perdas Fresnel</option>
            <option value="fresnel-uncoated">Fresnel · sem revestimento</option>
          </select>
        </Field>
        <details>
          <summary>Ajustes avançados</summary>
          <Field label="Raios no refinamento">
            <NumberField
              label="Raios no refinamento"
              value={project.sampling.illuminationRayCount}
              onCommit={(n) =>
                edit((p) => {
                  p.sampling.illuminationRayCount = n;
                })
              }
            />
          </Field>
          <Field label="Seed determinística">
            <NumberField
              label="Seed"
              value={project.sampling.seed}
              onCommit={(n) =>
                edit((p) => {
                  p.sampling.seed = n;
                })
              }
            />
          </Field>
          <Field label="Primeiro vértice z (mm)">
            <NumberField
              label="Primeiro vértice (mm)"
              value={project.firstVertexZMm}
              onCommit={(n) =>
                edit((p) => {
                  p.firstVertexZMm = n;
                })
              }
            />
          </Field>
          <small>
            mulberry32-v1 · prévia até 5.000 raios. Análise quantitativa usa raios 3D independentes
            do leque desenhado.
          </small>
        </details>
      </div>
    </div>
  );
}
