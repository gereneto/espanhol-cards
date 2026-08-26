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

  /* ── normalização de texto para comparar respostas ── */
  function normalizar(txt) {
    return (txt || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // tira acentos
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')                       // tira pontuação
      .replace(/\b(o|a|os|as|um|uma|uns|umas)\b/g, ' ')   // artigos são opcionais
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* distância de Levenshtein, para tolerar erro de digitação */
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

  /* Confere a resposta escrita. Devolve 'certo' | 'quase' | 'errado'. */
  function conferir(card, texto) {
    const dado = normalizar(texto);
    if (!dado) return 'errado';
    const aceitas = respostasAceitas(card);
    if (aceitas.includes(dado)) return 'certo';

    for (const alvo of aceitas) {
      const limite = alvo.length <= 4 ? 0 : alvo.length <= 8 ? 1 : 2;
      if (limite && distancia(dado, alvo) <= limite) return 'quase';
    }
    // resposta contida na aceita (ou vice-versa), quando é frase longa
    for (const alvo of aceitas) {
      if (alvo.length >= 12 && (alvo.includes(dado) || dado.includes(alvo))) {
        const razao = Math.min(alvo.length, dado.length) / Math.max(alvo.length, dado.length);
        if (razao >= 0.7) return 'quase';
      }
    }
    return 'errado';
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

  /* Alternativas da múltipla escolha: a certa mais os 4 distratores. */
  function alternativas(card) {
    return embaralhar([card.pt, ...card.distratores]);
  }

  return {
    NIVEIS, LIMIARES,
    normalizar, conferir, velocidade,
    estadoInicial, registrar, modoDe, pareceChute,
    distanciaNaFila, montarFila, alternativas, embaralhar,
    respostasAceitas
  };
})();
