# Xamez

Projeto de um simulador óptico sequencial para iluminação e projeção de fenda e spot.

**Estado: arquitetura revisada com as respostas do usuário, sem aplicativo implementado.** Repositório identificado: https://github.com/gabriel-liberdade/xamez. O trabalho de implementação será feito pelo 6.1 Sol, seguindo [PROMPT-SOL.md](PROMPT-SOL.md).

Objetivo: editar superfícies, espaçamentos, materiais e aberturas; acompanhar raios; localizar cortes de luz; estimar foco e magnificação; observar a distribuição de luz numa tela. Operação local, projetos JSON legíveis e interface em português são os padrões propostos.

## Leia nesta ordem

1. [Produto e decisões confirmadas](docs/01-produto.md)
2. [Arquitetura e responsabilidades](docs/02-arquitetura.md)
3. [Contrato físico e numérico](docs/03-fisica.md)
4. [Formato do projeto](docs/04-formato.md)
5. [Verificação e critérios de aceite](docs/05-validacao.md)
6. [Roteiro de implementação para o Sol](docs/06-handoff-sol.md)
7. [Referências e origem das decisões](docs/07-referencias.md)
8. [Espelhos, inclinação e referenciais](docs/08-referenciais.md)
9. [Sistema fornecido pelo usuário e modo aproximado](docs/09-sistema-exemplo.md)

O [exemplo por superfícies](examples/slit-projection.proposed.json) ilustra um caso sintético; o [exemplo por focais](examples/user-system.paraxial.proposed.json) registra o sistema informado pelo usuário com hipóteses explícitas. Nenhum deles é resultado de simulação já executada pelo Xamez.

## Princípios

- Primeiro correção física verificável, depois recursos e acabamento.
- Motor vetorial 3D, sequência única e apresentação 2D. Primeiro eixo reto; depois espelho plano e inclinação rígida de lente.
- Raios reais para propagação; aproximação paraxial identificada para fórmulas e estimativas.
- Fonte de iluminação, objeto a ser projetado e tela são conceitos diferentes.
- Uma interface define o meio **depois** dela; gaps são axiais no sistema reto e seguem o eixo nominal por trecho no sistema dobrado.
- Resultados sempre identificam a configuração e a amostragem que os produziram.
- Não confundir quantidade de linhas desenhadas com energia transportada.

## Estrutura prevista

```text
apps/web/                 interface e Web Worker
packages/optics-core/     geometria, refração, fontes e análises puras
packages/project-format/ esquema, validação, migrações e materialização
examples/                projetos JSON reproduzíveis
docs/                    especificação e roteiro
```

Os diretórios de código são intencionalmente vazios (Git não versiona diretórios vazios). A escolha de versões de dependências e o scaffold executável pertencem à primeira etapa de implementação; não há scripts de execução fictícios.
