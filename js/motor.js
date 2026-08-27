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

  const NIVEIS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

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
    'ja'
  ]);

  function normalizar(txt) {
    const bruto = (txt || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // tira acentos
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ');                      // tira pontuação

    const saida = [];
    for (let p of bruto.split(/\s+/)) {
      if (!p) continue;
      if (NUMEROS[p]) p = NUMEROS[p];                     // "3 anos" = "três anos"
      if (GRAFIAS[p]) p = GRAFIAS[p];
      p = p.replace(/^(\w{3,})s$/, '$1');                 // plural = singular
      if (OMISSIVEIS.has(p)) continue;
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

  /* Todas as formas aceitas como resposta certa de um card. */
  function respostasAceitas(card) {
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
  function conferir(card, texto) {
    const dado = normalizar(texto);
    if (!dado) return 'errado';

    const aceitas = respostasAceitas(card);
    if (aceitas.includes(dado)) return 'certo';
    if (aceitas.some(alvo => parecido(dado, alvo))) return 'quase';
    return 'errado';
  }

  /* Perto o bastante para perguntar — não perto o bastante para valer ponto. */
  function parecido(a, b) {
    const maior = Math.max(a.length, b.length);
    if (maior < 4) return false;

    const d = distancia(a, b);
    if (!d) return true;

    // palavra única: tolera o deslize de teclado
    if (!a.includes(' ') && !b.includes(' ')) return d <= (maior >= 8 ? 2 : 1);

    // frase: exige que quase tudo coincida
    return 1 - d / maior >= 0.82;
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
      etapa: 'multipla',   // multipla → escrita → consolidado
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

    // avanço/recuo de etapa
    if (r.acertou) {
      if (r.modo === 'multipla') {
        est.etapa = pareceChute(r) ? 'multipla' : 'escrita';
      } else {
        est.etapa = est.seguidas >= 3 ? 'consolidado' : 'escrita';
      }
    } else {
      est.etapa = 'multipla';
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

  /* Modo de apresentação: primeira vez (ou depois de errar) é múltipla escolha;
     depois de acertar, tem que escrever. */
  function modoDe(est) {
    return (!est || est.etapa === 'multipla') ? 'multipla' : 'escrita';
  }

  /* ── montagem da fila inicial ──
     Intercala os níveis (A1, A2, B1, B2, C1, C2, A1, …) e alterna
     palavra/frase, para medir logo de cara onde está o seu teto. */
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
  function alternativas(card) {
    return embaralhar([card.pt, ...card.distratores]);
  }

  return {
    NIVEIS, LIMIARES,
    normalizar, conferir, velocidade,
    estadoInicial, registrar, modoDe, pareceChute,
    distanciaNaFila, montarFila, alternativas, embaralhar,
    dominioPorNivel, pesosDeNivel, ordenarNovos,
    respostasAceitas
  };
})();
