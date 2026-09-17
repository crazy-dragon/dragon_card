/* ================= 模板一：小学单词卡（直显 · 大立体字母 · 点读主导） ================= */
(function () {
  'use strict';

  var FIELDS = [
    { key: 'word', label: '单词', hideable: false },
    { key: 'zh', label: '中文' },
    { key: 'phonetic', label: '音标' },
    { key: 'sentence', label: '例句' },
    { key: 'sentenceZh', label: '例句翻译' },
    { key: 'syllable', label: '音节' },
    { key: 'unit', label: '单元' },
    { key: 'tip', label: '易错提示' }
  ];

  function st(cardData) {
    if (!cardData._pk) cardData._pk = { hint: false };
    return cardData._pk;
  }

  function render(cardHtml, cardData, api) {
    var d = (cardData && cardData.data) || {};
    var word = String(d.word || '');
    var s = st(cardData);
    var hid = PK.hiddenSet(api);
    var unknown = cardData.is_unknown === 1;
    var fav = cardData.is_favorite === 1;
    var order = cardData.current_order == null ? '' : String(cardData.current_order);
    if (order.length < 2) order = '0' + order;

    var h = '<div class="pk-card pk-wc" data-card-id="' + cardData.id + '">';

    /* 顶部 */
    h += '<div class="pk-head"><span class="pk-badge">' + PK.esc(order) + '</span>';
    if (d.unit && !hid.has('unit')) h += '<span class="pk-chip">' + PK.esc(d.unit) + '</span>';
    h += '<span class="pk-spacer"></span>';
    h += '<span class="pk-chip">点卡片听发音</span></div>';

    /* 主视觉：大 3D 字母直接站在四线三格里（不是闪卡，没有揭晓步骤） */
    h += '<div class="pk-stage pk-bigword">'
      + '<span class="pk-wordbox"><span class="pk-lines"><i></i><i></i><i></i></span>'
      + PK.word3dHtml(word) + '</span>'
      + '</div>';

    /* 信息行：中文（暖色大字）+ 音标 + 音节 —— 信息感在这排 */
    h += '<div class="pk-info">';
    if (d.zh && !hid.has('zh')) h += '<span class="pk-zh-main">' + PK.esc(d.zh) + '</span>';
    var bits = [];
    if (d.phonetic && !hid.has('phonetic')) bits.push('<span class="pk-chip">' + PK.esc(d.phonetic) + '</span>');
    if (d.syllable && !hid.has('syllable')) {
      var parts = String(d.syllable).split('-');
      var nSyl = parts.length;
      bits.push('<span class="pk-chip">' + (nSyl > 1
        ? PK.esc(parts.join(' · ')) + '（' + nSyl + ' 个音节）'
        : '单音节') + '</span>');
    }
    if (bits.length) h += '<span class="pk-meta">' + bits.join('') + '</span>';
    h += '</div>';

    /* 例句 */
    if (d.sentence && !hid.has('sentence')) {
      h += '<div class="pk-panel"><div class="pk-en">' + PK.esc(d.sentence) + '</div>';
      if (d.sentenceZh && !hid.has('sentenceZh')) h += '<div class="pk-cn">' + PK.esc(d.sentenceZh) + '</div>';
      h += '</div>';
    }

    /* 易错提示 */
    if (s.hint && d.tip) h += '<div class="pk-hint">💡 ' + PK.esc(d.tip) + '</div>';

    /* 角色 + 气泡 */
    h += '<div class="pk-foot"><span class="pk-face">' + PK.animalSvg('cat', unknown ? 'sleep' : 'happy') + '</span>'
      + '<div class="pk-bubble">' + PK.esc(unknown
        ? '标记好啦，复习时它会先出现。'
        : '点卡片或大喇叭，跟着读两遍～') + '</div></div>';

    /* 按钮：发音是绝对主角（大号主按钮），其余收小 */
    h += '<div class="pk-acts">';
    h += '<button type="button" class="pk-act pk-audio is-pri pk-wide"><span class="pk-emo">🔊</span>读一遍</button>';
    h += '<button type="button" class="pk-act pk-hint' + (s.hint ? ' is-on' : '') + '" data-action="hint">'
      + '<span class="pk-emo">💡</span>提示</button>';
    h += '<button type="button" class="pk-act pk-mark' + (unknown ? ' is-on' : '') + '" data-action="mark">'
      + '<span class="pk-emo">' + (unknown ? '⭐' : '☆') + '</span>不熟</button>';
    h += '<button type="button" class="pk-act pk-fav' + (fav ? ' is-on' : '') + '" data-action="favorite">'
      + '<span class="pk-emo">🔖</span>收藏</button>';
    h += '</div>';

    h += PK.galleryHtml();
    h += '<div data-veil-host></div>';
    h += '</div>';
    return h;
  }

  function init(cardEl, cardData, api) {
    var d = (cardData && cardData.data) || {};
    var word = String(d.word || '');
    var s = st(cardData);

    function speak() {
      if (!word) return;
      api.playAudio(word, 'en');
      api.track('audio_play');
    }

    /* 点卡片任意处听发音（按钮 / 图鉴遮罩除外）——小孩不用找小喇叭 */
    cardEl.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest && t.closest('[data-veil="1"]')) { PK.closeVeil(cardEl); return; }
      if (t.closest && t.closest('button')) return;
      speak();
    });

    cardEl.querySelector('.pk-audio').addEventListener('click', speak);

    cardEl.querySelector('[data-action="hint"]').addEventListener('click', function () {
      s.hint = true;
      api.track('hint_used');
      PK.sfx.key('a');
      api.rerender();
    });

    cardEl.querySelector('[data-action="mark"]').addEventListener('click', function () {
      api.toggleMark().then(function () { api.rerender(); });
      api.track('word_mark');
    });

    cardEl.querySelector('[data-action="favorite"]').addEventListener('click', function () {
      api.toggleFavorite().then(function () { api.rerender(); });
      api.track('favorite_toggle');
    });

    PK.bindGallery(cardEl, api);
  }

  window.cardTemplate = {
    name: '小学单词卡',
    fields: FIELDS,
    render: render,
    init: init,
    update: function (cardEl, cardData, api) {
      var p = cardEl.parentElement;
      if (p) cardEl.outerHTML = render('', cardData, api);
    }
  };
})();
