# Referências e decisões

Consultadas na preparação da arquitetura. Fórmulas e convenções operacionais estão fixadas em docs/03; a existência de uma referência não substitui os testes numéricos.

- [Ray Optics Simulation — repositório do projeto indicado pelo usuário](https://github.com/ricktu288/ray-optics): referência de experiência interativa e persistência de cenas. O projeto se apresenta como simulação geométrica 2D. O Xamez propõe editor sequencial e cálculo vetorial 3D com vista 2D. Não foi copiado código nem prometida compatibilidade de JSON.
- [Simulador indicado pelo usuário](https://phydemo.app/ray-optics/simulator/?pt-BR): URL de referência; o conteúdo interativo não foi inspecionado visualmente nesta etapa. As comparações de experiência são intenções de projeto, não uma auditoria das capacidades do aplicativo.
- [SCHOTT — dados e downloads de vidros ópticos](https://www.schott.com/en-gb/products/optical-glass-p1000267/downloads): fonte primária para futura obtenção dos dados de materiais. A página oferece coleções de datasheets e formatos de catálogo óptico. Os coeficientes exatos de N-BK7, SF1 e SF2 ainda não foram extraídos/validados; esta tarefa permanece no roteiro.
- [Edmund Optics — Paraxial Ray Tracing Calculations](https://www.edmundoptics.com/knowledge-center/application-notes/optics/geometrical-optics-101-paraxial-ray-tracing-calculations/): apoio à separação entre aproximação paraxial e traçado geométrico. As convenções matriciais do Xamez usam o estado (y,n*theta) e devem ser testadas nas próprias convenções, sem misturar sinais de outras notações.
- [PBRT — Specular Reflection and Transmission](https://www.pbr-book.org/4ed/Reflection_Models/Specular_Reflection_and_Transmission): referência primária de implementação para Fresnel dielétrico, orientação e reflexão interna total. Xamez transporta fluxo por raio e segue só o ramo transmitido; não transplantar fatores de radiância de um renderizador sem derivação.
- [PBRT — Diffuse Reflection](https://www.pbr-book.org/4ed/Reflection_Models/Diffuse_Reflection): apoio para amostragem cosseno-ponderada e distinção entre distribuição de amostragem e pesos. A generalização cos^m do LED é uma escolha explícita do modelo Xamez, testada por integração analítica.
- [Thorlabs — Mounted LEDs](https://www.thorlabs.us/newgrouppage9.cfm?objectgroup_id=2692&pn=COP4-B): exemplo de fabricante que expressa ângulo de visão como ângulo total na metade do máximo. Isso não identifica o significado de o LED específico do usuário; conferir seu datasheet antes de fixar o parâmetro.

## Decisões principais e alternativas

1. **3D numérico, 2D visual.** Um motor só meridional é menor, mas não mede corretamente coleta de uma cone de luz através de fenda/aberturas bidimensionais (e futuramente fonte de área finita). O custo adicional de vetores 3D é aceito desde o início.
2. **Sequencial de caminho único.** Dispensa busca global de próximos objetos e árvore de reflexões. Limita análise de luz parasita e caminhos que contornam elementos; limites ficam declarados.
3. **Documento de superfícies como fonte de verdade.** Um modelo duplicado de lente e superfícies criaria inconsistências. A lente é assistente de criação/agrupamento visual.
4. **Lançamento físico simples antes de otimização.** Menor coleta em sistemas de pequena abertura pode exigir mais raios. Primeiro validar fluxo; depois considerar importance sampling com PDFs corretas.
5. **Matrizes e traçado real em paralelo.** O modo ideal de exploração com focal conhecida é separado e explicitamente aproximado (docs/09). A matriz explica conjugação rapidamente; o traçado revela efeito de abertura e aberração. Um não é substituto do outro.
6. **Sem catálogo amplo, mas dados rastreáveis.** Três vidros são suficientes; um nome correto com coeficientes incorretos é pior que um material artificial claramente marcado.
7. **Arquitetura antes de dependências.** As respostas do usuário reduziram o MVP para fonte pontual e adicionaram espelho plano/inclinação após o caminho reto. Não foram fixadas versões de bibliotecas nem criado um scaffold que pareça executável. O próximo implementador deve verificar ambiente e lockfile.
