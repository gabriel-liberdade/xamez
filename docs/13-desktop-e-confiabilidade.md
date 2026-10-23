# Instalável, linguagem e confiabilidade

O aplicativo atual usa TypeScript e React, compilados para JavaScript. O motor usa números de ponto flutuante de 64 bits (`Number`), como o `float` usual do Python. Isso não significa que todo programa nas duas linguagens terá os mesmos erros ou desempenho; significa que trocar a linguagem não elimina, por si só, limitações numéricas ou de modelagem.

## O que um instalável pode melhorar

Um pacote para Linux pode oferecer ícone, abertura sem terminal, integração com arquivos e instalação/atualização mais simples. Pode também distribuir o runtime necessário. Esses são ganhos de uso e distribuição; os resultados físicos continuam dependendo do motor.

A base atual pode ser empacotada, por exemplo, com Electron, preservando interface, Worker, formato JSON e testes. Isso costuma aumentar o tamanho do pacote. Tauri é outra opção, mas envolve um host nativo e dependências de WebKit no Linux que precisam ser verificadas no Mint. Nenhum pacote .deb/AppImage foi entregue nesta tarefa.

## O que reduz erros de cálculo

- Dados corretos das lentes: curvaturas, espessura, diâmetro, vidro, orientação e referências das distâncias.
- Modelo físico adequado à pergunta, com distinção entre aproximação paraxial e superfícies reais.
- Algoritmos estáveis, validação de domínio, oráculos analíticos e balanço de energia.
- Amostragem suficiente, métricas com denominador declarado e análise de convergência.
- Comparação com um simulador independente e, para o equipamento físico, medições de bancada.

Um instalável pode executar o mesmo motor e reproduzir seus resultados; não garante ausência de bugs. Há funcionalidades que podem ser feitas com a base atual: comparação A/B, melhor foco real, manipulação direta, novas fontes e outras análises. Cada uma precisa de contrato e verificação próprios.

Python/NumPy/SciPy pode ser útil em otimização, validação independente ou cálculos em lote. Grandes volumes também podem justificar código nativo, WASM ou outros caminhos, após medição. A recomendação atual é preservar o motor verificado e fazer uma eventual distribuição desktop reutilizando-o, adicionando outros componentes quando existir uma necessidade concreta.
