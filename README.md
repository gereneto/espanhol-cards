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
   Depois de três acertos seguidos escrevendo, **o card se inverte**: passa a
   mostrar o português e a pedir o espanhol, de novo primeiro escolhendo e
   depois escrevendo. Uma **🇪🇸** e uma **🇧🇷** marcam a direção — uma ao lado
   da pergunta, outra ao lado da resposta — para não haver dúvida de que lado
   traduzir. Vencer as duas direções não aposenta o card: ele passa a voltar
   cada vez mais espaçado, mas nunca sai do baralho.
4. O app cronometra cada resposta e classifica em **rápido / médio / lento**,
   com limiares diferentes para palavra e frase, e para escolher e escrever.
5. A resposta é **gravada assim que você responde** — não há botão de confirmar.
   O **Próximo card** só serve para avançar, então dá para ficar lendo a nota.
   A exceção é o quase-certo: aí o app pergunta antes se conta como acerto.
6. Se você **acertar de primeira**, ele pergunta **se já conhecia aquilo**, e grava
   assim que você responde. Não pergunta quando você erra (aí a resposta seria
   óbvia) nem quando o card já apareceu antes (aí você conheceria do próprio app).

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

### Dois baralhos

Card novo e card em revisão **não disputam a mesma fila**. Se disputassem, o
novo perderia sempre: quem está em múltipla escolha volta a 8-32 posições e
satura a frente, então quanto mais se revisa, mais raro fica o inédito. Era o
que acontecia, e a seca chegava a 75 respostas sem nenhum card novo.

Agora há **a fila em circulação**, só com o que já apareceu, e **o baralho de
inéditos**, à parte. Antes de cada card, o app decide se cabe material novo,
olhando a **carga**: quantos cards estão na primeira direção, ainda sendo
aprendidos. É esse o estoque que custa caro — na volta o card já é conhecido,
e treinar produção não compete com aprender palavra nova.

A espera entre um inédito e outro é uma curva só, não uma escada de regras:

| Carga | Espera por um card novo |
|---:|---:|
| 0 | imediato |
| 10 | 6 respostas |
| 24 | 10 |
| 30 (o alvo) | 12 |
| 40 | 22 |
| 50 ou mais | 25 — o teto |

Nunca deixa de vir: um limite que pudesse virar "nunca" recriaria a seca que a
regra veio resolver.

Os números saíram de medir um progresso real, e não de palpite. Na primeira
tentativa o alvo era 18, e um estado com 129 cards em curso — 98 deles já na
volta, só 24 na primeira direção — gerava espera de 32 respostas. Vinte e quatro
não é afogamento num baralho de 419: é o regime normal, porque `escrita` é onde
o card espera emplacar três acertos seguidos. O alvo subiu para 30 e a escalada
ficou mais mansa.

O painel mostra a carga ao lado do alvo («aprendendo agora») e o intervalo atual
(«respostas por card novo»), para o ritmo não ser mais invisível.

De quebra, isso equilibra as etapas: sem a enxurrada de inéditos, os cards
avançam em vez de empilhar na volta.

### A fila em circulação

Ao responder, o card volta para a fila mais adiante, e a distância depende de
como foi:

| Situação | Volta em ~ |
|---|---:|
| Errou | 10 posições (cresce a cada erro seguido no mesmo card) |
| Acertou na múltipla, devagar | 14 |
| Acertou na múltipla, rápido | 32 |
| Acertou escrevendo, devagar | 35 |
| Acertou escrevendo, rápido | 110 |
| Acertou escrevendo 3× seguidas | 220 — fecha a direção |

Dizer "já conhecia bem" empurra mais para o fim; "não conhecia" segura mais perto.
Acerto lento em algo que você disse não conhecer é tratado como possível chute:
o card continua na múltipla escolha.

### O card dominado, e a única data do app

A fila tem centenas de cards e todo card respondido volta para ela, então o intervalo
máximo que ela consegue dar é **uma passada pelo baralho** — uns poucos dias.
Acertar três vezes seguidas com o card voltando a cada dois dias não prova
memória de longo prazo; prova que ele ainda estava fresco.

Por isso o card que venceu as duas direções — e **só ele** — ganha uma data de
retorno, que cresce a cada revisão certa:

| Revisões certas depois de dominado | Volta em |
|---:|---:|
| 1ª | 3 dias |
| 2ª | 1 semana |
| 3ª | 2 semanas |
| 4ª | 1 mês |
| 5ª | 3 meses |
| daí em diante | 6 meses |

Enquanto a data não chega, o app pula o card e pega o seguinte da fila. Errar
devolve ao começo da escada e tira o card de dominado, de volta à múltipla
escolha da volta. Se **todos** os cards estiverem esperando, entra o de data
mais próxima — ficar sem card nenhum seria pior do que adiantar um.

O card nunca sai do baralho. Ele só espera mais.


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

Os temas ficam em `fonte/tags.json`, com rótulo em `pt`, `en` e `es`. Verbo no
infinitivo mapeia para si mesmo. Tema em uso sem tradução **barra o build**.

As checagens de formato do lado inglês (contagem de `/`, parênteses,
comprimento) saem como **aviso**, não como erro: em inglês elas são mais
ruidosas, e quem decide de fato é a revisão.

A resposta escrita cai em um de três baldes.

**Certo, direto.** Sai de graça o que é a mesma resposta escrita de outro jeito:
acento, maiúscula, pontuação, plural (`sentir saudade` = `sentir saudades`),
número por extenso (`3 anos` = `três anos`), contração (`pra`, `tô`), artigo e
pronome-sujeito (`eu concordo` = `concordo`), e o `já` aspectual. Sinônimo
verdadeiro (`é preciso` / `é necessário`) entra pela lista `aceitas` do card —
nunca afrouxando a comparação.

A régua não é a mesma nas duas direções. Escrevendo **em espanhol** ela é mais
dura, porque a grafia é parte do que você está aprendendo: uma letra fora do
lugar pode ser exatamente a lacuna. Em português, que você já domina, errar uma
tecla não diz nada sobre saber a palavra, e a folga é maior.

Nos cards de conjugação há um corte a mais: se o que você escreveu **é outra
forma verbal registrada do card**, não foi a mão que escorregou — foi o tempo
ou a pessoa, que é justamente o que o card cobra. Isso é erro seco, sem
perguntar nada, e o feedback nomeia o que você escreveu: *«Él dice la verdad»
— presente*, contra o pretérito que era pedido.

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
fonte/cards/*.json    os cards
fonte/tags.json       os temas em pt/en/es
data/cards.js         gerado — é o que as páginas carregam
data/tags.js          gerado
```
