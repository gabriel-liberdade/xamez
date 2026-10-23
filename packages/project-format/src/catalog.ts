import type { Material } from '@xamez/optics-core';
const provenance = {
  reference: 'SCHOTT Zemax catalog 2017-01-20b; refractiveindex.info (CC0)',
  url: 'https://refractiveindex.info/download/data/2017/schott_2017-01-20b.agf',
  retrievedOn: '2026-10-23',
  note: 'Coeficientes SCHOTT para o nome exato. Índices comparados com três linhas do datasheet SCHOTT arquivado. Sem absorção volumétrica ou revestimento.',
};
export const materialCatalog: Record<string, Material> = {
  'air-ideal': {
    model: 'constant',
    n: 1,
    label: 'Ar ideal',
    provenance: { reference: 'Aproximação explícita n=1' },
  },
  'N-BK7': {
    model: 'sellmeier3',
    label: 'N-BK7',
    b: [1.03961212, 0.231792344, 1.01046945],
    cUm2: [0.00600069867, 0.0200179144, 103.560653],
    validWavelengthNm: [300, 2500],
    provenance,
  },
  SF1: {
    model: 'sellmeier3',
    label: 'SF1',
    b: [1.55912923, 0.284246288, 0.968842926],
    cUm2: [0.0121481001, 0.0534549042, 112.174809],
    validWavelengthNm: [350, 2500],
    provenance,
  },
  SF2: {
    model: 'sellmeier3',
    label: 'SF2',
    b: [1.40301821, 0.231767504, 0.939056586],
    cUm2: [0.0105795466, 0.0493226978, 112.405955],
    validWavelengthNm: [350, 2500],
    provenance,
  },
};
