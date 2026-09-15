/* Extrai do repositório de dados a história que o painel desenha. Cada
   commit de progresso.json é uma fotografia do baralho inteiro — setecentas
   e tantas —, e delas saem:

     serie        as contagens por etapa a cada sincronização (o caminho)
     diario       respostas por dia: quantas, quantas certas, em que hora, e
                  o tempo típico dos acertos de cada modo
     retencao     as revisões de dominado por degrau da escada, e as certas
     ateDominar   quantas respostas cada card levou até o primeiro domínio

   É a história de verdade, não uma reconstrução. As respostas saem do
   histórico de cada card, que guarda as últimas doze: como as fotografias
   vêm a cada três respostas, nenhuma escapa entre uma e outra.

   uso: node historico.js <pasta-do-dados> <saida.js> */
const { execFileSync } = require('child_process');
const fs = require('fs');

const REPO = process.argv[2];
const SAIDA = process.argv[3];

function git(args) {
  return execFileSync('git', ['-C', REPO].concat(args),
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

const hashes = git(['log', '--reverse', '--format=%H', '--', 'progresso.json'])
  .trim().split('\n').filter(Boolean);
console.log('fotografias de progresso.json:', hashes.length);

/* O dia e a hora são os de Brasília, onde as respostas foram dadas — sem
   horário de verão desde 2019, então três horas fixas bastam. O app, daqui
   em diante, usa o fuso do aparelho. */
const local = iso => new Date(Date.parse(iso) - 3 * 3600e3);

const serie = [];
const respostas = new Map();          // card|em → a resposta
const retencao = [0, 0, 0, 0, 0, 0].map(() => [0, 0]);
const ateDominar = {};
const anterior = {};
let ultimo = -1, falhas = 0;

hashes.forEach((h, i) => {
  let p;
  try { p = JSON.parse(git(['show', h + ':progresso.json'])); }
  catch (e) { falhas++; return; }
  const cards = p.cards || {};
  /* Os dominados saem já divididos pelo degrau da escada — «revisoes», de 0
     a 5, que é o índice de DIAS_DOMINADO. */
  let esPt = 0, ptEs = 0;
  const degraus = [0, 0, 0, 0, 0, 0];
  for (const id in cards) {
    const e = cards[id];
    if (!e || !e.vistas) continue;
    if (e.etapa === 'dominado') degraus[Math.min(e.revisoes || 0, 5)]++;
    else if (e.etapa === 'multipla' || e.etapa === 'escrita') esPt++;
    else ptEs++;

    (e.historico || []).forEach(x => {
      if (x && x.em && !respostas.has(id + '|' + x.em)) respostas.set(id + '|' + x.em, x);
    });

    /* Estava dominado na fotografia anterior e foi respondido desde então: a
       primeira resposta nova é a revisão, no degrau em que ele estava. O
       dominado volta por data, então entre duas fotografias há uma só. */
    const antes = anterior[id];
    if (antes && antes.etapa === 'dominado' && e.vistas > antes.vistas) {
      const nova = (e.historico || []).filter(x => x.em > antes.ultima)
        .sort((a, b) => a.em < b.em ? -1 : 1)[0];
      if (nova) {
        const g = retencao[Math.min(antes.revisoes || 0, 5)];
        g[0]++; if (nova.acertou) g[1]++;
      }
    }
    if (e.etapa === 'dominado' && ateDominar[id] === undefined) ateDominar[id] = e.vistas;
    anterior[id] = { etapa: e.etapa, vistas: e.vistas, revisoes: e.revisoes, ultima: e.ultima };
  }
  const n = (p.totais && p.totais.respostas) || 0;
  const ponto = [n, esPt, ptEs].concat(degraus);
  /* Duas fotografias podem ter o mesmo número de respostas — o app sobe o
     progresso e o resumo em commits separados. Fica a última. */
  if (n === ultimo && serie.length) serie[serie.length - 1] = ponto;
  else { serie.push(ponto); ultimo = n; }
  if ((i + 1) % 100 === 0) console.log('  ' + (i + 1) + '/' + hashes.length);
});

serie.sort((a, b) => a[0] - b[0]);

/* O diário, no mesmo formato que o app anota (ver Motor.anotarDiario). */
const diario = {};
let ate = '';
respostas.forEach(x => {
  const t = local(x.em);
  const d = t.toISOString().slice(0, 10);
  const g = diario[d] || (diario[d] = { n: 0, ok: 0, h: new Array(24).fill(0), m: {}, e: {} });
  g.n++;
  if (x.acertou) g.ok++;
  g.h[t.getUTCHours()]++;
  const tempo = x.modo === 'multipla' ? g.m : x.modo === 'escrita' ? g.e : null;
  if (tempo && x.acertou && !x.pausado && x.ms > 0) {
    const k = Math.max(0, Math.min(35, Math.floor(6 * Math.log(x.ms / 300))));
    tempo[k] = (tempo[k] || 0) + 1;
  }
  if (x.em > ate) ate = x.em;
});

console.log('pontos na série:', serie.length, '| falhas:', falhas);
console.log('respostas no diário:', respostas.size, 'em', Object.keys(diario).length, 'dias');
console.log('revisões por degrau:', JSON.stringify(retencao), '| cards com domínio:', Object.keys(ateDominar).length);

const saida = '/* Gerado por fonte/historico.js a partir das ' + hashes.length + ' fotografias de\n' +
  '   progresso.json no repositório de dados. O app usa isto uma vez, para\n' +
  '   semear a série, o diário, a retenção e as respostas até o domínio;\n' +
  '   daí em diante ele mesmo vai anotando. */\n' +
  'window.HISTORICO_RAW = ' + JSON.stringify({ ate, serie, diario, retencao, ateDominar }) + ';\n';
fs.writeFileSync(SAIDA, saida);
console.log('gravado:', SAIDA, '(' + Math.round(saida.length / 1024) + ' KB)');
