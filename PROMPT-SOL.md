# Prompt para iniciar a implementação

Copie o texto abaixo para o 6.1 Sol no projeto xamez:

---

Leia o README.md e os documentos docs/01 a docs/09 deste repositório, especialmente docs/06-handoff-sol.md. Eles contêm a arquitetura preparada pelo Astra e já incorporam minhas respostas. Implemente o Xamez seguindo esse roteiro; não faça outra rodada de planejamento nem me peça para repetir as decisões documentadas.

Quero um simulador óptico sequencial local, simples e funcional, com superfícies reais planas/esféricas, LED pontual ou luz colimada, uma wavelength, N-BK7/SF1/SF2 verificados, lentes, diafragmas, fenda, tela, traçado 2D, footprint, porcentagens de luz e projeção/magnificação. Inclua espelho plano e lente inclinada depois que o caminho reto estiver validado. Não preciso de fonte estendida, asferas, catálogo amplo, interface 3D ou fotometria absoluta.

Faça o núcleo numérico puro e testado, editor com JSON, Worker e interface em português. Trabalhe pelas etapas 0–6 e execute os critérios de aceite. Diferencie o modo de superfícies reais do modo aproximado por lentes finas que permite experimentar meu exemplo usando apenas focais e distâncias. Não invente dimensões das minhas lentes, coeficientes de vidro ou resultados físicos.

Meu sistema de exemplo, com as ressalvas de docs/09: LED → 2 mm → biconvexa f=8 mm → 4 mm → fenda → 15 mm → plano-convexa f=14 mm → 90 mm → anteparo. Quero controlar a altura da fenda e selecionar larguras 0,1 / 0,3 / 0,5 / 1 mm. Os parâmetros faltantes já têm tratamento no roteiro; não bloqueie o desenvolvimento esperando por eles.

Priorize o simples que funciona. Entregue o aplicativo executável, comandos para rodar localmente, exemplos e testes executados. Não pare apenas depois de gerar scaffold ou um desenho sem física. Documente limitações reais; se algum item ficar impedido, conclua o que for independente e identifique exatamente o que falta.

---
