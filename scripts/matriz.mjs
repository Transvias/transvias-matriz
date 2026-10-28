// Calcula a matriz de distâncias rodoviárias entre todas as cidades de data/cidades.json,
// perguntando a um OSRM local (osrm-routed) em lotes de origens.
//
// Saída: um arquivo por cidade de origem, out/matriz/<slug>.bin, com N = número de cidades:
//   N x Uint16 = distância em km (arredondada)       \  little-endian, na ordem de cidades.json
//   N x Uint16 = tempo em minutos (arredondado)      /  0xFFFF = sem rota encontrada
// São ~22 KB por cidade. Arquivos que já existem são pulados (dá para retomar).
//
// Variáveis: OSRM_URL (padrão http://127.0.0.1:5000), LOTE (origens por chamada, padrão 25),
//            SO (lista de slugs separados por vírgula, para gerar só algumas origens).

import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';

const OSRM = process.env.OSRM_URL || 'http://127.0.0.1:5000';
const LOTE = Number(process.env.LOTE) || 25;
const SEM_ROTA = 0xffff;

const cidades = JSON.parse(readFileSync(new URL('../data/cidades.json', import.meta.url), 'utf8'));
const N = cidades.length;
const saida = new URL('../out/matriz/', import.meta.url);
mkdirSync(saida, { recursive: true });

const so = (process.env.SO || '').split(',').map((s) => s.trim()).filter(Boolean);
const pendentes = cidades
  .map((c, i) => ({ ...c, i }))
  .filter((c) => !so.length || so.includes(c.slug))
  .filter((c) => !existsSync(new URL(`${c.slug}.bin`, saida)));

// Os destinos vão em blocos para a URL ficar abaixo de ~12 KB (limite comum de servidores HTTP).
const BLOCO = 500;
const ponto = (c) => `${c.lon.toFixed(5)},${c.lat.toFixed(5)}`;
const seq = (de, n) => Array.from({ length: n }, (_, k) => de + k).join(';');

const u16 = (v, escala) => (v == null ? SEM_ROTA : Math.min(SEM_ROTA - 1, Math.round(v / escala)));

async function consulta(coords, qs) {
  for (let tentativa = 1; ; tentativa++) {
    try {
      const r = await fetch(`${OSRM}/table/v1/driving/${coords}?${qs}`);
      const j = await r.json();
      if (j.code !== 'Ok') throw new Error(`${j.code}: ${j.message}`);
      return j;
    } catch (e) {
      if (tentativa >= 3) throw e;
      console.warn(`consulta falhou (${e.message}), tentando de novo`);
      await new Promise((ok) => setTimeout(ok, 2000 * tentativa));
    }
  }
}

// Devolve { distances, durations } com uma linha por origem do lote e N colunas.
async function tabela(lote) {
  const distances = lote.map(() => []), durations = lote.map(() => []);
  for (let d = 0; d < N; d += BLOCO) {
    const destinos = cidades.slice(d, d + BLOCO);
    const coords = [...lote, ...destinos].map(ponto).join(';');
    const qs = `sources=${seq(0, lote.length)}&destinations=${seq(lote.length, destinos.length)}&annotations=distance,duration&skip_waypoints=true`;
    const j = await consulta(coords, qs);
    lote.forEach((_, n) => { distances[n].push(...j.distances[n]); durations[n].push(...j.durations[n]); });
  }
  return { distances, durations };
}

const inicio = Date.now();
let feitas = 0, semRota = 0;
for (let k = 0; k < pendentes.length; k += LOTE) {
  const lote = pendentes.slice(k, k + LOTE);
  const j = await tabela(lote);
  lote.forEach((c, n) => {
    const buf = Buffer.alloc(N * 4);
    for (let d = 0; d < N; d++) {
      const km = d === c.i ? 0 : u16(j.distances[n][d], 1000);
      const min = d === c.i ? 0 : u16(j.durations[n][d], 60);
      if (km === SEM_ROTA) semRota++;
      buf.writeUInt16LE(km, d * 2);
      buf.writeUInt16LE(min, N * 2 + d * 2);
    }
    writeFileSync(new URL(`${c.slug}.bin`, saida), buf);
  });
  feitas += lote.length;
  const seg = (Date.now() - inicio) / 1000;
  console.log(`${feitas}/${pendentes.length} origens, ${seg.toFixed(0)} s, faltam ~${((seg / feitas) * (pendentes.length - feitas) / 60).toFixed(0)} min`);
}
console.log(`Pronto. Pares sem rota: ${semRota}.`);
