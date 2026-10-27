# Interface: foco no trabalho e detalhes sob demanda

A primeira interface mostrava simultaneamente fonte, propriedades, tabela, quatro cartões, explicações, seis análises e vários banners. A revisão preserva os cálculos e as operações, mas separa tarefas para reduzir a quantidade de informação concorrente.

## Organização

- **Traçado e resumo sempre visíveis:** corte YZ/XZ, zoom, navegação, arraste da tela, status, prévia/refinamento, fluxo, conjugado, magnificação e dimensão da imagem.
- **Montagem / Análises:** a tabela e os diagnósticos ocupam a mesma área de trabalho. As seis análises continuam disponíveis: tela, footprint, manchas, perdas, paraxial e aberração.
- **Elemento / Fonte:** a lateral mostra um contexto por vez. Selecionar um elemento abre suas propriedades; fonte e amostragem ficam na aba Fonte. Focal, curvatura e distância posterior também podem ser editadas pela lateral.
- **Ações de projeto:** salvar fica na barra principal; importação e edição JSON ficam no menu Projeto. Adicionar reúne lente, fenda, diafragma e espelho; desfazer/refazer permanecem ao lado da tabela.
- **Detalhes técnicos:** hipóteses do exemplo e avisos de aproximação têm resumos visíveis e explicações expansíveis. O indicador de lentes finas aproximadas permanece visível; reorganizar a tela não transforma esse modelo em simulação de lentes reais.

Cores neutras e painéis claros separam controles do desenho óptico escuro. Títulos curtos, hierarquia tipográfica e seleção discreta substituem a repetição de rótulos e seções numeradas. A tabela usa “Até o próximo” para o gap nominal, mantendo o contrato JSON intacto.

## Uso e acessibilidade

Abas suportam setas, Home/End e foco visível. Menus fecham por Escape ou clique fora. Os diálogos JSON e de lente usam `dialog` nativo, mantêm Tab/Shift+Tab dentro do diálogo, fecham com Escape e devolvem foco ao acionador. Valores numéricos rejeitados ficam marcados como não aplicados; Escape restaura o valor válido.

No celular, tocar no nome do elemento leva à edição contextual. A tabela continua rolável para todos os campos, com instrução explícita; a lateral também permite editar focal, raio e distâncias. O canvas adapta a resolução à largura e à densidade de pixels, com altura útil no celular, mantendo os rótulos legíveis e o mapeamento do arraste.

Navegar por abas e viewport não altera revisão nem inicia simulação. Trocar a superfície de footprint continua solicitando a captura apropriada. Os testes verificam essa distinção e mantêm os fluxos anteriores de JSON, materiais, espelho, inclinação, cancelamento, autosave e operação sem serviços externos.

## Próximas melhorias de maior impacto

1. **Comparação A/B de configurações:** salvar estados para comparar luz recebida, imagem e perdas lado a lado, com a mesma seed e amostragem. Ajuda a distinguir mudanças reais de variação estatística.
2. **Busca limitada do melhor foco real:** calcular RMS de pontos e sobrevivência juntos, com domínio de busca declarado, sem apresentar redução de mancha por recorte como melhoria óptica.
3. **Manipulação direta no desenho:** controles explícitos de distância e abertura, com feedback numérico e possibilidade de desfazer. O arraste da tela já existe; lentes e aberturas seriam a evolução.
4. **Convergência e uniformidade em ROI:** mostrar suficiência de amostragem e medir distribuição numa região definida, incluindo pixels vazios. Evitar um indicador de “qualidade” sem significado físico.
5. **Folga mecânica mais precisa:** reduzir rejeições conservadoras de montagens inclinadas, mantendo diagnósticos confiáveis.

Esses itens são propostas futuras. Não foram acrescentados ao motor nesta revisão de interface.
