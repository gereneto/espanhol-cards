/* ────────────────────────────────────────────────────────────────
   layout.js — as variações de layout em teste.

   PROVISÓRIO: existe para comparar cinco desenhos lado a lado, no uso de
   verdade, com a MESMA paleta. Fechado o layout, a variação escolhida vai
   para o style.css e este arquivo, o style-variacoes.css e o seletor do
   rodapé saem.

   Carrega no <head>, antes do corpo, para a página já nascer no layout
   escolhido em vez de piscar no atual. A escolha fica no localStorage
   deste navegador; «?layout=b» na URL escolhe e grava.

   Cada variação traz as suas fontes, e só as da variação ativa são
   pedidas ao Google Fonts.
   ──────────────────────────────────────────────────────────────── */
(function () {
  var CHAVE = 'espanhol-cards:layout';
  var G = 'https://fonts.googleapis.com/css2?';

  var LAYOUTS = [
    { id: '',  nome: 'Atual' },
    { id: 'a', nome: 'Verbete',
      fontes: 'family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500' +
              '&family=Instrument+Sans:wght@400;500;600;700' },
    { id: 'b', nome: 'Suíço',
      fontes: 'family=Hanken+Grotesk:wght@400;500;600;700;800' },
    { id: 'c', nome: 'Técnico',
      fontes: 'family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,500&family=IBM+Plex+Mono:wght@400;500;600' },
    { id: 'd', nome: 'Tátil',
      fontes: 'family=Figtree:ital,wght@0,400;0,500;0,600;0,700;0,800;1,600' },
    { id: 'e', nome: 'Silêncio',
      fontes: 'family=Albert+Sans:ital,wght@0,300;0,400;0,500;0,600;1,300' }
  ];

  function ler() {
    try { return localStorage.getItem(CHAVE) || ''; } catch (e) { return ''; }
  }

  function achar(id) {
    for (var i = 0; i < LAYOUTS.length; i++) if (LAYOUTS[i].id === id) return LAYOUTS[i];
    return LAYOUTS[0];
  }

  function aplicar(id) {
    var l = achar(id);
    var raiz = document.documentElement;
    if (l.id) raiz.setAttribute('data-layout', l.id); else raiz.removeAttribute('data-layout');

    var link = document.getElementById('fontes-do-layout');
    if (!l.fontes) { if (link) link.parentNode.removeChild(link); }
    else {
      if (!link) {
        link = document.createElement('link');
        link.id = 'fontes-do-layout';
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }
      var href = G + l.fontes + '&display=swap';
      if (link.getAttribute('href') !== href) link.setAttribute('href', href);
    }
    return l.id;
  }

  function escolher(id) {
    id = aplicar(id);
    try { localStorage.setItem(CHAVE, id); } catch (e) { /* sem localStorage, vale só nesta visita */ }
    marcar();
    /* o cabeçalho pode ter mudado de altura, e a pergunta gruda logo abaixo
       dele: o app mede de novo no «resize» — agora, e quando a fonte chegar */
    window.dispatchEvent(new Event('resize'));
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { window.dispatchEvent(new Event('resize')); });
    }
  }

  function marcar() {
    var atual = document.documentElement.getAttribute('data-layout') || '';
    var botoes = document.querySelectorAll('[data-escolher-layout]');
    for (var i = 0; i < botoes.length; i++) {
      var meu = botoes[i].getAttribute('data-escolher-layout') === atual;
      botoes[i].classList.toggle('aqui', meu);
      botoes[i].setAttribute('aria-pressed', meu ? 'true' : 'false');
    }
  }

  /* O seletor mora no rodapé: está em todas as telas, não ocupa nada do
     card, e trocar no meio do estudo é o que faz a comparação ser justa. */
  function montarSeletor() {
    var rodape = document.querySelector('.rodape');
    if (!rodape || rodape.querySelector('.seletor-layout')) return;
    var caixa = document.createElement('div');
    caixa.className = 'seletor-layout';
    caixa.setAttribute('role', 'group');
    caixa.setAttribute('aria-label', 'Layout em teste');
    LAYOUTS.forEach(function (l) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = l.id ? l.id.toUpperCase() : 'Atual';
      b.title = l.nome;
      b.setAttribute('data-escolher-layout', l.id);
      b.addEventListener('click', function () { escolher(l.id); });
      caixa.appendChild(b);
    });
    var nome = document.createElement('span');
    nome.className = 'seletor-layout-nome';
    caixa.appendChild(nome);
    rodape.insertBefore(caixa, rodape.firstChild);
    var escreverNome = function () {
      nome.textContent = achar(document.documentElement.getAttribute('data-layout') || '').nome;
    };
    caixa.addEventListener('click', escreverNome);
    escreverNome();
    marcar();
  }

  var daUrl = null;
  try { daUrl = new URLSearchParams(location.search).get('layout'); } catch (e) { /* URL sem busca */ }
  if (daUrl !== null) {
    daUrl = achar(String(daUrl).toLowerCase()).id;
    try { localStorage.setItem(CHAVE, daUrl); } catch (e) { /* idem */ }
  }
  aplicar(daUrl !== null ? daUrl : ler());

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montarSeletor);
  else montarSeletor();

  window.Layout = { escolher: escolher, lista: LAYOUTS };
})();
