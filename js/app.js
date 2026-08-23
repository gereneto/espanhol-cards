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
    'placar', 'btn-painel', 'btn-config', 'resumo-inicio', 'btn-comecar',
    'tela-inicio', 'tela-card', 'tela-painel', 'tela-config',
    'meta-tipo', 'meta-modo', 'meta-nivel', 'enunciado', 'termo',
    'area-multipla', 'area-escrita', 'entrada', 'btn-responder', 'btn-nao-sei',
    'area-feedback', 'veredito', 'resposta-certa', 'nota', 'medidas',
    'area-conhecia', 'btn-proximo', 'painel-conteudo',
    'cfg-repo', 'cfg-token', 'cfg-auto', 'btn-salvar-cfg', 'btn-enviar',
    'btn-baixar', 'estado-sync', 'btn-exportar', 'btn-importar',
    'arquivo-importar', 'btn-zerar', 'rodape-sync'
  ].forEach(id => { el[id] = document.getElementById(id); });

  /* ═══════════════ estado ═══════════════ */

  let progresso = carregarProgresso();
  let sessao = novaSessao();
  let cardAtual = null;
  let modoAtual = null;
  let inicioResposta = 0;
  let pausou = false;
  let respostaPendente = null;
  let conheciaEscolhida = null;
  let respostasDesdeSync = 0;
  let sincronizando = false;

  function progressoVazio() {
    return {
      versao: 1,
      atualizado_em: new Date().toISOString(),
      fila: Motor.montarFila(CARDS),
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

  /* Garante que a fila contenha exatamente os cards existentes:
     entram os novos, saem os que deixaram de existir. */
  function conciliarFila(p) {
    p.cards = p.cards || {};
    const naFila = new Set(p.fila);
    p.fila = p.fila.filter(id => PORID[id]);
    const faltando = CARDS.filter(c => !naFila.has(c.id)).map(c => c.id);
    if (faltando.length) {
      // cards novos entram intercalados pelo nível, logo à frente
      const ordem = Motor.montarFila(faltando.map(id => PORID[id]));
      p.fila = p.fila.concat(ordem);
    }
    return p;
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

  function mostrar(tela) {
    ['tela-inicio', 'tela-card', 'tela-painel', 'tela-config']
      .forEach(t => el[t].classList.toggle('oculto', t !== tela));
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

  function proximoCard() {
    if (!progresso.fila.length) progresso.fila = Motor.montarFila(CARDS);

    const id = progresso.fila.shift();
    cardAtual = PORID[id];
    if (!cardAtual) return proximoCard();

    const est = estadoDe(id);
    modoAtual = Motor.modoDe(est);
    respostaPendente = null;
    conheciaEscolhida = null;
    pausou = false;

    el['meta-tipo'].textContent = cardAtual.tipo;
    el['meta-modo'].textContent = modoAtual === 'multipla' ? 'múltipla escolha' : 'escreva a resposta';
    el['meta-nivel'].classList.add('oculto');
    el['meta-nivel'].textContent = cardAtual.nivel;

    el.enunciado.textContent = cardAtual.tipo === 'palavra'
      ? 'O que significa esta palavra?'
      : 'O que quer dizer esta frase?';
    el.termo.textContent = cardAtual.es;
    el.termo.classList.toggle('frase', cardAtual.tipo === 'frase');

    el['area-feedback'].classList.add('oculto');
    el['area-conhecia'].classList.add('oculto');

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
    const opcoes = Motor.alternativas(cardAtual);
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
    const acertou = texto === cardAtual.pt;

    [...el['area-multipla'].children].forEach(b => {
      b.disabled = true;
      const rotulo = b.lastChild.textContent;
      if (rotulo === cardAtual.pt) b.classList.add('certa');
      else if (b === botao && !acertou) b.classList.add('errada');
    });

    concluir({ modo: 'multipla', acertou, quase: false, ms, resposta: texto });
  }

  function responderEscrita(desistiu) {
    if (respostaPendente) return;
    const ms = tempoGasto();
    const texto = desistiu ? '' : el.entrada.value;
    if (!desistiu && !texto.trim()) { el.entrada.focus(); return; }

    const conferencia = desistiu ? 'errado' : Motor.conferir(cardAtual, texto);
    el.entrada.disabled = true;
    el['btn-responder'].disabled = true;
    el['btn-nao-sei'].disabled = true;

    concluir({
      modo: 'escrita',
      acertou: conferencia !== 'errado',
      quase: conferencia === 'quase',
      ms, resposta: texto, desistiu: !!desistiu
    });
  }

  /* Mostra o feedback. O registro só acontece em avancar(),
     porque a resposta sobre "já conhecia" ainda pode mudar a fila. */
  function concluir(r) {
    r.velocidade = Motor.velocidade(cardAtual, r.modo, r.ms);
    r.pausado = pausou;
    respostaPendente = r;

    const est = estadoDe(cardAtual.id);
    const primeiraVez = !est || est.vistas === 0;

    el.veredito.className = 'veredito ' + (r.quase ? 'quase' : r.acertou ? 'ok' : 'erro');
    el.veredito.textContent = r.desistiu ? 'Sem problema — fica para a próxima'
      : r.quase ? 'Quase! Aceitei como certa'
      : r.acertou ? 'Certo!'
      : 'Não foi dessa vez';

    el['resposta-certa'].textContent = cardAtual.pt;
    el.nota.textContent = cardAtual.nota || '';
    el.nota.classList.toggle('oculto', !cardAtual.nota);
    el['meta-nivel'].classList.remove('oculto');

    const rotuloVel = { rapido: 'rápido', medio: 'no tempo médio', lento: 'devagar' }[r.velocidade];
    el.medidas.innerHTML =
      '<span class="medida"><b>' + (r.ms / 1000).toFixed(1) + 's</b> — ' + rotuloVel + '</span>' +
      '<span class="medida">nível <b>' + cardAtual.nivel + '</b></span>' +
      (cardAtual.tags || []).map(t => '<span class="medida">' + escapar(t) + '</span>').join('') +
      (r.pausado ? '<span class="medida">tempo não contado (você saiu da aba)</span>' : '');

    // a pergunta sobre conhecimento prévio só faz sentido na estreia do card
    el['area-conhecia'].classList.toggle('oculto', !primeiraVez);
    [...document.querySelectorAll('.opcao-conhecia')].forEach(b => {
      b.classList.remove('ativo');
      b.style.borderColor = '';
      b.style.color = '';
    });

    el['area-feedback'].classList.remove('oculto');
    el['btn-proximo'].focus({ preventScroll: true });
    el.veredito.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function avancar() {
    if (respostaPendente) {
      const r = respostaPendente;
      r.conhecia = conheciaEscolhida;

      const id = cardAtual.id;
      const est = progresso.cards[id] || (progresso.cards[id] = Motor.estadoInicial(id));
      Motor.registrar(est, r);

      // devolve o card para a fila, mais adiante
      const dist = Motor.distanciaNaFila(est, r);
      progresso.fila.splice(Math.min(dist, progresso.fila.length), 0, id);

      progresso.totais.respostas++;
      if (r.acertou) progresso.totais.acertos++;

      sessao.eventos.push({
        em: new Date().toISOString(),
        card: id,
        es: cardAtual.es,
        tipo: cardAtual.tipo,
        nivel: cardAtual.nivel,
        tags: cardAtual.tags,
        modo: r.modo,
        acertou: r.acertou,
        quase: !!r.quase,
        desistiu: !!r.desistiu,
        ms: r.ms,
        velocidade: r.velocidade,
        conhecia: r.conhecia || null,
        resposta: r.resposta || null,
        pausado: !!r.pausado,
        etapa_depois: est.etapa,
        distancia_fila: dist
      });

      respostaPendente = null;
      salvarProgresso();
      atualizarPlacar();

      if (++respostasDesdeSync >= SINCRONIZAR_A_CADA && GH.cfg().auto && GH.configurado()) {
        respostasDesdeSync = 0;
        sincronizar({ silencioso: true });
      }
    }
    proximoCard();
  }

  /* ═══════════════ painel ═══════════════ */

  function abrirPainel() {
    const ids = Object.keys(progresso.cards);
    const t = progresso.totais;
    const taxa = t.respostas ? Math.round(100 * t.acertos / t.respostas) : 0;

    const tempos = [];
    ids.forEach(id => (progresso.cards[id].historico || []).forEach(h => {
      if (!h.pausado) tempos.push(h.ms);
    }));
    const mediaSeg = tempos.length
      ? (tempos.reduce((a, b) => a + b, 0) / tempos.length / 1000).toFixed(1) : '—';

    const consolidados = ids.filter(id => progresso.cards[id].etapa === 'consolidado').length;
    const escrevendo = ids.filter(id => progresso.cards[id].etapa === 'escrita').length;

    let html = '<div class="grade">' +
      metrica(ids.length + '/' + CARDS.length, 'cards já vistos') +
      metrica(taxa + '%', 'acerto geral') +
      metrica(mediaSeg + 's', 'tempo médio') +
      metrica(consolidados, 'dominados') +
      metrica(escrevendo, 'na fase de escrita') +
      metrica(t.respostas, 'respostas no total') +
      '</div>';

    html += tabelaPor('Por nível', c => c.nivel, Motor.NIVEIS);
    html += tabelaPor('Por tipo', c => c.tipo, ['palavra', 'frase']);

    // cards mais difíceis
    const dificeis = ids
      .map(id => ({ id, e: progresso.cards[id] }))
      .filter(x => x.e.erros > 0)
      .sort((a, b) => (b.e.erros - a.e.erros) || (b.e.vistas - a.e.vistas))
      .slice(0, 12);

    if (dificeis.length) {
      html += '<h3>Onde você mais tropeça</h3><table><tr>' +
        '<th>Card</th><th>Significado</th><th class="num">Erros</th><th class="num">Vistas</th></tr>' +
        dificeis.map(x => {
          const c = PORID[x.id];
          return '<tr><td>' + escapar(c.es) + '</td><td>' + escapar(c.pt) +
            '</td><td class="num">' + x.e.erros + '</td><td class="num">' + x.e.vistas + '</td></tr>';
        }).join('') + '</table>';
    }

    el['painel-conteudo'].innerHTML = html;
    mostrar('tela-painel');
  }

  function metrica(valor, rotulo) {
    return '<div class="metrica"><div class="valor">' + valor +
      '</div><div class="rotulo">' + rotulo + '</div></div>';
  }

  function tabelaPor(titulo, chave, ordem) {
    const grupos = {};
    Object.keys(progresso.cards).forEach(id => {
      const c = PORID[id]; if (!c) return;
      const k = chave(c);
      const g = grupos[k] || (grupos[k] = { certas: 0, total: 0, cards: 0 });
      g.cards++;
      (progresso.cards[id].historico || []).forEach(h => {
        g.total++; if (h.acertou) g.certas++;
      });
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
    L.push('- Dominados (3 acertos seguidos escrevendo): **' +
      ids.filter(id => progresso.cards[id].etapa === 'consolidado').length + '**');
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
  el['btn-responder'].addEventListener('click', () => responderEscrita(false));
  el['btn-nao-sei'].addEventListener('click', () => responderEscrita(true));
  el.entrada.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.keyCode === 13) { e.preventDefault(); responderEscrita(false); }
  });

  document.querySelectorAll('.opcao-conhecia').forEach(b => {
    b.addEventListener('click', () => {
      conheciaEscolhida = b.dataset.conhecia;
      document.querySelectorAll('.opcao-conhecia').forEach(o => {
        o.style.borderColor = '';
        o.style.color = '';
      });
      b.style.borderColor = 'var(--acento)';
      b.style.color = 'var(--acento)';
    });
  });

  el['btn-painel'].addEventListener('click', abrirPainel);
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

  progresso.totais.sessoes = (progresso.totais.sessoes || 0) + 1;
  salvarProgresso();
  atualizarPlacar();
  statusSync(GH.configurado() ? 'Sincronização ligada.' : 'Sem token — dados só neste navegador.');
  mostrar('tela-inicio');

  window.Espanhol = { progresso: () => progresso, sessao: () => sessao, resumo: gerarResumo };
})();
