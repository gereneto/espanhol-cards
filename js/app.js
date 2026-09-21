/* ────────────────────────────────────────────────────────────────
   app.js — telas, fluxo de estudo e sincronização.
   ──────────────────────────────────────────────────────────────── */
(function () {

  const CHAVE_PROGRESSO = 'espanhol-cards:progresso';
  const SINCRONIZAR_A_CADA = 3;   // respostas
  const SINCRONIZAR_COMPLETO_A_CADA = 8;  // sincronizações
  const REDE_DE_SEGURANCA = 45000;        // ms parado com resposta pendente

  /* ── o baralho, e o baralho como ele aparece ──
     O card de gênero guarda as duas formas num texto só («Tu herman{o|a} es
     muy maj{o|a}»). Quem estuda vê uma delas, sorteada na hora de perguntar;
     todo o resto do app — a lista, o painel, o relatório, os distratores
     tirados de outros cards — trabalha com a forma masculina, que é a
     canônica. Daí os dois baralhos: FONTE é o que o build gerou, CARDS é o
     que se mostra. */
  const FONTE = (window.CARDS_RAW && window.CARDS_RAW.cards) || [];
  const PORID_FONTE = {};
  FONTE.forEach(c => { PORID_FONTE[c.id] = c; });

  const CARDS = FONTE.map(c => Motor.formaDoCard(c, 0));
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
    'area-julgamento', 'resposta-dada', 'texto-dado',
    'area-contestar', 'btn-contestar', 'aviso-contestado', 'btn-comentar-card',
    'comentario-fundo', 'comentario-alvo', 'comentario-texto', 'comentario-restam',
    'btn-comentario-enviar', 'btn-comentario-fechar',
    'btn-proximo', 'painel-conteudo', 'dica',
    'cfg-repo', 'cfg-token', 'cfg-auto', 'btn-salvar-cfg', 'btn-enviar',
    'btn-baixar', 'estado-sync', 'btn-exportar', 'btn-importar',
    'arquivo-importar', 'btn-zerar', 'rodape-sync'
  ].forEach(id => { el[id] = document.getElementById(id); });

  /* ═══════════════ estado ═══════════════ */

  let progresso = carregarProgresso();
  let sessao = novaSessao();
  let cardAtual = null;
  let generoAtual = 0;      // 0 masculino, 1 feminino — só no card que muda de gênero
  let outraForma = null;    // o mesmo card no outro gênero, para a nota
  let modoAtual = null;
  let direcaoAtual = 'es-pt';
  let alvoAtual = null;
  let inicioResposta = 0;
  let pausou = false;
  let respostaPendente = null;
  let ultimoRegistro = null;
  let chanceUsada = false;   // o aviso de língua trocada só devolve a vez uma vez
  let dinamicosAtuais = [];  // distratores que saíram do progresso, e não do card
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

    /* O histórico antigo gravava em toda resposta três campos que quase
       sempre dizem «não» — quase, pausado e o «conhecia» da pergunta que já
       saiu do app. Tirá-los quando não dizem nada enxuga o arquivo em um
       terço, e ninguém os lê de outro jeito que não «é verdadeiro?». */
    Object.keys(p.cards).forEach(id => {
      ((p.cards[id] && p.cards[id].historico) || []).forEach(h => {
        if (!h) return;
        if (!h.quase) delete h.quase;
        if (!h.pausado) delete h.pausado;
        if (h.conhecia == null) delete h.conhecia;
      });
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

    /* ── o diário, a retenção e o custo do domínio ──
       Mesma semente, mesma guarda. O diário tira do repositório de dados cada
       resposta dada desde o primeiro dia; o que veio depois da última
       fotografia sai do histórico dos próprios cards, que ainda o guarda.
       Para quem não é a continuação daquele histórico, o diário começa só do
       histórico dos cards — é pouco, mas é dele. */
    const raw = window.HISTORICO_RAW || {};
    const continua = semente.length &&
      (p.totais && p.totais.respostas || 0) >= semente[semente.length - 1][0] - 50;
    if (!p.diario || typeof p.diario !== 'object') {
      p.diario = continua && raw.diario ? JSON.parse(JSON.stringify(raw.diario)) : {};
      const desde = continua ? (raw.ate || '') : '';
      Object.keys(p.cards).forEach(id => (p.cards[id].historico || []).forEach(h => {
        if (h && h.em && h.em > desde) Motor.anotarDiario(p.diario, h, h.em);
      }));
    }
    if (!Array.isArray(p.retencao) || p.retencao.length !== Motor.DIAS_DOMINADO.length) {
      p.retencao = continua && raw.retencao ? raw.retencao.map(g => g.slice())
        : Motor.DIAS_DOMINADO.map(() => [0, 0]);
    }
    /* ── a estreia de cada card ──
       O dia em que ele apareceu pela primeira vez, para o gráfico de cards
       novos por dia. O card só guarda as últimas doze respostas, e nos mais
       rodados a primeira já se foi: aí quem sabe é a semente, que leu todas
       as fotografias. Sem semente, vale a resposta mais antiga que sobrou —
       exata enquanto o histórico ainda está inteiro. */
    Object.keys(p.cards).forEach(id => {
      const e = p.cards[id];
      if (!e || e.estreia || !e.vistas) return;
      const daSemente = continua && raw.estreias && raw.estreias[id];
      const h = (e.historico || []).map(x => x && x.em).filter(Boolean).sort()[0];
      const doCard = h ? Motor.diaLocal(h) : '';
      e.estreia = daSemente && (!doCard || daSemente < doCard) ? daSemente : doCard || daSemente || undefined;
      if (!e.estreia) delete e.estreia;
    });
    if (continua && raw.ateDominar) {
      Object.keys(raw.ateDominar).forEach(id => {
        const e = p.cards[id];
        if (e && e.ateDominar === undefined) e.ateDominar = raw.ateDominar[id];
      });
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
       furam a fila no máximo FRESCAS_NA_FRENTE, liberadas nas últimas 24
       horas; as outras entram intercaladas, uma a cada DOIS cards de outro
       tipo. Para palavra dominada antes de existir «dominadoEm», a data que
       sobra é o «ultima», que a revisão do dominado também renova — por isso
       o teto, e não só a janela. */
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
    el.dica.hidden = true;
    const aceso = BOTAO_DA_TELA[tela];
    Object.values(BOTAO_DA_TELA).forEach(b => el[b].classList.toggle('aqui', b === aceso));
    /* Tela nova abre no topo. Sem isto o painel herdava a rolagem de onde
       se estava — no meio do feedback de um card, em geral — e abria já nos
       gráficos. O card fica de fora: ele tem a sua subida (voltarAoTopo). */
    if (tela !== 'tela-card') {
      if (rolagemAtual) rolagemAtual.parar();
      window.scrollTo(0, 0);
    }
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
    /* Uma sincronização no meio do card refaz as filas pela etapa de cada um
       (ver conciliarFila) e devolve o card que está na tela à fila dele — ou
       aos inéditos, se era a estreia. Sem tirar antes, ele ficava duas vezes
       na fila, e o inédito já respondido podia sair de novo como «novo». */
    retirarDasFilas(id);
    const novo = progresso.ineditos.indexOf(id);
    if (novo >= 0) progresso.ineditos.splice(novo, 1);

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
    recolherFrasesLiberadas();
    if (window.scrollY >= 2) el['tela-card'].style.minHeight = el['tela-card'].offsetHeight + 'px';
    const id = tirarProximoId();
    if (!id) { irParaInicio(); return; }
    const bruto = PORID_FONTE[id];
    if (!bruto) return proximoCard();
    /* O gênero é sorteado a cada aparição, e vale para o card inteiro: a
       pergunta, a resposta certa, as aceitas e os distratores saem todos do
       mesmo lado. O outro lado fica guardado para a nota. */
    generoAtual = Motor.temVariante(bruto) && Math.random() < 0.5 ? 1 : 0;
    cardAtual = Motor.formaDoCard(bruto, generoAtual);
    outraForma = Motor.temVariante(bruto) ? Motor.formaDoCard(bruto, 1 - generoAtual) : null;

    const est = estadoDe(id);
    const fase = Motor.faseDe(est);
    modoAtual = fase.modo;
    direcaoAtual = fase.direcao;
    alvoAtual = Motor.resposta(cardAtual, direcaoAtual);
    respostaPendente = null;
    ultimoRegistro = null;
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
    /* O foco no campo espera a subida acabar: focar antes faz o navegador
       rolar até o campo por conta própria, e as duas rolagens brigam. */
    voltarAoTopo(() => {
      if (modoAtual === 'escrita' && cardAtual) el.entrada.focus({ preventScroll: true });
    });

    inicioResposta = performance.now();
  }

  function montarAlternativas() {
    /* com o progresso, a frase de uso pode trocar distrator pronto por
       palavra já vista (ver Motor.distratoresDinamicos) */
    const opcoes = Motor.alternativas(cardAtual, direcaoAtual, CARDS, progresso.cards);
    /* quais alternativas não são do card: vão para o log da sessão, para a
       calibragem saber quando o erro foi num distrator dinâmico */
    dinamicosAtuais = direcaoAtual === 'pt-es' ? []
      : opcoes.filter(o => o !== cardAtual.pt && cardAtual.distratores.indexOf(o) < 0);
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
    if (!INDICE_ES) INDICE_ES = Motor.indiceEspanhol(FONTE);
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
    el.entrada.focus({ preventScroll: true });
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
    el.entrada.focus({ preventScroll: true });
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

    el['resposta-certa'].textContent = alvoAtual;
    /* Neutra por padrão: quem pinta de verde é o veredito, e no caso do
       "deu quase" ele só chega depois que você julgar. */
    el['caixa-resposta'].classList.remove('certa');
    /* O card saiu num dos dois gêneros; o outro entra no fim da nota, que é
       onde o card ensina. Ver «Tu hermana es muy maja» depois de responder o
       masculino é a outra metade da lição — e é de graça, porque o card já
       traz as duas formas. */
    const nota = [cardAtual.nota,
      outraForma ? '🔁 ' + (generoAtual ? 'No masculino' : 'No feminino') +
        ': «' + outraForma.es + '» — ' + outraForma.pt : ''
    ].filter(Boolean).join('\n');
    el.nota.textContent = nota;
    el.nota.classList.toggle('oculto', !nota);

    const rotuloVel = { rapido: 'rápido', medio: 'no tempo médio', lento: 'devagar' }[r.velocidade];
    el.medidas.innerHTML =
      /* tempo desconsiderado não aparece: o número não mediu nada */
      (r.pausado ? ''
        : '<span class="medida"><b>' + (r.ms / 1000).toFixed(1) + 's</b> — ' + rotuloVel + '</span>') +
      /* o nível já está na aba do fichário; repeti-lo aqui só ocupa lugar */
      (cardAtual.tags || []).map(t => '<span class="medida">' + escapar(t) + '</span>').join('') +
      (r.pausado
        ? '<span class="medida">tempo não contado (' +
          (pausou ? 'você saiu da aba' : 'demorou demais, o card ficou parado') + ')</span>'
        : '');

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
      /* a diferença pintada dos dois lados, como no acento: achar uma letra
         numa frase inteira, a olho, custa mais do que devia */
      const dif = Motor.diferencaDoQuase(cardAtual, r.resposta, r.direcao);
      if (dif) {
        const pintar = ps => ps.map(p => p.destaque
          ? '<mark class="acento">' + escapar(p.texto) + '</mark>' : escapar(p.texto)).join('');
        el['texto-dado'].innerHTML = pintar(dif.dada);
        /* a forma mais próxima pode ser uma variante, e não a que está na
           caixa: se ela estiver lá dentro («o galho / o ramo»), pinta no
           lugar; se não, aparece ao lado do que foi escrito */
        const onde = alvoAtual.indexOf(dif.forma);
        if (onde >= 0) {
          el['resposta-certa'].innerHTML = escapar(alvoAtual.slice(0, onde)) + pintar(dif.certa) +
            escapar(alvoAtual.slice(onde + dif.forma.length));
        } else {
          el['texto-dado'].innerHTML += ' <span class="forma-rotulo variante">também vale «' +
            pintar(dif.certa) + '»</span>';
        }
      }
      el['resposta-dada'].classList.remove('oculto');
      el['area-julgamento'].classList.remove('oculto');
      el['btn-proximo'].classList.add('oculto');
    } else {
      if (!forma && !genero && !acento && !flexao) el['resposta-dada'].classList.add('oculto');
      el['area-julgamento'].classList.add('oculto');
      el['btn-proximo'].classList.remove('oculto');
      mostrarVeredito(r);
      registrar(r);
      mostrarContestar(r);
    }

    el['area-feedback'].classList.remove('oculto');
    el['btn-proximo'].focus({ preventScroll: true });
    trazerBotaoParaAVista();
  }

  /* ── a rolagem ──
     Depois de responder, o feedback empurra o botão de seguir adiante para
     baixo da dobra. A tela sobe o bastante para ele aparecer, e nada além
     disso, para o espanhol não sair de vista. Quando a resposta ficou por
     julgar, o alvo são os dois botões de julgamento.

     A versão anterior disparava três rolagens — suave, suave de novo 300 ms
     depois, e uma seca aos 700 ms para o caso de a suave ter morrido — e
     refazia o «chão» debaixo do botão a cada uma. Funcionava, mas se via: a
     seca dava tranco, a segunda suave recomeçava no meio da primeira, e
     zerar o chão para medir de novo encolhia a página por um instante, e o
     navegador puxava a tela de volta antes de ela descer outra vez.

     Agora é uma animação só, feita à mão, quadro a quadro. A cada quadro ela
     mede quanto ainda falta para o alvo caber na parte visível — contra o
     visualViewport, que é quem sabe o que o teclado cobre — e se move como
     uma mola com amortecimento crítico: sai parada, acelera, freia e chega
     sem passar do ponto. Se o teclado fecha no meio, o que falta muda e a
     mola segue o novo alvo sem recomeçar. Termina quando fica parada no
     lugar por alguns quadros, depois de um mínimo que dá tempo ao teclado.

     O chão só cresce durante a animação, e no fim sai apenas a sobra que
     está abaixo da tela: tirar o que ninguém está vendo não move nada.
     Um toque ou a roda do mouse no meio do caminho interrompem: a mão de
     quem usa manda mais do que a animação. */
  const FOLGA_BOTAO = 24;

  /* Quanto ainda falta rolar para o alvo caber na parte de fato visível.
     Positivo: falta descer. Negativo: há folga sobrando abaixo do alvo. */
  function faltaRolar(alvo) {
    const r = alvo.getBoundingClientRect();
    if (!r.height) return 0;
    const vv = window.visualViewport;
    const topo = vv ? vv.offsetTop : 0;
    const altura = vv ? vv.height : window.innerHeight;
    return (r.bottom + FOLGA_BOTAO) - (topo + altura);
  }

  /* O teclado do celular encolhe o visualViewport e deixa o innerHeight como
     estava (no Chrome antigo encolhia os dois, e aí isto não vê nada — quem
     cobre esse caso é a volta, em trazerBotaoParaAVista). */
  function tecladoAberto() {
    const vv = window.visualViewport;
    return !!vv && vv.height < window.innerHeight - 120;
  }

  let rolagemAtual = null;

  /* Anima a rolagem até «falta()» chegar a zero. «falta» devolve pixels,
     positivos para descer e negativos para subir. */
  function rolarSuave(falta, aoTerminar, opcoes) {
    if (rolagemAtual) rolagemAtual.parar();
    const esperarTeclado = !!(opcoes && opcoes.esperarTeclado);
    const ESPERA_TECLADO = 500;   // ms: se ele não fechar nisso, desce assim mesmo
    const raiz = document.documentElement;
    const chao = el['area-feedback'];
    const instantaneo = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const W = 13;             // rad/s: rigidez da mola (chega em ~0,4 s)
    const MINIMO = 450;       // ms: tempo para o teclado terminar de fechar
    const MAXIMO = 1600;      // ms: nunca fica rolando para sempre
    const inicio = performance.now();
    let anterior = inicio, parado = 0, quadro = 0, vivo = true, vel = 0;

    const interromper = () => parar();
    window.addEventListener('touchstart', interromper, { passive: true, once: true });
    window.addEventListener('wheel', interromper, { passive: true, once: true });

    function parar(concluiu) {
      if (!vivo) return;
      vivo = false;
      cancelAnimationFrame(quadro);
      window.removeEventListener('touchstart', interromper);
      window.removeEventListener('wheel', interromper);
      /* a sobra do chão que ficou abaixo da tela sai sem mexer em nada */
      const pad = parseFloat(chao.style.paddingBottom) || 0;
      if (pad) {
        const sobra = raiz.scrollHeight - (window.scrollY + window.innerHeight);
        const tirar = Math.min(pad, Math.max(0, Math.floor(sobra)));
        chao.style.paddingBottom = (pad - tirar) ? (pad - tirar) + 'px' : '';
      }
      if (rolagemAtual === controle) rolagemAtual = null;
      if (concluiu && aoTerminar) aoTerminar();
    }

    function passo(agora) {
      if (!vivo) return;
      /* Responder por escrito fecha o teclado, e ele leva uns 300 ms para
         sair. Descer nesse intervalo é medir a tela pela metade: a mola
         chegava ao alvo com o teclado ainda aberto, o teclado saía, e a
         página ficava descida demais. Espera ele sair, e só então mede. */
      if (esperarTeclado && agora - inicio < ESPERA_TECLADO && tecladoAberto()) {
        anterior = agora;
        quadro = requestAnimationFrame(passo);
        return;
      }
      const dt = Math.min(64, agora - anterior) / 1000;
      anterior = agora;
      const d = falta();
      if (Math.abs(d) < 0.5 && Math.abs(vel) < 20) {
        vel = 0;
        parado++;
        if (parado >= 6 && agora - inicio >= MINIMO) return parar(true);
      } else {
        parado = 0;
        let andar;
        if (instantaneo) {
          andar = d;
        } else {
          vel += (W * W * d - 2 * W * vel) * dt;
          andar = vel * dt;
          /* nunca passa do alvo; e o fim não se arrasta em frações de pixel */
          if (Math.abs(andar) > Math.abs(d) || Math.sign(andar) !== Math.sign(d)) { andar = d; vel = 0; }
          else if (Math.abs(andar) < 1 && Math.abs(d) <= 4) andar = d;
        }
        if (andar > 0) {
          const podeRolar = raiz.scrollHeight - window.scrollY - window.innerHeight;
          if (andar > podeRolar) {
            const pad = parseFloat(chao.style.paddingBottom) || 0;
            chao.style.paddingBottom = Math.ceil(pad + andar - podeRolar) + 'px';
          }
        }
        window.scrollTo(0, window.scrollY + andar);
      }
      if (agora - inicio >= MAXIMO) return parar(true);
      quadro = requestAnimationFrame(passo);
    }

    const controle = { parar: () => parar(false) };
    rolagemAtual = controle;
    quadro = requestAnimationFrame(passo);
    return controle;
  }

  function trazerBotaoParaAVista() {
    const alvo = el['btn-proximo'].classList.contains('oculto')
      ? el['area-julgamento'] : el['btn-proximo'];
    if (!alvo) return;
    /* O alvo tem dois lados. Se a tela cresce no meio do caminho — o teclado
       que fecha tarde, a barra do navegador que some —, o que já se desceu
       passa do ponto, e antes a conta parava em zero e deixava assim. Agora
       ela devolve o excesso, mas só o que ESTA animação desceu: nunca sobe
       além de onde a tela estava quando a resposta foi dada. */
    const partida = window.scrollY;
    rolarSuave(() => {
      const d = faltaRolar(alvo);
      return d >= 0 ? d : Math.max(d, Math.min(0, partida - window.scrollY));
    }, null, { esperarTeclado: true });
  }

  /* Card novo começa do topo, subindo com a mesma suavidade. A página do
     card anterior era mais alta (tinha feedback), e trocar o conteúdo com a
     tela lá embaixo faria o navegador saltar para cima de uma vez; segurar a
     altura até a subida acabar evita o salto. */
  function voltarAoTopo(aoTerminar) {
    if (window.scrollY < 2) {
      el['tela-card'].style.minHeight = '';
      if (aoTerminar) aoTerminar();
      return;
    }
    el['tela-card'].style.minHeight = el['tela-card'].offsetHeight + 'px';
    rolarSuave(() => -window.scrollY, () => {
      el['tela-card'].style.minHeight = '';
      if (aoTerminar) aoTerminar();
    });
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
    mostrarContestar(r);
    el['btn-proximo'].focus({ preventScroll: true });
    trazerBotaoParaAVista();
  }
  /* Frases cuja palavra foi dominada até ontem e que ainda não estão nos
     inéditos. Antes elas entravam na hora do domínio; agora esperam o dia
     virar (ver Motor.liberado), e quem as recolhe é esta função, chamada a
     cada card — o app pode ficar aberto de um dia para o outro. */
  function recolherFrasesLiberadas() {
    const agora = Date.now();
    const jaEsta = new Set(progresso.ineditos);
    const novas = CARDS.filter(c => c.requer && !progresso.cards[c.id] &&
      !jaEsta.has(c.id) && Motor.liberado(c, progresso.cards, agora));
    if (!novas.length) return;
    novas.forEach(c => progresso.ineditos.push(c.id));
    ordenarIneditos(progresso);
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
    const degrauAntes = Math.min(est.revisoes || 0, 5);
    Motor.registrar(est, r);
    /* Para o painel: o dia, a hora e o tempo desta resposta, e — se era a
       revisão de um dominado — se a memória aguentou a espera daquele degrau. */
    Motor.anotarDiario(progresso.diario, r, est.ultima);
    if (etapaAntes === 'dominado') {
      progresso.retencao[degrauAntes][0]++;
      if (r.acertou) progresso.retencao[degrauAntes][1]++;
    }
    const virouDominado = est.etapa === 'dominado' && etapaAntes !== 'dominado';
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
      resposta: r.resposta || null,
      pausado: !!r.pausado,
      julgado_por_voce: !!r.julgadoPorVoce,
      etapa_depois: est.etapa,
      fila: guardado.fila,
      distancia_fila: guardado.distancia
    };
    if (r.modo === 'multipla' && dinamicosAtuais.length) evento.dinamicos = dinamicosAtuais.slice();
    sessao.eventos.push(evento);

    ultimoRegistro = { id, est, evento, r };

    reordenarNovos();
    salvarProgresso();
    atualizarPlacar();
    talvezSincronizar();
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

    let html = '<div class="grade">' +
      /* a ordem faz pares na tela de duas colunas: o que já saiu e a chance
         de sair mais; as duas taxas de acerto; as filas e onde elas acabam */
      metrica(ids.length + '/' + CARDS.length, 'cards já vistos') +
      metrica(!temIneditos ? '—' : Math.round(100 * chances.ineditos) + '%',
              !temIneditos
                ? (presos ? 'frases esperando você dominar a palavra'
                          : 'todos os cards já apareceram')
                : 'chance de o próximo ser card novo') +
      metrica(pctDe(dePrimeira.length, estreados.length), 'acertou de primeira') +
      metrica(taxa + '%', 'acerto geral (' + t.respostas + ' respostas)') +
      /* é o equilíbrio que a admissão de inéditos persegue — vê-lo explica
         por que o card novo às vezes vem depressa e às vezes espera */
      /* É o alvo que a escolha de fila persegue — vê-lo explica por que o
         card novo às vezes vem depressa e às vezes rareia. */
      metrica(dir.esPt + ' · ' + dir.ptEs,
              'es → pt e pt → es (alvo ' + Motor.ALVO_FILA + ' · ' + Motor.ALVO_FILA + ')') +
      metrica(dominados, 'dominados nas duas direções') +
      '</div>';

    /* Por nível vem primeiro: é a tabela que responde «como estou indo», e
       as outras respondem «onde os cards estão». */
    html += tabelaNivel();
    html += graficoEtapas();
    html += tabelaEtapas();
    html += tabelaDominados();
    html += tabelaMemoria();
    html += calendarioEstudo();
    html += graficoRespostasDia();
    html += graficoNovosDia();
    html += mapaHorario();
    html += graficoVelocidade();
    html += graficoAteDominar();

    esconderDica();
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
    return '<h3>Percentual de acerto</h3><p class="legenda">“De primeira” é o que você já sabia; ' +
      '“depois”, o que fixou repetindo. A barra é o acerto geral do nível.' +
      (semEstreia ? ' <b>' + semEstreia + '</b> sem estreia anotada.' : '') +
      '</p>' +
      '<table class="nivel"><tr><th>Nível</th>' +
      ['Cards', 'De primeira', 'Depois', 'Geral'].map(r =>
        '<th class="vert"><span>' + r + '</span></th>').join('') +
      '<th></th></tr>' + linhas + '</table>';
  }

  /* ═══════════════ os gráficos do diário ═══════════════
     Tudo daqui para baixo sai de progresso.diario (um resumo por dia), de
     progresso.retencao e do «ateDominar» de cada card. Os desenhos são SVG
     de largura fixa que a tela encolhe; tocar num quadrado, numa barra ou
     num ponto mostra o número dele na dica. */

  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const RAMPA = ['var(--degrau-0)', 'var(--degrau-1)', 'var(--degrau-2)',
                 'var(--degrau-3)', 'var(--degrau-4)', 'var(--degrau-5)'];
  const LARGURA = 500;

  const milhar = n => n.toLocaleString('pt-BR');
  const diaMes = d => d.slice(8, 10) + '/' + d.slice(5, 7);
  const emSegundos = ms => (ms / 1000).toLocaleString('pt-BR',
    { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const comDica = texto => ' class="alvo" data-dica="' + escapar(texto) + '"';
  const figura = (w, h, miolo, rotulo, extra) =>
    '<svg class="grafico"' + (extra || '') + ' viewBox="0 0 ' + w + ' ' + h +
    '" role="img" aria-label="' + escapar(rotulo) + '">' + miolo + '</svg>';
  const linhaDeGrade = (x1, x2, y) =>
    '<line class="malha" x1="' + x1 + '" x2="' + x2 + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '"/>';
  /* Barra de topo arredondado e base reta, apoiada no eixo. */
  function barra(x, y, w, h, r) {
    if (h <= 0) return '';
    r = Math.min(r, w / 2, h);
    return 'M' + x.toFixed(1) + ',' + (y + h).toFixed(1) + 'V' + (y + r).toFixed(1) +
      'Q' + x.toFixed(1) + ',' + y.toFixed(1) + ' ' + (x + r).toFixed(1) + ',' + y.toFixed(1) +
      'H' + (x + w - r).toFixed(1) + 'Q' + (x + w).toFixed(1) + ',' + y.toFixed(1) + ' ' +
      (x + w).toFixed(1) + ',' + (y + r).toFixed(1) + 'V' + (y + h).toFixed(1) + 'Z';
  }
  /* Um passo redondo para a grade, com umas quatro linhas. */
  function passoRedondo(topo) {
    const bruto = Math.max(1, topo / 4);
    const ordem = Math.pow(10, Math.floor(Math.log10(bruto)));
    const f = bruto / ordem;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * ordem;
  }

  /* Meio-dia local: somar dias ao meio-dia nunca tropeça numa troca de
     horário de verão. */
  const meioDia = d => new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10), 12);

  /* Os dias do diário, de ponta a ponta até hoje, sem buraco: dia sem
     estudo entra com zero. */
  function diasDoDiario() {
    const diario = progresso.diario || {};
    const chaves = Object.keys(diario).filter(d => diario[d] && diario[d].n).sort();
    if (!chaves.length) return [];
    const hoje = Motor.diaLocal(new Date());
    const fim = chaves[chaves.length - 1] > hoje ? chaves[chaves.length - 1] : hoje;
    const dias = [];
    for (const t = meioDia(chaves[0]); ; t.setDate(t.getDate() + 1)) {
      const d = Motor.diaLocal(t);
      const g = diario[d];
      dias.push({ d, n: g ? g.n : 0, ok: g ? g.ok : 0, g });
      if (d >= fim || dias.length > 3700) break;
    }
    return dias;
  }

  /* ── o calendário ──
     Um quadrado por dia, semana a semana, das últimas dezoito. O tom de
     verde é o volume do dia, e o número está na dica. */
  function calendarioEstudo() {
    let dias = diasDoDiario();
    if (!dias.length) return '';
    const segundaDe = d => (meioDia(d).getDay() + 6) % 7;         // seg = 0
    const SEMANAS = 18;
    const corte = meioDia(dias[dias.length - 1].d);
    corte.setDate(corte.getDate() - segundaDe(dias[dias.length - 1].d) - 7 * (SEMANAS - 1));
    dias = dias.filter(x => meioDia(x.d) >= corte);
    const inicio = meioDia(dias[0].d);
    inicio.setDate(inicio.getDate() - segundaDe(dias[0].d));

    const maior = Math.max(...dias.map(x => x.n));
    const tam = 20, vao = 4, L = 32, T = 20;
    let m = '', colunas = 0, ultimoMes = -9;
    ['seg', 'qua', 'sex'].forEach((n, i) => {
      m += '<text x="' + (L - 6) + '" y="' + (T + 2 * i * (tam + vao) + tam / 2 + 4) +
        '" text-anchor="end">' + n + '</text>';
    });
    dias.forEach(x => {
      const col = Math.floor((meioDia(x.d) - inicio + 3600e3) / (7 * 864e5));
      colunas = Math.max(colunas, col + 1);
      const lin = segundaDe(x.d);
      const tom = x.n ? RAMPA[Math.min(5, Math.floor(5 * x.n / (maior + 1)) + 1)] : 'var(--fundo-3)';
      const nome = SEMANA[meioDia(x.d).getDay()] + ', ' + diaMes(x.d);
      m += '<rect' + comDica(nome + ' — ' + (x.n ? milhar(x.n) + (x.n === 1 ? ' resposta' : ' respostas') : 'sem estudo')) +
        ' x="' + (L + col * (tam + vao)) + '" y="' + (T + lin * (tam + vao)) +
        '" width="' + tam + '" height="' + tam + '" rx="5" fill="' + tom + '"/>';
      /* o mês no alto da coluna em que ele começa, se couber */
      const mes = +x.d.slice(5, 7) - 1;
      if ((x.d.slice(8) === '01' || x === dias[0]) && col - ultimoMes >= 2) {
        m += '<text x="' + (L + col * (tam + vao)) + '" y="' + (T - 7) + '">' + MESES[mes] + '</text>';
        ultimoMes = col;
      }
    });
    const W = L + colunas * (tam + vao), H = T + 7 * (tam + vao);
    return '<h3>Calendário de estudo</h3>' +
      '<div class="calendario" style="max-width:' + Math.round(W * 1.2) + 'px">' +
      figura(W, H, m, 'Respostas por dia, em calendário') + '</div>';
  }

  /* ── respostas por dia ──
     Os últimos sessenta dias em barras. A média é a dos sete dias antes de
     hoje: o de hoje ainda está pela metade. */
  function graficoRespostasDia() {
    const todos = diasDoDiario();
    if (todos.length < 2) return '';
    const antes = todos.slice(0, -1).slice(-7);
    const media = Math.round(antes.reduce((a, x) => a + x.n, 0) / antes.length);
    const recorde = todos.reduce((a, x) => x.n > a.n ? x : a);
    return '<h3>Respostas por dia</h3>' +
      '<p class="legenda">Nos últimos ' + (antes.length === 7 ? '7 dias' : antes.length + (antes.length === 1 ? ' dia' : ' dias')) +
      ', foram <b>' + milhar(media) + ' respostas por dia</b>, em média. O recorde é <b>' +
      milhar(recorde.n) + '</b>, em ' + diaMes(recorde.d) + '.</p>' +
      barrasPorDia(todos.slice(-60), 'var(--degrau-2)', 'resposta', 'respostas', 'Respostas por dia');
  }

  /* ── cards novos por dia ──
     O mesmo desenho, contando estreias: em quantos cards você pôs os olhos
     pela primeira vez em cada dia. Os dias são os do diário, para as duas
     figuras ficarem alinhadas uma embaixo da outra. */
  function graficoNovosDia() {
    const dias = diasDoDiario();
    if (dias.length < 2) return '';
    const porDia = {};
    Object.keys(progresso.cards).forEach(id => {
      const d = progresso.cards[id].estreia;
      if (d) porDia[d] = (porDia[d] || 0) + 1;
    });
    const todos = dias.map(x => ({ d: x.d, n: porDia[x.d] || 0 }));
    if (!todos.some(x => x.n)) return '';
    const antes = todos.slice(0, -1).slice(-7);
    const media = antes.reduce((a, x) => a + x.n, 0) / antes.length;
    const recorde = todos.reduce((a, x) => x.n > a.n ? x : a);
    const hoje = todos[todos.length - 1].n;
    return '<h3>Cards novos por dia</h3>' +
      '<p class="legenda">Nos últimos ' + (antes.length === 7 ? '7 dias' : antes.length + (antes.length === 1 ? ' dia' : ' dias')) +
      ', estrearam <b>' + media.toFixed(1).replace('.', ',') + ' cards por dia</b>, em média' +
      (hoje ? ' — hoje, <b>' + hoje + '</b> até agora' : '') + '. O recorde é <b>' +
      milhar(recorde.n) + '</b>, em ' + diaMes(recorde.d) + '.</p>' +
      barrasPorDia(todos.slice(-60), 'var(--serie-espt)', 'card novo', 'cards novos', 'Cards novos por dia');
  }

  function barrasPorDia(dias, cor, um, varios, titulo) {
    const W = LARGURA, L = 36, R = 6, T = 10, B = 196;
    const maior = Math.max(1, ...dias.map(x => x.n));
    const passo = passoRedondo(maior);
    const topo = Math.ceil(maior / passo) * passo;
    const y = v => B - (v / topo) * (B - T);
    const coluna = (W - L - R) / dias.length, larg = Math.max(2, coluna * 0.72);
    const cadaRotulo = Math.ceil(dias.length / 7);
    let m = '';
    for (let v = 0; v <= topo; v += passo) {
      m += linhaDeGrade(L, W - R, y(v)) +
        '<text x="' + (L - 6) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + milhar(v) + '</text>';
    }
    dias.forEach((x, i) => {
      const bx = L + i * coluna + (coluna - larg) / 2;
      if (x.n) {
        m += '<path' + comDica(SEMANA[meioDia(x.d).getDay()] + ', ' + diaMes(x.d) + ' — ' +
          milhar(x.n) + ' ' + (x.n === 1 ? um : varios)) +
          ' d="' + barra(bx, y(x.n), larg, B - y(x.n), 3) + '" fill="' + cor + '"/>';
      }
      if ((dias.length - 1 - i) % cadaRotulo === 0) {
        m += '<text x="' + (bx + larg / 2).toFixed(1) + '" y="' + (B + 22) + '" text-anchor="middle">' + diaMes(x.d) + '</text>';
      }
    });
    return figura(W, B + 30, m, titulo);
  }

  /* ── quando você estuda ──
     Dia da semana contra hora do dia, somando tudo o que o diário tem. Só
     entram as horas que já tiveram alguma resposta. */
  function mapaHorario() {
    const mapa = Array.from({ length: 7 }, () => new Array(24).fill(0));
    const diario = progresso.diario || {};
    Object.keys(diario).forEach(d => {
      const g = diario[d];
      if (!g || !Array.isArray(g.h)) return;
      const dia = meioDia(d).getDay();
      g.h.forEach((n, h) => { mapa[dia][h] += n || 0; });
    });
    const horas = [];
    for (let h = 0; h < 24; h++) if (mapa.some(l => l[h])) horas.push(h);
    if (!horas.length) return '';
    const h0 = horas[0], h1 = horas[horas.length - 1];
    const cols = h1 - h0 + 1, L = 36, T = 6, vao = 3;
    const cel = Math.min(28, Math.floor((LARGURA - L) / cols) - vao);
    const alta = Math.max(cel, 24);             // altura da linha: os nomes dos dias respiram
    const maior = Math.max(...mapa.map(l => Math.max(...l)));
    const ordem = [1, 2, 3, 4, 5, 6, 0];
    let m = '';
    ordem.forEach((d, lin) => {
      m += '<text x="' + (L - 6) + '" y="' + (T + lin * (alta + vao) + alta / 2 + 5) + '" text-anchor="end">' + SEMANA[d] + '</text>';
      for (let h = h0; h <= h1; h++) {
        const n = mapa[d][h];
        const tom = n ? RAMPA[Math.min(5, Math.floor(6 * n / (maior + 1)))] : 'var(--fundo-3)';
        m += '<rect' + comDica(SEMANA[d] + ', ' + h + 'h — ' + (n ? milhar(n) + (n === 1 ? ' resposta' : ' respostas') : 'nada')) +
          ' x="' + (L + (h - h0) * (cel + vao)) + '" y="' + (T + lin * (alta + vao)) +
          '" width="' + cel + '" height="' + alta + '" rx="4" fill="' + tom + '"/>';
      }
    });
    const cadaHora = cols > 12 ? 3 : 2;
    for (let h = h0; h <= h1; h++) {
      if ((h - h0) % cadaHora) continue;
      m += '<text x="' + (L + (h - h0) * (cel + vao) + cel / 2) + '" y="' + (T + 7 * (alta + vao) + 16) +
        '" text-anchor="middle">' + h + 'h</text>';
    }
    const porHora = new Array(24).fill(0), porDia = mapa.map(l => l.reduce((a, b) => a + b, 0));
    mapa.forEach(l => l.forEach((n, h) => { porHora[h] += n; }));
    const pico = porHora.indexOf(Math.max(...porHora));
    const diaPico = porDia.indexOf(Math.max(...porDia));
    const W = L + cols * (cel + vao), H = T + 7 * (alta + vao) + 22;
    return '<h3>Quando você estuda</h3>' +
      '<p class="legenda">O horário mais cheio é o das <b>' + pico + 'h</b>, e o dia da semana com mais respostas é <b>' +
      ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][diaPico] +
      '</b>. Quanto mais claro o quadrado, mais respostas.</p>' +
      figura(W, H, m, 'Respostas por dia da semana e hora');
  }

  /* ── a velocidade ──
     A mediana dos acertos de cada semana (de segunda a domingo),
     separando escrever de escolher entre cinco. Semana com menos de vinte
     acertos cronometrados fica de fora: é pouco para dizer um tempo. */
  function graficoVelocidade() {
    const diario = progresso.diario || {};
    const semanas = {};
    Object.keys(diario).forEach(d => {
      const g = diario[d];
      if (!g || !g.m || !g.e) return;
      const t = meioDia(d);
      t.setDate(t.getDate() - (t.getDay() + 6) % 7);
      const s = Motor.diaLocal(t);
      const x = semanas[s] || (semanas[s] = { s, m: {}, e: {}, n: 0 });
      ['m', 'e'].forEach(modo => Object.keys(g[modo]).forEach(k => {
        x[modo][k] = (x[modo][k] || 0) + g[modo][k];
        x.n += g[modo][k];
      }));
    });
    const lista = Object.keys(semanas).sort().map(k => semanas[k])
      .filter(x => x.n >= 20)
      .map(x => ({ s: x.s, escolhendo: Motor.medianaDasFaixas(x.m), escrevendo: Motor.medianaDasFaixas(x.e) }));
    if (lista.length < 2) return '';

    const W = LARGURA, L = 40, R = 60, T = 14, B = 186;
    const maior = Math.max(...lista.flatMap(x => [x.escolhendo || 0, x.escrevendo || 0])) / 1000;
    const passo = maior > 8 ? 4 : 2;
    const topo = Math.ceil((maior + 0.5) / passo) * passo;
    const x = i => L + (i / (lista.length - 1)) * (W - L - R);
    const y = ms => B - (ms / 1000 / topo) * (B - T);
    let m = '';
    for (let v = 0; v <= topo; v += passo) {
      m += linhaDeGrade(L, W - R, y(v * 1000)) +
        (v ? '<text x="' + (L - 6) + '" y="' + (y(v * 1000) + 4).toFixed(1) + '" text-anchor="end">' + v + ' s</text>' : '');
    }
    const SERIE = [['escrevendo', 'var(--serie-ptes)'], ['escolhendo', 'var(--serie-espt)']];
    const extremos = {};
    SERIE.forEach(([k, cor]) => {
      const pts = lista.map((s, i) => s[k] ? [x(i), y(s[k]), s] : null).filter(Boolean);
      if (!pts.length) return;
      extremos[k] = [pts[0][2][k], pts[pts.length - 1][2][k]];
      m += '<path d="M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L') +
        '" fill="none" stroke="' + cor + '" stroke-width="2.5" stroke-linejoin="round"/>';
      pts.forEach(p => {
        m += '<circle' + comDica('Semana de ' + diaMes(p[2].s) + ' — ' + k + ': ' + emSegundos(p[2][k]) + ' s') +
          ' cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="5.5" fill="' + cor + '" stroke="var(--fundo-2)" stroke-width="2"/>';
      });
      const u = pts[pts.length - 1];
      m += '<text class="forte" x="' + (u[0] + 11).toFixed(1) + '" y="' + (u[1] + 4).toFixed(1) + '">' + emSegundos(u[2][k]) + ' s</text>';
    });
    const cada = Math.ceil(lista.length / 7);
    lista.forEach((s, i) => {
      if ((lista.length - 1 - i) % cada) return;
      m += '<text x="' + x(i).toFixed(1) + '" y="' + (B + 22) + '" text-anchor="middle">' + diaMes(s.s) + '</text>';
    });
    const frase = (k, nome) => extremos[k]
      ? nome + ', foi de <b>' + emSegundos(extremos[k][0]) + ' s</b> para <b>' + emSegundos(extremos[k][1]) + ' s</b>' : '';
    const partes = [frase('escrevendo', 'Escrevendo'), frase('escolhendo', 'escolhendo entre cinco')].filter(Boolean);
    return '<h3>Velocidade a cada semana</h3>' +
      '<p class="legenda">Tempo típico de um acerto (a mediana), sem os tempos pausados. ' + partes.join('; ') + '.</p>' +
      '<div class="chaves">' +
      '<span class="chave"><i style="background:var(--serie-ptes)"></i>escrevendo</span>' +
      '<span class="chave"><i style="background:var(--serie-espt)"></i>escolhendo entre cinco</span></div>' +
      figura(W, B + 30, m, 'Tempo típico de um acerto por semana');
  }

  /* ── quantas respostas até dominar ──
     Conta as aparições do card nas duas direções até o primeiro domínio. O
     fim da escala junta tudo o que passou de quatorze. */
  function graficoAteDominar() {
    const TETO = 14;
    const valores = Object.keys(progresso.cards)
      .map(id => progresso.cards[id].ateDominar).filter(n => n > 0);
    if (valores.length < 5) return '';
    const hist = {};
    valores.forEach(n => { const k = Math.min(n, TETO); hist[k] = (hist[k] || 0) + 1; });
    const ks = [];
    for (let k = Math.min(...valores); k <= Math.min(TETO, Math.max(...valores)); k++) ks.push(k);
    const ordenados = valores.slice().sort((a, b) => a - b);
    const mediana = Math.min(TETO, ordenados[Math.floor((ordenados.length - 1) / 2)]);
    const ate5 = valores.filter(n => n <= 5).length;

    const W = LARGURA, L = 36, R = 6, T = 22, B = 186;
    const maior = Math.max(...ks.map(k => hist[k] || 0));
    const passo = passoRedondo(maior);
    const topo = Math.ceil(maior / passo) * passo;
    const y = v => B - (v / topo) * (B - T);
    const coluna = (W - L - R) / ks.length, larg = coluna * 0.74;
    let m = '';
    for (let v = 0; v <= topo; v += passo) {
      m += linhaDeGrade(L, W - R, y(v)) +
        '<text x="' + (L - 6) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + v + '</text>';
    }
    ks.forEach((k, i) => {
      const bx = L + i * coluna + (coluna - larg) / 2, n = hist[k] || 0;
      const rotulo = k === TETO ? TETO + '+' : String(k);
      if (n) {
        m += '<path' + comDica((k === TETO ? TETO + ' ou mais' : k) + ' respostas — ' + n + (n === 1 ? ' card' : ' cards')) +
          ' d="' + barra(bx, y(n), larg, B - y(n), 4) + '" fill="' + (k === mediana ? 'var(--degrau-4)' : 'var(--degrau-1)') + '"/>';
      }
      m += '<text x="' + (bx + larg / 2).toFixed(1) + '" y="' + (B + 22) + '" text-anchor="middle">' + rotulo + '</text>';
      if (k === mediana) {
        m += '<text class="forte" x="' + (bx + larg / 2).toFixed(1) + '" y="' + (y(n) - 7).toFixed(1) + '" text-anchor="middle">mediana</text>';
      }
    });
    return '<h3>Quantas respostas até dominar</h3>' +
      '<p class="legenda">Dos <b>' + valores.length + '</b> cards que já chegaram ao domínio, a metade precisou de <b>' +
      mediana + ' respostas ou menos</b>, e <b>' + pctDe(ate5, valores.length) + '</b> chegaram lá em até cinco.</p>' +
      figura(W, B + 30, m, 'Quantas respostas cada card levou até o domínio');
  }

  /* ── a memória depois da espera ──
     Cada revisão de dominado, pelo degrau em que o card estava: quanto se
     lembra depois de três dias sem vê-lo, de uma semana, e assim por diante. */
  function tabelaMemoria() {
    const ret = progresso.retencao || [];
    if (!ret.some(g => g && g[0])) return '';
    const linhas = Motor.DIAS_DOMINADO.map((dias, i) => {
      const g = ret[i] || [0, 0];
      const acerto = g[0] >= 5 ? pctDe(g[1], g[0]) : g[0] ? 'poucos dados' : '—';
      return '<tr' + (g[0] < 5 ? ' class="vago"' : '') + '><td>' + rotuloEspera(dias) + '</td>' +
        '<td class="num">' + (g[0] || '—') + '</td><td class="num">' + acerto + '</td></tr>';
    }).join('');
    return '<h3>A memória depois da espera</h3>' +
      '<table><tr><th>Espera</th><th class="num">Revisões</th><th class="num">Acerto</th></tr>' +
      linhas + '</table>';
  }

  /* ── a dica ──
     Uma só, fixa na tela, para todos os gráficos. Vale o toque parado, como
     no gráfico do caminho: o dedo que arrasta está rolando a página. Com
     mouse, basta passar por cima. */
  function esconderDica() {
    el.dica.hidden = true;
    const antes = el['painel-conteudo'].querySelector('.alvo.tocado');
    if (antes) antes.classList.remove('tocado');
  }

  function mostrarDica(alvo, px, py) {
    const antes = el['painel-conteudo'].querySelector('.alvo.tocado');
    if (antes && antes !== alvo) antes.classList.remove('tocado');
    alvo.classList.add('tocado');
    el.dica.textContent = alvo.getAttribute('data-dica');
    el.dica.hidden = false;
    const larg = el.dica.offsetWidth, alt = el.dica.offsetHeight;
    let esq = px - larg / 2, topo = py - alt - 14;
    esq = Math.max(8, Math.min(esq, window.innerWidth - larg - 8));
    if (topo < 8) topo = py + 18;
    el.dica.style.left = esq + 'px';
    el.dica.style.top = topo + 'px';
  }

  function ligarDicas() {
    const painel = el['painel-conteudo'];
    let inicio = null;
    painel.addEventListener('pointerdown', ev => { inicio = [ev.clientX, ev.clientY]; });
    painel.addEventListener('click', ev => {
      if (inicio && Math.hypot(ev.clientX - inicio[0], ev.clientY - inicio[1]) > 8) return;
      const alvo = ev.target.closest && ev.target.closest('[data-dica]');
      if (!alvo) { esconderDica(); return; }
      mostrarDica(alvo, ev.clientX, ev.clientY);
    });
    painel.addEventListener('pointermove', ev => {
      if (ev.pointerType !== 'mouse') return;
      const alvo = ev.target.closest && ev.target.closest('[data-dica]');
      if (alvo) mostrarDica(alvo, ev.clientX, ev.clientY);
      else if (!el.dica.hidden) esconderDica();
    });
    window.addEventListener('scroll', () => { if (!el.dica.hidden) esconderDica(); }, { passive: true });
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

  /* A lista mostra o masculino, que é a forma canônica; o feminino entra
     embaixo, junto da nota, para o card de gênero não parecer um card comum. */
  function linhaDaNota(c) {
    const bruto = PORID_FONTE[c.id];
    const outra = bruto && Motor.temVariante(bruto) ? Motor.formaDoCard(bruto, 1) : null;
    return [c.nota, outra ? '🔁 No feminino: «' + outra.es + '» — ' + outra.pt : '']
      .filter(Boolean).join('\n');
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
        (linhaDaNota(c) ? '<p class="card-linha-nota">' + escapar(linhaDaNota(c)) + '</p>' : '') +
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
         exatamente assim que 604 respostas viraram 25.

         Se a leitura falha, a subida não acontece. Antes ela seguia «com o
         que se tem», mas sem rede a escrita falha do mesmo jeito, e quando a
         leitura falhava por outro motivo — foi o caso do arquivo que passou
         de 1 MB — o que seguia era justamente a gravação por cima, sem
         mescla. As respostas ficam no navegador e sobem na próxima. */
      const arq = await GH.ler('progresso.json');
      if (arq) {
        let remoto;
        try { remoto = JSON.parse(arq.texto); }
        catch (e) { throw new Error('o progresso.json do GitHub veio ilegível; nada foi gravado por cima dele.'); }
        progresso = conciliarFila(mesclar(progresso, remoto));
        salvarProgresso();
        atualizarPlacar();
      }

      /* o sha da leitura vai junto: sem ele o escrever baixava o arquivo
         inteiro outra vez só para descobri-lo. E o arquivo vai sem
         indentação: ela era um terço do tamanho, e este é o arquivo que sobe
         e desce inteiro a cada três respostas. Quem o lê é programa — o app e
         o fonte/historico.js —, e para os olhos há o «Exportar arquivo». */
      await GH.escrever('progresso.json',
        JSON.stringify(progresso),
        'progresso — ' + agora,
        { keepalive: opcoes.keepalive, sha: arq ? arq.sha : undefined });

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
      /* Diário e retenção também: dia a dia, e degrau a degrau, fica o lado
         que viu mais respostas. */
      diario: juntarDiarios(local.diario, remoto.diario),
      retencao: (local.retencao || remoto.retencao) && Motor.DIAS_DOMINADO.map((_, i) => {
        const a = (local.retencao || [])[i] || [0, 0], b = (remoto.retencao || [])[i] || [0, 0];
        return (b[0] > a[0] ? b : a).slice();
      }),
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

  function juntarDiarios(a, b) {
    if (!a && !b) return undefined;
    const saida = {};
    new Set([...Object.keys(a || {}), ...Object.keys(b || {})]).forEach(d => {
      const x = (a || {})[d], y = (b || {})[d];
      saida[d] = !x ? y : !y ? x : (y.n > x.n ? y : x);
    });
    return saida;
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

  ligarDicas();

  document.querySelectorAll('.opcao-julgamento').forEach(b => {
    b.addEventListener('click', () => julgar(b.dataset.julgamento));
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
    /* O comentário se abre por cima do card, com o feedback à mostra: sem
       isto, o espaço digitado no texto não entrava e ainda avançava o card
       lá atrás, e «1» e «2» julgavam o «deu quase». */
    if (alvo === 'TEXTAREA' || alvo === 'SELECT') return;
    if (!el['comentario-fundo'].classList.contains('oculto')) return;

    if (!el['area-feedback'].classList.contains('oculto')) {
      if (!el['area-julgamento'].classList.contains('oculto')) {
        if ('12'.includes(e.key)) {
          e.preventDefault();
          document.querySelectorAll('.opcao-julgamento')[+e.key - 1].click();
        }
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); avancar(); }
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
