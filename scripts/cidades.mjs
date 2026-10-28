// Gera data/cidades.json a partir dos CSVs do IBGE (fonte: github.com/kelvins/municipios-brasileiros).
// A ordem do arquivo (por código IBGE) é a ordem das colunas da matriz: não mude sem gerar a matriz de novo.
//
// O slug segue o formato das URLs do portal (/rotas/santa-barbara-doeste-sp/sao-paulo-sp):
// sem acento, apóstrofo some, qualquer outro sinal vira hífen, tudo minúsculo, "-uf" no fim.

import { readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('../data/', import.meta.url);

export const slugify = (nome, uf) =>
  `${nome}-${uf}`
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/['’`´]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

const csv = (file) => {
  const [head, ...rows] = readFileSync(new URL(file, dir), 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/);
  const cols = head.split(',');
  return rows.map((line) => Object.fromEntries(line.split(',').map((v, i) => [cols[i], v])));
};

const ufs = Object.fromEntries(csv('estados.csv').map((e) => [e.codigo_uf, e.uf]));

const cidades = csv('municipios.csv')
  .map((m) => ({
    ibge: Number(m.codigo_ibge),
    nome: m.nome,
    uf: ufs[m.codigo_uf],
    lat: Number(m.latitude),
    lon: Number(m.longitude),
    capital: m.capital === '1',
  }))
  .sort((a, b) => a.ibge - b.ibge)
  .map((c) => ({ slug: slugify(c.nome, c.uf), ...c }));

const repetidos = cidades.filter((c, i) => cidades.findIndex((o) => o.slug === c.slug) !== i);
if (repetidos.length) throw new Error('Slugs repetidos: ' + repetidos.map((c) => c.slug).join(', '));
if (cidades.some((c) => !c.uf || !Number.isFinite(c.lat) || !Number.isFinite(c.lon))) throw new Error('Linha incompleta no CSV');

writeFileSync(new URL('cidades.json', dir), JSON.stringify(cidades) + '\n');
console.log(`${cidades.length} cidades em data/cidades.json`);
