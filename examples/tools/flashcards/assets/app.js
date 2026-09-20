/* 示例小工具：用 cardAPI 分页读取卡组数据 + 标记 + 埋点 */
(function () {
  'use strict';

  var cards = [], idx = 0, page = 1, total = 0;
  var wordEl = document.getElementById('word');
  var posEl = document.getElementById('pos');
  var markBtn = document.getElementById('mark');

  function show() {
    var c = cards[idx];
    if (!c) return;
    var d = c.data || {};
    var zh = Array.isArray(d.paraphrase_zh) ? d.paraphrase_zh[0] : (d.paraphrase_zh || '');
    wordEl.innerHTML =
      '<div class="w-word">' + escapeHtml(d.word || '') + '</div>' +
      (d.phonetic_us ? '<div class="w-ph">' + escapeHtml(d.phonetic_us) + '</div>' : '') +
      (zh ? '<div class="w-zh">' + escapeHtml(zh) + '</div>' : '');
    posEl.textContent = (page - 1) * 100 + idx + 1 + ' / ' + total;
  }

  function load() {
    cardAPI.getPage(page).then(function (d) {
      cards = d.cards || [];
      total = d.total || 0;
      idx = 0;
      if (!cards.length) { wordEl.textContent = '这个卡组没有数据'; return; }
      show();
    });
  }

  document.getElementById('next').onclick = function () {
    if (idx < cards.length - 1) { idx++; show(); }
    else if (page < Math.ceil(total / 100)) { page++; load(); }
    cardAPI.track('card_flip');
  };
  document.getElementById('prev').onclick = function () {
    if (idx > 0) { idx--; show(); cardAPI.track('card_flip'); }
  };
  markBtn.onclick = function () {
    var c = cards[idx];
    if (!c) return;
    cardAPI.mark(c.id, true).then(function () {
      cardAPI.playAudio(c.data.word);
      markBtn.classList.add('marked');
      setTimeout(function () { markBtn.classList.remove('marked'); }, 600);
    });
  };

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  load();
  cardAPI.track('tool_finish');
})();