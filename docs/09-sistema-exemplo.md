# Sistema fornecido e exploração por focal

## Entrada do usuário

LED → 2 mm → lente biconvexa f=8 mm → 4 mm → fenda → 15 mm → lente plano-convexa f=14 mm → 90 mm → olho/anteparo.

Implementar o último elemento como **anteparo**. Não inferir um olho, sua córnea, cristalino, pupila ou retina sem parâmetros. O exemplo é uma disposição informada, não um projeto com desempenho medido ou validado.

## O que falta para reproduzir as lentes

Distância focal não determina curvaturas, espessura, índice, diâmetro útil ou orientação da plano-convexa. As distâncias também podem ter sido medidas a partir de faces ou posições mecânicas; isso não foi especificado. Altura da fenda e aberturas das lentes faltam.

Não bloquear implementação: usar um modo de exploração ideal e parâmetros demonstrativos editáveis. Não inventar um par de raios de curvatura e atribuí-lo à lente do usuário. O modo real será preenchido com essas medidas quando disponíveis.

## Modo `paraxial-exploration`

É uma conveniência adicional pequena, não substitui o motor de superfícies. Modo separado em todo projeto; não misturar com interfaces reais, espelhos ou tilt na primeira versão.

Tipos permitidos: `thin-lens`, `mask`, `detector`. Meio ar ideal. Lente fina tem `focalLengthMm` finito e não nulo, abertura circular, gap e ID; não tem vidro, espessura, formato físico de faces nem Fresnel. São lentes ideais matemáticas. Não inferir aberração delas.

Propagar até o plano da lente. Para o estado por eixo usar inclinação `u=dx/dz`, `v=dy/dz`; atualizar `u'=u-x/f`, `v'=v-y/f` e converter `(u',v',1)` para direção normalizada. Isso reproduz a transferência paraxial por raios geométricos em planos; não é refração real em abertura grande. Marcar todo resultado como aproximado. A colimação de um ponto focal e conjugação fina têm testes analíticos independentes.

Um cone de 120° não satisfaz aproximação paraxial em geral. Permitir o desenho exploratório, mas mostrar aviso de fora do regime paraxial quando houver raios aceitos por uma lente com |inclinação| > 0,1 rad equivalente (limiar heurístico de UI, não limite físico universal). Não apresentar o percentual como previsão real. Nome: “fração de raios aceita pelo modelo ideal”. Só no modo por superfícies falar em estimativa física dentro dos mecanismos implementados.

Comparação de foco/magnificação usa matrizes ideais; resultado global do traçado pode ser pouco representativo de um LED real. Emissor pontual também não prevê uniformidade do emissor físico. Essa escolha corresponde ao escopo simplificado solicitado.

## Arquivo de exemplo

`examples/user-system.paraxial.proposed.json`: distâncias interpretadas entre planos ideais, fenda com largura 0,3 mm e altura DEMONSTRATIVA de 1 mm, diâmetros DEMONSTRATIVOS de 4 mm nas duas lentes. Esses três tamanhos não foram fornecidos pelo usuário. Mostrar na UI como parâmetros assumidos.

O arquivo usa cone uniforme por ângulo sólido, ângulo total 120° (semiângulo 60°). Esse número não é um dado caracterizado do LED; usuário pode alterá-lo. Não converter para Lambertiano automaticamente.

## Sanidade para projeção

Somente para lente fina em ar, objeto a 15 mm e f=14 mm:

`si=f*so/(so-f)=210 mm`, `m=-si/so=-14`.

Assim, neste modelo a tela a 90 mm não fica no conjugado da fenda. Para projetar no conjugado a 90 mm, objeto ideal teria `so=f*si/(si-f)=16,578947... mm` e magnificação `-5,428571...`.

Esses números são referências para testar a UI e explicar a sensibilidade próxima ao foco; não uma conclusão sobre o sistema real, cujos planos principais e medidas ainda faltam. Guardar a tela a 90 mm no exemplo, permitindo que o usuário veja o desfoque e experimente o botão de posicionamento no conjugado. Não “corrigir” o exemplo automaticamente.

No conjugado ideal de 210 mm, uma fenda de altura 1 mm teria altura 14 mm. As larguras rápidas 0,1 / 0,3 / 0,5 / 1 mm dariam 1,4 / 4,2 / 7 / 14 mm. A tela do exemplo tem 40 × 40 mm para não recortar esses tamanhos didáticos; também é parâmetro assumido.

A condensadora ideal f=8 mm com LED a 2 mm recebe objeto dentro do foco: conjugado isolado -8/3 mm, virtual. O traçado deve mostrar comportamento divergente após essa lente para esse ponto, não forçar colimação. Isso não impede um conjunto de iluminação de funcionar; é uma propriedade do modelo aproximado informado.

## Critérios de aceite específicos

- Carregar o exemplo sem exigir medidas faltantes; todas as suposições ficam visíveis.
- Não apresentar forma biconvexa/plano-convexa como geometria real deduzida da focal. Podem aparecer no nome/nota do elemento, mantendo símbolo de lente ideal.
- Seleção rápida das quatro larguras, altura livre e magnificação assinada.
- A tela começa a 90 mm; cálculo mostra conjugado 210 mm e estado de desfoque aproximado.
- Alterar distância objeto→projetora perto de 14 mm trata imagem virtual/infinita sem NaN.
- “Converter para superfícies reais” exige dados geométricos ou cria novo projeto rascunho sem preencher dimensões como fatos.
