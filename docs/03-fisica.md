# Contrato físico e numérico

As seções de eixo reto são o caso base. Referenciais locais, espelhos e inclinação seguem docs/08; o modo aproximado separado segue docs/09. Estas convenções são obrigatórias para o motor e seus testes. Mudanças exigem atualizar arquivos e referências de teste.

## 1. Coordenadas, unidades e superfícies

Sistema destro (x,y,z), propagação nominal +z, comprimentos em mm, comprimento de onda de entrada em nm, ângulos internos em radianos. Direções são vetores unitários. No caso base, toda superfície está centrada em x=y=0 e tem vértice `zv`. No caso geral suportado, calcular interseções no referencial local da superfície.

Raio R positivo: centro da esfera em `zv + R`; negativo: centro à esquerda. Plano é um tipo explícito, nunca Infinity ou R=0. Uma biconvexa usual no sentido +z possui R1>0 e R2<0.

Calota: `z(r) = zv + c*r² / (1 + sqrt(1-c²*r²))`, com `c=1/R` e `r²=x²+y²`. A expressão evita subtração de números próximos. Exigir raio útil menor que |R|, com margem para evitar tangente singular. A esfera completa não é a superfície óptica.

Interseção do raio `p+t*d`: resolver a quadrática da esfera de forma estável; avaliar raízes positivas, verificar resíduo e pertencimento à calota do vértice. Não escolher cegamente a menor raiz da esfera. Separar interseção da calota matemática do teste de abertura para registrar bloqueios corretamente. Se não houver raiz na calota, terminar como `missed_surface`.

Plano: `t=(zv-p.z)/d.z`; direção quase paralela retorna diagnóstico definido. Tolerâncias têm dimensão explícita e escalam com a geometria; não usar um único epsilon para mm, produto escalar e discriminante. Evitar avançar artificialmente o ponto por um grande epsilon. O índice da superfície já impede reinterseção da mesma superfície.

## 2. Validação da montagem

Vértices crescentes não bastam. Calotas podem se cruzar nas bordas. Antes do traçado, verificar espessura positiva de material e separação entre elementos em toda a região radial comum relevante, usando os perfis de sag e seus extremos; para esferas centradas, analisar derivadas/extremos ou limites certificados. Não confiar só em poucos pontos de amostragem.

Abertura circular usa raio; retangular usa largura/altura totais. Uma interface possui abertura útil e, quando relevante, limite mecânico do elemento. Na primeira versão, ambos podem coincidir. A sequência define um caminho obrigatório: o raio que perde uma lente não contorna seu corpo para alcançar a próxima. Termina como perda do caminho prescrito. Isso precisa estar declarado na UI/ajuda ao interpretar “aproveitamento”. Não há carcaça mecânica completa ou luz parasita.

Máscaras são planos opacos fora da abertura, transparentes dentro, sem potência óptica. Fenda é uma máscara retangular que também pode ser marcada como plano objeto. Tela é um plano receptor finito terminal.

Não permitir interfaces coincidentes; cimentação é uma única interface vidro→vidro. Espessura nula é rejeitada inicialmente. Se futuramente houver necessidade de máscara exatamente sobre interface, definir evento composto, não contornar o teste com epsilon.

## 3. Refração e energia

Orientar normal unitária N contra direção incidente d: `ci=-dot(N,d)>=0`. Com `eta=n1/n2`, calcular `k=1-eta²*(1-ci²)`.

- k negativo além da tolerância: reflexão interna total, término `tir`.
- k ligeiramente negativo por arredondamento: clamp em zero.
- direção transmitida: `dt = eta*d + (eta*ci-sqrt(k))*N`.

Verificar norma e finitude; não normalizar vetores inválidos silenciosamente. No caso reto, se dt.z não aponta para o caminho sequencial suportado, terminar `unsupported_direction`. No sistema dobrado nunca testar z global: usar o referencial local e a interseção futura conforme docs/08. Não mudar a ordem das superfícies automaticamente.

Refletância não polarizada em interface sem revestimento:

`Rs=((n1*ci-n2*ct)/(n1*ci+n2*ct))²`

`Rp=((n2*ci-n1*ct)/(n2*ci+n1*ct))²`

`F=(Rs+Rp)/2`; `w_transmitido=w_incidente*(1-F)`.

Aqui w é fluxo transportado por um pacote de raios; não é radiância de um integrador de imagem. Não inserir fator eta² adicional no peso de fluxo. Para n1=n2, transmitir diretamente, inclusive no limite rasante. Acumular peso refletido como perda não seguida. TIR perde todo o peso restante para o caminho transmitido. Não traçar ramos parasitas refletidos. Espelho intencional segue a reflexão única especificada em docs/08.

Modo `ideal` ignora Fresnel para diagnóstico geométrico; modo `fresnel-uncoated` inclui essas perdas. Sempre rotular. Absorção volumétrica e revestimentos ficam fora do início; “fração transmitida” representa apenas os mecanismos implementados.

Cada raio termina exatamente uma vez: `received`, `outside_detector`, `blocked_aperture`, `missed_surface`, `tir`, `unsupported_direction` ou `numerical_failure`. Perdas parciais Fresnel são eventos anteriores ao término. Não classificar falha numérica como vinhetamento.

## 4. Vidros

Sellmeier: `n²(λ)=1+Σ Bi*λ²/(λ²-Ci)`, λ em micrômetros, Ci em µm². Guardar faixa de validade e fonte dos coeficientes. Rejeitar comprimentos de onda fora da faixa declarada; não extrapolar silenciosamente. Ar inicial pode ser `n=1` como aproximação explicitamente identificada.

N-BK7, SF1 e SF2 são IDs exatos. Não substituir SF1 por N-SF1 nem SF2 por N-SF2. Verificar dados e nomenclatura do vidro realmente usado. Dados de catálogo devem ser confrontados com índices tabulados em pelo menos três comprimentos de onda antes de liberar o preset. Índice constante é útil para testes e demonstrações; não deve se passar por uma implementação espectral do vidro comercial.

## 5. Fontes e significado de 120°

Fonte no infinito é um feixe paralelo com direção e região de lançamento finita, definida por disco/retângulo no plano anterior ao sistema. A região define o denominador de fluxo; não existe potência total de uma onda plana infinita. Para direção angular, especificar `dx/dz=tan(ax)`, `dy/dz=tan(ay)` e normalizar `(tan(ax),tan(ay),1)`.

LED pontual no MVP; emissor retangular uniforme em área é extensão opcional. Ambos orientados no eixo de lançamento. O padrão escolhido para o usuário é cone uniforme com ângulo TOTAL de 120° (semiângulo 60°), identificado como aproximação sem datasheet. Oferecer Lambertiano como alternativa. Modelo angular avançado opcional: intensidade `I(theta) ∝ cos(theta)^m`, no hemisfério frontal. Se Φ for o **ângulo total de meia intensidade**, `m=log(0.5)/log(cos(Φ/2))`. Φ=120° dá m=1 (Lambertiano). Esse modelo é uma aproximação configurável, não uma propriedade de todo LED.

“Ângulo total FWHM” e “cone de corte” são parâmetros diferentes. Para m=1, metade da intensidade a 60° não significa ausência de luz além de 60°. Cone uniforme é um modelo separado, explicitamente selecionado. Não inferir o modelo só de um número do datasheet.

Amostragem do lobo completo, u,v uniformes em [0,1): `cos(theta)=(1-u)^(1/(m+1))`, `phi=2*pi*v`. Direção `(sin(theta)*cos(phi),sin(theta)*sin(phi),cos(theta))`. Cada amostra tem peso inicial 1/N se a distribuição coincide com a emissão normalizada. Emissor retangular exige mais duas dimensões de amostragem uniformes em área. Não multiplicar de novo o peso pelo cosseno.

Começar por amostragem pseudoaleatória determinística com algoritmo e seed versionados. Não usar Math.random. Pode-se adicionar estratificação depois, com testes. Disparo direto ao primeiro elemento/importance sampling fica posterior: exige PDF e correção de peso; condicionar a amostragem aos raios que passam sem corrigir faria a eficiência aumentar artificialmente.

Fluxo absoluto, distribuição medida, encapsulamento e espectro não são inferidos do ângulo do LED.

## 6. Análises distintas

**Iluminação:** traçar a fonte real por todas as superfícies. Histograma na tela é fluxo recebido por área de pixel, normalizado pela emissão considerada. Unidade recomendada: fração emitida/mm². Exibir também mapa normalizado pelo pico como visualização, sem chamá-lo eficiência. Pixels não atingidos têm zero; se nenhum raio chegar, métricas condicionais são indisponíveis.

**Imagem do objeto:** selecionar plano da fenda; analisar apenas o trecho óptico posterior. Para manchas, lançar raios diagnósticos de um ponto escolhido do objeto para uma amostragem explícita da primeira abertura posterior e propagar. São raios geométricos com pesos diagnósticos iguais, não pacotes da iluminação real. Declarar essa amostragem e o número sobrevivente; uma pupila real mais rigorosa pode ser adicionada depois. O resultado não é eficiência de emissão nem PSF difrativa.

Uma fenda iluminada pode formar imagem extensa; o RMS de todos os raios da fenda mede tamanho da imagem, não a aberração de um ponto. Por isso a aba de mancha trabalha com pontos individuais, centro e bordas. Mostra centroide, RMS em mm e raios 50%/80% de energia ou de peso diagnóstico, devidamente identificados. Amostra insuficiente invalida conclusão.

**Footprint:** coordenadas x,y na superfície escolhida, antes/depois do recorte claramente diferenciadas. Para superfícies curvas são coordenadas transversais projetadas, não distâncias geodésicas. Exibir abertura, pontos aceitos e rejeitados; o footprint não pode inventar interseções para raios que já morreram a montante.

**Perdas:** tabela por superfície com fluxo incidente, bloqueado, refletido e transmitido; percentual local e percentual da emissão inicial. Tela fora de área e raios que perdem calota são classes separadas. “Fração geométrica recebida” versus “fração recebida com Fresnel” usa os mesmos raios de origem, não duas sementes independentes.

**Aberração simples:** curva de intercepto transversal de raios meridionais versus altura de lançamento e mancha de ponto. Pode adicionar foco longitudinal para raios simétricos. Não apresentar RMS como Strehl, MTF ou resolução visual garantida.

## 7. Paraxial, conjugados e magnificação

Este solver escalar é válido para o trecho centrado. Não aplicar automaticamente a lentes inclinadas; o comportamento nessa situação está em docs/08.

Usar estado `(y,q)` com `q=n*theta`. Translação de distância d no meio n: `T=[[1,d/n],[0,1]]`. Refração de raio R: `S=[[1,0],[-(n2-n1)/R,1]]`; plano tem potência zero. Multiplicar na ordem física, nova matriz à esquerda. Determinante deve ser 1, dentro da tolerância.

Se M=[[A,B],[C,D]] liga plano objeto ao plano de referência de saída (depois da última interface), prolongar por s no meio de saída nout. Condição de imagem: `B+(s/nout)*D=0`. Logo `s=-nout*B/D`, magnificação `m=A+(s/nout)*C`. Para |D| próximo de zero, conjugado é infinito, sem grande número fingindo distância finita. s<0 indica imagem virtual, não uma tela que intercepta raios reais.

Para entrada colimada no eixo, distância focal traseira a partir do plano de saída é `BFL=-nout*A/C`. Distância focal efetiva traseira `EFL=-nout/C`. C≈0 caracteriza sistema afocal. Não confundir BFL com EFL nem medir EFL a partir do vértice. O meio e plano de referência devem constar no resultado. Emissão no infinito e análise de objeto finito são modos diferentes do solver.

A lente fina em ar oferece ajuda didática: `1/f=1/so+1/si`, `m=-si/so`, com distâncias positivas para objeto/imagem reais. Para sistema espesso, calcular com matrizes/plano principal, não usar distância ao vidro como distância à lente fina. Tamanho previsto = |m| × tamanho do objeto; mostrar inversão pelo sinal.

Botão “Posicionar tela no conjugado” aplica a posição real somente se estiver no domínio válido e após ação explícita do usuário. O cálculo não muda a montagem escondido. Foco de menor RMS real, se implementado, é busca limitada no último meio, com os mesmos raios diagnósticos e domínio informado; divergência/não existência retorna estado definido. Não otimizar foco excluindo raios progressivamente por uma tela menor.

## 8. Limites numéricos e estatísticos

Uma simulação sem raio recebido não prova fluxo exatamente nulo. Mostrar contagem/amostragem e permitir refinamento. Em lançamentos independentes de peso inicial igual, a incerteza da fração recebida pode usar a variância das contribuições por raio (incluindo zeros), dividida por N; não usar erro binomial sem ajuste para pesos Fresnel. Para dados correlacionados/estratificados, usar replicações independentes ou declarar ausência de intervalo.

A uniformidade exige região de interesse definida, incluindo pixels vazios, resolução do histograma e amostra suficientes. Começar com média e desvio padrão/coeficiente de variação dentro da região, sem um escore arbitrário. Subamostragem não deve ser suavizada visualmente até parecer convergência.
