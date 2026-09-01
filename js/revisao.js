/* ────────────────────────────────────────────────────────────────
   revisao.js — o que as duas páginas de revisão têm em comum.

   Guarda as decisões no localStorage a cada clique e envia para o
   repositório gereneto/espanhol-cards-revisao de tempos em tempos,
   pela GH_REV (ver js/github.js). Nada se perde se a rede cair: o
   navegador tem sempre a cópia mais nova.

   Os dois arquivos gravados lá:
     revisao-es-en.json  — o que o Yoisser decidiu sobre o inglês
     revisao-en-pt.json  — o que o Gere decidiu sobre o português
   ──────────────────────────────────────────────────────────────── */
window.Revisao = (function () {

  const ENVIAR_A_CADA = 8;   // decisões

  function criar(opcoes) {
    const CHAVE = 'espanhol-cards:' + opcoes.chave;
    const ARQUIVO = opcoes.arquivo;
    const REVISOR = opcoes.revisor;
    const aoMudarEstado = opcoes.aoMudarEstado || function () {};

    let dados = carregar();
    let desdeEnvio = 0;
    let enviando = false;

    function vazio() {
      return { atualizado_em: new Date().toISOString(), revisor: REVISOR, cartas: {} };
    }

    function carregar() {
      try {
        const bruto = JSON.parse(localStorage.getItem(CHAVE) || 'null');
        if (bruto && bruto.cartas) return bruto;
      } catch (e) { /* localStorage corrompido: recomeça */ }
      return vazio();
    }

    function salvarLocal() {
      dados.atualizado_em = new Date().toISOString();
      try {
        localStorage.setItem(CHAVE, JSON.stringify(dados));
      } catch (e) {
        aoMudarEstado('O navegador recusou gravar. Exporte o arquivo agora.', 'erro');
      }
    }

    /* ── as decisões ── */

    function decisao(id) { return dados.cartas[id] || null; }
    function decididos() { return Object.keys(dados.cartas).length; }
    function tudo() { return dados; }

    function decidir(id, registro) {
      dados.cartas[id] = Object.assign({}, registro, { em: new Date().toISOString() });
      salvarLocal();
      if (++desdeEnvio >= ENVIAR_A_CADA) { desdeEnvio = 0; enviar({ silencioso: true }); }
    }

    function esquecer(id) {
      delete dados.cartas[id];
      salvarLocal();
    }

    /* ── o repositório ── */

    async function enviar(op) {
      op = op || {};
      if (enviando) return;
      if (!GH_REV.configurado()) {
        if (!op.silencioso) aoMudarEstado(opcoes.textoSemToken, 'erro');
        return;
      }
      enviando = true;
      if (!op.silencioso) aoMudarEstado(opcoes.textoEnviando, '');
      try {
        await GH_REV.escrever(
          ARQUIVO,
          JSON.stringify(dados, null, 1),
          REVISOR + ' — ' + dados.atualizado_em,
          { keepalive: !!op.keepalive });
        aoMudarEstado(opcoes.textoEnviado(decididos()), 'ok');
      } catch (e) {
        aoMudarEstado(opcoes.textoFalhou + ' ' + e.message, 'erro');
      } finally {
        enviando = false;
      }
    }

    /* Traz o que está no repositório e junta com o daqui, ficando com a
       versão mais recente de cada card — assim dá para revisar de mais de
       um aparelho sem uma sessão apagar a outra. */
    async function baixar(op) {
      op = op || {};
      if (!GH_REV.configurado()) {
        if (!op.silencioso) aoMudarEstado(opcoes.textoSemToken, 'erro');
        return false;
      }
      try {
        const arq = await GH_REV.ler(ARQUIVO);
        if (!arq) { if (!op.silencioso) aoMudarEstado(opcoes.textoVazio, ''); return false; }
        const remoto = JSON.parse(arq.texto);
        for (const [id, r] of Object.entries(remoto.cartas || {})) {
          const meu = dados.cartas[id];
          if (!meu || (r.em || '') > (meu.em || '')) dados.cartas[id] = r;
        }
        salvarLocal();
        if (!op.silencioso) aoMudarEstado(opcoes.textoBaixado(decididos()), 'ok');
        return true;
      } catch (e) {
        aoMudarEstado(opcoes.textoFalhou + ' ' + e.message, 'erro');
        return false;
      }
    }

    /* Lê um arquivo de revisão do repositório sem mexer no estado local —
       é assim que a página do Gere enxerga o que o Yoisser já decidiu. */
    async function lerOutro(arquivo) {
      if (!GH_REV.configurado()) return null;
      const arq = await GH_REV.ler(arquivo);
      return arq ? JSON.parse(arq.texto) : null;
    }

    /* ── saída de emergência: o arquivo na mão ── */

    function exportar() {
      const blob = new Blob([JSON.stringify(dados, null, 1)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = ARQUIVO;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function importar(arquivo, aoTerminar) {
      const leitor = new FileReader();
      leitor.onload = () => {
        try {
          const lido = JSON.parse(leitor.result);
          if (!lido || !lido.cartas) throw new Error('arquivo sem "cartas"');
          for (const [id, r] of Object.entries(lido.cartas)) {
            const meu = dados.cartas[id];
            if (!meu || (r.em || '') > (meu.em || '')) dados.cartas[id] = r;
          }
          salvarLocal();
          aoMudarEstado(opcoes.textoBaixado(decididos()), 'ok');
          aoTerminar();
        } catch (e) {
          aoMudarEstado(opcoes.textoFalhou + ' ' + e.message, 'erro');
        }
      };
      leitor.readAsText(arquivo);
    }

    /* Nada de perder decisões ao fechar a aba: o mesmo padrão do app. */
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && desdeEnvio) { desdeEnvio = 0; enviar({ silencioso: true, keepalive: true }); }
    });
    window.addEventListener('pagehide', () => {
      if (desdeEnvio) { desdeEnvio = 0; enviar({ silencioso: true, keepalive: true }); }
    });

    return { decisao, decidir, esquecer, decididos, tudo, enviar, baixar, lerOutro, exportar, importar };
  }

  /* ── navegação por uma fila de cards ── */

  function fila(ids) {
    let i = 0;
    return {
      atual: () => ids[i],
      indice: () => i,
      total: () => ids.length,
      ir: (n) => { i = Math.max(0, Math.min(ids.length - 1, n)); },
      anterior: () => { if (i > 0) i--; },
      proximo: () => { if (i < ids.length - 1) i++; },
      /* Primeiro card ainda sem decisão, a partir do atual e dando a volta.
         O botão da tela quer o PRÓXIMO pendente (quem clica já está vendo
         este); o arranque quer incluir o atual, para abrir exatamente onde
         se parou. Daí o incluirAtual. */
      pularParaPendente: (temDecisao, incluirAtual) => {
        for (let n = incluirAtual ? 0 : 1; n <= ids.length; n++) {
          const k = (i + n) % ids.length;
          if (!temDecisao(ids[k])) { i = k; return true; }
        }
        return false;
      },
      trocar: (novos) => { ids = novos; i = Math.min(i, Math.max(0, ids.length - 1)); },
      ids: () => ids
    };
  }

  /* ── utilidades de tela ── */

  function escapar(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function rotuloTag(tag, lingua) {
    const t = (window.TAGS_RAW || {})[tag];
    return (t && t[lingua]) || tag;
  }

  return { criar, fila, escapar, rotuloTag };
})();
