/* ────────────────────────────────────────────────────────────────
   revisar-en-pt.js — a tela do Gere.

   Só entram os cards que o Yoisser já decidiu. Cada um mostra, de
   cima para baixo: o espanhol, o inglês já validado (com o que ele
   mudou marcado ao lado do original), e então o português a julgar.
   ──────────────────────────────────────────────────────────────── */
(function () {

  const CARDS = (window.CARDS_RAW && window.CARDS_RAW.cards) || [];
  const esc = Revisao.escapar;
  const $ = id => document.getElementById(id);

  const el = {};
  ['tela', 'contagem', 'barra', 'btn-anterior', 'btn-proximo', 'btn-pendente',
   'ir-para', 'btn-ir', 'filtro-situacao', 'filtro-tipo', 'filtro-nivel',
   'config', 'det-config', 'resumo-config', 'cfg-repo', 'cfg-token',
   'btn-salvar-cfg', 'btn-enviar', 'btn-baixar', 'btn-exportar', 'btn-importar',
   'arquivo-importar', 'estado', 'instrucoes'
  ].forEach(id => { el[id] = $(id); });

  const porId = {};
  CARDS.forEach(c => { porId[c.id] = c; });

  /* o que o Yoisser decidiu; fica vazio até baixar do repositório */
  let esEn = { cartas: {} };

  function estado(texto, classe) {
    el['estado'].textContent = texto;
    el['estado'].className = 'rev-estado ' + (classe || '');
  }

  const rev = Revisao.criar({
    chave: 'revisao-en-pt',
    arquivo: 'revisao-en-pt.json',
    revisor: 'gere',
    aoMudarEstado: estado,
    textoSemToken: 'Informe o repositório e o token primeiro.',
    textoEnviando: 'Enviando…',
    textoEnviado: n => 'Gravado no GitHub: ' + n + ' cards marcados.',
    textoBaixado: n => 'Trazido do GitHub: ' + n + ' cards marcados.',
    textoVazio: 'Ainda não há nada gravado no GitHub.',
    textoFalhou: 'Falhou:'
  });

  const fila = Revisao.fila([]);

  /* ── a versão do inglês que vale: a do Yoisser quando ele mexeu ── */

  function inglesValidado(card) {
    const d = esEn.cartas[card.id] || {};
    return {
      en:      d.en      !== undefined ? d.en      : card.en,
      aceitas: d.aceitasEn    !== undefined ? d.aceitasEn    : (card.aceitasEn || []),
      distr:   d.distratoresEn !== undefined ? d.distratoresEn : (card.distratoresEn || []),
      nota:    d.notaEn  !== undefined ? d.notaEn  : card.notaEn,
      mexeu:   ['en', 'aceitasEn', 'distratoresEn', 'notaEn', 'formasEsEn'].some(k => d[k] !== undefined),
      estado:  d.estado,
      comentario: d.comentario
    };
  }

  /* ── quais cards entram na fila ── */

  function montarFila() {
    const situacao = el['filtro-situacao'].value;
    const tipo = el['filtro-tipo'].value;
    const nivel = el['filtro-nivel'].value;

    const ids = CARDS.filter(c => {
      const d = esEn.cartas[c.id];
      if (!d) return false;                     // o Yoisser ainda não chegou nele
      if (tipo && c.tipo !== tipo) return false;
      if (nivel && c.nivel !== nivel) return false;

      const meu = rev.decisao(c.id);
      if (situacao === 'pendentes')  return !meu;
      if (situacao === 'alterados')  return inglesValidado(c).mexeu;
      if (situacao === 'apagar')     return d.estado === 'apagar';
      if (situacao === 'comentario') return !!d.comentario;
      if (situacao === 'rever')      return meu && meu.estado === 'rever';
      return true;
    }).map(c => c.id);

    fila.trocar(ids);
  }

  /* ── a tela ── */

  const ROTULO = { ok: 'ok', rever: 'a rever', apagar: 'a apagar' };
  const ROTULO_ES = { aceito: 'aceitou tudo', sugerido: 'sugeriu mudanças', apagar: 'quer excluir' };

  function pintar() {
    if (!fila.total()) {
      el['tela'].innerHTML = '<p class="rev-vazio">' + (
        Object.keys(esEn.cartas).length
          ? 'Nenhum card com esses filtros.'
          : 'Nada do Yoisser ainda.<br>Configure o token aí embaixo, ou importe o arquivo <code>revisao-es-en.json</code> que ele te mandar.'
      ) + '</p>';
      atualizarNav();
      return;
    }

    const card = porId[fila.atual()];
    const ing = inglesValidado(card);
    const meu = rev.decisao(card.id) || {};

    const tags = (card.tags || [])
      .map(t => '<span class="etiqueta suave">' + esc(Revisao.rotuloTag(t, 'pt')) + '</span>')
      .join('');

    let html =
      '<div class="rev-card">' +
        '<div class="rev-meta">' +
          '<span class="rev-id">' + esc(card.id) + '</span>' +
          '<span class="etiqueta">' + esc(card.tipo) + '</span>' +
          '<span class="etiqueta suave">' + esc(card.nivel) + '</span>' +
          tags +
          (ing.mexeu ? '<span class="rev-selo-alterado">Yoisser alterou</span>' : '') +
          (ing.estado === 'apagar' ? '<span class="rev-selo-apagar">Yoisser quer excluir</span>' : '') +
        '</div>' +

        '<div class="rev-origem">' +
          '<span class="rev-rotulo">Espanhol</span>' +
          '<div class="rev-es">' + esc(card.es) + '</div>' +
        '</div>';

    if (ing.comentario) {
      html +=
        '<div class="rev-comentario-revisor">' +
          '<span class="rev-rotulo">O que o Yoisser escreveu</span>' +
          '<p>' + esc(ing.comentario) + '</p>' +
        '</div>';
    }

    /* ── o inglês validado, a régua ── */
    html +=
      '<div class="rev-secao">' +
        '<span class="rev-rotulo">Inglês — conferido pelo Yoisser</span>' +
        bloco('Resposta', ing.en, card.en, ing.mexeu) +
        bloco('Nota', ing.nota, card.notaEn, ing.mexeu, true) +
        blocoLista('Distratores', ing.distr, card.distratoresEn, ing.mexeu) +
      '</div>';

    /* ── o português, o que se julga ── */
    html +=
      '<div class="rev-secao">' +
        '<span class="rev-rotulo">Português — o que você está julgando</span>' +
        '<div class="rev-leitura">' +
          '<span class="rev-rotulo">Resposta</span>' +
          '<div class="rev-valor">' + esc(card.pt) + '</div>' +
          ((card.aceitas || []).length
            ? '<ul class="rev-lista">' + card.aceitas.map(a => '<li>' + esc(a) + '</li>').join('') + '</ul>'
            : '') +
        '</div>' +
        '<div class="rev-leitura">' +
          '<span class="rev-rotulo">Distratores</span>' +
          '<ul class="rev-lista">' +
            (card.distratores || []).map(d => '<li>' + esc(d) + '</li>').join('') +
          '</ul>' +
        '</div>' +
        '<div class="rev-leitura">' +
          '<span class="rev-rotulo">Nota</span>' +
          '<p class="rev-nota">' + esc(card.nota) + '</p>' +
        '</div>' +
      '</div>';

    html +=
        '<div class="rev-secao">' +
          '<span class="rev-rotulo">Observação</span>' +
          '<div class="rev-campo">' +
            '<textarea data-campo="observacao" rows="3" ' +
              'maxlength="' + Motor.LIMITES.comentario + '" ' +
              'placeholder="o que está errado, ou o que você quer conferir depois">' +
              esc(meu.observacao || '') + '</textarea>' +
          '</div>' +
        '</div>' +

        '<div class="rev-decisao">' +
          '<button class="aceitar" data-decision="ok" type="button">Português ok</button>' +
          '<button class="sugerir" data-decision="rever" type="button">Rever</button>' +
          '<button class="apagar" data-decision="apagar" type="button">Apagar o card</button>' +
        '</div>' +

        (meu.estado
          ? '<p class="rev-ja">Já marcado: <span class="estado ' + meu.estado + '">' +
            ROTULO[meu.estado] + '</span>' +
            (ing.estado ? ' · Yoisser: ' + ROTULO_ES[ing.estado] : '') +
            ' <button type="button" id="btn-desfazer">desfazer</button>' +
            (meu.base_en && meu.base_en !== ing.en
              ? ' <span class="rev-selo-alterado">o inglês mudou depois</span>' : '') +
            '</p>'
          : '') +
      '</div>';

    el['tela'].innerHTML = html;

    el['tela'].querySelectorAll('[data-decision]').forEach(b => {
      b.addEventListener('click', () => marcar(b.dataset.decision));
    });
    const desfazer = $('btn-desfazer');
    if (desfazer) desfazer.addEventListener('click', () => {
      rev.esquecer(card.id); montarFila(); pintar(); atualizarProgresso();
    });

    atualizarNav();
  }

  /* Um valor do lado inglês. Quando o Yoisser mudou, mostra o original
     riscado embaixo — é a única forma de eu ver o que ele corrigiu. */
  function bloco(rotulo, valor, original, mexeu, nota) {
    const mudou = mexeu && valor !== original;
    return '<div class="rev-leitura' + (mudou ? ' rev-alterado' : '') + '">' +
      '<span class="rev-rotulo">' + esc(rotulo) + '</span>' +
      (nota
        ? '<p class="rev-nota">' + esc(valor) + '</p>'
        : '<div class="rev-valor">' + esc(valor) + '</div>') +
      (mudou ? '<p class="rev-antes">' + esc(original) + '</p>' : '') +
      '</div>';
  }

  function blocoLista(rotulo, lista, original, mexeu) {
    lista = lista || [];
    original = original || [];
    const mudou = mexeu && lista.join('|') !== original.join('|');
    /* Só interessa o que saiu. Repetir os quatro velhos quando ele trocou
       um esconde justamente a troca que eu preciso ver. */
    const sairam = original.filter(d => !lista.includes(d));
    return '<div class="rev-leitura' + (mudou ? ' rev-alterado' : '') + '">' +
      '<span class="rev-rotulo">' + esc(rotulo) + '</span>' +
      '<ul class="rev-lista">' + lista.map(d =>
        '<li>' + esc(d) + (original.length && !original.includes(d) ? ' <span class="rev-selo-alterado">novo</span>' : '') + '</li>'
      ).join('') + '</ul>' +
      (mudou && sairam.length ? '<p class="rev-antes">' + esc(sairam.join(' · ')) + '</p>' : '') +
      '</div>';
  }

  function marcar(estadoNovo) {
    const card = porId[fila.atual()];
    const campo = el['tela'].querySelector('[data-campo="observacao"]');
    const registro = { estado: estadoNovo, base_en: inglesValidado(card).en };
    const obs = campo ? Motor.cortar(campo.value, Motor.LIMITES.comentario).trim() : '';
    if (obs) registro.observacao = obs;

    rev.decidir(card.id, registro);
    atualizarProgresso();

    /* com o filtro em "pendentes" o card sai da fila sozinho; então
       remonta antes de andar, para o índice não escorregar */
    const eraPendentes = el['filtro-situacao'].value === 'pendentes';
    const indice = fila.indice();
    montarFila();
    if (eraPendentes) fila.ir(Math.min(indice, fila.total() - 1));
    else if (!fila.pularParaPendente(id => !!rev.decisao(id))) fila.proximo();
    pintar();
  }

  /* ── navegação e progresso ── */

  function atualizarProgresso() {
    const total = Object.keys(esEn.cartas).length;
    const n = CARDS.filter(c => esEn.cartas[c.id] && rev.decisao(c.id)).length;
    el['contagem'].textContent = total
      ? n + ' de ' + total + ' marcados'
      : 'nada do Yoisser ainda';
    el['barra'].style.width = (total ? (n / total * 100) : 0) + '%';
  }

  function atualizarNav() {
    el['btn-anterior'].disabled = fila.indice() === 0 || !fila.total();
    el['btn-proximo'].disabled = !fila.total() || fila.indice() >= fila.total() - 1;
    el['ir-para'].max = fila.total();
    el['ir-para'].placeholder = fila.total() ? (fila.indice() + 1) + ' / ' + fila.total() : 'nº';
  }

  el['btn-anterior'].addEventListener('click', () => { fila.anterior(); pintar(); });
  el['btn-proximo'].addEventListener('click', () => { fila.proximo(); pintar(); });
  el['btn-pendente'].addEventListener('click', () => {
    if (fila.pularParaPendente(id => !!rev.decisao(id))) pintar();
    else estado('Não sobrou card sem marca com esses filtros.', 'ok');
  });
  el['btn-ir'].addEventListener('click', () => {
    const n = parseInt(el['ir-para'].value, 10);
    if (n >= 1 && n <= fila.total()) { fila.ir(n - 1); pintar(); el['ir-para'].value = ''; }
  });
  el['ir-para'].addEventListener('keydown', e => { if (e.key === 'Enter') el['btn-ir'].click(); });

  ['filtro-situacao', 'filtro-tipo', 'filtro-nivel'].forEach(id => {
    el[id].addEventListener('change', () => { montarFila(); fila.ir(0); pintar(); });
  });

  /* ── configuração ── */

  function pintarConfig() {
    const c = GH_REV.cfg();
    el['cfg-repo'].value = c.repo || '';
    el['cfg-token'].value = c.token || '';
    const pronto = GH_REV.configurado();
    el['config'].dataset.pronto = pronto ? 'sim' : 'nao';
    el['resumo-config'].textContent = pronto
      ? 'Ligado a ' + c.repo + ' — clique para mudar'
      : 'Conexão com o GitHub — clique para configurar';
    if (!pronto) el['det-config'].open = true;
  }

  async function carregarDoYoisser(op) {
    op = op || {};
    try {
      const lido = await rev.lerOutro('revisao-es-en.json');
      if (lido && lido.cartas) {
        esEn = lido;
        if (!op.silencioso) {
          estado('Revisão do Yoisser: ' + Object.keys(esEn.cartas).length + ' cards.', 'ok');
        }
      } else if (!op.silencioso) {
        estado('O Yoisser ainda não gravou nada no repositório.', '');
      }
    } catch (e) {
      estado('Não consegui ler a revisão do Yoisser: ' + e.message, 'erro');
    }
  }

  el['btn-salvar-cfg'].addEventListener('click', async () => {
    GH_REV.salvarCfg({
      repo: el['cfg-repo'].value.trim() || 'gereneto/espanhol-cards-revisao',
      token: el['cfg-token'].value.trim()
    });
    pintarConfig();
    if (GH_REV.configurado()) await recarregar();
  });

  el['btn-enviar'].addEventListener('click', () => rev.enviar());
  el['btn-baixar'].addEventListener('click', () => recarregar());
  el['btn-exportar'].addEventListener('click', () => rev.exportar());
  el['btn-importar'].addEventListener('click', () => el['arquivo-importar'].click());

  /* O arquivo importado tanto pode ser a minha marcação quanto a revisão
     que o Yoisser exportou à mão — o campo "revisor" diz qual é. */
  el['arquivo-importar'].addEventListener('change', e => {
    const arquivo = e.target.files[0];
    e.target.value = '';
    if (!arquivo) return;

    const leitor = new FileReader();
    leitor.onload = () => {
      let lido;
      try { lido = JSON.parse(leitor.result); } catch (err) { lido = null; }
      if (!lido || !lido.cartas) { estado('Arquivo sem "cartas".', 'erro'); return; }

      if (lido.revisor === 'yoisser') {
        esEn = lido;
        estado('Revisão do Yoisser carregada: ' + Object.keys(esEn.cartas).length + ' cards.', 'ok');
        montarFila(); atualizarProgresso(); pintar();
      } else {
        rev.importar(arquivo, () => { montarFila(); atualizarProgresso(); pintar(); });
      }
    };
    leitor.readAsText(arquivo);
  });

  async function recarregar() {
    await carregarDoYoisser();
    await rev.baixar({ silencioso: true });
    montarFila();
    atualizarProgresso();
    pintar();
  }

  /* ── arranque ── */

  [...new Set(CARDS.map(c => c.nivel))].sort().forEach(n => {
    const o = document.createElement('option');
    o.value = o.textContent = n;
    el['filtro-nivel'].appendChild(o);
  });

  pintarConfig();
  montarFila();
  atualizarProgresso();
  pintar();

  (async function () {
    if (GH_REV.configurado()) {
      await carregarDoYoisser({ silencioso: true });
      await rev.baixar({ silencioso: true });
      montarFila();
      atualizarProgresso();
      if (rev.decididos()) el['instrucoes'].open = false;
      pintar();
    }
  })();

})();
