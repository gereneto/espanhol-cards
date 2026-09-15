/* ────────────────────────────────────────────────────────────────
   app.js — telas, fluxo de estudo e sincronização.
   ──────────────────────────────────────────────────────────────── */
(function () {

  const CHAVE_PROGRESSO = 'espanhol-cards:progresso';
  const SINCRONIZAR_A_CADA = 3;   // respostas
  const SINCRONIZAR_COMPLETO_A_CADA = 8;  // sincronizações
  const REDE_DE_SEGURANCA = 45000;        // ms parado com resposta pendente

  const CARDS = (window.CARDS_RAW && window.CARDS_RAW.cards) || [];
  const PORID = {};
  CARDS.forEach(c => { PORID[c.id] = c; });

  const $ = s => document.querySelector(s);
  const el = {};
  [
    'placar', 'btn-inicio', 'btn-cards', 'btn-painel', 'btn-config', 'resumo-inicio', 'btn-comecar',
    'tela-inicio', 'tela-card', 'tela-painel', 'tela-config', 'tela-cards',
    'busca-cards', 'filtro-tipo', 'filtro-nivel', 'filtro-tag', 'filtro-estado',
    'contagem-cards', 'lista-cards',
    'meta-tipo', 'meta-modo', 'aba-nivel', 'enunciado', 'termo',
    'bandeira-pergunta', 'bandeira-resposta', 'rotulo-resposta-txt', 'bandeira-feedback',
    'area-multipla', 'area-escrita', 'entrada', 'btn-responder', 'btn-nao-sei',
    'aviso-lingua', 'aviso-acento',
    'meta-origem',
    'area-feedback', 'veredito', 'conquista', 'resposta-certa', 'caixa-resposta', 'nota', 'medidas',
    'area-conhecia', 'area-julgamento', 'resposta-dada', 'texto-dado',
    'area-contestar', 'btn-contestar', 'aviso-contestado', 'btn-comentar-card',
    'comentario-fundo', 'comentario-alvo', 'comentario-texto', 'comentario-restam',
    'btn-comentario-enviar', 'btn-comentario-fechar',
    'btn-proximo', 'painel-conteudo',
    'cfg-repo', 'cfg-token', 'cfg-auto', 'btn-salvar-cfg', 'btn-enviar',
    'btn-baixar', 'estado-sync', 'btn-exportar', 'btn-importar',
    'arquivo-importar', 'btn-zerar', 'rodape-sync'
  ].forEach(id => { el[id] = document.getElementById(id); });

  /* ═══════════════ estado ═══════════════ */

  let progresso = carregarProgresso();
  let sessao = novaSessao();
  let cardAtual = null;
  let modoAtual = null;
  let direcaoAtual = 'es-pt';
  let alvoAtual = null;
  let inicioResposta = 0;
  let pausou = false;
  let respostaPendente = null;
  let ultimoRegistro = null;
  let estreiaPendente = false;
  let chanceUsada = false;   // o aviso de língua trocada só devolve a vez uma vez
  let respostasDesdeSync = 0;
  let sincronizando = false;
  let sincronizacoes = 0;
  let temporizadorSync = null;

  function progressoVazio() {
    return {
      versao: 1,
      atualizado_em: new Date().toISOString(),
      /* Quatro filas. As três primeiras disputam o próximo card por sorteio
         (ver Motor.pesosDasFilas); a dos dominados tem gatilho de calendário
         e fura a fila quando a data chega. */
      ineditos: Motor.montarFila(CARDS),       // nunca apareceu
      filaEsPt: [],                            // você reconhece o espanhol
      filaPtEs: [],                            // você produz o espanhol
      dominados: [],                           // vencido nas duas, esperando data
      serie: [],                               // [respostas, es→pt, pt→es, 6 degraus]
      cards: {},
      contestacoes: [],
      comentarios: [],
      totais: { respostas: 0, acertos: 0, sessoes: 0 }
    };
  }

  function carregarProgresso() {
    let p = null;
    try { p = JSON.parse(localStorage.getItem(CHAVE_PROGRESSO) || 'null'); } catch (e) { p = null; }
    if (!p || !p.cards) p = progressoVazio();
    return conciliarFila(p);
  }

  /* Mantém as quatro filas coerentes com o estado dos cards. Cada card
     respondido mora na fila da sua etapa, e é daqui que sai a arrumação
     quando a etapa muda por sincronização de outro aparelho — ou quando o
     progresso vem no formato antigo, de uma fila só. */
  function conciliarFila(p) {
    p.cards = p.cards || {};

    /* Card apagado do baralho deixa para trás o estado dele. Sem varrer, ele
       continuaria contando em "cards já vistos" e nas tabelas do painel, e
       viajaria para sempre no progresso.json. A guarda do CARDS.length evita
       o desastre de apagar tudo se o data/cards.js não tiver carregado. */
    if (CARDS.length) {
      Object.keys(p.cards).forEach(id => { if (!PORID[id]) delete p.cards[id]; });
    }

    /* Progresso gravado antes de «primeiraCerta» existir não sabe se a
       estreia foi certa, e a tabela por nível somava esses cards só de um
       lado da conta: nenhuma estreia, mas todos os acertos em «depois».
       Dava 110% no A1. O histórico ainda alcança a estreia quando guarda
       tantas respostas quantas o card teve — aí a resposta [0] é ela. */
    Object.keys(p.cards).forEach(id => {
      const e = p.cards[id];
      if (!e || e.primeiraCerta !== undefined || !e.vistas) return;
      const h = e.historico || [];
      if (h.length >= e.vistas && h[0]) e.primeiraCerta = !!h[0].acertou;
    });

    const visto = id => !!p.cards[id] && !!p.cards[id].vistas;
    /* A frase presa a uma palavra ainda não dominada não entra em fila
       nenhuma. Não guardo lista de presos: a condição se recalcula aqui a
       cada carregamento, então dominar a palavra num aparelho destrava a
       frase em todos, sem nada de novo trafegar no progresso.json. */
    const solto = id => Motor.liberado(PORID[id], p.cards);

    /* A ordem que já existia é a dica de quem vem primeiro. «p.fila» é o
       formato antigo, de fila única: quem vinha de lá se distribui pelas
       etapas sem perder o lugar relativo. */
    const ordem = []
      .concat(p.filaEsPt || [], p.filaPtEs || [], p.dominados || [], p.fila || []);
    const posicao = {};
    ordem.forEach((id, i) => { if (posicao[id] === undefined) posicao[id] = i; });
    const lugar = id => (posicao[id] === undefined ? 1e9 : posicao[id]);

    const filas = { esPt: [], ptEs: [], dominados: [] };
    CARDS.forEach(c => { if (visto(c.id)) filas[Motor.filaDe(p.cards[c.id])].push(c.id); });
    for (const k in filas) filas[k].sort((a, b) => lugar(a) - lugar(b));
    p.filaEsPt = filas.esPt;
    p.filaPtEs = filas.ptEs;
    p.dominados = filas.dominados;
    anotarEntradaNaFila(p);

    const antes = Array.isArray(p.ineditos) ? p.ineditos : [];
    const conhecidos = new Set(antes);
    p.ineditos = antes.filter(id => PORID[id] && !visto(id) && solto(id))
      .concat(CARDS.filter(c => !conhecidos.has(c.id) && !visto(c.id) && solto(c.id))
                   .map(c => c.id));

    delete p.fila;          // formato antigo, de fila única
    delete p.desdeInedito;  // a contagem regressiva deu lugar ao sorteio

    /* ── a série das etapas ──
       Ninguém anotava isso, e refazer o caminho pelo histórico dos cards dava
       só uma estimativa: o histórico guarda doze respostas por card, e as
       regras mudaram várias vezes no percurso. Mas o repositório de dados
       guarda o progresso.json inteiro a cada sincronização — 442 fotografias
       do baralho, com a etapa de cada card. Dali sai a série EXATA, e é ela
       que o data/historico.js traz pronta.

       Semeia uma vez, e daí em diante o app mesmo vai anotando ponto a ponto.
       A semente só entra se este progresso for mesmo a continuação daquele
       histórico: num navegador de outra pessoa, com dez respostas dadas, a
       curva de mil e quinhentas não é dela. */
    if (!Array.isArray(p.serie)) p.serie = [];
    /* A versão anterior anotava quatro números, com os dominados num bolo só,
       e bolo não se divide por degrau depois. Série nesse formato sai inteira,
       e a semente nova — que já vem dividida, e cobre até a última
       sincronização — entra no lugar. */
    if (p.serie.some(pt => !Array.isArray(pt) || pt.length !== 9)) p.serie = [];
    const semente = (window.HISTORICO_RAW && window.HISTORICO_RAW.serie) || [];
    if (!p.serie.length && semente.length) {
      const fim = semente[semente.length - 1][0];
      if ((p.totais && p.totais.respostas || 0) >= fim - 50) p.serie = semente.slice();
    }

    ordenarIneditos(p);
    return p;
  }

  /* ── a passagem da posição para a urgência ──
     Card que já estava na fila antes da urgência não sabe quando entrou nem
     que distância pediu. Sai das duas coisas que o progresso ainda tem:

       espera     quantos cards foram respondidos depois da última vez dele —
                  pelo «ultima» de cada um. Conta cards, não respostas, então
                  é um piso; mas separa bem o card de ontem do parado há dias.
       distância  a posição que ele ocupava, dividida pela chance da fila —
                  a mesma conta da regra antiga, ao contrário —, entre 7 e
                  100. O teto é baixo de propósito: lá no fundo da fila, a
                  posição já não dizia o que o card pediu, dizia quantos
                  empurrões ele levou.

     Os presos saem com espera grande e entram logo na roda; o card que tinha
     acabado de voltar para a posição três continua logo ali.

     Card que está em fila e perdeu o «naFila» por outro caminho (uma
     sincronização com aparelho de versão antiga) passa pela mesma conta. */
  function anotarEntradaNaFila(p) {
    const respostas = (p.totais && p.totais.respostas) || 0;
    const faltam = [['esPt', p.filaEsPt], ['ptEs', p.filaPtEs]]
      .some(([, f]) => f.some(id => !p.cards[id].naFila));
    if (!faltam) return;
    const quando = Object.keys(p.cards)
      .map(id => Date.parse(p.cards[id].ultima) || 0).sort((a, b) => a - b);
    const depoisDe = t => {                  // quantos têm «ultima» maior que t
      let lo = 0, hi = quando.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (quando[m] <= t) lo = m + 1; else hi = m; }
      return quando.length - lo;
    };
    const chances = Motor.chancesDasFilas(p.cards, {
      ineditos: (p.ineditos || []).length > 0,
      esPt: p.filaEsPt.length > 0, ptEs: p.filaPtEs.length > 0
    });
    [['esPt', p.filaEsPt], ['ptEs', p.filaPtEs]].forEach(([k, fila]) => {
      fila.forEach((id, i) => {
        const e = p.cards[id];
        if (e.naFila) return;
        const distancia = Math.max(7, Math.min(100, Math.round((i + 1) / (chances[k] || 1))));
        e.naFila = { desde: respostas - depoisDe(Date.parse(e.ultima) || 0), distancia: distancia };
      });
    });
  }

  /* O baralho de inéditos é ordenado pelo desempenho: sai primeiro o nível
     que você ainda não domina mas já consegue acompanhar. Como agora ele é
     uma lista à parte, basta reordená-la — não há posição alheia a respeitar. */
  function ordenarIneditos(p) {
    if (!p.ineditos || p.ineditos.length < 2) return;
    /* A frase que a palavra acabou de destravar fura a fila. Estar aqui já
       quer dizer que ela foi liberada — presa nenhuma chega a este ponto —,
       e a promessa é que ela seja o próximo card novo. Entre duas, primeiro
       a da palavra vencida mais recentemente. Isso vive na ordenação, e não
       só no momento de dominar, para sobreviver a recarregar e sincronizar.

       Mas só as frescas. Quando a leva 10 deu uma frase a cada palavra, 73
       delas nasceram destravadas de uma vez — as palavras já estavam
       dominadas —, e furando a fila todas juntas elas seriam os próximos 73
       cards novos, sem uma expressão, um verbo ou uma palavra no meio. Então
       furam a fila no máximo FRESCAS_NA_FRENTE, de palavra vista nas últimas
       24 horas; as outras entram intercaladas, uma a cada DOIS cards de
       outro tipo. O «vista» é o «ultima» da palavra, que a revisão do
       dominado também renova — por isso o teto, e não só a janela. */
    const presas = [], resto = [];
    p.ineditos.forEach(id => ((PORID[id] || {}).requer ? presas : resto).push(id));
    const quando = id => Motor.venceuEm(PORID[id], p.cards);
    presas.sort((a, b) => quando(b) - quando(a));

    const FRESCAS_NA_FRENTE = 2;
    const agora = Date.now();
    const frescas = presas.filter(id => agora - quando(id) < 864e5).slice(0, FRESCAS_NA_FRENTE);
    const antigas = presas.filter(id => frescas.indexOf(id) < 0);

    const pesos = Motor.pesosDeNivel(Motor.dominioPorNivel(CARDS, p.cards));
    p.ineditos = frescas.concat(intercalar(Motor.ordenarNovos(resto, pesos, PORID), antigas, 2));
  }

  /* «cada» cards de «muitos», depois um de «poucos», até acabarem os dois. */
  function intercalar(muitos, poucos, cada) {
    const saida = [];
    let i = 0, j = 0;
    while (i < muitos.length || j < poucos.length) {
      for (let k = 0; k < cada && i < muitos.length; k++) saida.push(muitos[i++]);
      if (j < poucos.length) saida.push(poucos[j++]);
    }
    return saida;
  }

  function salvarProgresso() {
    progresso.atualizado_em = new Date().toISOString();
    try {
      localStorage.setItem(CHAVE_PROGRESSO, JSON.stringify(progresso));
    } catch (e) {
      console.warn('não consegui salvar no localStorage', e);
    }
  }

  function novaSessao() {
    return {
      id: new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19),
      inicio: new Date().toISOString(),
      eventos: []
    };
  }

  function estadoDe(id) {
    return progresso.cards[id] || null;
  }

  /* ═══════════════ telas ═══════════════ */

  /* Qual botão do topo corresponde a cada tela. A de card não tem botão:
     ela é para onde o «começar» leva, não um destino do menu. */
  const BOTAO_DA_TELA = {
    'tela-inicio': 'btn-inicio', 'tela-cards': 'btn-cards',
    'tela-painel': 'btn-painel', 'tela-config': 'btn-config'
  };

  function mostrar(tela) {
    ['tela-inicio', 'tela-card', 'tela-painel', 'tela-config', 'tela-cards']
      .forEach(t => el[t].classList.toggle('oculto', t !== tela));
    const aceso = BOTAO_DA_TELA[tela];
    Object.values(BOTAO_DA_TELA).forEach(b => el[b].classList.toggle('aqui', b === aceso));
  }

  function atualizarPlacar() {
    const t = progresso.totais;
    const vistos = Object.keys(progresso.cards).length;
    const taxa = t.respostas ? Math.round(100 * t.acertos / t.respostas) : 0;
    el.placar.innerHTML =
      '<b>' + vistos + '</b>/' + CARDS.length + ' cards · ' +
      '<b>' + t.respostas + '</b> respostas · <b>' + taxa + '%</b> de acerto';

    const naSessao = sessao.eventos.length;
    const acertosSessao = sessao.eventos.filter(e => e.acertou).length;
    const novos = CARDS.length - vistos;
    el['resumo-inicio'].innerHTML = naSessao
      ? 'Nesta sessão: <b>' + naSessao + '</b> respostas, <b>' + acertosSessao + '</b> certas. ' +
        (novos ? novos + ' cards ainda não apareceram.' : 'Você já viu todos os cards pelo menos uma vez.')
      : CARDS.length + ' cards prontos — ' +
        CARDS.filter(c => c.tipo === 'palavra').length + ' palavras e ' +
        CARDS.filter(c => c.tipo === 'frase').length + ' frases, do A1 ao C2.';
  }

  /* ═══════════════ fluxo do card ═══════════════ */

  /* ── de qual fila vem o próximo card ──
     Primeiro os dominados: quem venceu a data fura a fila, e é só isso que
     eles obedecem. Depois o sorteio entre inéditos, es→pt e pt→es, com os
     pesos que perseguem ALVO_FILA cards em cada direção (ver motor.js).

     Se não sobrou nada em lugar nenhum, entra o dominado de data mais
     próxima: ficar sem card seria pior do que adiantar um. */
  /* Quantos cards vieram desde o último dominado. Começa alto: abrir o app
     não precisa esperar espaço nenhum. */
  let desdeDominado = 99;

  function tirarProximoId() {
    const id = escolherProximoId();
    const e = id && progresso.cards[id];
    desdeDominado = e && e.etapa === 'dominado' ? 0 : desdeDominado + 1;
    return id;
  }

  function escolherProximoId() {
    const agora = new Date().toISOString();
    const vencidos = progresso.dominados.filter(id =>
      progresso.cards[id] && !Motor.esperando(progresso.cards[id], agora)).length;
    const tem = {
      ineditos: progresso.ineditos.length > 0,
      esPt: progresso.filaEsPt.length > 0,
      ptEs: progresso.filaPtEs.length > 0
    };
    const temOutro = tem.ineditos || tem.esPt || tem.ptEs;
    /* Sem nada nas outras filas, o vencido vem sem esperar espaço. */
    if (vencidos && (!temOutro || Motor.vezDoDominado(vencidos, desdeDominado))) {
      return progresso.dominados.splice(dominadoMaisProximo(agora), 1)[0];
    }

    const escolhida = Motor.sortearFila(Motor.pesosDasFilas(progresso.cards, tem));
    if (escolhida === 'ineditos') { ordenarIneditos(progresso); return progresso.ineditos.shift(); }
    if (escolhida === 'esPt' || escolhida === 'ptEs') {
      const fila = escolhida === 'esPt' ? progresso.filaEsPt : progresso.filaPtEs;
      const i = Motor.escolherNaFila(fila, progresso.cards, progresso.totais.respostas);
      return fila.splice(i, 1)[0];
    }

    const proximo = dominadoMaisProximo(null);
    return proximo === null ? null : progresso.dominados.splice(proximo, 1)[0];
  }

  /* O índice do dominado que já venceu a data — ou, com «agora» nulo, o de
     data mais próxima, vencido ou não. */
  function dominadoMaisProximo(agora) {
    let melhor = -1;
    progresso.dominados.forEach((id, i) => {
      const e = progresso.cards[id];
      if (!e) return;
      if (agora && Motor.esperando(e, agora)) return;
      const atual = melhor >= 0 ? progresso.cards[progresso.dominados[melhor]] : null;
      if (!atual || String(e.voltaEm) < String(atual.voltaEm)) melhor = i;
    });
    return melhor >= 0 ? melhor : null;
  }

  /* Devolve o card para a fila da etapa em que ele ficou. Ele não ganha
     posição: anota quando entrou e a distância, em respostas, que pediu — e
     é pela urgência que sai (ver Motor.escolherNaFila). A ordem do array
     deixou de significar alguma coisa. O dominado não entra nessa conta —
     ele espera data. */
  function guardarNaFila(id, est, r) {
    const alvo = Motor.filaDe(est);
    if (alvo === 'dominados') {
      delete est.naFila;
      if (progresso.dominados.indexOf(id) < 0) progresso.dominados.push(id);
      return { fila: alvo, distancia: null };
    }
    const fila = alvo === 'esPt' ? progresso.filaEsPt : progresso.filaPtEs;
    const distancia = Motor.distanciaNaFila(est, r);
    est.naFila = { desde: progresso.totais.respostas, distancia: distancia };
    fila.push(id);
    return { fila: alvo, distancia: distancia };
  }

  /* Tira o card de onde quer que ele esteja — a resposta sobre conhecimento
     prévio chega depois do registro e pode mudar a distância. */
  function retirarDasFilas(id) {
    [progresso.filaEsPt, progresso.filaPtEs, progresso.dominados].forEach(f => {
      const i = f.indexOf(id);
      if (i >= 0) f.splice(i, 1);
    });
  }

  function proximoCard() {
    const id = tirarProximoId();
    if (!id) { irParaInicio(); return; }
    cardAtual = PORID[id];
    if (!cardAtual) return proximoCard();

    const est = estadoDe(id);
    const fase = Motor.faseDe(est);
    modoAtual = fase.modo;
    direcaoAtual = fase.direcao;
    alvoAtual = Motor.resposta(cardAtual, direcaoAtual);
    respostaPendente = null;
    ultimoRegistro = null;
    estreiaPendente = false;
    chanceUsada = false;
    pausou = false;

    el['meta-tipo'].textContent = cardAtual.tipo;
    el['meta-modo'].textContent = modoAtual === 'multipla' ? 'múltipla escolha' : 'escreva a resposta';

    /* A frase destravada diz de que palavra veio — ela está aqui porque
       você venceu aquela palavra, e ver as duas juntas é metade da lição. */
    const palavra = cardAtual.requer && PORID[cardAtual.requer];
    el['meta-origem'].textContent = palavra ? 'de ' + palavra.es : '';
    el['meta-origem'].classList.toggle('oculto', !palavra);
    /* O nível vive na aba do fichário e fica à mostra o tempo todo: saber que
       o card é A1 ou C2 não entrega resposta nenhuma, e ajuda a calibrar o
       esforço antes de ler. */
    el['aba-nivel'].textContent = Motor.ROTULO_NIVEL[cardAtual.nivel] || cardAtual.nivel;

    const inversa = direcaoAtual === 'pt-es';
    el.enunciado.textContent = inversa
      ? (cardAtual.tipo === 'palavra' ? 'Como se diz esta palavra em espanhol?' : 'Como se diz isto em espanhol?')
      : (cardAtual.tipo === 'palavra' ? 'O que significa esta palavra?' : 'O que quer dizer esta frase?');

    el['bandeira-pergunta'].textContent = inversa ? '🇧🇷' : '🇪🇸';
    el['bandeira-resposta'].textContent = inversa ? '🇪🇸' : '🇧🇷';
    el['bandeira-feedback'].textContent = inversa ? '🇪🇸' : '🇧🇷';
    /* na múltipla escolha a bandeira já diz tudo; o texto só ajuda quando
       é você quem tem que produzir a resposta */
    el['rotulo-resposta-txt'].textContent = modoAtual === 'multipla' ? ''
      : (inversa ? 'responda em espanhol' : 'responda em português');
    el.entrada.placeholder = inversa ? 'escreva em espanhol…' : 'escreva o significado…';

    el.termo.textContent = Motor.pergunta(cardAtual, direcaoAtual);
    el.termo.classList.toggle('frase', cardAtual.tipo === 'frase');

    el['aviso-lingua'].classList.add('oculto');
    el['aviso-acento'].classList.add('oculto');
    el['area-feedback'].classList.add('oculto');
    /* o chão criado para o botão subir era daquele card; some com ele */
    el['area-feedback'].style.paddingBottom = '';
    el.conquista.classList.add('oculto');
    el['area-conhecia'].classList.add('oculto');
    el['area-julgamento'].classList.add('oculto');
    el['resposta-dada'].classList.add('oculto');
    el['resposta-dada'].classList.remove('conjugacao');
    el['area-contestar'].classList.add('oculto');
    el['aviso-contestado'].classList.add('oculto');
    el['btn-contestar'].disabled = false;
    el['btn-proximo'].classList.remove('oculto');

    if (modoAtual === 'multipla') {
      montarAlternativas();
      el['area-multipla'].classList.remove('oculto');
      el['area-escrita'].classList.add('oculto');
    } else {
      el['area-multipla'].classList.add('oculto');
      el['area-escrita'].classList.remove('oculto');
      el.entrada.value = '';
      el.entrada.disabled = false;
      el['btn-responder'].disabled = false;
      el['btn-nao-sei'].disabled = false;
    }

    mostrar('tela-card');
    if (modoAtual === 'escrita') setTimeout(() => el.entrada.focus(), 40);

    inicioResposta = performance.now();
  }

  function montarAlternativas() {
    const opcoes = Motor.alternativas(cardAtual, direcaoAtual, CARDS);
    el['area-multipla'].innerHTML = '';
    opcoes.forEach((texto, i) => {
      const b = document.createElement('button');
      b.className = 'alternativa';
      b.innerHTML = '<span class="num">' + (i + 1) + '</span><span>' + escapar(texto) + '</span>';
      b.addEventListener('click', () => responderMultipla(texto, b));
      el['area-multipla'].appendChild(b);
    });
  }

  function escapar(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function tempoGasto() {
    return Math.max(0, Math.round(performance.now() - inicioResposta));
  }

  function responderMultipla(texto, botao) {
    if (respostaPendente) return;
    const ms = tempoGasto();
    const acertou = texto === alvoAtual;

    [...el['area-multipla'].children].forEach(b => {
      b.disabled = true;
      const rotulo = b.lastChild.textContent;
      if (rotulo === alvoAtual) b.classList.add('certa');
      else if (b === botao && !acertou) b.classList.add('errada');
    });

    concluir({ modo: 'multipla', direcao: direcaoAtual, acertou, quase: false, ms, resposta: texto });
  }

  function responderEscrita(desistiu) {
    if (respostaPendente) return;
    const ms = tempoGasto();
    /* o maxlength do campo cobre a digitação; o corte cobre o resto, e é o
       que garante que nada maior que o teto entre no progresso.json */
    const texto = desistiu ? '' : Motor.cortar(el.entrada.value, Motor.LIMITES.resposta);
    if (!desistiu && !texto.trim()) { el.entrada.focus(); return; }

    /* ── respondeu certo, na língua errada ──
       Falso amigo é assim: você lê «la sobremesa», reconhece a palavra
       portuguesa e responde o espanhol dela. Não é desconhecimento, é a
       palavra enganando — então o app avisa e devolve a vez, sem contar
       erro nem gravar nada. Uma vez por aparição do card: com duas viraria
       tentativa livre, e a medida do tempo perderia o sentido.

       O relógio segue correndo, de propósito. O tropeço não é erro, mas
       também não sai de graça: a resposta vai chegar mais lenta, e o card
       volta um pouco mais cedo por causa disso. */
    const conferencia = desistiu ? 'errado' : Motor.conferir(cardAtual, texto, direcaoAtual);
    if (conferencia === 'errado' && !desistiu && !chanceUsada) {
      const troca = Motor.linguaTrocada(cardAtual, texto, direcaoAtual);
      if (troca) { avisarLinguaTrocada(troca); return; }
      /* e o espelho, na volta: a pergunta portuguesa lida como espanhol */
      const leitura = Motor.leituraEspanhola(cardAtual, texto, direcaoAtual, indiceEspanhol());
      if (leitura) { avisarLeituraEspanhola(leitura); return; }
    }
    el['aviso-lingua'].classList.add('oculto');
    el.entrada.disabled = true;
    el['btn-responder'].disabled = true;
    el['btn-nao-sei'].disabled = true;

    concluir({
      modo: 'escrita',
      direcao: direcaoAtual,
      acertou: conferencia === 'certo',
      quase: conferencia === 'quase',
      ms, resposta: texto, desistiu: !!desistiu
    });
  }

  /* O índice do espanhol do baralho, montado na primeira vez que alguém
     precisa dele (ver Motor.leituraEspanhola). */
  let INDICE_ES = null;
  function indiceEspanhol() {
    if (!INDICE_ES) INDICE_ES = Motor.indiceEspanhol(CARDS);
    return INDICE_ES;
  }

  function avisarLeituraEspanhola(l) {
    chanceUsada = true;
    el['aviso-lingua'].innerHTML =
      '<b>' + escapar(l.resposta) + '</b> é a tradução de <b>' + escapar(l.espanhol) +
      '</b>, em espanhol 🇪🇸. Mas aqui <b>' + escapar(l.pergunta) + '</b> está em ' +
      'português 🇧🇷, e o que se pede é o espanhol dela — tente de novo.';
    el['aviso-lingua'].classList.remove('oculto');
    el.entrada.value = '';
    el.entrada.focus();
  }

  function avisarLinguaTrocada(troca) {
    chanceUsada = true;
    el['aviso-lingua'].innerHTML = troca.propria
      ? '<b>' + escapar(troca.palavra) + '</b> é a própria palavra da pergunta, ' +
        'em espanhol 🇪🇸. O que se pede é a tradução, em português 🇧🇷 — tente de novo.'
      : '<b>' + escapar(troca.palavra) + '</b> está em espanhol 🇪🇸: é a resposta da ' +
        'pergunta ao contrário. Aqui a tradução vai em português 🇧🇷 — tente de novo.';
    el['aviso-lingua'].classList.remove('oculto');
    el.entrada.value = '';
    el.entrada.focus();
  }

  /* Mostra o feedback. Grava na hora, salvo quando a resposta caiu na
     tolerância — aí quem decide é você, e só então grava. */
  function concluir(r) {
    /* "pausado" quer dizer tempo não confiável, e há duas maneiras de
       chegar lá: sair da aba, ou demorar tanto que é evidente que o card
       ficou sozinho na tela. Nos dois casos o número não mede nada. */
    r.pausado = pausou || r.ms >= Motor.MS_ABANDONO;
    r.velocidade = Motor.velocidade(cardAtual, r.modo, r.ms, r.pausado);
    respostaPendente = r;
    estreiaPendente = !estadoDe(cardAtual.id) || estadoDe(cardAtual.id).vistas === 0;

    el['resposta-certa'].textContent = alvoAtual;
    /* Neutra por padrão: quem pinta de verde é o veredito, e no caso do
       "deu quase" ele só chega depois que você julgar. */
    el['caixa-resposta'].classList.remove('certa');
    el.nota.textContent = cardAtual.nota || '';
    el.nota.classList.toggle('oculto', !cardAtual.nota);

    const rotuloVel = { rapido: 'rápido', medio: 'no tempo médio', lento: 'devagar' }[r.velocidade];
    el.medidas.innerHTML =
      '<span class="medida"><b>' + (r.ms / 1000).toFixed(1) + 's</b> — ' + rotuloVel + '</span>' +
      /* o nível já está na aba do fichário; repeti-lo aqui só ocupa lugar */
      (cardAtual.tags || []).map(t => '<span class="medida">' + escapar(t) + '</span>').join('') +
      (r.pausado
        ? '<span class="medida">tempo não contado (' +
          (pausou ? 'você saiu da aba' : 'demorou demais, o card ficou parado') + ')</span>'
        : '');

    el['area-conhecia'].classList.add('oculto');
    [...document.querySelectorAll('.opcao-conhecia')].forEach(b => {
      b.style.borderColor = '';
      b.style.color = '';
    });

    /* Escreveu outra conjugação: mostra qual foi, para o erro ensinar algo. */
    const escrevendo = r.modo === 'escrita' && !r.desistiu;
    const forma = escrevendo
      ? Motor.formaReconhecida(cardAtual, r.resposta, r.direcao) : null;
    /* Só o artigo saiu errado. Dizer isso ensina mais do que "não foi dessa
       vez": o que faltou tem nome, e é o gênero. */
    const genero = escrevendo && !forma
      ? Motor.erroDeGenero(cardAtual, r.resposta, r.direcao) : null;
    /* E o «ñ», que é letra e não «n» com enfeite. */
    const acento = escrevendo && !forma && !genero
      ? Motor.erroDeEne(cardAtual, r.resposta, r.direcao) : null;
    /* A terminação de outra pessoa ou outro tempo: «suele» por «suelo». */
    const flexao = escrevendo && !forma && !genero && !acento
      ? Motor.erroDeFlexao(cardAtual, r.resposta, r.direcao) : null;

    /* Acertou, mas sem o acento. Não custa ponto — custa uma linha, que diz
       só a palavra, e a letra pintada na resposta certa, logo abaixo. */
    const soAcento = escrevendo && r.acertou
      ? Motor.acentoFaltando(cardAtual, r.resposta, r.direcao) : null;
    el['aviso-acento'].classList.toggle('oculto', !soAcento);
    if (soAcento) {
      el['aviso-acento'].innerHTML = 'atenção ao acento: <b>' +
        soAcento.palavras.map(escapar).join(', ') + '</b>';
      el['resposta-certa'].innerHTML = soAcento.pedacos.map(p => p.destaque
        ? '<mark class="acento">' + escapar(p.texto) + '</mark>'
        : escapar(p.texto)).join('');
    }

    if (forma || genero || acento || flexao) {
      el['texto-dado'].innerHTML = forma
        ? escapar(forma.forma) + ' <span class="forma-rotulo">' + escapar(forma.rotulo) + '</span>'
        : genero
        ? escapar(r.resposta) +
          ' <span class="forma-rotulo">gênero errado — era «' + escapar(genero) + '»</span>'
        : acento
        ? escapar(r.resposta) +
          ' <span class="forma-rotulo">preste atenção ao ñ</span>'
        : escapar(r.resposta) +
          ' <span class="forma-rotulo">forma errada — era «' + escapar(flexao) + '»</span>';
      el['resposta-dada'].classList.remove('oculto');
      el['resposta-dada'].classList.add('conjugacao');
    } else {
      el['resposta-dada'].classList.remove('conjugacao');
    }

    if (r.quase) {
      // chegou perto: mostra o que você escreveu e devolve a decisão
      el.veredito.className = 'veredito quase';
      el.veredito.textContent = 'Deu quase';
      el['texto-dado'].textContent = r.resposta;
      el['resposta-dada'].classList.remove('oculto');
      el['area-julgamento'].classList.remove('oculto');
      el['btn-proximo'].classList.add('oculto');
    } else {
      if (!forma && !genero && !acento && !flexao) el['resposta-dada'].classList.add('oculto');
      el['area-julgamento'].classList.add('oculto');
      el['btn-proximo'].classList.remove('oculto');
      mostrarVeredito(r);
      registrar(r);
      mostrarPerguntaConhecia(r);
      mostrarContestar(r);
    }

    el['area-feedback'].classList.remove('oculto');
    el['btn-proximo'].focus({ preventScroll: true });
    trazerBotaoParaAVista();
  }

  /* Depois de responder, o feedback empurra o botão de seguir adiante para
     baixo da dobra, e era preciso rolar à mão a cada card. Puxa a tela o
     bastante para ele aparecer — e nada além disso, para o espanhol não sair
     de vista. Quando a resposta ficou por julgar, o alvo são os dois botões
     de julgamento, que é o que espera decisão naquele momento.

     O scrollIntoView não deu conta, e por dois motivos que só aparecem no
     aparelho de verdade:

     — no celular o teclado cobre metade da tela sem encolher o innerHeight,
       então ele conclui que o botão está à vista e não faz nada. Quem sabe
       o que está coberto é o visualViewport, e é contra ele que a conta é
       feita aqui;
     — a rolagem suave é cancelada por qualquer toque na tela, e logo depois
       de escolher a alternativa o dedo ainda está lá.

     Daí as três passadas. Cada uma recalcula quanto falta a partir da
     posição atual, então repetir não faz passar do ponto: rolar e o botão
     subir se cancelam. A do fim é instantânea, porque rolagem suave
     cancelada no meio do caminho não se recupera sozinha. */
  const FOLGA_BOTAO = 24;

  /* Quanto ainda falta rolar para o alvo caber na parte de fato visível. */
  function faltaRolar(alvo) {
    const r = alvo.getBoundingClientRect();
    if (!r.height) return 0;
    const vv = window.visualViewport;
    const topo = vv ? vv.offsetTop : 0;
    const altura = vv ? vv.height : window.innerHeight;
    return Math.max(0, (r.bottom + FOLGA_BOTAO) - (topo + altura));
  }

  function trazerBotaoParaAVista() {
    const alvo = el['btn-proximo'].classList.contains('oculto')
      ? el['area-julgamento'] : el['btn-proximo'];
    if (!alvo) return;
    const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const rolar = comportamento => {
      /* O chão é refeito do zero a cada passada, e esse zero é o conserto.
         Antes ele só crescia: a primeira passada acontece com o teclado
         aberto, onde falta muito para o botão aparecer, e criava um chão do
         tamanho do teclado. Quando o teclado fechava, a passada seguinte via
         que não faltava mais nada e voltava sem desfazer o chão — a página
         ficava alta demais, e a tela parava bem mais para baixo do que
         precisava. Zerar antes de medir deixa o navegador reencaixar a
         rolagem, e o que se acrescenta depois é só o que falta agora. */
      el['area-feedback'].style.paddingBottom = '';
      const falta = faltaRolar(alvo);
      if (!falta) return;
      /* Rolar sozinho não resolve: o botão é o último elemento da página, e
         quando falta subir mais do que ainda há para rolar — teclado
         aberto, tela baixa —, a página termina antes de ele chegar. Sem
         isto a rolagem acontecia e o botão continuava embaixo do teclado.
         Então primeiro se cria chão debaixo dele, e só então se rola. */
      const podeRolar = document.documentElement.scrollHeight
        - Math.round(window.scrollY) - window.innerHeight;
      if (falta > podeRolar) {
        el['area-feedback'].style.paddingBottom = (falta - podeRolar) + 'px';
      }
      window.scrollBy({ top: falta, behavior: comportamento });
    };

    rolar(suave ? 'smooth' : 'auto');
    setTimeout(() => rolar(suave ? 'smooth' : 'auto'), 300);  // o teclado fechou
    setTimeout(() => rolar('auto'), 700);                     // e se a suave morreu
  }

  function mostrarVeredito(r) {
    el.veredito.className = 'veredito ' + (r.acertou ? 'ok' : 'erro');
    /* Acertou: a caixa da resposta fica verde. Desistir não é acerto. */
    el['caixa-resposta'].classList.toggle('certa', r.acertou && !r.desistiu);
    el.veredito.textContent = r.desistiu ? 'Sem problema — fica para a próxima'
      : r.julgadoPorVoce ? (r.acertou ? 'Certo — você contou como acerto' : 'Contado como erro')
      : r.acertou ? 'Certo!'
      : 'Não foi dessa vez';
  }

  /* Perguntar "já conhecia?" só faz sentido quando você acerta de primeira:
     errando, a resposta é óbvia; se o card já apareceu antes, você o conhece
     do próprio app e não do seu repertório.

     A frase presa a uma palavra cai no mesmo caso, mesmo estreando: ela só
     apareceu porque você venceu aquela palavra aqui dentro, e a palavra é o
     que a frase tem de novo. A resposta seria sobre o app, não sobre o que
     você trouxe de fora — e é isso que a pergunta existe para medir. */
  function mostrarPerguntaConhecia(r) {
    const cabe = estreiaPendente && r.acertou && !cardAtual.requer;
    el['area-conhecia'].classList.toggle('oculto', !cabe);
  }

  /* Você decide se o quase-certo valeu. Só depois disso a resposta é gravada. */
  function julgar(valor) {
    if (!respostaPendente || ultimoRegistro) return;
    const r = respostaPendente;
    r.acertou = valor === 'certo';
    r.julgadoPorVoce = true;

    el['area-julgamento'].classList.add('oculto');
    el['btn-proximo'].classList.remove('oculto');
    mostrarVeredito(r);
    registrar(r);
    mostrarPerguntaConhecia(r);
    mostrarContestar(r);
    el['btn-proximo'].focus({ preventScroll: true });
    trazerBotaoParaAVista();
  }
  /* Dominou a palavra: as frases que a usam entram na hora, na frente do
     baralho de inéditos. O ordenarIneditos faria isso no próximo
     carregamento, mas a graça está em vir agora, na sequência da conquista.
     Guardo quem já venceu antes: se a frase voltar a ficar presa por causa
     de um erro futuro, ela sai daqui pelo conciliarFila, não por engano. */
  function destravarFrases(idPalavra) {
    const emCirculacao = id => progresso.filaEsPt.indexOf(id) >= 0 ||
                               progresso.filaPtEs.indexOf(id) >= 0 ||
                               progresso.dominados.indexOf(id) >= 0;
    const novas = CARDS
      .filter(c => c.requer === idPalavra && !progresso.cards[c.id] &&
                   !progresso.ineditos.includes(c.id) && !emCirculacao(c.id))
      .map(c => c.id);
    if (novas.length) progresso.ineditos.unshift(...novas);
    return novas.length;
  }

  /* Vencer as duas direções é a única conquista do app que não se vê na
     hora: o card apenas some da fila por semanas. Uma etiqueta basta para
     o terceiro acerto seguido em espanhol ter o tamanho que tem. */
  function mostrarConquista(virou, diasDeVolta) {
    /* O dominado acertado de novo não muda de etapa, e o que ele ganhou só
       se via no painel: uma espera mais longa. Dizer quanto é o que dá peso
       à revisão certa. */
    const texto = virou ? 'Card dominado!'
      : diasDeVolta ? 'volta em ' + rotuloEspera(diasDeVolta) : '';
    el.conquista.textContent = texto;
    el.conquista.classList.toggle('oculto', !texto);
  }

  /* Grava a resposta e devolve o card para a fila. */
  function registrar(r) {
    const id = cardAtual.id;
    const est = progresso.cards[id] || (progresso.cards[id] = Motor.estadoInicial(id));
    const etapaAntes = est.etapa;
    Motor.registrar(est, r);
    const virouDominado = est.etapa === 'dominado' && etapaAntes !== 'dominado';
    if (virouDominado) destravarFrases(id);
    mostrarConquista(virouDominado,
      etapaAntes === 'dominado' && r.acertou ? Motor.DIAS_DOMINADO[est.revisoes] : null);

    const guardado = guardarNaFila(id, est, r);

    progresso.totais.respostas++;
    if (r.acertou) progresso.totais.acertos++;

    /* Um ponto por resposta, para o gráfico do painel: as duas direções e os
       dominados divididos pelos seis degraus. Nove números; mil respostas
       somam uns 25 KB no progresso.json, que já tem 500. */
    const d = Motor.contarDirecoes(progresso.cards);
    const degraus = [0, 0, 0, 0, 0, 0];
    progresso.dominados.forEach(id => {
      const e = progresso.cards[id];
      if (e) degraus[Math.min(e.revisoes || 0, 5)]++;
    });
    progresso.serie.push([progresso.totais.respostas, d.esPt, d.ptEs].concat(degraus));

    const evento = {
      em: new Date().toISOString(),
      card: id,
      es: cardAtual.es,
      tipo: cardAtual.tipo,
      nivel: cardAtual.nivel,
      tags: cardAtual.tags,
      modo: r.modo,
      direcao: r.direcao,
      acertou: r.acertou,
      quase: !!r.quase,
      desistiu: !!r.desistiu,
      ms: r.ms,
      velocidade: r.velocidade,
      conhecia: null,
      resposta: r.resposta || null,
      pausado: !!r.pausado,
      julgado_por_voce: !!r.julgadoPorVoce,
      etapa_depois: est.etapa,
      fila: guardado.fila,
      distancia_fila: guardado.distancia
    };
    sessao.eventos.push(evento);

    ultimoRegistro = { id, est, evento, r };

    reordenarNovos();
    salvarProgresso();
    atualizarPlacar();
    talvezSincronizar();
  }

  /* A resposta sobre conhecimento prévio chega depois do registro, então
     revisa o que ela muda: a etapa (acerto lento no que não se conhecia é
     provável chute) e a distância até o card voltar. */
  function aplicarConhecia(valor) {
    if (!ultimoRegistro) return;
    const { id, est, evento, r } = ultimoRegistro;

    r.conhecia = valor;
    est.conhecia = valor;
    evento.conhecia = valor;
    if (est.historico.length) est.historico[est.historico.length - 1].conhecia = valor;

    if (Motor.pareceChute(r)) est.etapa = 'multipla';
    evento.etapa_depois = est.etapa;

    retirarDasFilas(id);
    const guardado = guardarNaFila(id, est, r);
    evento.fila = guardado.fila;
    evento.distancia_fila = guardado.distancia;

    salvarProgresso();
  }

  /* Reordena só a parte inédita da fila, mantendo as mesmas posições — o
     ritmo de entrada de cards novos continua igual, muda apenas de que
     nível é o próximo, conforme o seu desempenho. */
  function reordenarNovos() {
    ordenarIneditos(progresso);
  }

  /* Escreveu, foi contado como erro, mas acha que a resposta valia. O card
     pode estar incompleto, não ele — e quem sabe disso é quem respondeu.
     Fica registrado para revisarmos card a card na próxima atualização. */
  function mostrarContestar(r) {
    const cabe = r.modo === 'escrita' && !r.acertou && !r.desistiu
      && String(r.resposta || '').trim();
    el['area-contestar'].classList.toggle('oculto', !cabe);
  }

  function contestar() {
    if (!ultimoRegistro) return;
    const { id, evento, r } = ultimoRegistro;

    progresso.contestacoes = progresso.contestacoes || [];
    const repetida = progresso.contestacoes.some(c =>
      c.card === id && Motor.normalizar(c.resposta) === Motor.normalizar(r.resposta));

    if (!repetida) {
      progresso.contestacoes.push({
        em: new Date().toISOString(),
        card: id,
        es: cardAtual.es,
        pt: cardAtual.pt,
        nivel: cardAtual.nivel,
        direcao: r.direcao,
        esperado: Motor.resposta(cardAtual, r.direcao),
        resposta: r.resposta
      });
      salvarProgresso();
    }
    evento.contestado = true;

    el['btn-contestar'].disabled = true;
    el['aviso-contestado'].classList.remove('oculto');
    if (GH.cfg().auto && GH.configurado()) sincronizar({ silencioso: true });
  }

  /* ── comentário livre sobre um card ──
     A contestação só cabe quando você escreveu e foi contado como erro. Mas
     o reparo mais útil costuma vir de outro lugar: distrator que também
     serve, nota que confunde, frase que ninguém diz. Isso vale para
     qualquer card, tendo acertado ou não, e vem do card ou da lista. */
  let comentandoId = null;

  function abrirComentario(id) {
    const c = PORID[id]; if (!c) return;
    comentandoId = id;
    el['comentario-alvo'].textContent = c.es + ' → ' + c.pt;
    el['comentario-texto'].value = '';
    contarComentario();
    el['comentario-fundo'].classList.remove('oculto');
    el['comentario-texto'].focus();
  }

  function fecharComentario() {
    comentandoId = null;
    el['comentario-fundo'].classList.add('oculto');
  }

  function contarComentario() {
    const limite = Motor.LIMITES.comentario;
    const ta = el['comentario-texto'];
    /* O maxlength segura a digitação, mas não o que entra por script nem
       toda colagem de teclado virtual — e aí o contador ia a número
       negativo. Cortar aqui faz o campo nunca passar do teto. */
    if (ta.value.length > limite) ta.value = Motor.cortar(ta.value, limite);
    const restam = limite - ta.value.length;
    el['comentario-restam'].textContent = restam;
    el['comentario-restam'].parentElement.classList.toggle('no-fim', restam <= 40);
  }

  function enviarComentario() {
    if (!comentandoId) return;
    const texto = Motor.cortar(el['comentario-texto'].value, Motor.LIMITES.comentario).trim();
    if (!texto) { fecharComentario(); return; }

    const c = PORID[comentandoId];
    progresso.comentarios = progresso.comentarios || [];
    progresso.comentarios.push({
      em: new Date().toISOString(),
      card: comentandoId, es: c.es, pt: c.pt, nivel: c.nivel,
      texto: texto
    });
    salvarProgresso();
    fecharComentario();
    statusSync('Comentário anotado.', 'ok');
    if (GH.cfg().auto && GH.configurado()) sincronizar({ silencioso: true, completo: true });
  }

  function talvezSincronizar() {
    if (!(GH.cfg().auto && GH.configurado())) return;
    agendarRedeDeSeguranca();
    if (++respostasDesdeSync >= SINCRONIZAR_A_CADA) {
      respostasDesdeSync = 0;
      sincronizar({ silencioso: true, completo: (++sincronizacoes % SINCRONIZAR_COMPLETO_A_CADA) === 0 });
    }
  }

  /* Se você parar no meio — três respostas dadas, a quarta nunca vem — o
     contador sozinho nunca dispararia. O relógio dispara. */
  function agendarRedeDeSeguranca() {
    clearTimeout(temporizadorSync);
    temporizadorSync = setTimeout(() => {
      if (respostasDesdeSync && GH.cfg().auto && GH.configurado()) {
        respostasDesdeSync = 0;
        sincronizar({ silencioso: true, completo: true });
      }
    }, REDE_DE_SEGURANCA);
  }

  function marcaDeSalvo() {
    return 'Salvo às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function avancar() {
    // com o julgamento pendente, avançar deixaria a resposta sem registro
    if (respostaPendente && !ultimoRegistro) return;
    proximoCard();
  }

  /* ═══════════════ painel ═══════════════ */

  function abrirPainel() {
    const ids = Object.keys(progresso.cards);
    const t = progresso.totais;
    const taxa = t.respostas ? Math.round(100 * t.acertos / t.respostas) : 0;

    /* Estreias: a primeira vez de cada card é a única medida limpa do que
       você já sabia antes de o app te mostrar a resposta. */
    const estreados = ids.filter(id => progresso.cards[id].primeiraCerta !== undefined);
    const dePrimeira = estreados.filter(id => progresso.cards[id].primeiraCerta);

    const etapaDe = id => progresso.cards[id].etapa;
    const dominados = ids.filter(id => etapaDe(id) === 'dominado').length;
    const dir = Motor.contarDirecoes(progresso.cards);
    const presos = CARDS.filter(c => !progresso.cards[c.id] &&
                                     !Motor.liberado(c, progresso.cards)).length;
    /* A chance de o próximo card ser inédito. Não é mais uma contagem
       regressiva: o sorteio pesa as três filas a cada card, e o que dá para
       prometer é a probabilidade, não a data. */
    const temIneditos = (progresso.ineditos || []).length > 0;
    const chances = Motor.chancesDasFilas(progresso.cards, {
      ineditos: temIneditos,
      esPt: progresso.filaEsPt.length > 0,
      ptEs: progresso.filaPtEs.length > 0
    });

    /* Você disse que não conhecia, e hoje já acerta: é o que o app ensinou,
       separado do que você já trazia de casa. */
    const aprendidos = ids.filter(id => {
      const e = progresso.cards[id];
      return e.conhecia === 'nao' && e.acertos > 0 && e.etapa !== 'multipla';
    }).length;

    let html = '<div class="grade">' +
      metrica(ids.length + '/' + CARDS.length, 'cards já vistos') +
      metrica(pctDe(dePrimeira.length, estreados.length), 'acertou de primeira') +
      metrica(taxa + '%', 'acerto geral (' + t.respostas + ' respostas)') +
      metrica(aprendidos, 'não conhecia e hoje acerta') +
      /* é o equilíbrio que a admissão de inéditos persegue — vê-lo explica
         por que o card novo às vezes vem depressa e às vezes espera */
      /* É o alvo que a escolha de fila persegue — vê-lo explica por que o
         card novo às vezes vem depressa e às vezes rareia. */
      metrica(dir.esPt + ' · ' + dir.ptEs,
              'es → pt e pt → es (alvo ' + Motor.ALVO_FILA + ' · ' + Motor.ALVO_FILA + ')') +
      metrica(dominados, 'dominados nas duas direções') +
      metrica(!temIneditos ? '—' : Math.round(100 * chances.ineditos) + '%',
              !temIneditos
                ? (presos ? 'frases esperando você dominar a palavra'
                          : 'todos os cards já apareceram')
                : 'chance de o próximo ser card novo') +
      '</div>';

    /* Por nível vem primeiro: é a tabela que responde «como estou indo», e
       as outras respondem «onde os cards estão». */
    html += tabelaNivel();
    html += graficoEtapas();
    html += tabelaEtapas();
    html += tabelaDominados();
    html += tabelaModo();
    html += tabelaPor('Por categoria', categoriaDe, CATEGORIAS.map(c => c[0]));

    el['painel-conteudo'].innerHTML = html;
    ligarGrafico();
    mostrar('tela-painel');
  }

  function pctDe(parte, total) {
    return total ? Math.round(100 * parte / total) + '%' : '—';
  }

  function metrica(valor, rotulo) {
    return '<div class="metrica"><div class="valor">' + valor +
      '</div><div class="rotulo">' + rotulo + '</div></div>';
  }

  /* Em que pé estão os cards de cada nível. É a foto do baralho: quantos
     ainda não saíram, quantos estão no meio do caminho e quantos já
     venceram as duas direções. */
  const ETAPAS = [
    { chave: 'preso',    rotulo: 'Presos'    },
    { chave: 'novo',     rotulo: 'Inéditos'  },
    { chave: 'espt',     rotulo: 'es → pt'   },
    { chave: 'ptes',     rotulo: 'pt → es'   },
    { chave: 'dominado', rotulo: 'Dominados' }
  ];

  function tabelaEtapas() {
    const g = {};
    Motor.NIVEIS.forEach(n => {
      g[n] = { total: 0 };
      ETAPAS.forEach(e => (g[n][e.chave] = 0));
    });

    CARDS.forEach(c => {
      const x = g[c.nivel]; if (!x) return;
      x.total++;
      const e = progresso.cards[c.id];
      /* Preso não é inédito: é frase que existe e não pode sair enquanto a
         palavra dela não estiver dominada. Somá-los prometeria card novo
         que o baralho não tem como entregar. */
      if (!e || !e.vistas) {
        if (Motor.liberado(c, progresso.cards)) x.novo++; else x.preso++;
        return;
      }
      if (e.etapa === 'dominado') { x.dominado++; return; }
      /* Escolher entre cinco e escrever são passos da mesma travessia; o que
         separa de verdade é para que lado se traduz. */
      if (Motor.direcaoDe(e) === 'pt-es') { x.ptes++; return; }
      x.espt++;
    });

    const niveis = Motor.NIVEIS.filter(n => g[n].total);
    if (!niveis.length) return '';

    const soma = ch => niveis.reduce((a, n) => a + g[n][ch], 0);
    const celula = v => '<td class="num">' + (v || '·') + '</td>';

    const linhas = niveis.map(n =>
      '<tr><td>' + n + '</td>' +
      ETAPAS.map(e => celula(g[n][e.chave])).join('') +
      '<td class="num">' + g[n].total + '</td></tr>'
    ).join('');

    /* Os rótulos vão de pé: são seis colunas de números, e escritos na
       horizontal eles é que faziam a tabela estourar a largura da tela. */
    const cabeca = r => '<th class="vert"><span>' + r + '</span></th>';

    return '<h3>Em que pé está cada nível</h3>' +
      '<p class="legenda">Todo card vai de <b>es → pt</b> a <b>pt → es</b> e daí a ' +
      '<b>dominado</b>. O sorteio das filas persegue <b>' + Motor.ALVO_FILA +
      ' cards em cada direção</b>. <b>Presos</b> são frases que esperam você ' +
      'dominar a palavra delas.</p>' +
      '<table class="etapas"><tr><th>Nível</th>' +
      ETAPAS.map(e => cabeca(e.rotulo)).join('') +
      cabeca('Total') + '</tr>' + linhas +
      '<tr class="soma"><td>Todos</td>' +
      ETAPAS.map(e => celula(soma(e.chave))).join('') +
      '<td class="num">' + soma('total') + '</td></tr></table>';
  }

  /* Por nível, separando a estreia das respostas seguintes: a estreia diz
     o que você já trazia, o resto diz o quanto está fixando.

     Os números saem dos contadores do card (vistas, acertos, primeiraCerta),
     e não do histórico: o histórico guarda só as últimas 12 respostas, então
     em card muito praticado o historico[0] já não é a estreia — e era isso
     que fazia a coluna "de primeira" mentir justamente onde havia mais dado. */
  /* ── o caminho até aqui ──
     Quantos cards em cada etapa, a cada resposta. A série é anotada pelo app
     a cada resposta e vem semeada com o histórico exato do repositório de
     dados (ver conciliarFila) — não é reconstrução nem estimativa: cada ponto
     é uma contagem que existiu.

     Os pontos semeados são um por sincronização, a cada três respostas; os
     anotados daqui em diante são um por resposta. A curva fica mais rala
     atrás e mais fina à frente, o que não incomoda numa figura de 600px. */

  /* Oito bandas, de baixo para cima: as duas direções em cores próprias, e
     os dominados subindo a escada numa rampa de verde, do escuro (3 dias,
     colado ao pt→es de onde o card acabou de sair) ao claro (6 meses, no
     topo). Rampa e não oito cores: os degraus são uma ordem, e a ordem se lê
     pelo tom; oito cores soltas pediriam legenda para cada uma. */
  const SERIES = [
    { chave: 0, nome: 'es → pt',   cor: 'var(--serie-espt)' },
    { chave: 1, nome: 'pt → es',   cor: 'var(--serie-ptes)' },
    { chave: 2, nome: '3 dias',    cor: 'var(--degrau-0)', degrau: true },
    { chave: 3, nome: '1 semana',  cor: 'var(--degrau-1)', degrau: true },
    { chave: 4, nome: '2 semanas', cor: 'var(--degrau-2)', degrau: true },
    { chave: 5, nome: '1 mês',     cor: 'var(--degrau-3)', degrau: true },
    { chave: 6, nome: '3 meses',   cor: 'var(--degrau-4)', degrau: true },
    { chave: 7, nome: '6 meses',   cor: 'var(--degrau-5)', degrau: true }
  ];

  function graficoEtapas() {
    const bruta = (progresso.serie || []).filter(p => Array.isArray(p) && p.length === 9);
    if (bruta.length < 20) return '';           // curva de nada não se desenha
    /* [respostas, esPt, ptEs, d0..d5] → o desenho precisa das oito contagens,
       e a resposta vira o rótulo do eixo. */
    const serie = bruta.map(p => p.slice(1));
    const eixoX = bruta.map(p => p[0]);
    const soma = p => p.reduce((a, b) => a + b, 0);

    /* Alto o dobro do que era: no celular a figura ficava espremida e as
       três bandas se confundiam perto do fim, onde elas mais importam. */
    const L = 34, R = 634, T = 10, B = 330, ALT = 352;
    const n = serie.length;
    const topo = Math.max(...serie.map(soma));
    const passo = topo > 400 ? 100 : topo > 200 ? 50 : 25;
    const ymax = Math.ceil(topo / passo) * passo || passo;
    /* O eixo anda em RESPOSTAS, e não em índice de ponto. Os pontos semeados
       são um por sincronização e as sincronizações não foram parelhas: espaçar
       por índice esticaria os dias de muita sincronização e comprimiria os
       outros, contando uma história torta. */
    const xIni = eixoX[0], xFim = eixoX[n - 1];
    const vao = Math.max(1, xFim - xIni);
    const x = i => L + ((eixoX[i] - xIni) / vao) * (R - L);
    const y = v => B - (v / ymax) * (B - T);

    /* Amostra: mil e quinhentos pontos num SVG de 600px de largura são quatro
       por pixel, e o arquivo fica enorme sem que nada disso apareça. */
    const passoAmostra = Math.max(1, Math.ceil(n / 300));
    const idx = [];
    for (let i = 0; i < n; i += passoAmostra) idx.push(i);
    if (idx[idx.length - 1] !== n - 1) idx.push(n - 1);

    let svg = '';
    for (let v = 0; v <= ymax; v += passo) {
      svg += '<line x1="' + L + '" y1="' + y(v).toFixed(1) + '" x2="' + R +
        '" y2="' + y(v).toFixed(1) + '" class="malha"/>' +
        '<text x="' + (L - 6) + '" y="' + (y(v) + 3.5).toFixed(1) + '" class="eixo" text-anchor="end">' + v + '</text>';
    }

    /* Bandas empilhadas, de baixo para cima, com dois pixels de fundo entre
       elas — é a separação que faz duas cores vizinhas se lerem. */
    let base = new Array(n).fill(0);
    SERIES.forEach(s => {
      const topoBanda = base.map((b, i) => b + serie[i][s.chave]);
      const cima = idx.map(i => x(i).toFixed(1) + ' ' + y(topoBanda[i]).toFixed(1));
      const baixo = idx.slice().reverse().map(i => x(i).toFixed(1) + ' ' + y(base[i]).toFixed(1));
      svg += '<path d="M' + cima.concat(baixo).join('L') + 'Z" fill="' + s.cor + '"/>';
      base = topoBanda;
    });
    /* A fresta só separa os três grupos — es→pt, pt→es, dominado — e não os
       degraus entre si. Um card vale menos de um pixel nesta escala, e uma
       fresta de dois apagaria o degrau fino por inteiro; entre degraus quem
       separa é o tom da rampa, que foi escolhida para isso. */
    let sep = new Array(n).fill(0);
    for (let k = 0; k < 2; k++) {
      sep = sep.map((b, i) => b + serie[i][SERIES[k].chave]);
      svg += '<path d="M' + idx.map(i => x(i).toFixed(1) + ' ' + y(sep[i]).toFixed(1)).join('L') +
        '" fill="none" class="fresta"/>';
    }

    /* Rótulos em números redondos de resposta, e não no valor do ponto que
       calhou de cair ali. */
    const passoX = vao > 2000 ? 500 : vao > 800 ? 250 : vao > 300 ? 100 : 50;
    for (let v = Math.ceil(xIni / passoX) * passoX; v <= xFim; v += passoX) {
      const px = L + ((v - xIni) / vao) * (R - L);
      svg += '<text x="' + px.toFixed(1) + '" y="' + (B + 15) + '" class="eixo" ' +
        'text-anchor="middle">' + v + '</text>';
    }
    svg += '<line id="g-cursor" y1="' + T + '" y2="' + B + '" class="cursor" style="display:none"/>';
    svg += '<rect x="' + L + '" y="' + T + '" width="' + (R - L) + '" height="' + (B - T) +
      '" fill="transparent" id="g-toque"/>';

    const ult = serie[n - 1];
    const chaves = SERIES.filter(s => !s.degrau).map(s =>
      '<span class="chave"><i style="background:' + s.cor + '"></i>' + s.nome +
      ' <b data-serie="' + s.chave + '">' + ult[s.chave] + '</b></span>').join('') +
      '<span class="chave"><i style="background:var(--degrau-3)"></i>dominado' +
      ' <b id="g-dom">' + ult.slice(2).reduce((a, b) => a + b, 0) + '</b></span>';
    const escada = '<div class="escada-legenda">' + SERIES.filter(s => s.degrau).map(s =>
      '<span><i style="background:' + s.cor + '"></i>' + s.nome +
      ' <b data-serie="' + s.chave + '">' + ult[s.chave] + '</b></span>').join('') + '</div>';

    return '<h3>O caminho até aqui</h3>' +
      '<p class="legenda">Cards em cada etapa ao longo das suas <b>' +
      eixoX[n - 1] + '</b> respostas. Toque para ler um ponto.</p>' +
      '<div class="chaves" id="g-chaves">' + chaves + '</div>' + escada +
      '<svg class="grafico-etapas" viewBox="0 0 640 ' + ALT + '" role="img" ' +
      'aria-label="Cards em cada etapa ao longo das respostas">' + svg + '</svg>' +
      '<script type="application/json" id="g-dados">' +
      JSON.stringify(idx.map(i => [i].concat(serie[i], [eixoX[i]]))) +
      '</' + 'script>';
  }

  /* O gráfico é remontado a cada abertura do painel, então o ouvinte se
     amarra depois de o HTML entrar.

     Só o toque parado escolhe um ponto. O dedo que arrasta está rolando a
     página, e o pointerdown disparava antes de dar para saber — cada rolagem
     que começava em cima do gráfico mudava o ponto lido. Agora vale o click,
     que o celular já não dispara depois de uma rolagem, e para o mouse, que
     dispara, a conta da distância entre apertar e soltar resolve. */
  function ligarGrafico() {
    const svg = el['painel-conteudo'].querySelector('.grafico-etapas');
    const dados = el['painel-conteudo'].querySelector('#g-dados');
    if (!svg || !dados) return;
    const pontos = JSON.parse(dados.textContent);
    const cursor = svg.querySelector('#g-cursor');
    const valores = [...el['painel-conteudo'].querySelectorAll('[data-serie]')];
    const totalDom = el['painel-conteudo'].querySelector('#g-dom');

    const toque = svg.querySelector('#g-toque');
    let inicio = null;
    toque.addEventListener('pointerdown', ev => { inicio = [ev.clientX, ev.clientY]; });
    toque.addEventListener('click', ev => {
      if (inicio && Math.hypot(ev.clientX - inicio[0], ev.clientY - inicio[1]) > 8) return;
      const r = svg.getBoundingClientRect();
      const alvo = (ev.clientX - r.left) / r.width * 640;
      /* Mesma escala do desenho: o eixo anda em respostas, que é o último
         número de cada ponto. */
      const R_ = p => p[p.length - 1];
      const ini = R_(pontos[0]), fim = R_(pontos[pontos.length - 1]);
      const largo = Math.max(1, fim - ini);
      const emX = p => 34 + ((R_(p) - ini) / largo) * 600;
      let melhor = 0;
      pontos.forEach((p, k) => {
        if (Math.abs(emX(p) - alvo) < Math.abs(emX(pontos[melhor]) - alvo)) melhor = k;
      });
      const p = pontos[melhor];
      const px = emX(p);
      cursor.setAttribute('x1', px);
      cursor.setAttribute('x2', px);
      cursor.style.display = '';
      valores.forEach(b => { b.textContent = p[1 + Number(b.dataset.serie)]; });
      if (totalDom) totalDom.textContent = p.slice(3, 9).reduce((a, b) => a + b, 0);
    });
  }

  /* ── a escada dos dominados ──
     O dominado não volta pela fila: volta por data, e a espera cresce a cada
     revisão certa — 3 dias, 1 semana, 2, 1 mês, 3 meses, meio ano. Esta
     tabela diz onde cada um está parado: quantos em cada degrau, quantos já
     venceram a data e estão esperando a vez de furar a fila, e quando o
     próximo dos que ainda esperam vai aparecer.

     Errar recua um degrau e não tira ninguém daqui: um card de 90 dias passa
     a voltar em 30, e continua dominado. */
  function rotuloEspera(dias) {
    if (dias === 7) return '1 semana';
    if (dias === 30) return '1 mês';
    if (dias < 7) return dias + ' dias';
    if (dias < 30 && dias % 7 === 0) return (dias / 7) + ' semanas';
    if (dias % 30 === 0) return (dias / 30) + ' meses';
    return dias + ' dias';
  }

  /* Perto da hora, dias não dizem nada: «amanhã» pode ser daqui a uma hora ou
     a vinte e três. Abaixo de dois dias a conta vira hora, e abaixo de cem
     minutos vira minuto. */
  function quandoVolta(iso) {
    const min = Math.round((Date.parse(iso) - Date.now()) / 60000);
    if (min <= 0) return 'agora';
    if (min < 100) return min + ' min';
    const horas = Math.round(min / 60);
    if (horas < 48) return horas + ' h';
    const dias = Math.round(horas / 24);
    if (dias < 60) return dias + ' dias';
    return Math.round(dias / 30) + ' meses';
  }

  function tabelaDominados() {
    const agora = new Date().toISOString();
    const degraus = Motor.DIAS_DOMINADO.map(dias => (
      { dias: dias, n: 0, vencidos: 0, proxima: null }));
    (progresso.dominados || []).forEach(id => {
      const e = progresso.cards[id];
      if (!e) return;
      const d = degraus[Math.min(e.revisoes || 0, degraus.length - 1)];
      d.n++;
      if (!Motor.esperando(e, agora)) d.vencidos++;
      else if (!d.proxima || e.voltaEm < d.proxima) d.proxima = e.voltaEm;
    });

    const total = degraus.reduce((s, d) => s + d.n, 0);
    if (!total) return '';

    const linhas = degraus.map(d => {
      /* Degrau vazio fica na tabela, esmaecido: a escada é a mesma para todo
         mundo, e ver o degrau vago diz que ninguém chegou lá ainda. */
      const vazio = d.n ? '' : ' class="vago"';
      /* Havendo um vencido no degrau, o próximo é ele, e volta agora — a data
         do seguinte, ainda de molho, não diz nada. */
      const quando = d.vencidos ? 'agora' : d.proxima ? quandoVolta(d.proxima) : '—';
      return '<tr' + vazio + '><td>' + rotuloEspera(d.dias) + '</td>' +
        '<td class="num">' + (d.n || '—') + '</td>' +
        '<td class="num">' + quando + '</td></tr>';
    }).join('');

    return '<h3>A escada dos dominados</h3>' +
      '<p class="legenda">O dominado volta por data. Cada revisão certa sobe um ' +
      'degrau; <b>errar desce um</b>, e não tira o card daqui.</p>' +
      '<table><tr><th>Espera</th><th class="num">Cards</th>' +
      '<th class="num">O próximo volta em</th></tr>' + linhas +
      '<tr class="soma"><td>Todos</td><td class="num">' + total + '</td>' +
      '<td class="num">—</td></tr></table>';
  }

  function tabelaNivel() {
    const g = {};
    Motor.NIVEIS.forEach(n => (g[n] =
      { vistos: 0, estreias: 0, certasEstreia: 0, depois: 0, certasDepois: 0,
        semEstreia: 0, respostas: 0, certas: 0 }));

    Object.keys(progresso.cards).forEach(id => {
      const c = PORID[id]; if (!c) return;
      const e = progresso.cards[id];
      const x = g[c.nivel];
      if (!e.vistas) return;
      x.vistos++;
      /* O geral entra por fora das outras duas colunas, e inclui os cards sem
         estreia anotada: é a conta de todas as respostas daquele nível. */
      x.respostas += e.vistas;
      x.certas += e.acertos;
      /* Sem saber se a estreia foi certa não dá para separá-la do resto:
         contar as respostas em «depois» e nenhuma em «de primeira» punha
         o acerto da estreia num denominador que não o comportava, e a
         coluna passava de 100%. Card assim fica fora das duas colunas —
         só as duas descrevendo o mesmo conjunto é que fecham. */
      if (e.primeiraCerta === undefined) { x.semEstreia++; return; }
      x.estreias++;
      if (e.primeiraCerta) x.certasEstreia++;
      /* tudo o que veio depois da estreia */
      x.depois += Math.max(0, e.vistas - 1);
      x.certasDepois += Math.max(0, e.acertos - (e.primeiraCerta ? 1 : 0));
    });

    const linhas = Motor.NIVEIS.filter(n => g[n].vistos).map(n => {
      const x = g[n];
      const geral = x.respostas ? Math.round(100 * x.certas / x.respostas) : 0;
      return '<tr><td>' + n + '</td>' +
        '<td class="num">' + x.vistos + '</td>' +
        '<td class="num">' + pctDe(x.certasEstreia, x.estreias) + '</td>' +
        '<td class="num">' + pctDe(x.certasDepois, x.depois) + '</td>' +
        '<td class="num">' + (x.respostas ? geral + '%' : '—') + '</td>' +
        '<td class="col-barra"><div class="barra"><i style="width:' + geral + '%"></i></div></td></tr>';
    }).join('');

    if (!linhas) return '';
    const semEstreia = Motor.NIVEIS.reduce((a, n) => a + g[n].semEstreia, 0);
    return '<h3>Por nível</h3><p class="legenda">“De primeira” é o que você já sabia; ' +
      '“depois”, o que fixou repetindo. A barra é o acerto geral do nível.' +
      (semEstreia ? ' <b>' + semEstreia + '</b> sem estreia anotada.' : '') +
      '</p>' +
      '<table class="nivel"><tr><th>Nível</th>' +
      ['Cards', 'De primeira', 'Depois', 'Geral'].map(r =>
        '<th class="vert"><span>' + r + '</span></th>').join('') +
      '<th></th></tr>' + linhas + '</table>';
  }

  /* Escolher entre cinco é bem mais fácil que escrever do zero. */
  function tabelaModo() {
    const g = { multipla: { n: 0, certas: 0 }, escrita: { n: 0, certas: 0 } };
    Object.keys(progresso.cards).forEach(id => {
      const pm = progresso.cards[id].porModo || {};
      Object.keys(g).forEach(k => {
        if (!pm[k]) return;
        g[k].n += pm[k].n;
        g[k].certas += pm[k].certas;
      });
    });
    const rotulos = { multipla: 'escolhendo entre 5', escrita: 'escrevendo' };
    const linhas = Object.keys(g).filter(k => g[k].n).map(k => {
      const x = g[k];
      return '<tr><td>' + rotulos[k] + '</td><td class="num">' + x.n + '</td>' +
        '<td class="num">' + pctDe(x.certas, x.n) + '</td></tr>';
    }).join('');
    if (!linhas) return '';
    return '<h3>Escolher x escrever</h3><table><tr><th>Modo</th><th class="num">Respostas</th>' +
      '<th class="num">Acerto</th></tr>' + linhas + '</table>';
  }

  /* ── as cinco famílias do baralho ──
     «Palavra ou frase» dizia da forma do card, não do que ele ensina. Estas
     cinco dizem: são as coisas que um brasileiro tropeça em espanhol, e cada
     card cai na primeira que casar — a ordem é a da especificidade, do mais
     armadilha ao mais geral. */
  const CATEGORIAS = [
    ['Falsos amigos',        c => (c.tags || []).includes('falso-amigo')],
    ['Expressões e gírias',  c => (c.tags || []).some(t =>
                                    t === 'expressão' || t === 'gíria' || t === 'provérbio')],
    ['Conjugação',           c => (c.tags || []).includes('conjugação')],
    ['Frases do dia a dia',  c => c.tipo === 'frase'],
    ['Vocabulário',          () => true]
  ];

  function categoriaDe(c) {
    for (const [nome, casa] of CATEGORIAS) if (casa(c)) return nome;
    return 'Vocabulário';
  }

  function tabelaPor(titulo, chave, ordem) {
    const grupos = {};
    Object.keys(progresso.cards).forEach(id => {
      const c = PORID[id]; if (!c) return;
      const k = chave(c);
      const g = grupos[k] || (grupos[k] = { certas: 0, total: 0, cards: 0 });
      const e = progresso.cards[id];
      if (!e.vistas) return;
      g.cards++;
      /* contadores do card, e não o histórico: este guarda só as últimas 12 */
      g.total += e.vistas;
      g.certas += e.acertos;
    });

    const linhas = (ordem || Object.keys(grupos)).filter(k => grupos[k]).map(k => {
      const g = grupos[k];
      const pct = g.total ? Math.round(100 * g.certas / g.total) : 0;
      return '<tr><td>' + escapar(k) + '</td>' +
        '<td class="num">' + g.cards + '</td>' +
        '<td class="num">' + pct + '%</td>' +
        '<td class="col-barra"><div class="barra"><i style="width:' + pct + '%"></i></div></td></tr>';
    }).join('');

    if (!linhas) return '';
    return '<h3>' + titulo + '</h3><table><tr><th>—</th><th class="num">Cards</th>' +
      '<th class="num">Acerto</th><th></th></tr>' + linhas + '</table>';
  }

  /* ═══════════════ todos os cards ═══════════════ */

  /* Situação de cada card, do jeito que interessa a quem está olhando a
     lista: não pelo nome interno da etapa, mas pelo que falta fazer. */
  function situacaoDe(id) {
    const e = progresso.cards[id];
    if (!e || !e.vistas) {
      /* «Ainda não apareceu» sugere que é questão de tempo. A frase presa
         não é: ela depende de você vencer a palavra, e dizer qual é. */
      const c = PORID[id];
      if (!Motor.liberado(c, progresso.cards)) {
        return { chave: 'preso', rotulo: 'espera você dominar «' + PORID[c.requer].es + '»' };
      }
      return { chave: 'novo', rotulo: 'ainda não apareceu' };
    }
    if (e.etapa === 'dominado') return { chave: 'dominado', rotulo: 'dominado nas duas direções' };
    if (Motor.direcaoDe(e) === 'pt-es') return { chave: 'invertido', rotulo: 'na volta: você produz o espanhol' };
    return {
      chave: 'andamento',
      rotulo: Motor.modoDe(e) === 'escrita' ? 'escrevendo em português' : 'múltipla escolha'
    };
  }

  function montarFiltros() {
    const niveis = Motor.NIVEIS.filter(n => CARDS.some(c => c.nivel === n));
    niveis.forEach(n => {
      el['filtro-nivel'].insertAdjacentHTML('beforeend',
        '<option value="' + n + '">' + n + '</option>');
    });

    const conta = {};
    CARDS.forEach(c => (c.tags || []).forEach(t => { conta[t] = (conta[t] || 0) + 1; }));
    Object.keys(conta).sort((a, b) => conta[b] - conta[a] || a.localeCompare(b, 'pt'))
      .forEach(t => {
        el['filtro-tag'].insertAdjacentHTML('beforeend',
          '<option value="' + escapar(t) + '">' + escapar(t) + ' (' + conta[t] + ')</option>');
      });
  }

  function abrirCards() {
    renderizarCards();
    mostrar('tela-cards');
  }

  function renderizarCards() {
    const busca = Motor.normalizar(el['busca-cards'].value);
    const tipo = el['filtro-tipo'].value;
    const nivel = el['filtro-nivel'].value;
    const tag = el['filtro-tag'].value;
    const estado = el['filtro-estado'].value;

    const visiveis = CARDS.filter(c => {
      if (tipo && c.tipo !== tipo) return false;
      if (nivel && c.nivel !== nivel) return false;
      if (tag && !(c.tags || []).includes(tag)) return false;

      if (estado) {
        const e = progresso.cards[c.id];
        if (estado === 'errei') { if (!e || !e.erros) return false; }
        else if (situacaoDe(c.id).chave !== estado) return false;
      }

      if (busca) {
        const alvo = Motor.normalizar(
          [c.es, c.pt, c.nota, (c.aceitas || []).join(' '), (c.tags || []).join(' ')].join(' '));
        if (!busca.split(' ').every(termo => alvo.includes(termo))) return false;
      }
      return true;
    });

    el['contagem-cards'].innerHTML = visiveis.length === CARDS.length
      ? 'Mostrando todos os <b>' + CARDS.length + '</b> cards.'
      : 'Mostrando <b>' + visiveis.length + '</b> de ' + CARDS.length + ' cards.';

    if (!visiveis.length) {
      el['lista-cards'].innerHTML = '<p class="vazio">Nenhum card com esses filtros.</p>';
      return;
    }

    el['lista-cards'].innerHTML = visiveis.map(c => {
      const s = situacaoDe(c.id);
      const e = progresso.cards[c.id];
      const placar = e && e.vistas
        ? '<span class="selo">' + e.acertos + ' certas · ' + e.erros + ' erradas</span>' : '';

      /* «visto» é para o que já circulou. Preso e inédito nunca apareceram. */
      const marca = s.chave === 'dominado' ? 'dominado'
        : (s.chave === 'novo' || s.chave === 'preso') ? '' : 'visto';
      return '<div class="card-linha ' + marca + '">' +
        '<div class="card-linha-topo">' +
          '<span class="es">' + escapar(c.es) + '</span>' +
          '<span class="seta">→</span>' +
          '<span class="pt">' + escapar(c.pt) + '</span>' +
        '</div>' +
        '<div class="card-linha-meta">' +
          '<span class="selo nivel">' + escapar(c.nivel) + '</span>' +
          '<span class="selo">' + c.tipo + '</span>' +
          '<span class="selo situacao ' + s.chave + '">' + s.rotulo + '</span>' +
          placar +
          (c.tags || []).map(t => '<span class="selo">' + escapar(t) + '</span>').join('') +
        '</div>' +
        (c.nota ? '<p class="card-linha-nota">' + escapar(c.nota) + '</p>' : '') +
        '<button class="link-comentar na-lista" data-comentar="' + escapar(c.id) + '">Comentar</button>' +
      '</div>';
    }).join('');
  }

  /* ═══════════════ sincronização ═══════════════ */

  function statusSync(texto, classe) {
    el['estado-sync'].textContent = texto;
    el['estado-sync'].className = 'estado-sync ' + (classe || '');
    el['rodape-sync'].textContent = texto;
  }

  async function sincronizar(opcoes) {
    opcoes = opcoes || {};
    if (sincronizando) return;
    if (!GH.configurado()) {
      if (!opcoes.silencioso) statusSync('Informe o repositório e o token primeiro.', 'erro');
      return;
    }
    sincronizando = true;
    if (!opcoes.silencioso) statusSync('Enviando…');

    try {
      const agora = new Date().toISOString();

      /* Ler antes de escrever. Outro aparelho pode ter estudado desde a
         última subida, e escrever por cima apagaria o que ele fez — foi
         exatamente assim que 604 respostas viraram 25. Sem rede, sobe o
         que se tem: perder a mescla é melhor do que perder a resposta. */
      try {
        const arq = await GH.ler('progresso.json');
        if (arq) {
          const remoto = JSON.parse(arq.texto);
          progresso = conciliarFila(mesclar(progresso, remoto));
          salvarProgresso();
          atualizarPlacar();
        }
      } catch (e) { /* segue com o que temos */ }

      await GH.escrever('progresso.json',
        JSON.stringify(progresso, null, 1),
        'progresso — ' + agora,
        { keepalive: opcoes.keepalive });

      /* O progresso sobe sempre; sessão, contestações e resumo só de vez em
         quando. São o registro para calibrar levas, não o seu avanço, e
         subir os quatro a cada três respostas encheria o repositório de
         commits sem nenhum ganho. */
      if (!opcoes.completo) {
        statusSync(marcaDeSalvo(), 'ok');
        return;
      }

      if (sessao.eventos.length) {
        await GH.escrever('sessoes/' + sessao.id + '.json',
          JSON.stringify({
            id: sessao.id, inicio: sessao.inicio, fim: agora,
            respostas: sessao.eventos.length,
            acertos: sessao.eventos.filter(e => e.acertou).length,
            eventos: sessao.eventos
          }, null, 1),
          'sessão ' + sessao.id,
          { keepalive: opcoes.keepalive });
      }

      const contestacoes = progresso.contestacoes || [];
      if (contestacoes.length) {
        await GH.escrever('contestacoes.json',
          JSON.stringify({ atualizado_em: agora, total: contestacoes.length, casos: contestacoes }, null, 1),
          'respostas contestadas — ' + agora,
          { keepalive: opcoes.keepalive });
      }

      const comentarios = progresso.comentarios || [];
      if (comentarios.length) {
        await GH.escrever('comentarios.json',
          JSON.stringify({ atualizado_em: agora, total: comentarios.length, casos: comentarios }, null, 1),
          'comentários sobre cards — ' + agora,
          { keepalive: opcoes.keepalive });
      }

      await GH.escrever('resumo.md', gerarResumo(), 'resumo — ' + agora,
        { keepalive: opcoes.keepalive });

      statusSync(marcaDeSalvo(), 'ok');
    } catch (e) {
      statusSync('Não consegui salvar no GitHub: ' + e.message +
                 ' — o avanço está guardado neste navegador.', 'erro');
    } finally {
      sincronizando = false;
    }
  }

  async function baixar(op) {
    op = op || {};
    if (!GH.configurado()) {
      if (!op.silencioso) statusSync('Informe o repositório e o token primeiro.', 'erro');
      return;
    }
    if (!op.silencioso) statusSync('Baixando…');
    try {
      const arq = await GH.ler('progresso.json');
      if (!arq) {
        if (!op.silencioso) statusSync('Ainda não há progresso gravado no GitHub.', 'erro');
        return;
      }
      const remoto = JSON.parse(arq.texto);
      const antes = Object.keys(progresso.cards).length;
      progresso = mesclar(progresso, remoto);
      salvarProgresso();
      atualizarPlacar();
      const ganhou = Object.keys(progresso.cards).length - antes;
      statusSync(op.silencioso && !ganhou ? 'Sincronização ligada.'
        : ganhou ? 'Progresso de outro aparelho incorporado: +' + ganhou + ' cards.'
                 : 'Progresso do GitHub incorporado.', 'ok');
    } catch (e) {
      statusSync((op.silencioso ? 'Não consegui trazer o progresso do GitHub: '
                                : 'Falhou: ') + e.message, 'erro');
    }
  }

  /* Mescla card a card, ficando com a versão de mais respostas. */
  function mesclar(local, remoto) {
    const saida = {
      versao: 1,
      atualizado_em: new Date().toISOString(),
      /* A ordem das filas é só uma dica: o conciliarFila reconstrói tudo a
         partir da etapa de cada card, que é o que a mescla card a card
         resolve logo abaixo. Fico com a lista de quem tem mais o que dizer. */
      ineditos: (local.ineditos && local.ineditos.length) ? local.ineditos : (remoto.ineditos || []),
      filaEsPt: (local.filaEsPt && local.filaEsPt.length) ? local.filaEsPt : (remoto.filaEsPt || []),
      filaPtEs: (local.filaPtEs && local.filaPtEs.length) ? local.filaPtEs : (remoto.filaPtEs || []),
      dominados: (local.dominados && local.dominados.length) ? local.dominados : (remoto.dominados || []),
      /* A série é histórico: fica a mais longa das duas. */
      serie: ((local.serie || []).length >= (remoto.serie || []).length
                ? local.serie : remoto.serie) || [],
      contestacoes: juntarContestacoes(local.contestacoes, remoto.contestacoes),
      comentarios: juntarComentarios(local.comentarios, remoto.comentarios),
      cards: {},
      totais: {
        respostas: Math.max(local.totais.respostas, (remoto.totais || {}).respostas || 0),
        acertos: Math.max(local.totais.acertos, (remoto.totais || {}).acertos || 0),
        sessoes: Math.max(local.totais.sessoes, (remoto.totais || {}).sessoes || 0)
      }
    };
    const ids = new Set([...Object.keys(local.cards || {}), ...Object.keys(remoto.cards || {})]);
    ids.forEach(id => {
      const a = (local.cards || {})[id], b = (remoto.cards || {})[id];
      if (!a) { saida.cards[id] = b; return; }
      if (!b) { saida.cards[id] = a; return; }
      saida.cards[id] = (b.vistas > a.vistas) ? b : a;
    });
    return conciliarFila(saida);
  }

  /* Comentário some do aparelho que não o escreveu, então a mesclagem junta
     os dois lados. A chave é card + texto: o mesmo reparo anotado duas vezes
     é um; dois reparos diferentes sobre o mesmo card são dois. */
  function juntarComentarios(a, b) {
    const saida = [], vistos = new Set();
    for (const c of [...(a || []), ...(b || [])]) {
      if (!c || !c.card) continue;
      const chave = c.card + '|' + Motor.normalizar(c.texto);
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      saida.push(c);
    }
    return saida;
  }

  /* Contestação é registro do que ele pensou: nunca se perde numa mesclagem. */
  function juntarContestacoes(a, b) {
    const saida = [];
    const vistas = new Set();
    for (const c of [...(a || []), ...(b || [])]) {
      const chave = c.card + '|' + Motor.normalizar(c.resposta);
      if (vistas.has(chave)) continue;
      vistas.add(chave);
      saida.push(c);
    }
    return saida;
  }

  /* Relatório legível — é por ele que a calibragem começa da próxima vez. */
  function gerarResumo() {
    const ids = Object.keys(progresso.cards);
    const t = progresso.totais;
    const taxa = t.respostas ? Math.round(100 * t.acertos / t.respostas) : 0;
    const L = [];

    L.push('# Resumo de estudo — espanhol');
    L.push('');
    L.push('Atualizado em ' + new Date().toISOString());
    L.push('');
    L.push('- Cards no baralho: **' + CARDS.length + '**');
    L.push('- Cards já vistos: **' + ids.length + '**');
    L.push('- Respostas: **' + t.respostas + '** · acerto geral: **' + taxa + '%**');
    L.push('- Dominados nas duas direções: **' +
      ids.filter(id => progresso.cards[id].etapa === 'dominado').length + '**');
    L.push('');

    const porNivel = agregar(c => c.nivel);
    L.push('## Desempenho por nível');
    L.push('');
    L.push('| Nível | Cards | Respostas | Acerto | Tempo médio | Já conhecia |');
    L.push('|---|---:|---:|---:|---:|---:|');
    Motor.NIVEIS.forEach(n => {
      const g = porNivel[n]; if (!g) return;
      L.push('| ' + n + ' | ' + g.cards + ' | ' + g.total + ' | ' + pct(g) + ' | ' +
        seg(g) + ' | ' + g.conhecia + ' |');
    });
    L.push('');

    const porTipo = agregar(c => c.tipo);
    L.push('## Palavras x frases');
    L.push('');
    L.push('| Tipo | Cards | Respostas | Acerto | Tempo médio |');
    L.push('|---|---:|---:|---:|---:|');
    ['palavra', 'frase'].forEach(k => {
      const g = porTipo[k]; if (!g) return;
      L.push('| ' + k + ' | ' + g.cards + ' | ' + g.total + ' | ' + pct(g) + ' | ' + seg(g) + ' |');
    });
    L.push('');

    const porTag = {};
    ids.forEach(id => {
      const c = PORID[id]; if (!c) return;
      (c.tags || []).forEach(tg => {
        const g = porTag[tg] || (porTag[tg] = { cards: 0, certas: 0, total: 0, ms: 0, conhecia: 0 });
        g.cards++;
        (progresso.cards[id].historico || []).forEach(h => {
          g.total++; if (h.acertou) g.certas++; if (!h.pausado) g.ms += h.ms;
        });
      });
    });
    const tags = Object.keys(porTag).filter(k => porTag[k].total >= 3)
      .sort((a, b) => (porTag[a].certas / porTag[a].total) - (porTag[b].certas / porTag[b].total));
    if (tags.length) {
      L.push('## Por tema (do mais difícil para o mais fácil)');
      L.push('');
      L.push('| Tema | Cards | Respostas | Acerto |');
      L.push('|---|---:|---:|---:|');
      tags.forEach(k => L.push('| ' + k + ' | ' + porTag[k].cards + ' | ' +
        porTag[k].total + ' | ' + pct(porTag[k]) + ' |'));
      L.push('');
    }

    const dificeis = ids.map(id => ({ id, e: progresso.cards[id] }))
      .filter(x => x.e.erros > 0)
      .sort((a, b) => (b.e.erros - a.e.erros) || (b.e.vistas - a.e.vistas))
      .slice(0, 25);
    if (dificeis.length) {
      L.push('## Cards que mais deram trabalho');
      L.push('');
      L.push('| Card | Significado | Nível | Erros | Vistas | Etapa | Conhecia |');
      L.push('|---|---|---|---:|---:|---|---|');
      dificeis.forEach(x => {
        const c = PORID[x.id];
        L.push('| ' + c.es + ' | ' + c.pt + ' | ' + c.nivel + ' | ' + x.e.erros + ' | ' +
          x.e.vistas + ' | ' + x.e.etapa + ' | ' + (x.e.conhecia || '—') + ' |');
      });
      L.push('');
    }

    const naoConhecia = ids.filter(id => progresso.cards[id].conhecia === 'nao');
    if (naoConhecia.length) {
      L.push('## Vocabulário novo para você (' + naoConhecia.length + ')');
      L.push('');
      L.push(naoConhecia.map(id => '`' + PORID[id].es + '`').join(' · '));
      L.push('');
    }

    const contestadas = progresso.contestacoes || [];
    if (contestadas.length) {
      L.push('## Respostas que ele acha que deveriam ser aceitas (' + contestadas.length + ')');
      L.push('');
      L.push('**Revisar uma a uma antes da próxima leva.** Ele escreveu isto, foi');
      L.push('contado como erro, e discordou.');
      L.push('');
      L.push('| Card | Pediu | Ele escreveu | Esperava |');
      L.push('|---|---|---|---|');
      contestadas.forEach(c => {
        const pediu = c.direcao === 'pt-es' ? c.pt : c.es;
        L.push('| `' + c.card + '` | ' + pediu + ' | **' + c.resposta + '** | ' + c.esperado + ' |');
      });
      L.push('');
    }

    const comentados = progresso.comentarios || [];
    if (comentados.length) {
      L.push('## Comentários sobre cards (' + comentados.length + ')');
      L.push('');
      L.push('**Avaliar um a um antes da próxima leva.** Escrito por ele durante o');
      L.push('estudo, sobre qualquer card — não só sobre resposta contada como erro.');
      L.push('');
      L.push('| Card | Card diz | Comentário |');
      L.push('|---|---|---|');
      comentados.forEach(c => {
        const limpo = String(c.texto || '').replace(/\|/g, '\\|').replace(/\n+/g, ' ');
        L.push('| `' + c.card + '` | ' + c.es + ' → ' + c.pt + ' | ' + limpo + ' |');
      });
      L.push('');
    }

    L.push('---');
    L.push('');
    L.push('_Gerado pelo app. Serve de base para calibrar a próxima leva de cards._');
    return L.join('\n');

    function agregar(chave) {
      const g = {};
      ids.forEach(id => {
        const c = PORID[id]; if (!c) return;
        const k = chave(c);
        const x = g[k] || (g[k] = { cards: 0, certas: 0, total: 0, ms: 0, msN: 0, conhecia: 0 });
        x.cards++;
        if (progresso.cards[id].conhecia === 'sim') x.conhecia++;
        (progresso.cards[id].historico || []).forEach(h => {
          x.total++;
          if (h.acertou) x.certas++;
          if (!h.pausado) { x.ms += h.ms; x.msN++; }
        });
      });
      return g;
    }
    function pct(g) { return g.total ? Math.round(100 * g.certas / g.total) + '%' : '—'; }
    function seg(g) { return g.msN ? (g.ms / g.msN / 1000).toFixed(1) + 's' : '—'; }
  }

  /* ═══════════════ exportar / importar ═══════════════ */

  function exportar() {
    const blob = new Blob([JSON.stringify(progresso, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'espanhol-progresso-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function importar(arquivo) {
    const leitor = new FileReader();
    leitor.onload = () => {
      try {
        progresso = mesclar(progresso, JSON.parse(leitor.result));
        salvarProgresso();
        atualizarPlacar();
        statusSync('Arquivo incorporado.', 'ok');
      } catch (e) {
        statusSync('Arquivo inválido: ' + e.message, 'erro');
      }
    };
    leitor.readAsText(arquivo);
  }

  /* ═══════════════ eventos ═══════════════ */

  el['btn-comecar'].addEventListener('click', proximoCard);
  el['btn-proximo'].addEventListener('click', avancar);
  el['btn-contestar'].addEventListener('click', contestar);

  el['btn-comentar-card'].addEventListener('click', () => cardAtual && abrirComentario(cardAtual.id));
  /* delegado: a lista se redesenha a cada filtro, e religar ouvinte a ouvinte
     em 458 linhas seria trabalho à toa */
  el['lista-cards'].addEventListener('click', e => {
    const b = e.target.closest('[data-comentar]');
    if (b) abrirComentario(b.dataset.comentar);
  });
  el['btn-comentario-enviar'].addEventListener('click', enviarComentario);
  el['btn-comentario-fechar'].addEventListener('click', fecharComentario);
  el['comentario-texto'].addEventListener('input', contarComentario);
  /* clicar fora fecha; clicar dentro do painel, não */
  el['comentario-fundo'].addEventListener('click', e => {
    if (e.target === el['comentario-fundo']) fecharComentario();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !el['comentario-fundo'].classList.contains('oculto')) fecharComentario();
  });
  el['btn-responder'].addEventListener('click', () => responderEscrita(false));
  el['btn-nao-sei'].addEventListener('click', () => responderEscrita(true));
  el.entrada.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.keyCode === 13) { e.preventDefault(); responderEscrita(false); }
  });

  document.querySelectorAll('.opcao-julgamento').forEach(b => {
    b.addEventListener('click', () => julgar(b.dataset.julgamento));
  });

  document.querySelectorAll('.opcao-conhecia').forEach(b => {
    b.addEventListener('click', () => {
      aplicarConhecia(b.dataset.conhecia);
      document.querySelectorAll('.opcao-conhecia').forEach(o => {
        o.style.borderColor = '';
        o.style.color = '';
      });
      b.style.borderColor = 'var(--acento)';
      b.style.color = 'var(--acento)';
    });
  });

  /* Sair de um card sem responder não pode sumir com ele: volta para a
     frente do baralho de onde saiu, para ser o próximo quando você voltar.
     Inédito volta para os inéditos — se fosse para a fila, entraria em
     circulação sem nunca ter sido respondido. */
  function irParaInicio() {
    if (cardAtual && !respostaPendente) {
      const id = cardAtual.id;
      const est = progresso.cards[id];
      const baralho = !est ? progresso.ineditos
        : Motor.filaDe(est) === 'esPt' ? progresso.filaEsPt
        : Motor.filaDe(est) === 'ptEs' ? progresso.filaPtEs
        : progresso.dominados;
      if (baralho.indexOf(id) < 0) {
        baralho.unshift(id);
        /* Na fila de revisão a ordem não conta mais: o que o põe na frente
           é uma espera que nenhum outro card alcança. */
        if (est && est.etapa !== 'dominado') {
          est.naFila = { desde: progresso.totais.respostas - 1e6, distancia: 1 };
        }
        salvarProgresso();
      }
    }
    cardAtual = null;
    respostaPendente = null;
    atualizarPlacar();
    mostrar('tela-inicio');
  }

  el['btn-inicio'].addEventListener('click', irParaInicio);
  el['btn-cards'].addEventListener('click', abrirCards);
  el['btn-painel'].addEventListener('click', abrirPainel);

  ['filtro-tipo', 'filtro-nivel', 'filtro-tag', 'filtro-estado'].forEach(f => {
    el[f].addEventListener('change', renderizarCards);
  });
  let esperaBusca = null;
  el['busca-cards'].addEventListener('input', () => {
    clearTimeout(esperaBusca);
    esperaBusca = setTimeout(renderizarCards, 120);
  });
  el['btn-config'].addEventListener('click', abrirConfig);
  document.querySelectorAll('[data-voltar]').forEach(b => {
    b.addEventListener('click', () => mostrar(cardAtual ? 'tela-card' : 'tela-inicio'));
  });

  function abrirConfig() {
    const c = GH.cfg();
    el['cfg-repo'].value = c.repo;
    el['cfg-token'].value = c.token;
    el['cfg-auto'].checked = !!c.auto;
    mostrar('tela-config');
  }

  el['btn-salvar-cfg'].addEventListener('click', () => {
    GH.salvarCfg({
      repo: el['cfg-repo'].value.trim(),
      token: el['cfg-token'].value.trim(),
      auto: el['cfg-auto'].checked
    });
    statusSync('Configuração salva neste navegador.', 'ok');
  });
  el['btn-enviar'].addEventListener('click', () => sincronizar({ completo: true }));
  el['btn-baixar'].addEventListener('click', baixar);
  el['btn-exportar'].addEventListener('click', exportar);
  el['btn-importar'].addEventListener('click', () => el['arquivo-importar'].click());
  el['arquivo-importar'].addEventListener('change', e => {
    if (e.target.files[0]) importar(e.target.files[0]);
  });
  el['btn-zerar'].addEventListener('click', () => {
    if (!confirm('Apagar todo o progresso guardado neste navegador?')) return;
    localStorage.removeItem(CHAVE_PROGRESSO);
    progresso = progressoVazio();
    cardAtual = null;
    salvarProgresso();
    atualizarPlacar();
    statusSync('Progresso local apagado.', 'ok');
    mostrar('tela-inicio');
  });

  /* teclado */
  document.addEventListener('keydown', e => {
    if (el['tela-card'].classList.contains('oculto')) return;
    const alvo = e.target.tagName;
    if (alvo === 'INPUT' && e.key !== 'Escape') return;

    if (!el['area-feedback'].classList.contains('oculto')) {
      if (!el['area-julgamento'].classList.contains('oculto')) {
        if ('12'.includes(e.key)) {
          e.preventDefault();
          document.querySelectorAll('.opcao-julgamento')[+e.key - 1].click();
        }
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); avancar(); }
      if (!el['area-conhecia'].classList.contains('oculto') && '123'.includes(e.key)) {
        e.preventDefault();
        document.querySelectorAll('.opcao-conhecia')[+e.key - 1].click();
      }
      return;
    }
    if (modoAtual === 'multipla' && '12345'.includes(e.key)) {
      e.preventDefault();
      const b = el['area-multipla'].children[+e.key - 1];
      if (b && !b.disabled) b.click();
    }
  });

  /* tempo só conta enquanto a aba está visível */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (cardAtual && !respostaPendente) pausou = true;
      if (GH.cfg().auto && GH.configurado() && sessao.eventos.length) {
        sincronizar({ silencioso: true, keepalive: true, completo: true });
      }
    }
  });
  window.addEventListener('pagehide', () => {
    if (GH.cfg().auto && GH.configurado() && sessao.eventos.length) {
      sincronizar({ silencioso: true, keepalive: true, completo: true });
    }
  });

  /* A frase do card gruda logo abaixo do cabeçalho, e para isso precisa saber
     a altura dele — que não é fixa: em tela estreita o placar quebra de linha e
     o cabeçalho cresce. O CSS não mede outro elemento, então a medida vem
     daqui. */
  function medirCabecalho() {
    const t = document.querySelector('.topo');
    if (t) document.documentElement.style.setProperty('--altura-topo', t.offsetHeight + 'px');
  }
  medirCabecalho();
  window.addEventListener('resize', medirCabecalho);

  /* ═══════════════ arranque ═══════════════ */

  montarFiltros();

  progresso.totais.sessoes = (progresso.totais.sessoes || 0) + 1;
  salvarProgresso();
  atualizarPlacar();
  statusSync(GH.configurado() ? 'Sincronização ligada.' : 'Sem token — dados só neste navegador.');
  mostrar('tela-inicio');

  /* Trazer antes de mandar. A sincronização só subia sozinha: abrir o app num
     aparelho novo, com o localStorage vazio, começava do zero e a primeira
     subida apagava o progresso do outro aparelho. Agora todo arranque com
     token configurado mescla o que está no GitHub antes de qualquer coisa. */
  if (GH.configurado()) {
    baixar({ silencioso: true }).then(() => { conciliarFila(progresso); salvarProgresso(); });
  }

  window.Espanhol = { progresso: () => progresso, sessao: () => sessao, resumo: gerarResumo };
})();
