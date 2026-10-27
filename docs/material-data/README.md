# Dados dos materiais

Dados de coeficientes obtidos em 2026-10-23 do espelho CC0 [refractiveindex.info-database](https://github.com/polyanskiy/refractiveindex.info-database/tree/main/database/data/specs/schott/optical). As três cópias YAML adjacentes preservam a referência à SCHOTT e os coeficientes utilizados. Somente dispersão é implementada; o aplicativo não usa as tabelas de absorção `k` dos YAMLs.

Fonte dos coeficientes: [SCHOTT Zemax catalog 2017-01-20b](https://refractiveindex.info/download/data/2017/schott_2017-01-20b.agf), disponibilizado originalmente pela SCHOTT. Conferência independente: [SCHOTT glass data sheets 2017-01-20](https://refractiveindex.info/download/data/2017/schott_2017-01-20.pdf), páginas impressas 13 (SCHOTT N-BK 7®), 110 (SF1), 111 (SF2).

Índices transcritos do datasheet (cinco casas decimais):

| Vidro exato | C, 656,2725 nm | d, 587,5618 nm | F, 486,1327 nm | Faixa usada |
|---|---:|---:|---:|---|
| N-BK7 | 1,51432 | 1,51680 | 1,52238 | 300–2500 nm |
| SF1 | 1,71031 | 1,71736 | 1,73462 | 350–2500 nm |
| SF2 | 1,64210 | 1,64769 | 1,66123 | 350–2500 nm |

Os títulos das colunas espectrais do PDF arredondam os comprimentos de onda para 656,3 / 587,6 / 486,1 nm. Os testes usam os comprimentos de onda das linhas espectrais, evitando atribuir o efeito desse arredondamento a um erro dos coeficientes. Tolerância absoluta 6×10⁻⁶ para comparação com os índices impressos a cinco casas. O teste também verifica a conversão nm → µm, a rejeição fora da faixa e singularidades de Sellmeier.

SF1 e SF2 são os tipos exatos contendo chumbo do catálogo arquivado; não se trata de N-SF1 ou N-SF2. Esses coeficientes não caracterizam um lote medido nem estabelecem que as lentes do usuário sejam desses vidros. O catálogo preenche a cópia embutida no projeto; depois de salvar, mudanças futuras no catálogo não alteram aquele arquivo.

Snapshot do espelho consultado: árvore Git `c5c2f188e848453def5970e347399d653df2ffc2`. Coeficientes para a condição de referência do catálogo (aproximadamente 20 °C), sem ajuste térmico no motor.
