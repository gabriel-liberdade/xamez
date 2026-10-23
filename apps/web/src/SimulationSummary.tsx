import type { Project } from '@xamez/project-format';
import type { BatchResult, Conjugate } from '@xamez/optics-core';
import { fmt } from './components';
import { pct } from './project-ui';
export function SimulationSummary({
  project,
  result,
  conjugate,
  focusScreen,
}: {
  project: Project;
  result: BatchResult | null;
  conjugate: Conjugate;
  focusScreen: () => void;
}) {
  const realMode = project.modelKind === 'real-surfaces';
  const object = project.surfaces.find((s) => s.id === project.analysis.objectSurfaceId);
  return (
    <>
      <div className="metrics" aria-label="Resumo da simulação">
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
          <span>Imagem no conjugado</span>
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
        <details className="warning">
          <summary>
            Modelo ideal fora do regime paraxial <span>Entenda o limite</span>
          </summary>
          <p>
            Raios aceitos com inclinação &gt; 0,1 rad: fora do regime paraxial heurístico. O modelo
            ideal não prevê eficiência real nem aberração de lentes físicas.
          </p>
        </details>
      )}
    </>
  );
}
