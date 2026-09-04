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

/* ── a régua do app, e não uma parecida ──
   Este normalizar() daqui de cima serve para achar card repetido: ele quer
   saber se dois textos são o MESMO texto. Já para saber se um distrator é,
   na prática, a resposta certa, quem decide tem de ser o motor — porque é
   ele que vai conferir a resposta de verdade, e ele descarta artigo, pronome
   e plural. Uma régua própria aqui deixaria passar "Ele disse isso ontem."
   contra "Eu disse isso a ele ontem.", que o app aceita como a mesma coisa. */
const arqMotor = path.join(raiz, 'js', 'motor.js');
const janela = {};
try {
  new Function('window', fs.readFileSync(arqMotor, 'utf8'))(janela);
} catch (e) {
  console.error('\n  não consegui carregar js/motor.js: ' + e.message + '\n');
  process.exit(1);
}
const Motor = janela.Motor;
if (!Motor || typeof Motor.respostasAceitas !== 'function') {
  console.error('\n  js/motor.js carregou mas não expôs o Motor esperado\n');
  process.exit(1);
}

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

/* Nenhum distrator pode ser, para o motor, a resposta certa — nem repetir
   outro distrator. Vale nas duas pontas: na múltipla escolha apareceriam
   duas alternativas certas, e na escrita o texto do distrator seria aceito.
   Roda em toda direção que o card sustenta; o espanhol entra porque o
   baralho pode trazer distratoresEs, ainda que hoje nenhum card traga. */
function checarDistratores(c, direcao, campo, onde, coletar) {
  const lista = c[campo];
  if (!Array.isArray(lista) || !lista.length) return;

  const lingua = Motor.linguaDaResposta(direcao);
  const certas = new Set(Motor.respostasAceitas(c, direcao));
  const vistos = new Map();

  for (const d of lista) {
    const chave = Motor.normalizar(d, lingua);
    if (certas.has(chave)) {
      coletar('distrator que o motor lê como a resposta certa: ' + onde +
        ' → ' + d + '  (vira "' + chave + '")');
    }
    if (vistos.has(chave)) {
      coletar('dois distratores que o motor lê igual: ' + onde +
        ' → ' + vistos.get(chave) + ' / ' + d + '  (viram "' + chave + '")');
    }
    vistos.set(chave, d);
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

  checarDistratores(c, 'es-pt', 'distratores', onde, e => erros.push(e));
  checarDistratores(c, 'pt-es', 'distratoresEs', onde, e => erros.push(e));

  /* uma forma verbal alternativa nunca pode coincidir com a resposta certa */
  if (c.formasEs) {
    const certas = new Set(Motor.respostasAceitas(c, 'pt-es'));
    for (const f of Object.keys(c.formasEs)) {
      if (certas.has(Motor.normalizarEs(f))) erros.push('forma verbal igual à resposta certa: ' + onde + ' → ' + f);
    }
  }

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

    /* fora do "tem en?" de propósito: dois distratoresEn iguais entre si são
       erro mesmo enquanto a tradução da resposta ainda não chegou */
    checarDistratores(c, 'es-en', 'distratoresEn', ondeEn, e => erros.push(e));

    if (typeof c.en === 'string' && c.en.trim()) {
      /* as heurísticas de formato são só aviso em inglês: quem decide de fato
         é a revisão, e barrar o build travaria tradução legítima */
      checarFormato(c.en, c.distratoresEn, ondeEn, a => avisos.push(a));
    }

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

/* ── a frase presa a uma palavra ──
   «requer» aponta para o card da palavra que a frase põe em uso. A frase só
   entra no baralho quando aquela palavra estiver dominada, então um alvo
   errado deixaria o card preso para sempre, sem nada na tela denunciando. */
const PORID = new Map(cards.map(c => [c.id, c]));
for (const c of cards) {
  if (c.requer === undefined) continue;
  const onde = c.id + ' (' + c.es + ')';
  const alvo = PORID.get(c.requer);

  if (typeof c.requer !== 'string' || !alvo) {
    erros.push('"requer" aponta para card que não existe: ' + onde + ' → ' + c.requer);
    continue;
  }
  if (c.tipo !== 'frase') erros.push('só frase pode ter "requer": ' + onde);
  if (alvo.tipo !== 'palavra') {
    erros.push('"requer" tem de apontar para uma palavra: ' + onde + ' → ' + c.requer +
      ' (' + alvo.tipo + ')');
  }
  /* Corrente de dois elos prenderia a segunda frase atrás de outra frase, e
     frase não chega a "dominado" por um caminho que o usuário veja como tal. */
  if (alvo.requer) erros.push('"requer" em cadeia: ' + onde + ' → ' + c.requer + ' que também requer');
  if (c.requer === c.id) erros.push('card que requer a si mesmo: ' + onde);

  /* A frase tem de usar mesmo a palavra. Aviso, e não erro: o espanhol
     flexiona (el vaso → los vasos, quitar → me quitó), então a comparação é
     por radical e erra para menos de vez em quando. */
  if (alvo.tipo === 'palavra') {
    const limpar = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const nucleo = limpar(alvo.es)
      .replace(/^(el|la|los|las|un|una)\s+/, '')
      /* «enterarse» conjugado vira «me enteré», e o radical tem de cortar
         antes da desinência para sobreviver a isso: enterarse → enter */
      .replace(/(ar|er|ir)se$/, '')
      .replace(/(ar|er|ir)$/, '');
    const radical = nucleo.slice(0, Math.max(4, nucleo.length - 2));
    if (radical && !limpar(c.es).includes(radical)) {
      avisos.push('a frase não parece usar a palavra que requer: ' + onde +
        ' → ' + alvo.es + ' (procurei "' + radical + '")');
    }
  }
}

/* ── estatísticas ── */
const conta = (f) => cards.reduce((a, c) => { const k = f(c); a[k] = (a[k] || 0) + 1; return a; }, {});
console.log('\n  total ............ ' + cards.length);
console.log('  por tipo ......... ' + JSON.stringify(conta(c => c.tipo)));
console.log('  por nível ........ ' + NIVEIS.map(n => n + ':' + (conta(c => c.nivel)[n] || 0)).join('  '));

const presas = cards.filter(c => c.requer);
if (presas.length) {
  const palavras = new Set(presas.map(c => c.requer));
  console.log('  presas à palavra . ' + presas.length + ' frases, sobre ' + palavras.size + ' palavras');
}

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
