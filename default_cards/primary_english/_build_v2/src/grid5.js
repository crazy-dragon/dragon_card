/* ================= 光点拼词 · 简版（常亮找字母 · 4×4 · 中等难度） =================
   字母（大小写）+ 少量干扰散在 4×4 网格，按顺序点击拼出单词。一格一字、
   字母可复用，点击自动播报。顶部不显示英文单词（避免照抄，靠中文回忆拼写）。
   积分：满分 100（正确率 70% + 时间 30%），从第一次点击开始计时。 */
(function () {
  'use strict';

  var FIELDS = [
    { key: 'word', label: '单词', hideable: false },
    { key: 'phonetic_us', label: '音标' },
    { key: 'paraphrase_zh', label: '中文释义' }
  ];
  var COLS = 4, TOTAL = 16, DISTRACT = 3;

  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function gridPlan(word) {
    var cells = [], inWord = {};
    word.split('').forEach(function (ch) {
      if (inWord[ch]) return;
      inWord[ch] = 1;
      cells.push({ ch: ch, disp: ch });
      cells.push({ ch: ch, disp: ch.toUpperCase() });
    });
    var nd = Math.min(DISTRACT, TOTAL - cells.length);
    var pool = 'abcdefghijklmnopqrstuvwxyz', made = 0, guard = 0;
    while (made < nd && guard++ < 400) {
      var ch = pool[Math.floor(Math.random() * pool.length)];
      if (inWord[ch]) continue;
      inWord[ch] = 1;
      cells.push({ ch: ch, disp: Math.random() < .5 ? ch.toUpperCase() : ch });
      made++;
    }
    while (cells.length < TOTAL) cells.push(null);
    return shuffle(cells.slice(0, TOTAL));
  }

  function blockInner(ch, disp, size, fs) {
    if (!ch) return '';
    var bc = PK.blockColors(ch);
    var sty = '--sw-c-hi:' + bc.hi + ';--sw-c1:' + bc.c1 + ';--sw-c2:' + bc.c2 + ';--sw-c-deep:' + bc.deep;
    if (size) sty += ';width:' + size + 'px;height:' + size + 'px';
    return '<span class="sw-block" style="' + sty + '">'
      + '<span class="sw-letter"' + (fs ? ' style="font-size:' + fs + 'px"' : '') + '>'
      + PK.esc(disp || ch) + '</span></span>';
  }

  /* 槽内扁平色块（无糖果立体阴影，四边完整圆角） */
  function flatBlock(ch) {
    if (!ch) return '';
    var bc = PK.blockColors(ch);
    return '<span class="gw-flat" style="--sw-c1:' + bc.c1 + ';--sw-c2:' + bc.c2 + '">'
      + PK.esc(ch) + '</span>';
  }

  function render(cardHtml, cardData, api) {
    var d = (cardData && cardData.data) || {};
    var pd = PK.parseData(d);
    var order = cardData.current_order == null ? '' : String(cardData.current_order);
    if (order.length < 2) order = '0' + order;
    var view = PK.viewMode(api);

    if (view !== 'single') {
      var n = pd.word.length;
      var size = Math.max(30, Math.min(56, Math.floor((500 - (n - 1) * 6) / n)));
      var fs = Math.round(size * 0.8);
      var h = '<div class="gw-card" data-card-id="' + cardData.id + '">';
      h += '<div class="sw-head"><span class="sw-badge">' + PK.esc(order) + '</span>';
      if (pd.phonetic) h += '<span class="sw-chip">' + PK.esc(pd.phonetic) + '</span>';
      h += '<span class="sw-spacer"></span><span class="sw-chip">找字母拼词</span></div>';
      h += '<div class="gw-prompt">' + PK.esc(pd.zh || pd.word) + '</div>';
      h += '<div class="gw-slots gw-readonly">' + pd.word.split('').map(function (c) { return blockInner(c, c, size, fs); }).join('') + '</div>';
      h += '<div class="sw-bubble">▶ 找字母拼词 · 单卡模式可玩</div>';
      return h + '</div>';
    }

    h = '<div class="gw-card gw-single gw5" data-card-id="' + cardData.id + '">';
    h += '<div class="gw-body">';
    h += '<div class="gw-head gw-head5"><div class="gw-zh">' + PK.esc(pd.zh || '') + '</div></div>';
    h += '<div class="gw-phase"></div>';
    h += '<div class="gw-slots"></div>';
    h += '<div class="gw-grid"></div>';
    h += '</div>';
    h += '<div class="gw-acts">';
    h += '<button type="button" class="gw-act" data-action="play" data-tooltip="听单词">🔊</button>';
    h += '<button type="button" class="gw-act" data-action="hint" data-tooltip="提示">💡</button>';
    h += '</div>';
    h += '<div class="gw-win" style="display:none;">';
    h += '<div class="gw-win-card">';
    h += '<div class="gw-win-emoji">🎉</div>';
    h += '<div class="gw-win-title">太棒了！</div>';
    h += '<div class="gw-win-meta"></div>';
    h += '<button type="button" class="gw-win-next" data-action="next">下一关 ⏭</button>';
    h += '</div></div>';
    h += '</div>';
    return h;
  }

  function init(cardEl, cardData, api) {
    var d = (cardData && cardData.data) || {};
    var pd = PK.parseData(d);
    var word = pd.word.toLowerCase();
    var view = PK.viewMode(api);

    var playBtn0 = cardEl.querySelector('[data-action="play"]');
    if (playBtn0) playBtn0.addEventListener('click', function () { api.playAudio(word, 'en'); api.track('audio_play'); });
    var nextBtn = cardEl.querySelector('[data-action="next"]');
    if (nextBtn) nextBtn.addEventListener('click', function () { PK.next(); });
    if (view !== 'single') return;

    var slotsEl = cardEl.querySelector('.gw-slots');
    var gridEl = cardEl.querySelector('.gw-grid');
    var phaseEl = cardEl.querySelector('.gw-phase');
    var winEl = cardEl.querySelector('.gw-win');
    var st = { pos: 0, done: false };
    var clickCount = 0, startTime = null;

    function mount() {
      st.pos = 0; st.done = false;
      clickCount = 0; startTime = null;
      phaseEl.textContent = '按顺序点字母拼出单词';
      winEl.style.display = 'none';

      slotsEl.innerHTML = '';
      word.split('').forEach(function () {
        var s = document.createElement('span');
        s.className = 'gw-slot';
        s.innerHTML = '<span class="gw-slot-inner"></span>';
        slotsEl.appendChild(s);
      });

      gridEl.innerHTML = '';
      gridEl.style.gridTemplateColumns = 'repeat(' + COLS + ', 1fr)';
      gridPlan(word).forEach(function (c, i) {
        var cell = document.createElement('div');
        cell.setAttribute('data-i', i);
        if (c) {
          cell.className = 'gw-cell lit';
          cell.setAttribute('data-ch', c.ch);
          cell.setAttribute('data-disp', c.disp);
          cell.innerHTML = blockInner(c.ch, c.disp);
          cell.style.animationDelay = (i * 0.018) + 's';
        } else {
          cell.className = 'gw-cell blank';
        }
        gridEl.appendChild(cell);
      });
    }

    function needed() { return word[st.pos]; }

    function onCell(c) {
      if (st.done) return;
      if (startTime === null) startTime = Date.now();
      var ch = c.getAttribute('data-ch');
      if (!ch) return;
      if (ch === needed()) {
        clickCount++;
        var slot = slotsEl.children[st.pos];
        slot.querySelector('.gw-slot-inner').innerHTML = flatBlock(ch);
        slot.classList.add('filled');
        st.pos++;
        api.playAudio(ch, 'en');
        api.track('grid_correct');
        if (st.pos === word.length) finish();
      } else {
        clickCount++;
        api.track('grid_wrong');
        c.classList.remove('bad'); void c.offsetWidth; c.classList.add('bad');
        setTimeout(function () { c.classList.remove('bad'); }, 460);
      }
    }

    function finish() {
      st.done = true;
      var slots = slotsEl.children;
      for (var i = 0; i < slots.length; i++) slots[i].classList.add('win');
      var timeSec = (Date.now() - startTime) / 1000;
      phaseEl.textContent = '';
      winEl.querySelector('.gw-win-meta').textContent = '用时 ' + timeSec.toFixed(1) + 's · 点击 ' + clickCount + ' 次';
      setTimeout(function () {
        var gt = gridEl.getBoundingClientRect();
        var ct = cardEl.getBoundingClientRect();
        winEl.style.top = (gt.top - ct.top) + 'px';
        winEl.style.display = 'flex';
      }, 1000);
      setTimeout(function () { api.playAudio(word, 'en'); api.track('grid_finish'); }, 420);
    }

    gridEl.addEventListener('click', function (e) {
      var c = e.target.closest ? e.target.closest('.gw-cell') : null;
      if (c) onCell(c);
    });

    var hintBtn = cardEl.querySelector('[data-action="hint"]');
    if (hintBtn) hintBtn.addEventListener('click', function () {
      var need = needed(); if (!need || st.done) return;
      gridEl.querySelectorAll('.gw-cell.lit').forEach(function (c) {
        if (c.getAttribute('data-ch') === need) {
          c.classList.remove('hint'); void c.offsetWidth; c.classList.add('hint');
          setTimeout(function () { c.classList.remove('hint'); }, 1600);
        }
      });
      api.track('hint_used');
    });

    mount();
  }

  window.cardTemplate = {
    name: '光点拼词 · 简版',
    fields: FIELDS,
    render: render,
    init: init,
    update: function (cardEl, cardData, api) { var p = cardEl.parentElement; if (p) cardEl.outerHTML = render('', cardData, api); }
  };
})();