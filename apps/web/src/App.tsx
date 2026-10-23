import { useEffect, useMemo, useRef, useState } from 'react';
import { apertureRadius, solveConjugate, type BatchResult } from '@xamez/optics-core';
import {
  compileProject,
  materialCatalog,
  MAX_FILE_BYTES,
  parseProject,
  serializeProject,
  validateProject,
  type Diagnostic,
  type Project,
  type ProjectSurface,
} from '@xamez/project-format';
import userExample from '../../../examples/user-system.paraxial.proposed.json';
import realExample from '../../../examples/slit-projection.proposed.json';
import focusExample from '../../../examples/collimated-focus.json';
import mirrorExample from '../../../examples/mirror.json';
import tiltedExample from '../../../examples/tilted-plate.json';
import vignettingExample from '../../../examples/vignetting.json';
import { Diagram, Field, fmt, MapCanvas, NumberField } from './components';
import {
  configurationKey,
  isCurrentResponse,
  type RunTag,
  type WorkerRequest,
  type WorkerResponse,
} from './protocol';
const presets = [
  { label: 'Seu sistema · focais 8 / 14 mm', value: userExample },
  { label: 'Fenda · superfícies reais', value: realExample },
  { label: 'Foco · feixe colimado', value: focusExample },
  { label: 'Vinhetamento · abertura reduzida', value: vignettingExample },
  { label: 'Espelho · dobra de 90°', value: mirrorExample },
  { label: 'Placa inclinada · 20°', value: tiltedExample },
];
function presetProject(index: number): Project {
  const r = validateProject(structuredClone(presets[index].value));
  if (!r.ok) throw new Error(r.diagnostics.map((d) => d.message).join('; '));
  return r.project;
}
const labels: Record<string, string> = {
  'thin-lens': 'Lente fina',
  interface: 'Interface',
  mask: 'Máscara',
  detector: 'Tela',
  mirror: 'Espelho',
};
const AUTOSAVE = 'xamez:autosave:v1';
const pct = (n: number) => `${fmt(100 * n, 4)}%`;
function download(name: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function App() {
  const [project, setProject] = useState<Project>(() => presetProject(0));
  const [revision, setRevision] = useState(1),
    [undo, setUndo] = useState<Project[]>([]),
    [redo, setRedo] = useState<Project[]>([]),
    [errors, setErrors] = useState<Diagnostic[]>([]);
  const [selectedId, setSelectedId] = useState('slit'),
    [axis, setAxis] = useState<'x' | 'y'>('y'),
    [tab, setTab] = useState('screen');
  const [jsonOpen, setJsonOpen] = useState(false),
    [json, setJson] = useState(''),
    [notice, setNotice] = useState('');
  const [autosave, setAutosave] = useState<string | null>(() => {
    try {
      return localStorage.getItem(AUTOSAVE);
    } catch {
      return null;
    }
  });
  const [workerState, setWorkerState] = useState('calculando'),
    [progress, setProgress] = useState(0),
    [response, setResponse] = useState<({ result: BatchResult } & RunTag) | null>(null),
    [run, setRun] = useState({ tick: 0, refined: false }),
    [workerGeneration, setWorkerGeneration] = useState(0);
  const [wizard, setWizard] = useState(false),
    [lens, setLens] = useState({
      front: 50,
      back: -50,
      thickness: 5,
      diameter: 10,
      material: 'N-BK7',
    });
  const fileInput = useRef<HTMLInputElement>(null),
    worker = useRef<Worker | null>(null),
    tag = useRef<RunTag>({ revision: 0, requestId: 0, configurationKey: '' });
  const system = useMemo(() => compileProject(project), [project]);
  const conjugate = useMemo(
    () => solveConjugate(system, project.analysis.objectSurfaceId),
    [system, project.analysis.objectSurfaceId],
  );
  const effective = useMemo(
    () => ({
      ...project,
      sampling: {
        ...project.sampling,
        illuminationRayCount: run.refined
          ? project.sampling.illuminationRayCount
          : Math.min(5000, project.sampling.illuminationRayCount),
      },
    }),
    [project, run.refined],
  );
  const key = useMemo(() => configurationKey(effective), [effective]);
  const result =
    response && response.revision === revision && response.configurationKey === key
      ? response.result
      : null;
  const selected = project.surfaces.find((s) => s.id === selectedId) ?? project.surfaces[0];
  const selectedIndex = project.surfaces.indexOf(selected);
  const group = project.lensGroups?.find((g) => g.surfaceIds.includes(selected.id));
  const object = project.surfaces.find((s) => s.id === project.analysis.objectSurfaceId);
  const invalidate = () => {
    tag.current = { ...tag.current, requestId: tag.current.requestId + 1 };
    worker.current?.postMessage({ type: 'cancel' });
  };
  useEffect(() => {
    const w = new Worker(new URL('./optics.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.current = w;
    w.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const r = event.data;
      if (!isCurrentResponse(r, tag.current)) return;
      if (r.type === 'result') {
        setResponse({ ...r });
        setWorkerState('atualizado');
        setProgress(1);
      }
      if (r.type === 'progress') setProgress(r.fraction);
      if (r.type === 'error') {
        setWorkerState('erro');
        setNotice(`Falha no cálculo: ${r.message}`);
      }
    };
    w.onerror = () => {
      setWorkerState('erro');
      setNotice('O Worker falhou. Use Reiniciar cálculo para recuperar.');
    };
    return () => {
      w.terminate();
      worker.current = null;
    };
  }, [workerGeneration]);
  useEffect(() => {
    const current = {
      revision,
      configurationKey: key,
      requestId: tag.current.requestId + 1,
    };
    tag.current = current;
    setWorkerState('calculando');
    setProgress(0);
    worker.current?.postMessage({ type: 'cancel' } satisfies WorkerRequest);
    const timer = setTimeout(
      () =>
        worker.current?.postMessage({
          type: 'run',
          project: effective,
          ...current,
        } satisfies WorkerRequest),
      120,
    );
    return () => clearTimeout(timer);
  }, [effective, revision, key, run.tick, workerGeneration]);
  useEffect(() => {
    if (autosave !== null) return; // Preserve the prior copy until restore/dismiss.
    try {
      localStorage.setItem(AUTOSAVE, serializeProject(project));
    } catch {
      setNotice('Não foi possível gravar autosave; exporte o JSON para preservar o projeto.');
    }
  }, [project, autosave]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        !(e.ctrlKey || e.metaKey) ||
        e.key.toLowerCase() !== 'z' ||
        ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)
      )
        return;
      e.preventDefault();
      e.shiftKey ? redoProject() : undoProject();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });
  function replace(next: Project, history = true): boolean {
    const validation = validateProject(next);
    if (!validation.ok) {
      setErrors(validation.diagnostics);
      return false;
    }
    invalidate();
    if (history) {
      setUndo((p) => [...p.slice(-49), project]);
      setRedo([]);
    }
    setProject(validation.project);
    setRevision((r) => r + 1);
    setRun((r) => ({ ...r, refined: false }));
    setErrors([]);
    return true;
  }
  function edit(update: (draft: Project) => void) {
    const draft = structuredClone(project);
    update(draft);
    return replace(draft);
  }
  function editSurface(update: (surface: ProjectSurface) => void) {
    edit((p) => update(p.surfaces.find((s) => s.id === selected.id)!));
  }
  function undoProject() {
    const previous = undo.at(-1);
    if (!previous) return;
    setUndo((u) => u.slice(0, -1));
    setRedo((r) => [...r, project]);
    replace(previous, false);
  }
  function redoProject() {
    const next = redo.at(-1);
    if (!next) return;
    setRedo((r) => r.slice(0, -1));
    setUndo((u) => [...u, project]);
    replace(next, false);
  }
  function importText(text: string) {
    const r = parseProject(text);
    if (!r.ok) {
      setErrors(r.diagnostics);
      return;
    }
    if (replace(r.project)) {
      setJsonOpen(false);
      setSelectedId(r.project.analysis.objectSurfaceId ?? r.project.surfaces[0].id);
      setNotice('Projeto importado e validado.');
    }
  }
  function selectPreset(value: number) {
    const p = presetProject(value);
    replace(p);
    setSelectedId(p.analysis.objectSurfaceId ?? p.surfaces[0].id);
    setNotice('Exemplo carregado. As alterações anteriores estão no histórico.');
  }
  function changeGap(value: number) {
    edit((p) => {
      const previous = p.surfaces.at(-2);
      if (previous) previous.gapAfterMm = value;
    });
  }
  function focusScreen() {
    if (conjugate.status !== 'real') return;
    const index = project.surfaces.findIndex((s) => s.id === conjugate.referenceSurfaceId);
    let other = 0;
    for (let i = index; i < project.surfaces.length - 2; i++)
      other += project.surfaces[i].gapAfterMm!;
    changeGap(conjugate.distanceMm - other);
  }
  function insert(kind: 'lens' | 'mask' | 'slit' | 'mirror' | 'thin-lens') {
    if (kind === 'lens') {
      setWizard(true);
      return;
    }
    const id = crypto.randomUUID(),
      base = {
        id,
        label:
          kind === 'slit'
            ? 'Fenda'
            : kind === 'mask'
              ? 'Diafragma'
              : kind === 'mirror'
                ? 'Espelho plano'
                : 'Lente fina ideal',
        gapAfterMm: 30,
      };
    const aperture =
      kind === 'slit'
        ? { kind: 'rectangle' as const, widthMm: 0.3, heightMm: 1 }
        : { kind: 'circle' as const, radiusMm: 3 };
    const s: ProjectSurface =
      kind === 'thin-lens'
        ? { ...base, kind, focalLengthMm: 50, aperture }
        : kind === 'mirror'
          ? {
              ...base,
              kind,
              shape: { kind: 'plane' },
              tiltDeg: { x: 45, y: 0 },
              reflectance: 1,
              aperture,
            }
          : { ...base, kind: 'mask', aperture };
    if (
      edit((p) => {
        p.surfaces.splice(-1, 0, s);
        if (kind === 'slit') p.analysis.objectSurfaceId = id;
      })
    )
      setSelectedId(id);
  }
  function addLens() {
    const id = crypto.randomUUID(),
      front = `${id}-a`,
      back = `${id}-b`;
    if (
      edit((p) => {
        p.materials[lens.material] = structuredClone(materialCatalog[lens.material]);
        p.surfaces.splice(
          -1,
          0,
          {
            id: front,
            label: 'Lente — frente',
            kind: 'interface',
            shape: lens.front === 0 ? { kind: 'plane' } : { kind: 'sphere', radiusMm: lens.front },
            mediumAfterId: lens.material,
            aperture: { kind: 'circle', radiusMm: lens.diameter / 2 },
            gapAfterMm: lens.thickness,
          },
          {
            id: back,
            label: 'Lente — trás',
            kind: 'interface',
            shape: lens.back === 0 ? { kind: 'plane' } : { kind: 'sphere', radiusMm: lens.back },
            mediumAfterId: p.initialMediumId,
            aperture: { kind: 'circle', radiusMm: lens.diameter / 2 },
            gapAfterMm: 30,
          },
        );
        (p.lensGroups ??= []).push({
          id,
          surfaceIds: [front, back],
          tiltDeg: { x: 0, y: 0 },
        });
      })
    ) {
      setWizard(false);
      setSelectedId(front);
    }
  }
  function deleteSelected() {
    if (selected.kind === 'detector') return;
    const ids = group?.surfaceIds ?? [selected.id];
    edit((p) => {
      p.surfaces = p.surfaces.filter((s) => !ids.includes(s.id));
      p.lensGroups = p.lensGroups?.filter((g) => !g.surfaceIds.some((id) => ids.includes(id)));
      if (ids.includes(p.analysis.objectSurfaceId ?? '')) delete p.analysis.objectSurfaceId;
      if (ids.includes(p.analysis.footprintSurfaceId))
        p.analysis.footprintSurfaceId = p.surfaces[0].id;
    });
  }
  function duplicate() {
    if (selected.kind === 'detector') return;
    const ids = group?.surfaceIds ?? [selected.id];
    let first = '';
    if (
      edit((p) => {
        const copies = ids.map((id) => {
          const s = structuredClone(p.surfaces.find((s) => s.id === id)!);
          s.id = crypto.randomUUID();
          s.label += ' · cópia';
          return s;
        });
        first = copies[0].id;
        const index = p.surfaces.findIndex((s) => s.id === ids.at(-1));
        p.surfaces.splice(index + 1, 0, ...copies);
        if (group)
          (p.lensGroups ??= []).push({
            ...structuredClone(group),
            id: crypto.randomUUID(),
            surfaceIds: [copies[0].id, copies[1].id],
          });
      })
    )
      setSelectedId(first);
  }
  function move(direction: number) {
    edit((p) => {
      const blocks: ProjectSurface[][] = [];
      for (let i = 0; i < p.surfaces.length; i++) {
        const g = p.lensGroups?.find((g) => g.surfaceIds[0] === p.surfaces[i].id);
        blocks.push(g ? [p.surfaces[i], p.surfaces[++i]] : [p.surfaces[i]]);
      }
      const i = blocks.findIndex((b) => b.some((s) => s.id === selected.id)),
        j = i + direction;
      if (j < 0 || j >= blocks.length - 1 || i === blocks.length - 1) return;
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
      p.surfaces = blocks.flat();
    });
  }
  function exportCsv() {
    if (!result) return;
    const meta = `# Xamez engine=${result.engineVersion}; sampling=${result.samplingVersion}; revision=${revision}; config=${key}; seed=${result.seed}; N=${result.launched}; denominator=emissao_considerada; modo=${project.modelKind}; transmissao=${project.physics.transmission}\n`;
    download(
      'xamez-perdas.csv',
      meta +
        'id,incidente_fracao,bloqueado_fracao,fresnel_fracao,espelho_fracao,transmitido_fracao,perdeu_calota_fracao,outros_fracao\n' +
        result.surfaceFlows
          .map((f) =>
            [
              `"${f.id.replaceAll('"', '""')}"`,
              f.incident,
              f.blocked,
              f.fresnel,
              f.mirrorAbsorption,
              f.transmitted,
              f.missed,
              f.other,
            ].join(','),
          )
          .join('\n'),
      'text/csv;charset=utf-8',
    );
  }
  const realMode = project.modelKind === 'real-surfaces';
  const status = errors.length
    ? 'edição inválida'
    : workerState === 'atualizado' && result
      ? 'resultado atualizado'
      : workerState === 'calculando'
        ? `calculando · ${Math.round(progress * 100)}%`
        : workerState === 'cancelado'
          ? 'cálculo cancelado'
          : 'resultado indisponível';
  return (
    <>
      <header className="topbar">
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
          <span className="brand-icon">✳</span>
          <b>xamez</b>
          <span className="brand-sub">BANCADA ÓPTICA</span>
        </a>
        <div className="top-actions">
          <span className="local-pill">
            <i />
            Local · sem nuvem
          </span>
          <button onClick={() => fileInput.current?.click()}>Importar JSON</button>
          <button
            onClick={() => {
              setJson(serializeProject(project));
              setJsonOpen(true);
            }}
          >
            Editar JSON
          </button>
          <button
            className="primary"
            onClick={() => download('xamez-projeto.json', serializeProject(project))}
          >
            Salvar projeto <span>↗</span>
          </button>
        </div>
        <input
          type="file"
          ref={fileInput}
          accept=".json,application/json"
          hidden
          aria-label="Importar arquivo JSON"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) {
              if (f.size > MAX_FILE_BYTES)
                setErrors([
                  {
                    code: 'FILE_TOO_LARGE',
                    severity: 'error',
                    path: 'arquivo',
                    message: 'Limite de 2 MB.',
                  },
                ]);
              else importText(await f.text());
            }
            e.target.value = '';
          }}
        />
      </header>
      {autosave && (
        <div className="restore">
          Há uma cópia local da sessão anterior.{' '}
          <button
            onClick={() => {
              importText(autosave);
              setAutosave(null);
            }}
          >
            Restaurar sessão
          </button>
          <button
            onClick={() => {
              download('xamez-autosave.json', autosave);
            }}
          >
            Baixar cópia
          </button>
          <button aria-label="Dispensar restauração" onClick={() => setAutosave(null)}>
            ×
          </button>
        </div>
      )}
      <main>
        <div className="page-heading">
          <div>
            <div className="eyebrow">SIMULAÇÃO SEQUENCIAL / v0.1</div>
            <h1>Da fonte à imagem.</h1>
            <p>Monte o caminho óptico. Veja onde a luz chega.</p>
          </div>
          <div className="project-select">
            <label htmlFor="examples">EXPERIMENTO</label>
            <select id="examples" value="" onChange={(e) => selectPreset(Number(e.target.value))}>
              <option value="" disabled>
                {project.name}
              </option>
              {presets.map((p, i) => (
                <option key={i} value={i}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className={`mode-banner ${realMode ? 'real' : 'ideal'}`}>
          <span className="mode-mark">{realMode ? 'R' : '≈'}</span>
          <div>
            <strong>
              {realMode ? 'Superfícies reais' : 'Exploração aproximada · lentes finas'}
            </strong>
            <p>{project.description}</p>
          </div>
          <span className="unit-pill">mm · nm</span>
        </div>
        {notice && (
          <div className="notice" role="status">
            {notice}
            <button aria-label="Fechar aviso" onClick={() => setNotice('')}>
              ×
            </button>
          </div>
        )}
        {!!errors.length && (
          <div className="errors" role="alert">
            <strong>Edição não aplicada. O último projeto válido foi preservado.</strong>
            {errors.slice(0, 8).map((e, i) => (
              <div key={i}>
                <code>{e.path}</code> · {e.message}
              </div>
            ))}
            <button onClick={() => setErrors([])}>Dispensar diagnóstico</button>
          </div>
        )}
        <div className="workspace">
          <section className="bench-column">
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">01 / CAMINHO ÓPTICO</span>
                  <h2>Traçado de raios</h2>
                </div>
                <div className="inline">
                  <div className="segmented">
                    <button className={axis === 'y' ? 'active' : ''} onClick={() => setAxis('y')}>
                      YZ
                    </button>
                    <button className={axis === 'x' ? 'active' : ''} onClick={() => setAxis('x')}>
                      XZ
                    </button>
                  </div>
                  <span
                    className={`status ${result ? 'ready' : ''}`}
                    data-testid="simulation-status"
                  >
                    {status}
                  </span>
                </div>
              </div>
              <Diagram
                system={system}
                paths={(axis === 'y' ? result?.paths : result?.pathsXZ) ?? []}
                selectedId={selected.id}
                onSelect={setSelectedId}
                onMoveScreen={changeGap}
                axis={axis}
              />
              <div className="bench-footer">
                <span>
                  3D no cálculo · corte meridional no desenho · escala igual nos dois eixos
                </span>
                <div className="inline">
                  {workerState === 'calculando' ? (
                    <button
                      onClick={() => {
                        invalidate();
                        setWorkerState('cancelado');
                      }}
                    >
                      Cancelar
                    </button>
                  ) : (
                    <button onClick={() => setRun((r) => ({ tick: r.tick + 1, refined: false }))}>
                      Recalcular prévia
                    </button>
                  )}
                  <button
                    className="primary"
                    onClick={() => {
                      if (workerState === 'erro') setWorkerGeneration((g) => g + 1);
                      setRun((r) => ({ tick: r.tick + 1, refined: true }));
                    }}
                  >
                    {workerState === 'erro'
                      ? 'Reiniciar cálculo'
                      : 'Refinar · ' + fmt(project.sampling.illuminationRayCount, 0) + ' raios'}
                  </button>
                </div>
              </div>
            </div>
            <div className="panel surfaces-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">02 / MONTAGEM</span>
                  <h2>Sequência de superfícies</h2>
                </div>
                <div className="inline">
                  <button aria-label="Desfazer" disabled={!undo.length} onClick={undoProject}>
                    ↶ Desfazer
                  </button>
                  <button aria-label="Refazer" disabled={!redo.length} onClick={redoProject}>
                    ↷
                  </button>
                </div>
              </div>
              <div className="table-scroll">
                <table className="surfaces">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Elemento / tipo</th>
                      <th>{realMode ? 'Raio R (mm)' : 'Focal (mm)'}</th>
                      <th>Gap após (mm)</th>
                      <th>{realMode ? 'Meio posterior' : 'Abertura'}</th>
                      <th>Objeto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.surfaces.map((s, i) => (
                      <tr
                        key={s.id}
                        className={selected.id === s.id ? 'selected' : ''}
                        onClick={() => setSelectedId(s.id)}
                      >
                        <td>{String(i + 1).padStart(2, '0')}</td>
                        <td>
                          <button className="surface-name" onClick={() => setSelectedId(s.id)}>
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
              <div className="add-bar">
                <span>Adicionar</span>
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
              </div>
            </div>
          </section>
          <aside className="settings">
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">FONTE & FÍSICA</span>
                  <h2>Iluminação</h2>
                </div>
                <span className="source-icon">☀</span>
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
                  <Field label="λ (nm)">
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
                              project.source.kind === 'collimated'
                                ? project.source.fieldAnglesDeg[a]
                                : 0
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
                      O disco de lançamento define o fluxo considerado, sem onda infinita de
                      potência infinita.
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
                        p.physics.transmission = e.target
                          .value as Project['physics']['transmission'];
                      })
                    }
                  >
                    <option value="ideal">Ideal · sem perdas Fresnel</option>
                    <option value="fresnel-uncoated">Fresnel · sem revestimento</option>
                  </select>
                </Field>
                <details>
                  <summary>Amostragem e origem do banco</summary>
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
                    mulberry32-v1 · prévia até 5.000 raios. Análise quantitativa usa raios 3D
                    independentes do leque desenhado.
                  </small>
                </details>
              </div>
            </div>
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">
                    ELEMENTO {String(selectedIndex + 1).padStart(2, '0')}
                  </span>
                  <h2>{labels[selected.kind]}</h2>
                </div>
                <span className="selection-dot" />
              </div>
              <div className="controls">
                <Field label="Nome">
                  <input
                    aria-label="Nome do elemento"
                    key={selected.id}
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
                              selected.aperture.kind === 'rectangle' &&
                              selected.aperture.widthMm === n
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
                            if (materialCatalog[id])
                              p.materials[id] = structuredClone(materialCatalog[id]);
                            const s = p.surfaces.find((s) => s.id === selected.id)!;
                            if (s.kind === 'interface') s.mediumAfterId = id;
                          });
                        }}
                      >
                        {Array.from(
                          new Set([
                            ...Object.keys(project.materials),
                            ...Object.keys(materialCatalog),
                          ]),
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
          </aside>
        </div>
        <section className="analysis-section">
          <div className="analysis-title">
            <div>
              <div className="eyebrow">03 / ENTENDA O RESULTADO</div>
              <h2>Luz, imagem e perdas</h2>
            </div>
            <span className="muted">
              {result
                ? `${fmt(result.launched, 0)} raios · ${fmt(result.elapsedMs, 0)} ms · revisão ${revision}`
                : 'Aguardando cálculo da configuração atual'}
            </span>
          </div>
          <div className="metrics">
            <div className="metric">
              <span>{realMode ? 'Fração recebida' : 'Fração aceita pelo modelo ideal'}</span>
              <strong>{result ? pct(result.received) : '—'}</strong>
              <small>
                {result
                  ? `${fmt(result.receivedCount, 0)} de ${fmt(result.launched, 0)} raios na tela`
                  : 'Recalcule para obter resultados'}
              </small>
            </div>
            <div className="metric">
              <span>Conjugado paraxial</span>
              <strong data-testid="conjugate">
                {conjugate.status === 'real' || conjugate.status === 'virtual'
                  ? `${fmt(conjugate.distanceMm)} mm`
                  : conjugate.status === 'infinite'
                    ? '∞'
                    : '—'}
              </strong>
              <small>
                {conjugate.status === 'real'
                  ? 'Após a última face / lente'
                  : conjugate.status === 'virtual'
                    ? 'Imagem virtual · sem tela real'
                    : 'reason' in conjugate
                      ? conjugate.reason
                      : ''}
              </small>
            </div>
            <div className="metric">
              <span>Magnificação paraxial</span>
              <strong data-testid="magnification">
                {conjugate.status === 'real' || conjugate.status === 'virtual'
                  ? `${fmt(conjugate.magnification)}×`
                  : '—'}
              </strong>
              <small>
                {(conjugate.status === 'real' || conjugate.status === 'virtual') &&
                conjugate.magnification < 0
                  ? 'Imagem invertida'
                  : 'Conjugação do trecho após o objeto'}
              </small>
            </div>
            <div className="metric">
              <span>Dimensão no conjugado</span>
              <strong className="dimension">
                {(conjugate.status === 'real' || conjugate.status === 'virtual') &&
                object?.aperture.kind === 'rectangle'
                  ? `${fmt(Math.abs(conjugate.magnification) * object.aperture.widthMm)} × ${fmt(Math.abs(conjugate.magnification) * object.aperture.heightMm)} mm`
                  : '—'}
              </strong>
              <small>Largura × altura · estimativa paraxial</small>
            </div>
          </div>
          {(conjugate.status === 'real' || conjugate.status === 'virtual') && (
            <div className="focus-bar">
              <span>
                {conjugate.status === 'virtual'
                  ? 'Imagem virtual; não há posição de tela real.'
                  : Math.abs(conjugate.distanceMm - conjugate.screenDistanceMm) < 0.001
                    ? 'Tela no conjugado paraxial.'
                    : `Tela a ${fmt(conjugate.screenDistanceMm)} mm; conjugado a ${fmt(conjugate.distanceMm)} mm. Desfoque paraxial: ${fmt(conjugate.screenDistanceMm - conjugate.distanceMm)} mm.`}
              </span>
              <button disabled={conjugate.status !== 'real'} onClick={focusScreen}>
                Posicionar tela no conjugado →
              </button>
            </div>
          )}
          {result?.paraxialWarning && (
            <div className="warning">
              Raios aceitos com inclinação &gt; 0,1 rad: fora do regime paraxial heurístico. O
              modelo ideal não prevê eficiência real nem aberração de lentes físicas.
            </div>
          )}
          <div className="panel analysis-panel">
            <div className="tabs" role="tablist" aria-label="Análises">
              {[
                ['screen', 'Tela / fluxo'],
                ['footprint', 'Footprint'],
                ['spots', 'Manchas de pontos'],
                ['loss', 'Perdas'],
                ['paraxial', 'Paraxial'],
                ['aberration', 'Aberração'],
              ].map(([id, label]) => (
                <button
                  role="tab"
                  aria-selected={tab === id}
                  className={tab === id ? 'active' : ''}
                  key={id}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            {tab === 'paraxial' ? (
              <div className="analysis-copy">
                <h3>Conjugação do objeto selecionado</h3>
                <p>
                  Objeto: {object?.label ?? 'nenhum'}. O trecho antes do objeto ilumina a fenda e
                  não entra nessa matriz.
                </p>
                {conjugate.status === 'real' || conjugate.status === 'virtual' ? (
                  <>
                    <pre>
                      M = [
                      {conjugate.matrix
                        .slice(0, 2)
                        .map((n) => fmt(n, 8))
                        .join('   ')}
                      ]<br /> [
                      {conjugate.matrix
                        .slice(2)
                        .map((n) => fmt(n, 8))
                        .join('   ')}
                      ]
                    </pre>
                    <p>
                      Estado (y, nθ), referência:{' '}
                      {project.surfaces.find((s) => s.id === conjugate.referenceSurfaceId)?.label}.
                      Meio de saída n = {fmt(conjugate.outputIndex, 8)}.
                    </p>
                    <p>
                      EFL = {fmt(conjugate.eflMm)} mm · BFL = {fmt(conjugate.bflMm)} mm. EFL e BFL
                      têm referências diferentes.
                    </p>
                  </>
                ) : (
                  <p>{'reason' in conjugate ? conjugate.reason : ''}</p>
                )}
                <p>
                  Somente trechos centrados, sem espelhos ou lentes inclinadas. Foco paraxial e
                  menor mancha real podem diferir.
                </p>
              </div>
            ) : !result ? (
              <div className="empty-analysis">
                {workerState === 'calculando'
                  ? 'Calculando a configuração atual…'
                  : 'Execute o cálculo para ver esta análise.'}
              </div>
            ) : tab === 'loss' ? (
              <div className="loss-content">
                <div className="analysis-toolbar">
                  <p>
                    Fluxos como porcentagem da emissão considerada. Incidente e transmitido também
                    permitem comparar perdas locais.
                  </p>
                  <button onClick={exportCsv}>Exportar CSV</button>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Superfície</th>
                        <th>Incidente</th>
                        <th>Recorte</th>
                        <th>Fresnel</th>
                        <th>Espelho</th>
                        <th>Transmitido</th>
                        <th>Outros</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.surfaceFlows.map((f) => (
                        <tr key={f.id}>
                          <td>{project.surfaces.find((s) => s.id === f.id)?.label}</td>
                          <td>{pct(f.incident)}</td>
                          <td title={`Local: ${pct(f.incident ? f.blocked / f.incident : 0)}`}>
                            {pct(f.blocked)}
                          </td>
                          <td title={`Local: ${pct(f.incident ? f.fresnel / f.incident : 0)}`}>
                            {pct(f.fresnel)}
                          </td>
                          <td>{pct(f.mirrorAbsorption)}</td>
                          <td>{pct(f.transmitted)}</td>
                          <td>{pct(f.missed + f.other)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="energy-summary">
                  {Object.entries(result.energy).map(([name, weight]) => (
                    <span key={name}>
                      {
                        (
                          {
                            received: 'Recebido',
                            outside_detector: 'Fora da tela',
                            blocked_aperture: 'Bloqueado',
                            missed_surface: 'Perdeu superfície',
                            tir: 'TIR',
                            unsupported_direction: 'Direção não suportada',
                            numerical_failure: 'Falha numérica',
                            fresnel: 'Fresnel',
                            mirror_absorption: 'Perda no espelho',
                          } as Record<string, string>
                        )[name]
                      }
                      : <b>{pct(weight)}</b>
                    </span>
                  ))}
                </div>
                <p>
                  Balanço: {pct(Object.values(result.energy).reduce((a, b) => a + b, 0))}. Falhas
                  numéricas são contabilizadas separadamente de vinhetamento.
                </p>
              </div>
            ) : tab === 'aberration' ? (
              <div className="analysis-copy">
                <h3>Intercepto transversal meridional</h3>
                {!realMode ? (
                  <p>Aberração real indisponível no modo de lentes finas ideais.</p>
                ) : !result.aberration.length ? (
                  <p>Selecione uma máscara como objeto para analisar um ponto no eixo.</p>
                ) : (
                  <>
                    <p>
                      Ponto central do objeto, alvo na primeira abertura posterior. Intercepto y na
                      tela; valores ausentes são raios bloqueados. Não é MTF, Strehl ou resolução
                      difrativa.
                    </p>
                    <svg
                      className="aberration-plot"
                      viewBox="0 0 700 220"
                      aria-label="Curva de aberração transversal"
                    >
                      <path d="M40 110H680 M350 20V200" stroke="#536579" fill="none" />
                      {result.aberration.map((p, i) =>
                        p.interceptMm !== null ? (
                          <circle
                            key={i}
                            cx={
                              350 +
                              (p.heightMm /
                                (Math.max(...result.aberration.map((p) => Math.abs(p.heightMm))) ||
                                  1)) *
                                300
                            }
                            cy={
                              110 -
                              (p.interceptMm /
                                (Math.max(
                                  ...result.aberration.map((p) => Math.abs(p.interceptMm ?? 0)),
                                ) || 1)) *
                                90
                            }
                            r="3"
                            fill="#79e4cf"
                          />
                        ) : null,
                      )}
                    </svg>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Altura de alvo (mm)</th>
                            <th>Intercepto y (mm)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.aberration
                            .filter((_, i) => i % 4 === 0)
                            .map((p, i) => (
                              <tr key={i}>
                                <td>{fmt(p.heightMm, 6)}</td>
                                <td>{fmt(p.interceptMm, 6)}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="map-analysis">
                <div>
                  {tab === 'footprint' && (
                    <label className="map-select">
                      Superfície{' '}
                      <select
                        aria-label="Superfície do footprint"
                        data-footprint
                        value={project.analysis.footprintSurfaceId}
                        onChange={(e) =>
                          edit((p) => {
                            p.analysis.footprintSurfaceId = e.target.value;
                          })
                        }
                      >
                        {project.surfaces.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <MapCanvas
                    result={result}
                    system={system}
                    footprintSurfaceId={project.analysis.footprintSurfaceId}
                    kind={tab as 'screen' | 'footprint' | 'spots'}
                  />
                </div>
                <div className="analysis-copy">
                  {tab === 'screen' ? (
                    <>
                      <div className="eyebrow">ILUMINAÇÃO DA FONTE</div>
                      <h3>Distribuição na tela</h3>
                      <p>
                        Histograma de fluxo por área. Cores normalizadas pelo pico, sem suavização.
                        A cor mais clara não representa eficiência.
                      </p>
                      <dl>
                        <dt>Fluxo recebido / emissão considerada</dt>
                        <dd>{pct(result.received)}</dd>
                        <dt>Fração geométrica · mesmos raios</dt>
                        <dd>{pct(result.geometricReceived)}</dd>
                        <dt>Erro padrão amostral do fluxo</dt>
                        <dd>
                          {result.receivedCount
                            ? pct(result.standardError)
                            : 'Sem chegadas; ausência de fluxo não demonstrada.'}
                        </dd>
                        <dt>Grade / área do pixel</dt>
                        <dd>
                          {result.gridWidth} × {result.gridHeight} / {fmt(result.pixelAreaMm2, 6)}{' '}
                          mm²
                        </dd>
                        <dt>Pico do mapa</dt>
                        <dd>
                          {fmt(
                            result.grid.reduce((peak, n) => Math.max(peak, n), 0),
                            8,
                          )}{' '}
                          da emissão/mm²
                        </dd>
                      </dl>
                      <small>
                        Sem absorção no volume, difração, revestimentos ou luz parasita. O caminho é
                        obrigatório: raio que perde um elemento termina.
                      </small>
                    </>
                  ) : tab === 'footprint' ? (
                    <>
                      <div className="eyebrow">COORDENADAS LOCAIS</div>
                      <h3>Onde o feixe encontra a face</h3>
                      <p>
                        Antes do recorte: verde = aceito, coral = fora da abertura. Raios perdidos
                        antes desta superfície não aparecem aqui.
                      </p>
                      <p>
                        {fmt(result.footprint.length / 3, 0)} pontos exibidos
                        {result.footprintTruncated
                          ? ' · limitado aos primeiros 6.000 encontros'
                          : ''}
                        . Em faces curvas, x/y são projeções transversais.
                      </p>
                      <p>Em caminhos dobrados, o mapa acompanha o referencial da superfície.</p>
                    </>
                  ) : (
                    <>
                      <div className="eyebrow">IMAGEM / DIAGNÓSTICO GEOMÉTRICO</div>
                      <h3>Um ponto de cada vez</h3>
                      <p>
                        Centro e bordas do objeto, com amostragem uniforme explícita da primeira
                        abertura posterior. Sem pesos de iluminação; não é PSF difrativa nem
                        eficiência do LED.
                      </p>
                      {result.spots.length ? (
                        result.spots.map((s, i) => (
                          <div className="spot-stats" key={i}>
                            <b>
                              Ponto ({fmt(s.objectPoint.x)}, {fmt(s.objectPoint.y)}) mm
                            </b>
                            <p>
                              {s.received}/{s.launched} sobreviventes
                              {s.received < 30 ? ' · amostragem insuficiente para concluir' : ''}
                              <br />
                              Centroide: ({fmt(s.centroid?.x, 6)}, {fmt(s.centroid?.y, 6)}) mm
                              <br />
                              RMS: {fmt(s.rmsMm, 6)} mm · R50: {fmt(s.r50Mm, 6)} mm · R80:{' '}
                              {fmt(s.r80Mm, 6)} mm
                            </p>
                          </div>
                        ))
                      ) : (
                        <p>Marque uma máscara como plano objeto na tabela.</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
        <footer className="footer">
          <span>xamez / óptica geométrica sequencial</span>
          <span>
            {realMode
              ? 'Superfícies planas e esféricas · uma wavelength'
              : 'Parâmetros de diâmetro e altura do exemplo são assumidos'}{' '}
            · uso local
          </span>
        </footer>
      </main>
      {jsonOpen && (
        <div className="modal-backdrop">
          <section
            className="modal json-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="json-title"
          >
            <div className="panel-heading">
              <h2 id="json-title">Projeto JSON</h2>
              <button onClick={() => setJsonOpen(false)} aria-label="Fechar editor JSON">
                ×
              </button>
            </div>
            <p>
              Validação completa antes de aplicar. Campos desconhecidos e versões futuras são
              rejeitados; preserve seu arquivo original.
            </p>
            <textarea
              aria-label="Documento JSON"
              value={json}
              onChange={(e) => setJson(e.target.value)}
              spellCheck={false}
            />
            {errors.length > 0 && (
              <div role="alert" className="json-errors">
                {errors.slice(0, 5).map((e, i) => (
                  <div key={i}>
                    {e.path}: {e.message}
                  </div>
                ))}
              </div>
            )}
            <div className="modal-actions">
              <button onClick={() => setJson(serializeProject(project))}>
                Repor projeto atual
              </button>
              <button onClick={() => setJsonOpen(false)}>Cancelar</button>
              <button className="primary" onClick={() => importText(json)}>
                Validar e aplicar
              </button>
            </div>
          </section>
        </div>
      )}
      {wizard && (
        <div className="modal-backdrop">
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="lens-title">
            <div className="panel-heading">
              <h2 id="lens-title">Adicionar lente real</h2>
              <button onClick={() => setWizard(false)} aria-label="Fechar assistente">
                ×
              </button>
            </div>
            <p>
              Duas faces editáveis e um corpo rígido. Valores iniciais demonstrativos; use as
              dimensões da lente medida. Plano = raio 0 neste assistente.
            </p>
            <div className="two-fields">
              {(
                [
                  ['front', 'Raio frontal (mm)'],
                  ['back', 'Raio traseiro (mm)'],
                  ['thickness', 'Espessura central (mm)'],
                  ['diameter', 'Diâmetro (mm)'],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label}>
                  <NumberField
                    label={label}
                    value={lens[key]}
                    onCommit={(n) => setLens((l) => ({ ...l, [key]: n }))}
                  />
                </Field>
              ))}
            </div>
            <Field label="Vidro">
              <select
                aria-label="Vidro da nova lente"
                value={lens.material}
                onChange={(e) => setLens((l) => ({ ...l, material: e.target.value }))}
              >
                {['N-BK7', 'SF1', 'SF2'].map((id) => (
                  <option key={id}>{id}</option>
                ))}
              </select>
            </Field>
            {errors.length > 0 && (
              <div role="alert">
                {errors.map((e, i) => (
                  <p key={i}>{e.message}</p>
                ))}
              </div>
            )}
            <div className="modal-actions">
              <button onClick={() => setWizard(false)}>Cancelar</button>
              <button className="primary" onClick={addLens}>
                Criar duas superfícies
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
function pMaterial(project: Project, id: string) {
  return project.materials[id]?.label ?? materialCatalog[id]?.label ?? id;
}
