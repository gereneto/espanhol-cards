/* ────────────────────────────────────────────────────────────────
   github.js — grava os resultados no repositório de dados.

   O token fica só no localStorage deste navegador. Use um
   fine-grained token com acesso apenas ao repositório de dados e
   permissão Contents: Read and write.
   ──────────────────────────────────────────────────────────────── */
window.GH = (function () {

  const CHAVE = 'espanhol-cards:github';
  const PADRAO = { repo: 'gereneto/espanhol-cards-dados', token: '', auto: true };

  function cfg() {
    try {
      return Object.assign({}, PADRAO, JSON.parse(localStorage.getItem(CHAVE) || '{}'));
    } catch (e) {
      return Object.assign({}, PADRAO);
    }
  }

  function salvarCfg(novo) {
    localStorage.setItem(CHAVE, JSON.stringify(Object.assign(cfg(), novo)));
  }

  function configurado() {
    const c = cfg();
    return !!(c.token && c.repo && c.repo.includes('/'));
  }

  /* ── base64 com UTF-8 ── */
  function paraBase64(texto) {
    const bytes = new TextEncoder().encode(texto);
    let bin = '';
    const passo = 0x8000;
    for (let i = 0; i < bytes.length; i += passo) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + passo));
    }
    return btoa(bin);
  }

  function deBase64(b64) {
    const bin = atob((b64 || '').replace(/\n/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  async function chamar(caminho, opcoes) {
    const c = cfg();
    if (!configurado()) throw new Error('Configure o repositório e o token antes de sincronizar.');
    const url = 'https://api.github.com/repos/' + c.repo + '/contents/' + caminho;
    const resp = await fetch(url, Object.assign({
      headers: {
        'Authorization': 'Bearer ' + c.token,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }, opcoes || {}));
    return resp;
  }

  /* Lê um arquivo. Devolve {sha, texto} ou null se ainda não existe. */
  async function ler(caminho) {
    const resp = await chamar(caminho + '?ref=HEAD&t=' + Date.now());
    if (resp.status === 404) return null;
    if (!resp.ok) throw new Error(await mensagemErro(resp));
    const dados = await resp.json();
    return { sha: dados.sha, texto: deBase64(dados.content) };
  }

  /* Grava (cria ou atualiza) um arquivo. */
  async function escrever(caminho, texto, mensagem, opcoes) {
    opcoes = opcoes || {};
    let sha = opcoes.sha;
    if (sha === undefined) {
      const atual = await ler(caminho).catch(() => null);
      sha = atual ? atual.sha : undefined;
    }

    const corpo = { message: mensagem, content: paraBase64(texto) };
    if (sha) corpo.sha = sha;

    const resp = await chamar(caminho, {
      method: 'PUT',
      body: JSON.stringify(corpo),
      keepalive: !!opcoes.keepalive
    });

    // conflito de sha: alguém (outro aparelho) gravou antes. Relê e tenta de novo.
    if ((resp.status === 409 || resp.status === 422) && !opcoes.semRetentativa) {
      const atual = await ler(caminho).catch(() => null);
      return escrever(caminho, texto, mensagem, {
        sha: atual ? atual.sha : undefined,
        semRetentativa: true,
        keepalive: opcoes.keepalive
      });
    }

    if (!resp.ok) throw new Error(await mensagemErro(resp));
    const dados = await resp.json();
    return dados.content ? dados.content.sha : null;
  }

  async function mensagemErro(resp) {
    let detalhe = '';
    try {
      const j = await resp.json();
      detalhe = j.message || '';
    } catch (e) { /* corpo vazio */ }
    if (resp.status === 401) return 'Token inválido ou expirado (401).';
    if (resp.status === 403) return 'Sem permissão para gravar neste repositório (403). ' + detalhe;
    if (resp.status === 404) return 'Repositório não encontrado, ou o token não enxerga ele (404).';
    return 'GitHub respondeu ' + resp.status + '. ' + detalhe;
  }

  return { cfg, salvarCfg, configurado, ler, escrever, paraBase64, deBase64 };
})();
