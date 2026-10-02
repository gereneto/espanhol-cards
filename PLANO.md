# Plano dos três baralhos

Este arquivo é o contrato do trabalho grande: levar o app de um baralho de
espanhol a **três baralhos**, que cobrem as seis direções entre português,
espanhol e inglês. Ele guarda as decisões tomadas, o formato dos dados e onde
cada etapa parou — para que uma conversa nova (ou uma janela de contexto nova)
comece lendo isto e o `git log`, e não do zero.

O **como se escreve um card** continua em [`fonte/MANUAL-DOS-CARDS.md`](fonte/MANUAL-DOS-CARDS.md).
Aqui está o **que** se escreve, em que ordem, e com que formato.

---

## 1. Seis direções, três baralhos

Um card já é estudado nos dois sentidos — o app vira a direção quando você
domina a primeira — e já carrega as três línguas. Então cada baralho serve a
duas direções:

| baralho | língua ensinada | serve a quem fala | cards |
|---|---|---|---|
| espanhol | `es` | português, inglês | **1000, prontos** |
| inglês | `en` | português, espanhol | a fazer |
| português | `pt` | espanhol, inglês | a fazer |

São 2000 cards novos para fechar mil em cada uma das seis direções.

## 2. As decisões (21/09/2026)

1. **Três baralhos, não seis.** Cada card carrega os três lados e serve aos
   dois públicos do seu baralho. Os falsos amigos de quem fala português e de
   quem fala espanhol coincidem quase sempre («exquisito», «pretender»,
   «actualmente»), e onde não coincidem quem resolve é a nota.
2. **Todo card vale para os dois públicos**, e a **nota de cada língua ensina o
   que aquele público precisa** — a regra que o manual já tem para a `notaEn`.
   Não há campo de público nem fila filtrada: quem já sabe aperta «já conhecia».
3. **Inglês americano**, com o britânico em `aceitasEn` e na nota, como hoje o
   espanhol da América Latina entra na nota do baralho da Espanha. O lado
   inglês dos mil cards de espanhol foi escrito com a mão britânica e fica como
   está — lá o inglês é resposta, não é o que se ensina.
4. **Português do Brasil**, com a forma de Portugal na nota e, quando corrente,
   nas aceitas.
5. **O baralho de inglês começa do zero (A1 a C2).** No espanhol, «la silla»
   não merece card porque o português entrega; no inglês, «shelf», «spoon» e
   «sink» não se adivinham, e por isso a faixa A1-A2 rende muito mais card ali
   do que aqui.
6. **Inglês primeiro**, português depois.
7. **A leva de estreia teve 30 cards**, lidos um a um pelo Gere e aprovados sem
   mudança. Dali em diante a leva é de **cerca de cem cards**, e a revisão
   profunda passa a ser a do uso: o Gere e os outros usuários acham o defeito
   estudando, pelos três canais de retorno. A leitura no `revisar.js` continua
   obrigatória antes de cada commit — foi ela que pegou os catorze defeitos da
   leva 2, que o build não via.
8. **As telas do app não são minhas.** Eu entrego o formato dos dados, o build
   e esta documentação; a tela de escolha do curso («que língua você fala, que
   língua quer aprender») fica com o Gere.
   *Consequência anotada:* enquanto o app não souber escolher curso, os cards
   novos não recebem comentário, contestação nem «deu quase» — os três canais
   que consertaram o baralho espanhol leva após leva.

## 3. O formato

### As pastas

```
fonte/cards/es/NN-*.json     o baralho de espanhol (os treze arquivos de hoje)
fonte/cards/en/NN-*.json     o baralho de inglês
fonte/cards/pt/NN-*.json     o baralho de português
fonte/tags.json              um dicionário de temas só, para os três
```

A regra de sempre vale dentro de cada baralho: **o arquivo é a data, a
etiqueta é o índice**.

### Os ids

Os mil cards de espanhol mantêm o id nu (`p001`, `f003`, `v016`, `u023`): o
progresso de estudo é chaveado por id, e renomear jogaria fora o histórico.
Os baralhos novos levam o prefixo da língua, e assim nenhum id se repete quando
alguém estudar dois cursos no mesmo aparelho:

```
en-p001  en-f001  en-v001  en-u001
pt-p001  pt-f001  pt-v001  pt-u001
```

As séries continuam as mesmas: **p** palavra, **f** frase ou expressão, **v**
forma verbal, **u** frase de uso presa a uma palavra.

### Os campos

O card não muda de forma: cada língua tem o seu quarteto, e a língua ensinada
é a do baralho. Nada aqui é novo — é o formato de hoje, lido de maneira
simétrica.

| língua | resposta | outras aceitas | distratores | nota |
|---|---|---|---|---|
| português | `pt` | `aceitas` | `distratores` | `nota` |
| inglês | `en` | `aceitasEn` | `distratoresEn` | `notaEn` |
| espanhol | `es` | `aceitasEs` | `distratoresEs` | `notaEs` |

- No baralho de **espanhol**, `es` é o que se cobra; `pt` e `en` são as
  respostas dos dois públicos.
- No baralho de **inglês**, `en` é o que se cobra; `pt` e `es` são as respostas
  — e é aí que entram `distratoresEs` e `notaEs`, que o baralho espanhol nunca
  precisou.
- No baralho de **português**, `pt` é o que se cobra; `es` e `en` respondem.

As formas verbais seguem o mesmo desenho: `formasEn` são as outras formas da
frase inglesa, com o rótulo em português, e `formasEnPt`/`formasEnEs` trazem os
mesmos textos com o rótulo na língua de quem pergunta — exatamente como
`formasEs` e `formasEsEn` funcionam hoje.

A marcação de gênero `{masculino|feminino}` (seção 4.1 do manual) vale nos três
baralhos.

### A saída

```
data/cards.js          espanhol sem o lado inglês — o que o app de hoje carrega
data/cards-revisao.js  espanhol completo — o que as telas de revisão carregam
data/cards.json        espanhol, indentado, para ler com o olho
data/cards-en.js       o baralho de inglês, completo
data/cards-pt.js       o baralho de português, completo
```

Cada arquivo põe o seu baralho em `window.BARALHOS[idioma]`. Os dois nomes
antigos do espanhol continuam pondo também em `window.CARDS_RAW`, que é de
onde o app lê hoje — e o `cards-revisao.js`, por ser o espanhol completo,
responde pelos dois. Quando a tela de escolha do curso existir, ela lê o
`BARALHOS`; aí o `cards-revisao.js` vira `cards-es.js` e o `CARDS_RAW` sai de
cena.

## 4. O que rende card em cada língua

O critério do manual — **o que a língua de quem estuda não entrega** — dá
baralhos de feitios bem diferentes.

### Inglês (para quem fala português ou espanhol)

- **Falso amigo**, a espinha, como no espanhol: `pretend`, `actually`,
  `eventually`, `realize`, `sensible`, `library`, `parents`, `fabric`,
  `assist`, `attend`, `college`, `exit`, `notice`, `push`, `record`, `resume`,
  `support`, `terrific`. Quase todos enganam os dois públicos.
- **Phrasal verb** — o que mais falta às duas línguas: `give up`,
  `put up with`, `look forward to`, `run out of`, `come across`, `turn down`,
  `figure out`, `show up`, `get along`, `look after`.
- **Preposição e colocação**: `depend on`, `married to`, `listen to`,
  `arrive at/in`, `good at`, `interested in`, `wait for`, `on the weekend`.
- **Verbo irregular**, no lugar que a conjugação ocupa no espanhol: as três
  formas (`bring/brought/brought`), com as outras formas em `formasEn`.
- **Vocabulário opaco**, que no espanhol não renderia card: `shelf`, `spoon`,
  `sink`, `towel`, `bill`, `tap`/`faucet`, `aisle`, `blanket`.
- **Gramática sem equivalente**: present perfect contra o passado simples,
  `used to`, `there is/are`, contáveis e incontáveis (`an advice` não existe),
  `do/does` na pergunta, `get` como verbo de mudança.

### Português (para quem fala espanhol ou inglês)

- Para quem fala **espanhol**, os 175 falsos amigos de hoje se invertem quase
  de graça, agora ensinando a palavra portuguesa: `a borracha`, `o copo`,
  `a oficina`, `o sobremesa`… A nota em espanhol traz o par ao contrário.
- Para quem fala **inglês**, o que pesa é outra coisa: gênero dos
  substantivos, `ser`/`estar`, o pretérito perfeito composto, a colocação do
  pronome, `por`/`para`, os diminutivos, e o vocabulário sem cognato.
- Em comum: as expressões do dia a dia, a conjugação irregular e o português
  falado que a gramática não explica («né», «a gente», «pois é»).

## 5. As etapas

| # | etapa | estado |
|---|---|---|
| 0 | Formato: pastas por baralho, ids com prefixo, build e revisar.js lendo os três, manual generalizado | **feito** (21/09) |
| 1 | Inglês, leva de estreia: 30 cards variados, lidos um a um | **feito** (21/09) — aprovados sem mudança |
| 2 | Inglês, leva 2: 100 cards (22 palavras com frase de uso, 36 frases, 20 formas verbais) | **feito** (21/09) — o baralho está em 130 |
| 3 | Inglês, leva 3: 100 cards (22 palavras com frase de uso, 36 frases, 20 formas verbais) | **feito** (21/09) — o baralho está em 230 |
| 4 | Inglês, leva 4: 100 cards puxando para B2, C1 e as primeiras C2 | **feito** (21/09) — o baralho está em 330 |
| 5 | Inglês, leva 5: 100 cards, a segunda leva avançada | **feito** (21/09) — o baralho está em 430 |
| 6 | Inglês, leva 6: 100 cards, o A1 e o A2 que faltavam, mais um bloco de C2 | **feito** (21/09) — o baralho está em 530 |
| 7 | Inglês, leva 7: 100 cards de base e de conversa | **feito** (21/09) — o baralho está em 630 |
| 8 | Inglês, leva 8: 100 cards de corpo, de base e de conversa | **feito** (22/09) — o baralho está em 730 |
| 9 | Inglês, leva 9: 100 cards, e os pares entre o inglês americano e o britânico | **feito** (01/10) — o baralho está em 830 |
| 10 | Inglês, leva 10: 100 cards de base — cozinha, roupa, feira, tempo, loja — e trinta de conversa | **feito** (01/10) — o baralho está em 930 |
| 11 | Inglês, leva 11: 70 cards para fechar os mil | **feito** (01/10) — o baralho está em **1000** |
| 12 | Textos: a trilha, o formato e o primeiro poema (Machado) | **feito** (01/10) — falta o lado do app |
| n | Português, leva de estreia e depois o resto | — |
| — | Telas do app (escolha do curso) | do Gere |

Depois da leva 1 ficam dois acertos pendentes no motor, que só pesam quando o
app for estudar inglês: o aviso de **resposta certa na língua errada** lê só os
pares `🇪🇸 → 🇧🇷` da nota (o baralho de inglês escreve `🇺🇸 → 🇧🇷` e `🇺🇸 → 🇪🇸`),
e as réguas de acento, de «ñ» e de flexão são do espanhol — em inglês elas
simplesmente não disparam, o que não estraga nada, mas também não ajuda.

A leva 4 encontrou um terceiro limite, e este é de desenho, não de conserto:
**a marcação de gênero `{o|a}` não serve ao baralho de inglês quando o que
muda é a concordância do adjetivo.** O texto perguntado é o inglês, que não
concorda — «I feel completely overwhelmed» sai idêntico nos dois sorteios, e o
build lê como card repetido. Ela continua valendo onde o próprio inglês muda
(`my brother`/`my sister`, `his`/`her`); no adjetivo, o card fica no masculino
com o feminino em `aceitas`, que é o que o manual já manda para a palavra.

A curva de níveis do inglês vem sendo corrigida de propósito, leva a leva. As
levas 2 e 3 ficaram todas entre A2 e B2 porque foram atrás do que é mais
frequente; as levas 4 e 5 abriram a faixa alta; e a leva 6 voltou à base, que
estava pior do que eu tinha notado — o A1 tinha **oito** cards contra um alvo
de setenta e cinco, e eu vinha relatando só a falta de C2. Em 530 cards o
inglês está em **A1:20 A2:120 B1:155 B2:130 C1:80 C2:25**, contra o alvo do
espanhol, que é A1:75 A2:285 B1:307 B2:177 C1:100 C2:56.

**O baralho de inglês está fechado em mil**, e a curva de níveis saiu
idêntica à do espanhol: **A1:75 A2:285 B1:307 B2:177 C1:100 C2:56** nos dois.
Não foi coincidência — a leva 11 foi calculada para isso, com A1 +7, A2 +24,
B1 +22, B2 +6, C1 +5 e C2 +6, que era exatamente o que faltava. São 211
palavras com a frase de uso ao lado, 194 formas verbais e 395 frases.

A próxima etapa é o **baralho de português**, do zero, para quem fala espanhol
e para quem fala inglês. O que o inglês ensinou sobre ordem de trabalho vale
inteiro ali, e uma coisa a mais: o baralho de português é o primeiro em que as
duas línguas de casa são línguas que eu não falo de nascença, então a régua de
«isto soa natural?» passa a depender mais da leitura card a card e menos do
ouvido.

A leva 9 também mudou a série dos verbos de ofício, e por necessidade: depois
de cento e trinta verbos irregulares, o poço secou. A série `v` continua sendo
o que o nome diz — **forma verbal** —, e passa a cobrir modal, condicional,
passiva e aspecto composto, que é justamente o B1 que falta. Dos vinte cards
de verbo da leva 9, dezenove são de forma e um só é de verbo irregular novo.

Cada leva termina fechada: `node fonte/build.js`, leitura no `revisar.js`,
varredura do motor, e mais uma conferência que a leva 5 mostrou ser
necessária — **nenhuma resposta certa pode se repetir entre dois cards do
mesmo baralho, em nenhuma das três línguas**. «Tough» e «harsh» tinham os dois
«duro» do lado espanhol; a leva 6 trouxe mais dois, «Você que sabe» e «Perdi
minhas chaves», os dois do lado português. É defeito que o build não vê e que
a leitura não pega, porque os cards ficam longe um do outro — só a conferência
automática acha. O baralho de espanhol já passou por ela e está limpo.

A leva 8 acrescentou uma segunda conferência de uma linha só, e ela também
pagou na estreia: **nenhum campo espanhol pode ter «ç», «ã» ou «õ»**, que são
letras que o espanhol não tem. Um distrator de `en-f251` estava
escrito «cabeça», com a cedilha portuguesa, e nem o build nem a leitura viram.
A leva 9 encontrou um terceiro campo que o baralho de inglês não usava: os
dois que a outra conversa criou para o espanhol em 26/09, `sinonimosEs` e
`regionaisEs`, têm nome genérico no build e no motor, e por isso
`regionaisEn` já funcionava sem precisar de código. **A decisão 3 — inglês
americano, com o britânico em `aceitasEn` e na nota — fica melhor servida
por ele**: o britânico continua valendo e agora o app diz de onde é. Treze
cards antigos passaram para lá e a leva 9 nasceu com onze pares novos.

A varredura do motor virou ferramenta do projeto na leva 9, e por um susto:
ela vivia num arquivo de rascunho, numa pasta temporária, e a limpeza o apagou
no meio da leva. Agora é `fonte/varrer-motor.js`, ao lado do build, e a seção
12 do manual a põe na lista. Quatro sorteios por direção bastam: o distrator
escrito no card sai sempre, e o que muda a cada vez é o que o app escolhe do
baralho. Lição além do script: **nada que a leva precisa pode morar fora do
repositório.**

A leva 11 confirmou, com número, a lição que a leva 10 cobrou caro: a
conferência dos **candidatos** antes de escrever. Das 36 frases que eu ia
escrever, **onze já estavam no baralho** — e o script que as compara pelo funil
nas três línguas as achou em um segundo, antes de qualquer card existir. Mais
duas foram pegas depois porque eu as acrescentei sem passar pela conferência,
o que é o mesmo erro em escala menor. O script virou parte do fechamento de
leva, ao lado do build e da varredura.

A leva 10 cobrou o preço de uma conferência que eu fazia na ordem errada.
Onze das cem frases **já estavam no baralho**: eu tinha conferido a lista de
palavras antes de escrever, e as frases não. O build pegou dez pela letra, e a
décima primeira só a varredura viu — «It is not for me to say.» contra o
`en-f157` «It's not for me to say.», que o funil iguala porque derruba o
sujeito. Três lições, nessa ordem de importância:

- **a conferência de repetido vale para os candidatos, não para o resultado**:
  antes de escrever cem cards, passar a lista de frases pelo funil do motor
  nas três línguas custa um comando e poupa onze reescritas;
- **o build ganhou a guarda que faltava**: além do texto igual, ele agora barra
  dois cards que o funil não distingue. Os 1930 cards passam limpos, então a
  guarda nasceu sem dívida;
- **dividir a resposta já é repetir o card**. Quatro pares tinham o inglês
  diferente e a resposta igual nas duas línguas de casa — «Quanto custa?» em
  dois cards, «Isso não vem ao caso» em dois, «Vale a tentativa» em dois. Pior
  que isso, `en-p185` «the kitchen» chegou pedindo «la cocina», que já era a
  resposta do `en-p153` «the stove»: **card novo pode quebrar card velho**. O
  fogão passou a «el fogón», com «la cocina» ainda aceita e o aviso de que a
  palavra espanhola serve ao aparelho e à sala.

Depois disso, commit e push. É o commit que serve de memória, não a conversa.

---

## 6. Os textos (trilhas)

Decidido com o Gere em 01/10. **Um texto não é um card: é uma trilha.** O aluno
liga a trilha de um texto, e ela vai soltando cards na fila até o texto estar
inteiro na cabeça. No fim o app anuncia e mostra o texto completo.

As regras, todas do Gere:

- **só textos em domínio público, reconhecidos pela qualidade** — poemas,
  principalmente, e também excertos curtos de prosa de ficção e de não-ficção.
  Cada texto é aprovado por ele antes de qualquer card existir, e o arquivo
  guarda em `dominio` a conta que põe o texto em domínio público;
- **as palavras do texto ganham card**, as que ainda não tiverem — e só as que
  mereceriam card pela seção 2 do manual. «De», «la», «y» e «camino» ficam de
  fora: não ensinam nada a quem fala português, e card de acerto fácil mexe no
  agendamento de todos os outros;
- **a cada verso, ou a cada frase completa na prosa, um card** — do primeiro em
  diante;
- **o card do verso só é liberado quando todas as palavras dele estiverem
  dominadas.** Palavra sem card não entra na conta: ela não tem como ser
  dominada, e quem fala português já a entende;
- **nada disso começa antes de 500 cards dominados.** Daí em diante, **a cada
  três cards novos, um é do texto da vez**;
- quando o último verso for dominado, o app avisa e mostra o texto inteiro.

### O formato

O texto mora em `fonte/textos/<idioma>/`, fora de `fonte/cards/`, e **leva
os cards dos versos dentro de si**. Não é organização: é proteção. Card de verso
em `fonte/cards/` cairia na fila normal no primeiro build, antes de a
trilha existir — apareceria no estudo do Gere no dia seguinte, solto, fora de
ordem e sem as palavras dele vistas.

O arquivo tem `id`, `titulo`, `autor`, `obra`, `ano`,
`dominio`, `nota`/`notaEn`, a lista `versos` e a lista
`cards`. Cada verso é `{n, card}`, e **o mesmo id de card pode
aparecer duas vezes**: «caminante, no hay camino» é o verso 3 e o verso 9 do
Machado, e dois cards com o mesmo espanhol o build barra — então a lista aponta
para ids. Cada card de verso leva `texto` (o id da trilha) e, quando precisa,
`requerTodas` com os ids das palavras que têm de estar dominadas.

O build junta os cards de verso ao baralho **só para validá-los** — passam pelas
mesmas checagens de todo card — e depois os separa: o baralho sai em
`data/cards-<idioma>.js` e as trilhas em `data/textos-<idioma>.js`, que
põe tudo em `window.TEXTOS[idioma]`. A varredura do motor também corre por
eles, porque vão ser respondidos como qualquer card.

### O primeiro texto, e o que ele ensinou

«Caminante, no hay camino», de Antonio Machado (1912), dez versos. Rendeu **três
palavras novas** — «la huella», «sino» e «la estela» — com as três frases de uso,
e **nove cards de verso** para dez linhas. Três coisas que só apareceram ao
fazer:

- **o verso repetido**, que obrigou a lista de versos a apontar para ids;
- **a régua do manual quase não tranca nada.** Das nove linhas, só duas têm
  palavra com card: a 1 («huellas») e a 10 («sino», «estelas»). As outras sete
  abrem na hora. Quem manda no ritmo, então, é a ordem dos versos, e não o
  domínio das palavras. Se o Gere quiser que a trava morda, o critério das
  palavras tem de ser mais largo que o do manual — e aí entram «camino»,
  «andar», «senda», que o português entrega;
- **o baralho de espanhol saiu dos mil**: está em 1006, porque as três palavras
  e as três frases são cards de verdade e estudam-se na fila normal. Os nove
  versos estão fora da conta.

### O lado do app, feito em 01/10

**O card da trilha conta como card novo** — decisão do Gere. Ele ocupa um dos
lugares de estreia que já existiam e passa pelo piso e pelo teto como qualquer
outro; a trilha não abre uma torneira nova. Com isso o motor ganhou cinco
funções (`trilhaLiberada`, `vezDaTrilha`,
`proximoDaTrilha`, `andamentoDaTrilha`, `dominadosNoTotal`),
o app ganhou a tela **Textos**, e o resto é consequência:

- os cards de verso entram no `PORID`, para serem perguntados e corrigidos
  como qualquer card, e **nunca no `CARDS`**, que é de onde sai a fila de
  inéditos. Depois de respondidos eles entram nas filas de revisão normalmente:
  a trilha manda na estreia do card, não na vida dele depois;
- a vaga de card novo passou a ter dois donos. A cada três estreias, uma é da
  trilha — e quando o baralho não tem mais inédito, a trilha fica com todas;
- o verso que espera palavra **não trava a trilha**: ela passa ao próximo verso
  que tenha o que dar. Travar pararia a injeção, e a pessoa ficaria com a trilha
  ligada e nada vindo dela;
- a tela mostra em que pé está cada verso (dominado, em andamento, esperando tal
  palavra, pode vir) e, quando o último verso é dominado, troca a lista pelo
  **texto inteiro com a tradução ao lado**.

Conferido no navegador com 500 dominados semeados: duas estreias do baralho, a
terceira «la huella» — e o contador voltou a zero. Com «la huella» vista e não
dominada, a trilha pula o verso 1 e dá o verso 2; com ela dominada, dá o verso
1; com tudo dominado, dá `null` e a tela anuncia o texto fechado.
