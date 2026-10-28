// Confere a matriz gerada: imprime pares conhecidos e aponta valores suspeitos
// (rota menor que a linha reta, ou mais de 3x maior que ela).

import { readFileSync, readdirSync } from 'node:fs';

const cidades = JSON.parse(readFileSync(new URL('../data/cidades.json', import.meta.url), 'utf8'));
const N = cidades.length;
const idx = Object.fromEntries(cidades.map((c, i) => [c.slug, i]));
const dir = new URL('../out/matriz/', import.meta.url);
const SEM_ROTA = 0xffff;

const linhaReta = (a, b) => {
  const r = (x) => (x * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

const arquivos = readdirSync(dir).filter((f) => f.endsWith('.bin'));
const ler = (slug) => readFileSync(new URL(`${slug}.bin`, dir));

const exemplos = [
  ['osasco-sp', 'campinas-sp'], ['sao-paulo-sp', 'rio-de-janeiro-rj'], ['sao-paulo-sp', 'porto-alegre-rs'],
  ['belo-horizonte-mg', 'brasilia-df'], ['recife-pe', 'salvador-ba'], ['sao-paulo-sp', 'manaus-am'],
];
for (const [o, d] of exemplos) {
  if (!arquivos.includes(`${o}.bin`)) continue;
  const b = ler(o), j = idx[d];
  console.log(`${o} -> ${d}: ${b.readUInt16LE(j * 2)} km, ${b.readUInt16LE(N * 2 + j * 2)} min (linha reta ${linhaReta(cidades[idx[o]], cidades[j]).toFixed(0)} km)`);
}

let pares = 0, semRota = 0, curtos = 0, longos = 0;
for (const f of arquivos) {
  const o = idx[f.slice(0, -4)], b = ler(cidades[o].slug);
  for (let d = 0; d < N; d++) {
    if (d === o) continue;
    pares++;
    const km = b.readUInt16LE(d * 2);
    if (km === SEM_ROTA) { semRota++; continue; }
    const reta = linhaReta(cidades[o], cidades[d]);
    if (km < reta * 0.95 - 2) curtos++;
    else if (reta > 20 && km > reta * 3) longos++;
  }
}
console.log(`${arquivos.length} origens, ${pares} pares: ${semRota} sem rota, ${curtos} menores que a linha reta, ${longos} acima de 3x a linha reta`);
