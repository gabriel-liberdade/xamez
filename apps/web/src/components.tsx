import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  apertureRadius,
  localPoint,
  sag,
  worldPoint,
  v,
  type BatchResult,
  type System,
  type Trace,
} from '@xamez/optics-core';
export const fmt = (n: number | null | undefined, digits = 3) =>
  n === null || n === undefined
    ? '—'
    : n.toLocaleString('pt-BR', { maximumFractionDigits: digits });
export function NumberField({
  value,
  onCommit,
  label,
  step = 'any',
  disabled = false,
}: {
  value: number;
  onCommit: (n: number) => void;
  label: string;
  step?: number | 'any';
  disabled?: boolean;
}) {
  const [text, setText] = useState(String(value)),
    [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setText(String(Number(value.toPrecision(12))));
    setInvalid(false);
  }, [value]);
  const commit = () => {
    const n = Number(text.trim().replace(',', '.'));
    if (text.trim() === '' || !Number.isFinite(n)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (n !== value) onCommit(n);
  };
  return (
    <input
      className={invalid ? 'invalid' : ''}
      aria-label={label}
      aria-invalid={invalid}
      inputMode="decimal"
      value={text}
      disabled={disabled}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setText(String(value));
          setInvalid(false);
        }
      }}
      data-step={step}
    />
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Diagram({
  system,
  paths,
  selectedId,
  onSelect,
  onMoveScreen,
  axis,
}: {
  system: System;
  paths: Trace[];
  selectedId: string;
  onSelect: (id: string) => void;
  onMoveScreen: (gap: number) => void;
  axis: 'x' | 'y';
}) {
  const projected = paths.some((trace) =>
    trace.path.some((p) => Math.abs(p[axis === 'y' ? 'x' : 'y']) > 1e-8),
  );
  const canvas = useRef<HTMLCanvasElement>(null),
    view = useRef({ scale: 1, x0: 0, y0: 0 }),
    [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 }),
    drag = useRef<{
      x: number;
      y: number;
      panX: number;
      panY: number;
      screen: boolean;
      gap: number;
    } | null>(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext('2d')!;
    const w = 1100,
      h = 360;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#101c28';
    ctx.fillRect(0, 0, w, h);
    const surfaces = system.surfaces,
      source =
        system.source.kind === 'point'
          ? system.source.positionMm
          : v(0, 0, system.source.launchPlaneZMm);
    const bounds = [
      source,
      ...surfaces.flatMap((s) => {
        const r =
          s.aperture.kind === 'circle'
            ? s.aperture.radiusMm
            : (axis === 'y' ? s.aperture.heightMm : s.aperture.widthMm) / 2;
        return [-r, r].map((t) => worldPoint(s.frame, axis === 'y' ? v(0, t, 0) : v(t, 0, 0)));
      }),
    ];
    const minZ = Math.min(...bounds.map((p) => p.z)),
      maxZ = Math.max(...bounds.map((p) => p.z)),
      minY = Math.min(...bounds.map((p) => p[axis])),
      maxY = Math.max(...bounds.map((p) => p[axis]));
    const scale =
        Math.min((w - 120) / Math.max(maxZ - minZ, 10), (h - 100) / Math.max(maxY - minY, 10)) *
        zoom,
      x0 = (w - (maxZ + minZ) * scale) / 2 + pan.x,
      y0 = (h + (maxY + minY) * scale) / 2 + pan.y;
    view.current = { scale, x0, y0 };
    const xy = (p: { z: number; x: number; y: number }) => [x0 + p.z * scale, y0 - p[axis] * scale];
    const line = (points: { x: number; y: number; z: number }[], color: string, width = 1) => {
      ctx.beginPath();
      points.forEach((p, i) => {
        const [x, y] = xy(p);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    };
    const targetStep = 70 / scale;
    const baseStep = 10 ** Math.floor(Math.log10(targetStep));
    const ratio = targetStep / baseStep;
    const gridStep = baseStep * (ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 5 ? 5 : 10);
    ctx.font = '11px system-ui';
    ctx.fillStyle = '#647b91';
    for (
      let z = Math.floor(-x0 / scale / gridStep) * gridStep;
      z < (w - x0) / scale;
      z += gridStep
    ) {
      const x = x0 + z * scale;
      ctx.strokeStyle = '#203040';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      ctx.fillText(fmt(z, 1), x + 4, h - 12);
    }
    for (
      let y = Math.floor((y0 - h) / scale / gridStep) * gridStep;
      y < y0 / scale;
      y += gridStep
    ) {
      const py = y0 - y * scale;
      ctx.strokeStyle = '#203040';
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(w, py);
      ctx.stroke();
    }
    line([source, ...surfaces.map((s) => s.frame.origin)], '#536579', 1.5);
    for (const path of paths) {
      line(
        path.path,
        path.termination === 'received' ? '#f6bb56aa' : '#f6bb5638',
        path.termination === 'received' ? 1.4 : 1,
      );
      if (path.termination !== 'received' && path.hits.length) {
        const [x, y] = xy(path.path.at(-1)!);
        ctx.fillStyle = '#ed7e6b';
        ctx.fillRect(x - 2, y - 2, 4, 4);
      }
    }
    surfaces.forEach((s, index) => {
      const r =
        s.aperture.kind === 'circle'
          ? s.aperture.radiusMm
          : (axis === 'y' ? s.aperture.heightMm : s.aperture.widthMm) / 2;
      const points = Array.from({ length: 65 }, (_, i) => {
        const t = ((2 * i) / 64 - 1) * r,
          z = s.kind === 'interface' ? sag(s.shape, Math.abs(t)) : 0;
        return worldPoint(s.frame, axis === 'y' ? v(0, t, z) : v(t, 0, z));
      });
      const selected = s.id === selectedId;
      line(
        points,
        selected
          ? '#79e4cf'
          : s.kind === 'detector'
            ? '#79e4cf'
            : s.kind === 'mirror'
              ? '#c2b6ff'
              : '#a0b7cf',
        selected ? 3 : 2,
      );
      const [x, y] = xy(s.frame.origin);
      ctx.fillStyle = selected ? '#79e4cf' : '#9aafc2';
      ctx.font = '11px system-ui';
      ctx.fillText(`${index + 1}`, x + 7, Math.max(18, Math.min(h - 24, y - r * scale - 13)));
      if (s.kind === 'thin-lens') {
        for (const t of [-r, r]) {
          const [px, py] = xy(worldPoint(s.frame, axis === 'y' ? v(0, t, 0) : v(t, 0, 0)));
          ctx.beginPath();
          ctx.moveTo(px - 5, py + (t > 0 ? 6 : -6));
          ctx.lineTo(px, py);
          ctx.lineTo(px + 5, py + (t > 0 ? 6 : -6));
          ctx.strokeStyle = '#a0b7cf';
          ctx.stroke();
        }
      }
    });
    const [sx, sy] = xy(source);
    ctx.fillStyle = '#f6bb56';
    ctx.beginPath();
    ctx.arc(sx, sy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9aafc2';
    ctx.fillText('fonte', sx + 8, sy + 18);
    ctx.fillText(`z (mm) →   ${axis} (mm) ↑`, w - 155, 24);
  }, [system, paths, selectedId, axis, zoom, pan]);
  return (
    <div className="diagram">
      <canvas
        ref={canvas}
        width={1100}
        height={360}
        aria-label={`${projected ? 'Projeção dos raios' : 'Traçado meridional'} no plano ${axis.toUpperCase()}Z`}
        onPointerDown={(e) => {
          const el = e.currentTarget,
            rect = el.getBoundingClientRect(),
            x = ((e.clientX - rect.left) * 1100) / rect.width,
            y = ((e.clientY - rect.top) * 360) / rect.height,
            { scale, x0, y0 } = view.current;
          const hits = system.surfaces
            .map((s) => ({
              s,
              d: Math.hypot(
                x - (x0 + s.frame.origin.z * scale),
                y - (y0 - s.frame.origin[axis] * scale),
              ),
            }))
            .sort((a, b) => a.d - b.d);
          const hit = hits[0];
          if (hit.d < 30) onSelect(hit.s.id);
          drag.current = {
            x,
            y,
            panX: pan.x,
            panY: pan.y,
            screen: hit.d < 30 && hit.s.kind === 'detector',
            gap: system.surfaces.at(-2)?.gapAfterMm ?? 0,
          };
          el.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.screen) return;
          const rect = e.currentTarget.getBoundingClientRect();
          setPan({
            x: d.panX + ((e.clientX - rect.left) * 1100) / rect.width - d.x,
            y: d.panY + ((e.clientY - rect.top) * 360) / rect.height - d.y,
          });
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          if (d?.screen) {
            const rect = e.currentTarget.getBoundingClientRect(),
              dx = ((e.clientX - rect.left) * 1100) / rect.width - d.x,
              dy = ((e.clientY - rect.top) * 360) / rect.height - d.y,
              k = system.surfaces.at(-1)!.frame.basis[2],
              den = k.z * k.z + k[axis] * k[axis];
            if (den > 1e-8 && Math.hypot(dx, dy) > 3)
              onMoveScreen(d.gap + (dx * k.z - dy * k[axis]) / (view.current.scale * den));
          }
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      />
      <div className="diagram-tools">
        <button aria-label="Reduzir zoom" onClick={() => setZoom((z) => Math.max(0.25, z / 1.25))}>
          −
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          Ajustar
        </button>
        <button aria-label="Aumentar zoom" onClick={() => setZoom((z) => Math.min(8, z * 1.25))}>
          +
        </button>
      </div>
      <div className="legend">
        <span>
          <i className="ray-dot" />
          {projected ? 'Projeção de raios fora do corte' : 'Raios meridionais ilustrativos'}
        </span>
        <span>
          <i className="stop-dot" />
          Primeiro término / bloqueio
        </span>
        <span>Arraste o fundo ou o centro da tela</span>
      </div>
    </div>
  );
}
export function MapCanvas({
  result,
  system,
  kind,
  footprintSurfaceId,
}: {
  result: BatchResult;
  system: System;
  footprintSurfaceId: string;
  kind: 'screen' | 'footprint' | 'spots';
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    [log, setLog] = useState(false);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext('2d')!;
    const w = 500,
      h = 340;
    ctx.fillStyle = '#101c28';
    ctx.fillRect(0, 0, w, h);
    const screen = system.surfaces.at(-1)!,
      selected = system.surfaces.find((s) => s.id === footprintSurfaceId) ?? screen;
    const surface = kind === 'footprint' ? selected : screen;
    const a = surface.aperture,
      bw = a.kind === 'rectangle' ? a.widthMm : 2 * a.radiusMm,
      bh = a.kind === 'rectangle' ? a.heightMm : 2 * a.radiusMm;
    let plotWidth = bw,
      plotHeight = bh;
    if (kind === 'footprint') {
      // Include the pre-aperture hits, including rejected rays far outside it.
      for (let i = 0; i < result.footprint.length; i += 3) {
        plotWidth = Math.max(plotWidth, 2.1 * Math.abs(result.footprint[i]));
        plotHeight = Math.max(plotHeight, 2.1 * Math.abs(result.footprint[i + 1]));
      }
    }
    const scale = Math.min((w - 70) / plotWidth, (h - 70) / plotHeight),
      cx = w / 2,
      cy = h / 2;
    ctx.strokeStyle = '#4c657d';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      cx - (plotWidth * scale) / 2,
      cy - (plotHeight * scale) / 2,
      plotWidth * scale,
      plotHeight * scale,
    );
    ctx.beginPath();
    ctx.moveTo(cx, 25);
    ctx.lineTo(cx, h - 25);
    ctx.moveTo(25, cy);
    ctx.lineTo(w - 25, cy);
    ctx.stroke();
    if (kind === 'screen') {
      const gw = result.gridWidth,
        gh = result.gridHeight,
        max = result.grid.reduce((a, b) => Math.max(a, b), 0),
        image = document.createElement('canvas');
      image.width = gw;
      image.height = gh;
      const ic = image.getContext('2d')!,
        pixels = ic.createImageData(gw, gh);
      for (let i = 0; i < result.grid.length; i++) {
        const t = max
          ? log
            ? Math.log1p((1000 * result.grid[i]) / max) / Math.log1p(1000)
            : result.grid[i] / max
          : 0;
        pixels.data[i * 4] = Math.round(20 + 235 * t);
        pixels.data[i * 4 + 1] = Math.round(32 + 174 * Math.sqrt(t));
        pixels.data[i * 4 + 2] = Math.round(45 + 55 * t);
        pixels.data[i * 4 + 3] = 255;
      }
      ic.putImageData(pixels, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.save();
      ctx.translate(cx - (bw * scale) / 2, cy + (bh * scale) / 2);
      ctx.scale(1, -1);
      ctx.drawImage(image, 0, 0, bw * scale, bh * scale);
      ctx.restore();
      if (!result.receivedCount) {
        ctx.fillStyle = '#a0b7cf';
        ctx.font = '14px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('Amostragem sem chegadas', cx, cy);
      }
    } else {
      const points =
        kind === 'footprint'
          ? [{ points: result.footprint, stride: 3, color: '#79e4cf' }]
          : result.spots.map((s, i) => ({
              points: s.points,
              stride: 2,
              color: ['#79e4cf', '#f6bb56', '#c2b6ff'][i % 3],
            }));
      for (const set of points)
        for (let i = 0; i < set.points.length; i += set.stride) {
          const x = cx + set.points[i] * scale,
            y = cy - set.points[i + 1] * scale;
          ctx.fillStyle = kind === 'footprint' && set.points[i + 2] === 0 ? '#ed7e6b' : set.color;
          if (x >= 20 && x < w - 20 && y >= 20 && y < h - 20) ctx.fillRect(x - 1, y - 1, 2, 2);
        }
      ctx.strokeStyle = '#7c93ac';
      ctx.beginPath();
      if (a.kind === 'circle') ctx.arc(cx, cy, a.radiusMm * scale, 0, Math.PI * 2);
      else ctx.rect(cx - (bw * scale) / 2, cy - (bh * scale) / 2, bw * scale, bh * scale);
      ctx.stroke();
    }
    ctx.fillStyle = '#9aafc2';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`x: ±${fmt(plotWidth / 2)} mm`, cx, h - 10);
    ctx.save();
    ctx.translate(14, cy);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`y: ±${fmt(plotHeight / 2)} mm`, 0, 0);
    ctx.restore();
  }, [result, system, kind, log, footprintSurfaceId]);
  return (
    <div>
      <canvas
        className="map"
        ref={canvas}
        width={500}
        height={340}
        aria-label={
          kind === 'screen'
            ? 'Mapa de fluxo relativo na tela'
            : kind === 'footprint'
              ? 'Footprint local antes do recorte'
              : 'Manchas de pontos do objeto'
        }
      />
      {kind === 'screen' && (
        <label className="check">
          <input type="checkbox" checked={log} onChange={(e) => setLog(e.target.checked)} /> Escala
          logarítmica de visualização
        </label>
      )}
    </div>
  );
}
