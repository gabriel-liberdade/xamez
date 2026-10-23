import type { Project } from '@xamez/project-format';
import type { BatchResult } from '@xamez/optics-core';
export type RunTag = {
  revision: number;
  requestId: number;
  configurationKey: string;
};
export type WorkerRequest = ({ type: 'run'; project: Project } & RunTag) | { type: 'cancel' };
export type WorkerResponse = (
  | { type: 'result'; result: BatchResult }
  | { type: 'progress'; fraction: number }
  | { type: 'error'; message: string }
) &
  RunTag;
export function configurationKey(p: Project): string {
  const text = JSON.stringify(p);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}
export function isCurrentResponse(response: RunTag, current: RunTag): boolean {
  return (
    response.requestId === current.requestId &&
    response.revision === current.revision &&
    response.configurationKey === current.configurationKey
  );
}
