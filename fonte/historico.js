/* Extrai a série exata das etapas do histórico do repositório de dados.
   Cada commit de progresso.json é uma fotografia do baralho inteiro — 452
   delas —, e de cada uma saem as contagens por etapa e o total de respostas.
   É a história de verdade, não uma reconstrução.

   uso: node historico.js <pasta-do-dados> <saida.js> */
const { execFileSync } = require('child_process');
const fs = require('fs');

const REPO = process.argv[2];
const SAIDA = process.argv[3];

function git(args) {
  return execFileSync('git', ['-C', REPO].concat(args),
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

const hashes = git(['log', '--reverse', '--format=%H', '--', 'progresso.json'])
  .trim().split('\n').filter(Boolean);
console.log('fotografias de progresso.json:', hashes.length);

const serie = [];
let ultimo = -1, falhas = 0;
hashes.forEach((h, i) => {
  let p;
  try { p = JSON.parse(git(['show', h + ':progresso.json'])); }
  catch (e) { falhas++; return; }
  const cards = p.cards || {};
  let esPt = 0, ptEs = 0, dom = 0;
  for (const id in cards) {
    const e = cards[id];
    if (!e || !e.vistas) continue;
    if (e.etapa === 'dominado') dom++;
    else if (e.etapa === 'multipla' || e.etapa === 'escrita') esPt++;
    else ptEs++;
  }
  const n = (p.totais && p.totais.respostas) || 0;
  /* Duas fotografias podem ter o mesmo número de respostas — o app sobe o
     progresso e o resumo em commits separados. Fica a última. */
  if (n === ultimo && serie.length) serie[serie.length - 1] = [n, esPt, ptEs, dom];
  else { serie.push([n, esPt, ptEs, dom]); ultimo = n; }
  if ((i + 1) % 100 === 0) console.log('  ' + (i + 1) + '/' + hashes.length);
});

serie.sort((a, b) => a[0] - b[0]);
console.log('pontos na série:', serie.length, '| falhas:', falhas);
console.log('primeira:', JSON.stringify(serie[0]), '| última:', JSON.stringify(serie[serie.length - 1]));

const saida = '/* Gerado por fonte/historico.js — a série exata das etapas, tirada das\n' +
  '   ' + serie.length + ' fotografias de progresso.json no repositório de dados.\n' +
  '   Cada ponto é [respostas, es→pt, pt→es, dominados]. O app usa isto uma vez,\n' +
  '   para semear progresso.serie; daí em diante ele mesmo vai anotando. */\n' +
  'window.HISTORICO_RAW = ' + JSON.stringify({ serie: serie }) + ';\n';
fs.writeFileSync(SAIDA, saida);
console.log('gravado:', SAIDA, '(' + Math.round(saida.length / 1024) + ' KB)');
