import type { Project } from '@xamez/project-format';
import type { System, BatchResult, Conjugate } from '@xamez/optics-core';
import { MapCanvas, fmt } from './components';
import { Tabs, type ProjectEdit } from './ui';
import { pct } from './project-ui';
export function AnalysisPanel({
  project,
  system,
  result,
  conjugate,
  tab,
  setTab,
  edit,
  exportCsv,
  workerState,
}: {
  project: Project;
  system: System;
  result: BatchResult | null;
  conjugate: Conjugate;
  tab: string;
  setTab: (tab: string) => void;
  edit: ProjectEdit;
  exportCsv: () => void;
  workerState: string;
}) {
  const realMode = project.modelKind === 'real-surfaces';
  const object = project.surfaces.find((s) => s.id === project.analysis.objectSurfaceId);
  return (
    <div className="panel analysis-panel">
      <Tabs
        id="analysis"
        label="Tipo de análise"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'screen', label: 'Tela / fluxo' },
          { id: 'footprint', label: 'Footprint' },
          { id: 'spots', label: 'Manchas de pontos' },
          { id: 'loss', label: 'Perdas' },
          { id: 'paraxial', label: 'Paraxial' },
          { id: 'aberration', label: 'Aberração' },
        ]}
      />
      <div role="tabpanel" id={`analysis-${tab}-panel`} aria-labelledby={`analysis-${tab}-tab`}>
        {tab === 'paraxial' ? (
          <div className="analysis-copy">
            <h3>Conjugação do objeto selecionado</h3>
            <p>
              Objeto: {object?.label ?? 'nenhum'}. O trecho antes do objeto ilumina a fenda e não
              entra nessa matriz.
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
                  {project.surfaces.find((s) => s.id === conjugate.referenceSurfaceId)?.label}. Meio
                  de saída n = {fmt(conjugate.outputIndex, 8)}.
                </p>
                <p>
                  EFL = {fmt(conjugate.eflMm)} mm · BFL = {fmt(conjugate.bflMm)} mm. EFL e BFL têm
                  referências diferentes.
                </p>
              </>
            ) : (
              <p>{'reason' in conjugate ? conjugate.reason : ''}</p>
            )}
            <p>
              Somente trechos centrados, sem espelhos ou lentes inclinadas. Foco paraxial e menor
              mancha real podem diferir.
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
                    Histograma de fluxo por área. Cores normalizadas pelo pico, sem suavização. A
                    cor mais clara não representa eficiência.
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
                      {result.gridWidth} × {result.gridHeight} / {fmt(result.pixelAreaMm2, 6)} mm²
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
                    Antes do recorte: verde = aceito, coral = fora da abertura. Raios perdidos antes
                    desta superfície não aparecem aqui.
                  </p>
                  <p>
                    {fmt(result.footprint.length / 3, 0)} pontos exibidos
                    {result.footprintTruncated ? ' · limitado aos primeiros 6.000 encontros' : ''}.
                    Em faces curvas, x/y são projeções transversais.
                  </p>
                  <p>Em caminhos dobrados, o mapa acompanha o referencial da superfície.</p>
                </>
              ) : (
                <>
                  <div className="eyebrow">IMAGEM / DIAGNÓSTICO GEOMÉTRICO</div>
                  <h3>Um ponto de cada vez</h3>
                  <p>
                    Centro e bordas do objeto, com amostragem uniforme explícita da primeira
                    abertura posterior. Sem pesos de iluminação; não é PSF difrativa nem eficiência
                    do LED.
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
      </div>{' '}
    </div>
  );
}
