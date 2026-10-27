# Xamez

Simulador óptico sequencial local para iluminação, projeção de fenda e spot. MVP implementado em TypeScript/React, com cálculo vetorial 3D e apresentação 2D em português. Não requer backend, conta ou serviço externo.

## Rodar

**Primeiro teste no Linux Mint:** siga o [passo a passo para instalar, abrir e atualizar](docs/12-linux-mint.md). Não é necessário conhecer programação nem instalar Python. O app atual ainda não é um pacote .deb/AppImage.

Requer **Node.js 22.12+** (validado com Node 24) e npm.

```bash
npm ci
npm run dev
```

Abra http://localhost:5173. A instalação precisa de acesso ao registro npm; o uso normal e os cálculos funcionam sem internet, com o servidor local em execução. O aplicativo não depende de fontes, CDNs ou APIs externas. Não há service worker/PWA para abrir o app sem um servidor local.

Para compilar e abrir a versão de produção somente no próprio computador:

```bash
npm start
```

Abra http://127.0.0.1:4173. A versão recomendada do Node está em `.nvmrc` (24). Os arquivos compilados ficam em `apps/web/dist` e podem ser servidos por qualquer servidor de arquivos estáticos. Não abra `index.html` por `file://`: o navegador precisa servir os módulos e o Worker por HTTP local.

## Experimentar

O seletor **Experimento** carrega seis projetos reproduzíveis:

- **Seu sistema por focais:** LED → 2 mm → f=8 → 4 mm → fenda → 15 mm → f=14 → 90 mm → anteparo. Modo ideal separado, com hipóteses visíveis. A tela permanece a 90 mm; o conjugado ideal é 210 mm e a magnificação −14. Use o botão para posicionar a tela explicitamente no conjugado.
- **Fenda por superfícies reais:** lente sintética de vidro artificial n=1,5, R=±50 mm e espessura 5 mm. Conjugado paraxial a 100 mm, m=−1; o traçado real mostra aberração.
- **Foco de feixe colimado:** lente esférica e tela no BFL paraxial; permite ver o foco e sua distribuição real.
- **Vinhetamento:** mesmo projeto de fenda com abertura reduzida para comparar perdas.
- **Espelho:** dobra de 90° e detector no referencial de saída.
- **Placa inclinada:** duas faces rotacionadas rigidamente; feixe emerge paralelo e deslocado.

A área **Montagem** contém a tabela; **Análises** reúne os seis diagnósticos. Na lateral, **Elemento** mostra apenas as propriedades da seleção, e **Fonte** concentra iluminação e física. O resumo de luz, conjugado, magnificação e tamanho continua visível nos dois modos. **Hipóteses e descrição** mantém as suposições do exemplo acessíveis.

Selecione uma linha para editar sua abertura, vidro ou inclinação. A tabela permite alterar raios/focais e gaps. A fenda oferece larguras 0,1 / 0,3 / 0,5 / 1 mm e altura livre. Campos numéricos aceitam vírgula decimal; confirme com Enter ou saindo do campo. Arraste o fundo do desenho para navegar e o centro da tela para mover o trecho final. O leque desenhado é ilustrativo; as porcentagens usam uma amostragem 3D independente.

**Prévia:** até 5.000 raios após editar. **Refinar:** quantidade configurada, inicialmente 100.000. Cálculos rodam num Worker, com cancelamento entre blocos e descarte de respostas antigas. As análises mostram fluxo, footprint antes do recorte, manchas por ponto, matriz/conjugação, intercepto meridional e perdas por superfície.

**Salvar projeto** exporta JSON com materiais embutidos. **Projeto → Importar JSON** e **Projeto → Editar JSON** passam pelo mesmo validador; entradas inválidas preservam o último projeto válido. Há desfazer/refazer, autosave recuperável e exportação CSV das perdas com metadados de execução. Ctrl/Cmd+Z desfaz fora de campos de texto; Shift+Ctrl/Cmd+Z refaz.

## Verificar

```bash
npm test                 # 77 testes: física, geometria, formato, fontes e revisões
npm run build            # TypeScript + bundle de produção
npm run format:check
npm run test:e2e          # fluxos reais no Chromium
npm run benchmark        # mede e grava docs/benchmark.json
npm run schema           # regenera o JSON Schema publicado
```

O Playwright usa `/usr/bin/chromium` por padrão. Se necessário, instale seu Chromium e informe `CHROMIUM_PATH`; para usar o navegador gerenciado pelo Playwright:

```bash
npx playwright install chromium
CHROMIUM_PATH="$(node --input-type=module -e "import {chromium} from '@playwright/test'; process.stdout.write(chromium.executablePath())")" npm run test:e2e
```

Há CI para testes unitários, formatação, build e integração no navegador. A evidência e os limites da entrega estão em [docs/10-entrega.md](docs/10-entrega.md). As decisões da interface estão em [docs/11-interface.md](docs/11-interface.md).

## Modelos e limites

**Superfícies reais:** planos/calotas esféricas, Snell vetorial, Fresnel não polarizado opcional, máscaras, espelho plano e inclinação rígida em x. N-BK7, SF1 e SF2 têm coeficientes rastreáveis e testes contra três índices SCHOTT por vidro; SF1/SF2 não são substituídos por N-SF1/N-SF2. Os coeficientes são copiados para o projeto, sem consulta à rede durante o uso.

**Exploração por lentes finas:** modo ideal em ar, separado de interfaces reais. Focal não determina curvaturas ou dimensões físicas. O cone de 120° é exploratório, sem datasheet; ângulos grandes geram aviso de aproximação. A fração aceita por esse modo não é previsão de eficiência de lentes reais.

O sistema segue uma sequência obrigatória: raios que perdem um elemento terminam. Não há raios parasitas, difração, interferência, absorção volumétrica, revestimentos, fonte estendida, otimização ou modelo de olho. A primeira implementação de folga mecânica para corpos inclinados/dobrados é conservadora e pode rejeitar uma montagem como “folga não verificada”. O solver paraxial escalar fica indisponível quando o trecho do objeto à saída contém espelho ou inclinação. Não foi inferida geometria para as lentes do usuário.

## Organização

```text
apps/web/                 React, Canvas, editor, protocolo e Web Worker
packages/optics-core/     matemática, superfícies, Snell, fontes, análises puras
packages/project-format/ tipos, JSON Schema, validação, compilação, materiais
examples/                seis projetos JSON reproduzíveis
tests/                   oráculos analíticos, invariantes e Playwright
scripts/                 geração de schema e benchmark
docs/                    contratos, origem dos dados e estado da entrega
```

A especificação original permanece em [Produto](docs/01-produto.md), [Arquitetura](docs/02-arquitetura.md), [Física](docs/03-fisica.md), [Formato](docs/04-formato.md), [Validação](docs/05-validacao.md), [Roteiro](docs/06-handoff-sol.md), [Referências](docs/07-referencias.md), [Referenciais](docs/08-referenciais.md) e [Sistema do usuário](docs/09-sistema-exemplo.md). Os trechos que descrevem a implementação no futuro registram o planejamento original; [Estado da entrega](docs/10-entrega.md) descreve o aplicativo atual. Os nomes `*.proposed.json` dos dois fixtures originais foram mantidos para preservar os links.

Sobre instaláveis e a diferença entre linguagem, recursos e precisão: [docs/13-desktop-e-confiabilidade.md](docs/13-desktop-e-confiabilidade.md).
