/* Varre um baralho com o motor de verdade, nas quatro direções que ele
   sustenta. É a conferência que o build não faz: o build lê a fonte, e esta
   roda `js/motor.js` por cima do que o build gerou, que é o que o app usa.

   O que ela garante, card a card e direção a direção:

   1. a resposta certa é lida como certa;
   2. toda entrada de `aceitas` e de `regionais` também é — inclusive as que o
      funil deveria dar de graça, porque é aí que a mudança do funil aparece;
   3. a múltipla escolha sorteia cinco alternativas distintas;
   4. a resposta certa está entre as cinco;
   5. nenhuma das quatro erradas é lida como certa.

   O item 5 é o que mais pega: distrator que o funil iguala à certa, forma de
   `formasEn` que colide com uma aceita, variante regional usada como
   alternativa errada. O build enxerga parte disso na fonte; o motor enxerga o
   resto, porque ele normaliza de verdade.

   Nasceu como script de rascunho e morou numa pasta temporária até 01/10,
   quando a limpeza a apagou no meio de uma leva. Agora mora aqui, junto do
   build e do revisar, porque é parte do fechamento de toda leva.

   O sorteio se repete porque a alternativa só aparece quando é sorteada. Com
   distrator escrito no card os quatro saem sempre, e um sorteio bastaria; os
   que saem do baralho — a frase vizinha, a troca de palavra, a forma do
   verbo — mudam a cada vez. Quatro sorteios custam dois minutos nos mil cards
   e já cobrem bem; vinte custam vinte minutos, porque cada sorteio varre o
   baralho inteiro para escolher a vizinha.

   uso: node fonte/varrer-motor.js [idioma] [sorteios]
        node fonte/varrer-motor.js en 4      (é o padrão) */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const idioma = process.argv[2] || 'en';
const SORTEIOS = Number(process.argv[3] || 4);

const janela = {};
new Function('window', fs.readFileSync(path.join(RAIZ, 'js', 'motor.js'), 'utf8'))(janela);
const M = janela.Motor;

const arq = idioma === 'es' ? 'cards.json' : 'cards-' + idioma + '.json';
const caminho = path.join(RAIZ, 'data', arq);
if (!fs.existsSync(caminho)) {
  console.error('não achei ' + path.relative(RAIZ, caminho) + ' — rode `node fonte/build.js` primeiro');
  process.exit(1);
}
const FONTE = JSON.parse(fs.readFileSync(caminho, 'utf8')).cards;

/* o quarteto de cada língua, e de onde sai a lista de respostas aceitas */
const CAMPOS = {
  pt: { certa: 'pt', aceitas: 'aceitas', regionais: 'regionais' },
  en: { certa: 'en', aceitas: 'aceitasEn', regionais: 'regionaisEn' },
  es: { certa: 'es', aceitas: 'aceitasEs', regionais: 'regionaisEs' }
};

/* as quatro direções: o idioma do baralho contra cada um dos dois públicos */
const audiencias = ['pt', 'en', 'es'].filter(a => a !== idioma);
const direcoes = [];
audiencias.forEach(a => { direcoes.push(idioma + '-' + a); direcoes.push(a + '-' + idioma); });

/* estado de quem já viu o card algumas vezes: é o que destrava a múltipla
   escolha e os distratores dinâmicos */
const estados = {};
FONTE.forEach(c => { estados[c.id] = Object.assign(M.estadoInicial(c.id), { vistas: 3, erros: 1 }); });

const problemas = [];
const erro = (id, msg) => problemas.push('  - ' + id + '  ' + msg);

const CARDS = FONTE.map(c => M.formaDoCard(c, 0));

for (const bruto of FONTE) {
  /* card de gênero rende duas formas, e as duas têm de passar */
  for (const c of M.formasDoCard(bruto)) {

    for (const direcao of direcoes) {
      const lingua = M.linguaDaResposta(direcao);
      const campo = CAMPOS[lingua];
      const certa = c[campo.certa];
      if (typeof certa !== 'string' || !certa.trim()) continue;

      /* 1 e 2: a certa e tudo que o card diz aceitar */
      const devemPassar = [certa]
        .concat(c[campo.aceitas] || [])
        .concat(Object.keys(c[campo.regionais] || {}));
      for (const resp of devemPassar) {
        const v = M.conferir(c, resp, direcao);
        if (v !== 'certo') erro(c.id, '[' + direcao + '] não aceitou «' + resp + '» (' + v + ')');
      }

      /* 3, 4 e 5: a múltipla escolha, repetida para pegar o sorteio ruim */
      for (let i = 0; i < SORTEIOS; i++) {
        let alts;
        try { alts = M.alternativas(c, direcao, CARDS, estados); }
        catch (e) { erro(c.id, '[' + direcao + '] alternativas() estourou: ' + e.message); break; }
        if (!Array.isArray(alts) || alts.length !== 5) {
          erro(c.id, '[' + direcao + '] saíram ' + (alts ? alts.length : 'zero') + ' alternativas, e não cinco');
          break;
        }
        const vistos = new Set(alts.map(a => M.normalizar(String(a), lingua)));
        if (vistos.size !== 5) { erro(c.id, '[' + direcao + '] duas alternativas iguais: ' + alts.join(' | ')); break; }

        const certas = alts.filter(a => M.conferir(c, String(a), direcao) === 'certo');
        if (certas.length === 0) { erro(c.id, '[' + direcao + '] a resposta certa não saiu entre as cinco'); break; }
        if (certas.length > 1) {
          erro(c.id, '[' + direcao + '] duas alternativas lidas como certas: ' + certas.join(' | '));
          break;
        }
      }
    }
  }
}

console.log('');
console.log('  ' + FONTE.length + ' card(s) do baralho de ' + idioma + ', ' + SORTEIOS +
            ' sorteios em cada uma das ' + direcoes.length + ' direções (' + direcoes.join(', ') + ').');
if (!problemas.length) {
  console.log('  passaram: cinco alternativas distintas, a certa entre elas, nenhum distrator lido como certo, aceitas de pé.');
  console.log('');
} else {
  console.log('');
  console.log('  ' + problemas.length + ' problema(s):');
  problemas.slice(0, 60).forEach(p => console.log(p));
  if (problemas.length > 60) console.log('  … e mais ' + (problemas.length - 60) + '.');
  console.log('');
  process.exit(1);
}
