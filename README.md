# Matriz de distâncias Transvias

Distâncias rodoviárias entre os 5.571 municípios brasileiros, usadas pela página
www.transvias.com.br/distancias. Calculadas com [OSRM](https://project-osrm.org/) sobre o mapa do
OpenStreetMap, uma vez a cada 6 a 12 meses.

O repositório é público para usar as máquinas maiores e gratuitas do GitHub Actions. Aqui só ficam os
scripts e os dados públicos (IBGE e OpenStreetMap); o site fica em outro repositório.

## Como gerar

Actions > **Gerar matriz** > Run workflow.

- Com `so` vazio, calcula todas as origens (algumas horas) e publica uma Release `matriz-AAAA-MM-DD`
  com `matriz.tar.gz` (`matriz/<slug>.bin` + `cidades.json`). O deploy do site baixa a Release mais nova.
- Com `so` preenchido (slugs separados por vírgula), é só um teste: o resultado sai como artefato.

| Arquivo | O que faz |
| --- | --- |
| `data/municipios.csv`, `data/estados.csv` | Municípios do IBGE com coordenadas da sede ([kelvins/municipios-brasileiros](https://github.com/kelvins/municipios-brasileiros)) |
| `scripts/cidades.mjs` | Gera `data/cidades.json` com o slug no formato do portal (`santa-barbara-doeste-sp`) |
| `scripts/matriz.mjs` | Pergunta ao OSRM e grava `out/matriz/<slug>.bin`, um arquivo por cidade de origem |
| `scripts/conferir.mjs` | Imprime pares conhecidos e conta valores suspeitos |

Formato de cada `<slug>.bin` (N = número de cidades, na ordem de `cidades.json`), little-endian:
N valores `Uint16` com a distância em km, depois N valores `Uint16` com o tempo em minutos.
`0xFFFF` = sem rota. São ~22 KB por cidade.

Para rodar localmente com um OSRM já no ar:

```sh
node scripts/cidades.mjs
OSRM_URL=http://127.0.0.1:5000 SO=osasco-sp,campinas-sp node scripts/matriz.mjs
node scripts/conferir.mjs
```

Dados do mapa © colaboradores do OpenStreetMap, licença [ODbL](https://opendatacommons.org/licenses/odbl/).
A matriz publicada é um banco de dados derivado e segue a mesma licença.
