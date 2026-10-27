# Estado da entrega — 2026-10-23

O repositório tinha documentação e dois JSONs de proposta, sem aplicativo. A entrega implementa o MVP local previsto nas etapas 0–6. Os contratos físicos originais foram preservados; os dados e limites efetivamente suportados estão registrados abaixo.

## Implementado

| Etapa | Entrega concreta |
|---|---|
| 0 | Workspace npm/TypeScript, React/Vite, versões fixas, lockfile, build e scripts reais. |
| 1 | Uniões discriminadas, JSON Schema, validação semântica, campos desconhecidos rejeitados, matrizes (y,nθ), materiais constantes e Sellmeier, compilação de referenciais. |
| 2 | Interseções estáveis de plano/calota, abertura separada da interseção, Snell vetorial, Fresnel, TIR, classificação de términos e balanço de fluxo. |
| 3 | Editor em português, assistente de lente de duas faces, máscaras/fenda, LED ou colimada, λ, dois cortes com leques próprios, mapa quantitativo, footprint, manchas por ponto, intercepto meridional, conjugação, magnificação, JSON, histórico, autosave recuperável e Worker cancelável. |
| 4 | Exemplo do usuário em modo de lentes finas ideal separado, suposições visíveis, larguras rápidas, altura livre, tela inicialmente a 90 mm, botão explícito de conjugado. |
| 5 | Espelho plano de ramo único, referencial nominal após dobra, refletância, rotação rígida de lente em x e teste conservador de folga. |
| 6 | Seis exemplos, testes analíticos e de navegador, CI, benchmark, documentação e capturas de interface. |

O núcleo não importa React, DOM, Worker ou o formato serializado. `project-format` valida o arquivo e resolve os materiais/frames para o núcleo. A UI recebe somente respostas da revisão, configuração e pedido atuais. Resultados antigos não são usados durante uma mudança óptica. Trocar viewport/aba não dispara traçado; selecionar outra superfície de footprint dispara captura nova.

## Evidência executada

- **77 testes unitários** aprovados, em Vitest: Snell normal/oblíquo, índices iguais/rasante, ângulo crítico e TIR, placa paralela, sinais de R e seleção de calota, tangência, propagação, borda inclusiva, escalas 0,001×/1×/1000×, matriz espessa, convergência de raios reais ao limite paraxial, fontes, integração do mapa e conservação de fluxo, aumento de abertura, cancelamento, espelhos, rotação global, lente/placa inclinada, validação, schema, materiais e descarte de respostas antigas. Cada exemplo adicional também passa por validação e balanço de energia.
- **13 testes Playwright** no Chromium: edição da fenda, vírgula decimal, undo, posicionamento explícito da tela, export/import, rejeição de versão futura, criação de lente SF2 e alteração de raio, espelho/placa, abas, cancelamento/refinamento, autosave, uso sem rede após carga, geometria inválida, viewport de 390 px e recuperação após falha de carregamento do Worker. A carga inicial também foi testada com destinos externos bloqueados. A revisão da UI acrescenta navegação contextual sem recalcular, foco/teclado nos diálogos, edição contextual móvel e arraste da tela após redimensionamento.
- **Build de produção e TypeScript** aprovados. Build carregado no Chromium sem erros de página nem solicitações externas. Os assets são locais.
- **Formatação** aprovada e `npm audit` sem vulnerabilidades reportadas no momento da entrega, inclusive nas dependências de desenvolvimento.
- Capturas inspecionadas: [exploração por focais](screenshots/exploration-desktop.png), [foco real](screenshots/real-focus-desktop.png), [móvel](screenshots/mobile.png). Capturas servem para legibilidade; os oráculos analíticos sustentam a correção física.

## Oráculos de referência

Lente espessa sintética n=1,5, R1=+50 mm, R2=−50 mm, espessura 5 mm:

```text
M = [29/30, 10/3; -59/3000, 29/30]
EFL = 3000/59 mm
BFL = 2900/59 mm
Objeto a 100 mm: imagem a 100 mm da última face; m = -1.
```

Exemplo por focais do usuário, após a fenda: objeto a 15 mm, f=14 mm → imagem ideal a 210 mm e m=−14. A fenda assumida 0,3 × 1 mm corresponde a 4,2 × 14 mm **no conjugado**, não na tela inicial a 90 mm. A condensadora isolada f=8 com objeto a 2 mm tem conjugado virtual −8/3 mm. Estes são testes do modelo ideal, sem inferir o comportamento de lentes reais ainda não medidas.

Os três vidros comerciais foram confrontados com três índices tabulados SCHOTT cada. Fontes, transcrição e tolerância: [dados de materiais](material-data/README.md). O preset usa os nomes exatos SF1/SF2, sem trocar pelos tipos com prefixo N.

## Desempenho medido

Detalhes reproduzíveis em [benchmark.json](benchmark.json), gerado por `npm run benchmark`.

Máquina: Linux x64, Node v24.19.0, AMD EPYC 9V74, 3 CPUs lógicas disponíveis ao ambiente, ~9,73 GiB de memória. Dez medições após dois aquecimentos. Fixture de 18 interfaces planas refrativas + máscara + detector; todos os raios percorrem as 20 superfícies. Caminhos completos limitados; mapa/footprint acumulados.

| Raios × superfícies | Mediana | p95 observado |
|---|---:|---:|
| 200 × 20 | 4,71 ms | 8,66 ms |
| 100.000 × 20 | 608,53 ms | 631,63 ms |

Maior heap total observado no processo do caso de 100 mil: ~35,34 MiB. Isso inclui runtime e objetos dos ensaios; não é uma medição isolada da memória retida pelo motor. O benchmark síncrono Node não mede transferências/renderização nem garante desempenho de dispositivos móveis ou de todas as geometrias. A UI usa Worker com cessão de execução a cada 1.024 raios; prévia até 5.000 e refinamento configurável.

## Domínio e limites concretos

- Comprimentos em mm, λ em nm, direções unitárias; escala de bancada. Dimensões/gaps positivos a partir de 10⁻⁶ mm, módulos de R/f a partir de 10⁻⁶ mm, magnitudes de campos dimensionais limitadas a 10⁶ mm. Esses limites evitam entradas subnormais e alocações indefinidas; não são uma garantia de precisão em qualquer combinação extrema.
- No máximo 100 superfícies, 100 materiais, 1 milhão de raios de iluminação, 10.000 raios por ponto diagnóstico, 9 pontos, grade de até 512×512, arquivo de até 2 MB. Até 6.000 encontros são mostrados no footprint; a acumulação quantitativa continua completa. O enquadramento do footprint inclui os encontros rejeitados fora da abertura. Trajetórias ilustrativas dividem o limite de captura entre os cortes YZ e XZ.
- Fonte física centrada, pontual ou colimada. Fonte de área não foi implementada. Cone uniforme e cosseno elevado são distribuições separadas; FWHM 120° no segundo é Lambertiano, sem corte em 60°.
- Superfícies refrativas/lentes finas têm abertura circular; máscaras circular/retangular; detector terminal retangular. A borda é inclusiva com tolerância de arredondamento. Sem interfaces coincidentes ou espessura nula.
- Lente inclinada tem duas faces consecutivas num grupo rígido; inclinação somente em x, de −80° a +80°, sem descentralização independente. y diferente de zero é rejeitado. Os gaps posteriores mantêm significado nominal.
- No eixo reto, separação de calotas centradas é certificada pelos extremos da diferença monotônica de sag, sem teste esparso de bordas. Para corpos inclinados ou montagens dobradas, bolas envolventes disjuntas certificam separação. Se se sobrepõem, o projeto é rejeitado como `CLEARANCE_UNVERIFIED`, mesmo que uma análise mecânica mais precisa pudesse liberá-lo. Não há refinamento por volumes exatos nesta versão.
- O solver paraxial não atende trechos com dobra ou inclinação posterior ao objeto. Um espelho anterior ao objeto não invalida um trecho posterior reto em seu próprio referencial; há teste desse caso. Não há magnificação escalar fictícia de lentes inclinadas.
- As manchas são de pontos individuais e lançamento uniforme na primeira abertura posterior, sem representar uma pupila física exata. A quantidade sobrevivente acompanha RMS/R50/R80. Elas não medem fluxo do LED nem uma PSF difrativa.
- Histograma contém fração considerada/mm², incluindo pixels vazios. As cores têm normalização pelo pico (opcionalmente logarítmica), sem suavização. Não há métrica de uniformidade/ROI, MTF, Strehl, foco por menor RMS ou otimização automática.
- O erro padrão usa contribuições de pacotes por raio, incluindo zeros e perdas Fresnel. Nenhuma chegada não demonstra fluxo exatamente zero; a UI informa a amostragem e permite refinar.
- Cancelamento é cooperativo nos blocos de iluminação; a finalização de mapas/leques e análises de pontos é uma fase síncrona no Worker. A revisão/pedido continuam impedindo que uma resposta obsoleta substitua a configuração atual. O thread principal não executa traçado quantitativo.
- O pacote compilado precisa ser servido por HTTP local. Sem PWA/service worker, instalador desktop ou hospedagem publicada. Não há serviço obrigatório nem consulta externa no uso.

## Continuação

O uso do MVP não depende de novas respostas. Para representar fielmente as lentes físicas do usuário, ainda são necessárias curvaturas (ou desenho do fabricante), espessuras, diâmetros úteis, vidro, orientação da plano-convexa e referência mecânica das distâncias. Esses dados alimentariam um segundo projeto em superfícies reais; o exemplo ideal é preservado.

Melhorias futuras independentes: teste de folga mecânica mais preciso e ROI de uniformidade com critério explícito de suficiência amostral. Nenhuma dessas extensões altera as hipóteses do MVP ou exige inventar medidas das lentes.

A interface foi reorganizada em painéis contextuais, abas de montagem/análises e diálogos com foco e teclado. Detalhes: [docs/11-interface.md](11-interface.md).
