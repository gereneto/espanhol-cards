#!/usr/bin/env node
/* ────────────────────────────────────────────────────────────────
   fonte/build.js — junta e valida os arquivos de fonte/cards/ e
   gera data/cards.json (para ferramentas) e data/cards.js (que o
   app carrega, para funcionar até abrindo o index.html direto).

   Uso:  node fonte/build.js
   ──────────────────────────────────────────────────────────────── */
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const pastaCards = path.join(__dirname, 'cards');
const NIVEIS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const normalizar = s => s
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

const arquivos = fs.readdirSync(pastaCards).filter(f => f.endsWith('.json')).sort();
let cards = [];
for (const f of arquivos) {
  const lote = JSON.parse(fs.readFileSync(path.join(pastaCards, f), 'utf8'));
  console.log('  ' + f.padEnd(28) + lote.length + ' cards');
  cards = cards.concat(lote);
}

/* ── validação ── */
const erros = [];
const ids = new Set();
const textos = new Map();

for (const c of cards) {
  const onde = c.id + ' (' + c.es + ')';

  if (ids.has(c.id)) erros.push('id repetido: ' + onde);
  ids.add(c.id);

  if (textos.has(normalizar(c.es))) {
    erros.push('card repetido: ' + onde + ' já existe em ' + textos.get(normalizar(c.es)));
  }
  textos.set(normalizar(c.es), c.id);

  for (const campo of ['tipo', 'es', 'pt', 'nivel', 'nota']) {
    if (typeof c[campo] !== 'string' || !c[campo].trim()) erros.push('falta "' + campo + '": ' + onde);
  }
  if (!['palavra', 'frase'].includes(c.tipo)) erros.push('tipo inválido: ' + onde);
  if (!NIVEIS.includes(c.nivel)) erros.push('nível inválido: ' + onde);
  if (!Array.isArray(c.distratores) || c.distratores.length !== 4) erros.push('precisa de exatamente 4 distratores: ' + onde);
  if (!Array.isArray(c.aceitas) || !c.aceitas.length) erros.push('sem respostas aceitas: ' + onde);
  if (!Array.isArray(c.tags) || !c.tags.length) erros.push('sem tags: ' + onde);

  // nenhum distrator pode ser, na prática, a resposta certa
  const certas = new Set([c.pt, ...c.pt.split('/'), ...(c.aceitas || [])].map(normalizar));
  for (const d of c.distratores || []) {
    if (certas.has(normalizar(d))) erros.push('distrator igual à resposta: ' + onde + ' → ' + d);
  }
  const vistos = new Set((c.distratores || []).map(normalizar));
  if (vistos.size !== (c.distratores || []).length) erros.push('distratores repetidos entre si: ' + onde);

  /* Os distratores precisam ter o MESMO FORMATO da resposta certa. Se só a
     resposta certa traz duas traduções separadas por "/", ou um parêntese,
     ou é bem mais longa que as outras, dá para acertar sem saber espanhol —
     basta escolher a diferente. */
  if (Array.isArray(c.distratores) && c.distratores.length === 4) {
    const barras = s => (s.match(/\//g) || []).length;
    const temParentese = s => s.includes('(');
    const palavras = s => s.trim().split(/\s+/).length;

    const bCerta = barras(c.pt);
    const iguais = c.distratores.filter(d => barras(d) === bCerta).length;
    if (iguais < 3) {
      erros.push('formato entrega a resposta em ' + onde +
        ': a certa tem ' + bCerta + ' "/" e os distratores têm [' +
        c.distratores.map(barras) + ']');
    }

    const comParentese = c.distratores.filter(temParentese).length;
    if (temParentese(c.pt) && comParentese === 0) {
      erros.push('só a resposta certa tem parêntese: ' + onde);
    }
    if (!temParentese(c.pt) && comParentese >= 3) {
      erros.push('só os distratores têm parêntese: ' + onde);
    }

    const wCerta = palavras(c.pt);
    const wAlts = c.distratores.map(palavras);
    if (wCerta > Math.max(...wAlts) + 1) {
      erros.push('a resposta certa é bem mais longa que os distratores: ' + onde +
        ' (' + wCerta + ' palavras contra no máximo ' + Math.max(...wAlts) + ')');
    }
    if (wCerta < Math.min(...wAlts) - 1) {
      erros.push('a resposta certa é bem mais curta que os distratores: ' + onde +
        ' (' + wCerta + ' palavras contra no mínimo ' + Math.min(...wAlts) + ')');
    }
  }
}

/* ── estatísticas ── */
const conta = (f) => cards.reduce((a, c) => { const k = f(c); a[k] = (a[k] || 0) + 1; return a; }, {});
console.log('\n  total ............ ' + cards.length);
console.log('  por tipo ......... ' + JSON.stringify(conta(c => c.tipo)));
console.log('  por nível ........ ' + NIVEIS.map(n => n + ':' + (conta(c => c.nivel)[n] || 0)).join('  '));

if (erros.length) {
  console.error('\n  ' + erros.length + ' problema(s):');
  erros.forEach(e => console.error('   - ' + e));
  process.exit(1);
}

/* ── saída ── */
const baralho = {
  versao: 1,
  gerado_em: new Date().toISOString().slice(0, 10),
  total: cards.length,
  cards
};

fs.mkdirSync(path.join(raiz, 'data'), { recursive: true });
fs.writeFileSync(path.join(raiz, 'data', 'cards.json'), JSON.stringify(baralho, null, 1), 'utf8');
fs.writeFileSync(
  path.join(raiz, 'data', 'cards.js'),
  '/* GERADO POR fonte/build.js — não edite à mão. */\n' +
  'window.CARDS_RAW = ' + JSON.stringify(baralho, null, 1) + ';\n',
  'utf8'
);

console.log('\n  ok → data/cards.json e data/cards.js\n');
