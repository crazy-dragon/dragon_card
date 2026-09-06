#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_phonics.py — English Phonics 自然拼读规则卡生成器
=====================================================
产物（写入本目录）：template.json / cards.json / preview.html

结构：intro 引导卡 1 张 + 规则卡（四章）
  字母基础 32（单字母常规音 + 软硬音 + y 三读）
  字母组合 49（辅音/元音组合 + 静音组合 + -tion/-ture 等）
  音节重音 10（开闭音节 / 重音规律 / schwa / -le）
  人名地名 18（-ham/-bury/-cester 后缀 + 爱尔兰名 + 陷阱特例）

数据文件 data/rules.json
  每行: sec / pattern(大字展示) / sound(读音标签) / ex[[word, ipa]x3]
        / rule(英释,可含中文) / tip(中文要领,必须含中文)

校验：
  - sec 必须在四章内；pattern/sound 非空
  - ex 3 对：word 纯拉丁；ipa 只允许 IPA 白名单字符
  - rule 含拉丁字母；tip 必须含中文
  - 朗读 lang=en（读英文例词/地名）
"""
import json
import os
import re

DECK = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(DECK, 'data')
OUT = DECK

SECTIONS = [
    ('字母基础', '#2f6ac0', 'single letters'),
    ('字母组合', '#7c44b4', 'letter teams'),
    ('音节重音', '#0e8f84', 'syllables & stress'),
    ('人名地名', '#c2572d', 'names & places'),
]
SEC_MAP = {s[0]: s for s in SECTIONS}
MIN_N, MAX_N = 100, 130

NAME = 'English Phonics · 自然拼读规则'
DESC = ('英语自然拼读 109 条规则（含 1 张引导卡）：字母基础 32 + 字母组合 49 + 音节重音 10 + '
        '人名地名 18。每条配 3 个高频例词（可点击朗读）、规则说明与中文要领。'
        '人名地名专章覆盖 -ham/-bury/-cester 后缀规律与 Leicester/Sean/Thames 等经典特例。'
        '朗读英文例词（lang: en），可隐藏规则或要领作自测。')

CARD_HTML = ''

CARD_CSS = r'''
.ph-root{box-sizing:border-box;border-radius:16px;padding:13px 16px 15px;margin-bottom:16px;
 border:1px solid #dfe3e9;background:#f4f6f9;box-shadow:0 1px 2px rgba(20,24,33,.04)}
@supports (background:color-mix(in srgb,red 10%,white)){
.ph-root{background:color-mix(in srgb,var(--cat) 8%,white);
 border-color:color-mix(in srgb,var(--cat) 24%,white)}
}
.ph-top{display:flex;align-items:center;gap:8px;margin-bottom:9px;flex-wrap:wrap}
.ph-sec{font-size:calc(14px * var(--card-font-scale,1));line-height:1;padding:5px 11px;border-radius:999px;
 background:var(--cat);color:#fff;font-weight:700;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.ph-en{font-size:calc(14px * var(--card-font-scale,1));line-height:1;padding:5px 10px;border-radius:999px;
 background:#fff;color:#454e5c;font-weight:700;border:0.5px solid rgba(0,0,0,.05)}
.ph-space{flex:1}
.ph-actions{display:flex;gap:2px}
.ph-actions button{border:0;background:transparent;color:#5b6472;cursor:pointer;padding:6px 8px;
 border-radius:8px;font-size:15px;line-height:1;transition:background .15s}
.ph-actions button:hover{background:rgba(255,255,255,.85);color:var(--cat,#333)}
.ph-main{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.ph-pat{font-size:calc(38px * var(--card-font-scale,1));line-height:1.15;font-weight:800;
 color:var(--ink,#18202b);letter-spacing:.5px}
.ph-sound{font-size:calc(19px * var(--card-font-scale,1));font-weight:700;color:var(--cat,#454e5c);
 font-family:"Charis SIL","Gentium Plus","Doulos SIL",Georgia,serif}
.ph-rule{margin-top:6px;font-size:14px;line-height:1.55;color:var(--ink,#41506b)}
.ph-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:11px}
.ph-chip{border:1px solid #c6cdd9;background:#fff;color:#333a45;border-radius:12px;padding:6px 12px;
 font-size:15px;font-weight:600;cursor:pointer;user-select:none;transition:transform .1s}
.ph-chip:active{transform:scale(.96)}
.ph-chip .w{margin-right:7px}
.ph-chip .p{font-size:13px;font-weight:500;color:#8a8f98;
 font-family:"Charis SIL","Gentium Plus",Georgia,serif}
@supports (background:color-mix(in srgb,red 10%,white)){
.ph-chip{border-color:color-mix(in srgb,var(--cat) 40%,white)}
}
.ph-tip{margin-top:12px;padding:1px 0 1px 12px;border-left:3px solid var(--cat);
 font-size:calc(16px * var(--card-font-scale,1));line-height:1.6;color:var(--ink,#22303f)}
body.dark-mode .ph-root{border-color:#39404d}
body.dark-mode .ph-en{background:#2a2f38;color:#d7dbe2;border-color:#39404d}
body.dark-mode .ph-actions button{color:#c7cdd8}
body.dark-mode .ph-actions button:hover{background:rgba(255,255,255,.08)}
body.dark-mode .ph-chip{background:#2a2f38;border-color:#4a5260;color:#e6e9f0}
body.dark-mode .ph-chip .p{color:#9aa3b2}
@supports (background:color-mix(in srgb,red 10%,#20242c)){
body.dark-mode .ph-root{background:color-mix(in srgb,var(--cat) 13%,#20242c)}
body.dark-mode .ph-chip{background:color-mix(in srgb,var(--cat) 15%,#262b34);
 border-color:color-mix(in srgb,var(--cat) 38%,#4a5260);color:#e8ebf2}
}
/* intro */
.ph-intro{border:0;box-shadow:none;padding:0;background:transparent}
.ph-intro .ph-intro-body{background:var(--card-bg,#fff);border:1px solid var(--line,#e6e4dd);
 border-radius:16px;padding:20px 22px}
.ph-intro h2{margin:0 0 4px;font-size:calc(26px * var(--card-font-scale,1));color:var(--ink,#161b22)}
.ph-intro .ph-i-en{font-size:14px;color:var(--ink,#8a8f98);margin-bottom:14px}
.ph-i-formula{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:10px 0 14px;
 font-size:17px;color:var(--ink,#2c3140)}
.ph-i-formula b{padding:4px 10px;border-radius:8px;background:#eef1f6;border:1px solid #d5dbe4}
.ph-intro .ph-i-sec{margin:14px 0 6px;font-weight:800;color:var(--ink,#161b22);font-size:15px}
.ph-intro table{border-collapse:collapse;width:100%;font-size:15px;margin:4px 0 6px}
.ph-intro td{padding:5px 10px;border-bottom:1px dashed var(--line,#e6e4dd);color:var(--ink,#2c3140)}
.ph-intro td.zh{font-weight:700;width:150px}
.ph-intro td.en{color:var(--ink,#8a8f98);font-size:13px}
.ph-legend{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.ph-legend .lg{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line,#e6e4dd);
 border-radius:999px;padding:6px 13px;font-size:15px;font-weight:600;color:var(--ink,#3c4452);
 background:var(--card-bg,#fff)}
.ph-legend .lg i{width:10px;height:10px;border-radius:50%;display:inline-block}
'''

CARD_JS = r'''(function(){
var NAME='English Phonics · 自然拼读规则';
var SEC_MAP={'字母基础':'#2f6ac0','字母组合':'#7c44b4','音节重音':'#0e8f84','人名地名':'#c2572d'};
var SEC_EN={'字母基础':'single letters','字母组合':'letter teams','音节重音':'syllables & stress','人名地名':'names & places'};
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function iconBtn(kind, on){return '<button type="button" data-action="'+kind+'" title="'+({play:'朗读例词',mark:'标记',favorite:'收藏'}[kind])+'">'
  + (kind==='play' ? '<i class="fa-solid fa-volume-high"></i>'
     : kind==='mark' ? '<i class="'+(on?'fa-solid':'fa-regular')+' fa-star"></i>'
     : '<i class="'+(on?'fa-solid':'fa-regular')+' fa-bookmark"></i>') + '</button>';}
function actionBar(api){var cd=api.getCardData?api.getCardData():{};
  return '<div class="ph-actions">'
   + iconBtn('play',0) + iconBtn('mark',!!(cd.is_unknown)) + iconBtn('favorite',!!(cd.is_favorite))
   + '</div>';}
function renderIntro(){
  var traps=[['-ough','though /ðəʊ/ · through /θruː/ · tough /tʌf/ · cough /kɒf/'],
    ['-cester','Leicester /ˈlestə/ · Worcester /ˈwʊstə/ · Gloucester /ˈɡlɒstə/'],
    ['-wich','Greenwich /ˈɡrenɪtʃ/ · Norwich /ˈnɒrɪdʒ/ · Ipswich /ˈɪpswɪtʃ/'],
    ['爱尔兰名','Sean /ʃɔːn/ · Siobhán /ʃɪˈvɔːn/ · Niamh /niːv/ · Aoife /ˈiːfə/'],
    ['ou / ow','soup /suːp/ · young /jʌŋ/ · cow /kaʊ/ · snow /snəʊ/'],
    ['贵族姓氏','Cholmondeley /ˈtʃʌmli/ · Featherstonehaugh /ˈfænʃɔː/ · St. John /ˈsɪndʒən/']];
  var t=traps.map(function(r){return '<tr><td class="zh">'+r[0]+'</td><td class="en">'+r[1]+'</td></tr>';}).join('');
  var keys=['字母基础','字母组合','音节重音','人名地名'];
  var leg=keys.map(function(k){return '<span class="lg"><i style="background:'+SEC_MAP[k]+'"></i>'+k+' · '+SEC_EN[k]+'</span>';}).join('');
  return '<div class="ph-root ph-intro" data-card-id="{{ID}}"><div class="ph-intro-body">'
   +'<h2>自然拼读 · Phonics Rules</h2>'
   +'<div class="ph-i-en">Phonics maps spelling to sound: not "what a word means" but "how it is pronounced". IPA tells you the sound; phonics tells you why the letters make it — including names like Leicester and Sean.</div>'
   +'<div class="ph-i-formula"><b>109 条</b><span>=</span><b>字母基础 32</b><span>+</span><b>字母组合 49</b><span>+</span><b>音节重音 10</b><span>+</span><b>人名地名 18</b></div>'
   +'<div class="ph-i-sec">高频陷阱 · Famous traps in this deck</div>'+t
   +'<div class="ph-i-sec">四章结构 · The 4 sections</div><div class="ph-legend">'+leg+'</div>'
   +'<div class="ph-i-en" style="margin-top:12px;margin-bottom:0">Every card shows the pattern, its sound(s), 3 example words (click to hear), the rule, and a Chinese tip. 例词可点击朗读。</div>'
   +'</div></div>';}
function renderCard(d, api){
  var col=SEC_MAP[d.sec]||'#64748b';
  var chips=(d.ex||[]).map(function(p){
    return '<span class="ph-chip" data-word="'+esc(p[0])+'"><span class="w">'+esc(p[0])+'</span><span class="p">/'+esc(p[1])+'/</span></span>';
  }).join('');
  return '<div class="ph-root" data-card-id="{{ID}}" style="--cat:'+col+'">'
   +'<div class="ph-top"><span class="ph-sec">'+esc(d.sec)+'</span><span class="ph-en">'+esc(SEC_EN[d.sec]||'')+'</span>'
   +'<span class="ph-space"></span>'+actionBar(api)+'</div>'
   +'<div class="ph-main"><span class="ph-pat">'+esc(d.pattern)+'</span><span class="ph-sound">'+esc(d.sound)+'</span></div>'
   +'<div class="ph-rule">'+esc(d.rule)+'</div>'
   +'<div class="ph-chips">'+chips+'</div>'
   +'<div class="ph-tip">'+esc(d.tip)+'</div>'
   +'</div>';}
window.cardTemplate={
  name:NAME,
  fields:[
    {key:'pattern',label:'拼读模式',hideable:false},
    {key:'sound',label:'读音',hideable:false},
    {key:'sec',label:'章节',hideable:false},
    {key:'rule',label:'规则',hideable:true},
    {key:'ex',label:'例词',hideable:true},
    {key:'tip',label:'中文要领',hideable:true}
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

INTRO = {'type': 'intro', 'nameZh': '自然拼读', 'nameEn': 'English Phonics'}

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
body.dark-mode .ph-root{border-color:#39404d}
body.dark-mode .ph-tip{border-left-color:var(--cat)}
body.dark-mode .ph-intro .ph-intro-body{background:#1c1f26;border-color:#2a2e38}
body.dark-mode .ph-i-formula b{background:#232845;border-color:#39407a}
body.dark-mode .ph-intro td{border-bottom-color:#333845}
'''

def build_preview(cards, counts_txt, total):
    legend_html = ''.join(
        '<span class="lg"><i style="background:%s"></i>%s · %s</span>' % (s[1], s[0], s[2])
        for s in SECTIONS)
    data = json.dumps(cards, ensure_ascii=False)
    return """<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>自然拼读 · English Phonics · %(total)d 张预览</title>
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
<h1>自然拼读 · English Phonics Rules</h1>
<p>%(counts)s · 例词可点击朗读（浏览器 TTS）<br>每卡：拼读模式 + 读音 + 例词 + 规则 + 中文要领（平铺阅读）</p>
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
    with open(os.path.join(DATA, 'rules.json'), encoding='utf-8') as f:
        return json.load(f)

def main():
    re_cjk = re.compile(r'[\u4e00-\u9fff]')
    re_ipa = re.compile(r"^[a-zɑæʌɒɔəɜɪʊʃʒθðŋɡːˈˌ.'\-· ]+$")
    re_latin = re.compile(r'[A-Za-z]')

    rows = load_rows()
    seen = set()
    for r in rows:
        key = (r['sec'], r['pattern'], r['sound'])
        assert key not in seen, 'duplicate: ' + str(key)
        seen.add(key)

    cards = [dict(INTRO)]
    n_by_sec = {}
    for r in rows:
        sec, pat = r['sec'], r['pattern']
        assert sec in SEC_MAP, pat + ' bad section ' + sec
        for k in ('pattern', 'sound', 'ex', 'rule', 'tip'):
            assert r.get(k) not in (None, ''), pat + ' missing ' + k
        assert isinstance(r['ex'], list) and len(r['ex']) == 3, pat + ' ex != 3 pairs'
        for w, p in r['ex']:
            assert re.fullmatch(r"[A-Za-z .'’ÁáÉé\-]+", w), pat + ' bad word: ' + w
            assert re_ipa.fullmatch(p), pat + ' bad ipa chars: ' + p
        assert re_latin.search(r['rule']), pat + ' rule lacks latin'
        assert re_cjk.search(r['tip']), pat + ' tip lacks CJK'
        n_by_sec[sec] = n_by_sec.get(sec, 0) + 1
        cards.append(dict(r))

    total = len(cards)
    assert MIN_N <= total <= MAX_N, 'target %d-%d, got %d' % (MIN_N, MAX_N, total)
    for i, c in enumerate(cards, 1):
        c['item_order'] = i
    assert [c['item_order'] for c in cards] == list(range(1, total + 1)), 'item_order broken'

    counts_txt = ('%(t)d 张 · 引导 1 + 规则 %(m)d（字母基础 %(a)s · 字母组合 %(b)s · '
                  '音节重音 %(c)s · 人名地名 %(d)s）'
                  % dict(t=total, m=total - 1,
                         a=n_by_sec.get('字母基础', 0), b=n_by_sec.get('字母组合', 0),
                         c=n_by_sec.get('音节重音', 0), d=n_by_sec.get('人名地名', 0)))

    sample_pats = [('字母基础', 'a'), ('字母基础', 'c (软音)'), ('字母组合', 'th (浊)'),
                   ('字母组合', '-ough'), ('字母组合', 'ou'), ('音节重音', 'schwa /ə/'),
                   ('人名地名', '-cester'), ('人名地名', '爱尔兰名 I')]
    pool = {(r['sec'], r['pattern']): r for r in rows}
    sample = [cards[0]] + [dict(pool[k]) for k in sample_pats if k in pool]
    assert len(sample) == 9, len(sample)

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
    print('Cards:', total, '| rules:', total - 1, '| by sec:', n_by_sec)
    print('sampleData:', len(sample), [c.get('pattern') or c.get('nameZh') for c in sample])

if __name__ == '__main__':
    main()
