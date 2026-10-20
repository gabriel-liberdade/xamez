# Verificação: como saber que funciona

Não aceitar screenshots como prova de correção física. Usar três níveis: respostas analíticas independentes, propriedades invariantes e fluxos da interface. Os testes são parte do produto, não adição depois do desenho.

## Casos com resposta conhecida

| Caso | Resultado esperado | Erro inicial permitido |
|---|---|---|
| Propagação livre | p+t*d e direção constante | 1e-10 mm em escala de bancada |
| Interface n1=n2 | mesma direção, transmissão 1 | 1e-12 em componente |
| Ar→n=1.5 a 30° | theta_t=asin(1/3), ≈19.4712206° | 1e-9 rad |
| Incidência normal 1→1.5 | F=0.04 | 1e-12 absoluto |
| Placa paralela n=1.5 em ar | saída paralela, deslocamento lateral analítico | 1e-9 rad / 1e-8 mm |
| n=1.5→ar a 45° | TIR; nenhum raio transmitido | categórico |
| n=1.5→ar perto de asin(2/3) | tratamento estável dos dois lados do crítico | sem NaN |
| Máscara circular, fonte uniforme colimada | fração geométrica por razão de áreas | intervalo estatístico e convergência |
| LED pontual Lambertiano, abertura frontal | fração até theta = sin²(theta) | 5 erros padrão, com seed fixo |
| LED Lambertiano, cone de 60° | 75% da emissão hemisférica; 25% fora | mesma regra |
| Lente fina de teste f=50, objeto a 100 | imagem a 100, m=-1 | 1e-10 em álgebra |
| Superfícies de lente espessa abaixo | valores matriciais listados | 1e-10 em álgebra |

O teste de lente fina valida apenas o solver de referência, não substitui o teste das superfícies reais. Tolerâncias sugeridas devem ser justificadas pela escala suportada; não relaxar para esconder regressões.

## Oráculo para lente espessa

Vidro artificial n=1.5, ar dos dois lados, R1=+50 mm, R2=-50 mm, espessura=5 mm. Estado (y,n*theta), referência imediatamente antes da primeira e depois da segunda interface:

```
M = [[29/30, 10/3], [-59/3000, 29/30]]
EFL = 3000/59 = 50.8474576271 mm
BFL = 2900/59 = 49.1525423729 mm
```

Objeto a 100 mm antes da primeira face: compor `M*T(100,1)`; B=100 e D=-1. Conjugado a **100 mm depois da última face**, m=-1. Isso evita confundir a espessura do vidro com um espaço de ar. O fixture JSON usa essa posição para a tela no conjugado paraxial desse caso.

Verificar traçado real para alturas decrescentes (ex. 1e-2, 1e-3, 1e-4 mm), convergindo ao resultado paraxial sem exigir igualdade em abertura cheia. Raios marginais esféricos não têm o mesmo foco.

## Geometria: regressões obrigatórias

Raio positivo/negativo; raio iniciado dentro da esfera completa; seleção da calota correta; incidência tangente/quase tangente; discriminante negativo pequeno/grande; plano quase paralelo; raio na borda da abertura com regra de inclusão documentada; esfera com abertura impossível; superfícies que cruzam na borda apesar de vértices ordenados; espessura negativa; detector antes da última interface; raio que perde a primeira calota.

Inspecionar resíduo de interseção e normal unitária. Rodar casos de escalas distintas com mesmo sistema geometricamente ampliado/reduzido. Raios não podem reaparecer depois de bloqueados.

## Invariantes

- Vetores válidos permanecem unitários; nenhum resultado público contém NaN/Infinity numéricos.
- Sistema centrado: espelhar x ou y espelha trajetórias e conserva pesos.
- Snell: n1*sin(theta_i)=n2*sin(theta_t) onde há transmissão.
- Soma de fluxo recebido + fora da tela + bloqueios + perdas refletidas + demais términos = fluxo lançado, tolerância acumulada dimensionada por número de eventos.
- Mostrar separadamente parcela de fluxo em falhas; conservação contábil não torna uma falha física aceitável.
- Matrizes de elementos com estado (y,n*theta) têm determinante 1.
- Com mesma seed e versão, mesmas amostras; tolerância numérica entre runtimes documentada.
- Ampliar só uma abertura passiva não reduz o fluxo recebido para o mesmo conjunto de raios e restante fixo.
- O mapa integrado por área recupera o fluxo da tela.
- Quando fonte estendida for implementada, usa área e ângulo; não vira apenas uma coleção no eixo.

## Testes de imagem e iluminação

1. Fenda como objeto: centro e bordas produzem manchas separadas; tamanho paraxial tem sinal/inversão correto.
2. Alterar LED anterior à fenda muda irradiância, mas não a matriz do trecho de projeção.
3. Alterar abertura pode mudar RMS via seleção dos raios; UI mantém contagem e transmissão ao lado, evitando apresentar redução de RMS isolada como melhoria absoluta.
4. Nenhum raio recebido: mapa vazio e estado “amostragem sem chegadas”; métricas condicionais não são zero artificial.
5. Imagem virtual/afocal: sem posição de tela real inventada.
6. Manter raios e aumentar amostragem: comparar fluxo total e perfis em bins mais grossos, não exigir igualdade de pixels raros.

## Dados dos vidros

Para cada material comercial solicitado, comparar três linhas espectrais tabuladas com tolerância conforme precisão do catálogo. Testar nm→µm; fora de faixa; denominador Sellmeier próximo de singularidade; nome comercial exato; round trip dos coeficientes embutidos. Sem fonte verificável, preset fica indisponível, com tarefa explícita, em vez de trocar por vidro parecido.

## Integração e desempenho

- Criar duas superfícies, máscara e tela; alterar raio/gap; desfazer; exportar/importar e obter o mesmo resultado.
- JSON inválido identifica o campo; nunca substitui silenciosamente projeto válido.
- Resultado de revisão antiga recebido depois de nova edição é descartado.
- Cancelar/refinar não trava controles; recuperação de worker com erro.
- Abrir arquivo futuro preserva original e explica incompatibilidade.
- Mover só viewport não refaz análise; mover tela refaz o necessário.

Metas preliminares, a medir numa máquina registrada: prévia de ~200 raios × 20 superfícies em até 100 ms de cálculo; análise de 100 mil × 20 em até 2 s; interação sem tarefas longas no thread principal. São metas, não resultados já obtidos. Medir mediana/p95 e memória. Se faltar desempenho, reduzir captura de trajetórias e bloquear atualização obsoleta antes de considerar outro runtime.

## Definition of done

Cada etapa do roteiro tem testes executados e limitações descritas. MVP reto exige: casos analíticos, balanço de energia, import/export, cancelamento e exemplo de fenda com LED pontual; não basta traçar dois raios de uma lente ideal. Entrega completa solicitada inclui também os testes de espelho e inclinação de docs/08 e a distinção de modos de docs/09.
