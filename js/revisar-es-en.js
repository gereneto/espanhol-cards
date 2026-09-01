/* ────────────────────────────────────────────────────────────────
   revisar-es-en.js — la pantalla de Yoisser.

   Una ficha a la vez: el español arriba, y debajo la traducción
   inglesa en campos editables. El portugués no aparece en ninguna
   parte, a propósito: así su juicio sobre el inglés es independiente
   de la traducción portuguesa que se está auditando.
   ──────────────────────────────────────────────────────────────── */
(function () {

  const CARDS = (window.CARDS_RAW && window.CARDS_RAW.cards) || [];
  const esc = Revisao.escapar;
  const $ = id => document.getElementById(id);

  const el = {};
  ['tela', 'contagem', 'barra', 'btn-anterior', 'btn-proximo', 'btn-pendente',
   'ir-para', 'btn-ir', 'config', 'det-config', 'resumo-config',
   'cfg-repo', 'cfg-token', 'btn-salvar-cfg', 'btn-enviar', 'btn-baixar',
   'btn-exportar', 'btn-importar', 'arquivo-importar', 'estado', 'instrucoes'
  ].forEach(id => { el[id] = $(id); });

  function estado(texto, classe) {
    el['estado'].textContent = texto;
    el['estado'].className = 'rev-estado ' + (classe || '');
  }

  const rev = Revisao.criar({
    chave: 'revisao-es-en',
    arquivo: 'revisao-es-en.json',
    revisor: 'yoisser',
    aoMudarEstado: estado,
    textoSemToken: 'Falta configurar el token de GitHub, ahí abajo.',
    textoEnviando: 'Subiendo…',
    textoEnviado: n => 'Guardado en GitHub: ' + n + ' fichas revisadas.',
    textoBaixado: n => 'Traído de GitHub: ' + n + ' fichas revisadas.',
    textoVazio: 'Todavía no hay nada guardado en GitHub.',
    textoFalhou: 'No se pudo:'
  });

  const fila = Revisao.fila(CARDS.map(c => c.id));
  const porId = {};
  CARDS.forEach(c => { porId[c.id] = c; });

  /* ── la ficha en pantalla ── */

  const ESTADOS = { aceito: 'aceptada', sugerido: 'con sugerencia', apagar: 'propuesta para eliminar' };

  function pintar() {
    const card = porId[fila.atual()];
    if (!card) { el['tela'].innerHTML = '<p class="rev-vazio">No hay fichas.</p>'; return; }

    const d = rev.decisao(card.id) || {};
    /* lo ya sugerido gana sobre lo original, para poder seguir corrigiendo */
    const en = d.en !== undefined ? d.en : card.en;
    const aceitas = d.aceitasEn !== undefined ? d.aceitasEn : (card.aceitasEn || []);
    const distr = d.distratoresEn !== undefined ? d.distratoresEn : (card.distratoresEn || []);
    const nota = d.notaEn !== undefined ? d.notaEn : card.notaEn;
    const formas = d.formasEsEn !== undefined ? d.formasEsEn : (card.formasEsEn || null);

    const tags = (card.tags || [])
      .map(t => '<span class="etiqueta suave">' + esc(Revisao.rotuloTag(t, 'es')) + '</span>')
      .join('');

    let html =
      '<div class="rev-card">' +
        '<div class="rev-meta">' +
          '<span class="rev-id">' + esc(card.id) + '</span>' +
          '<span class="etiqueta">' + (card.tipo === 'palavra' ? 'palabra' : 'frase') + '</span>' +
          '<span class="etiqueta suave">' + esc(card.nivel) + '</span>' +
          tags +
        '</div>' +

        '<div class="rev-origem">' +
          '<span class="rev-rotulo">Español · lo que se pregunta</span>' +
          '<div class="rev-es">' + esc(card.es) + '</div>' +
        '</div>' +

        '<div class="rev-secao">' +
          '<span class="rev-rotulo">La respuesta en inglés</span>' +
          campo('en', '', en) +
        '</div>' +

        '<div class="rev-secao">' +
          '<span class="rev-rotulo">Variantes también aceptadas</span>' +
          campo('aceitasEn', 'Una por línea, en minúsculas y sin puntuación.',
                aceitas.join('\n'), true) +
        '</div>' +

        '<div class="rev-secao">' +
          '<span class="rev-rotulo">Los cuatro distractores</span>' +
          '<div class="rev-distratores">' +
            [0, 1, 2, 3].map(i => campo('distratorEn' + i, '', distr[i] || '')).join('') +
          '</div>' +
        '</div>';

    if (formas) {
      html +=
        '<div class="rev-secao">' +
          '<span class="rev-rotulo">Cómo se llama cada forma verbal</span>' +
          Object.keys(formas).map(f =>
            campo('forma:' + f, esc(f), formas[f])).join('') +
        '</div>';
    }

    html +=
        '<div class="rev-secao">' +
          '<span class="rev-rotulo">La nota que lee el estudiante</span>' +
          campo('notaEn', '', nota, true) +
        '</div>' +

        '<div class="rev-secao">' +
          '<span class="rev-rotulo">Comentario para el autor</span>' +
          campo('comentario', 'Opcional: lo que quieras decir sobre esta ficha.',
                d.comentario || '', true) +
        '</div>' +

        '<div class="rev-decisao">' +
          '<button class="aceitar" data-decision="aceito" type="button">Aceptar todo</button>' +
          '<button class="sugerir" data-decision="sugerido" type="button">Guardar sugerencia</button>' +
          '<button class="apagar" data-decision="apagar" type="button">Proponer eliminar</button>' +
        '</div>' +

        (d.estado
          ? '<p class="rev-ja">Ya revisada: <span class="estado ' + d.estado + '">' +
            ESTADOS[d.estado] + '</span> <button type="button" id="btn-desfazer">deshacer</button></p>'
          : '') +
      '</div>';

    el['tela'].innerHTML = html;

    el['tela'].querySelectorAll('[data-decision]').forEach(b => {
      b.addEventListener('click', () => decidir(b.dataset.decision));
    });
    const desfazer = $('btn-desfazer');
    if (desfazer) desfazer.addEventListener('click', () => { rev.esquecer(card.id); pintar(); atualizarProgresso(); });

    /* marca en naranja el campo que se está tocando */
    el['tela'].querySelectorAll('[data-campo]').forEach(c => {
      c.addEventListener('input', () => c.closest('.rev-campo').classList.add('mexido'));
    });

    atualizarNav();
  }

  function campo(nome, ajuda, valor, multilinha) {
    valor = valor == null ? '' : String(valor);
    const caixa = valor.length > 90 || multilinha;
    /* a caixa nasce do tamanho do texto: a lista de variantes chega a ter
       dez linhas, e rolar dentro de um textarea de três é insuportável */
    const linhas = valor.split('\n').length;
    const rows = Math.min(12, Math.max(3, linhas + 1, Math.ceil(valor.length / 70) + 1));
    return '<div class="rev-campo">' +
      (ajuda ? '<label>' + ajuda + '</label>' : '') +
      (caixa
        ? '<textarea data-campo="' + esc(nome) + '" rows="' + rows + '">' + esc(valor) + '</textarea>'
        : '<input type="text" data-campo="' + esc(nome) + '" value="' + esc(valor) + '">') +
      '</div>';
  }

  function lerCampo(nome) {
    const c = el['tela'].querySelector('[data-campo="' + nome.replace(/"/g, '\\"') + '"]');
    return c ? c.value : '';
  }

  /* ── guardar la decisión ── */

  function decidir(estadoNovo) {
    const card = porId[fila.atual()];
    const registro = { estado: estadoNovo };

    const comentario = lerCampo('comentario').trim();
    if (comentario) registro.comentario = comentario;

    /* solo se guarda lo que de verdad cambió: así el archivo dice
       exactamente dónde metió mano el revisor */
    const en = lerCampo('en').trim();
    if (en && en !== card.en) registro.en = en;

    const aceitas = lerCampo('aceitasEn').split('\n').map(s => s.trim()).filter(Boolean);
    if (aceitas.join('|') !== (card.aceitasEn || []).join('|')) registro.aceitasEn = aceitas;

    const distr = [0, 1, 2, 3].map(i => lerCampo('distratorEn' + i).trim());
    if (distr.join('|') !== (card.distratoresEn || []).join('|')) registro.distratoresEn = distr;

    const nota = lerCampo('notaEn').trim();
    if (nota && nota !== card.notaEn) registro.notaEn = nota;

    if (card.formasEsEn) {
      const formas = {};
      let mudou = false;
      for (const f of Object.keys(card.formasEsEn)) {
        formas[f] = lerCampo('forma:' + f).trim();
        if (formas[f] !== card.formasEsEn[f]) mudou = true;
      }
      if (mudou) registro.formasEsEn = formas;
    }

    rev.decidir(card.id, registro);
    atualizarProgresso();

    /* avanzar sola a la siguiente sin revisar mantiene el ritmo */
    if (!fila.pularParaPendente(id => !!rev.decisao(id))) {
      pintar();
      estado('Ya has revisado las ' + CARDS.length + ' fichas. ¡Gracias!', 'ok');
      rev.enviar({ silencioso: true });
    } else {
      pintar();
    }
  }

  /* ── navegación y progreso ── */

  function atualizarProgresso() {
    const n = rev.decididos();
    el['contagem'].textContent = n + ' de ' + CARDS.length + ' revisadas';
    el['barra'].style.width = (CARDS.length ? (n / CARDS.length * 100) : 0) + '%';
  }

  function atualizarNav() {
    el['btn-anterior'].disabled = fila.indice() === 0;
    el['btn-proximo'].disabled = fila.indice() >= fila.total() - 1;
    el['ir-para'].max = fila.total();
    el['ir-para'].placeholder = (fila.indice() + 1) + ' / ' + fila.total();
  }

  el['btn-anterior'].addEventListener('click', () => { fila.anterior(); pintar(); });
  el['btn-proximo'].addEventListener('click', () => { fila.proximo(); pintar(); });
  el['btn-pendente'].addEventListener('click', () => {
    if (fila.pularParaPendente(id => !!rev.decisao(id))) pintar();
    else estado('No queda ninguna ficha sin revisar.', 'ok');
  });
  el['btn-ir'].addEventListener('click', () => {
    const n = parseInt(el['ir-para'].value, 10);
    if (n >= 1 && n <= fila.total()) { fila.ir(n - 1); pintar(); el['ir-para'].value = ''; }
  });
  el['ir-para'].addEventListener('keydown', e => { if (e.key === 'Enter') el['btn-ir'].click(); });

  /* ── configuración ── */

  function pintarConfig() {
    const c = GH_REV.cfg();
    el['cfg-repo'].value = c.repo || '';
    el['cfg-token'].value = c.token || '';
    const pronto = GH_REV.configurado();
    el['config'].dataset.pronto = pronto ? 'sim' : 'nao';
    el['resumo-config'].textContent = pronto
      ? 'Conectado a ' + c.repo + ' — pulsa para cambiarlo'
      : 'Conexión con GitHub — pulsa aquí para configurarla';
    if (!pronto) el['det-config'].open = true;
  }

  el['btn-salvar-cfg'].addEventListener('click', async () => {
    GH_REV.salvarCfg({
      repo: el['cfg-repo'].value.trim() || 'gereneto/espanhol-cards-revisao',
      token: el['cfg-token'].value.trim()
    });
    pintarConfig();
    if (GH_REV.configurado()) {
      estado('Guardado. Comprobando la conexión…', '');
      await rev.baixar();
      atualizarProgresso();
      pintar();
    }
  });

  el['btn-enviar'].addEventListener('click', () => rev.enviar());
  el['btn-baixar'].addEventListener('click', async () => {
    await rev.baixar();
    atualizarProgresso();
    pintar();
  });
  el['btn-exportar'].addEventListener('click', () => rev.exportar());
  el['btn-importar'].addEventListener('click', () => el['arquivo-importar'].click());
  el['arquivo-importar'].addEventListener('change', e => {
    if (e.target.files[0]) {
      rev.importar(e.target.files[0], () => { atualizarProgresso(); pintar(); });
    }
    e.target.value = '';
  });

  /* ── arranque ── */

  pintarConfig();
  atualizarProgresso();

  (async function () {
    if (GH_REV.configurado()) {
      await rev.baixar({ silencioso: true });
      atualizarProgresso();
    }
    /* empezar donde se quedó, no siempre por la primera */
    fila.pularParaPendente(id => !!rev.decisao(id), true);
    if (rev.decididos()) el['instrucoes'].open = false;
    pintar();
  })();

})();
