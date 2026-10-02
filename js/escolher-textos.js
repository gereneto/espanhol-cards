/* ────────────────────────────────────────────────────────────────
   escolher-textos.js — a tela de aprovar texto.

   Um texto por vez: o original à esquerda, a tradução à direita, e o
   que pesa a favor e contra embaixo. Três botões — entra, não entra,
   fico em dúvida — e um campo de recado, que é onde mora a parte útil:
   «entra, mas só as duas primeiras estrofes» vale mais que o botão.

   A decisão NÃO cria nada. O texto aprovado vira depois um arquivo em
   fonte/textos/, escrito à mão, com os cards de cada verso: a aprovação
   é o começo do trabalho, e não o fim dele.
   ──────────────────────────────────────────────────────────────── */
(function () {

  const CANDIDATOS = (window.CANDIDATOS && window.CANDIDATOS.es && window.CANDIDATOS.es.candidatos) || [];
  const esc = Revisao.escapar;
  const $ = id => document.getElementById(id);

  const el = {};
  ['tela', 'contagem', 'barra', 'btn-anterior', 'btn-proximo', 'btn-pendente',
   'config', 'det-config', 'resumo-config', 'cfg-repo', 'cfg-token',
   'btn-salvar-cfg', 'btn-enviar', 'btn-baixar', 'btn-exportar', 'btn-importar',
   'arquivo-importar', 'estado', 'instrucoes'
  ].forEach(id => { el[id] = $(id); });

  function estado(texto, classe) {
    el['estado'].textContent = texto;
    el['estado'].className = 'rev-estado ' + (classe || '');
  }

  /* Grava no repositório de DADOS, com o progresso do estudo — isto é
     decisão do Gere sobre o próprio baralho, e não revisão de terceiro. */
  const rev = Revisao.criar({
    chave: 'textos-escolhidos',
    arquivo: 'textos-escolhidos.json',
    revisor: 'gere',
    gh: window.GH,
    aoMudarEstado: estado,
    textoSemToken: 'Sem token do GitHub — está tudo gravado só neste navegador.',
    textoEnviando: 'Enviando…',
    textoEnviado: n => 'Gravado no GitHub: ' + n + ' textos decididos.',
    textoBaixado: n => 'Trazido do GitHub: ' + n + ' textos decididos.',
    textoVazio: 'Ainda não há nada gravado no GitHub.',
    textoFalhou: 'Não deu:'
  });

  const fila = Revisao.fila(CANDIDATOS.map(c => c.id));
  const porId = {};
  CANDIDATOS.forEach(c => { porId[c.id] = c; });

  const ROTULO = { entra: 'entra', fora: 'não entra', duvida: 'em dúvida' };

  /* ── a ficha ── */

  function pintar() {
    const c = porId[fila.atual()];
    if (!c) { el['tela'].innerHTML = '<p class="rev-vazio">Nenhum texto candidato.</p>'; return; }
    const d = rev.decisao(c.id) || {};

    const linhas = c.linhas.map(par =>
      '<tr><td class="esc-es">' + esc(par[0]) + '</td>' +
      '<td class="esc-pt">' + esc(par[1]) + '</td></tr>').join('');

    const selo = d.escolha
      ? '<span class="esc-selo esc-selo-' + d.escolha + '">' + ROTULO[d.escolha] + '</span>'
      : '';

    el['tela'].innerHTML =
      '<article class="rev-card">' +
        '<div class="rev-meta">' +
          '<span class="rev-id">' + esc(c.id) + '</span>' +
          '<span class="esc-tipo">' + esc(c.tipo) + '</span>' +
          '<span class="esc-tipo">' + c.linhas.length + ' linhas</span>' +
          '<span class="esc-tipo">custo ~' + c.custo.estimativa + ' palavras</span>' +
          selo +
        '</div>' +

        '<h2 class="esc-titulo">' + esc(c.titulo) + '</h2>' +
        '<p class="esc-autoria">' + esc(c.autor) + ' · <em>' + esc(c.obra) + '</em> · ' + c.ano + '</p>' +

        '<table class="esc-texto"><thead><tr>' +
          '<th>espanhol</th><th>português</th>' +
        '</tr></thead><tbody>' + linhas + '</tbody></table>' +

        '<div class="esc-razoes">' +
          '<div class="esc-pro"><h3>A favor</h3><p>' + esc(c.porque) + '</p></div>' +
          '<div class="esc-contra"><h3>Contra</h3><p>' + esc(c.cuidado) + '</p></div>' +
        '</div>' +

        '<p class="esc-dominio"><strong>Domínio público:</strong> ' + esc(c.dominio) + '</p>' +
        '<p class="esc-dominio"><strong>A conferir:</strong> escrevi o texto de cabeça. ' +
          'Antes de virar card, bato com uma edição impressa — a pontuação, sobretudo, ' +
          'varia de edição para edição.</p>' +

        '<details class="esc-custo"><summary>As ~' + c.custo.estimativa +
          ' palavras que o baralho ainda não tem</summary><p>' +
          esc(c.custo.palavras.join(', ')) + '</p></details>' +

        '<label class="esc-recado">Recado para mim' +
          '<textarea id="recado" rows="3" placeholder="o que mudar, que trecho recortar, com que outro texto combinar…">' +
          esc(d.recado || '') + '</textarea></label>' +

        '<div class="esc-botoes">' +
          '<button type="button" class="esc-entra" data-escolha="entra">Entra</button>' +
          '<button type="button" class="esc-fora" data-escolha="fora">Não entra</button>' +
          '<button type="button" class="esc-duvida" data-escolha="duvida">Fico em dúvida</button>' +
          (d.escolha ? '<button type="button" class="esc-limpar" id="btn-limpar">apagar a decisão</button>' : '') +
        '</div>' +
      '</article>';

    el['tela'].querySelectorAll('[data-escolha]').forEach(b => {
      b.addEventListener('click', () => decidir(c.id, b.dataset.escolha));
    });
    const limpar = $('btn-limpar');
    if (limpar) {
      limpar.addEventListener('click', () => {
        rev.esquecer(c.id);
        atualizarProgresso();
        pintar();
      });
    }
  }

  function decidir(id, escolha) {
    const recado = $('recado');
    rev.decidir(id, { escolha: escolha, recado: (recado && recado.value.trim()) || '' });
    atualizarProgresso();
    if (!fila.pularParaPendente(x => !!rev.decisao(x), false)) fila.proximo();
    pintar();
  }

  function atualizarProgresso() {
    const n = rev.decididos();
    const total = CANDIDATOS.length;
    const dentro = CANDIDATOS.filter(c => (rev.decisao(c.id) || {}).escolha === 'entra').length;
    el['contagem'].textContent = n + ' de ' + total + ' decididos · ' + dentro + ' para entrar';
    el['barra'].style.width = total ? Math.round(100 * n / total) + '%' : '0%';
  }

  /* ── navegação ── */

  el['btn-anterior'].addEventListener('click', () => { fila.anterior(); pintar(); });
  el['btn-proximo'].addEventListener('click', () => { fila.proximo(); pintar(); });
  el['btn-pendente'].addEventListener('click', () => {
    if (!fila.pularParaPendente(id => !!rev.decisao(id), false)) {
      estado('Todos os textos já têm decisão.', '');
    }
    pintar();
  });

  /* ── a conexão ── */

  function pintarConfig() {
    const c = GH.cfg();
    el['cfg-repo'].value = c.repo;
    el['cfg-token'].value = c.token;
    const pronto = GH.configurado();
    el['config'].dataset.pronto = pronto ? 'sim' : 'nao';
    el['resumo-config'].textContent = pronto
      ? 'Conectado ao GitHub — clique para ver'
      : 'Conexão com o GitHub — clique para configurar';
    if (!pronto) el['det-config'].open = true;
  }

  el['btn-salvar-cfg'].addEventListener('click', async () => {
    GH.salvarCfg({
      repo: el['cfg-repo'].value.trim() || 'gereneto/espanhol-cards-dados',
      token: el['cfg-token'].value.trim()
    });
    pintarConfig();
    if (GH.configurado()) {
      estado('Salvo. Conferindo a conexão…', '');
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
    if (GH.configurado()) {
      await rev.baixar({ silencioso: true });
      atualizarProgresso();
    }
    fila.pularParaPendente(id => !!rev.decisao(id), true);
    if (rev.decididos()) el['instrucoes'].open = false;
    pintar();
  })();

})();
