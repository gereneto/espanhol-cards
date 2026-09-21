/* A leitura de conferência de uma leva, no formato que cabe no olho.

   O build pega o que é de forma: barra, parêntese, comprimento, distrator
   que o motor lê como a resposta certa. O que ele não pega é o que mais
   estraga um card — distrator que é outro sentido da palavra espanhola,
   quatro erradas do mesmo assunto, palavra que não existe — e isso só sai
   lendo. Este script põe cada card em cinco linhas, sem o JSON em volta, e
   aponta os suspeitos de categoria com a régua frouxa (três de quatro), que
   dá falso positivo demais para morar no build.

   uso: node fonte/revisar.js                 o baralho inteiro
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

const pasta = path.join(__dirname, 'cards');
const filtros = process.argv.slice(2);
const ehId = f => /^[a-z]+\d+$/.test(f);

let cards = [];
fs.readdirSync(pasta).filter(f => f.endsWith('.json')).sort().forEach(f => {
  JSON.parse(fs.readFileSync(path.join(pasta, f), 'utf8')).forEach(c => cards.push(Object.assign({ arquivo: f }, c)));
});
if (filtros.length) {
  cards = cards.filter(c => filtros.some(f => ehId(f) ? c.id === f : c.arquivo.includes(f)));
}

const VAZIAS = new Set(('o a os as um uma uns umas de da do das dos em no na nos nas por para pra com sem ' +
  'que e ou se me te ele ela eu voce nos eles esta estou foi muito mais nao ja ao aos pelo pela seu sua ' +
  'meu minha isso este esse como ate ter tem tudo bem num numa naquele naquela nenhum nenhuma').split(' '));
const palavras = t => new Set(String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z\s-]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !VAZIAS.has(w)).map(w => w.replace(/s$/, '')));

const suspeitos = [];
cards.forEach(c => {
  console.log(c.id + ' ' + c.nivel + (c.requer ? ' <' + c.requer : '') + ' [' + (c.tags || []).join(',') + ']');
  console.log('  ES ' + c.es + (c.aceitasEs ? '  ‖ ' + c.aceitasEs.join(' ; ') : ''));
  console.log('  PT ' + c.pt + '  ‖ ' + (c.aceitas || []).join(' ; '));
  console.log('  D  ' + (c.distratores || []).join(' | '));
  if (Motor.temVariante(c)) {
    const f = Motor.formaDoCard(c, 1);
    console.log('  G  ' + f.es + '  ‖ ' + f.pt);
  }
  if (c.formasEs) console.log('  F  ' + Object.keys(c.formasEs).map(f => f + ' (' + c.formasEs[f] + ')').join(' | '));
  if (c.nota) console.log('  N  ' + c.nota.replace(/\n/g, '\n     '));

  if ((c.tags || []).includes('conjugação')) return;
  const m = Motor.formaDoCard(c, 0);
  const certa = palavras([m.pt].concat(m.aceitas || []).join(' '));
  const conta = {};
  (m.distratores || []).forEach(d => palavras(d).forEach(w => { conta[w] = (conta[w] || 0) + 1; }));
  const comuns = Object.keys(conta).filter(w => conta[w] >= 3 && !certa.has(w));
  if (comuns.length) suspeitos.push(c.id + '  «' + comuns.join('», «') + '» em três ou mais distratores, e não na certa  —  ' + c.es);
});

console.log('\n' + cards.length + ' card(s).');
if (!filtros.length) {
  const maior = {};
  cards.forEach(c => { const m = c.id.match(/^([a-z]+)(\d+)$/); if (m) maior[m[1]] = Math.max(maior[m[1]] || 0, +m[2]); });
  console.log('Onde cada série de id parou: ' + Object.keys(maior).sort().map(k => k + maior[k]).join(', '));
}
if (suspeitos.length) {
  console.log('\nPara olhar de perto (régua frouxa; gênero e moldura da frase dão falso positivo):');
  suspeitos.forEach(s => console.log('  ' + s));
}
