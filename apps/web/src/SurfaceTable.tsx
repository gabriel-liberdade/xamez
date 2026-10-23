import type { Project } from '@xamez/project-format';
import { NumberField, fmt } from './components';
import type { ProjectEdit } from './ui';
import { DisclosureActions } from './ui';
import { labels, pMaterial } from './project-ui';
export function SurfaceTable({
  project,
  selectedId,
  selectElement,
  edit,
  insert,
  undoCount,
  redoCount,
  undoProject,
  redoProject,
}: {
  project: Project;
  selectedId: string;
  selectElement: (id: string, reveal?: boolean) => void;
  edit: ProjectEdit;
  insert: (kind: 'lens' | 'mask' | 'slit' | 'mirror' | 'thin-lens') => void;
  undoCount: number;
  redoCount: number;
  undoProject: () => void;
  redoProject: () => void;
}) {
  const realMode = project.modelKind === 'real-surfaces';
  return (
    <div className="panel surfaces-panel">
      <div className="panel-heading">
        <div>
          <h2>
            Elementos do sistema <span className="count">{project.surfaces.length}</span>
          </h2>
        </div>
        <div className="inline">
          <DisclosureActions label="+ Adicionar" className="add-menu">
            <button onClick={() => insert(realMode ? 'lens' : 'thin-lens')}>
              + Lente{!realMode ? ' fina' : ''}
            </button>
            <button onClick={() => insert('slit')}>+ Fenda</button>
            <button onClick={() => insert('mask')}>+ Diafragma</button>
            <button
              disabled={!realMode}
              title={!realMode ? 'Espelho exige superfícies reais.' : ''}
              onClick={() => insert('mirror')}
            >
              + Espelho
            </button>
          </DisclosureActions>
          <button aria-label="Desfazer" disabled={!undoCount} onClick={undoProject}>
            ↶ Desfazer
          </button>
          <button aria-label="Refazer" disabled={!redoCount} onClick={redoProject}>
            ↷
          </button>
        </div>
      </div>
      <p className="table-hint">
        Deslize a tabela para ver todas as colunas. Toque no nome para editar.
      </p>
      <div className="table-scroll">
        <table className="surfaces">
          <thead>
            <tr>
              <th>#</th>
              <th>Elemento / tipo</th>
              <th>{realMode ? 'Raio R (mm)' : 'Focal (mm)'}</th>
              <th title="Distância do vértice até o próximo elemento">Até o próximo (mm)</th>
              <th>{realMode ? 'Meio posterior' : 'Abertura'}</th>
              <th title="Plano do objeto cuja imagem é analisada; não é a fonte">Objeto</th>
            </tr>
          </thead>
          <tbody>
            {project.surfaces.map((s, i) => (
              <tr
                key={s.id}
                className={selectedId === s.id ? 'selected' : ''}
                onClick={() => selectElement(s.id)}
              >
                <td>{String(i + 1).padStart(2, '0')}</td>
                <td>
                  <button
                    className="surface-name"
                    onClick={(event) => {
                      event.stopPropagation();
                      selectElement(s.id, true);
                    }}
                  >
                    {s.label}
                  </button>
                  <small>{labels[s.kind]}</small>
                </td>
                <td>
                  {s.kind === 'interface' && s.shape.kind === 'sphere' ? (
                    <NumberField
                      label={`Raio de ${s.label}`}
                      value={s.shape.radiusMm}
                      onCommit={(n) =>
                        edit((p) => {
                          const face = p.surfaces[i];
                          if (face.kind === 'interface')
                            face.shape = {
                              kind: 'sphere',
                              radiusMm: n,
                            };
                        })
                      }
                    />
                  ) : s.kind === 'thin-lens' ? (
                    <NumberField
                      label={`Focal de ${s.label}`}
                      value={s.focalLengthMm}
                      onCommit={(n) =>
                        edit((p) => {
                          const lens = p.surfaces[i];
                          if (lens.kind === 'thin-lens') lens.focalLengthMm = n;
                        })
                      }
                    />
                  ) : (
                    <span className="muted">{s.kind === 'interface' ? 'plano' : '—'}</span>
                  )}
                </td>
                <td>
                  {s.gapAfterMm !== null ? (
                    <NumberField
                      label={`Gap após ${s.label}`}
                      value={s.gapAfterMm}
                      onCommit={(n) =>
                        edit((p) => {
                          p.surfaces[i].gapAfterMm = n;
                        })
                      }
                    />
                  ) : (
                    <span className="muted">terminal</span>
                  )}
                </td>
                <td>
                  {s.kind === 'interface'
                    ? pMaterial(project, s.mediumAfterId)
                    : s.aperture.kind === 'circle'
                      ? `Ø ${fmt(s.aperture.radiusMm * 2)}`
                      : `${fmt(s.aperture.widthMm)} × ${fmt(s.aperture.heightMm)}`}
                </td>
                <td>
                  {s.kind === 'mask' ? (
                    <input
                      aria-label={`Objeto: ${s.label}`}
                      type="radio"
                      checked={project.analysis.objectSurfaceId === s.id}
                      onChange={() =>
                        edit((p) => {
                          p.analysis.objectSurfaceId = s.id;
                        })
                      }
                    />
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
