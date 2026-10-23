import type { Project } from '@xamez/project-format';
import { materialCatalog } from '@xamez/project-format';
import { fmt } from './components';
export const labels: Record<string, string> = {
  'thin-lens': 'Lente fina',
  interface: 'Interface',
  mask: 'Máscara',
  detector: 'Tela',
  mirror: 'Espelho',
};
export const pct = (n: number) => `${fmt(100 * n, 4)}%`;
export function pMaterial(project: Project, id: string) {
  return project.materials[id]?.label ?? materialCatalog[id]?.label ?? id;
}
