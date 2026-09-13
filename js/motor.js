/* ────────────────────────────────────────────────────────────────
   motor.js — estado dos cards e gestão da fila.

   Existe uma fila única. Ao responder, o card é reinserido mais adiante
   nela; quanto mais fácil foi a resposta, mais longe ele vai.

   A única exceção é o card já dominado nas duas direções: esse ganha uma
   data de retorno, que cresce a cada revisão certa. Nunca sai do baralho —
   só espera mais (ver DIAS_DOMINADO).
   ──────────────────────────────────────────────────────────────── */
window.Motor = (function () {

  /* Limiares de tempo (ms) para classificar a resposta em
     rápido / médio / lento. Variam por tipo de card e por modo. */
  const LIMIARES = {
    palavra: { multipla: [4000, 12000], escrita: [8000, 25000] },
    frase:   { multipla: [7000, 20000], escrita: [15000, 45000] }
  };

  /* Um eixo só: o CEFR. Conjugação é assunto de etiqueta ('conjugação',
     'irregular', 'pretérito'), não de faixa — o nível de um card de verbo
     sai da frequência do verbo somada à dificuldade do tempo. */
  const NIVEIS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const ROTULO_NIVEL = { A1: 'A1', A2: 'A2', B1: 'B1', B2: 'B2', C1: 'C1', C2: 'C2' };

  /* ── normalização de texto para comparar respostas ──
     Aqui só entra o que é a MESMA resposta escrita de outro jeito: acento,
     plural, número por extenso, contração, artigo e pronome-sujeito, que a
     língua dispensa. Nada que possa fazer uma resposta errada colar na
     certa — negação, preposição, verbo e substantivo ficam intactos.
     Sinônimo de verdade entra pela lista "aceitas" de cada card.

     O que conta como "o mesmo escrito de outro jeito" muda de língua para
     língua, então cada uma traz suas próprias tabelas e o normalizador
     escolhe pela língua da resposta (ver LINGUAS, no fim do bloco). Quem
     responde em português não escreve "the office", e quem responde em
     inglês não escreve "3" esperando casar com "três". */

  const NUMEROS_PT = {
    '0': 'zero', '1': 'um', '2': 'dois', '3': 'tres', '4': 'quatro',
    '5': 'cinco', '6': 'seis', '7': 'sete', '8': 'oito', '9': 'nove',
    '10': 'dez', '11': 'onze', '12': 'doze', '13': 'treze', '14': 'quatorze',
    '15': 'quinze', '16': 'dezesseis', '17': 'dezessete', '18': 'dezoito',
    '19': 'dezenove', '20': 'vinte', '30': 'trinta', '50': 'cinquenta', '100': 'cem'
  };

  const NUMEROS_EN = {
    '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
    '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine',
    '10': 'ten', '11': 'eleven', '12': 'twelve', '13': 'thirteen',
    '14': 'fourteen', '15': 'fifteen', '16': 'sixteen', '17': 'seventeen',
    '18': 'eighteen', '19': 'nineteen', '20': 'twenty', '30': 'thirty',
    '40': 'forty', '50': 'fifty', '60': 'sixty', '70': 'seventy',
    '80': 'eighty', '90': 'ninety', '100': 'hundred'
  };

  /* Contrações e grafias alternativas da mesma palavra. O valor pode trazer
     mais de uma palavra: cada uma volta para o funil e é conferida sozinha,
     então "im" vira "i am" e o "i" ainda cai como pronome-sujeito. */
  const GRAFIAS_PT = {
    pra: 'para', pro: 'para', to: 'estou', ta: 'esta', tao: 'estao',
    duas: 'dois', vc: 'voce', catorze: 'quatorze',
    /* «este ano» e «esse ano» são a mesma coisa no português do Brasil, e
       nenhum card do baralho ensina a diferença entre os dois. «Aquele» fica
       de fora: esse é o demonstrativo de longe, e aí a distância importa. */
    esse: 'este', essa: 'esta', esses: 'estes', essas: 'estas', isso: 'isto'
  };

  const GRAFIAS_ES = {};

  /* Em inglês a contração não é desleixo, é a forma corrente: "I don't mind"
     e "I do not mind" são a mesma frase. O apóstrofo já caiu antes (ver o
     "pre" do inglês), por isso as chaves aqui vêm sem ele.

     Ficam de fora as contrações cuja forma sem apóstrofo é outra palavra do
     inglês: ill (I'll / doente), well (we'll / bem), were (we're / were),
     shed (she'd / galpão), shell, lets (let's / he lets). O baralho usa as
     duas: tem "maybe ill go" e tem "She made him feel ill". Desfazer essas
     mudaria o sentido de uma resposta legítima, que é justamente o que a
     normalização não pode fazer — quando as duas leituras existem, o jeito
     é a variante entrar na lista "aceitasEn" do card. */
  const GRAFIAS_EN = {
    im: 'i am', ive: 'i have', id: 'i would',
    its: 'it is', thats: 'that is', theres: 'there is', heres: 'here is',
    hes: 'he is', shes: 'she is', whats: 'what is', whos: 'who is',
    wheres: 'where is', hows: 'how is',
    youre: 'you are', theyre: 'they are',
    weve: 'we have', youve: 'you have', theyve: 'they have',
    youll: 'you will', theyll: 'they will',
    hed: 'he would', theyd: 'they would',
    cant: 'cannot', wont: 'will not', dont: 'do not', doesnt: 'does not',
    didnt: 'did not', isnt: 'is not', arent: 'are not', wasnt: 'was not',
    werent: 'were not', havent: 'have not', hasnt: 'has not',
    hadnt: 'had not', wouldnt: 'would not', couldnt: 'could not',
    shouldnt: 'should not', mustnt: 'must not',
    gonna: 'going to', wanna: 'want to', gotta: 'got to'
  };

  /* Palavras que o português põe ou tira sem mudar nada: artigos e
     pronomes-sujeito (as duas línguas dispensam o sujeito), mais o "já"
     aspectual. Nenhuma negação e nenhuma preposição entram aqui. */
  const OMISSIVEIS_PT = new Set([
    'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas',
    'eu', 'ele', 'ela', 'eles', 'elas', 'voce', 'voces', 'tu', 'nos',
    'ja'
  ]);

  /* O espanhol dispensa o sujeito tanto quanto o português: "no sabía" é tão
     correto quanto "yo no sabía". Quem carrega a pessoa é o verbo conjugado,
     que continua entrando inteiro na comparação. O artigo espanhol não entra
     na lista — só o da frente cai, no "pre" da língua.

     «él» e «tú» entram com acento. A lista nasceu quando o espanhol chegava
     sem acento nenhum, e «el» cobria os dois; quando o acento passou a
     contar, «Él dijo la verdad» e «él está hecho un lío» deixaram de soltar o
     sujeito, e a resposta com pronome virou erro. */
  const OMISSIVEIS_ES = new Set([
    ...OMISSIVEIS_PT,
    'yo', 'tú', 'el', 'él', 'ella', 'ellos', 'ellas',
    'nosotros', 'nosotras', 'vosotros', 'vosotras', 'usted', 'ustedes'
  ]);

  /* O inglês é o oposto do português: exige o sujeito e exige o artigo. Quem
     responde escreve "the office" e o card pode trazer só "office" — ou o
     contrário. Nenhum dos dois diz nada sobre saber a palavra espanhola, que
     é o que o card cobra. Nada além de artigo e pronome-sujeito entra aqui. */
  const OMISSIVEIS_EN = new Set([
    'the', 'a', 'an',
    'i', 'he', 'she', 'it', 'they', 'we', 'you'
  ]);

  /* Plural = singular. Em português basta tirar o "s".

     Em inglês o "es" é ambíguo: "boxes" é "box"+es, mas "houses" é "house"+s.
     Sem saber qual é qual, não dá para escolher — então as duas formas são
     levadas ao MESMO lugar: tira-se o "s" e, depois, o "e" que sobrar atrás
     de sibilante. "boxes" → "boxe" → "box", e "box" já era "box"; "houses" →
     "house" → "hous", e "house" também vira "hous". O resultado não é
     palavra de dicionário, e não precisa ser: precisa só ser o mesmo dos
     dois lados da comparação. O "ss" fica de fora ("glass" não é plural),
     mas "glasses" chega a "glass" pelo mesmo caminho. */
  function pluralPt(p) {
    return p.replace(/^(\w{3,})s$/, '$1');
  }
  function pluralEn(p) {
    if (/^\w{3,}ies$/.test(p)) p = p.slice(0, -3) + 'y';                // babies → baby
    else if (/^\w{3,}s$/.test(p) && !/ss$/.test(p)) p = p.slice(0, -1); // cats → cat
    return p.replace(/(s|x|z|ch|sh)e$/, '$1');                          // boxe → box
  }

  /* O espanhol dispensa o artigo do mesmo jeito que o português: quem
     responde "oficina" acertou tanto quanto quem responde "la oficina". */
  const ARTIGOS_ES = /^(el|la|los|las|un|una|unos|unas)\s+/;

  /* No português o apóstrofo é sempre a mesma coisa: um «de» que perdeu a
     vogal antes de outra. «Um copo d'água» é «um copo de água», e a
     pontuação viraria espaço logo adiante, deixando um «d» solto. */
  function prePt(s) {
    return s.replace(/\bd['’´`]\s*/g, 'de ');
  }

  /* Ajustes que precisam do texto ainda inteiro, antes de a pontuação virar
     espaço. É onde o inglês desfaz o apóstrofo: se ele virasse espaço,
     "I don't mind" seria "i don t mind" e nunca casaria com "i dont mind". */
  function preEn(s) {
    return s
      .replace(/['’´`]/g, '')                       // don't → dont
      .replace(/\bcan not\b/g, 'cannot')
      .replace(/\bone (hundred|thousand|million)\b/g, '$1');  // 100 = a hundred
  }

  /* ── acento: quem perdoa e quem cobra ──
     Em português a acentuação não é o que se está aprendendo: errar o til de
     «saudade» não diz nada sobre saber a palavra, e o teclado do celular
     atrapalha mais do que ajuda. Em espanhol é o contrário — o acento é parte
     da grafia que o card ensina, e «ñ» é OUTRA LETRA, não um «n» enfeitado:
     «año» e «ano» são duas palavras, e a diferença entre elas é constrangedora.

     Então o português continua chegando sem acento nenhum ao funil, e o
     espanhol chega inteiro. A consequência é que responder em espanhol passa
     a exigir a acentuação certa. Foi pedido, e é coerente com a régua que já
     era mais dura desse lado. */
  const PONTUACAO_PT = /[^a-z0-9\s]/g;
  const PONTUACAO_ES = /[^a-z0-9áéíóúüñ\s]/g;

  /* O plural continua caindo dos dois lados: ele é a mesma palavra escrita de
     outro jeito, e não tem nada a ver com acento. A classe precisa das letras
     espanholas para «años» chegar a «año». */
  function pluralEs(p) {
    return p.replace(/^([a-záéíóúüñ]{3,})s$/, '$1');
  }

  const LINGUAS = {
    pt: {
      omissiveis: OMISSIVEIS_PT, numeros: NUMEROS_PT,
      grafias: GRAFIAS_PT, plural: pluralPt, pre: prePt,
      pontuacao: PONTUACAO_PT
    },
    /* O espanhol não herda as grafias do português: «pra», «vc» e «isso» não
       são palavras dele, e desfazê-las aqui só abriria porta para casar coisa
       que não casa. A tabela própria está vazia porque, até agora, o espanhol
       do baralho não precisou de nenhuma. */
    es: {
      omissiveis: OMISSIVEIS_ES, numeros: NUMEROS_PT,
      grafias: GRAFIAS_ES, plural: pluralEs,
      pre: s => s.trim().replace(ARTIGOS_ES, ''),
      pontuacao: PONTUACAO_ES, guardaAcento: true
    },
    en: {
      omissiveis: OMISSIVEIS_EN, numeros: NUMEROS_EN,
      grafias: GRAFIAS_EN, plural: pluralEn, pre: preEn,
      pontuacao: PONTUACAO_PT
    }
  };

  /* ── o advérbio de tempo que anda pela frase ──
     «Hoje eu não vou ao escritório» e «Não vou ao escritório hoje» são a mesma
     frase: o português põe o advérbio na frente ou atrás sem mudar nada. Foram
     duas contestações — u010 e v002 — e, sem regra, cada card teria de prever
     as duas ordens na mão, para sempre.

     Aqui o advérbio vai para o fim, venha ele de onde vier, dos dois lados da
     comparação: «hoje não vou», «não vou hoje no escritório» e «não vou no
     escritório hoje» chegam todas ao mesmo lugar. Não há risco de igualar
     coisas diferentes: duas respostas que só diferem na posição do advérbio
     são, em português, a mesma resposta.

     A lista é curta de propósito. Ficam de fora «antes» e «depois», que puxam
     complemento muito mais do que andam sozinhos — «antes de tudo» não é
     «tudo antes» —, e ficam de fora «cedo» e «tarde», que também são
     substantivo: «a tarde» é hora do dia, não é chegar atrasado. */
  const TEMPO = {
    pt: new Set(['hoje', 'ontem', 'amanha', 'agora', 'sempre', 'nunca']),
    es: new Set(['hoy', 'ayer', 'manana', 'ahora', 'siempre', 'nunca']),
    en: new Set(['today', 'yesterday', 'tomorrow', 'now', 'always', 'never'])
  };

  function tempoParaOFim(palavras, lingua) {
    const tabela = TEMPO[lingua] || TEMPO.pt;
    if (palavras.length < 2) return palavras;
    const resto = [], tempo = [];
    palavras.forEach(p => (tabela.has(p) ? tempo : resto).push(p));
    return resto.length ? resto.concat(tempo) : palavras;
  }

  /* Português é o padrão: quem já chamava normalizar(txt) continua igual. */
  function normalizar(txt, lingua) {
    const L = LINGUAS[lingua] || LINGUAS.pt;

    let texto = String(txt || '').toLowerCase();
    if (L.guardaAcento) {
      /* NFC junta o «n» e o til numa letra só, para o ñ digitado dos dois
         jeitos chegar ao mesmo lugar. */
      texto = texto.normalize('NFC');
    } else {
      texto = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');  // tira acentos
    }
    if (L.pre) texto = L.pre(texto);                      // contração, artigo da frente
    const bruto = texto.replace(L.pontuacao, ' ');        // tira pontuação

    const saida = [];
    for (const bruta of bruto.split(/\s+/)) {
      if (!bruta) continue;
      /* a grafia vem primeiro porque pode render mais de uma palavra, e cada
         uma tem de descer o resto do funil como se tivesse sido escrita */
      for (let p of (L.grafias[bruta] || bruta).split(' ')) {
        if (L.omissiveis.has(p)) continue;                // antes de mexer na palavra
        if (L.numeros[p]) p = L.numeros[p];               // "3 anos" = "três anos"
        p = L.plural(p);                                  // plural = singular
        if (L.omissiveis.has(p)) continue;                // e de novo, para "eles" → "ele"
        saida.push(p);
      }
    }
    return tempoParaOFim(saida, lingua in LINGUAS ? lingua : 'pt').join(' ');
  }

  /* ── que língua cada direção usa ──
     A direção é sempre "pergunta-resposta": 'es-pt' mostra o espanhol e cobra
     o português, 'es-en' vai cobrar o inglês, 'en-es' vai cobrar o espanhol.
     É daqui que o conferidor tira em que língua a resposta está sendo dada. */
  function linguaDaPergunta(direcao) {
    const l = String(direcao || 'es-pt').split('-')[0];
    return LINGUAS[l] ? l : 'es';
  }
  function linguaDaResposta(direcao) {
    const l = String(direcao || 'es-pt').split('-')[1];
    return LINGUAS[l] ? l : 'pt';
  }
  /* distância de Levenshtein, só para deslize de digitação em palavra única */
  function distancia(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m || !n) return m || n;
    let ant = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
      const atual = [i];
      for (let j = 1; j <= n; j++) {
        atual[j] = Math.min(
          ant[j] + 1,
          atual[j - 1] + 1,
          ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
      ant = atual;
    }
    return ant[n];
  }

  /* Atalhos por língua, para quem já sabe em qual está mexendo. */
  function normalizarEs(txt) { return normalizar(txt, 'es'); }
  function normalizarEn(txt) { return normalizar(txt, 'en'); }

  /* Todas as formas aceitas como resposta certa, na direção pedida.
     Quem manda é a língua da resposta, não a direção: 'en-es' e 'pt-es'
     cobram o mesmo espanhol, e cada língua tem seu par de campos no card. */
  const CAMPOS = {
    pt: { certa: 'pt', aceitas: 'aceitas' },
    es: { certa: 'es', aceitas: 'aceitasEs' },
    en: { certa: 'en', aceitas: 'aceitasEn' }
  };
  function formasAceitas(card, direcao) {
    const lingua = linguaDaResposta(direcao);
    const campo = CAMPOS[lingua];
    const certa = String(card[campo.certa] || '');
    const extras = card[campo.aceitas] || [];

    /* No espanhol a barra não separa duas respostas: o card traz uma forma
       só, e as variantes vêm por aceitasEs. */
    return lingua === 'es'
      ? [certa, ...extras]
      : [certa, ...certa.split('/'), ...extras];
  }

  function respostasAceitas(card, direcao) {
    const lingua = linguaDaResposta(direcao);
    return formasAceitas(card, direcao).map(t => normalizar(t, lingua)).filter(Boolean);
  }

  /* ── teto de cada campo de texto ──
     Num app de uma pessoa só, campo sem limite nunca incomodou. Com mais
     gente usando, cada caractere digitado vai parar no progresso.json e
     sobe para o repositório a cada três respostas — e é o navegador de
     quem responde que decide o tamanho. Os números saem do baralho, com
     folga: a maior resposta tem 54 caracteres, a maior nota tem 559. */
  const LIMITES = {
    resposta: 120,      // o campo de responder
    comentario: 500,    // comentário livre sobre um card
    campoCurto: 200,    // resposta, distrator e variante nas telas de revisão
    nota: 900           // a nota, nas telas de revisão
  };

  function cortar(txt, limite) {
    return String(txt == null ? '' : txt).slice(0, limite);
  }

  /* ── o gênero do artigo ──
     Omitir o artigo é permitido: quem responde «vaso» sabe tanto quanto
     quem responde «el vaso», e é por isso que o artigo cai na normalização.
     Escrever o artigo errado é outra coisa — não é omitir, é afirmar o
     gênero errado, e o gênero é metade do que o card de substantivo ensina.
     «el luna» tem de ser erro.

     Só o artigo da frente entra na conta. Policiar os do meio da frase
     esbarraria em contração («a la», «del») e daria falso negativo sem
     ensinar nada — e é na frente que o gênero do substantivo se declara. */
  const ARTIGOS_GENERO = {
    es: { el:'m', los:'m', un:'m', unos:'m', la:'f', las:'f', una:'f', unas:'f' },
    pt: { o:'m', os:'m', um:'m', uns:'m', a:'f', as:'f', uma:'f', umas:'f' },
    en: {}
  };

  function generoDaFrente(txt, lingua) {
    const primeira = String(txt || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ').trim().split(/\s+/)[0];
    return (ARTIGOS_GENERO[lingua] || {})[primeira] || null;
  }

  /* ── respondeu certo, na língua errada ──
     Nos falsos amigos acontece de ler o espanhol como se fosse português e
     responder o espanhol da OUTRA palavra: «la sobremesa» pede «a conversa
     depois da refeição», e sai «el postre» — que é a resposta certa da
     pergunta espelhada. Estar atento às bandeiras não resolve; a palavra é
     que engana.

     A nota do card já carrega esses pares, um por linha, no formato
     «🇪🇸 x → 🇧🇷 y»: são 156 pares em 73 cards, e é de lá que sai a lista de
     espanhóis que valem como aviso, sem adivinhação nenhuma. Junto com eles
     entra a própria palavra da pergunta.

     Vale só em es→pt, que é o lado onde a resposta devia estar em português.
     Na volta, responder em espanhol é o que se pede.

     Quem chama isto é o app, e só depois de a resposta ter sido dada como
     errada — então nunca há risco de barrar uma tradução boa. */
  function espanhoisDoCard(card) {
    const saida = [String((card && card.es) || '')];
    const par = /🇪🇸\s*([^→\n]+?)\s*→\s*🇧🇷/g;
    let m;
    while ((m = par.exec(String((card && card.nota) || '')))) {
      m[1].split(',').forEach(t => saida.push(t.trim()));
    }
    return saida.filter(Boolean);
  }

  /* Aqui a régua é a frouxa, de propósito. Reconhecer que a resposta saiu em
     espanhol é outra pergunta que corrigir espanhol: quem escreve «el raton»
     sem o acento em es→pt não está errando o espanhol — está respondendo na
     língua errada, e é disso que ele precisa ser avisado. */
  function semAcento(t) {
    return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  /* ── o acento e o «ñ» não são a mesma coisa ──
     O acento espanhol muda a sílaba tônica, e errá-lo é um deslize de escrita
     — vale corrigir, não vale reprovar. Já o «ñ» é OUTRA LETRA: «año» e «ano»
     são duas palavras, e confundi-las é constrangedor. Então:

       só faltou acento   →  a resposta conta como certa, com um aviso
       o «ñ» virou «n»    →  erro seco, como o do gênero e o da conjugação

     Esta função acha a forma certa quando o que ele escreveu bate com ela a
     menos de acento e/ou «ñ», e diz de qual dos dois casos se trata. Quando
     há as duas diferenças ao mesmo tempo, manda o «ñ»: é o que pesa.

     Devolve o texto ORIGINAL do card, e não o normalizado: quem vai aparecer
     na tela é «apañárselas», não «apañársela», que é o que sobra do funil. */
  function semAcentoMantendoEne(t) {
    return String(t || '').normalize('NFC').toLowerCase()
      .replace(/ñ/g, '\u0001')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\u0001/g, 'ñ');
  }

  /* «Él dijo la verdad» escrito «el dijo la verdad»: os dois soltam o
     sujeito e chegam iguais, e a resposta conta como certa — mas o acento é
     o que separa o pronome do artigo, e vale o aviso. Só quando ele escreveu
     o «el» na frente e o card começa por «Él». */
  function pronomeSemAcento(card, texto, direcao) {
    if (!/^[\s¡¿"«]*el\s/i.test(String(texto || '').normalize('NFC'))) return null;
    const dado = normalizarEs(texto);
    const alvo = formasAceitas(card, direcao).find(f =>
      /^[\s¡¿"«]*él\s/i.test(String(f).normalize('NFC')) && normalizar(f, 'es') === dado);
    return alvo ? String(alvo).trim() : null;
  }

  function difDeGrafiaEs(card, texto, direcao) {
    if (linguaDaResposta(direcao) !== 'es') return null;
    const dado = normalizarEs(texto);
    if (!dado) return null;
    if (respostasAceitas(card, direcao).includes(dado)) {    // acertou, acento e tudo
      const forma = pronomeSemAcento(card, texto, direcao);   // — menos o do «él»
      return forma ? { forma: forma, classe: 'acento' } : null;
    }
    const comEne = semAcentoMantendoEne(dado);
    const semNada = semAcento(dado);
    let doEne = null;
    for (const alvo of formasAceitas(card, direcao)) {
      const n = normalizar(alvo, 'es');
      if (semAcentoMantendoEne(n) === comEne) {
        return { forma: String(alvo).trim(), classe: 'acento' };
      }
      if (!doEne && semAcento(n) === semNada) doEne = String(alvo).trim();
    }
    return doEne ? { forma: doEne, classe: 'ene' } : null;
  }

  /* O «ñ» errado: erro seco. */
  function erroDeEne(card, texto, direcao) {
    const d = difDeGrafiaEs(card, texto, direcao);
    return d && d.classe === 'ene' ? d.forma : null;
  }

  /* Só o acento: conta como acerto, e o app chama atenção. */
  function acentoRelevado(card, texto, direcao) {
    const d = difDeGrafiaEs(card, texto, direcao);
    return d && d.classe === 'acento' ? d.forma : null;
  }

  /* ── onde exatamente o acento caiu ──
     «No creo que sea fácil» tem cinco palavras e só uma com acento. Mostrar a
     frase inteira no aviso obriga a procurar; mostrar «fácil» vai direto. E
     na resposta certa, embaixo, a letra que faltou ganha cor.

     Vale para os dois lados do erro: o acento que faltou («facil») e o que
     sobrou («me dá corte», «água», «dió»). No segundo, a palavra certa não
     tem acento nenhum, e o que se pinta é a letra onde ele o pôs.

     Devolve as palavras certas em que o acento saiu errado, e a resposta
     certa fatiada em pedaços — cada letra errada vem marcada, para o app
     pintar. Uma palavra que ele escreveu certa não é marcada, mesmo que
     outra da frase tenha saído errada. */
  const LETRA = /[a-z0-9áéíóúüñ]/i;
  const PALAVRA = /[a-z0-9áéíóúüñ]+/gi;

  function acentoFaltando(card, texto, direcao) {
    const certo = acentoRelevado(card, texto, direcao);
    if (!certo) return null;
    const escritas = String(texto || '').normalize('NFC').toLowerCase().match(PALAVRA) || [];
    const palavras = [];
    const pedacos = [];
    String(certo).normalize('NFC').split(/([^a-z0-9áéíóúüñ]+)/i).forEach(p => {
      if (!p) return;
      const minus = p.toLowerCase();
      if (!LETRA.test(p) || escritas.includes(minus)) {
        pedacos.push({ texto: p, destaque: false });
        return;
      }
      /* A mesma palavra, escrita com o acento em outro lugar ou a mais. */
      const base = semAcentoMantendoEne(minus);
      const par = escritas.find(w => w.length === minus.length && semAcentoMantendoEne(w) === base);
      if (!par && !/[áéíóúü]/i.test(p)) { pedacos.push({ texto: p, destaque: false }); return; }
      palavras.push(p);
      p.split('').forEach((ch, i) => pedacos.push({
        texto: ch,
        destaque: par ? ch.toLowerCase() !== par[i] : /[áéíóúü]/i.test(ch)
      }));
    });
    return palavras.length ? { palavras: palavras, pedacos: pedacos } : null;
  }

  function linguaTrocada(card, texto, direcao) {
    if (direcao !== 'es-pt') return null;
    const dado = semAcento(normalizarEs(texto));
    if (!dado) return null;
    const espanhois = espanhoisDoCard(card);
    for (let i = 0; i < espanhois.length; i++) {
      if (semAcento(normalizarEs(espanhois[i])) === dado) {
        return { palavra: espanhois[i], propria: i === 0 };
      }
    }
    return null;
  }

  /* ── o gênero que muda a palavra inteira ──
     «la servilleta» escrita «el servilleto»: o artigo e a terminação foram
     juntos para o masculino. O funil tira o artigo, e sobrava «servilleto»
     contra «servilleta» — uma letra, que caía no «deu quase» como se fosse a
     mão escorregando. Não foi: foi o gênero, que é o que o card ensina.

     Conta como troca de gênero quando as duas frases têm as mesmas palavras
     e as que diferem só trocam -o por -a (ou -os por -as) no fim. O radical
     precisa de duas letras: «lo» e «la» são pronomes, e trocar um pelo
     outro é outro erro. Vale só no espanhol, e só nos cards de palavra: numa
     frase, «hablo» e «habla» também trocam -o por -a, e ali o erro é de
     pessoa, não de gênero. */
  function terminacaoTrocada(a, b) {
    const pa = a.split(' '), pb = b.split(' ');
    if (pa.length !== pb.length) return false;
    let trocas = 0;
    for (let i = 0; i < pa.length; i++) {
      if (pa[i] === pb[i]) continue;
      const x = pa[i].match(/^(.{2,}?)([oa])(s?)$/);
      const y = pb[i].match(/^(.{2,}?)([oa])(s?)$/);
      if (!x || !y || x[1] !== y[1] || x[3] !== y[3] || x[2] === y[2]) return false;
      trocas++;
    }
    return trocas > 0;
  }

  /* Devolve o artigo que era esperado quando o que ele escreveu bate no
     resto mas erra o gênero — e null quando não há erro de gênero nenhum. */
  function erroDeGenero(card, texto, direcao) {
    const lingua = linguaDaResposta(direcao);
    if (lingua === 'es' && card && card.tipo === 'palavra') {
      const dado = normalizar(texto, lingua);
      if (dado && !respostasAceitas(card, direcao).includes(dado)) {
        const alvo = formasAceitas(card, direcao)
          .find(f => terminacaoTrocada(semAcento(normalizar(f, lingua)), semAcento(dado)));
        if (alvo) return String(alvo).trim();
      }
    }
    const dadoGenero = generoDaFrente(texto, lingua);
    if (!dadoGenero) return null;              // não escreveu artigo: pode omitir

    const dado = normalizar(texto, lingua);
    /* Entre as formas aceitas, só interessam as que casam com o que ele
       escreveu e trazem artigo. Um card pode aceitar sinônimo de outro
       gênero («o quadril» e «a bacia»), e comparar com a forma canônica
       reprovaria o sinônimo legítimo. */
    const candidatas = formasAceitas(card, direcao)
      .filter(f => normalizar(f, lingua) === dado && generoDaFrente(f, lingua));
    if (!candidatas.length) return null;       // nenhuma forma aceita traz artigo
    if (candidatas.some(f => generoDaFrente(f, lingua) === dadoGenero)) return null;
    return candidatas[0];
  }

  /* Confere a resposta escrita. Devolve 'certo' | 'quase' | 'errado'.

     'certo' é só o que consta da lista do card depois de normalizado —
     nenhuma semelhança de texto vira acerto sozinha.

     'quase' não decide nada: marca que a resposta chegou perto o bastante
     para valer a pergunta, e quem julga é a pessoa. Como ninguém é aprovado
     à revelia, aqui dá para ser generoso: erro de digitação, uma letra
     trocada, uma palavra fora do lugar. Se for deslize, ela diz que
     acertou; se o sentido mudou, ela diz que errou. */
  function conferir(card, texto, direcao) {
    const lingua = linguaDaResposta(direcao);
    const dado = normalizar(texto, lingua);
    if (!dado) return 'errado';

    /* O gênero errado é erro seco, sem passar pelo "deu quase": não foi a
       mão que escorregou, foi o gênero — que é o que o card ensina. */
    if (erroDeGenero(card, texto, direcao)) return 'errado';

    const aceitas = respostasAceitas(card, direcao);
    if (aceitas.includes(dado)) return 'certo';

    /* Se o que ele escreveu é outra conjugação registrada do mesmo verbo,
       não foi a mão que escorregou: foi o tempo ou a pessoa que ele errou,
       que é justamente o que o card cobra. Erro seco, sem perguntar. */
    if (formaReconhecida(card, texto, direcao)) return 'errado';

    /* O «ñ» trocado por «n» é erro seco: são letras diferentes. */
    if (erroDeEne(card, texto, direcao)) return 'errado';

    /* Faltou só o acento: conta como certo. Quem avisa é o app. */
    if (acentoRelevado(card, texto, direcao)) return 'certo';

    if (aceitas.some(alvo => parecido(dado, alvo, lingua))) return 'quase';
    return 'errado';
  }

  /* Quando a resposta coincide com outra forma verbal do card, devolve qual
     é, para o feedback poder dizer o que ele escreveu de fato. */
  function formaReconhecida(card, texto, direcao) {
    if (linguaDaResposta(direcao) !== 'es' || !card.formasEs) return null;

    /* as formas são sempre as mesmas; o rótulo é que sai na língua de quem
       está lendo a pergunta — formasEsEn quando o card foi perguntado em inglês */
    const rotulos = linguaDaPergunta(direcao) === 'en' && card.formasEsEn
      ? card.formasEsEn : card.formasEs;

    const dado = normalizarEs(texto);
    for (const forma of Object.keys(card.formasEs)) {
      if (normalizarEs(forma) === dado) return { forma, rotulo: rotulos[forma] };
    }
    return null;
  }

  /* Perto o bastante para perguntar — não perto o bastante para valer ponto.

     Escrevendo em espanhol a régua é mais dura: a grafia é parte do que se
     está aprendendo, então uma letra fora do lugar pode ser exatamente a
     lacuna, não um deslize de teclado. Escrevendo na língua de casa —
     português ou inglês —, errar uma tecla não diz nada sobre saber a
     palavra. Por isso quem decide é a língua da resposta, não a direção. */
  function parecido(a, b, lingua) {
    const maior = Math.max(a.length, b.length);
    if (maior < 4) return false;

    const d = distancia(a, b);
    if (!d) return true;
    const inversa = lingua === 'es';

    if (!a.includes(' ') && !b.includes(' ')) {
      return inversa ? (d === 1 && maior >= 6) : d <= (maior >= 8 ? 2 : 1);
    }
    return 1 - d / maior >= (inversa ? 0.92 : 0.82);
  }

  /* Acima disto ninguém está mais olhando o card: largou o celular, foi
     fazer outra coisa e voltou. O relógio continuou correndo, mas o número
     não mede nada — nem pensar demorado, nem dificuldade. Três minutos é
     folgado até para a frase mais longa escrita com calma. */
  const MS_ABANDONO = 180000;

  function tempoConfiavel(ms, saiuDaAba) {
    return !saiuDaAba && ms < MS_ABANDONO;
  }

  /* Tempo que não é confiável não pode virar "lento": lento empurra o card
     de volta mais cedo e alimenta a suspeita de chute. Na dúvida, o meio,
     que não pune nem premia. */
  function velocidade(card, modo, ms, saiuDaAba) {
    if (!tempoConfiavel(ms, saiuDaAba)) return 'medio';
    const [rapido, lento] = LIMIARES[card.tipo][modo];
    if (ms <= rapido) return 'rapido';
    if (ms >= lento) return 'lento';
    return 'medio';
  }

  /* ── estado por card ── */
  function estadoInicial(id) {
    return {
      id,
      etapa: 'multipla',   // ver FASES: duas direções, cada uma com dois modos
      vistas: 0,
      acertos: 0,
      erros: 0,
      seguidas: 0,         // acertos consecutivos
      errosSeguidos: 0,    // erros consecutivos
      conhecia: null,      // última resposta à pergunta "já conhecia?"
      ultima: null,        // ISO da última vez que apareceu
      revisoes: 0,         // revisões certas já feitas depois de dominado
      voltaEm: null,       // ISO: só o card dominado espera uma data
      porModo: contadoresPorModo(),
      velocidades: { rapido: 0, medio: 0, lento: 0 },
      historico: []        // últimas 12 respostas
    };
  }

  /* O histórico guarda só as últimas 12 respostas — bom para mostrar o
     percurso recente, ruim para somar. Estes contadores não truncam, e é
     deles que o painel tira "escolher x escrever". */
  function contadoresPorModo() {
    return { multipla: { n: 0, certas: 0 }, escrita: { n: 0, certas: 0 } };
  }

  /* ── quatro filas, e de qual delas vem o próximo card ──

     Card novo e card em revisão nunca disputaram a mesma fila — se
     disputassem, o novo perderia sempre. Agora são quatro filas separadas:

       inéditos   o que nunca apareceu
       es→pt      você reconhece o espanhol (multipla, escrita)
       pt→es      você produz o espanhol (inversa-multipla, inversa-escrita)
       dominados  vencido nas duas direções, esperando a data

     Os dominados ficam fora desta conta: eles têm gatilho de calendário e
     furam a fila quando a data chega, com espaço entre eles (ver
     vezDoDominado).

     Entre as outras três, a escolha persegue um alvo: **ALVO_FILA cards em cada
     direção**. Quem está abaixo do alvo precisa de entrada, quem está acima
     precisa de saída — e cada fila mexe no que mexe:

       tirar um inédito       +1 em es→pt        (a única torneira desse lado)
       trabalhar es→pt        as vezes −1 em es→pt e +1 em pt→es
       trabalhar pt→es        as vezes −1 em pt→es (vai para dominado)

     Daí os pesos: o déficit de es→pt puxa inédito; o déficit de pt→es puxa
     trabalho em es→pt, porque é de lá que sai gente para a volta; o excesso
     de cada lado puxa trabalho no próprio lado, que é por onde ele escoa.

     A regra antiga era uma espera em três tempos mais uma porta de
     equilíbrio. Funcionava, mas media a coisa errada: contava respostas
     desde o último inédito em vez de olhar o tamanho das filas, e a porta
     era liga-desliga — fechava de vez em 122 contra 112. Aqui não há porta:
     há peso, e ele cede aos poucos conforme a fila se aproxima do alvo.

     O peso é o desvio vezes GANHO. Com o desvio puro, cada card a mais ou a
     menos valia um ponto de peso, e o equilíbrio parava antes do alvo: os
     pisos de 10 puxam as filas para um lado, e só um desvio de alguns cards
     gerava peso para compensar — as filas assentaram em 96 e 106. Com o
     desvio multiplicado por quatro, o mesmo empurrão sai de um desvio quatro
     vezes menor. */
  const ALVO_FILA = 100;     // cards que se quer ter em cada direção
  const GANHO = 4;           // quanto pesa cada card de desvio do alvo
  const PISO_REVISAO = 10;   // nenhuma fila de revisão morre de fome
  const PISO_INEDITO = 2;    // card novo nunca deixa de vir, mas em conta-gotas
  const TETO_PESO = 100;     // desequilíbrio grande não mata as outras filas

  /* Em que fila mora cada etapa. */
  function filaDe(est) {
    const e = (est && est.etapa) || 'multipla';
    if (e === 'dominado') return 'dominados';
    return (e === 'multipla' || e === 'escrita') ? 'esPt' : 'ptEs';
  }

  /* Quantos cards em cada direção, sem contar os dominados: esses já saíram
     do circuito de aprendizado e só voltam pela data. */
  function contarDirecoes(estados) {
    let esPt = 0, ptEs = 0;
    for (const id in estados) {
      const e = estados[id];
      if (!e || !e.vistas || e.etapa === 'dominado') continue;
      if (e.etapa === 'multipla' || e.etapa === 'escrita') esPt++;
      else ptEs++;
    }
    return { esPt: esPt, ptEs: ptEs };
  }

  /* O peso de cada fila no sorteio. «tem» diz quais filas têm card para dar;
     fila vazia sai da conta em vez de roubar chance das outras. */
  function pesosDasFilas(estados, tem) {
    const c = contarDirecoes(estados);
    const corta = v => Math.min(TETO_PESO, Math.max(0, GANHO * v));
    const p = {
      ineditos: PISO_INEDITO + corta(ALVO_FILA - c.esPt),
      esPt:     PISO_REVISAO + corta(ALVO_FILA - c.ptEs) + corta(c.esPt - ALVO_FILA),
      ptEs:     PISO_REVISAO + corta(c.ptEs - ALVO_FILA)
    };
    if (tem) for (const k in p) if (!tem[k]) p[k] = 0;
    return p;
  }

  /* A chance de cada fila, em fração de 1. É o que o painel mostra e o que
     converte distância em posição, logo abaixo. */
  function chancesDasFilas(estados, tem) {
    const p = pesosDasFilas(estados, tem);
    const soma = p.ineditos + p.esPt + p.ptEs;
    if (!soma) return { ineditos: 0, esPt: 0, ptEs: 0 };
    return { ineditos: p.ineditos / soma, esPt: p.esPt / soma, ptEs: p.ptEs / soma };
  }

  function sortearFila(pesos) {
    const soma = pesos.ineditos + pesos.esPt + pesos.ptEs;
    if (!soma) return null;
    let u = Math.random() * soma;
    for (const k of ['ineditos', 'esPt', 'ptEs']) {
      if (u < pesos[k]) return k;
      u -= pesos[k];
    }
    return 'ptEs';
  }

  /* ── quem sai da fila: a urgência ──
     Até aqui o card voltava para uma POSIÇÃO: a distância em respostas vezes
     a chance da fila. Parecia justo e prendia cards para sempre. A fila tem
     cem cards e fica do mesmo tamanho; a cada card que sai do começo, outro
     entra — quase sempre na frente de quem está lá atrás, porque o erro volta
     na posição três e o acerto na trinta. Quem estava na posição 78 dava um
     passo à frente e levava um empurrão para trás, a cada vez. O histórico
     achou cards parados assim havia 1.600 respostas.

     Não dá para devolver cada card na distância pedida: com cem cards numa
     fila que leva um terço das respostas, a espera média é de trezentas
     respostas, qualquer que seja a ordem. Alguém espera mais do que pediu. A
     pergunta é quem, e a resposta antiga era «sempre os mesmos».

     Agora o card não guarda posição: guarda quando entrou e a distância que
     pediu. Na hora de tirar da fila, sai o mais urgente:

       urgência = espera ÷ distância²

     Espera ÷ distância é quantas vezes ele já esperou o que pediu; dividir
     de novo pela distância dá prioridade a quem pediu pouco. O erro (7
     respostas) que já esperou 14 tem urgência 0,29; o acerto escrito (110)
     que já esperou 220, 0,018. O erro passa na frente, como deve — mas a
     espera do outro cresce sem parar, e uma hora ele passa também. Ninguém
     fica para sempre.

     E ninguém sai antes da hora: se há card que já cumpriu a distância, só
     esses concorrem. Voltar cedo demais é justamente a muleta que as
     distâncias da volta (pt→es) existem para evitar.

     Na simulação com o seu baralho, contra a regra da posição: o erro volta
     em 23 respostas em vez de 27, e a maior espera de um card na fila cai de
     quase mil respostas para menos de quatrocentas. */
  function urgencia(est, respostas) {
    const f = est && est.naFila;
    if (!f) return 0;
    const dist = Math.max(1, f.distancia || 1);
    return (respostas - f.desde) / (dist * dist);
  }

  function cumpriu(est, respostas) {
    const f = est && est.naFila;
    return !f || respostas - f.desde >= (f.distancia || 0);
  }

  /* O índice, dentro da fila, do card que sai agora. */
  function escolherNaFila(fila, estados, respostas) {
    if (!fila.length) return -1;
    const devidos = fila.some(id => cumpriu(estados[id], respostas));
    let melhor = -1, maior = -Infinity;
    fila.forEach((id, i) => {
      if (devidos && !cumpriu(estados[id], respostas)) return;
      const u = urgencia(estados[id], respostas);
      if (u > maior) { maior = u; melhor = i; }
    });
    return melhor;
  }

  /* ── os dominados que venceram ──
     O dominado fura a fila quando chega a data. Um só, tudo bem; mas eles
     vencem em lote — 43 no mesmo dia, pelos cards dominados juntos três dias
     antes —, e o histórico mostrou 22 dominados seguidos numa sessão.

     Então há espaço entre eles: depois de um dominado, vêm pelo menos
     ESPACO_DOMINADO cards de outra fila. Passado o espaço, a vez do dominado
     é sorteada, com chance que cresce com o acúmulo: um vencido sozinho tem
     10% por card, e dez ou mais vão sempre que o espaço deixa. Com espaço
     dois, isso é no máximo um card em cada três — dá conta de 40 dominados
     num dia de 120 respostas, e o atraso típico é de poucas horas, nada
     perto dos dias da espera. */
  const ESPACO_DOMINADO = 2;
  const VENCIDOS_CHEIO = 10;

  function vezDoDominado(vencidos, desdeUltimo) {
    if (!vencidos) return false;
    if (desdeUltimo < ESPACO_DOMINADO) return false;
    return Math.random() < Math.min(1, vencidos / VENCIDOS_CHEIO);
  }

  /* ── a frase presa à palavra ──
     Um card de frase pode trazer «requer: id-da-palavra». Ele fica fora do
     baralho até a palavra estar dominada, e só então entra — na frente,
     enquanto a conquista ainda está fresca. A frase mostra a palavra em uso
     corrente, que é o que a definição sozinha não ensina: dominar «estrenar»
     não é saber que é estrear, é saber dizer «estreno zapatos hoy». */
  function liberado(card, estados) {
    if (!card || !card.requer) return true;
    const e = estados && estados[card.requer];
    return !!e && e.etapa === 'dominado';
  }

  /* Quando a palavra que abriu esta frase foi vencida. Ordena as frases
     recém-liberadas: primeiro a da palavra dominada há menos tempo. */
  function venceuEm(card, estados) {
    if (!card || !card.requer) return 0;
    const e = estados && estados[card.requer];
    return (e && e.ultima) ? (Date.parse(e.ultima) || 0) : 0;
  }

  /* ── o intervalo do card maduro ──
     Dominado não quer dizer aposentado. Acertar três vezes seguidas com o
     card voltando de dois em dois dias não prova memória de longo prazo —
     prova que ele ainda estava fresco. Então o card continua no baralho para
     sempre, e o que cresce é a espera: 3 dias, 1 semana, 2, 1 mês, 3 meses,
     meio ano. Errar desce um degrau (ver registrar).

     É a única parte do app que olha o calendário, e só para os maduros. A
     fila tem 361 cards e todo card respondido volta para ela, então sem data
     o intervalo máximo seria uma passada pelo baralho — perto demais. */
  const DIAS_DOMINADO = [3, 7, 14, 30, 90, 180];

  function proximaVolta(revisoes, agora) {
    const dias = DIAS_DOMINADO[Math.min(revisoes || 0, DIAS_DOMINADO.length - 1)];
    const d = agora ? new Date(agora) : new Date();
    d.setDate(d.getDate() + dias);
    return d.toISOString();
  }

  /* O card ainda está de molho? Só o dominado tem voltaEm. */
  function esperando(est, agora) {
    if (!est || !est.voltaEm) return false;
    return est.voltaEm > (agora || new Date().toISOString());
  }

  /* Quantas posições à frente o card volta para a fila.
     Errou → volta logo. Acertou rápido e já escrevendo → some lá no fim. */
  function distanciaNaFila(est, r) {
    let base;

    if (!r.acertou) {
      // Volta relativamente cedo, mas cada erro seguido no mesmo card
      // afasta mais: insistir de imediato num card travado só cansa.
      base = r.quase ? 10 : 7;
      /* Errar em pt→es é outra história: a grafia espanhola certa acabou de
         aparecer na tela, e o card cai na múltipla escolha da mesma direção.
         Voltar em dez posições seria pedir que se reconheça o que se acabou
         de ler — a mesma muleta que o piso do acerto nessa direção evita.
         Aqui o piso é menor do que aquele: errou, então precisa voltar. */
      if (r.direcao === 'pt-es') base = r.quase ? 26 : 20;
      base *= (1 + 0.5 * Math.min(est.errosSeguidos || 0, 4));
    } else if (r.modo === 'multipla') {
      // acertar na múltipla escolha vale pouco: pode ter sido chute
      if (r.conhecia === 'nao' && r.velocidade === 'lento') base = 8;
      else if (r.velocidade === 'lento') base = 14;
      else if (r.velocidade === 'medio') base = 22;
      else base = 32;

      /* Na volta, acertar entre cinco e ir escrever logo depois não prova
         nada: a grafia espanhola acabou de passar na frente dos olhos, e o
         que se recupera é a memória da tela, não a da palavra. O card só
         reaparece bem mais adiante, quando a imagem já não sirva de muleta. */
      if (r.acertou && r.direcao === 'pt-es') base = Math.max(base, 90);
    } else {
      if (r.velocidade === 'lento') base = 35;
      else if (r.velocidade === 'medio') base = 60;
      else base = 110;
      if (est.seguidas >= 3) base *= 2;   // acabou de fechar a direção
    }

    if (r.acertou) {
      if (r.conhecia === 'sim') base *= 1.3;
      else if (r.conhecia === 'nao') base *= 0.75;
    }
    if (r.pausado) base *= 0.9;   // tempo não é confiável, seja conservador

    const ruido = 0.85 + Math.random() * 0.3;
    return Math.max(3, Math.round(base * ruido));
  }

  /* ── quantos passos até o domínio ──
     Do zero ao dominado são SEIS respostas certas: escolher entre cinco e
     escrever duas vezes de cada lado. O contador «seguidas» não separa
     escolher de escrever, então o acerto na múltipla já conta para o portão
     — o caminho é multipla, escrita, escrita | multipla, escrita, escrita.

     Card que ninguém erra e que sai depressa não precisa das seis. O
     desconto sai do que o próprio card já mostrou:

       erro nenhum, nunca lento    →  1 passo a menos  (5 respostas)
       erro nenhum, sempre rápido  →  2 passos a menos (4 respostas)

     Ele é gasto o mais tarde possível: primeiro no portão da volta, e só
     com o desconto cheio também no da ida. Não é escrúpulo, é o que a
     evidência permite — no portão da ida o card tem três respostas e ainda
     pode tropeçar depois; no da volta o histórico está quase completo.

     Um erro depois disso apaga o desconto: «erros» deixa de ser zero e o
     portão volta a pedir três. Quem já é dominado não passa por aqui. */
  const ACERTOS_PARA_VIRAR = 3;

  function descontoDePassos(est) {
    const v = est && est.velocidades;
    /* Sem a conta não há atalho. Progresso gravado antes deste contador
       existir passa a tê-lo na primeira resposta nova, e só a partir daí o
       card pode encurtar o caminho — o desconto se ganha com evidência. */
    if (!v) return 0;
    if (est.erros || v.lento) return 0;
    return v.medio ? 1 : 2;
  }

  function acertosParaVirar(est, inversa) {
    const desconto = descontoDePassos(est);
    if (desconto >= 2) return ACERTOS_PARA_VIRAR - 1;            // os dois portões cedem
    if (desconto === 1 && inversa) return ACERTOS_PARA_VIRAR - 1;  // só o da volta
    return ACERTOS_PARA_VIRAR;
  }

  /* Acertar devagar, na múltipla escolha, algo que a pessoa diz não conhecer
     é mais provável ter sido chute do que conhecimento. */
  function pareceChute(r) {
    return !!r.acertou && r.modo === 'multipla'
      && r.conhecia === 'nao' && r.velocidade === 'lento';
  }

  /* Registra uma resposta no estado do card. */
  function registrar(est, r) {
    est.vistas++;
    est.ultima = new Date().toISOString();

    /* Progresso gravado antes destes contadores existirem não os tem. Semeia
       com o que o histórico ainda guarda — é menos do que houve, mas é o que
       sobrou, e daqui para a frente a conta passa a ser exata. */
    if (!est.porModo) {
      est.porModo = contadoresPorModo();
      (est.historico || []).forEach(h => {
        const x = est.porModo[h.modo];
        if (x) { x.n++; if (h.acertou) x.certas++; }
      });
    }
    const noModo = est.porModo[r.modo];
    if (noModo) { noModo.n++; if (r.acertou) noModo.certas++; }

    /* Mesma história para as velocidades, que o atalho do domínio consulta —
       com um cuidado a mais. O histórico guarda 12 respostas, e um card com
       mais do que isso tem um pedaço do passado que ninguém sabe. Essas
       respostas perdidas entram como «médio»: não barram o atalho, mas tiram
       o desconto cheio, que é a posição honesta para quem não sabe. */
    if (!est.velocidades) {
      est.velocidades = { rapido: 0, medio: 0, lento: 0 };
      const guardadas = est.historico || [];
      guardadas.forEach(h => {
        if (est.velocidades[h.velocidade] !== undefined) est.velocidades[h.velocidade]++;
      });
      /* «vistas» já contou a resposta de agora, e o histórico dela só entra no
         fim desta função — daí o menos um. */
      const perdidas = Math.max(0, (est.vistas || 1) - 1 - guardadas.length);
      est.velocidades.medio += perdidas;
    }
    if (est.velocidades[r.velocidade] !== undefined) est.velocidades[r.velocidade]++;

    if (r.acertou) {
      est.acertos++;
      est.seguidas++;
      est.errosSeguidos = 0;
    } else {
      est.erros++;
      est.seguidas = 0;
      est.errosSeguidos = (est.errosSeguidos || 0) + 1;
    }

    /* Avanço e recuo. Cada direção percorre o mesmo caminho: escolher entre
       cinco, depois escrever, e três acertos seguidos escrevendo fecham a
       direção. Errar devolve para a múltipla escolha da direção em que está
       — quem já provou o espanhol→português não volta à estaca zero. */
    const inversa = r.direcao === 'pt-es';
    const jaDominado = est.etapa === 'dominado';
    if (r.acertou) {
      if (jaDominado) {
        /* Card maduro que voltou depois da espera e foi acertado: continua
           dominado, e a próxima espera fica mais longa. Antes ele caía para
           'inversa-escrita' e precisava reconquistar as três seguidas — o
           contador de dominados encolhia justamente quando se acertava. */
        /* Quem nunca errou — nem antes de dominar, nem nas revisões — sobe
           de dois em dois: 3 dias, 2 semanas, 3 meses, 6 meses. Um erro em
           qualquer momento da vida do card devolve o passo de um. */
        est.revisoes = Math.min(DIAS_DOMINADO.length - 1,
          (est.revisoes || 0) + (est.erros ? 1 : 2));
      } else if (r.modo === 'multipla') {
        if (inversa) est.etapa = 'inversa-escrita';
        else est.etapa = pareceChute(r) ? 'multipla' : 'escrita';
      } else if (est.seguidas >= acertosParaVirar(est, inversa)) {
        est.etapa = inversa ? 'dominado' : 'inversa-multipla';
        est.seguidas = 0;   // a direção nova começa do zero
        /* «revisoes» não zera aqui. Quem chega pela primeira vez já vem com
           zero, e quem está voltando de um tropeço tem de reencontrar o
           degrau de onde caiu — senão o recuo de um degrau viraria recuo
           até o chão no momento da reconquista. */
      } else {
        est.etapa = inversa ? 'inversa-escrita' : 'escrita';
      }
    } else {
      /* ── errar derruba um degrau, não a escada inteira ──
         O card maduro CONTINUA dominado: o que recua é só a espera, uma
         casa — um card de 90 dias volta em 30, não em 3. Ele segue sendo
         cobrado por escrito em espanhol, que é o que ele já provava saber.

         Duas versões atrás, um só deslize apagava meses de maturidade e
         punha o card maduro no mesmo lugar de um recém-aprendido. Depois
         ele passou a cair para «inversa-escrita», o que ainda o obrigava a
         reconquistar três acertos seguidos para voltar à escada. Agora não
         sai: quem já atravessou as duas direções não precisa provar de novo
         que atravessou — precisa só de mais um encontro, e mais cedo.

         Errando sempre, ele se estabiliza no degrau de baixo, três dias, e
         fica ali sendo escrito a cada três dias até voltar a acertar. É o
         laço mais apertado que a escada tem, e é onde um card esquecido
         deve mesmo ficar.

         Para quem nunca foi dominado nada muda: «revisoes» já era zero, e o
         decremento não o leva abaixo disso. */
      if (!jaDominado) est.etapa = inversa ? 'inversa-multipla' : 'multipla';
      est.revisoes = Math.max(0, (est.revisoes || 0) - 1);
    }

    /* Só o maduro espera por data; qualquer outro volta pela fila e mais nada. */
    est.voltaEm = est.etapa === 'dominado' ? proximaVolta(est.revisoes, est.ultima) : null;

    // a estreia é a única medida limpa do que já se sabia antes do app
    if (est.vistas === 1) est.primeiraCerta = !!r.acertou;

    if (r.conhecia) est.conhecia = r.conhecia;

    est.historico.push({
      em: est.ultima,
      modo: r.modo,
      acertou: r.acertou,
      quase: !!r.quase,
      ms: r.ms,
      velocidade: r.velocidade,
      conhecia: r.conhecia || null,
      resposta: r.resposta || null,
      pausado: !!r.pausado
    });
    if (est.historico.length > 12) est.historico = est.historico.slice(-12);

    return est;
  }

  /* ── as duas direções ──
     Todo card começa em espanhol→português: você lê o espanhol e diz o que
     é. Depois de dominado nessa direção, ele vira: aparece o português e
     você tem que produzir o espanhol, que é bem mais difícil. Cada direção
     repete o mesmo caminho — primeiro escolher entre cinco, depois escrever. */
  const FASES = {
    'multipla':         { direcao: 'es-pt', modo: 'multipla' },
    'escrita':          { direcao: 'es-pt', modo: 'escrita' },
    'consolidado':      { direcao: 'pt-es', modo: 'multipla' },  // valor antigo
    'inversa-multipla': { direcao: 'pt-es', modo: 'multipla' },
    'inversa-escrita':  { direcao: 'pt-es', modo: 'escrita' },
    'dominado':         { direcao: 'pt-es', modo: 'escrita' }
  };

  function faseDe(est) {
    return FASES[(est && est.etapa)] || FASES['multipla'];
  }

  function modoDe(est) { return faseDe(est).modo; }
  function direcaoDe(est) { return faseDe(est).direcao; }

  /* O que o card pergunta e o que ele espera, conforme a direção. */
  function pergunta(card, direcao) {
    return direcao === 'pt-es' ? card.pt : card.es;
  }
  function resposta(card, direcao) {
    return direcao === 'pt-es' ? card.es : card.pt;
  }
  /* ── montagem da fila inicial ──
     Intercala os níveis e alterna palavra/frase, para medir logo de cara
     onde está o seu teto. */
  function montarFila(cards) {
    const baldes = {};
    for (const n of NIVEIS) baldes[n] = { palavra: [], frase: [] };
    for (const c of cards) baldes[c.nivel][c.tipo].push(c.id);
    for (const n of NIVEIS) {
      embaralhar(baldes[n].palavra);
      embaralhar(baldes[n].frase);
    }

    const fila = [];
    let tipo = 'palavra';
    let restam = true;
    while (restam) {
      restam = false;
      for (const n of NIVEIS) {
        const b = baldes[n];
        const preferido = b[tipo].length ? tipo : (tipo === 'palavra' ? 'frase' : 'palavra');
        if (b[preferido].length) {
          fila.push(b[preferido].shift());
          tipo = preferido === 'palavra' ? 'frase' : 'palavra';
        }
        if (b.palavra.length || b.frase.length) restam = true;
      }
    }
    return fila;
  }

  function embaralhar(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ── qual nível puxar a seguir ──
     Nota de domínio por nível, de 0 a 1. A estreia do card pesa como
     evidência do que já se sabia: acerto conhecendo vale 1; acerto dizendo
     não conhecer vale 0,4, porque provavelmente foi dedução ou chute. As
     respostas seguintes valem 1 quando certas — elas não dizem o que já se
     sabia, mas dizem em que nível está custando fixar. Tudo é puxado para
     0,5 enquanto há pouca evidência, para um acerto solto não decidir nada. */
  function dominioPorNivel(cards, estados) {
    const g = {};
    for (const n of NIVEIS) g[n] = { pontos: 0, respostas: 0 };

    for (const c of cards) {
      const e = estados[c.id];
      if (!e || !e.vistas) continue;
      const x = g[c.nivel];

      if (e.primeiraCerta !== undefined) {
        x.respostas++;
        if (e.primeiraCerta) x.pontos += (e.conhecia === 'nao' ? 0.4 : 1);
      }
      const depois = Math.max(0, e.vistas - 1);
      const certasDepois = Math.max(0, e.acertos - (e.primeiraCerta ? 1 : 0));
      x.respostas += depois;
      x.pontos += Math.min(certasDepois, depois);
    }

    const K = 4, PRIOR = 0.5;
    const saida = {};
    for (const n of NIVEIS) {
      saida[n] = (g[n].pontos + K * PRIOR) / (g[n].respostas + K);
    }
    return saida;
  }

  /* Peso de cada nível na hora de sortear o próximo card inédito.
     A curva tem pico no domínio intermediário: o nível que você ainda não
     domina, mas no qual já se vira. Nível que você gabarita entedia; nível
     em que você erra quase tudo desanima. O piso garante que todos
     continuem aparecendo. */
  const ALVO = 0.62, LARGURA = 0.22, PISO = 0.15;
  function pesosDeNivel(dominio) {
    const p = {};
    for (const n of NIVEIS) {
      const d = dominio[n];
      p[n] = PISO + Math.exp(-Math.pow(d - ALVO, 2) / (2 * LARGURA * LARGURA));
    }
    return p;
  }

  /* Sorteia a ordem dos cards inéditos conforme o peso do nível,
     alternando palavra e frase quando dá. */
  function ordenarNovos(ids, pesos, porId) {
    const restantes = ids.slice();
    const ordem = [];
    let tipoAnterior = null;

    while (restantes.length) {
      let total = 0;
      const peso = restantes.map(id => {
        const c = porId[id];
        let w = pesos[c.nivel] || PISO;
        if (c.tipo === tipoAnterior) w *= 0.6;
        total += w;
        return w;
      });

      let sorteio = Math.random() * total;
      let i = 0;
      while (i < restantes.length - 1 && sorteio > peso[i]) { sorteio -= peso[i]; i++; }

      const escolhido = restantes.splice(i, 1)[0];
      ordem.push(escolhido);
      tipoAnterior = porId[escolhido].tipo;
    }
    return ordem;
  }

  /* Alternativas da múltipla escolha: a certa mais os 4 distratores. */
  function alternativas(card, direcao, todos) {
    if (direcao !== 'pt-es') return embaralhar([card.pt, ...card.distratores]);
    return embaralhar([card.es, ...distratoresEs(card, todos || [])]);
  }

  /* Na direção invertida o baralho não traz distratores prontos, então eles
     saem de outros cards. Não é sorteio cego: prefere os que têm chance de
     confundir de verdade — mesmo tema, mesmo nível, tamanho e começo
     parecidos —, que é o que faz a alternativa doer. */
  function distratoresEs(card, todos) {
    if (Array.isArray(card.distratoresEs) && card.distratoresEs.length >= 4) {
      return embaralhar(card.distratoresEs.slice()).slice(0, 4);
    }

    const tags = new Set(card.tags || []);
    const alvo = normalizarEs(card.es);

    const candidatos = todos
      .filter(c => c.id !== card.id && c.tipo === card.tipo && normalizarEs(c.es) !== alvo)
      .map(c => {
        let nota = Math.random();
        if (c.nivel === card.nivel) nota += 2;
        if ((c.tags || []).some(t => tags.has(t))) nota += 2.5;
        nota += 1.5 * Math.min(c.es.length, card.es.length) / Math.max(c.es.length, card.es.length);
        if (c.es[0].toLowerCase() === card.es[0].toLowerCase()) nota += 1;
        return { c, nota };
      })
      .sort((a, b) => b.nota - a.nota)
      .slice(0, 10);

    return embaralhar(candidatos).slice(0, 4).map(x => x.c.es);
  }

  return {
    NIVEIS, ROTULO_NIVEL, LIMIARES,
    normalizar, conferir, velocidade,
    estadoInicial, registrar, modoDe, direcaoDe, faseDe, pareceChute,
    pergunta, resposta, normalizarEs, normalizarEn, formaReconhecida,
    erroDeGenero, formasAceitas, LIMITES, cortar,
    linguaTrocada, espanhoisDoCard, erroDeEne, acentoRelevado, acentoFaltando,
    descontoDePassos, acertosParaVirar, ACERTOS_PARA_VIRAR,
    linguaDaPergunta, linguaDaResposta,
    distanciaNaFila, esperando, proximaVolta, DIAS_DOMINADO,
    tempoConfiavel, MS_ABANDONO,
    contarDirecoes,
    filaDe, pesosDasFilas, chancesDasFilas, sortearFila,
    urgencia, cumpriu, escolherNaFila, vezDoDominado, ESPACO_DOMINADO,
    ALVO_FILA,
    liberado, venceuEm,
    montarFila, alternativas, embaralhar,
    dominioPorNivel, pesosDeNivel, ordenarNovos,
    respostasAceitas
  };
})();
