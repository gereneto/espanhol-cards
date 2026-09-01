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

/* ── validação ──
   Duas passagens iguais: uma sobre a resposta portuguesa, outra sobre a
   inglesa. O inglês é opcional enquanto a tradução avança leva a leva —
   card sem nenhum campo inglês passa batido; card com alguns e não todos
   é erro, porque aí é tradução pela metade. */
const erros = [];
const avisos = [];
const ids = new Set();
const textos = new Map();

const CAMPOS_EN = ['en', 'aceitasEn', 'distratoresEn', 'notaEn'];

/* Os distratores precisam ter o MESMO FORMATO da resposta certa. Se só a
   resposta certa traz duas traduções separadas por "/", ou um parêntese,
   ou é bem mais longa que as outras, dá para acertar sem saber espanhol —
   basta escolher a diferente. */
function checarFormato(certa, distratores, onde, coletar) {
  if (!Array.isArray(distratores) || distratores.length !== 4) return;

  const barras = s => (s.match(/\//g) || []).length;
  const temParentese = s => s.includes('(');
  const palavras = s => s.trim().split(/\s+/).length;

  const bCerta = barras(certa);
  const iguais = distratores.filter(d => barras(d) === bCerta).length;
  if (iguais < 3) {
    coletar('formato entrega a resposta em ' + onde +
      ': a certa tem ' + bCerta + ' "/" e os distratores têm [' +
      distratores.map(barras) + ']');
  }

  const comParentese = distratores.filter(temParentese).length;
  if (temParentese(certa) && comParentese === 0) {
    coletar('só a resposta certa tem parêntese: ' + onde);
  }
  if (!temParentese(certa) && comParentese >= 3) {
    coletar('só os distratores têm parêntese: ' + onde);
  }

  const wCerta = palavras(certa);
  const wAlts = distratores.map(palavras);
  if (wCerta > Math.max(...wAlts) + 1) {
    coletar('a resposta certa é bem mais longa que os distratores: ' + onde +
      ' (' + wCerta + ' palavras contra no máximo ' + Math.max(...wAlts) + ')');
  }
  if (wCerta < Math.min(...wAlts) - 1) {
    coletar('a resposta certa é bem mais curta que os distratores: ' + onde +
      ' (' + wCerta + ' palavras contra no mínimo ' + Math.min(...wAlts) + ')');
  }
}

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
  /* uma forma verbal alternativa nunca pode coincidir com a resposta certa */
  if (c.formasEs) {
    const semArtigo = t => normalizar(String(t).replace(/^(el|la|los|las|un|una|unos|unas)\s+/i, ''));
    const certa = semArtigo(c.es);
    for (const f of Object.keys(c.formasEs)) {
      if (semArtigo(f) === certa) erros.push('forma verbal igual à resposta certa: ' + onde + ' → ' + f);
    }
  }

  const vistos = new Set((c.distratores || []).map(normalizar));
  if (vistos.size !== (c.distratores || []).length) erros.push('distratores repetidos entre si: ' + onde);

  checarFormato(c.pt, c.distratores, onde, e => erros.push(e));

  /* ── o lado inglês ── */
  const temAlgumEn = CAMPOS_EN.some(k => c[k] !== undefined) || c.formasEsEn !== undefined;
  if (temAlgumEn) {
    const ondeEn = onde + ' [en]';

    for (const campo of ['en', 'notaEn']) {
      if (typeof c[campo] !== 'string' || !c[campo].trim()) erros.push('falta "' + campo + '": ' + ondeEn);
    }
    if (!Array.isArray(c.distratoresEn) || c.distratoresEn.length !== 4) {
      erros.push('precisa de exatamente 4 distratoresEn: ' + ondeEn);
    }
    if (!Array.isArray(c.aceitasEn) || !c.aceitasEn.length) erros.push('sem aceitasEn: ' + ondeEn);

    if (typeof c.en === 'string' && c.en.trim()) {
      const certasEn = new Set([c.en, ...c.en.split('/'), ...(c.aceitasEn || [])].map(normalizar));
      for (const d of c.distratoresEn || []) {
        if (certasEn.has(normalizar(d))) erros.push('distratorEn igual à resposta: ' + ondeEn + ' → ' + d);
      }
      /* as heurísticas de formato são só aviso em inglês: quem decide de fato
         é a revisão, e barrar o build travaria tradução legítima */
      checarFormato(c.en, c.distratoresEn, ondeEn, a => avisos.push(a));
    }

    const vistosEn = new Set((c.distratoresEn || []).map(normalizar));
    if (vistosEn.size !== (c.distratoresEn || []).length) erros.push('distratoresEn repetidos entre si: ' + ondeEn);

    /* formasEsEn tem de rotular exatamente as mesmas formas de formasEs */
    if (c.formasEs || c.formasEsEn) {
      const a = Object.keys(c.formasEs || {}).sort().join('|');
      const b = Object.keys(c.formasEsEn || {}).sort().join('|');
      if (a !== b) erros.push('formasEsEn não cobre as mesmas formas de formasEs: ' + ondeEn);
      for (const [f, r] of Object.entries(c.formasEsEn || {})) {
        if (typeof r !== 'string' || !r.trim()) erros.push('rótulo vazio em formasEsEn: ' + ondeEn + ' → ' + f);
      }
    }
  }
}

/* ── dicionário de temas ──
   Vira data/tags.js, e não um .json buscado por fetch, pela mesma razão do
   baralho: assim as páginas de revisão abrem direto do disco, sem servidor.
   A validação fica aqui, antes do process.exit dos erros. */
const arqTags = path.join(__dirname, 'tags.json');
const TAGS = fs.existsSync(arqTags) ? JSON.parse(fs.readFileSync(arqTags, 'utf8')) : null;
if (TAGS) {
  const emUso = new Set();
  cards.forEach(c => (c.tags || []).forEach(t => emUso.add(t)));
  for (const t of emUso) if (!TAGS[t]) erros.push('tema sem tradução em fonte/tags.json: ' + t);
  for (const t of Object.keys(TAGS)) if (!emUso.has(t)) avisos.push('tema em tags.json que nenhum card usa: ' + t);
}

/* ── estatísticas ── */
const conta = (f) => cards.reduce((a, c) => { const k = f(c); a[k] = (a[k] || 0) + 1; return a; }, {});
console.log('\n  total ............ ' + cards.length);
console.log('  por tipo ......... ' + JSON.stringify(conta(c => c.tipo)));
console.log('  por nível ........ ' + NIVEIS.map(n => n + ':' + (conta(c => c.nivel)[n] || 0)).join('  '));

const traduzidos = cards.filter(c => typeof c.en === 'string' && c.en.trim()).length;
console.log('  em inglês ........ ' + traduzidos + ' de ' + cards.length +
  (traduzidos === cards.length ? '  ✓' : '  (faltam ' + (cards.length - traduzidos) + ')'));

if (avisos.length) {
  console.warn('\n  ' + avisos.length + ' aviso(s) — não barram o build:');
  avisos.forEach(a => console.warn('   ~ ' + a));
}

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

if (TAGS) {
  fs.writeFileSync(
    path.join(raiz, 'data', 'tags.js'),
    '/* GERADO POR fonte/build.js — não edite à mão. */\n' +
    'window.TAGS_RAW = ' + JSON.stringify(TAGS, null, 1) + ';\n',
    'utf8'
  );
}

/* ── carimbo de versão nos assets ──
   Sem isso o navegador pode servir um data/cards.js velho junto de um
   index.html novo, misturando baralho antigo com código novo. */
const crypto = require('crypto');
const assets = [
  'style.css', 'style-revisao.css',
  'js/motor.js', 'js/github.js', 'js/app.js',
  'js/revisao.js', 'js/revisar-es-en.js', 'js/revisar-en-pt.js',
  'data/cards.js', 'data/tags.js'
].filter(a => fs.existsSync(path.join(raiz, a)));   // as páginas de revisão podem ainda não existir

const soma = crypto.createHash('sha1');
for (const a of assets) soma.update(fs.readFileSync(path.join(raiz, a)));
const versao = soma.digest('hex').slice(0, 8);

for (const pagina of fs.readdirSync(raiz).filter(f => f.endsWith('.html'))) {
  const caminho = path.join(raiz, pagina);
  let html = fs.readFileSync(caminho, 'utf8');
  for (const a of assets) {
    const escapado = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(
      new RegExp('(href|src)="' + escapado + '(\\?v=[^"]*)?"', 'g'),
      '$1="' + a + '?v=' + versao + '"'
    );
  }
  fs.writeFileSync(caminho, html, 'utf8');
}

console.log('\n  ok → data/cards.json e data/cards.js');
console.log('  assets carimbados com ?v=' + versao + '\n');
