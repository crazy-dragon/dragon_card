/* ================= v2 糖果单词卡（初中英语格式） ================= */
(function () {
  'use strict';

  var FIELDS = [
    { key: 'word', label: '单词', hideable: false },
    { key: 'phonetic_us', label: '音标' },
    { key: 'paraphrase_zh', label: '中文释义' },
    { key: 'paraphrase_en', label: '英文释义' },
    { key: 'examples', label: '例句' },
    { key: 'coca_rank', label: '词频' },
    { key: 'form_note', label: '词形' }
  ];

  function render(cardHtml, cardData, api) {
    var d = (cardData && cardData.data) || {};
    var pd = PK.parseData(d);
    var hid = PK.hiddenSet(api);
    var unknown = cardData.is_unknown === 1;
    var fav = cardData.is_favorite === 1;
    var order = cardData.current_order == null ? '' : String(cardData.current_order);
    if (order.length < 2) order = '0' + order;

    var h = '<div class="sw-card sw-wc" data-card-id="' + cardData.id + '">';

    /* 顶部 */
    h += '<div class="sw-head"><span class="sw-badge">' + PK.esc(order) + '</span>';
    if (pd.coca != null) h += '<span class="sw-chip">#' + PK.esc(pd.coca) + '</span>';
    h += '<span class="sw-spacer"></span>';
    h += '<span class="sw-chip">点卡片听发音</span></div>';

    /* 主视觉：糖果积木字母 + 四线三格 */
    h += '<div class="sw-stage"><span class="sw-wordbox"><span class="sw-lines"><i></i><i></i><i></i></span>'
      + PK.blocksHtml(pd.word) + '</span></div>';

    /* 信息行：中文 + 音标 */
    h += '<div class="sw-info">';
    if (pd.zh && !hid.has('paraphrase_zh')) h += '<span class="sw-zh">' + PK.esc(pd.zh) + '</span>';
    var bits = [];
    if (pd.phonetic && !hid.has('phonetic_us')) bits.push('<span class="sw-chip">' + PK.esc(pd.phonetic) + '</span>');
    if (bits.length) h += '<span class="sw-meta">' + bits.join('') + '</span>';
    h += '</div>';

    /* 例句 */
    if (pd.example && !hid.has('examples')) {
      h += '<div class="sw-panel"><div class="sw-en">' + PK.esc(pd.example) + '</div>';
      if (pd.exampleZh) h += '<div class="sw-cn">' + PK.esc(pd.exampleZh) + '</div>';
      h += '</div>';
    }

    /* 角色 + 气泡 */
    h += '<div class="sw-foot"><span class="sw-face">' + PK.animalSvg(PK.pickAnimal(pd.word), unknown ? 'sleep' : 'happy') + '</span>'
      + '<div class="sw-bubble">' + PK.esc(unknown ? '标记好啦，复习时它先出现。' : '点卡片或大喇叭，跟着读两遍～') + '</div></div>';

    /* 按钮 */
    h += '<div class="sw-acts">';
    h += '<button type="button" class="sw-act is-pri" data-action="play"><span class="sw-emo">🔊</span>读一遍</button>';
    h += '<button type="button" class="sw-act' + (unknown ? ' is-on' : '') + '" data-action="mark"><span class="sw-emo">' + (unknown ? '⭐' : '☆') + '</span>不熟</button>';
    h += '<button type="button" class="sw-act' + (fav ? ' is-on' : '') + '" data-action="favorite"><span class="sw-emo">🔖</span>收藏</button>';
    h += '</div>';

    /* 色板切换条 */
    h += PK.themeBarHtml();

    h += '</div>';
    return h;
  }

  function init(cardEl, cardData, api) {
    var d = (cardData && cardData.data) || {};
    var pd = PK.parseData(d);

    PK.applyTheme(cardEl);

    function speak() {
      if (!pd.word) return;
      api.playAudio(pd.word, 'en');
      api.track('audio_play');
    }

    /* 点卡片任意处听发音 */
    cardEl.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest && t.closest('button')) return;
      speak();
    });

    var playBtn = cardEl.querySelector('[data-action="play"]');
    if (playBtn) playBtn.addEventListener('click', function (e) { e.stopPropagation(); speak(); });

    var markBtn = cardEl.querySelector('[data-action="mark"]');
    if (markBtn) markBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      api.toggleMark().then(function () { api.rerender(); });
      api.track('word_mark');
    });

    var favBtn = cardEl.querySelector('[data-action="favorite"]');
    if (favBtn) favBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      api.toggleFavorite().then(function () { api.rerender(); });
      api.track('favorite_toggle');
    });

    PK.bindThemes(cardEl, api);
  }

  window.cardTemplate = {
    name: '糖果单词卡',
    fields: FIELDS,
    render: render,
    init: init,
    update: function (cardEl, cardData, api) {
      var p = cardEl.parentElement;
      if (p) cardEl.outerHTML = render('', cardData, api);
    }
  };
})();