#!/usr/bin/env node
/* ────────────────────────────────────────────────────────────────
   fonte/build.js — junta e valida os arquivos de fonte/cards/ e
   gera data/cards.json (para ferramentas), data/cards.js (que o app
   de estudo carrega, para funcionar até abrindo o index.html direto)
   e data/cards-revisao.js (o baralho com o inglês, para a revisão).

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

/* ── a categoria que só os distratores têm ──
   Um degrau acima do formato: ali é a forma que entrega a resposta, aqui é o
   assunto. Se as quatro alternativas erradas falam todas de gato e a certa
   não, dá para acertar escolhendo a diferente, sem saber espanhol. O Gere
   apontou isso em quatro cards antes de o build aprender a ver — «Nos
   pusimos morados», «No te andes por las ramas», «Aquí hay gato encerrado» e
   «Se le fue la olla».

   A conta é a palavra de conteúdo que aparece nos QUATRO distratores e não
   aparece na resposta certa, contando singular e plural como a mesma.

   Duas coisas ela NÃO pega, e é bom saber:
   — categoria por assunto sem palavra repetida (quatro frases sobre comida
     em que nenhuma palavra se repete). Isso continua sendo olho humano;
   — card de conjugação, que fica de fora de propósito: lá as cinco
     alternativas têm o mesmo verbo por construção e o que muda é o tempo,
     então a palavra comum não entrega nada.

   Sai como aviso, não como erro: a lista de palavras vazias nunca vai estar
   completa, e um falso positivo não deve barrar o baralho. */
const VAZIAS_CATEGORIA = new Set(('a o as os um uma uns umas de do da dos das em no na nos nas ' +
  'por para pra com sem que se e ou mais menos muito pouco ele ela eles elas eu voce nao ja ao ' +
  'aos aqui ali la isso esse essa este esta seu sua meu minha ser estar ter foi era tudo nada ' +
  'algo alguem quem qual quando onde como porque ' +
  'the of to in on it is are do does did not you he she they we and or up out off his her my ' +
  'your that this an was were be been have has had with for from at by as so if but all any ' +
  'some one two what how who when where why too very much more less there here got get').split(' '));

function palavrasDeCategoria(s) {
  const saida = new Set();
  String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(p => p.length > 2 && !VAZIAS_CATEGORIA.has(p))
    .forEach(p => {
      saida.add(p);
      if (p.endsWith('s') && p.length > 3) saida.add(p.slice(0, -1));
    });
  return saida;
}

function checarCategoria(certa, distratores, onde, coletar) {
  if (!Array.isArray(distratores) || distratores.length !== 4) return;
  const naCerta = palavrasDeCategoria(certa);
  const conjuntos = distratores.map(palavrasDeCategoria);
  const comuns = [...conjuntos[0]].filter(p => conjuntos.every(c => c.has(p)) && !naCerta.has(p));
  if (comuns.length) {
    coletar('os quatro distratores falam de «' + comuns[0] + '» e a resposta certa não: ' +
      onde + ' — dá para acertar escolhendo a diferente');
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

    /* E cada metade de um distrator com barra. «Me dê a mão. / Vamos
       atravessar.» passava inteiro e trazia dentro «me dê a mão», que o funil
       lê igual a «me dê uma mão» — a resposta certa do card. Quem lê a
       alternativa lê a metade, e a metade não pode estar certa. */
    if (d.includes('/')) {
      for (const parte of d.split('/')) {
        const chaveParte = Motor.normalizar(parte, lingua);
        if (chaveParte && certas.has(chaveParte)) {
          coletar('metade de distrator que o motor lê como a resposta certa: ' + onde +
            ' → ' + parte.trim() + '  (em «' + d + '»)');
        }
      }
    }
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

  /* Card de conjugação traz a mesma frase em quatro outros tempos. Elas têm
     dois serviços: reconhecer o tempo errado na resposta escrita, e ser as
     quatro alternativas erradas da múltipla escolha pt → es (ver
     distratoresEs, no motor). Com menos de quatro, a vaga que sobra é
     preenchida com frase de outro card, fora do assunto. */
  if ((c.tags || []).includes('conjugação')) {
    const n = c.formasEs ? Object.keys(c.formasEs).length : 0;
    if (n < 4) erros.push('card de conjugação precisa de 4 formasEs (tem ' + n + '): ' + onde);
  }

  /* uma forma verbal alternativa nunca pode coincidir com a resposta certa */
  if (c.formasEs) {
    const certas = new Set(Motor.respostasAceitas(c, 'pt-es'));
    for (const f of Object.keys(c.formasEs)) {
      if (certas.has(Motor.normalizarEs(f))) erros.push('forma verbal igual à resposta certa: ' + onde + ' → ' + f);
    }
  }

  /* O parêntese explica a resposta, e ninguém o escreve: «o peixe (para
     comer)» tem de aceitar «o peixe». O funil não tira o parêntese, então a
     forma nua precisa estar entre as aceitas. */
  if (typeof c.pt === 'string' && c.pt.includes('(') && Array.isArray(c.aceitas)) {
    for (const parte of c.pt.split('/')) {
      if (!parte.includes('(')) continue;
      const nua = parte.replace(/\([^)]*\)/g, ' ').trim();
      if (nua && Motor.conferir(c, nua, 'es-pt') !== 'certo') {
        erros.push('a resposta sem o parêntese não é aceita: ' + onde + ' → «' + nua + '» (ponha em "aceitas")');
      }
    }
  }

  checarFormato(c.pt, c.distratores, onde, e => erros.push(e));
  /* Conjugação fica de fora: lá as cinco alternativas têm o mesmo verbo por
     construção, e o que muda é o tempo. */
  if (!(c.tags || []).includes('conjugação')) {
    checarCategoria(c.pt, c.distratores, onde, a => avisos.push(a));
  }

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
      if (!(c.tags || []).includes('conjugação')) {
        checarCategoria(c.en, c.distratoresEn, ondeEn, a => avisos.push(a));
      }
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
         antes da desinência para sobreviver a isso: enterarse → enter. O
         mesmo com o pronome a mais: «apañárselas» vira «me las apañaré». */
      .replace(/(ar|er|ir)se(l[oa]s?)?$/, '')
      .replace(/(ar|er|ir)$/, '');
    /* O espanhol muda o radical ao conjugar: «soler» vira «suelo»,
       «acordarse» vira «me acuerdo», «pedir» vira «pide». Sem prever isso o
       aviso dispara justamente nos verbos mais irregulares — que são os que
       mais precisam de uma frase mostrando o uso. */
    const variantes = new Set([nucleo]);
    /* o adjetivo concorda: «soso» aparece na frase como «sosa» */
    if (/[oa]$/.test(nucleo)) variantes.add(nucleo.slice(0, -1));
    [['o', 'ue'], ['e', 'ie'], ['e', 'i'], ['u', 'ue']].forEach(([de, para]) => {
      const i = nucleo.lastIndexOf(de);
      if (i >= 0) variantes.add(nucleo.slice(0, i) + para + nucleo.slice(i + 1));
    });

    const frase = limpar(c.es);
    const radicais = [...variantes]
      .map(v => v.slice(0, Math.max(4, v.length - 2)))
      .filter(Boolean);
    if (radicais.length && !radicais.some(r => frase.includes(r))) {
      avisos.push('a frase não parece usar a palavra que requer: ' + onde +
        ' → ' + alvo.es + ' (procurei ' + radicais.map(r => '"' + r + '"').join(' ou ') + ')');
    }
  }
}

/* ── toda palavra tem a sua frase ──
   A palavra sozinha diz o que é; a frase diz como se usa — e é o uso que a
   definição não ensina. Desde a leva 10 toda palavra do baralho tem uma
   frase presa a ela, e o build avisa quando alguma entra sem. Aviso, e não
   erro: a palavra pode chegar numa leva e a frase na seguinte. */
{
  const comFrase = new Set(cards.filter(c => c.requer).map(c => c.requer));
  const soltas = cards.filter(c => c.tipo === 'palavra' && !comFrase.has(c.id));
  if (soltas.length) {
    avisos.push(soltas.length + ' palavra(s) sem frase de uso presa a ela: ' +
      soltas.map(c => c.id + ' (' + c.es + ')').join(', '));
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

/* ── saída ──
   A data só muda quando o baralho muda. Carimbada a cada build, ela fazia
   todo build em dia novo reescrever o baralho e trocar o ?v= dele, mesmo sem
   card nenhum mexido — e o navegador baixava 860 KB de novo por nada. */
fs.mkdirSync(path.join(raiz, 'data'), { recursive: true });
const arqJson = path.join(raiz, 'data', 'cards.json');
let geradoEm = new Date().toISOString().slice(0, 10);
try {
  const anterior = JSON.parse(fs.readFileSync(arqJson, 'utf8'));
  if (JSON.stringify(anterior.cards) === JSON.stringify(cards)) geradoEm = anterior.gerado_em;
} catch (e) { /* primeiro build, ou arquivo ilegível: vale a data de hoje */ }

const baralho = { versao: 1, gerado_em: geradoEm, total: cards.length, cards };

/* O app de estudo não usa o lado inglês, e ele é um terço do baralho: o
   cards.js vai sem esses campos, e as páginas de revisão carregam o
   cards-revisao.js, que tem tudo. Os dois vão sem indentação — quem quer ler
   o baralho lê o cards.json, que continua indentado. */
const CAMPOS_SO_DA_REVISAO = CAMPOS_EN.concat('formasEsEn');
const semIngles = Object.assign({}, baralho, {
  cards: cards.map(c => {
    const limpo = Object.assign({}, c);
    CAMPOS_SO_DA_REVISAO.forEach(k => delete limpo[k]);
    return limpo;
  })
});
const comoJs = dados => '/* GERADO POR fonte/build.js — não edite à mão. */\n' +
  'window.CARDS_RAW = ' + JSON.stringify(dados) + ';\n';

fs.writeFileSync(arqJson, JSON.stringify(baralho, null, 1), 'utf8');
fs.writeFileSync(path.join(raiz, 'data', 'cards.js'), comoJs(semIngles), 'utf8');
fs.writeFileSync(path.join(raiz, 'data', 'cards-revisao.js'), comoJs(baralho), 'utf8');

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
   index.html novo, misturando baralho antigo com código novo.

   O carimbo é de CADA arquivo, tirado do conteúdo dele. Antes era um só para
   todos, e mexer numa linha do CSS obrigava o navegador a baixar de novo o
   baralho inteiro. Agora só muda o ?v= de quem mudou — e a página só é
   regravada se algum carimbo dela mudou. */
const crypto = require('crypto');
const assets = [
  'style.css', 'style-revisao.css', 'style-professor.css',
  'js/motor.js', 'js/github.js', 'js/app.js',
  'js/revisao.js', 'js/revisar-es-en.js', 'js/revisar-en-pt.js',
  'data/cards.js', 'data/cards-revisao.js', 'data/tags.js', 'data/historico.js'
].filter(a => fs.existsSync(path.join(raiz, a)));   // as páginas de revisão podem ainda não existir

const versaoDe = {};
for (const a of assets) {
  versaoDe[a] = crypto.createHash('sha1')
    .update(fs.readFileSync(path.join(raiz, a))).digest('hex').slice(0, 8);
}

let trocadas = 0;
for (const pagina of fs.readdirSync(raiz).filter(f => f.endsWith('.html'))) {
  const caminho = path.join(raiz, pagina);
  const antes = fs.readFileSync(caminho, 'utf8');
  let html = antes;
  for (const a of assets) {
    const escapado = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(
      new RegExp('(href|src)="' + escapado + '(\\?v=[^"]*)?"', 'g'),
      '$1="' + a + '?v=' + versaoDe[a] + '"'
    );
  }
  if (html !== antes) { fs.writeFileSync(caminho, html, 'utf8'); trocadas++; }
}

console.log('\n  ok → data/cards.json, data/cards.js e data/cards-revisao.js');
console.log('  carimbo ?v= por arquivo; ' + trocadas + ' página(s) regravada(s)\n');
