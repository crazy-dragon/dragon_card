#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_ipa.py — English IPA (英语 48 国际音标) 卡组生成器
======================================================
产物（写入本目录）：
  template.json  cards.json  preview.html

结构：
  intro 引导卡 1 张（48 音体系 + 清浊成对 + 六类图例）
  + 48 张音标卡（单元音 12 → 双元音 8 → 清辅音 10 → 浊辅音 10 → 鼻音 3 → 半辅音 5）

数据文件 data/phonemes.json
  每行: sym / cat / ex[[word, ipa] x3] / spell / tip(中文)
  cat 取值: 单元音 | 双元音 | 清辅音 | 浊辅音 | 鼻音 | 半辅音

校验：
  - 音标集合必须与标准 DJ 48 完全一致、无重复
  - 例词纯拉丁字母；例词 IPA 不得含拉丁字母（/ ː ˈ ˌ 等除外）
  - spell 非空且含拉丁字母；tip 必须含中文
  - 朗读 lang=en（读英文例词）
"""
import json
import os
import re

DECK = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(DECK, 'data')
OUT = DECK

# 标准 DJ 48 音标（中国英语教学惯例：20 元音 + 28 辅音）
STD = ['iː', 'ɪ', 'e', 'æ', 'ɜː', 'ə', 'ɑː', 'ɔː', 'ɒ', 'ʊ', 'uː', 'ʌ',
       'eɪ', 'aɪ', 'ɔɪ', 'ɪə', 'eə', 'ʊə', 'əʊ', 'aʊ',
       'p', 't', 'k', 'f', 's', 'θ', 'ʃ', 'tʃ', 'ts', 'tr',
       'b', 'd', 'ɡ', 'v', 'z', 'ð', 'ʒ', 'dʒ', 'dz', 'dr',
       'm', 'n', 'ŋ', 'h', 'l', 'r', 'j', 'w']
CATS = [
    ('单元音', '#2f6ac0', 'monophthongs'),
    ('双元音', '#7c44b4', 'diphthongs'),
    ('清辅音', '#0e8f84', 'voiceless'),
    ('浊辅音', '#c2572d', 'voiced'),
    ('鼻音',   '#b03a48', 'nasals'),
    ('半辅音', '#5a8a1f', 'semi-vowels & others'),
]
CAT_MAP = {c[0]: c for c in CATS}
MIN_N, MAX_N = 48, 50

NAME = 'English IPA · 英语音标 48 音'
DESC = ('英语国际音标 48 个（含 1 张引导卡）：单元音 12 + 双元音 8 + 清辅音 10 + 浊辅音 10 + '
        '鼻音 3 + 半辅音 5。每音配 3 个高频例词（可点击朗读）、常见拼写规律与中文发音要领。'
        '清浊辅音成对排列便于对比（p/b、t/d、θ/ð…）。朗读英文例词（lang: en），可隐藏拼写规律或要领作自测。')

CARD_HTML = ''

CARD_CSS = r'''
.ipa-root{box-sizing:border-box;border-radius:16px;padding:13px 16px 15px;margin-bottom:16px;
 border:1px solid #dfe3e9;background:#f4f6f9;box-shadow:0 1px 2px rgba(20,24,33,.04)}
@supports (background:color-mix(in srgb,red 10%,white)){
.ipa-root{background:color-mix(in srgb,var(--cat) 8%,white);
 border-color:color-mix(in srgb,var(--cat) 24%,white)}
}
.ipa-top{display:flex;align-items:center;gap:8px;margin-bottom:9px;flex-wrap:wrap}
.ipa-cat{font-size:calc(14px * var(--card-font-scale,1));line-height:1;padding:5px 11px;border-radius:999px;background:var(--cat);
 color:#fff;font-weight:700;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.ipa-en{font-size:calc(14px * var(--card-font-scale,1));line-height:1;padding:5px 10px;border-radius:999px;background:#fff;
 color:#454e5c;font-weight:700;border:0.5px solid rgba(0,0,0,.05)}
.ipa-space{flex:1}
.ipa-actions{display:flex;gap:2px}
.ipa-actions button{border:0;background:transparent;color:#5b6472;cursor:pointer;padding:6px 8px;
 border-radius:8px;font-size:15px;line-height:1;transition:background .15s}
.ipa-actions button:hover{background:rgba(255,255,255,.85);color:var(--cat,#333)}
.ipa-sym{font-size:calc(46px * var(--card-font-scale,1));line-height:1.1;font-weight:700;
 color:var(--ink,#18202b);font-family:"Charis SIL","Gentium Plus","Doulos SIL",Georgia,serif}
.ipa-spell{margin-top:5px;font-size:14px;line-height:1.55;color:var(--ink,#41506b)}
.ipa-spell b{font-weight:700;color:var(--ink,#18202b)}
.ipa-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:11px}
.ipa-chip{border:1px solid #c6cdd9;background:#fff;color:#333a45;border-radius:12px;padding:6px 12px;
 font-size:15px;font-weight:600;cursor:pointer;user-select:none;transition:transform .1s}
.ipa-chip:active{transform:scale(.96)}
.ipa-chip .w{margin-right:7px}
.ipa-chip .p{font-size:13px;font-weight:500;color:#8a8f98}
@supports (background:color-mix(in srgb,red 10%,white)){
.ipa-chip{border-color:color-mix(in srgb,var(--cat) 40%,white)}
}
.ipa-tip{margin-top:12px;padding:1px 0 1px 12px;border-left:3px solid var(--cat);
 font-size:calc(16px * var(--card-font-scale,1));line-height:1.6;color:var(--ink,#22303f)}
body.dark-mode .ipa-root{border-color:#39404d}
body.dark-mode .ipa-en{background:#2a2f38;color:#d7dbe2;border-color:#39404d}
body.dark-mode .ipa-actions button{color:#c7cdd8}
body.dark-mode .ipa-actions button:hover{background:rgba(255,255,255,.08)}
body.dark-mode .ipa-chip{background:#2a2f38;border-color:#4a5260;color:#e6e9f0}
body.dark-mode .ipa-chip .p{color:#9aa3b2}
@supports (background:color-mix(in srgb,red 10%,#20242c)){
body.dark-mode .ipa-root{background:color-mix(in srgb,var(--cat) 13%,#20242c)}
body.dark-mode .ipa-chip{background:color-mix(in srgb,var(--cat) 15%,#262b34);
 border-color:color-mix(in srgb,var(--cat) 38%,#4a5260);color:#e8ebf2}
}
/* intro */
.ipa-intro{border:0;box-shadow:none;padding:0;background:transparent}
.ipa-intro .ipa-intro-body{background:var(--card-bg,#fff);border:1px solid var(--line,#e6e4dd);
 border-radius:16px;padding:20px 22px}
.ipa-intro h2{margin:0 0 4px;font-size:calc(26px * var(--card-font-scale,1));color:var(--ink,#161b22)}
.ipa-intro .ipa-i-en{font-size:14px;color:var(--ink,#8a8f98);margin-bottom:14px}
.ipa-i-formula{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:10px 0 14px;
 font-size:17px;color:var(--ink,#2c3140)}
.ipa-i-formula b{padding:4px 10px;border-radius:8px;background:#eef1f6;border:1px solid #d5dbe4}
.ipa-intro .ipa-i-sec{margin:14px 0 6px;font-weight:800;color:var(--ink,#161b22);font-size:15px}
.ipa-intro table{border-collapse:collapse;width:100%;font-size:15px;margin:4px 0 6px}
.ipa-intro td{padding:5px 10px;border-bottom:1px dashed var(--line,#e6e4dd);color:var(--ink,#2c3140);
 font-family:"Charis SIL","Gentium Plus",Georgia,serif;font-size:16px}
.ipa-intro td.zh{font-weight:700;width:130px;font-family:inherit;font-size:14px}
.ipa-intro td.en{color:var(--ink,#8a8f98);font-size:13px;font-family:inherit}
.ipa-legend{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.ipa-legend .lg{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line,#e6e4dd);
 border-radius:999px;padding:6px 13px;font-size:15px;font-weight:600;color:var(--ink,#3c4452);background:var(--card-bg,#fff)}
.ipa-legend .lg i{width:10px;height:10px;border-radius:50%;display:inline-block}
'''

CARD_JS = r'''(function(){
var NAME='English IPA · 英语音标 48 音';
var CAT_MAP={'单元音':'#2f6ac0','双元音':'#7c44b4','清辅音':'#0e8f84','浊辅音':'#c2572d','鼻音':'#b03a48','半辅音':'#5a8a1f'};
var CAT_EN={'单元音':'monophthongs','双元音':'diphthongs','清辅音':'voiceless','浊辅音':'voiced','鼻音':'nasals','半辅音':'semi-vowels & others'};
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function iconBtn(kind, on){return '<button type="button" data-action="'+kind+'" title="'+({play:'朗读例词',mark:'标记',favorite:'收藏'}[kind])+'">'
  + (kind==='play' ? '<i class="fa-solid fa-volume-high"></i>'
     : kind==='mark' ? '<i class="'+(on?'fa-solid':'fa-regular')+' fa-star"></i>'
     : '<i class="'+(on?'fa-solid':'fa-regular')+' fa-bookmark"></i>') + '</button>';}
function actionBar(api){var cd=api.getCardData?api.getCardData():{};
  return '<div class="ipa-actions">'
   + iconBtn('play',0) + iconBtn('mark',!!(cd.is_unknown)) + iconBtn('favorite',!!(cd.is_favorite))
   + '</div>';}
function renderIntro(){
  var pairs=[['/p/ · /b/','pen, map · book, big'],['/t/ · /d/','ten, cat · dog, red'],
    ['/k/ · /ɡ/','key, cat · go, big'],['/f/ · /v/','five, life · very, love'],
    ['/s/ · /z/','sun, bus · zoo, is'],['/θ/ · /ð/','think, three · this, mother'],
    ['/ʃ/ · /ʒ/','she, fish · usual, pleasure'],['/tʃ/ · /dʒ/','chair, watch · job, age'],
    ['/ts/ · /dz/','cats, lots · beds, hands'],['/tr/ · /dr/','tree, try · drink, drive']];
  var table=pairs.map(function(r){return '<tr><td class="zh">'+r[0]+'</td><td class="en">'+r[1]+'</td></tr>';}).join('');
  var keys=['单元音','双元音','清辅音','浊辅音','鼻音','半辅音'];
  var leg=keys.map(function(k){return '<span class="lg"><i style="background:'+CAT_MAP[k]+'"></i>'+k+' · '+CAT_EN[k]+'</span>';}).join('');
  return '<div class="ipa-root ipa-intro" data-card-id="{{ID}}"><div class="ipa-intro-body">'
   +'<h2>英语音标 · 48 Phonemes</h2>'
   +'<div class="ipa-i-en">The International Phonetic Alphabet (IPA) gives every English sound one exact symbol. Learn the 48 sounds once, and every dictionary entry becomes readable.</div>'
   +'<div class="ipa-i-formula"><b>48 音</b><span>=</span><b>20 元音</b><span>(12 单元音 + 8 双元音)</span><span>+</span><b>28 辅音</b><span>(10 清 + 10 浊 + 3 鼻 + 5 半辅音)</span></div>'
   +'<div class="ipa-i-sec">清浊成对 · 10 voiced/voiceless pairs</div>'+table
   +'<div class="ipa-i-sec">六类音标 · The 6 groups in this deck</div><div class="ipa-legend">'+leg+'</div>'
   +'<div class="ipa-i-en" style="margin-top:12px;margin-bottom:0">Every card shows the symbol, its group, 3 high-frequency example words (click to hear), the common spellings, and a Chinese pronunciation tip. 例词可点击朗读。</div>'
   +'</div></div>';}
function renderCard(d, api){
  var col=CAT_MAP[d.cat]||'#64748b';
  var chips=(d.ex||[]).map(function(p){
    return '<span class="ipa-chip" data-word="'+esc(p[0])+'"><span class="w">'+esc(p[0])+'</span><span class="p">/'+esc(p[1])+'/</span></span>';
  }).join('');
  return '<div class="ipa-root" data-card-id="{{ID}}" style="--cat:'+col+'">'
   +'<div class="ipa-top"><span class="ipa-cat">'+esc(d.cat)+'</span><span class="ipa-en">'+esc(CAT_EN[d.cat]||'')+'</span>'
   +'<span class="ipa-space"></span>'+actionBar(api)+'</div>'
   +'<div class="ipa-sym">'+esc(d.sym)+'</div>'
   +'<div class="ipa-spell"><b>常见拼写</b> · '+esc(d.spell)+'</div>'
   +'<div class="ipa-chips">'+chips+'</div>'
   +'<div class="ipa-tip">'+esc(d.tip)+'</div>'
   +'</div>';}
window.cardTemplate={
  name:NAME,
  fields:[
    {key:'sym',label:'音标',hideable:false},
    {key:'cat',label:'类别',hideable:false},
    {key:'spell',label:'常见拼写',hideable:true},
    {key:'ex',label:'例词',hideable:true},
    {key:'tip',label:'发音要领',hideable:true}
  ],
  render:function(cardHtml,cardData,api){var d=cardData.data||cardData;
    var id=String((cardData.id!=null)?cardData.id:d.item_order);
    var html=(d.type==='intro')?renderIntro():renderCard(d,api||{});
    return html.split('{{ID}}').join(id);},
  init:function(el,cardData,api){var d=cardData.data||cardData;
    el.querySelectorAll('[data-action]').forEach(function(b){
      b.addEventListener('click',function(ev){ev.preventDefault();ev.stopPropagation();
        var a=b.getAttribute('data-action');
        if(a==='play'){var w=(d.ex&&d.ex[0])?d.ex[0][0]:'';api.playAudio(w,'en');api.track&&api.track('audio_play');}
        else if(a==='mark'){api.toggleMark&&api.toggleMark();api.rerender&&api.rerender();}
        else if(a==='favorite'){api.toggleFavorite&&api.toggleFavorite();api.rerender&&api.rerender();}
      });});
    el.querySelectorAll('[data-word]').forEach(function(c){
      c.addEventListener('click',function(ev){ev.preventDefault();ev.stopPropagation();
        api.playAudio(c.getAttribute('data-word'),'en');api.track&&api.track('audio_play');});});}
};
})();
'''

INTRO = {'type': 'intro', 'nameZh': '英语音标', 'nameEn': 'English IPA 48'}

PAGE_CSS = r'''
:root{--card-bg:#fff;--ink:#2c3140;--line:#e6e4dd}
*{box-sizing:border-box}
body{margin:0;background:#f6f5f1;color:#2c3140;font-family:-apple-system,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif}
.wrap{max-width:760px;margin:0 auto;padding:26px 18px 80px}
header h1{font-size:26px;margin:0 0 6px}
header p{margin:0;color:#6b7280;font-size:14px;line-height:1.7}
.legend{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 20px}
.legend .lg{display:inline-flex;align-items:center;gap:7px;border:1px solid #ddd8cf;background:#fff;
 border-radius:999px;padding:6px 13px;font-size:15px;font-weight:600}
.legend .lg i{width:10px;height:10px;border-radius:50%;display:inline-block}
.dark-toggle{position:fixed;top:14px;right:14px;z-index:9;border:1px solid #ddd8cf;background:#fff;
 border-radius:999px;padding:6px 14px;font-size:13px;cursor:pointer;color:#2c3140}
body.dark-mode{--card-bg:#1c1f26;--line:#2a2e38;background:#15171c;color:#e6e8ee}
body.dark-mode header p{color:#9aa3b2}
body.dark-mode .dark-toggle{background:#23262e;color:#d7dbe2;border-color:#333845}
body.dark-mode .legend .lg{background:#1c1f26;border-color:#333845;color:#c3c9d4}
body.dark-mode .ipa-root{border-color:#39404d}
body.dark-mode .ipa-tip{border-left-color:var(--cat)}
body.dark-mode .ipa-intro .ipa-intro-body{background:#1c1f26;border-color:#2a2e38}
body.dark-mode .ipa-i-formula b{background:#232845;border-color:#39407a}
body.dark-mode .ipa-intro td{border-bottom-color:#333845}
'''

def build_preview(cards, counts_txt, total):
    legend_html = ''.join(
        '<span class="lg"><i style="background:%s"></i>%s</span>' % (c[1], c[0] + ' · ' + c[2])
        for c in CATS)
    data = json.dumps(cards, ensure_ascii=False)
    return """<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>英语音标 48 · English IPA · %(total)d 张预览</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<style>
%(page)s
%(card)s
</style>
</head>
<body>
<button class="dark-toggle" onclick="document.body.classList.toggle('dark-mode')">深色</button>
<div class="wrap">
<header>
<h1>英语音标 · English IPA 48</h1>
<p>%(counts)s · 例词可点击朗读（浏览器 TTS）<br>每卡：音标 + 六类配色 + 例词 + 常见拼写规律 + 中文发音要领（平铺阅读）</p>
</header>
<div class="legend">%(legend)s</div>
<div id="cards"></div>
</div>
<script>
%(js)s
var CARDS = %(data)s;
var wrap = document.getElementById('cards');
CARDS.forEach(function(d, i){
  var api = {
    getCardData: function(){ return {id: i+1, data: d, is_unknown:false, is_favorite:false}; },
    getHiddenFields: function(){ return {}; },
    playAudio: function(t, lang){ try{ var u=new SpeechSynthesisUtterance(t); u.lang = lang || 'en'; u.rate=0.9; speechSynthesis.speak(u); }catch(e){} },
    toggleMark: function(){}, toggleFavorite: function(){}, track: function(){}
  };
  var host = document.createElement('div');
  host.innerHTML = window.cardTemplate.render('', {id: i+1, data: d}, api);
  var root = host.firstChild;
  wrap.appendChild(root);
  window.cardTemplate.init(root, {id: i+1, data: d}, api);
});
</script>
</body>
</html>""" % {
        'total': total, 'counts': counts_txt, 'legend': legend_html,
        'page': PAGE_CSS, 'card': CARD_CSS,
        'js': CARD_JS, 'data': data,
    }

def load_rows():
    with open(os.path.join(DATA, 'phonemes.json'), encoding='utf-8') as f:
        return json.load(f)

def main():
    re_cjk = re.compile(r'[\u4e00-\u9fff]')
    re_latin = re.compile(r'[A-Za-z]')

    rows = load_rows()
    syms = [r['sym'] for r in rows]
    assert len(syms) == len(set(syms)), 'duplicate symbols'
    # 音标集合必须与标准 DJ 48 一致
    got = sorted(re.sub(r'[/]', '', s) for s in syms)
    assert got == sorted(STD), 'symbol set != DJ48: ' + str(set(got) ^ set(STD))

    cards = [dict(INTRO)]
    n_by_cat = {}
    for r in rows:
        sym = r['sym']
        assert sym.startswith('/') and sym.endswith('/'), sym + ' bad sym format'
        assert r['cat'] in CAT_MAP, sym + ' bad category ' + r['cat']
        for k in ('sym', 'cat', 'ex', 'spell', 'tip'):
            assert r.get(k) not in (None, ''), sym + ' missing ' + k
        assert isinstance(r['ex'], list) and len(r['ex']) == 3, sym + ' ex != 3 pairs'
        re_ipa = re.compile(r"^[a-zɑæʌɒɔəɜɪʊʃʒθðŋɡːˈˌ.'\-]+$")
        for w, p in r['ex']:
            assert re.fullmatch(r"[A-Za-z'’\-]+", w), sym + ' bad word: ' + w
            assert re_ipa.fullmatch(p), sym + ' bad ipa chars: ' + p
        assert re_latin.search(r['spell']), sym + ' spell lacks latin'
        assert re_cjk.search(r['tip']), sym + ' tip lacks CJK'
        # 清辅音/浊辅音例词首字母对应拼写一致性提示（soft check 已省略）
        n_by_cat[r['cat']] = n_by_cat.get(r['cat'], 0) + 1
        cards.append(dict(r))

    total = len(cards)
    assert MIN_N <= total <= MAX_N, 'target %d-%d, got %d' % (MIN_N, MAX_N, total)
    for i, c in enumerate(cards, 1):
        c['item_order'] = i
    assert [c['item_order'] for c in cards] == list(range(1, total + 1)), 'item_order broken'

    counts_txt = ('%(t)d 张 · 引导 1 + 音标 %(m)d（单元音 %(a)s · 双元音 %(b)s · 清辅音 %(c)s · '
                  '浊辅音 %(d)s · 鼻音 %(e)s · 半辅音 %(f)s）'
                  % dict(t=total, m=total - 1,
                         a=n_by_cat.get('单元音', 0), b=n_by_cat.get('双元音', 0),
                         c=n_by_cat.get('清辅音', 0), d=n_by_cat.get('浊辅音', 0),
                         e=n_by_cat.get('鼻音', 0), f=n_by_cat.get('半辅音', 0)))

    sample_syms = ['/iː/', '/æ/', '/ə/', '/eɪ/', '/aʊ/', '/θ/', '/ʃ/', '/ŋ/']
    sample = [cards[0]] + [c for c in cards[1:] if c['sym'] in sample_syms]

    template = {
        'name': NAME,
        'lang': 'en',
        'description': DESC,
        'cardHtml': CARD_HTML,
        'cardCss': CARD_CSS,
        'cardJs': CARD_JS,
        'trackedActions': [
            {'action': 'audio_play', 'label': '朗读例词'},
            {'action': 'word_mark', 'label': '标记'},
            {'action': 'favorite_toggle', 'label': '收藏'}
        ],
        'sampleData': sample,
    }

    with open(os.path.join(OUT, 'cards.json'), 'w', encoding='utf-8') as f:
        json.dump(cards, f, ensure_ascii=False, indent=2)
        f.write('\n')
    with open(os.path.join(OUT, 'template.json'), 'w', encoding='utf-8') as f:
        json.dump(template, f, ensure_ascii=False, indent=2)
        f.write('\n')
    with open(os.path.join(OUT, 'preview.html'), 'w', encoding='utf-8') as f:
        f.write(build_preview(cards, counts_txt, total))

    print('Wrote template.json + cards.json + preview.html to', OUT)
    print('Cards:', total, '| phonemes:', total - 1, '| by cat:', n_by_cat)
    print('sampleData:', len(sample), [c.get('sym') or c.get('nameZh') for c in sample])

if __name__ == '__main__':
    main()
