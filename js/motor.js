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
    duas: 'dois', vc: 'voce', catorze: 'quatorze'
  };

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
     na lista — só o da frente cai, no "pre" da língua. */
  const OMISSIVEIS_ES = new Set([
    ...OMISSIVEIS_PT,
    'yo', 'el', 'ella', 'ellos', 'ellas',
    'nosotros', 'nosotras', 'vosotros', 'usted', 'ustedes'
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

  /* Ajustes que precisam do texto ainda inteiro, antes de a pontuação virar
     espaço. É onde o inglês desfaz o apóstrofo: se ele virasse espaço,
     "I don't mind" seria "i don t mind" e nunca casaria com "i dont mind". */
  function preEn(s) {
    return s
      .replace(/['’´`]/g, '')                       // don't → dont
      .replace(/\bcan not\b/g, 'cannot')
      .replace(/\bone (hundred|thousand|million)\b/g, '$1');  // 100 = a hundred
  }

  const LINGUAS = {
    pt: {
      omissiveis: OMISSIVEIS_PT, numeros: NUMEROS_PT,
      grafias: GRAFIAS_PT, plural: pluralPt
    },
    es: {
      omissiveis: OMISSIVEIS_ES, numeros: NUMEROS_PT,
      grafias: GRAFIAS_PT, plural: pluralPt,
      pre: s => s.trim().replace(ARTIGOS_ES, '')
    },
    en: {
      omissiveis: OMISSIVEIS_EN, numeros: NUMEROS_EN,
      grafias: GRAFIAS_EN, plural: pluralEn, pre: preEn
    }
  };

  /* Português é o padrão: quem já chamava normalizar(txt) continua igual. */
  function normalizar(txt, lingua) {
    const L = LINGUAS[lingua] || LINGUAS.pt;

    let texto = (txt || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // tira acentos
      .toLowerCase();
    if (L.pre) texto = L.pre(texto);                      // contração, artigo da frente
    const bruto = texto.replace(/[^a-z0-9\s]/g, ' ');     // tira pontuação

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
    return saida.join(' ');
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
  function respostasAceitas(card, direcao) {
    const lingua = linguaDaResposta(direcao);
    const campo = CAMPOS[lingua];
    const certa = String(card[campo.certa] || '');
    const extras = card[campo.aceitas] || [];

    /* No espanhol a barra não separa duas respostas: o card traz uma forma
       só, e as variantes vêm por aceitasEs. */
    const lista = lingua === 'es'
      ? [certa, ...extras]
      : [certa, ...certa.split('/'), ...extras];

    return lista.map(t => normalizar(t, lingua)).filter(Boolean);
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

    const aceitas = respostasAceitas(card, direcao);
    if (aceitas.includes(dado)) return 'certo';

    /* Se o que ele escreveu é outra conjugação registrada do mesmo verbo,
       não foi a mão que escorregou: foi o tempo ou a pessoa que ele errou,
       que é justamente o que o card cobra. Erro seco, sem perguntar. */
    if (formaReconhecida(card, texto, direcao)) return 'errado';

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
      historico: []        // últimas 12 respostas
    };
  }

  /* O histórico guarda só as últimas 12 respostas — bom para mostrar o
     percurso recente, ruim para somar. Estes contadores não truncam, e é
     deles que o painel tira "escolher x escrever". */
  function contadoresPorModo() {
    return { multipla: { n: 0, certas: 0 }, escrita: { n: 0, certas: 0 } };
  }

  /* ── o intervalo do card maduro ──
     Dominado não quer dizer aposentado. Acertar três vezes seguidas com o
     card voltando de dois em dois dias não prova memória de longo prazo —
     prova que ele ainda estava fresco. Então o card continua no baralho para
     sempre, e o que cresce é a espera: 3 dias, 1 semana, 2, 1 mês, 3 meses,
     meio ano. Errar devolve ao começo da escada, e o card sai de dominado.

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
      base = (r.quase ? 10 : 7) * (1 + 0.5 * Math.min(est.errosSeguidos || 0, 4));
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

    /* O maduro vai para o fim da fila e espera a data dele. A distância aqui
       só evita que ele fique rondando a frente entre uma espera e outra. */
    if (est.etapa === 'dominado') base = Math.max(base, 400);

    if (r.acertou) {
      if (r.conhecia === 'sim') base *= 1.3;
      else if (r.conhecia === 'nao') base *= 0.75;
    }
    if (r.pausado) base *= 0.9;   // tempo não é confiável, seja conservador

    const ruido = 0.85 + Math.random() * 0.3;
    return Math.max(3, Math.round(base * ruido));
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
        est.revisoes = (est.revisoes || 0) + 1;
      } else if (r.modo === 'multipla') {
        if (inversa) est.etapa = 'inversa-escrita';
        else est.etapa = pareceChute(r) ? 'multipla' : 'escrita';
      } else if (est.seguidas >= 3) {
        est.etapa = inversa ? 'dominado' : 'inversa-multipla';
        est.seguidas = 0;   // a direção nova começa do zero
        if (inversa) est.revisoes = 0;   // acabou de amadurecer: escada do zero
      } else {
        est.etapa = inversa ? 'inversa-escrita' : 'escrita';
      }
    } else {
      est.etapa = inversa ? 'inversa-multipla' : 'multipla';
      est.revisoes = 0;
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
    linguaDaPergunta, linguaDaResposta,
    distanciaNaFila, esperando, proximaVolta, DIAS_DOMINADO,
    tempoConfiavel, MS_ABANDONO,
    montarFila, alternativas, embaralhar,
    dominioPorNivel, pesosDeNivel, ordenarNovos,
    respostasAceitas
  };
})();
