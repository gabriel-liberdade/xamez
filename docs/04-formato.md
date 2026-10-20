# Contrato de arquivo proposto

`examples/slit-projection.proposed.json` é a referência concreta desta proposta. Os campos adicionais de docs/08 e o modo separado de docs/09 fazem parte desta mesma proposta v1, ainda não publicada como formato estável. Implementar JSON Schema e validação semântica na etapa 1; este documento ainda não afirma que um validador executável existe.

## Envelope

- `schemaVersion`: inteiro, inicialmente 1; não confundir com versão do motor.
- `name`, `description`: texto.
- `units`: inicialmente `{length:"mm", wavelength:"nm"}`; outros sistemas rejeitados.
- `wavelengthNm`: número finito positivo, dentro da faixa dos materiais.
- `materials`: mapa de IDs para definições embutidas.
- `initialMediumId`: meio anterior à primeira interface.
- `firstVertexZMm`: posição do primeiro vértice em relação à origem escolhida.
- `source`: união discriminada por `kind`.
- `modelKind`: `real-surfaces` (padrão) ou `paraxial-exploration`.
- `lensGroups`: agrupamento rígido opcional conforme docs/08; obrigatório para inclinar uma lente de múltiplas faces.
- `surfaces`: lista ordenada, com IDs únicos e persistentes.
- `analysis`: configurações de análises e seleção do objeto.
- `sampling`: seed, versão do amostrador, contagens e limites de captura.
- `physics`: modelo de perda (`ideal` ou `fresnel-uncoated`).

Não guardar `z` em cada superfície além das distâncias: `zi=firstVertexZMm+sum(gaps anteriores)`. Essa soma de z aplica-se ao eixo reto. Com espelhos, os frames seguem docs/08. A fonte guarda sua posição independente, anterior a toda a primeira calota. No eixo reto, distância até próxima é de vértice a vértice; não é espessura mínima de borda. Com inclinação, o gap segue a convenção nominal de docs/08.

## Materiais

União:

- `model:"constant"`, `n`, `label`, `provenance`.
- `model:"sellmeier3"`, arrays `b[3]`, `cUm2[3]`, `validWavelengthNm:[min,max]`, `label`, `provenance`.

`provenance` inclui fonte URL ou referência identificável, data de obtenção e observação sobre uso. Catálogo do aplicativo só preenche essas definições; simulação depende da cópia embutida. Material constante artificial é identificado como artificial. Não usar coeficientes inventados para completar os presets solicitados.

## Fontes

- `collimated`: `launchPlaneZMm`, `launchAperture`, `fieldAnglesDeg:{x,y}`. Abertura de lançamento tem centro no eixo; direção é definida por tangentes conforme contrato físico.
- `point`: `positionMm:{x,y,z}`, `angular`.
- `rectangle` (futuro, não obrigatório no MVP): `centerMm:{x,y,z}`, `widthMm`, `heightMm`, `angular`.

Na primeira interface de produto, fontes permanecem centradas x=y=0; os campos explícitos evitam geometria implícita. Validador inicial rejeita valores fora da restrição centrada da versão. A análise de pontos do objeto pode usar posições fora do eixo sem mover elementos.

`angular`:

- `model:"cosine-power"`, `fullWidthHalfMaxDeg` em (0,180), sem cone de corte implícito.
- `model:"uniform-cone"`, `halfAngleDeg` em (0,90); distribuição uniforme por ângulo sólido dentro do cone.

A relação m/FWHM é derivada, não persistir os dois. No cone uniforme, amostrar cos(theta) uniformemente entre cos(halfAngle) e 1.

## Superfícies

Comuns: `id`, `label`, `kind`, `aperture`, `gapAfterMm`.

- `kind:"interface"`: `shape:{kind:"plane"}` ou `shape:{kind:"sphere",radiusMm}`, `mediumAfterId`.
- `kind:"mask"`: plano, não altera o meio; abertura circular ou retangular.
- `kind:"detector"`: plano retangular terminal; `gapAfterMm:null`.

Abertura: `{kind:"circle",radiusMm}` ou `{kind:"rectangle",widthMm,heightMm}`. Máscaras aceitam ambas; interfaces inicialmente apenas círculo; detector apenas retângulo. Geometria e domínio rejeitam combinações não implementadas. Valores de diâmetro da UI são convertidos para raio explicitamente.

Espelho plano acrescenta `kind:"mirror"`, sem troca de meio, conforme docs/08. No modo aproximado há `kind:"thin-lens"` conforme docs/09. Há exatamente um detector, no fim; os demais gaps são positivos e finitos. Plano objeto é referenciado em `analysis.objectSurfaceId`, que deve apontar para uma máscara. Nenhum plano é simultaneamente fonte física implícita e objeto sem configuração da análise. Um elemento de fonte→fenda continua fazendo parte da iluminação, mas não do cálculo da conjugação da fenda.

## Análise e resultados

`analysis.objectSurfaceId`, `footprintSurfaceId`, `detectorGrid:{width,height}`, `objectProbeFractions`: posições normalizadas dentro da abertura do objeto para manchas; por exemplo `{x:0,y:0}` centro e `{x:0,y:0.9}` próximo à borda. Coordenadas normalizadas de -1 a 1 referem-se às meias dimensões.

Resultados são separados do documento: revision, engineVersion, samplingVersion, seed, contagem lançada, contagem recebida, status, energia por causa, referência de normalização, matrizes e conjugados, dados seletivos de trajetória, mapas e diagnósticos. Cada grandeza derivada informa se é paraxial, geométrica real ou estimativa amostrada.

## Edição assistida por IA

O primeiro fluxo é importar/exportar o JSON completo. IDs estáveis permitem à IA explicar “mude gapAfterMm de lens1-back”. Uma edição de IA passa pela mesma validação e undo que edição manual. Não é necessário um agente embutido ou acesso à rede para isso funcionar.

Importar não executa comandos, não baixa materiais referenciados por URL e não avalia fórmulas. A URL de proveniência é informativa. Campos desconhecidos em versão conhecida geram erro explicativo, evitando perda silenciosa por erro de digitação.
