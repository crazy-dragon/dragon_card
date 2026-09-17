/* ================= 光点拼词 · 记忆版（西蒙光点 · 参考版风格 · 独立） =================
   深紫夜空 + 玻璃拟态：记忆阶段格子金色点亮并显示字母 → 熄灭 → 回忆阶段
   点格子：点对变绿色 + 光晕 + 填到对应位置槽，点错红色闪烁。
   格子绑定单词位置（点格子填该位置）。4×4=16 格。积分 100（正确率 70% + 时间 30%）。 */
(function () {
  'use strict';

  var FIELDS = [
    { key: 'word', label: '单词', hideable: false },
    { key: 'phonetic_us', label: '音标' },
    { key: 'paraphrase_zh', label: '中文释义' }
  ];
  var DEMO_MS = 2000; /* 记忆展示 2 秒 */
  var COLS = 5, TOTAL = 25;

  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  /* 网格：词字母随机撒入 4×4=16 格，每格绑定该字母在单词中的位置 */
  function gridPlan(word) {
    var cells = []; for (var i = 0; i < TOTAL; i++) cells.push(null);
    var n = Math.min(word.length, TOTAL);
    var spots = shuffle(Array.apply(null, Array(TOTAL)).map(function (_, i) { return i; })).slice(0, n);
    word.split('').slice(0, n).forEach(function (ch, i) { cells[spots[i]] = { ch: ch, pos: i }; });
    return { cells: cells, cols: COLS };
  }

  /* 紫色字母块（列表模式 / 槽内） */
  function purpleBlock(ch, size, fs) {
    if (!ch) return '';
    var sty = size ? 'width:' + size + 'px;height:' + size + 'px;font-size:' + fs + 'px;' : '';
    return '<span class="gw-sb"' + (sty ? ' style="' + sty + '"' : '') + '>' + PK.esc(ch) + '</span>';
  }

  function render(cardHtml, cardData, api) {
    var d = (cardData && cardData.data) || {};
    var pd = PK.parseData(d);
    var order = cardData.current_order == null ? '' : String(cardData.current_order);
    if (order.length < 2) order = '0' + order;
    var view = PK.viewMode(api);
    var wl = pd.word.toLowerCase();

    if (view !== 'single') {
      var n = wl.length;
      var size = Math.max(30, Math.min(56, Math.floor((500 - (n - 1) * 6) / n)));
      var fs = Math.round(size * 0.8);
      var h = '<div class="gw-card gw-simon" data-card-id="' + cardData.id + '">';
      h += '<div class="sw-head"><span class="sw-badge">' + PK.esc(order) + '</span>';
      if (pd.phonetic) h += '<span class="sw-chip">' + PK.esc(pd.phonetic) + '</span>';
      h += '<span class="sw-spacer"></span><span class="sw-chip">记忆拼词</span></div>';
      h += '<div class="gw-prompt">' + PK.esc(pd.zh || wl) + '</div>';
      h += '<div class="gw-slots gw-readonly">' + wl.split('').map(function (c) { return purpleBlock(c, size, fs); }).join('') + '</div>';
      h += '<div class="sw-bubble">▶ 记忆拼词 · 单卡模式可玩</div>';
      return h + '</div>';
    }

    h = '<div class="gw-card gw-single gw-simon" data-card-id="' + cardData.id + '">';
    h += '<div class="gw-body">';
    h += '<div class="gw-head"><div class="gw-word">' + PK.esc(wl) + '</div>';
    h += '<div class="gw-zh">' + PK.esc(pd.zh || '') + '</div></div>';
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
    var st = { done: false, phase: 'demo', timer: null };
    var filled = [], clickCount = 0, startTime = null;

    function mount() {
      clearTimeout(st.timer);
      st.done = false; st.phase = 'demo';
      filled = []; clickCount = 0; startTime = null;
      phaseEl.textContent = '';
      winEl.style.display = 'none';

      slotsEl.innerHTML = '';
      word.split('').forEach(function () {
        var s = document.createElement('span');
        s.className = 'gw-slot';
        slotsEl.appendChild(s);
      });

      var plan = gridPlan(word);
      gridEl.innerHTML = '';
      plan.cells.forEach(function (cell, i) {
        var c = document.createElement('div');
        c.className = 'gw-cell';
        c.setAttribute('data-i', i);
        if (cell) { c.setAttribute('data-pos', cell.pos); c.setAttribute('data-ch', cell.ch); }
        gridEl.appendChild(c);
      });

      startDemo();
    }

    function startDemo() {
      st.phase = 'demo';
      phaseEl.textContent = '记住字母位置';
      gridEl.querySelectorAll('.gw-cell[data-pos]').forEach(function (c, k) {
        c.classList.add('gold');
        c.textContent = c.getAttribute('data-ch');
      });
      api.playAudio(word, 'en');
      api.track('grid_demo');
      st.timer = setTimeout(extinguish, DEMO_MS);
    }

    function extinguish() {
      st.phase = 'play';
      phaseEl.textContent = '点字母拼词';
      gridEl.querySelectorAll('.gw-cell').forEach(function (c) {
        c.className = 'gw-cell'; c.textContent = '';
      });
    }

    function allFilled() {
      for (var i = 0; i < word.length; i++) if (!filled[i]) return false;
      return true;
    }

    function onCell(c) {
      if (st.done || st.phase !== 'play') return;
      if (startTime === null) startTime = Date.now();
      var posStr = c.getAttribute('data-pos');
      if (posStr === null) {
        clickCount++;
        api.track('grid_wrong');
        c.classList.add('wrong');
        setTimeout(function () { c.classList.remove('wrong'); }, 800);
        return;
      }
      var pos = +posStr;
      if (filled[pos]) return;
      filled[pos] = true;
      clickCount++;
      c.classList.remove('wrong'); c.classList.add('correct');
      c.textContent = c.getAttribute('data-ch');
      var slot = slotsEl.children[pos];
      slot.textContent = word[pos];
      slot.classList.add('filled');
      api.playAudio(word[pos], 'en');
      api.track('grid_correct');
      if (allFilled()) finish();
    }

    function finish() {
      st.done = true; st.phase = 'done';
      var slots = slotsEl.children;
      for (var i = 0; i < slots.length; i++) slots[i].classList.add('win');
      var timeSec = (Date.now() - startTime) / 1000;
      winEl.querySelector('.gw-win-meta').textContent = '用时 ' + timeSec.toFixed(1) + 's · 点击 ' + clickCount + ' 次';
      phaseEl.textContent = '';
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
      if (st.done || st.phase !== 'play') return;
      for (var i = 0; i < word.length; i++) {
        if (!filled[i]) {
          var c = gridEl.querySelector('.gw-cell[data-pos="' + i + '"]');
          if (!c) return;
          c.classList.add('gold');
          c.textContent = word[i];
          api.track('hint_used');
          setTimeout(function () { if (!filled[i]) { c.classList.remove('gold'); c.textContent = ''; } }, 900);
          break;
        }
      }
    });

    mount();
  }

  window.cardTemplate = {
    name: '光点拼词 · 记忆版',
    fields: FIELDS,
    render: render,
    init: init,
    update: function (cardEl, cardData, api) { var p = cardEl.parentElement; if (p) cardEl.outerHTML = render('', cardData, api); }
  };
})();