import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const ready = async (page: import('@playwright/test').Page) =>
  expect(page.getByTestId('simulation-status')).toHaveText('resultado atualizado', {
    timeout: 20000,
  });
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ready(page);
});
test('sistema informado mantém 90 mm e conjugado 210 / -14; fenda e desfazer', async ({ page }) => {
  await expect(page.getByTestId('conjugate')).toHaveText('210 mm');
  await expect(page.getByTestId('magnification')).toHaveText('-14×');
  await expect(
    page.getByLabel('Gap após Projetora ideal f=14 (plano-convexa informada)', { exact: true }),
  ).toHaveValue('90');
  await page.getByRole('button', { name: '0,5 mm', exact: true }).click();
  await expect(page.getByLabel('Largura (mm)', { exact: true })).toHaveValue('0.5');
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  await expect(page.getByLabel('Largura (mm)', { exact: true })).toHaveValue('0.3');
  await page.getByLabel('Altura (mm)', { exact: true }).fill('2,5');
  await page.getByLabel('Altura (mm)', { exact: true }).press('Enter');
  await expect(page.getByLabel('Altura (mm)', { exact: true })).toHaveValue('2.5');
  await page.getByRole('button', { name: 'Posicionar tela no conjugado →' }).click();
  await expect(
    page.getByLabel('Gap após Projetora ideal f=14 (plano-convexa informada)', { exact: true }),
  ).toHaveValue('210');
  await ready(page);
});
test('exportação e reimportação preservam números e rejeitam versão futura', async ({ page }) => {
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: /Salvar projeto/ }).click();
  const downloaded = await event;
  const p = JSON.parse(readFileSync((await downloaded.path())!, 'utf8'));
  expect(p.surfaces[2].gapAfterMm).toBe(90);
  await page.getByRole('button', { name: 'Editar JSON', exact: true }).click();
  p.schemaVersion = 2;
  await page.getByLabel('Documento JSON').fill(JSON.stringify(p));
  await page.getByRole('button', { name: 'Validar e aplicar', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('schemaVersion');
  p.schemaVersion = 1;
  p.surfaces[1].aperture.widthMm = 0.1;
  await page.getByLabel('Documento JSON').fill(JSON.stringify(p));
  await page.getByRole('button', { name: 'Validar e aplicar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await ready(page);
  await expect(page.getByLabel('Largura (mm)', { exact: true })).toHaveValue('0.1');
});
test('interface real cria lente comercial, altera raio e mantém round trip', async ({ page }) => {
  await page.getByLabel('EXPERIMENTO').selectOption('1');
  await ready(page);
  await page.getByRole('button', { name: '+ Lente', exact: true }).click();
  await page.getByLabel('Vidro da nova lente').selectOption('SF2');
  await page.getByRole('button', { name: 'Criar duas superfícies', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await ready(page);
  await expect(page.getByLabel('Meio posterior', { exact: true })).toHaveValue('SF2');
  await page.getByLabel('Raio de Lente — frente', { exact: true }).fill('60');
  await page.getByLabel('Raio de Lente — frente', { exact: true }).press('Enter');
  await ready(page);
  await page.getByRole('button', { name: 'Editar JSON', exact: true }).click();
  const p = JSON.parse(await page.getByLabel('Documento JSON').inputValue());
  expect(p.surfaces.at(-3).shape.radiusMm).toBe(60);
  expect(p.materials.SF2.model).toBe('sellmeier3');
  expect(p.lensGroups).toHaveLength(2);
});
test('espelho e placa inclinada calculam e tabs funcionam', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.getByLabel('EXPERIMENTO').selectOption('4');
  await ready(page);
  await expect(page.getByText('100%', { exact: true }).first()).toBeVisible();
  await page.getByRole('tab', { name: 'Footprint', exact: true }).click();
  await expect(page.getByLabel('Footprint local antes do recorte')).toBeVisible();
  await page.getByRole('tab', { name: 'Perdas', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Exportar CSV', exact: true })).toBeVisible();
  await page.getByLabel('EXPERIMENTO').selectOption('5');
  await ready(page);
  await expect(page.getByLabel('Inclinação rígida da lente (graus)')).toHaveValue('20');
  await page.getByRole('tab', { name: 'Manchas de pontos', exact: true }).click();
  await expect(page.getByText('Marque uma máscara como plano objeto na tabela.')).toBeVisible();
  expect(errors).toEqual([]);
});
test('cancelar, editar e refinar não aceita revisão antiga', async ({ page }) => {
  await page.getByRole('button', { name: /Refinar ·/ }).click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByTestId('simulation-status')).toHaveText('cálculo cancelado');
  await page.getByRole('button', { name: '0,1 mm', exact: true }).click();
  await page.getByRole('button', { name: '0,5 mm', exact: true }).click();
  await ready(page);
  await expect(page.getByLabel('Largura (mm)', { exact: true })).toHaveValue('0.5');
  await page.getByRole('button', { name: /Refinar ·/ }).click();
  await ready(page);
  await expect(page.getByText(/100.000 raios ·/)).toBeVisible();
});
test('autosave recuperável e uso offline após carregamento', async ({ page, context }) => {
  await page.getByRole('button', { name: '1 mm', exact: true }).click();
  await ready(page);
  await page.reload();
  await ready(page);
  await page.getByRole('button', { name: 'Restaurar sessão', exact: true }).click();
  await ready(page);
  await expect(page.getByLabel('Largura (mm)', { exact: true })).toHaveValue('1');
  await context.setOffline(true);
  await page.getByRole('button', { name: '0,1 mm', exact: true }).click();
  await ready(page);
  await expect(page.getByLabel('Largura (mm)', { exact: true })).toHaveValue('0.1');
});
test('rejeita geometria impossível sem substituir projeto', async ({ page }) => {
  await page.getByLabel('Gap após Fenda — altura 1 mm assumida', { exact: true }).fill('-1');
  await page.getByLabel('Gap após Fenda — altura 1 mm assumida', { exact: true }).press('Enter');
  await expect(page.getByRole('alert')).toContainText('surfaces.1.gapAfterMm');
  await expect(page.getByTestId('conjugate')).toHaveText('210 mm');
});
test('viewport móvel permite editar e analisar sem erro', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '0,5 mm', exact: true }).click();
  await ready(page);
  await page.getByRole('tab', { name: 'Tela / fluxo', exact: true }).click();
  await expect(page.getByLabel('Mapa de fluxo relativo na tela')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('aplicativo carrega sem serviços externos e recupera falha do Worker', async ({
  page,
  context,
}) => {
  const external: string[] = [];
  await context.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === '127.0.0.1' || u.hostname === 'localhost') return route.continue();
    external.push(u.href);
    return route.abort();
  });
  const other = await context.newPage();
  let aborted = false;
  let blockWorker = true;
  await other.route('**/optics.worker.ts*', (route) => {
    if (blockWorker) {
      aborted = true;
      return route.abort();
    }
    return route.continue();
  });
  await other.goto('/');
  await expect(other.getByTestId('simulation-status')).toHaveText('resultado indisponível');
  blockWorker = false;
  await other.getByRole('button', { name: 'Reiniciar cálculo', exact: true }).click();
  await ready(other);
  expect(aborted).toBe(true);
  expect(external).toEqual([]);
  await other.close();
});
