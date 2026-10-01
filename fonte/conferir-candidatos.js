/* Confere uma lista de candidatos contra o baralho ANTES de escrever os cards.

   É a conferência mais barata do projeto e a que mais rende. O build acha card
   repetido depois de o card existir — depois de escrever `aceitas`, quatro
   distratores em duas línguas e duas notas. Esta acha antes, com uma linha por
   candidato, e usa a régua do motor: duas frases diferentes podem ser o mesmo
   card para quem responde, porque o funil derruba artigo, pronome e plural.

   Nasceu da leva 10 do inglês, em que onze das cem frases já estavam no
   baralho — dez pela letra e uma só pelo funil («It is not for me to say.»
   contra «It's not for me to say.»). Na leva 11, conferida antes, ela achou
   onze das trinta e seis de uma vez.

   O arquivo de candidatos é um JSON com uma tripla por linha, na ordem em que
   o card vai ter os campos:

     [["the fish","o peixe","el pez"],
      ["the dog","o cachorro","el perro"]]

   Confere cada um contra o `es` (ou `en`, ou `pt`) de todos os cards do
   baralho, e também contra os candidatos anteriores da própria lista — porque
   repetir dentro da leva é tão ruim quanto repetir o baralho.

   uso: node fonte/conferir-candidatos.js <arquivo.json> [idioma]
        node fonte/conferir-candidatos.js /tmp/cand.json en   (o padrão é en) */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const arquivo = process.argv[2];
const idioma = process.argv[3] || 'en';

if (!arquivo) {
  console.error('\n  uso: node fonte/conferir-candidatos.js <arquivo.json> [idioma]\n');
  process.exit(1);
}

const janela = {};
new Function('window', fs.readFileSync(path.join(RAIZ, 'js', 'motor.js'), 'utf8'))(janela);
const M = janela.Motor;

const pasta = path.join(__dirname, 'cards', idioma);
let baralho = [];
for (const f of fs.readdirSync(pasta)) {
  baralho = baralho.concat(JSON.parse(fs.readFileSync(path.join(pasta, f), 'utf8')));
}

/* uma forma de gênero por chave: o card {o|a} entra duas vezes */
const LINGUAS = ['en', 'pt', 'es'];
const noBaralho = { en: new Map(), pt: new Map(), es: new Map() };
baralho.forEach(bruto => M.formasDoCard(bruto).forEach(c => {
  LINGUAS.forEach(L => {
    const k = M.normalizar(c[L], L);
    if (k && !noBaralho[L].has(k)) noBaralho[L].set(k, c.id);
  });
}));

const candidatos = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
const naLista = { en: new Map(), pt: new Map(), es: new Map() };
let choques = 0;

for (const tripla of candidatos) {
  const [en, pt, es] = tripla;
  const achados = [];
  for (const [L, texto] of [['en', en], ['pt', pt], ['es', es]]) {
    if (texto == null) continue;
    const k = M.normalizar(texto, L);
    if (!k) continue;
    if (noBaralho[L].has(k)) achados.push(L + '=' + noBaralho[L].get(k));
    else if (naLista[L].has(k)) achados.push(L + '=o candidato «' + naLista[L].get(k) + '»');
    else naLista[L].set(k, en);
  }
  if (achados.length) {
    choques++;
    console.log('  CHOQUE [' + achados.join(' ') + ']  ' + en + '  |  ' + pt + '  |  ' + es);
  }
}

console.log('');
console.log('  ' + candidatos.length + ' candidato(s) contra ' + baralho.length +
            ' card(s) do baralho de ' + idioma + '.');
console.log(choques ? '  ' + choques + ' precisa(m) de outra frase.'
                    : '  nenhum choque: todos livres nas três línguas.');
console.log('');
