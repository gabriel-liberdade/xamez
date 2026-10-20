# Roteiro fechado de implementação para o 6.1 Sol

O usuário respondeu ao escopo; decisões estão em docs/01. Não reabrir a entrevista inicial. A tarefa do Sol é implementar, não produzir outro plano. Usar [PROMPT-SOL.md](../PROMPT-SOL.md) como entrada. Documentação é especificação, não alegação de que o aplicativo existe.

## Etapa 0 — ambiente

Inspecionar checkout, instruções locais e versões disponíveis. Criar workspace TypeScript com lockfile, scripts reais de desenvolvimento, build e testes. React/Vite para UI, motor puro, Worker para cálculos. Uso normal local/offline; instalação pode precisar de internet. Não adicionar contas/backend.

Se clone novo, criar diretórios de código previstos no README (Git não armazena diretórios vazios). Não reconfigurar ou sobrescrever remoto existente. Repositório confirmado: gabriel-liberdade/xamez.

## Etapa 1 — formato, matrizes e materiais

Tipos discriminados, esquema e validação semântica; números finitos, IDs, gaps, grupos, limite de alocações e terminal. Transformações rígidas no modelo compilado desde o início; identidade no sistema reto. Distinguir `real-surfaces` de `paraxial-exploration`.

Escolher e documentar algoritmo determinístico de amostragem; substituir `to-be-specified-v1` dos exemplos. Matrizes e material constante artificial para testes. Obter e verificar N-BK7, SF1 e SF2 em fonte rastreável; não trocar pelos nomes com prefixo N. Se um preset não puder ser confirmado, informar limitação específica sem travar o restante do aplicativo.

Aceite: fixtures importam/exportam, inválidos apontam campo, matriz de lente espessa confere com docs/05. Publicar schema junto do código, com teste de consistência.

## Etapa 2 — motor de superfícies reais

Planos, calotas esféricas, aberturas, interseção estável, normais, refração vetorial, Fresnel e balanço de fluxo. Um raio, depois lotes. Testar física antes de conectá-la à UI. Separar perda geométrica, Fresnel e falha numérica.

Aceite: casos analíticos de docs/05; incidência normal/oblíqua, TIR, calota correta, placa paralela, simetria, energia e convergência paraxial. Motor não importa DOM/React.

## Etapa 3 — MVP reto completo

Editor de superfícies, assistente de lente de duas faces, máscaras circular e retangular, tela, LED pontual e feixe colimado. Um comprimento de onda. Cone uniforme com controle de ângulo TOTAL; 120° como padrão exploratório, semiângulo 60° mostrado. Lambertiano é alternativa explícita.

Interface em português: corte lateral YZ/XZ, poucos raios visuais, bloqueios identificados, footprint selecionável, mapa de tela e porcentagens. Fenda: altura livre, larguras 0,1 / 0,3 / 0,5 / 1 mm e valor personalizado. Import/export, undo, autosave recuperável, Worker/revision/cancelamento.

Projeção: seleção de plano objeto, matrizes do trecho posterior, conjugado, magnificação, tamanho projetado, estado virtual/afocal. Manchas por ponto e uma curva simples de aberração para superfícies reais. Nenhuma mudança automática de tela; botão explícito para ir ao conjugado.

Aceite: montar uma lente, fechar abertura, localizar perda, analisar fenda, salvar/reabrir; mapa integra para fluxo; resultado obsoleto não substitui revisão atual. Dados comerciais verificados antes de afirmar que os três presets foram entregues.

## Etapa 4 — exemplo do usuário por focal

Modo separado de lentes finas conforme docs/09. Pode ser feito em paralelo lógico com controles do MVP, mas não substitui etapa 2. Carregar `examples/user-system.paraxial.proposed.json`, com parâmetros assumidos visíveis. Os valores conhecidos são focais e distâncias, não raios de curvatura.

Aceite: tela mantém 90 mm; conjugado ideal 210 mm; m=-14; hipótese de fenda de 1 mm gera imagem ideal de 14 mm no conjugado. Ângulos grandes têm aviso de aproximação. Sem apresentar aberração ou porcentagem do modelo ideal como reprodução real do equipamento.

## Etapa 5 — espelho plano e lente inclinada

Implementar docs/08: sequência com dobra, gap no trecho nominal, espelho ideal/configurável, rotação rígida das duas faces e footprint local. Primeiro inclinação em x, no plano YZ; demais eixos só quando implementados/testados. Sem descentralização independente, sem espelho curvo e sem ramos parasitas.

Aceite: espelho 45° dobra 90°, duas reflexões com z global negativo, placa inclinada paralela e balanço de energia. Rejeitar colisões não verificadas de forma explícita. Para trecho inclinado/dobrado, solver escalar indisponível; resultados de traçado continuam válidos dentro do domínio implementado. Não aplicar fórmula centrada silenciosamente.

## Etapa 6 — consolidar entrega

Exemplos de foco, vinhetamento, fenda e espelho; testes de importação e resultado obsoleto; perfil de desempenho numa máquina registrada; build e execução offline depois de instalar. README com comandos reais, limites, suposições e resultados de testes. Capturas de UI para avaliar legibilidade, sem usá-las como prova física.

Se dimensões reais das lentes chegarem, criar segundo projeto no modo de superfícies; preservar o exemplo aproximado. Não bloquear entrega esperando essas medidas.

## Limite de ambição

Fonte estendida, melhor foco automático, análise diferencial para inclinações, asferas, otimização, catálogos amplos, MTF/difração e renderizador 3D não fazem parte desta implementação. O LED pontual foi explicitamente aceito. Não expandir escopo para “completar um Zemax”.

A entrega solicitada cobre etapas 0–6. É correto apresentar o MVP reto antes de concluir espelho/tilt, mas não declarar tudo concluído enquanto esses itens estiverem faltando. Se execução for interrompida, registrar estado testado e tarefas restantes; não substituir implementação por outro roteiro.

## Riscos a preservar no código

- Desenho plausível não valida Snell/interseção: testes analíticos.
- Campo não é divergência; fonte não é objeto; mancha de ponto não é imagem extensa.
- Diâmetro da UI não é raio persistido; meio da linha é posterior; gap é distância nominal.
- FWHM não é corte angular; 120° do usuário não é datasheet.
- Focal não define uma lente física; modo ideal deve ficar identificado.
- Menor RMS após recorte não prova melhor sistema: mostrar fluxo e contagem juntos.
- Percentual requer denominador declarado e amostragem; não mirar só os raios que passam.
- Diafragma físico não é automaticamente o aperture stop: não inferir f/# ou NA de qualquer abertura.
- Global z positivo não é condição sequencial após espelho.
- Inclinação de lente deve mover ambas as faces; não produzir uma cunha por acidente.
