# Referenciais, espelho plano e lente inclinada

## Escopo decidido

O usuário aceitou espelho e lente inclinada, sem descentralização independente. Implementar depois do MVP reto, mas preparar desde o início interseções em coordenadas locais. Apenas espelho plano, sequência única, sem divisão de feixe. Primeiro controle de inclinação no plano YZ (rotação em x); a representação pode armazenar x/y para evolução, rejeitando y não zero enquanto não suportado.

Uma lente inclinada é um corpo rígido de duas faces: inclinar apenas a normal de uma delas cria uma cunha, não uma lente inclinada. Rotacionar posição e orientação das duas faces juntas.

## Dados e uma única fonte de geometria

O documento continua guardando gaps e sequência, não posições globais independentes. Acrescentar:

- `lensGroups:[{id,surfaceIds:[frontId,backId],tiltDeg:{x:0,y:0}}]`.
- IDs de grupo únicos, exatamente duas interfaces consecutivas, sem sobreposição entre grupos. Pivô é sempre o vértice frontal; não persistir outro pivô nesta versão.
- Espelho: `kind:"mirror"`, `shape:{kind:"plane"}`, `tiltDeg:{x:45,y:0}`, `reflectance:1`, abertura e gap comuns. `reflectance` entre 0 e 1, valor 1 rotulado “espelho ideal”. Espelho não muda o meio.
- Máscaras e detector seguem o referencial do trecho nominal sem inclinação própria no primeiro suporte.

Curvatura e sag conservam a definição no referencial próprio da face. As faces de uma lente real permanecem separadas pela espessura no eixo da lente.

## Compilação dos referenciais

Usar transformações rígidas próprias (rotação ortonormal com determinante +1), sem escala. Representação numérica: origem o e base R. Ponto local `Rᵀ*(p-o)`, direção local `Rᵀ*d`; ponto global `o+R*p_local`, normal global `R*N_local`.

1. Começar spine nominal com origem `(0,0,firstVertexZMm)` e base identidade.
2. Compilar sequência reta em frames nominais, avançando cada gap pelo eixo z do trecho. Interfaces refrativas não mudam esse eixo nominal.
3. Num espelho, sua orientação física é a base de entrada multiplicada por Rx(tx), depois Ry(ty) (ordem fixa `Rin*Rx*Ry`; y inicialmente zero). Normal `N=Rmirror*(0,0,1)`.
4. Eixo nominal de saída `kout=kin-2*dot(kin,N)*N`. Avançar o gap seguinte ao longo de kout, nunca por z global. A base de saída é a rotação mínima que leva kin a kout aplicada à base de entrada. Para antiparalelos, escolher explicitamente o eixo x da base de entrada como eixo de rotação de 180°. Testar continuidade nos demais casos; não usar cross product degenerado.
5. Para lente inclinada, gerar primeiro as duas faces nominais. Aplicar rotação rígida do grupo em torno do vértice frontal a ambas, inclusive à posição traseira. **Não** rotacionar automaticamente o resto do banco. Assim a inclinação afeta fisicamente a direção e posição dos raios, sem realinhar a montagem para escondê-las.
6. Elementos posteriores mantêm suas posições nominais. Na UI, gap após uma lente inclinada significa separação nominal antes da rotação e não a menor folga mecânica. Mostrar essa distinção no controle.

Transformações compiladas não são persistidas como outra fonte de verdade. Os frames reconstruídos devem ser idênticos depois do round trip JSON.

## Traçado

Interseção de cada raio com o próximo elemento da lista é calculada no frame daquele elemento; selecionar a calota do vértice e conferir abertura em coordenadas locais. Sem busca global por todos os objetos. Aceitar direções negativas em z global depois de espelho.

Para uma interface refrativa, o raio deve cruzar do lado prescrito de n1 para n2. Guardar normal geométrica orientada do meio anterior ao posterior (componente local z positiva na calota), conferir o sinal de incidência antes de orientar a normal para Snell. Não inverter materiais só porque uma montagem inválida fez o raio chegar por trás. Classificar travessia pelo lado errado como `unsupported_direction`; interseção atrás do raio é `missed_surface`.

Espelho intencional: `dout=d-2*dot(d,N)*N`; peso transmitido pelo caminho sequencial = peso incidente × reflectance. Restante é `mirror_absorption` ou “perda no espelho”, não perda Fresnel de uma lente. Apenas o ramo refletido segue; face traseira não reflete no modelo. Verificar lado frontal definido pelo eixo nominal de entrada.

Máscaras e detector usam projeção no próprio plano, não x,y globais. Imagem/footprint rotacionam com o frame local. A vista lateral pode mostrar o caminho dobrado no plano de dobra; não precisa de viewport 3D.

## Domínio geométrico e validação

O teste de sag radial de docs/03 basta para lentes centradas no próprio grupo; não basta para colisões entre grupos inclinados. Fazer broad phase com volumes limitantes. Se volumes não se cruzam, separação é garantida. Se cruzam, usar teste geométrico mais preciso ou rejeitar conservadoramente a montagem como “folga não verificada”, sem afirmar colisão certa. Não tratar amostragem esparsa de bordas como prova de separação. Na primeira entrega, restrição conservadora é aceitável se explicada.

Proibir corpo que cruza elementos anteriores, passagem não sequencial, espelho dentro de lente e grupos não contíguos. Limitar ângulos ao domínio implementado com mensagens claras; nenhuma correção silenciosa. Uma lente inclinada pode deslocar o feixe mesmo sem controle independente de descentralização: isso é esperado.

## Fórmulas e foco

O solver ABCD escalar existente só retorna conjugação se o trecho objeto→tela tiver eixo reto e lentes sem inclinação. Inicialmente, trecho com espelho ou inclinação retorna “fórmula paraxial não disponível nesta configuração”; traçado, footprint e perdas continuam funcionando. Se a inclinação estiver somente antes da fenda, o trecho posterior reto continua elegível.

Não inventar uma magnificação escalar para lente inclinada: há efeitos diferentes nos dois planos e deslocamento da imagem. Implementar depois uma análise diferencial/raios de pontos se necessário. O primeiro suporte a espelho também não exige desenrolamento paraxial; isso evita erros de paridade no tamanho/inversão.

Modo de exploração por lentes finas de docs/09 permanece reto: espelho e tilt exigem modo real. Desabilitar esses controles com explicação, não converter modelos escondido.

## Testes adicionais obrigatórios

- Espelho a 45° em x: incidente `(0,0,1)`, normal `(0,-1/√2,1/√2)`, saída `(0,1,0)`; detector no novo eixo recebe o raio.
- Dois espelhos: sequência continua correta, inclusive com z global negativo.
- Reflectance 0,8: 80% segue, 20% contabilizado como perda, sem duplicar energia.
- Frame identidade reproduz exatamente os casos retos; rotação rígida global de um fixture mantém coordenadas locais e pesos.
- Duas faces inclinadas preservam distância entre vértices e formato da lente; tilt zero recupera o fixture centrado.
- Placa paralela inclinada: raio emerge paralelo em ar com deslocamento analítico, não se torna prisma.
- Detector/footprint dão coordenadas locais corretas depois da dobra.
- Lado incorreto, colisão não verificada e eixo degenerado retornam diagnósticos definidos.
- Solver paraxial não apresenta resultado antigo depois que uma inclinação o torna inaplicável.
