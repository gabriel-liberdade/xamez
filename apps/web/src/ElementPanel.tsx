import type { Project, ProjectSurface } from '@xamez/project-format';
import { Field, NumberField, fmt } from './components';
import type { ProjectEdit } from './ui';
import { materialCatalog } from '@xamez/project-format';
import { labels, pMaterial } from './project-ui';
export function ElementPanel({
  project,
  selected,
  selectedIndex,
  edit,
  editSurface,
  changeGap,
  move,
  duplicate,
  deleteSelected,
}: {
  project: Project;
  selected: ProjectSurface;
  selectedIndex: number;
  edit: ProjectEdit;
  editSurface: (update: (s: ProjectSurface) => void) => void;
  changeGap: (n: number) => void;
  move: (direction: number) => void;
  duplicate: () => void;
  deleteSelected: () => void;
}) {
  const group = project.lensGroups?.find((g) => g.surfaceIds.includes(selected.id));
  return (
    <div className="panel">
      <div className="panel-heading">
        <div>
          <span className="element-index">{String(selectedIndex + 1).padStart(2, '0')}</span>
          <h2>
            {selected.kind === 'mask'
              ? selected.aperture.kind === 'rectangle'
                ? 'Fenda'
                : 'Diafragma'
              : labels[selected.kind]}
          </h2>
        </div>
        <span className="selection-dot" />
      </div>
      <div className="controls" key={selected.id}>
        <Field label="Nome">
          <input
            aria-label="Nome do elemento"
            key={`${selected.id}:${selected.label}`}
            defaultValue={selected.label}
            onBlur={(e) => {
              const value = e.target.value;
              if (value !== selected.label)
                editSurface((s) => {
                  s.label = value;
                });
            }}
          />
        </Field>
        {selected.kind === 'thin-lens' && (
          <Field label="Distância focal (mm)">
            <NumberField
              label="Distância focal (mm)"
              value={selected.focalLengthMm}
              onCommit={(n) =>
                editSurface((s) => {
                  if (s.kind === 'thin-lens') s.focalLengthMm = n;
                })
              }
            />
          </Field>
        )}
        {selected.kind === 'interface' && selected.shape.kind === 'sphere' && (
          <Field label="Raio de curvatura (mm)">
            <NumberField
              label="Raio de curvatura (mm)"
              value={selected.shape.radiusMm}
              onCommit={(n) =>
                editSurface((s) => {
                  if (s.kind === 'interface') s.shape = { kind: 'sphere', radiusMm: n };
                })
              }
            />
          </Field>
        )}
        {selected.gapAfterMm !== null && (
          <Field label="Até o próximo elemento (mm)">
            <NumberField
              label="Distância até o próximo elemento (mm)"
              value={selected.gapAfterMm}
              onCommit={(n) =>
                editSurface((s) => {
                  s.gapAfterMm = n;
                })
              }
            />
          </Field>
        )}
        {selected.aperture.kind === 'circle' ? (
          <Field label="Diâmetro útil (mm)">
            <NumberField
              label="Diâmetro útil (mm)"
              value={2 * selected.aperture.radiusMm}
              onCommit={(n) =>
                editSurface((s) => {
                  s.aperture = { kind: 'circle', radiusMm: n / 2 };
                })
              }
            />
          </Field>
        ) : (
          <>
            <div className="two-fields">
              <Field label="Largura (mm)">
                <NumberField
                  label="Largura (mm)"
                  value={selected.aperture.widthMm}
                  onCommit={(n) =>
                    editSurface((s) => {
                      if (s.aperture.kind === 'rectangle') s.aperture.widthMm = n;
                    })
                  }
                />
              </Field>
              <Field label="Altura (mm)">
                <NumberField
                  label="Altura (mm)"
                  value={selected.aperture.heightMm}
                  onCommit={(n) =>
                    editSurface((s) => {
                      if (s.aperture.kind === 'rectangle') s.aperture.heightMm = n;
                    })
                  }
                />
              </Field>
            </div>
            {selected.kind === 'mask' && (
              <div className="quick-widths">
                {[0.1, 0.3, 0.5, 1].map((n) => (
                  <button
                    key={n}
                    className={
                      selected.aperture.kind === 'rectangle' && selected.aperture.widthMm === n
                        ? 'active'
                        : ''
                    }
                    onClick={() =>
                      editSurface((s) => {
                        if (s.aperture.kind === 'rectangle') s.aperture.widthMm = n;
                      })
                    }
                  >
                    {fmt(n)} mm
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        {selected.kind === 'mask' && (
          <Field label="Formato da abertura">
            <select
              aria-label="Formato da abertura"
              value={selected.aperture.kind}
              onChange={(e) =>
                editSurface((s) => {
                  s.aperture =
                    e.target.value === 'circle'
                      ? { kind: 'circle', radiusMm: 2 }
                      : {
                          kind: 'rectangle',
                          widthMm: 0.3,
                          heightMm: 1,
                        };
                })
              }
            >
              <option value="rectangle">Retangular / fenda</option>
              <option value="circle">Circular / diafragma</option>
            </select>
          </Field>
        )}
        {selected.kind === 'mask' && (
          <label className="object-toggle">
            <input
              type="checkbox"
              checked={project.analysis.objectSurfaceId === selected.id}
              onChange={(event) =>
                edit((p) => {
                  if (event.target.checked) p.analysis.objectSurfaceId = selected.id;
                  else delete p.analysis.objectSurfaceId;
                })
              }
            />
            Projetar esta abertura
          </label>
        )}
        {selected.kind === 'interface' && (
          <>
            <Field label="Forma da face">
              <select
                aria-label="Forma da face"
                value={selected.shape.kind}
                onChange={(e) =>
                  editSurface((s) => {
                    if (s.kind === 'interface')
                      s.shape =
                        e.target.value === 'plane'
                          ? { kind: 'plane' }
                          : { kind: 'sphere', radiusMm: 50 };
                  })
                }
              >
                <option value="sphere">Esférica</option>
                <option value="plane">Plana</option>
              </select>
            </Field>
            <Field label="Meio depois desta face">
              <select
                aria-label="Meio posterior"
                value={selected.mediumAfterId}
                onChange={(e) => {
                  const id = e.target.value;
                  edit((p) => {
                    if (materialCatalog[id]) p.materials[id] = structuredClone(materialCatalog[id]);
                    const s = p.surfaces.find((s) => s.id === selected.id)!;
                    if (s.kind === 'interface') s.mediumAfterId = id;
                  });
                }}
              >
                {Array.from(
                  new Set([...Object.keys(project.materials), ...Object.keys(materialCatalog)]),
                ).map((id) => (
                  <option value={id} key={id}>
                    {pMaterial(project, id)}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}
        {group && (
          <Field
            label="Inclinação rígida da lente em x (°)"
            hint="As duas faces giram juntas. Gap após lente é nominal antes da rotação."
          >
            <NumberField
              label="Inclinação rígida da lente (graus)"
              value={group.tiltDeg.x}
              onCommit={(n) =>
                edit((p) => {
                  p.lensGroups!.find((g) => g.id === group.id)!.tiltDeg.x = n;
                })
              }
            />
          </Field>
        )}
        {selected.kind === 'mirror' && (
          <>
            <Field label="Inclinação do espelho em x (°)">
              <NumberField
                label="Inclinação do espelho (graus)"
                value={selected.tiltDeg.x}
                onCommit={(n) =>
                  editSurface((s) => {
                    if (s.kind === 'mirror') s.tiltDeg.x = n;
                  })
                }
              />
            </Field>
            <Field
              label="Refletância (0–1)"
              hint={
                selected.reflectance === 1
                  ? 'Espelho ideal'
                  : 'Perda no espelho contabilizada separadamente de Fresnel.'
              }
            >
              <NumberField
                label="Refletância do espelho"
                value={selected.reflectance}
                onCommit={(n) =>
                  editSurface((s) => {
                    if (s.kind === 'mirror') s.reflectance = n;
                  })
                }
              />
            </Field>
          </>
        )}
        {selected.kind === 'detector' && project.surfaces.length > 1 && (
          <Field label="Distância do trecho final (mm)">
            <NumberField
              label="Distância da tela (mm)"
              value={project.surfaces.at(-2)!.gapAfterMm!}
              onCommit={changeGap}
            />
          </Field>
        )}
        {selected.kind !== 'detector' && (
          <div className="element-actions">
            <button onClick={() => move(-1)} aria-label="Mover para cima">
              ↑
            </button>
            <button onClick={() => move(1)} aria-label="Mover para baixo">
              ↓
            </button>
            <button onClick={duplicate}>Duplicar</button>
            <button className="danger" onClick={deleteSelected}>
              Excluir{group ? ' lente' : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
