/* ────────────────────────────────────────────────────────────────
   motor.js — estado dos cards e gestão da fila.

   Não há repetição espaçada por datas: existe uma fila única.
   Ao responder, o card é reinserido mais adiante na fila.
   Quanto mais fácil foi a resposta, mais longe ele vai.
   ──────────────────────────────────────────────────────────────── */
window.Motor = (function () {

  /* Limiares de tempo (ms) para classificar a resposta em
     rápido / médio / lento. Variam por tipo de card e por modo. */
  const LIMIARES = {
    palavra: { multipla: [4000, 12000], escrita: [8000, 25000] },
    frase:   { multipla: [7000, 20000], escrita: [15000, 45000] }
  };

  /* Além do CEFR, duas trilhas próprias de conjugação verbal, que não cabem
     bem numa faixa de proficiência — irregular do A2 é irregular no C1. */
  const NIVEIS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'VR', 'VI'];

  const ROTULO_NIVEL = {
    A1: 'A1', A2: 'A2', B1: 'B1', B2: 'B2', C1: 'C1', C2: 'C2',
    VR: 'verbo regular', VI: 'verbo irregular'
  };

  /* ── normalização de texto para comparar respostas ──
     Aqui só entra o que é a MESMA resposta escrita de outro jeito: acento,
     plural, número por extenso, contração, artigo e pronome-sujeito, que o
     português dispensa. Nada que possa fazer uma resposta errada colar na
     certa — negação, preposição, verbo e substantivo ficam intactos.
     Sinônimo de verdade entra pela lista "aceitas" de cada card. */

  const NUMEROS = {
    '0': 'zero', '1': 'um', '2': 'dois', '3': 'tres', '4': 'quatro',
    '5': 'cinco', '6': 'seis', '7': 'sete', '8': 'oito', '9': 'nove',
    '10': 'dez', '11': 'onze', '12': 'doze', '13': 'treze', '14': 'quatorze',
    '15': 'quinze', '16': 'dezesseis', '17': 'dezessete', '18': 'dezoito',
    '19': 'dezenove', '20': 'vinte', '30': 'trinta', '50': 'cinquenta', '100': 'cem'
  };

  /* Contrações e grafias alternativas da mesma palavra. */
  const GRAFIAS = {
    pra: 'para', pro: 'para', to: 'estou', ta: 'esta', tao: 'estao',
    duas: 'dois', vc: 'voce', catorze: 'quatorze'
  };

  /* Palavras que o português põe ou tira sem mudar nada: artigos e
     pronomes-sujeito (as duas línguas dispensam o sujeito), mais o "já"
     aspectual. Nenhuma negação e nenhuma preposição entram aqui. */
  const OMISSIVEIS = new Set([
    'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas',
    'eu', 'ele', 'ela', 'eles', 'elas', 'voce', 'voces', 'tu', 'nos',
    'ja',
    /* o espanhol dispensa o sujeito tanto quanto o português: "no sabía"
       é tão correto quanto "yo no sabía". Quem carrega a pessoa é o verbo
       conjugado, que continua entrando inteiro na comparação. */
    'yo', 'el', 'ella', 'ellos', 'ellas',
    'nosotros', 'nosotras', 'vosotros', 'usted', 'ustedes'
  ]);

  function normalizar(txt) {
    const bruto = (txt || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // tira acentos
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ');                      // tira pontuação

    const saida = [];
    for (let p of bruto.split(/\s+/)) {
      if (!p) continue;
      if (OMISSIVEIS.has(p)) continue;                    // antes de mexer na palavra
      if (NUMEROS[p]) p = NUMEROS[p];                     // "3 anos" = "três anos"
      if (GRAFIAS[p]) p = GRAFIAS[p];
      p = p.replace(/^(\w{3,})s$/, '$1');                 // plural = singular
      if (OMISSIVEIS.has(p)) continue;                    // e de novo, para "eles" → "ele"
      saida.push(p);
    }
    return saida.join(' ');
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

  /* O espanhol dispensa o artigo do mesmo jeito que o português: quem
     responde "oficina" acertou tanto quanto quem responde "la oficina". */
  const ARTIGOS_ES = /^(el|la|los|las|un|una|unos|unas)\s+/i;
  function normalizarEs(txt) {
    return normalizar(String(txt || '').trim().replace(ARTIGOS_ES, ''));
  }

  /* Todas as formas aceitas como resposta certa, na direção pedida. */
  function respostasAceitas(card, direcao) {
    if (direcao === 'pt-es') {
      return [card.es, ...(card.aceitasEs || [])].map(normalizarEs).filter(Boolean);
    }
    const lista = [card.pt, ...card.pt.split('/'), ...(card.aceitas || [])];
    return lista.map(normalizar).filter(Boolean);
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
    const dado = direcao === 'pt-es' ? normalizarEs(texto) : normalizar(texto);
    if (!dado) return 'errado';

    const aceitas = respostasAceitas(card, direcao);
    if (aceitas.includes(dado)) return 'certo';

    /* Se o que ele escreveu é outra conjugação registrada do mesmo verbo,
       não foi a mão que escorregou: foi o tempo ou a pessoa que ele errou,
       que é justamente o que o card cobra. Erro seco, sem perguntar. */
    if (formaReconhecida(card, texto, direcao)) return 'errado';

    if (aceitas.some(alvo => parecido(dado, alvo, direcao))) return 'quase';
    return 'errado';
  }

  /* Quando a resposta coincide com outra forma verbal do card, devolve qual
     é, para o feedback poder dizer o que ele escreveu de fato. */
  function formaReconhecida(card, texto, direcao) {
    if (direcao !== 'pt-es' || !card.formasEs) return null;
    const dado = normalizarEs(texto);
    for (const forma of Object.keys(card.formasEs)) {
      if (normalizarEs(forma) === dado) return { forma, rotulo: card.formasEs[forma] };
    }
    return null;
  }

  /* Perto o bastante para perguntar — não perto o bastante para valer ponto.

     Escrevendo em espanhol a régua é mais dura: a grafia é parte do que se
     está aprendendo, então uma letra fora do lugar pode ser exatamente a
     lacuna, não um deslize de teclado. Em português, que ele já domina,
     errar uma tecla não diz nada sobre saber a palavra. */
  function parecido(a, b, direcao) {
    const maior = Math.max(a.length, b.length);
    if (maior < 4) return false;

    const d = distancia(a, b);
    if (!d) return true;
    const inversa = direcao === 'pt-es';

    if (!a.includes(' ') && !b.includes(' ')) {
      return inversa ? (d === 1 && maior >= 6) : d <= (maior >= 8 ? 2 : 1);
    }
    return 1 - d / maior >= (inversa ? 0.92 : 0.82);
  }

  function velocidade(card, modo, ms) {
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
      historico: []        // últimas 12 respostas
    };
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
    } else {
      if (r.velocidade === 'lento') base = 35;
      else if (r.velocidade === 'medio') base = 60;
      else base = 110;
      if (est.seguidas >= 3) base *= 2;   // já está dominado
    }

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
    if (r.acertou) {
      if (r.modo === 'multipla') {
        if (inversa) est.etapa = 'inversa-escrita';
        else est.etapa = pareceChute(r) ? 'multipla' : 'escrita';
      } else if (est.seguidas >= 3) {
        est.etapa = inversa ? 'dominado' : 'inversa-multipla';
        est.seguidas = 0;   // a direção nova começa do zero
      } else {
        est.etapa = inversa ? 'inversa-escrita' : 'escrita';
      }
    } else {
      est.etapa = inversa ? 'inversa-multipla' : 'multipla';
    }

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
    pergunta, resposta, normalizarEs, formaReconhecida,
    distanciaNaFila, montarFila, alternativas, embaralhar,
    dominioPorNivel, pesosDeNivel, ordenarNovos,
    respostasAceitas
  };
})();
