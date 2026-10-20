# Produto e escopo

## Uso principal

Um projetista de sistemas ópticos monta uma sequência de lentes e aberturas para entender a iluminação e projeção de uma fenda ou spot. Precisa saber: onde os raios passam; qual elemento bloqueia luz; onde se forma a imagem; seu tamanho aproximado; e como a energia chega à tela.

O primeiro produto cobre o caminho de iluminação/projeção. Um oftalmoscópio direto completo inclui observação, pupilas e eventualmente caminhos dobrados: isso não está automaticamente coberto pelo caminho único de iluminação aqui especificado. Uma pupila pode ser representada como abertura; um modelo de olho seria um projeto óptico explícito, a especificar posteriormente.

## Solicitado pelo usuário

- Sequencial, uma lente após a outra; sem necessidade de visualização 3D.
- Editor de superfícies, material, espessura/distância.
- N-BK7, SF1 e SF2; sem catálogo extenso.
- Fonte no infinito ou LED com abertura angular configurável.
- Um comprimento de onda inicial; configuração de campo simplificada.
- Traçado, vinhetamento, diafragma, footprint, aberração simples.
- Projeção de fenda e spot; distância da imagem e magnificação.
- JSON que possa ser editado com assistência de IA.
- Nesta etapa, prioridade para arquitetura e documentação que orientem o Sol.

## Decisões confirmadas pelo usuário

- Rodar localmente, preferencialmente offline. Instalação de dependências pode precisar de internet; uso normal não deve precisar. Sem backend, conta ou serviço obrigatório.
- Somente superfícies planas e esféricas. Sem asferas.
- LED pontual basta. Fonte estendida fica como evolução opcional, sem bloquear entrega.
- Os 120° não vêm de um datasheet confirmado. Campo principal: “Ângulo total de emissão”, padrão 120°, equivalente a semiângulo de 60°. Modelo inicial: cone uniforme por ângulo sólido, explicitamente aproximado. Opção Lambertiana separada; não chamar 120° de FWHM por padrão.
- Fenda com altura livre e larguras rápidas 0,1 / 0,3 / 0,5 / 1 mm; permitir largura personalizada. Mostrar dimensão projetada e magnificação.
- Espelho plano e lente inclinada entram após o primeiro caminho reto funcionar, na mesma sequência de entrega. Sem controle de descentralização independente. Contrato em docs/08.
- Percentuais de luz são suficientes. Não exigir potência absoluta.
- Sistema de exemplo fornecido: LED → 2 mm → biconvexa f=8 mm → 4 mm → fenda → 15 mm → plano-convexa f=14 mm → 90 mm → anteparo. Tratamento explícito de dados faltantes em docs/09.
- Esta rodada entrega arquitetura e roteiro; o Sol implementa.
- Repositório localizado pelo conector e conta autenticada: gabriel-liberdade/xamez.

Altura da fenda, dimensões completas das lentes e referências exatas das distâncias ainda não foram fornecidas. Usar parâmetros demonstrativos claramente rotulados para a exploração; não bloquear o protótipo esperando essas medidas, nem afirmar reprodução do sistema real.

## Três operações do usuário

**Montar:** inserir lente com raio frontal/traseiro, espessura central, diâmetro e vidro. O assistente cria duas superfícies editáveis; não cria um segundo modelo físico de lente. Inserir diafragma, fenda e tela. Copiar, mover e excluir linhas com desfazer.

**Entender:** arrastar a tela e ver raios; selecionar uma superfície para footprint; identificar o primeiro bloqueio de cada raio; comparar abertura maior/menor; distinguir foco paraxial de menor mancha real.

**Projetar:** marcar uma fenda como objeto, calcular sua conjugação pelo trecho posterior, mostrar tamanho e inversão paraxiais e depois verificar imagem real e iluminação. Salvar JSON e reabrir com os mesmos resultados numéricos.

## Interface proposta

- Centro superior: corte YZ ou XZ, desenho das superfícies e poucos raios selecionados.
- Centro inferior: tabela de superfícies: nome, tipo, raio, distância até próxima, meio posterior, abertura, papel de objeto.
- Lateral: fonte, comprimento de onda, configurações do item selecionado, validação.
- Abas de análise: tela/irradiância relativa; footprint; manchas de pontos do objeto; resumo paraxial; perdas.
- Estado visível: calculando, resultado atualizado, resultado antigo ou configuração inválida.
- Unidades em cada coluna; interface pode aceitar vírgula decimal, serialização sempre numérica.

O corte de um feixe 3D pode ser enganoso. Usar um leque meridional específico para a vista lateral; o mapa quantitativo utiliza um conjunto separado de raios. Se forem exibidas projeções de raios fora do corte, identificá-las como projeções.

## O que é campo?

Campo indica **de onde vem um ponto da cena**. No infinito, isso é uma direção angular. Num objeto próximo, é a posição de um ponto no plano do objeto. Não é a abertura angular do LED: esta descreve as direções emitidas por cada região da fonte.

A interface inicial mostra “Direção da luz” para fonte no infinito e “Ponto do objeto” na análise de imagem. Não exige conhecer a palavra field. Para uma fenda, centro e extremidades são pontos úteis; todas as suas posições podem ser geradas a partir da largura e altura.

## Fora da primeira versão

Otimização automática geral, catálogos de lentes, espelhos curvos, divisores de feixe, descentralização independente, asferas, polarização propagada, difração, interferência, espalhamento, ghost images, modelo espectral de LED branco, cálculo térmico, fabricação e tolerâncias. Reflexão parasita de Fresnel reduz a energia transmitida, sem criar ramos. Espelho intencional segue um único ramo refletido (docs/08).

Esse recorte serve para projetar geometria e iluminação relativa. Não atribuir ao simulador resultados clínicos ou certificação do equipamento.

## Corte vertical mínimo

Arquivo JSON → validação → lente de duas superfícies → raios reais → desenho 2D → abertura que bloqueia raios → tela → salvar/reabrir. Esse corte deve funcionar antes das análises avançadas. O MVP reto inclui fenda, LED pontual, projeção/magnificação, footprint e percentuais. Depois completar espelho plano e lente inclinada. Fonte estendida e análises refinadas não bloqueiam essa entrega.
