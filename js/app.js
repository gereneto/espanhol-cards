/* ────────────────────────────────────────────────────────────────
   app.js — telas, fluxo de estudo e sincronização.
   ──────────────────────────────────────────────────────────────── */
(function () {

  const CHAVE_PROGRESSO = 'espanhol-cards:progresso';
  const SINCRONIZAR_A_CADA = 8;   // respostas

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
    'area-feedback', 'veredito', 'resposta-certa', 'nota', 'medidas',
    'area-conhecia', 'area-julgamento', 'resposta-dada', 'texto-dado',
    'area-contestar', 'btn-contestar', 'aviso-contestado',
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
  let respostasDesdeSync = 0;
  let sincronizando = false;

  function progressoVazio() {
    return {
      versao: 1,
      atualizado_em: new Date().toISOString(),
      fila: [],                                // em circulação: só o que já apareceu
      ineditos: Motor.montarFila(CARDS),       // baralho à parte, ainda fechado
      desdeInedito: 0,                         // respostas desde o último card novo
      cards: {},
      totais: { respostas: 0, acertos: 0, sessoes: 0 }
    };
  }

  function carregarProgresso() {
    let p = null;
    try { p = JSON.parse(localStorage.getItem(CHAVE_PROGRESSO) || 'null'); } catch (e) { p = null; }
    if (!p || !Array.isArray(p.fila)) p = progressoVazio();
    return conciliarFila(p);
  }

  /* Mantém os dois baralhos coerentes com o que existe: a fila em circulação
     só com o que já apareceu, o baralho de inéditos com todo o resto. */
  function conciliarFila(p) {
    p.cards = p.cards || {};
    p.ineditos = Array.isArray(p.ineditos) ? p.ineditos : [];
    if (typeof p.desdeInedito !== 'number') p.desdeInedito = 0;

    /* Card apagado do baralho deixa para trás o estado dele. Sem varrer, ele
       continuaria contando em "cards já vistos" e nas tabelas do painel, e
       viajaria para sempre no progresso.json. A guarda do CARDS.length evita
       o desastre de apagar tudo se o data/cards.js não tiver carregado. */
    if (CARDS.length) {
      Object.keys(p.cards).forEach(id => { if (!PORID[id]) delete p.cards[id]; });
    }

    const visto = id => !!p.cards[id];

    /* Migração e faxina numa passada só. Até aqui havia uma fila única, com
       inéditos misturados aos que já circulam; quem tinha progresso salvo
       chega com ela. Os inéditos saem da fila e vão para o seu próprio
       baralho, que é o que resolve a seca de cards novos. */
    const migrados = p.fila.filter(id => PORID[id] && !visto(id));
    p.fila = p.fila.filter(id => PORID[id] && visto(id));
    p.ineditos = p.ineditos.filter(id => PORID[id] && !visto(id));

    const jaTenho = new Set(p.fila.concat(p.ineditos));
    const entram = migrados.filter(id => !jaTenho.has(id))
      .concat(CARDS.filter(c => !jaTenho.has(c.id) && !visto(c.id) && !migrados.includes(c.id)).map(c => c.id));
    if (entram.length) p.ineditos = p.ineditos.concat(entram);

    ordenarIneditos(p);
    return p;
  }

  /* O baralho de inéditos é ordenado pelo desempenho: sai primeiro o nível
     que você ainda não domina mas já consegue acompanhar. Como agora ele é
     uma lista à parte, basta reordená-la — não há posição alheia a respeitar. */
  function ordenarIneditos(p) {
    if (!p.ineditos || p.ineditos.length < 2) return;
    const pesos = Motor.pesosDeNivel(Motor.dominioPorNivel(CARDS, p.cards));
    p.ineditos = Motor.ordenarNovos(p.ineditos, pesos, PORID);
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

  /* Tira o próximo card de um dos dois baralhos. O de inéditos tem a
     preferência sempre que couber material novo (ver Motor.cabeInedito);
     fora isso, sai o primeiro da fila em circulação cuja data já venceu. */
  function tirarProximoId() {
    const cabe = Motor.cabeInedito(progresso.cards, progresso.desdeInedito, progresso.ineditos.length);
    if (cabe || !progresso.fila.length) {
      if (progresso.ineditos.length) {
        progresso.desdeInedito = 0;
        return progresso.ineditos.shift();
      }
    }
    if (!progresso.fila.length) return null;

    /* O card dominado espera a data dele. Pego o primeiro da fila que já
       venceu, sem remexer na ordem dos outros. Se todos estiverem de molho
       — baralho pequeno, ou você estudou tudo hoje — vai o de data mais
       próxima: ficar sem card nenhum seria pior do que adiantar um. */
    const agora = new Date().toISOString();
    let i = progresso.fila.findIndex(id => !Motor.esperando(progresso.cards[id], agora));
    if (i < 0) {
      i = 0;
      progresso.fila.forEach((id, k) => {
        const atual = progresso.cards[progresso.fila[i]], outro = progresso.cards[id];
        if (outro && atual && outro.voltaEm < atual.voltaEm) i = k;
      });
    }
    progresso.desdeInedito++;
    return progresso.fila.splice(i, 1)[0];
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
    pausou = false;

    el['meta-tipo'].textContent = cardAtual.tipo;
    el['meta-modo'].textContent = modoAtual === 'multipla' ? 'múltipla escolha' : 'escreva a resposta';
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

    el['area-feedback'].classList.add('oculto');
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
    const texto = desistiu ? '' : el.entrada.value;
    if (!desistiu && !texto.trim()) { el.entrada.focus(); return; }

    const conferencia = desistiu ? 'errado' : Motor.conferir(cardAtual, texto, direcaoAtual);
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
    const forma = r.modo === 'escrita' && !r.desistiu
      ? Motor.formaReconhecida(cardAtual, r.resposta, r.direcao) : null;
    if (forma) {
      el['texto-dado'].innerHTML = escapar(forma.forma) +
        ' <span class="forma-rotulo">' + escapar(forma.rotulo) + '</span>';
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
      if (!forma) el['resposta-dada'].classList.add('oculto');
      el['area-julgamento'].classList.add('oculto');
      el['btn-proximo'].classList.remove('oculto');
      mostrarVeredito(r);
      registrar(r);
      mostrarPerguntaConhecia(r);
      mostrarContestar(r);
    }

    el['area-feedback'].classList.remove('oculto');
    el['btn-proximo'].focus({ preventScroll: true });
    el.veredito.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function mostrarVeredito(r) {
    el.veredito.className = 'veredito ' + (r.acertou ? 'ok' : 'erro');
    el.veredito.textContent = r.desistiu ? 'Sem problema — fica para a próxima'
      : r.julgadoPorVoce ? (r.acertou ? 'Certo — você contou como acerto' : 'Contado como erro')
      : r.acertou ? 'Certo!'
      : 'Não foi dessa vez';
  }

  /* Perguntar "já conhecia?" só faz sentido quando você acerta de primeira:
     errando, a resposta é óbvia; se o card já apareceu antes, você o conhece
     do próprio app e não do seu repertório. */
  function mostrarPerguntaConhecia(r) {
    el['area-conhecia'].classList.toggle('oculto', !(estreiaPendente && r.acertou));
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
  }
  /* Grava a resposta e devolve o card para a fila. */
  function registrar(r) {
    const id = cardAtual.id;
    const est = progresso.cards[id] || (progresso.cards[id] = Motor.estadoInicial(id));
    Motor.registrar(est, r);

    const dist = Motor.distanciaNaFila(est, r);
    progresso.fila.splice(Math.min(dist, progresso.fila.length), 0, id);

    progresso.totais.respostas++;
    if (r.acertou) progresso.totais.acertos++;

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
      distancia_fila: dist
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

    const i = progresso.fila.indexOf(id);
    if (i >= 0) progresso.fila.splice(i, 1);
    const dist = Motor.distanciaNaFila(est, r);
    progresso.fila.splice(Math.min(dist, progresso.fila.length), 0, id);
    evento.distancia_fila = dist;

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

  function talvezSincronizar() {
    if (++respostasDesdeSync >= SINCRONIZAR_A_CADA && GH.cfg().auto && GH.configurado()) {
      respostasDesdeSync = 0;
      sincronizar({ silencioso: true });
    }
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
    const sabiaMesmo = dePrimeira.filter(id => progresso.cards[id].conhecia !== 'nao');
    const deduziu = dePrimeira.length - sabiaMesmo.length;

    const etapaDe = id => progresso.cards[id].etapa;
    const dominados = ids.filter(id => etapaDe(id) === 'dominado').length;
    const dir = Motor.contarDirecoes(progresso.cards);

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
      metrica(dir.esPt + ' · ' + dir.ptEs, 'es → pt e pt → es') +
      metrica(dominados, 'dominados nas duas direções') +
      metrica('~' + Motor.esperaPorInedito(progresso.cards), 'respostas por card novo') +
      '</div>';

    if (estreados.length) {
      html += '<p class="legenda">Das <b>' + estreados.length + '</b> estreias, você acertou <b>' +
        dePrimeira.length + '</b> — sendo <b>' + sabiaMesmo.length + '</b> que já conhecia e <b>' +
        deduziu + '</b> que deduziu ou chutou. Restam <b>' + (CARDS.length - ids.length) +
        '</b> cards que ainda não apareceram.</p>';
    }

    html += tabelaEtapas();
    html += tabelaNivel();
    html += tabelaModo();
    html += tabelaPor('Por tipo', c => c.tipo, ['palavra', 'frase']);

    el['painel-conteudo'].innerHTML = html;
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
      if (!e || !e.vistas) { x.novo++; return; }
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
      '<p class="legenda">Cada card atravessa <b>es → pt</b>, onde você reconhece, ' +
      'e depois <b>pt → es</b>, onde produz o espanhol — que é bem mais difícil. ' +
      'Dominado não é aposentadoria: o card continua voltando, só que cada vez ' +
      'mais espaçado. O card novo entra em <b>es → pt</b>, e é por isso que ' +
      'admiti-los é a única torneira que enche esse lado.</p>' +
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
  function tabelaNivel() {
    const g = {};
    Motor.NIVEIS.forEach(n => (g[n] = { vistos: 0, estreias: 0, certasEstreia: 0, depois: 0, certasDepois: 0 }));

    Object.keys(progresso.cards).forEach(id => {
      const c = PORID[id]; if (!c) return;
      const e = progresso.cards[id];
      const x = g[c.nivel];
      if (!e.vistas) return;
      x.vistos++;
      if (e.primeiraCerta !== undefined) {
        x.estreias++;
        if (e.primeiraCerta) x.certasEstreia++;
      }
      /* tudo o que veio depois da estreia */
      x.depois += Math.max(0, e.vistas - 1);
      x.certasDepois += Math.max(0, e.acertos - (e.primeiraCerta ? 1 : 0));
    });

    const linhas = Motor.NIVEIS.filter(n => g[n].vistos).map(n => {
      const x = g[n];
      const pct = x.estreias ? Math.round(100 * x.certasEstreia / x.estreias) : 0;
      return '<tr><td>' + n + '</td>' +
        '<td class="num">' + x.vistos + '</td>' +
        '<td class="num">' + pctDe(x.certasEstreia, x.estreias) + '</td>' +
        '<td class="num">' + pctDe(x.certasDepois, x.depois) + '</td>' +
        '<td><div class="barra"><i style="width:' + pct + '%"></i></div></td></tr>';
    }).join('');

    if (!linhas) return '';
    return '<h3>Por nível</h3><p class="legenda">A coluna “de primeira” é o que você já sabia; ' +
      '“depois” é o quanto está fixando com a repetição.</p>' +
      '<table><tr><th>Nível</th><th class="num">Cards</th><th class="num">De primeira</th>' +
      '<th class="num">Depois</th><th></th></tr>' + linhas + '</table>';
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
        '<td><div class="barra"><i style="width:' + pct + '%"></i></div></td></tr>';
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
    if (!e || !e.vistas) return { chave: 'novo', rotulo: 'ainda não apareceu' };
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

      return '<div class="card-linha ' + (s.chave === 'dominado' ? 'dominado' : s.chave !== 'novo' ? 'visto' : '') + '">' +
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
      await GH.escrever('progresso.json',
        JSON.stringify(progresso, null, 1),
        'progresso — ' + agora,
        { keepalive: opcoes.keepalive });

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

      await GH.escrever('resumo.md', gerarResumo(), 'resumo — ' + agora,
        { keepalive: opcoes.keepalive });

      statusSync('Tudo sincronizado às ' + new Date().toLocaleTimeString('pt-BR'), 'ok');
    } catch (e) {
      statusSync('Falhou: ' + e.message, 'erro');
    } finally {
      sincronizando = false;
    }
  }

  async function baixar() {
    if (!GH.configurado()) { statusSync('Informe o repositório e o token primeiro.', 'erro'); return; }
    statusSync('Baixando…');
    try {
      const arq = await GH.ler('progresso.json');
      if (!arq) { statusSync('Ainda não há progresso gravado no GitHub.', 'erro'); return; }
      const remoto = JSON.parse(arq.texto);
      progresso = mesclar(progresso, remoto);
      salvarProgresso();
      atualizarPlacar();
      statusSync('Progresso do GitHub incorporado.', 'ok');
    } catch (e) {
      statusSync('Falhou: ' + e.message, 'erro');
    }
  }

  /* Mescla card a card, ficando com a versão de mais respostas. */
  function mesclar(local, remoto) {
    const saida = {
      versao: 1,
      atualizado_em: new Date().toISOString(),
      fila: (local.fila && local.fila.length) ? local.fila : (remoto.fila || []),
      ineditos: (local.ineditos && local.ineditos.length) ? local.ineditos : (remoto.ineditos || []),
      desdeInedito: Math.max(local.desdeInedito || 0, (remoto || {}).desdeInedito || 0),
      contestacoes: juntarContestacoes(local.contestacoes, remoto.contestacoes),
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
      const baralho = progresso.cards[id] ? progresso.fila : progresso.ineditos;
      if (baralho.indexOf(id) < 0) { baralho.unshift(id); salvarProgresso(); }
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
  el['btn-enviar'].addEventListener('click', () => sincronizar({}));
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
        sincronizar({ silencioso: true, keepalive: true });
      }
    }
  });
  window.addEventListener('pagehide', () => {
    if (GH.cfg().auto && GH.configurado() && sessao.eventos.length) {
      sincronizar({ silencioso: true, keepalive: true });
    }
  });

  /* ═══════════════ arranque ═══════════════ */

  montarFiltros();

  progresso.totais.sessoes = (progresso.totais.sessoes || 0) + 1;
  salvarProgresso();
  atualizarPlacar();
  statusSync(GH.configurado() ? 'Sincronização ligada.' : 'Sem token — dados só neste navegador.');
  mostrar('tela-inicio');

  window.Espanhol = { progresso: () => progresso, sessao: () => sessao, resumo: gerarResumo };
})();
