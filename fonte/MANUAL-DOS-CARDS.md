# Manual dos cards

Como se cria, se confere e se corrige um card do Espanhol Cards. Vale para
quem for escrever a próxima leva — gente ou Claude — e é para ser lido **antes**
de escrever o primeiro card, não depois.

Tudo o que está aqui saiu de um defeito que alguém encontrou estudando. A
última seção lista os casos, card a card: quando uma regra parecer exagero, é
lá que está o motivo dela.

O funcionamento do app (filas, níveis, conferência da resposta escrita) está no
`README.md`. Aqui é só o card.

---

## 1. Antes de escrever: o que o estudo já disse

Leva nova não se escreve no escuro. Nesta ordem:

1. **`git pull` na pasta `dados/`.** Ela é outro repositório, escrito pelo app,
   e fica para trás com frequência. Julgar arquivo velho já aconteceu duas vezes.
2. **Os três canais de retorno**, reproduzindo cada caso com `Motor.conferir`
   contra o baralho atual (boa parte já passa por conta de correções anteriores):
   - `dados/comentarios.json` — o que foi comentado num card;
   - `dados/contestacoes.json` — respostas escritas contadas como erro e
     contestadas. **Cada caso é levado ao Gere para decidir junto**; não se
     aceita nem se recusa por conta própria;
   - os **«deu quase» aceitos** — nos logs de `dados/sessoes/`, eventos com
     `julgado_por_voce: true` e `acertou: true`. É o canal mais silencioso, e é
     onde a variante legítima aparece antes de virar contestação. Separar erro
     de digitação (não mexer: o balde do «quase» está funcionando) de variante
     legítima (entra em `aceitas`).
3. **`dados/resumo.md`**: até que nível o acerto se mantém alto; que temas estão
   fracos; o que foi marcado como «já conhecia» (não gastar card com isso);
   acerto lento em múltipla escolha de card que ele disse não conhecer é
   provável chute, e não conta como sabido.

Procure o **padrão por trás do caso**, não só o caso. «simpática» recusada para
«majo» virou o feminino em todos os adjetivos; `d'água` virou regra do
normalizador; «Madrid» virou grafia aceita. Se a correção serve a vinte cards,
ela não é do card: é do motor ou da leva inteira.

---

## 2. O que merece um card

- **O que o português não entrega.** Falso amigo, palavra opaca («el grifo»,
  «la nevera»), construção sem equivalente («llevar + tempo», «se me cayó»,
  «soler»), expressão idiomática, colocação fixa («sacar la basura», «hacer
  cola»). Cognato transparente só entra quando esconde uma armadilha
  («vislumbrar» não ensina nada; «la carpeta» ensina).
- **Útil e frequente antes de curioso.** O nível é o CEFR e mede **frequência e
  utilidade**, não dificuldade de decorar. Em conjugação, o nível soma a
  frequência do verbo e a dificuldade do tempo; irregularidade não entra
  (`tener` é A1 sendo irregular em tudo).
- **Leva variada.** Uma leva só de palavras vira, semanas depois, uma enxurrada
  de frases de uso em sequência. A leva 11 é o modelo: expressões, frases do
  dia a dia, conjugação, falsos amigos e vocabulário dos temas fracos.
- **Toda palavra tem a sua frase de uso** (`requer`), na mesma leva ou na
  seguinte. O build avisa quando falta.
- **Os dois lados do par.** Falso amigo costuma vir em dupla, e a dupla ensina
  mais que a metade: `vaso` (copo) pede `jarrón` (vaso); `sótano` pede
  `desván`; `propina` pede `soborno`.
- **O espanhol é o da Espanha**, com a variante latino-americana na nota
  («na América Latina, `plomero`») e, quando ela é corrente, em `aceitasEs`.
  Palavra ou gíria só de lá leva a etiqueta `Espanha`.
- **Nada repetido.** O build barra `es` igual ao de outro card; sinônimo muito
  próximo de card existente também não vale a vaga.

---

## 3. A ficha

Um card por linha, em `fonte/cards/NN-nome-da-leva.json`. **O arquivo é a data,
a etiqueta é o índice**: card novo vai para a leva corrente, seja do tema que
for, e leva nova é arquivo novo.

```json
{"id":"p031","tipo":"palavra","es":"tirar","pt":"jogar fora / puxar","en":"to throw away / to pull",
 "aceitas":["jogar fora","puxar","jogar","atirar","arremessar"],
 "aceitasEn":["to throw away","throw away","to pull","pull"],
 "distratores":["tirar / remover","arrancar / extrair","esticar / alongar","empurrar / apertar"],
 "distratoresEn":["to remove / to take off","to tear out / to extract","to stretch / to lengthen","to push / to press"],
 "nivel":"A2","tags":["falso-amigo","verbo"],
 "nota":"Na porta: «tirar» é puxar, «empujar» é empurrar.\n🇪🇸 tirar → 🇧🇷 jogar fora, puxar\n🇪🇸 quitar → 🇧🇷 tirar, remover",
 "notaEn":"…"}
```

| Campo | O que é |
|---|---|
| `id` | letra + número, continuando a série: **p** palavra, **f** frase ou expressão solta, **v** conjugação, **u** frase de uso (presa a uma palavra). O `node fonte/revisar.js`, sem argumento, diz no fim onde cada série parou |
| `tipo` | `palavra` ou `frase` |
| `es` | a forma mostrada e cobrada em espanhol |
| `pt` | a resposta mostrada em português |
| `aceitas` | as **outras** maneiras de dizer a mesma coisa (seção 5) |
| `aceitasEs` | variantes espanholas igualmente certas (opcional) |
| `distratores` | exatamente quatro (seção 6) |
| `nivel` | `A1` a `C2` |
| `tags` | temas, todos presentes em `fonte/tags.json` (seção 8) |
| `nota` | o que se lê depois de responder (seção 7) |
| `requer` | só em frase de uso: o id da palavra que a libera (seção 9) |
| `formasEs` | só em conjugação: quatro outras formas, com rótulo (seção 10) |
| `en`, `aceitasEn`, `distratoresEn`, `notaEn`, `formasEsEn` | o lado inglês (seção 11) |

---

## 4. `es` e `pt`: a forma canônica

- **Substantivo com artigo, nos dois lados**: «la servilleta» / «o guardanapo».
  O gênero é parte do que se aprende, e o app conta artigo errado como erro.
- **Verbo no infinitivo; adjetivo no masculino singular.** O feminino vai em
  `aceitas` («simpatico», «simpatica»).
- **Frase com a pontuação que ela tem**, inclusive `¿` e `¡`.
- **Português do Brasil, natural, e não decalque.** «Tengo ganas de dormir» é
  «Estou com vontade de dormir», não «Tenho ganas». Se a tradução natural se
  afasta muito das palavras do espanhol, a nota explica a ponte. Vale também
  para o que é gramatical mas ninguém diz: «Empieza a llover» não é «Começa a
  chover», que só existe em livro — troque a frase do card antes de aceitar um
  `pt` que soa a tradução.
- **Expressão que o português também tem entra com a expressão.** «Hizo de
  tripas corazón» é «Ele fez das tripas coração», e não «Ele criou coragem»:
  na volta (`pt → es`), a pergunta é o `pt`, e uma paráfrase neutra não avisa
  ninguém de que se espera uma expressão. O sentido fica na nota, e as
  paráfrases vão para `aceitas`.
- **A barra `/` é para dois sentidos de verdade** do espanhol («la cola» = «o
  rabo / a fila»), não para dois sinônimos — sinônimo vai em `aceitas`. No
  português e no inglês cada metade vale como resposta; no espanhol a barra não
  separa nada.
- **O parêntese desambigua**: «o peixe (para comer)», «o canto (de dentro)».
  Ninguém o escreve ao responder, e o funil não o tira — então **a forma sem
  ele tem de estar em `aceitas`** («peixe», «canto»), e o build barra quando
  não está. Use quando a palavra portuguesa sozinha for ambígua — sobretudo
  na volta (`pt → es`), em que a pergunta é o `pt`: «a cola» não pode pedir
  «el pegamento» sem ninguém saber de que cola se fala.
- **Duas respostas que o funil iguala não podem conviver.** O funil tira o
  acento, e com ele a diferença entre «a maçã» e «a maca»: quem responde uma
  acerta a outra. Quando a leva traz as duas, o parêntese desempata — «a maca
  (do hospital)» —, e a forma nua continua entre as `aceitas`.
- **Teto de tamanho**: a resposta cabe em 120 caracteres; frase boa tem até
  umas dez palavras e **uma só** dificuldade.

### 4.1 O card que muda de gênero

«Tu hermano es muy majo» e «Tu hermana es muy maja» são a mesma lição: o que
muda é de quem se fala. Duas fichas guardariam duas vezes o mesmo ensinamento,
e quem tirasse a primeira veria o masculino para sempre. Então o card é um só
e traz as duas terminações no mesmo texto, entre chaves — masculino antes da
barra, feminino depois:

```json
{"es":"Tu herman{o|a} es muy maj{o|a}.","pt":"{Seu irmão|Sua irmã} é muito simpátic{o|a}."}
```

A cada aparição sorteia-se um lado, e ele vale para o **card inteiro**: `es`,
`pt`, `en`, `aceitas`, `distratores`, `formasEs` e nota. O que está fora das
chaves não muda — é por isso que a marcação sai barata.

- **Marca-se onde a palavra muda mesmo.** Trocar só «ele» por «ela» não faz um
  card de gênero: o funil descarta o pronome-sujeito, e a pergunta continuaria
  a mesma. Vale quando a terminação espanhola muda.
- **Só nas frases.** O card de palavra fica na forma canônica de dicionário —
  adjetivo no masculino, com o feminino em `aceitas`.
- **Só no singular.** «Nosotros» é a forma de grupo misto; «nosotras» diz que
  são todas mulheres, o que é outra frase, e não a mesma em outro gênero.
- **Os quatro distratores acompanham.** Se a certa sai no feminino e as
  alternativas ficam no masculino, acerta-se escolhendo a diferente — é a
  seção 6.2 pelo caminho do gênero. Distrator sem gênero («Estou com frio»)
  fica como está.
- **Quando o `pt` não diz o gênero, os dois espanhóis valem.** «No seas tan
  quisquilloso» é «Não seja tão implicante», que serve aos dois: na volta
  (`pt → es`) ninguém tem como adivinhar qual lado foi sorteado. Aí a outra
  forma entra em `aceitasEs` **com os lados trocados** —
  `["No seas tan quisquillos{a|o} con la comida."]` —, e assim a que é aceita
  é sempre a que não está na tela. Quando o `pt` diz o gênero («Minha irmã é
  loira»), a concordância é cobrada, e é lição.
- **Feminino que muda de assunto não entra.** «Ese político es un zorro» é
  raposa; «una zorra» é xingamento. O mesmo vale para o feminino que ninguém
  diz («la albañila») e para o que estraga os distratores. Na dúvida, o card
  fica como está.

---

## 5. `aceitas`: o que mais está certo

A resposta escrita passa por um funil antes de ser comparada. **O que o funil
já dá de graça não precisa ser listado**:

- acento, maiúscula, pontuação, espaço;
- plural e singular (`sentir saudade` = `sentir saudades`);
- artigo e pronome-sujeito (`eu concordo` = `concordo`; `ele é gente boa` = `é gente boa`);
- contração e grafia de conversa (`pra`, `pro`, `tô`, `tá`, `vc`);
- número por extenso (`3 anos` = `três anos`);
- `este` / `esse`, `isto` / `isso` (mas não `aquele`);
- o tratamento `teu` / `seu` (só do lado português: em espanhol, `tu` e `su`
  separam o tú do usted, e isso o baralho cobra);
- o `já` aspectual, o apóstrofo (`d'água`), «Madrid» por «Madri»;
- a posição de seis advérbios de tempo: `hoje`, `ontem`, `amanhã`, `agora`,
  `sempre`, `nunca`.

**O que tem de estar na lista**, porque o funil não adivinha:

- sinônimo verdadeiro («é preciso» / «é necessário»; «bravo» / «zangado»);
- o outro verbo corrente («pôr» / «colocar» / «botar»; «achar» / «encontrar»);
- a outra pessoa do imperativo («abre» / «abra»), o outro tratamento;
- «seu» / «dele» / «dela», «a gente» / «nós», com e sem possessivo;
- outra ordem natural que não seja só o advérbio de tempo;
- o feminino do adjetivo, o diminutivo corrente («filhote», «filhotinho»);
- a versão curta que qualquer um diria («a carteira» por «a carteira de
  motorista»; «na sexta» por «na sexta-feira»);
- o equivalente idiomático brasileiro **e** a tradução ao pé da letra, quando
  as duas são português de verdade («num piscar de olhos», «num abrir e fechar
  de olhos»).

Escreva a lista **em minúscula, sem acento e sem pontuação**, como o resto do
baralho. Uma frase comum tem de cinco a dez variantes; expressão idiomática,
mais. Para achar as que faltam, responda o card de cabeça de três jeitos antes
de olhar a lista.

**O que não entra, por mais que pareça generoso:**

- o que muda o **tempo verbal** («começou a chover» para «empieza a llover»);
- o que muda o **sentido** («eu durmo mal» para «duermo poco»; «ele levou o
  livro» para «trajo el libro», que é o contrário);
- o próprio **falso amigo** que o card ensina;
- qualquer coisa que esteja, inteira ou pela metade, num **distrator** do card.

---

## 6. Distratores

São quatro, e é onde o card mais erra. Um distrator ruim faz uma de duas
coisas: **pune quem sabe** ou **premia quem não sabe**.

### 6.1 Nenhum distrator pode estar certo

Não basta não constar em `aceitas`. **Abra o dicionário (RAE) e leia todos os
sentidos da palavra espanhola**, e releia a nota que você mesmo escreveu:

- «tirar» é jogar fora, puxar — **e atirar** («tirar una piedra»);
- «la zozobra» é a aflição — **e o naufrágio**, de onde ela vem;
- «asistir» é comparecer — **e socorrer** (a nota do card dizia isso, com
  «ajudar alguém» entre os distratores);
- «la ola» é a do mar — **e a do estádio**; «el enlace» é o link — **e o casamento**;
- «el suelo» é o chão — **e «soalho» é chão**.

O mesmo para a tradução: «Me dê a mão» só difere de «me dê uma mão» no artigo,
que o funil descarta. O build confere cada distrator, **e cada metade de
distrator com barra**, contra as respostas aceitas — mas polissemia ele não vê.

**E o sentido raro conta.** Se o dicionário dá o distrator como tradução
possível, ainda que num registro literário, jurídico ou antigo, ele sai: não
existe distrator meio certo. Foi o que tirou «realizar» de `en-p053`
(«realize a profit»), «pretender» de `en-p001` («pretend to the throne») e
«suportar» de `en-p007` («support the weight»), entre dez.

**A armadilha não se perde: ela muda de card.** O que o sentido raro ameaça é a
palavra solta, porque sozinha ela não escolhe sentido. Na frase de uso o
contexto fecha, e ali o falso amigo continua de pé — «Don't talk to strangers»
não é «não fale com estrangeiros», ainda que «stranger» sozinho possa ser o de
fora.

### 6.2 O mesmo formato da resposta certa

Se só a certa tem barra, ou parêntese, ou é bem mais longa ou mais curta que as
outras, acerta-se escolhendo a diferente. O build **barra** o baralho quando:
menos de três distratores têm o mesmo número de `/` que a certa; só a certa (ou
só os distratores) têm parêntese; a certa tem mais de uma palavra além do maior
distrator, ou mais de uma aquém do menor.

Vale o mesmo para o que o build não mede: **classe gramatical, artigo, gênero,
pessoa e registro**. Se a certa é «o copo», os distratores têm artigo; se é
infinitivo, são infinitivos; se é gíria, não são quatro frases de cartório.

### 6.3 Nenhuma categoria que só os distratores têm

É o defeito mais fácil de cometer em expressão idiomática: a leitura literal
puxa o assunto, e os quatro distratores vão atrás. «Se hizo el sueco» tinha
quatro frases sobre a Suécia; «Llueve sobre mojado», quatro sobre chuva;
«Tiraron la casa por la ventana», quatro sobre casa. A certa, figurada, era a
única fora do assunto.

**A receita: dois literais, dois fora da categoria.** Os literais são a
armadilha de verdade — quem lê «gato encerrado» e pensa em gato tem de ter onde
cair. Os outros dois são **leituras erradas plausíveis do sentido figurado**, de
preferência dividindo a moldura com a certa («Fez-se de desentendido» ao lado
de «Fez-se de vítima»). Quando existe um falso amigo de expressão, ele é o
melhor distrator do card: «Llueve sobre mojado» não é «chover no molhado», e «É
repetir o óbvio» tem de estar lá.

O build avisa quando a mesma palavra de conteúdo está nos **quatro** distratores
e não na certa. Categoria sem palavra repetida — quatro frases sobre comida —
ele não vê, e **flexão também lhe escapa**: «Aproveite» em três distratores e
«Aproveita» no quarto passam pela checagem, ainda que qualquer um veja que só a
certa não fala de aproveitar. **O teste é tampar o espanhol**: olhando só as
cinco alternativas, dá para apontar a diferente? Então o card está entregue.

### 6.4 Português de verdade, e plausível

- Palavra que **existe**: nada de «bassoura», «tardear», «acamparar»,
  «jubilosidade». Parônimo inventado não engana, só polui.
- **Em português**: «a huella» e «hurrah» não são alternativa de resposta
  portuguesa.
- **Que faça sentido sozinho**: «o alvedrio da manhã», «o soborno de festa» e
  «o bolso de viagem» não querem dizer nada.
- **Que não se descarte sem saber espanhol.** «Guardanapo assado» ao lado de
  «frango assado» facilita em vez de dificultar. Distrator absurdo é uma
  alternativa a menos.

### 6.5 Que distrator serve a cada tipo de card

| Card | Os quatro distratores |
|---|---|
| **Falso amigo** | o sentido português da palavra, **sempre** (é a armadilha: «envergonhada» em `embarazada`); depois parônimos e vizinhos de sentido |
| **Palavra opaca** | palavras portuguesas que se parecem com a grafia espanhola («hito» → o mito, o fio, o hábito) e uma ou duas do mesmo campo («el codo» → o joelho, o ombro) |
| **Expressão** | dois literais e duas leituras figuradas erradas (6.3) |
| **Frase de gramática** | a mesma frase com a construção mal lida («Llevo dos años aquí» → «Levarei dois anos») |
| **Conjugação** | a mesma frase em outros tempos, em português; e as `formasEs` (seção 10) |
| **Frase de uso** | a mesma frase trocando **o mesmo trecho** — a tradução da palavra, sem o artigo — por quatro palavras da **mesma classe, gênero e número**. Um deles pode ser o falso amigo literal («Tinha muita cola no banco») |

A regra da frase de uso não é estética: é o que permite ao app trocar até dois
distratores por **palavras que a pessoa já viu e que se confundem com a certa**
(`Motor.distratoresDinamicos`). Se os quatro não trocam o mesmo trecho, o card
fica só com os prontos. E os prontos têm de ser bons sozinhos: são eles que
aparecem para quem está começando.

### 6.6 Na volta (`pt → es`)

Não se escreve nada: nos cards de conjugação as alternativas erradas são as
`formasEs`; nos outros, o app sorteia o espanhol de cards parecidos (mesmo
tipo, nível, tema, tamanho). `distratoresEs` existe para o card que precisar
de quatro feitos à mão — hoje nenhum precisa.

---

## 7. A nota

- **Ensina uma coisa que a tradução não diz**: a colocação («el disgusto se
  *lleva*, não se tem»), a preposição que o verbo pede, a variante regional, o
  par que confunde, a imagem por trás da expressão. Etimologia só quando ajuda
  a lembrar — e conferida (a de «amén de» já foi corrigida uma vez).
- **É para qualquer pessoa.** O app vai ter outros usuários: nada de «já
  apareceu como verbo», «par do anterior» ou qualquer referência à ordem em que
  o Gere viu os cards.
- **Pares, um por linha, no fim**: `🇪🇸 x → 🇧🇷 y`. São **obrigatórios**:
  - em todo falso amigo — a palavra espanhola do sentido português
    (`🇪🇸 avergonzada → 🇧🇷 envergonhada`);
  - quando o **`pt` do card se lê como outra palavra espanhola** («a cola», «a
    tela», «a mala», «o marco», «reparar», «apagar»): a nota traz o que essa
    palavra quer dizer em espanhol (`🇪🇸 la tela → 🇧🇷 o tecido`).

  Não é enfeite: o app monta com esses pares o aviso de **resposta certa na
  língua errada**, que devolve a vez em vez de contar erro.
- Aspas angulares «», curta (o teto é 900 caracteres; a boa tem duas ou três
  frases), sem repetir o que o `pt` já diz.

---

## 8. Etiquetas

Toda etiqueta tem de estar em `fonte/tags.json`, com rótulo em `en` e `es`;
etiqueta sem tradução **barra o build**. Verbo no infinitivo mapeia para si
mesmo. Prefira as que já existem: é por elas que o resumo mede os temas.

Algumas mandam no comportamento do app, e por isso têm de ser verdade:

- `conjugação` — exige `formasEs`, e tira o card da checagem de categoria;
- `verbo`, `adjetivo` — é por elas que o distrator dinâmico sabe a classe da
  palavra («luego → logo» acaba em «-o» e não é adjetivo);
- `falso-amigo` — o card tem de trazer os pares na nota;
- `Espanha` — o que não se ouve do outro lado do Atlântico.

---

## 9. A frase de uso (`requer`)

Entra no dia seguinte ao domínio da palavra, como primeira revisão dela em
contexto. Então:

- **usa a palavra**, na forma que for (o build procura o radical, já prevendo
  «suelo» de `soler` e «me acuerdo» de `acordarse`);
- mostra **como ela se usa** — a colocação típica, a preposição, o contexto em
  que de fato aparece («Hacer cola», «Llevarse un disgusto») —, e não uma frase
  qualquer com a palavra enfiada;
- é **curta**, com a palavra como única dificuldade, e leva o **mesmo nível**
  da palavra;
- aponta para uma **palavra** (nunca para frase, nunca em cadeia);
- tem os distratores da seção 6.5: o mesmo trecho trocado nos quatro.

---

## 10. Conjugação

Além dos campos comuns, `formasEs`: **a mesma frase em quatro outros tempos**,
cada uma com o rótulo do que ela é, e `formasEsEn` com as mesmas chaves.

```json
"formasEs": {"Ayer lo sabía":"imperfeito","Ayer lo sé":"presente","Ayer lo sabré":"futuro","Ayer lo sabría":"condicional"}
```

Servem a duas coisas: quando a resposta escrita coincide com uma delas, o erro
é seco e o feedback diz que tempo foi escrito; e são as **quatro alternativas
erradas da múltipla escolha `pt → es`**. Por isso:

- **quatro, sempre** (o build barra com menos): com três, a vaga que sobra é
  preenchida com frase de outro card, fora do assunto;
- **sem pontuação final** — o app veste cada uma com a abertura e o fecho da
  resposta certa («Viene aquí» vira «¡Viene aquí!»);
- **nenhuma pode ser resposta certa**, nem pela lista nem pelo sentido. «Nosotros
  hemos vivido aquí» é tradução legítima de «Nós moramos aqui»; «¿Pondrías la
  mesa, por favor?» pede a mesma coisa que «Pon la mesa». Na dúvida, outro tempo;
- rótulos do vocabulário que o baralho já usa: `presente`, `pretérito`,
  `imperfeito`, `futuro`, `condicional`, `pretérito perfeito`,
  `mais-que-perfeito`, `futuro perfeito`, `condicional composto`, `presente do
  indicativo`, `imperfeito do subjuntivo`, e, onde o modo é o erro,
  «indicativo, onde o subjuntivo é obrigatório».

Os distratores em português seguem a mesma lógica: a frase nos outros tempos.
Onde o português não distingue («nós andamos» é presente e pretérito), o tempo
ambíguo fica de fora.

---

## 11. O lado inglês

Todo card leva `en`, `aceitasEn`, `distratoresEn`, `notaEn` (e `formasEsEn`).
Card com alguns desses campos e não todos é erro: é tradução pela metade.

- **O inglês é tradução do espanhol, não do português.** Se saísse do `pt`,
  herdaria justamente o erro que a revisão existe para pegar.
- **Cada língua tem o seu formato.** Se uma palavra basta em inglês, é uma
  palavra; barra só quando o espanhol carrega dois sentidos.
- **A `notaEn` não menciona o português.** Onde a nota portuguesa aponta um
  vizinho luso, a inglesa aponta os vizinhos dentro do próprio espanhol.
- **Os `distratoresEn` obedecem à seção 6 inteira**, por conta própria. Os
  defeitos de 6.1 e 6.3 atravessam a tradução: corrigido o português, confira
  o inglês do mesmo card.

As checagens de formato do inglês saem como aviso, e quem decide é a revisão
(`revisar-es-en.html`), cujas decisões ficam à parte e prevalecem sobre a fonte.
Num card de gênero, as telas de revisão mostram o texto com as chaves: quem
mexer no inglês tem de devolvê-las, ou o card passa a variar de um lado só.

---

## 12. Conferir

```bash
node fonte/build.js          # valida, regenera data/ e recarimba os ?v=
node fonte/revisar.js 12-    # a leva em cinco linhas por card, para ler
```

**O que o build pega** (e barra): id ou `es` repetido; campo faltando; nível ou
tipo inválido; menos ou mais de quatro distratores; resposta com parêntese cuja
forma nua não é aceita; distrator — ou metade de
distrator — que o motor lê como resposta certa; dois distratores iguais; formato
que entrega a certa (barra, parêntese, comprimento); conjugação sem quatro
`formasEs`, ou com forma igual à certa; `requer` quebrado; etiqueta sem
tradução; inglês pela metade; marcação de gênero malformada. **O card de
gênero passa duas vezes por tudo isso**, uma por forma: é assim que se
descobre que o feminino repete outro card ou que um distrator virou a resposta
certa de um dos lados. **E avisa**: palavra de conteúdo nos quatro
distratores e não na certa; frase que não parece usar a palavra que requer;
palavra sem frase de uso.

**O que ele não pega, e só a leitura pega**: outro sentido da palavra
espanhola; categoria sem palavra repetida; palavra que não existe; distrator
absurdo; `aceitas` curta ou generosa demais; nota que só o autor entende; nível
fora do lugar; tradução que é decalque.

Por isso a leva só está pronta depois de **lida card a card** com o
`revisar.js`, com a lista abaixo na mão. Build limpo não é card bom: a revisão
de setembro de 2026 achou dez distratores que eram resposta certa num baralho
que passava no build sem um aviso.

Depois: abrir o app, responder alguns cards novos nas duas direções, `git add
-A`, commit no estilo do repositório e push. Sempre com o build rodado antes —
sem ele o navegador serve o baralho velho.

---

## 13. A lista, card a card

**O card**
- [ ] O português não entrega isso sozinho? Não repete card existente?
- [ ] Nível pela frequência e utilidade, não pela dificuldade?
- [ ] Substantivo com artigo nos dois lados; verbo no infinitivo; adjetivo no masculino?
- [ ] `pt` é português natural? Barra só para dois sentidos de verdade?
- [ ] O `pt`, lido sozinho na volta, deixa claro o que se pede? (parêntese, se não)

**As aceitas**
- [ ] Respondi de cabeça de três jeitos, e os três estão lá (ou o funil cobre)?
- [ ] Sinônimos, o outro verbo, o outro tratamento, o feminino, a versão curta?
- [ ] Nada que mude o tempo, mude o sentido, ou seja o próprio falso amigo?

**Os distratores**
- [ ] Li **todos** os sentidos da palavra no dicionário, e nenhum distrator é um deles?
- [ ] Nenhum distrator, nem metade de um, está nas aceitas — nem é a certa com outro artigo?
- [ ] Mesmo formato: barras, parênteses, tamanho, classe, artigo, registro?
- [ ] Card de gênero: os quatro acompanham a terminação da certa? (linha `G` do `revisar.js`)
- [ ] Tampando o espanhol, **não** dá para apontar a diferente? (dois literais, dois fora)
- [ ] Todas as palavras existem, são português, fazem sentido e são plausíveis?
- [ ] Falso amigo: o sentido português está entre os quatro?
- [ ] Frase de uso: os quatro trocam o mesmo trecho, com a mesma classe, gênero e número?

**A nota e as etiquetas**
- [ ] Ensina algo que a tradução não diz, e qualquer pessoa entende?
- [ ] Falso amigo, ou `pt` que se lê como outra palavra espanhola: os pares `🇪🇸 x → 🇧🇷 y` estão lá?
- [ ] Etiquetas existentes; `verbo`, `adjetivo`, `conjugação`, `falso-amigo` e `Espanha` dizem a verdade?

**Os anexos**
- [ ] Palavra nova tem frase de uso, e a frase mostra a colocação típica?
- [ ] Conjugação: quatro `formasEs`, sem pontuação, nenhuma que seja tradução válida do `pt`?
- [ ] Inglês traduzido do espanhol, com os distratores conferidos pela mesma lista?

---

## 14. De onde veio cada regra

| Regra | O caso |
|---|---|
| Distrator não pode ser outro sentido da palavra | `p031` tirar/atirar, `p060` zozobra/naufrágio, `p201` asistir/ajudar, `p247` ola do estádio, `p268` enlace matrimonial, `p073` soalho, `p239` inscrição |
| Nem o sentido raro do dicionário | dez cards de inglês: `en-p053` realize/realizar, `en-p001` pretend/pretender, `en-p007` support/suportar, `en-p012` attend/atender, `en-p014` sensible/perceptível, `en-p035` injury/injúria, `en-p056` assist/comparecer, `en-p075` stranger/estrangeiro, `en-p078` terrific/terrível, `en-p079` apology/apologia |
| Nem metade de distrator pode estar certa | `f004` «Me dê a mão. / Vamos atravessar.»; `p035` «the note», «the bill» |
| `aceitas` não afrouxa o sentido | `v022` «ele levou o livro» para «trajo»; `v030` «durmo mal»; `v014` «acho que sim» |
| Formato igual ao da certa | `p046` sobremesa: «a resposta certa está se destacando» |
| Categoria que só os distratores têm | `f123` roxo, `f059` galho, `f094` gato, `f030` comida, `p046`, `f122` lata; depois `f035` Suécia, `f133` chuva, `f148` casa, `f128` sapato, `f132` cozinha, `f017` pão, `f013` pé |
| O falso amigo de expressão é o melhor distrator | `f133` «chover no molhado»; `f145` «estar frito» |
| Palavra que existe, em português, com sentido | `p081` bassoura, `p087` tardear, `p195` acamparar, `p194` hurrah, `p085` a huella, `p065` «o alvedrio da manhã», `p107` «o soborno de festa» |
| Distrator plausível | «guardanapo assado», na primeira versão dos dinâmicos |
| Frase de uso troca o mesmo trecho | `u095` sesgo — o pedido dos distratores dinâmicos |
| Feminino do adjetivo em `aceitas` | `p043` majo / «simpática», e mais 17 adjetivos |
| A versão curta que todo mundo diria | `u234` «a carteira»; `u024` «na sexta»; `u181` «sua idade» |
| O tratamento `teu`/`seu` é do funil, e só do lado português | `u005` «qual é o teu sobrenome», aceito à mão no «deu quase» |
| `pt` que ninguém diz fora de livro pede frase nova | `v033` «Começa a chover», trocado por «O filme começa às oito» |
| A expressão do português é o `pt`, quando existe | `f124` «Hizo de tripas corazón»: na volta, «Ele criou coragem» não pedia expressão nenhuma |
| A nota diz onde está o que ela aponta | `v028` «o y aparece do nada», sem dizer que «oigo» tem g e o y é das outras pessoas |
| Duas respostas que o funil iguala | `p311` «a maca» e `p316` «a maçã», na mesma leva |
| A checagem de categoria não vê flexão | `f213` «Que aproveche»: «Aproveite» em três distratores e «Aproveita» no quarto |
| Etiqueta `falso-amigo` só quando o par existe | `p312` `ingresar`, que em português também é ingressar: a etiqueta saiu |
| Pares `🇪🇸 → 🇧🇷` na nota | `p046` sobremesa, `p077` carpeta, `p102` pegamento: «respondi certo na língua errada» |
| Nota para qualquer pessoa | `p174` estreno: «já apareceu como verbo» |
| Etimologia conferida | `f098` «amén de», que não vem de «amém» |
| Quatro `formasEs`, e distratores de conjugação no assunto | `v002` «Ayer lo supe» entre «Yo puse la mesa» e «No lo hagas» |
| Forma que é tradução válida não serve | `v043` «hemos vivido»; `v062` «pondrías» |
| Dois sentidos certos: cobra-se o que o português não tem | `p239` la matrícula (a placa), com o outro em `aceitas` |
| Uma ficha, duas formas, para o que muda de gênero | `u023` «Tu hermano es muy majo», pedido do Gere, e mais 37 cards |
| Cada contestação é decidida junto | combinado desde a primeira leva |
| Contestação recusada entra na nota do card | `p201` «participar» para `asistir`: quem assiste está presente e pode ficar calado |

---

## 15. Os três baralhos

Este manual nasceu com um baralho só, o de espanhol, e fala nele o tempo todo.
Agora são três — espanhol, inglês e português —, um por língua ensinada, e cada
um serve a dois públicos. O plano inteiro está em [`../PLANO.md`](../PLANO.md);
aqui fica só o que muda para quem escreve um card.

- **A pasta diz o que o card ensina**: `fonte/cards/es`, `fonte/cards/en`,
  `fonte/cards/pt`. Os ids dos baralhos novos levam o prefixo da língua
  (`en-p001`, `pt-f012`); os mil do espanhol ficam com o id nu, porque o
  progresso de quem estuda é chaveado por ele.
- **Cada língua tem o seu quarteto**: `pt`/`aceitas`/`distratores`/`nota`,
  `en`/`aceitasEn`/`distratoresEn`/`notaEn`,
  `es`/`aceitasEs`/`distratoresEs`/`notaEs`. A do baralho é a que se cobra; as
  outras duas são as respostas, e **as duas têm de estar inteiras** — o build
  barra card com meia língua.
- **«O que o português não entrega» vira «o que a língua de quem estuda não
  entrega»**, e são duas línguas por baralho. No baralho de inglês, `the shelf`
  merece card (nem o português nem o espanhol entregam) e `the animal` não.
- **A nota de cada língua ensina o público dela**, sem mencionar o vizinho do
  outro: a `nota` aponta o falso amigo português, a `notaEs` aponta o espanhol,
  e onde um público não tem armadilha nenhuma a nota dele ensina a colocação, a
  preposição ou o registro.
- **O inglês do baralho de inglês é o americano**, com o britânico em
  `aceitasEn` e na nota — a mesma regra que põe o espanhol da América Latina na
  nota do baralho da Espanha. O **português é o do Brasil**, com Portugal na
  nota.
- **As formas verbais** seguem o baralho: `formasEn` no baralho de inglês, com
  o rótulo na língua do público de origem, e `formasEnEs` com o mesmo texto e o
  rótulo na outra língua.
- **O resto do manual vale igual.** Distrator, parêntese, `aceitas`, frase de
  uso, etiqueta, gênero: as regras são das seções 2 a 14, e nenhuma delas é do
  espanhol.
