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
7. **A leva de estreia tem 30 cards**, lidos um a um pelo Gere. O tamanho das
   levas seguintes se ajusta depois — com sessenta e seis levas de trinta o
   serviço não fecha, então a ideia é crescer para 80–120 assim que o padrão
   estiver combinado, com a leitura apoiada no `revisar.js`.
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
| 0 | Formato: pastas por baralho, ids com prefixo, build e revisar.js lendo os três, manual generalizado | — |
| 1 | Inglês, leva de estreia: 30 cards variados, lidos um a um | — |
| 2… | Inglês, levas de 80 a 120 até fechar mil | — |
| n | Português, leva de estreia e depois o resto | — |
| — | Telas do app (escolha do curso) | do Gere |

Cada leva termina fechada: `node fonte/build.js`, leitura no `revisar.js`,
varredura do motor, commit e push. É o commit que serve de memória, não a
conversa.
