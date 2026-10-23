/// <reference lib="webworker" />
import { traceBatchAsync } from '@xamez/optics-core';
import { compileProject, validateProject } from '@xamez/project-format';
import type { WorkerRequest, WorkerResponse } from './protocol';
const scope = self as unknown as DedicatedWorkerGlobalScope;
let generation = 0;
scope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data,
    token = ++generation;
  if (message.type === 'cancel') return;
  const { revision, requestId, configurationKey } = message,
    tag = { revision, requestId, configurationKey };
  const send = (value: WorkerResponse, transfer: Transferable[] = []) =>
    scope.postMessage(value, transfer);
  try {
    const validation = validateProject(message.project);
    if (!validation.ok)
      throw new Error(validation.diagnostics.map((d) => `${d.path}: ${d.message}`).join('\n'));
    const p = validation.project;
    const result = await traceBatchAsync(compileProject(p), p.sampling, p.analysis, {
      cancelled: () => generation !== token,
      yield: () => new Promise((resolve) => setTimeout(resolve, 0)),
      progress: (fraction) => send({ ...tag, type: 'progress', fraction }),
    });
    if (!result || generation !== token) return;
    const transfer = [
      result.grid.buffer,
      result.footprint.buffer,
      ...result.spots.map((s) => s.points.buffer),
    ] as ArrayBuffer[];
    send({ ...tag, type: 'result', result }, transfer);
  } catch (error) {
    if (generation === token)
      send({
        ...tag,
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
  }
};
