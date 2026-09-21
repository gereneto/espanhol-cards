/* A leitura de conferência de uma leva, no formato que cabe no olho.

   O build pega o que é de forma: barra, parêntese, comprimento, distrator
   que o motor lê como a resposta certa. O que ele não pega é o que mais
   estraga um card — distrator que é outro sentido da palavra, quatro erradas
   do mesmo assunto, palavra que não existe — e isso só sai lendo. Este script
   põe cada card em poucas linhas, sem o JSON em volta, e aponta os suspeitos
   de categoria com a régua frouxa (três de quatro), que dá falso positivo
   demais para morar no build.

   São três baralhos (ver PLANO.md), e a primeira linha de cada card diz de
   qual ele é. A língua que o baralho ensina vem primeiro; depois, a resposta
   de cada público, com os seus distratores e a sua nota.

   uso: node fonte/revisar.js                 tudo
        node fonte/revisar.js en              só o baralho de inglês
        node fonte/revisar.js 11-leva         só os arquivos com «11-leva» no nome
        node fonte/revisar.js p031 f133       só esses cards

   O passo a passo da leitura está em fonte/MANUAL-DOS-CARDS.md. */
const fs = require('fs');
const path = require('path');

/* O card de gênero guarda as duas formas num texto só («Tu herman{o|a} es
   muy maj{o|a}»). A leitura mostra a linha como ela está escrita, que é o
   que se revisa, e logo abaixo a frase já no feminino — que é a que ninguém
   vê ao escrever o card, e é onde o erro se esconde. Quem resolve as chaves
   é o motor, para não haver duas regras para a mesma marcação. */
const janela = {};
new Function('window', fs.readFileSync(path.join(__dirname, '..', 'js', 'motor.js'), 'utf8'))(janela);
const Motor = janela.Motor;

const IDIOMAS = ['es', 'en', 'pt'];
const AUDIENCIA_PRINCIPAL = { es: 'pt', en: 'pt', pt: 'es' };
const CAMPOS = {
  pt: { texto: 'pt', aceitas: 'aceitas',   distratores: 'distratores',   nota: 'nota',   formas: 'formasPt' },
  en: { texto: 'en', aceitas: 'aceitasEn', distratores: 'distratoresEn', nota: 'notaEn', formas: 'formasEn' },
  es: { texto: 'es', aceitas: 'aceitasEs', distratores: 'distratoresEs', nota: 'notaEs', formas: 'formasEs' }
};
const audienciasDe = idioma => [AUDIENCIA_PRINCIPAL[idioma]]
  .concat(IDIOMAS.filter(a => a !== idioma && a !== AUDIENCIA_PRINCIPAL[idioma]));

const pastaCards = path.join(__dirname, 'cards');
const filtros = process.argv.slice(2);
const ehId = f => /^([a-z]{2}-)?[a-z]+\d+$/.test(f);

let cards = [];
for (const idioma of IDIOMAS) {
  const pasta = path.join(pastaCards, idioma);
  if (!fs.existsSync(pasta)) continue;
  fs.readdirSync(pasta).filter(f => f.endsWith('.json')).sort().forEach(f => {
    JSON.parse(fs.readFileSync(path.join(pasta, f), 'utf8'))
      .forEach(c => cards.push(Object.assign({ arquivo: idioma + '/' + f, idioma }, c)));
  });
}
if (filtros.length) {
  cards = cards.filter(c => filtros.some(f =>
    ehId(f) ? c.id === f : (IDIOMAS.includes(f) ? c.idioma === f : c.arquivo.includes(f))));
}

const VAZIAS = new Set(('o a os as um uma uns umas de da do das dos em no na nos nas por para pra com sem ' +
  'que e ou se me te ele ela eu voce nos eles esta estou foi muito mais nao ja ao aos pelo pela seu sua ' +
  'meu minha isso este esse como ate ter tem tudo bem num numa naquele naquela nenhum nenhuma ' +
  'the of to in on it is are do does did not you he she they we and or up out off his her my ' +
  'your that this an was were be been have has had with for from at by as so if but all any').split(' '));
const palavras = t => new Set(String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z\s-]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !VAZIAS.has(w)).map(w => w.replace(/s$/, '')));

const suspeitos = [];
cards.forEach(c => {
  const L = CAMPOS[c.idioma];
  const rotulo = l => l.toUpperCase().padEnd(3);

  console.log(c.id + ' ' + c.nivel + (c.requer ? ' <' + c.requer : '') + ' [' + (c.tags || []).join(',') + ']');
  console.log('  ' + rotulo(c.idioma) + ' ' + c[L.texto] +
    (c[L.aceitas] ? '  ‖ ' + c[L.aceitas].join(' ; ') : ''));

  for (const a of audienciasDe(c.idioma)) {
    const A = CAMPOS[a];
    if (c[A.texto] === undefined) continue;
    console.log('  ' + rotulo(a) + ' ' + c[A.texto] + '  ‖ ' + (c[A.aceitas] || []).join(' ; '));
    console.log('  D   ' + (c[A.distratores] || []).join(' | '));
  }

  if (Motor.temVariante(c)) {
    const f = Motor.formaDoCard(c, 1);
    console.log('  G   ' + f[L.texto] + '  ‖ ' + f[CAMPOS[AUDIENCIA_PRINCIPAL[c.idioma]].texto]);
  }
  if (c[L.formas]) {
    console.log('  F   ' + Object.keys(c[L.formas]).map(f => f + ' (' + c[L.formas][f] + ')').join(' | '));
  }
  for (const a of audienciasDe(c.idioma)) {
    const nota = c[CAMPOS[a].nota];
    if (nota) console.log('  N' + a + ' ' + String(nota).replace(/\n/g, '\n      '));
  }

  if ((c.tags || []).includes('conjugação')) return;
  /* a régua roda sobre a forma masculina: com as chaves no meio,
     «vermelh{o|a}» não casaria com o «vermelho» do distrator */
  const m = Motor.formaDoCard(c, 0);
  for (const a of audienciasDe(c.idioma)) {
    const A = CAMPOS[a];
    if (!Array.isArray(m[A.distratores])) continue;
    const certa = palavras([m[A.texto]].concat(m[A.aceitas] || []).join(' '));
    const conta = {};
    m[A.distratores].forEach(d => palavras(d).forEach(w => { conta[w] = (conta[w] || 0) + 1; }));
    const comuns = Object.keys(conta).filter(w => conta[w] >= 3 && !certa.has(w));
    if (comuns.length) {
      suspeitos.push(c.id + ' [' + a + ']  «' + comuns.join('», «') +
        '» em três ou mais distratores, e não na certa  —  ' + m[L.texto]);
    }
  }
});

console.log('\n' + cards.length + ' card(s).');
if (!filtros.length || filtros.every(f => IDIOMAS.includes(f))) {
  for (const idioma of IDIOMAS) {
    const doBaralho = cards.filter(c => c.idioma === idioma);
    if (!doBaralho.length) continue;
    const maior = {};
    doBaralho.forEach(c => {
      const m = c.id.match(/^(?:[a-z]{2}-)?([a-z]+)(\d+)$/);
      if (m) maior[m[1]] = Math.max(maior[m[1]] || 0, +m[2]);
    });
    const prefixo = idioma === 'es' ? '' : idioma + '-';
    console.log('[' + idioma + '] onde cada série parou: ' +
      Object.keys(maior).sort().map(k => prefixo + k + String(maior[k]).padStart(3, '0')).join(', '));
  }
}
if (suspeitos.length) {
  console.log('\nPara olhar de perto (régua frouxa; gênero e moldura da frase dão falso positivo):');
  suspeitos.forEach(s => console.log('  ' + s));
}
