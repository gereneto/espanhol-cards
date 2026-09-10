# Espanhol Cards

App de estudo de espanhol para brasileiros, no estilo Anki, com foco em
**expandir vocabulário** e **desfazer as confusões clássicas entre espanhol e português**.

São **419 cards** — 248 palavras e 171 frases, sendo 67 falsos amigos
(`embarazada`, `exquisito`, `la fecha`, `asistir`, `el desván`…) e 50 de
conjugação verbal, quase todos irregulares.

## Como funciona

1. Você clica em **Próximo card** e aparece uma palavra ou uma frase em espanhol.
2. **Na estreia do card**, a pergunta é de **múltipla escolha com 5 alternativas**.
   Os distratores não são aleatórios: são justamente as armadilhas
   (para `exquisito`, uma das opções é "esquisito").
3. Se você acertar, **da próxima vez terá que escrever** a resposta.
   Se errar escrevendo, o card volta para a múltipla escolha.
   Depois de **três acertos seguidos**, **o card se inverte**: passa a
   mostrar o português e a pedir o espanhol, de novo primeiro escolhendo e
   depois escrevendo. O acerto na múltipla conta para os três, então na
   prática são a escolha e mais duas escritas de cada lado — **seis respostas
   certas do zero ao domínio**. Uma **🇪🇸** e uma **🇧🇷** marcam a direção — uma ao lado
   da pergunta, outra ao lado da resposta — para não haver dúvida de que lado
   traduzir. Vencer as duas direções não aposenta o card: ele passa a voltar
   cada vez mais espaçado, mas nunca sai do baralho.
4. O app cronometra cada resposta e classifica em **rápido / médio / lento**,
   com limiares diferentes para palavra e frase, e para escolher e escrever.
5. A resposta é **gravada assim que você responde** — não há botão de confirmar.
   O **Próximo card** só serve para avançar, então dá para ficar lendo a nota.
   A exceção é o quase-certo: aí o app pergunta antes se conta como acerto.
   A tela desce sozinha até o botão, e a **metade de cima do card fica grudada**
   logo abaixo do cabeçalho: a resposta passa por baixo dela, e a frase que se
   acabou de traduzir continua à vista para conferir. Num card longo era
   justamente ela que sumia.
6. Se você **acertar de primeira**, ele pergunta **se já conhecia aquilo**, e grava
   assim que você responde. Não pergunta quando você erra (aí a resposta seria
   óbvia), nem quando o card já apareceu antes (aí você conheceria do próprio
   app), nem nas frases presas a uma palavra: elas só apareceram porque você
   venceu aquela palavra aqui dentro, então a resposta seria sobre o app e não
   sobre o que você trouxe de fora.

Tudo isso é gravado para calibrar as próximas levas de cards.

### O que aparece a seguir

A fila inicial intercala os níveis e alterna palavra/frase, para achar seu teto
logo de cara. Depois disso, **o nível dos cards inéditos passa a seguir o seu
desempenho**: o app calcula uma nota de domínio por nível e sorteia mais cards
daquele que você ainda não domina mas já consegue acompanhar.

Na nota de domínio, a **estreia** do card pesa mais, porque é a única medida
limpa do que você já sabia: acertar conhecendo vale 1; acertar dizendo que não
conhecia vale 0,4, já que provavelmente foi dedução ou chute. As respostas
seguintes valem por mostrarem em que nível está custando fixar. Enquanto há
pouca evidência, tudo é puxado para o meio, para um acerto solto não decidir nada.

### Como o nível é atribuído

O `nivel` é o CEFR e nada mais — um eixo só. Ele mede **o quanto a palavra ou
construção é frequente e útil**, não o quanto é difícil de decorar.

Nos cards de conjugação o nível sai de duas coisas somadas: **a frequência do
verbo** e **a dificuldade do tempo**. Irregularidade não entra na conta, porque
não é questão de proficiência — `tener` é vocabulário de A1 mesmo sendo
irregular em tudo. Então `Yo tengo prisa` é **A1**, `Él dijo la verdad` é **A2**
(mesmo verbo comum, mas pretérito irregular), `Nosotros anduvimos mucho` é **B1**
(verbo menos frequente, pretérito que quase ninguém espera) e
`Habría venido antes` é **C1** (condicional composto).

Que o card é de conjugação, e se o verbo é regular ou irregular, fica nas
etiquetas (`conjugação`, `irregular`, `pretérito`, `tener`) — que a lista do
🗂️ filtra, então dá para ver como você vai nos irregulares sem que isso
contamine a nota do nível.

A curva de peso tem pico no domínio intermediário e um piso, de modo que
**todos os níveis continuam aparecendo** — nível que você gabarita entedia,
nível em que você erra tudo desanima.

### Quatro filas

Card novo e card em revisão nunca disputaram a mesma fila. Se disputassem, o
novo perderia sempre: quem está em múltipla escolha volta a 8-32 posições e
satura a frente, então quanto mais se revisa, mais raro fica o inédito. Era o
que acontecia, e a seca chegava a 75 respostas sem nenhum card novo.

Hoje são **quatro filas**, e cada card respondido mora na fila da sua etapa:

| Fila | Quem mora nela |
|---|---|
| **inéditos** | o que nunca apareceu |
| **`es → pt`** | você reconhece o espanhol (múltipla, depois escrita) |
| **`pt → es`** | você produz o espanhol (múltipla, depois escrita) |
| **dominados** | vencido nas duas direções, esperando a data |

Os **dominados ficam fora da disputa**: têm gatilho de calendário e furam a
fila quando a data chega. É a única coisa que eles obedecem.

#### De qual fila vem o próximo card

Entre as outras três, a escolha persegue um alvo: **100 cards em cada
direção**. Quem está abaixo do alvo precisa de entrada, quem está acima precisa
de saída — e cada fila mexe no que mexe:

| Tirar um card de | O que isso faz com as contagens |
|---|---|
| inéditos | **+1** em `es → pt` — é a única torneira desse lado |
| `es → pt` | às vezes **−1** em `es → pt` e **+1** em `pt → es` |
| `pt → es` | às vezes **−1** em `pt → es`, que vira dominado |

Daí saem os pesos do sorteio: o déficit de `es → pt` puxa inédito; o déficit de
`pt → es` puxa trabalho em `es → pt`, que é de onde saem os que atravessam; e o
excesso de cada lado puxa trabalho no próprio lado, que é por onde ele escoa.

| `es → pt` | `pt → es` | inédito | `es → pt` | `pt → es` |
|---:|---:|---:|---:|---:|
| 0 | 0 | 100% | — | — |
| 50 | 0 | 30% | 64% | 6% |
| 100 | 0 | 2% | 90% | 8% |
| 100 | 100 | 9% | 45% | 45% |
| 137 | 137 | 2% | 71% | 27% |
| 50 | 150 | 43% | 8% | 49% |

**Não é uma porta que abre e fecha — é peso**, e ele cede aos poucos conforme a
fila chega perto do alvo. A régua anterior contava respostas desde o último
inédito e tinha uma porta liga-desliga que fechava de vez em 122 contra 112;
media a coisa errada, que era o intervalo, e não o tamanho das filas.

Card novo nunca deixa de vir: há um piso de peso para os inéditos, porque um
limite que pudesse virar "nunca" recriaria a seca que a regra veio resolver.

Simulando 1500 respostas com a taxa de acerto real, partindo do zero, as duas
direções chegam ao alvo por volta da resposta 1000 e ficam lá:

| Respostas | `es → pt` | `pt → es` | Dominados | Cards vistos |
|---:|---:|---:|---:|---:|
| 250 | 69 | 17 | 1 | 88 |
| 500 | 84 | 59 | 3 | 148 |
| 750 | 97 | 90 | 9 | 195 |
| 1000 | 100 | 102 | 27 | 228 |
| 1500 | 99 | 104 | 75 | 278 |

### Onde o card cai dentro da fila

Ao responder, o card volta para a fila da sua etapa, mais adiante, e a
distância depende de como foi:

| Situação | Volta em ~ |
|---|---:|
| Errou em `es → pt` | 10 respostas (cresce a cada erro seguido no mesmo card) |
| Errou em `pt → es` | 30 (idem) |
| Acertou na múltipla, devagar | 14 |
| Acertou na múltipla, rápido | 32 |
| Acertou escrevendo, devagar | 35 |
| Acertou escrevendo, rápido | 110 |
| Acertou escrevendo 3× seguidas | 220 — fecha a direção |

**A distância é contada em respostas, não em posições.** Enquanto havia uma
fila só isso dava no mesmo: toda resposta consumia um card dela. Com o sorteio
não dá: uma fila que leva 45% das respostas anda menos de meia posição por
resposta, e 110 posições lá dentro seriam 244 respostas de espera. Então a
distância vira posição multiplicando pela chance da fila — 110 respostas numa
fila de 45% são 50 posições. A calibragem da tabela continua valendo como está,
e se acerta sozinha quando as filas mudam de tamanho.

Errar em `pt → es` espera mais do que errar em `es → pt` pelo mesmo motivo que
faz o acerto na múltipla dessa direção esperar 90: a grafia espanhola certa
acabou de aparecer na tela, e o card cai na múltipla escolha da mesma direção.
Voltar em dez posições seria pedir que você reconhecesse o que acabou de ler.

Dizer "já conhecia bem" empurra mais para o fim; "não conhecia" segura mais perto.
Acerto lento em algo que você disse não conhecer é tratado como possível chute:
o card continua na múltipla escolha.

O painel mostra os dois lados com o alvo ao lado («es → pt e pt → es (alvo
100 · 100)») e a **chance de o próximo card ser inédito**, que é o que o
sorteio de fato promete — não uma data.

### O atalho de quem não erra

Seis respostas é o caminho de quem tropeça pelo menos uma vez. Card que
ninguém erra e que sai depressa não precisa das seis, e o desconto sai do que
o próprio card já mostrou:

| O que o card mostrou | Passos | Caminho |
|---|---:|---|
| erro, ou alguma resposta lenta | **6** | escolha + 2 escritas de cada lado |
| erro nenhum, nunca lento | **5** | perde uma escrita na volta |
| erro nenhum, sempre rápido | **4** | uma escolha e uma escrita de cada lado |

O desconto é gasto **o mais tarde possível**: primeiro no portão da volta, e
só com o desconto cheio também no da ida. Não é escrúpulo, é o que a evidência
permite — no portão da ida o card tem três respostas e ainda pode tropeçar
depois; no da volta, o histórico já está quase completo.

Um erro depois disso **apaga o desconto**: o portão volta a pedir três, e o
card que errou na primeira resposta e acertou tudo depois chega ao domínio em
sete.

### O card dominado, e a única data do app

As filas têm centenas de cards e todo card respondido volta para uma delas, então o intervalo
máximo que ela consegue dar é **uma passada pelo baralho** — uns poucos dias.
Acertar três vezes seguidas com o card voltando a cada dois dias não prova
memória de longo prazo; prova que ele ainda estava fresco.

Por isso o card que venceu as duas direções — e **só ele** — ganha uma data de
retorno, que cresce a cada revisão certa. No momento em que isso acontece, o
feedback traz um **«Card dominado!»** — de outro modo a conquista passaria em
branco, porque o card simplesmente sumiria da fila por semanas.

| Revisões certas depois de dominado | Volta em |
|---:|---:|
| 1ª | 3 dias |
| 2ª | 1 semana |
| 3ª | 2 semanas |
| 4ª | 1 mês |
| 5ª | 3 meses |
| daí em diante | 6 meses |

Chegada a data, o card **fura a fila**: ele não disputa o sorteio das outras
três, é a única coisa no app com hora marcada. Se **todos** estiverem
esperando, entra o de data mais próxima — ficar sem card nenhum seria pior do
que adiantar um.

**Errar desce um degrau, e só.** Um card de 90 dias passa a voltar em 30, e
continua dominado — quem já atravessou as duas direções não precisa provar de
novo que atravessou, precisa só de mais um encontro, e mais cedo. Errando
sempre, ele se estabiliza no degrau de baixo e volta a cada três dias, sendo
cobrado por escrito em espanhol até acertar de novo. É o laço mais apertado que
a escada tem, e é onde um card esquecido deve mesmo ficar.

Isso mudou duas vezes. Na primeira versão um só deslize apagava meses de
maturidade e devolvia o card ao começo da escada. Depois ele passou a cair para
`inversa-escrita`, o que ainda o obrigava a reconquistar os acertos seguidos
antes de voltar à escada. Agora não sai.

O card nunca sai do baralho. Ele só espera mais.

O painel mostra **a escada inteira**: quantos cards em cada degrau, quantos já
venceram a data e estão de prontidão para furar a fila, e em quantos dias o
próximo aparece. Degrau onde ninguém chegou ainda fica na tabela, esmaecido —
ver o degrau vago diz tanto quanto ver o cheio.


## Onde roda

No ar em **[gereneto.github.io/espanhol-cards](https://gereneto.github.io/espanhol-cards/)**,
publicado pelo GitHub Pages a partir da branch `main`, pasta `/ (root)`.

É um site estático, sem build e sem dependências, então o Pages serve os
arquivos direto (o `.nojekyll` na raiz evita que o Jekyll se meta). Para mexer
localmente, basta abrir o `index.html` no navegador — funciona igual.

## Dados e sincronização

O progresso fica no `localStorage` do navegador e é enviado para
**[espanhol-cards-dados](https://github.com/gereneto/espanhol-cards-dados)**,
onde são gravados três arquivos:

- `progresso.json` — estado de cada card (etapa, acertos, erros, tempos, histórico)
- `sessoes/<data>.json` — registro de cada resposta da sessão
- `resumo.md` — relatório legível, base para calibrar a próxima leva
- `contestacoes.json` — respostas que você achou que deveriam ter sido aceitas
- `comentarios.json` — o que você comentou num card, pelo botão do rodapé

A cada atualização do baralho, os **três canais de retorno** são revistos
juntos: os comentários, as contestações, e os **«deu quase» que você marcou
como acerto**. Esse terceiro é o mais silencioso dos três — não pede nada, mas
é onde a variante legítima aparece antes de virar contestação. Dos 24 que
apareceram até agora, 13 eram tradução boa que a lista não previa; os outros
10 eram erro de digitação, que é exatamente o que o balde do «quase» existe
para pegar.

Para ligar a sincronização, abra **⚙️** no app e informe um
[fine-grained token](https://github.com/settings/personal-access-tokens/new)
com acesso **apenas** ao repositório de dados e permissão **Contents: Read and write**.
O token fica só no seu navegador — ele nunca entra neste repositório.

Sem token o app funciona igual, só que os dados ficam no navegador; dá para
exportar e importar o arquivo à mão pelas mesmas configurações.

## Mexendo nos cards

Os cards ficam em `fonte/cards/*.json`. Cada um é assim:

```json
{
  "id": "p001",
  "tipo": "palavra",
  "es": "embarazada",
  "pt": "grávida",
  "en": "pregnant",
  "aceitas": ["gravida", "prenha"],
  "aceitasEn": ["pregnant", "expecting", "with child"],
  "distratores": ["envergonhada", "atrapalhada", "confusa", "embaraçada (cabelo)"],
  "distratoresEn": ["embarrassed", "exhausted", "clumsy", "furious"],
  "nivel": "A2",
  "tags": ["falso-amigo"],
  "nota": "Clássico falso amigo. 'Embarazada' = grávida. Envergonhada = 'avergonzada'.",
  "notaEn": "'Embarazada' means pregnant. To say you are embarrassed, use 'avergonzado'."
}
```

`pt` é a resposta mostrada; `aceitas` são as **outras maneiras de dizer a mesma
coisa**, e é lá que se resolve a variação de tradução.

### O lado inglês

Cada card carrega também `en`, `aceitasEn`, `distratoresEn` e `notaEn` — e, nos
cinquenta de conjugação, `formasEsEn`. É a base do site em inglês, e por
enquanto serve à revisão (adiante). Três regras, que o `build.js` cobra:

- **O inglês é tradução do espanhol, não do português.** Se saísse do `pt`, o
  inglês herdaria justamente o erro que a revisão existe para pegar.
- **Cada língua tem o seu formato.** O `en` tem a forma que o inglês pede, não a
  que o `pt` tem: se uma palavra basta, é uma palavra. Barra só quando o
  espanhol carrega mesmo dois sentidos (`cola` = "the tail / the queue"). E os
  `distratoresEn` acompanham o `en`, não o `pt`.
- **A `notaEn` não menciona o português.** Quem estuda em inglês não o tem como
  referência: onde a nota portuguesa aponta um vizinho luso, a inglesa aponta os
  vizinhos dentro do próprio espanhol (`polvo`/`pulpo`, `cena`/`escena`).

### Os arquivos são levas, não categorias

Os nove arquivos de `fonte/cards/` guardam duas ideias diferentes, uma por
cima da outra. Os quatro primeiros nasceram juntos, no commit que criou o app,
e os nomes deles descrevem os temas daquele baralho de 140 cards. Do quinto em
diante é **uma leva por commit** — «Leva de 112 cards, quase toda de
palavras», «Leva de 60 cards nos campos que faltavam» —, e o nome do arquivo
passou a registrar quando, não o quê.

Por isso `01-falsos-amigos.json` tem 32 dos 76 falsos amigos do baralho, e os
outros 44 estão espalhados por cinco arquivos. **Isso é assim de propósito, e
não vale a pena arrumar:**

- juntar tudo desfaria o registro das levas, que é o que a calibragem lê para
  saber o que entrou quando;
- resolveria uma etiqueta só. `expressão` são 63 cards em vários arquivos,
  `adjetivo` são 24 — e nenhuma partição por arquivo daria conta, porque um
  card é `falso-amigo` **e** `comida` ao mesmo tempo;
- nada lê os arquivos. O `build.js` ordena os nomes e concatena; quem indexa é
  a etiqueta, e é ela que o 🗂️ filtra.

**A etiqueta é o índice; o arquivo é a data.** Card novo vai para a leva
corrente, seja ele do tema que for.

Os temas ficam em `fonte/tags.json`, com rótulo em `pt`, `en` e `es`. Verbo no
infinitivo mapeia para si mesmo. Tema em uso sem tradução **barra o build**.

As checagens de formato do lado inglês (contagem de `/`, parênteses,
comprimento) saem como **aviso**, não como erro: em inglês elas são mais
ruidosas, e quem decide de fato é a revisão.

A resposta escrita cai em um de três baldes.

**Certo, direto.** Sai de graça o que é a mesma resposta escrita de outro jeito:
acento, maiúscula, pontuação, plural (`sentir saudade` = `sentir saudades`),
número por extenso (`3 anos` = `três anos`), contração (`pra`, `tô`), artigo e
pronome-sujeito (`eu concordo` = `concordo`), o `já` aspectual, o apóstrofo
(`um copo d'água` = `um copo de água`), o par `este`/`esse` (`este ano` =
`esse ano`, e o mesmo com `isto`/`isso` — `aquele` fica de fora, que aí a
distância importa), e a **posição do
advérbio de tempo** — «hoje eu não vou ao escritório», «não vou hoje no
escritório» e «não vou no escritório hoje» são a mesma frase, e o português
deixa o advérbio andar sem mudar nada. São seis palavras só (`hoje`, `ontem`,
`amanhã`, `agora`, `sempre`, `nunca`): ficam de fora `antes` e `depois`, que
puxam complemento («antes de tudo» não é «tudo antes»), e `cedo` e `tarde`, que
também são substantivo. Sinônimo
verdadeiro (`é preciso` / `é necessário`) entra pela lista `aceitas` do card —
nunca afrouxando a comparação.

A régua não é a mesma nas duas direções. Escrevendo **em espanhol** ela é mais
dura, porque a grafia é parte do que você está aprendendo: uma letra fora do
lugar pode ser exatamente a lacuna. Em português, que você já domina, errar uma
tecla não diz nada sobre saber a palavra, e a folga é maior.

**O acento e o `ñ` não são a mesma coisa.** O acento espanhol muda a sílaba
tônica, e errá-lo é deslize de escrita: **conta como acerto**, com uma linha
chamando atenção — *contou como certo, mas o acento: era «todavía»*. Já o `ñ`
é **outra letra**: `año` e `ano` são duas palavras, e confundi-las é
constrangedor. Aí é erro **seco**, sem passar pelo «deu quase», e com nome,
como o do gênero e o da conjugação: *o «ñ» é outra letra — era «la muñeca»*.

Em português nada disso vale: a acentuação não é o que você está aprendendo, e
o teclado do celular atrapalha mais do que ajuda.

Nos cards de conjugação há um corte a mais: se o que você escreveu **é outra
forma verbal registrada do card**, não foi a mão que escorregou — foi o tempo
ou a pessoa, que é justamente o que o card cobra. Isso é erro seco, sem
perguntar nada, e o feedback nomeia o que você escreveu: *«Él dice la verdad»
— presente*, contra o pretérito que era pedido.

**Em espanhol — e aí não conta.** Falso amigo engana de um jeito que estar
atento às bandeiras não resolve: você lê «la sobremesa», reconhece a palavra
portuguesa e responde o espanhol dela — «el postre», que é a resposta certa da
pergunta espelhada. O app reconhece isso, **avisa e devolve a vez**, sem contar
erro e sem gravar nada:

> **el postre** está em espanhol 🇪🇸: é a resposta da pergunta ao contrário.
> Aqui a tradução vai em português 🇧🇷 — tente de novo.

Ele sabe quais palavras espanholas valem como aviso porque a nota do card já as
carrega, uma por linha, no formato «🇪🇸 x → 🇧🇷 y» — são 156 pares em 73 cards.
Junto com elas entra a própria palavra da pergunta.

Vale **uma vez por aparição do card**: com duas viraria tentativa livre. E vale
só em `es → pt`, que é o lado em que a resposta devia estar em português — na
volta, responder em espanhol é o que se pede. O relógio continua correndo de
propósito: o tropeço não é erro, mas também não sai de graça.

**Quase — e aí quem decide é você.** Se a resposta chegou perto mas não bate,
o app não dá nem tira ponto: mostra o que você escreveu ao lado da resposta
certa e pergunta se conta como acerto. Só depois da sua decisão a resposta é
gravada, e o log guarda `julgado_por_voce: true`. É por existir essa pergunta
que a detecção pode ser generosa — erro de digitação, letra trocada, palavra
fora do lugar. Nada é aprovado à sua revelia, então o risco de aceitar errado
é seu, não do app.

**Errado — e você pode discordar.** Toda resposta escrita contada como erro
traz no fim a opção **“Acho que essa resposta deveria ser aceita”**. Às vezes o
card é que está incompleto, e quem percebe isso é quem respondeu. O caso vai
para `contestacoes.json` no repositório de dados e ganha uma seção no
`resumo.md`, para revisarmos um a um na atualização seguinte.

**Errado.** O que nem chegou perto. Negação, preposição, verbo e substantivo
entram inteiros na comparação, então `envergonhada` para `embarazada` e
`é impossível` no lugar de `é preciso` continuam simplesmente errados.

> **Os distratores precisam ter o mesmo formato da resposta certa.** Se só a certa
> traz duas traduções separadas por `/`, ou um parêntese, ou é bem mais longa que
> as outras, dá para acertar sem saber nada de espanhol — basta escolher a
> diferente. O `build.js` recusa o baralho quando isso acontece.

> **E não podem dividir uma categoria que a resposta certa não tem.** É o mesmo
> defeito um degrau acima: não é a forma que entrega, é o assunto. Se as quatro
> erradas falam todas de gato e a certa não, de novo basta escolher a diferente.
> O `build.js` avisa quando encontra uma palavra de conteúdo nos **quatro**
> distratores e em nenhum lugar da resposta certa.
>
> A checagem tem limites, e é bom saber quais. Ela não vê categoria por assunto
> sem palavra repetida — quatro frases sobre comida em que nenhuma palavra se
> repete passam batido, e isso continua sendo olho humano. E deixa de fora os
> cards de conjugação, onde as cinco alternativas têm o mesmo verbo por
> construção e o que muda é o tempo.
>
> Quando o defeito aparece, a receita é ficar com **dois** distratores literais,
> que são a armadilha de verdade — quem lê «gato encerrado» e pensa em gato tem
> de ter onde cair —, e trocar os outros dois por leituras erradas plausíveis
> fora da categoria.

Depois de editar:

```bash
node fonte/build.js
```

Isso valida tudo (ids repetidos, distrator igual à resposta, nível inválido,
card duplicado) e regenera `data/cards.json` e `data/cards.js`.

## Atalhos

| Tecla | O quê |
|---|---|
| `1`–`5` | escolhe a alternativa |
| `Enter` | responde / vai para o próximo card |
| `1`–`3` | responde "já conhecia?" |
| `1` / `2` | no quase-certo, "Acertei" / "Errei" |

No topo, 🏠 volta para a página inicial de qualquer tela, 🗂️ abre a lista de
todos os cards, 📊 as estatísticas e ⚙️ as configurações. O cabeçalho é fixo, então esses botões
ficam sempre à mão.

## O painel

O 📊 abre as estatísticas. A primeira tabela é **por nível** — é a que responde
«como estou indo», e a barra verde de cada linha é o acerto geral daquele
nível. Depois vem **o caminho até aqui**: quantos cards em cada etapa a cada
resposta que você já deu, em bandas empilhadas.

Essa série não era anotada, e refazê-la pelo histórico dos cards dava só uma
estimativa — o histórico guarda doze respostas por card, e as regras mudaram
várias vezes no percurso. Mas o **repositório de dados guarda o
`progresso.json` inteiro a cada sincronização**: são 442 fotografias do
baralho, cada uma com a etapa de todos os cards. Dali sai a série **exata**, e
é ela que o `data/historico.js` traz pronta, gerada por `fonte/historico.js`.

O app semeia com ela uma vez e daí em diante anota ponto a ponto, a cada
resposta. A semente só entra se o progresso for mesmo a continuação daquele
histórico — num navegador com dez respostas dadas, a curva de mil e quinhentas
não é de quem está ali.

O eixo horizontal anda em **respostas**, e não em índice de ponto: os pontos
semeados são um por sincronização, as sincronizações não foram parelhas, e
espaçar por índice esticaria os dias de muita sincronização.

As outras tabelas dizem **onde os cards estão**: em que pé está cada nível, a
escada dos dominados, escolher x escrever, e **por categoria** — cinco
famílias que dizem o que o card ensina, e não a forma dele: falsos amigos (77),
expressões e gírias (82), conjugação (50), frases do dia a dia (74) e
vocabulário (174). Cada card cai na primeira que casa, da mais armadilha à
mais geral.

## Vendo o baralho inteiro

O 🗂️ abre a lista completa, com busca e filtros por tipo, nível, tema e
situação. A busca varre espanhol, português, tema e a nota — e usa a mesma
normalização das respostas, então acento e plural não atrapalham. Vários termos
somam: buscar `falso comida` traz só o que tem os dois.

Cada linha mostra em que pé o card está: **ainda não apareceu**, **múltipla
escolha**, **escrevendo em português**, **na volta (você produz o espanhol)** ou
**dominado**, com o placar de certas e erradas. A barra colorida à esquerda dá o
mesmo recado de relance — cinza para o que nunca saiu, laranja para o que está
em curso, verde para o que já foi vencido nas duas direções.

## O circuito de revisão

A tradução portuguesa nunca tinha passado por um falante nativo de espanhol, e o
card `f045` mostrou como o erro entra: a resposta era um decalque do espanhol
(«tomara que ele viesse») que soa estranho em português. A revisão usa o inglês
como língua-ponte, em duas etapas independentes:

1. **Yoisser** (venezuelano, professor de espanhol) confere `es → en`. Ele julga
   se o inglês diz o que o espanhol diz. **Não vê o português** — é isso que
   torna a conferência dele uma medida independente da tradução auditada.
2. **Gere** confere `en → pt`, com o inglês já validado como referência.

São duas páginas soltas, **não ligadas a partir do `index.html`**: só se chega
por URL, e as duas levam `noindex`.

| Quem | URL |
|---|---|
| Yoisser | `gereneto.github.io/espanhol-cards/revisar-es-en.html` |
| Gere | `gereneto.github.io/espanhol-cards/revisar-en-pt.html` |

Um card por vez. O Yoisser corrige a resposta, as variantes, os quatro
distratores e a nota **nos próprios campos**, e decide entre *Aceptar todo*,
*Guardar sugerencia* e *Proponer eliminar*, com um comentário livre em qualquer
dos três casos. A tela dele é toda em espanhol.

Na página do Gere aparecem **só os cards que o Yoisser já decidiu**: o espanhol,
o inglês validado (com o que ele mudou marcado e o original riscado ao lado), e
então o português a julgar — `pt`, `aceitas`, os quatro `distratores` e a `nota`.
Marca-se **ok**, **rever** ou **apagar**, com observação. Há filtros para ver só
os pendentes, só os que ele alterou, só os que ele quer excluir ou só os que ele
comentou.

### Onde os dados ficam

Repositório **[espanhol-cards-revisao](https://github.com/gereneto/espanhol-cards-revisao)**,
separado do de progresso:

- `revisao-es-en.json` — o que o Yoisser decidiu. Guarda **só os campos que ele
  mudou**, então o arquivo diz exatamente onde ele meteu a mão.
- `revisao-en-pt.json` — o que o Gere marcou. O campo `base_en` guarda o inglês
  que estava na tela na hora; se o Yoisser reeditar depois, a página avisa que o
  inglês mudou desde a marcação.

Cada decisão vai para o `localStorage` na hora e sobe ao GitHub a cada oito, mais
ao fechar a aba. Nada se perde se a rede cair.

O app de estudo e as páginas de revisão usam **tokens diferentes**, guardados em
chaves separadas (`espanhol-cards:github` e `espanhol-cards:github-revisao`), de
modo que os dois convivem no mesmo navegador sem brigar.

### O token, e por que ele é emprestado

Um **fine-grained token só alcança recursos de um único dono** — você mesmo ou
uma organização. A documentação do GitHub é explícita: ele *não* serve para
repositório onde a pessoa é apenas colaboradora. Como `espanhol-cards-revisao`
está numa conta pessoal, um token que o Yoisser criasse na conta dele nunca
enxergaria esse repositório. As saídas seriam um token *classic* com escopo
`repo` (que alcança tudo o que ele tem), mover o repositório para uma
organização, ou emprestar o token.

Optamos por **emprestar**: um único fine-grained token, criado por mim, com
acesso **apenas** a `espanhol-cards-revisao` e permissão **Contents: Read and
write**, usado nas duas páginas. O repositório não guarda nada sensível — só as
decisões da revisão — e se o token vazar é só revogar e gerar outro. Em troca, o
Yoisser não precisa nem criar conta no GitHub.

Criar o token: `github.com/settings/personal-access-tokens/new` →
**Repository access: Only select repositories** → `espanhol-cards-revisao` →
**Permissions: Contents = Read and write**.

### O que passar ao Yoisser

> Abre esta página: `gereneto.github.io/espanhol-cards/revisar-es-en.html`
>
> Abajo del todo hay un desplegable, «Conexión con GitHub». Pega ahí el token
> que te mando aparte y pulsa Guardar — se queda solo en tu ordenador. No hace
> falta que crees ninguna cuenta.
>
> Si el token te da problemas, revisa igual y pulsa **Descargar archivo** al
> terminar: me mandas el `.json` y yo lo cargo.

O botão **Importar arquivo** da página do Gere reconhece os dois formatos pelo
campo `revisor`, então esse caminho manual funciona ponta a ponta sem token.

Os cards que eu acrescentar depois chegam nele sozinhos: a página carrega o
`data/cards.js` do próprio site, então basta dar push e pedir que recarregue.

## Estrutura

```
index.html            telas do app de estudo
revisar-es-en.html    revisão do Yoisser (só por URL)
revisar-en-pt.html    revisão do Gere (só por URL)
style.css
style-revisao.css     as telas de revisão
js/motor.js           fila, tempos, conferência das respostas
js/github.js          fábrica de clientes: GH (dados) e GH_REV (revisão)
js/app.js             fluxo, painel, relatórios
js/revisao.js         o que as duas páginas de revisão têm em comum
js/revisar-es-en.js   a tela do Yoisser
js/revisar-en-pt.js   a tela do Gere
fonte/build.js        valida e gera o baralho, nas duas línguas
fonte/historico.js    tira do repositório de dados a série exata das etapas
fonte/cards/*.json    os cards
fonte/tags.json       os temas em pt/en/es
data/cards.js         gerado — é o que as páginas carregam
data/tags.js          gerado
data/historico.js     gerado — a semente da curva do painel
```
