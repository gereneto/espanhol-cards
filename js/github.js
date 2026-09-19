/* ────────────────────────────────────────────────────────────────
   github.js — lê e grava arquivos num repositório do GitHub.

   O token fica só no localStorage deste navegador. Use um
   fine-grained token com acesso apenas ao repositório em questão e
   permissão Contents: Read and write.

   São dois repositórios diferentes, cada um com sua chave no
   localStorage, para as configurações não brigarem entre si quando o
   app de estudo e as páginas de revisão rodam no mesmo navegador:

     GH      → espanhol-cards-dados    (progresso do estudo)
     GH_REV  → espanhol-cards-revisao  (a revisão es-en e en-pt)
   ──────────────────────────────────────────────────────────────── */
function criarGH(opcoesGH) {

  const CHAVE = opcoesGH.chave;
  const PADRAO = { repo: opcoesGH.repoPadrao, token: '', auto: true };

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
    return chamarApi('contents/' + caminho, opcoes);
  }

  async function chamarApi(caminho, opcoes) {
    const c = cfg();
    if (!configurado()) throw new Error('Configure o repositório e o token antes de sincronizar.');
    const url = 'https://api.github.com/repos/' + c.repo + '/' + caminho;
    const resp = await fetch(url, Object.assign({
      headers: {
        'Authorization': 'Bearer ' + c.token,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }, opcoes || {}));
    return resp;
  }

  /* Lê um arquivo. Devolve {sha, texto} ou null se ainda não existe.

     A API de conteúdo só entrega o texto de arquivo até 1 MB. Acima disso ela
     responde 200 com «content» vazio e «encoding: none» — ou, em versões mais
     antigas, 403 «too_large». O progresso.json cresce uns 50 KB por dia de
     estudo e chegou a esse teto; sem este desvio a leitura voltava vazia, a
     mescla era pulada em silêncio e cada aparelho passava a gravar por cima
     do outro. O mesmo arquivo sai inteiro pela API de blobs, que vai até
     100 MB e só precisa do sha. */
  async function ler(caminho, soSha) {
    const resp = await chamar(caminho + '?ref=HEAD&t=' + Date.now());
    if (resp.status === 404) return null;

    let sha = null;
    if (resp.ok) {
      const dados = await resp.json();
      if (dados.encoding === 'base64' && (dados.content || !dados.size)) {
        return { sha: dados.sha, texto: deBase64(dados.content) };
      }
      sha = dados.sha;
    } else {
      const grande = resp.status === 403 &&
        await resp.clone().json().then(j => JSON.stringify(j).includes('too_large'), () => false);
      if (!grande) throw new Error(await mensagemErro(resp));
      sha = await shaPelaPasta(caminho);
    }
    if (!sha) throw new Error('Não achei o arquivo ' + caminho + ' para ler por inteiro.');

    if (soSha) return { sha: sha, texto: null };

    const blob = await chamarApi('git/blobs/' + sha);
    if (!blob.ok) throw new Error(await mensagemErro(blob));
    const dados = await blob.json();
    return { sha: sha, texto: deBase64(dados.content) };
  }

  /* O sha de um arquivo, tirado da listagem da pasta dele — que não tem o
     limite de tamanho que a leitura do próprio arquivo tem. */
  async function shaPelaPasta(caminho) {
    const corte = caminho.lastIndexOf('/');
    const pasta = corte < 0 ? '' : caminho.slice(0, corte);
    const nome = caminho.slice(corte + 1);
    const resp = await chamar(pasta + '?ref=HEAD&t=' + Date.now());
    if (!resp.ok) throw new Error(await mensagemErro(resp));
    const itens = await resp.json();
    const achado = Array.isArray(itens) && itens.find(i => i.name === nome);
    return achado ? achado.sha : null;
  }

  /* Grava (cria ou atualiza) um arquivo. */
  async function escrever(caminho, texto, mensagem, opcoes) {
    opcoes = opcoes || {};
    let sha = opcoes.sha;
    if (sha === undefined) {
      const atual = await ler(caminho, true).catch(() => null);
      sha = atual ? atual.sha : undefined;
    }

    const corpo = { message: mensagem, content: paraBase64(texto) };
    if (sha) corpo.sha = sha;
    const envio = JSON.stringify(corpo);

    /* O «keepalive» deixa o pedido terminar depois de a aba fechar, mas o
       navegador só o aceita com corpo de até 64 KB — acima disso recusa na
       hora, sem nem tentar. O progresso.json passa disso de longe, e era ele
       o primeiro da fila ao esconder a aba: falhava, e a sessão, o resumo e
       os comentários que vinham atrás não subiam. Corpo grande vai sem a
       marca; se a aba só foi escondida, e não fechada, ele chega igual. */
    const resp = await chamar(caminho, {
      method: 'PUT',
      body: envio,
      keepalive: !!opcoes.keepalive && envio.length < 60000
    });

    // conflito de sha: alguém (outro aparelho) gravou antes. Relê e tenta de novo.
    if ((resp.status === 409 || resp.status === 422) && !opcoes.semRetentativa) {
      const atual = await ler(caminho, true).catch(() => null);
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
}

window.criarGH = criarGH;

window.GH = criarGH({
  chave: 'espanhol-cards:github',
  repoPadrao: 'gereneto/espanhol-cards-dados'
});

window.GH_REV = criarGH({
  chave: 'espanhol-cards:github-revisao',
  repoPadrao: 'gereneto/espanhol-cards-revisao'
});
