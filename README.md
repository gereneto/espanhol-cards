# Espanhol Cards

App de estudo de espanhol para brasileiros, no estilo Anki, com foco em
**expandir vocabulário** e **desfazer as confusões clássicas entre espanhol e português**.

São 140 cards nesta primeira leva — 70 palavras e 70 frases, do A1 ao C2,
sendo 33 deles falsos amigos (`embarazada`, `exquisito`, `oficina`, `cena`, `polvo`…).

## Como funciona

1. Você clica em **Próximo card** e aparece uma palavra ou uma frase em espanhol.
2. **Na estreia do card**, a pergunta é de **múltipla escolha com 5 alternativas**.
   Os distratores não são aleatórios: são justamente as armadilhas
   (para `exquisito`, uma das opções é "esquisito").
3. Se você acertar, **da próxima vez terá que escrever** a resposta.
   Se errar escrevendo, o card volta para a múltipla escolha.
4. O app cronometra cada resposta e classifica em **rápido / médio / lento**,
   com limiares diferentes para palavra e frase, e para escolher e escrever.
5. A resposta é **gravada assim que você responde** — não há botão de confirmar.
   O **Próximo card** só serve para avançar, então dá para ficar lendo a nota.
6. Se você **acertar de primeira**, ele pergunta **se já conhecia aquilo**, e grava
   assim que você responde. Não pergunta quando você erra (aí a resposta seria
   óbvia) nem quando o card já apareceu antes (aí você conheceria do próprio app).

Tudo isso é gravado para calibrar as próximas levas de cards.

### A fila

Não há repetição espaçada por datas. Existe **uma fila só**: ao responder,
o card volta para a fila mais adiante, e a distância depende de como foi:

| Situação | Volta em ~ |
|---|---:|
| Errou | 10 posições (cresce a cada erro seguido no mesmo card) |
| Acertou na múltipla, devagar | 14 |
| Acertou na múltipla, rápido | 32 |
| Acertou escrevendo, devagar | 35 |
| Acertou escrevendo, rápido | 110 |
| Acertou escrevendo 3× seguidas, rápido | 220 — sai de circulação |

Dizer "já conhecia bem" empurra mais para o fim; "não conhecia" segura mais perto.
Acerto lento em algo que você disse não conhecer é tratado como possível chute:
o card continua na múltipla escolha.

A fila inicial intercala os níveis (A1, A2, B1, B2, C1, C2, A1…) e alterna
palavra/frase, para descobrir logo onde está o seu teto.

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
  "aceitas": ["gravida", "prenha"],
  "distratores": ["envergonhada", "atrapalhada", "confusa", "embaraçada (cabelo)"],
  "nivel": "A2",
  "tags": ["falso-amigo"],
  "nota": "Clássico falso amigo. 'Embarazada' = grávida. Envergonhada = 'avergonzada'."
}
```

`pt` é a resposta mostrada; `aceitas` são as outras formas válidas ao escrever
(sem acento e sem artigo já são toleradas automaticamente, além de um erro
de digitação ou dois).

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

## Estrutura

```
index.html          telas
style.css
js/motor.js         fila, tempos, conferência das respostas
js/github.js        gravação no repositório de dados
js/app.js           fluxo, painel, relatórios
fonte/build.js      valida e gera o baralho
fonte/cards/*.json  os cards
data/cards.js       gerado — é o que o app carrega
```
