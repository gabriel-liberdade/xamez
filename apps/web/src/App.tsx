import { useEffect, useMemo, useRef, useState } from 'react';
import { solveConjugate, type BatchResult } from '@xamez/optics-core';
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
import { Diagram, Field, fmt, NumberField } from './components';
import { SourcePanel } from './SourcePanel';
import { ElementPanel } from './ElementPanel';
import { SurfaceTable } from './SurfaceTable';
import { AnalysisPanel } from './AnalysisPanel';
import { SimulationSummary } from './SimulationSummary';
import { Tabs, DisclosureActions, Dialog } from './ui';
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
const AUTOSAVE = 'xamez:autosave:v1';
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
  const [workspaceView, setWorkspaceView] = useState<'assembly' | 'results'>('assembly');
  const [inspector, setInspector] = useState<'element' | 'source'>('element');
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
  function selectElement(id: string, reveal = false) {
    setSelectedId(id);
    setInspector('element');
    if (reveal && window.matchMedia('(max-width:850px)').matches)
      requestAnimationFrame(() =>
        document.getElementById('settings-panel')?.scrollIntoView({ block: 'start' }),
      );
  }
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
    return edit((p) => update(p.surfaces.find((s) => s.id === selected.id)!));
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
      selectElement(r.project.analysis.objectSurfaceId ?? r.project.surfaces[0].id);
      setNotice('Projeto importado e validado.');
    }
  }
  function selectPreset(value: number) {
    const p = presetProject(value);
    replace(p);
    selectElement(p.analysis.objectSurfaceId ?? p.surfaces[0].id);
    setNotice('Exemplo carregado. As alterações anteriores estão no histórico.');
  }
  function changeGap(value: number) {
    return edit((p) => {
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
      selectElement(id);
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
      selectElement(front);
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
      selectElement(first);
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
        <a
          className="brand"
          href="#"
          aria-label="Xamez · bancada óptica"
          onClick={(e) => e.preventDefault()}
        >
          <svg viewBox="0 0 28 28" aria-hidden="true">
            <path d="M3 8h7M3 20h7M18 14h7M12 3c-5 7-5 15 0 22M16 3c5 7 5 15 0 22" />
          </svg>
          <b>xamez</b>
        </a>
        <div className="project-select">
          <label htmlFor="examples">Experimento</label>
          <select id="examples" value="" onChange={(e) => selectPreset(Number(e.target.value))}>
            <option value="" disabled>
              {project.name}
            </option>
            {presets.map((p, i) => (
              <option value={i} key={i}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="top-actions">
          <DisclosureActions label="Projeto">
            <button onClick={() => fileInput.current?.click()}>Importar JSON</button>
            <button
              onClick={() => {
                setJson(serializeProject(project));
                setJsonOpen(true);
              }}
            >
              Editar JSON
            </button>
          </DisclosureActions>
          <button
            className="primary"
            onClick={() => download('xamez-projeto.json', serializeProject(project))}
          >
            Salvar projeto
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
        <h1 className="visually-hidden">Bancada óptica — {project.name}</h1>
        <div className="project-context">
          <details className={`model-note ${realMode ? 'real' : 'ideal'}`}>
            <summary>
              <span className="model-badge">
                {realMode ? 'Superfícies reais' : '≈ Lentes finas · aproximado'}
              </span>
              <span className="assumption-note">
                {realMode
                  ? 'Geometria definida por superfícies'
                  : 'Dimensões demonstrativas; não são medidas das lentes'}
              </span>
              <span className="description-link">Hipóteses e descrição ⌄</span>
            </summary>
            <p>{project.description}</p>
          </details>
          <span className="units-note">mm · nm</span>
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
          <section className="trace-region" aria-label="Bancada óptica">
            <div className="panel">
              <div className="panel-heading">
                <div>
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
                onSelect={selectElement}
                onMoveScreen={changeGap}
                axis={axis}
              />
              <div className="bench-footer">
                <span className="run-metadata">
                  {result
                    ? `${fmt(result.launched, 0)} raios · ${fmt(result.elapsedMs, 0)} ms · revisão ${revision}`
                    : 'Prévia automática ao editar'}
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

            <SimulationSummary
              project={project}
              result={result}
              conjugate={conjugate}
              focusScreen={focusScreen}
            />
          </section>
          <aside
            id="settings-panel"
            className="settings panel"
            aria-label="Configurações do sistema"
          >
            <Tabs
              id="inspector"
              label="Configurações"
              value={inspector}
              onChange={setInspector}
              items={[
                { id: 'element', label: 'Elemento' },
                { id: 'source', label: 'Fonte' },
              ]}
            />
            <div
              role="tabpanel"
              id="inspector-element-panel"
              aria-labelledby="inspector-element-tab"
              hidden={inspector !== 'element'}
            >
              <ElementPanel
                project={project}
                selected={selected}
                selectedIndex={selectedIndex}
                edit={edit}
                editSurface={editSurface}
                changeGap={changeGap}
                move={move}
                duplicate={duplicate}
                deleteSelected={deleteSelected}
              />
            </div>
            <div
              role="tabpanel"
              id="inspector-source-panel"
              aria-labelledby="inspector-source-tab"
              hidden={inspector !== 'source'}
            >
              <SourcePanel project={project} edit={edit} />
            </div>
          </aside>
          <section className="work-region" aria-label="Edição e análises">
            <Tabs
              id="workspace"
              label="Área de trabalho"
              value={workspaceView}
              onChange={setWorkspaceView}
              items={[
                { id: 'assembly', label: 'Montagem' },
                { id: 'results', label: 'Análises' },
              ]}
            />
            <div
              role="tabpanel"
              id="workspace-assembly-panel"
              aria-labelledby="workspace-assembly-tab"
              hidden={workspaceView !== 'assembly'}
            >
              <SurfaceTable
                project={project}
                selectedId={selected.id}
                selectElement={selectElement}
                edit={edit}
                insert={insert}
                undoCount={undo.length}
                redoCount={redo.length}
                undoProject={undoProject}
                redoProject={redoProject}
              />
            </div>
            <div
              role="tabpanel"
              id="workspace-results-panel"
              aria-labelledby="workspace-results-tab"
              hidden={workspaceView !== 'results'}
            >
              <AnalysisPanel
                project={project}
                system={system}
                result={result}
                conjugate={conjugate}
                tab={tab}
                setTab={setTab}
                edit={edit}
                exportCsv={exportCsv}
                workerState={workerState}
              />
            </div>
          </section>
        </div>
        <footer className="footer">
          <span>Óptica geométrica sequencial</span>
          <span>Projetos e cálculos no seu navegador · sem nuvem</span>
        </footer>
      </main>
      {jsonOpen && (
        <Dialog className="json-modal" labelledBy="json-title" onClose={() => setJsonOpen(false)}>
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
            <button onClick={() => setJson(serializeProject(project))}>Repor projeto atual</button>
            <button onClick={() => setJsonOpen(false)}>Cancelar</button>
            <button className="primary" onClick={() => importText(json)}>
              Validar e aplicar
            </button>
          </div>
        </Dialog>
      )}
      {wizard && (
        <Dialog labelledBy="lens-title" onClose={() => setWizard(false)}>
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
        </Dialog>
      )}
    </>
  );
}
