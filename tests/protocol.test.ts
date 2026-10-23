import { it, expect } from 'vitest';
import { configurationKey, isCurrentResponse } from '../apps/web/src/protocol';
import example from '../examples/user-system.paraxial.proposed.json';
import { validateProject } from '@xamez/project-format';
it('descarta resposta atrasada por revisão, pedido e configuração', () => {
  const current = { revision: 8, requestId: 15, configurationKey: 'abcd' };
  expect(isCurrentResponse({ ...current }, current)).toBe(true);
  for (const changed of [{ revision: 7 }, { requestId: 14 }, { configurationKey: 'efgh' }])
    expect(isCurrentResponse({ ...current, ...changed }, current)).toBe(false);
});
it('assinatura acompanha configuração óptica e amostragem', () => {
  const r = validateProject(example);
  if (!r.ok) throw Error('Fixture');
  const p = r.project,
    a = configurationKey(p);
  expect(configurationKey(structuredClone(p))).toBe(a);
  p.surfaces[0].gapAfterMm = 5;
  expect(configurationKey(p)).not.toBe(a);
  const b = configurationKey(p);
  p.sampling.seed++;
  expect(configurationKey(p)).not.toBe(b);
});
