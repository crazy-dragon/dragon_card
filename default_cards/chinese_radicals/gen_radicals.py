#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate the Chinese Radicals (汉字部首 214) deck: cards.json + template.json + preview.html.

Data: data/radicals_a.json (nos 1-110) + data/radicals_b.json (nos 111-214).
HSK cross-validation: examples tagged with the shortest HSK word containing the char.
"""
import json
import os
import re
import subprocess

BASE = os.path.dirname(os.path.abspath(__file__))
HSK_PATH = '/Users/alfred/CodeBase/Python/memory_market_goods/hsk1-9/cards.json'

NAME = 'Chinese Radicals · 汉字部首 214'
LANG = 'zh'

# Big glyph display override: learner-recognizable variant form.
DISP = {
    9: '亻', 18: '刂', 61: '忄', 64: '扌', 66: '攵', 85: '氵', 90: '丬',
    94: '犭', 96: '王', 113: '礻', 120: '纟', 140: '艹', 146: '西',
    147: '见', 149: '讠', 154: '贝', 159: '车', 162: '辶', 163: '阝',
    167: '钅', 168: '长', 169: '门', 170: '阝', 174: '青', 178: '韦',
    181: '页', 182: '风', 183: '飞', 184: '饣', 187: '马', 195: '鱼',
    196: '鸟', 197: '卤', 199: '麦', 201: '黄', 205: '黾', 210: '齐',
    211: '齿', 212: '龙', 213: '龟',
}

BAND_MAP = [
    ('1-2', range(1, 3), '#2f6ac0'),
    ('3-4', range(3, 5), '#0e8f84'),
    ('5-6', range(5, 7), '#7c44b4'),
    ('7-9', range(7, 10), '#c2572d'),
    ('10+', range(10, 99), '#64748b'),
]

LV_TEXT = {'1': 'HSK1', '2': 'HSK2', '3': 'HSK3', '4': 'HSK4', '5': 'HSK5',
           '6': 'HSK6', '7-9': 'HSK7-9'}


def band_of(st):
    for label, rng, color in BAND_MAP:
        if st in rng:
            return label, color
    return '10+', '#64748b'


def load_data():
    rows = []
    for part in ('radicals_a.json', 'radicals_b.json'):
        with open(os.path.join(BASE, 'data', part), encoding='utf-8') as f:
            rows += json.load(f)
    assert len(rows) == 214, f'expected 214 radicals, got {len(rows)}'
    nos = [r['no'] for r in rows]
    assert len(set(nos)) == 214, 'duplicate radical numbers'
    with open(os.path.join(BASE, 'data', 'en_patch.json'), encoding='utf-8') as f:
        patch = json.load(f)
    missing = [r['no'] for r in rows if str(r['no']) not in patch]
    assert not missing, f'en_patch missing radicals: {missing}'
    for r in rows:
        p = patch[str(r['no'])]
        if 'en' in p:
            r['en'] = p['en']
        r['semEn'] = p['semEn']
        r['tipEn'] = p['tipEn']
    for r in rows:
        for k in ('no', 'char', 'nameZh', 'py', 'en', 'st', 'var', 'core', 'sem', 'ex', 'tip'):
            assert k in r, f"radical {r.get('no')} missing key {k}"
        assert 1 <= len(r['ex']) <= 3, f"radical {r['no']} bad example count"
        for e in r['ex']:
            assert len(e) == 3, f"radical {r['no']} bad example tuple"
        assert re.search(r'[\u4e00-\u9fff]', r['tip']), f"radical {r['no']} tip lacks Chinese"
        assert re.search(r'[A-Za-z]{2}', r['semEn']), f"radical {r['no']} semEn lacks English"
        assert re.search(r'[A-Za-z]{2}', r['tipEn']), f"radical {r['no']} tipEn lacks English"
        # en gloss: no dictionary jargon leftovers
        assert r['en'] not in ('dotted cliff', 'bristle', 'seal', 'leaf', 'bolt of cloth',
                               'hiding enclosure', 'rap, tap', 'son; legs'), f"radical {r['no']} jargon en: {r['en']}"
    return rows


def load_hsk():
    with open(HSK_PATH, encoding='utf-8') as f:
        words = json.load(f)
    char_map = {}  # char -> list of (word, pinyin, level)
    for w in words:
        for ch in w['word']:
            char_map.setdefault(ch, []).append((w['word'], w['pinyin'], w['level']))
    return char_map


def best_hsk_word(char_map, ch):
    cands = char_map.get(ch)
    if not cands:
        return None
    def key(t):
        # prefer 2+ char words (show usage), then shortest, then lowest level
        lv = int(t[2].split('-')[0]) if t[2][0].isdigit() else 9
        return (0 if len(t[0]) >= 2 else 1, len(t[0]), lv)
    w, p, lv = sorted(cands, key=key)[0]
    return {'w': w, 'wp': p, 'lv': LV_TEXT.get(lv, 'HSK7-9') if lv[0].isdigit() else 'HSK7-9'}


CARD_CSS = r'''
.zr-root{box-sizing:border-box;border-radius:16px;padding:13px 16px 15px;margin-bottom:16px;
 border:1px solid #dfe3e9;background:#f4f6f9;box-shadow:0 1px 2px rgba(20,24,33,.04)}
@supports (background:color-mix(in srgb,red 10%,white)){
.zr-root{background:color-mix(in srgb,var(--cat) 8%,white);
 border-color:color-mix(in srgb,var(--cat) 24%,white)}
}
.zr-top{display:flex;align-items:center;gap:7px;margin-bottom:9px;flex-wrap:wrap}
.zr-chip{font-size:12px;line-height:1;padding:4px 9px;border-radius:999px;background:#fff;
 color:#454e5c;font-weight:700;border:0.5px solid rgba(0,0,0,.05)}
@supports (background:color-mix(in srgb,red 10%,white)){
.zr-chip{border-color:color-mix(in srgb,var(--cat) 40%,white);
 color:color-mix(in srgb,var(--cat) 72%,#14181f)}
}
.zr-no{font-size:12px;line-height:1;padding:4px 9px;border-radius:999px;background:var(--cat);
 color:#fff;font-weight:700;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.zr-space{flex:1}
.zr-actions{display:flex;gap:2px}
.zr-actions button{border:0;background:transparent;color:#5b6472;cursor:pointer;padding:6px 8px;
 border-radius:8px;font-size:15px;line-height:1;transition:background .15s}
.zr-actions button:hover{background:rgba(255,255,255,.85);color:var(--cat,#333)}
.zr-glyph{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap}
.zr-big{font-size:calc(54px * var(--card-font-scale,1));line-height:1.08;font-weight:800;
 color:var(--ink,#18202b);letter-spacing:1px}
.zr-varmini{font-size:calc(22px * var(--card-font-scale,1));color:var(--ink,#5b6472);
 font-weight:600;letter-spacing:2px}
.zr-name{font-size:calc(19px * var(--card-font-scale,1));font-weight:700;color:var(--ink,#2c3140)}
.zr-name .zr-py{font-size:14px;font-weight:500;color:var(--ink,#8a8f98);margin-left:7px}
.zr-name .zr-en{font-size:13px;font-weight:500;color:var(--ink,#8a8f98);margin-left:7px;font-style:italic}
.zr-mean{margin-top:9px;padding:1px 0 1px 12px;border-left:3px solid var(--cat);
 font-size:calc(16px * var(--card-font-scale,1));line-height:1.6;color:var(--ink,#22303f)}
.zr-mean .zr-men{display:block;margin-top:2px;font-size:12.5px;color:var(--ink,#8a8f98);opacity:.8}
.zr-mean .zr-mean-en{font-weight:600}
.zr-mean .zr-mean-en b{color:var(--cat,#22303f)}
.zr-exsec{margin-top:11px;font-size:12px;color:var(--ink,#5b6472);letter-spacing:.5px}
.zr-ex{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:6px}
.zr-excell{background:#fff;border:1px solid #d8dde5;border-radius:10px;padding:8px 6px 7px;
 text-align:center;cursor:pointer;user-select:none;transition:transform .1s}
.zr-excell:active{transform:scale(.96)}
@supports (background:color-mix(in srgb,red 10%,white)){
.zr-excell{border-color:color-mix(in srgb,var(--cat) 35%,white)}
}
.zr-exchar{font-size:calc(26px * var(--card-font-scale,1));line-height:1.2;color:var(--ink,#18202b)}
.zr-exp{font-size:11.5px;color:var(--ink,#5b6472);margin-top:2px}
.zr-exw{font-size:11px;color:var(--ink,#8a8f98);margin-top:3px;white-space:nowrap;overflow:hidden;
 text-overflow:ellipsis}
.zr-exw .zr-hlv{color:var(--cat);font-weight:700}
.zr-excell{position:relative}
.zr-strokebtn{position:absolute;top:4px;right:4px;border:0;background:rgba(0,0,0,.05);
 color:#5b6472;font-size:10px;font-weight:700;line-height:1;padding:4px 7px;border-radius:999px;
 cursor:pointer;display:inline-flex;align-items:center;gap:3px;transition:background .15s}
.zr-strokebtn .fa-pen-nib{font-size:9px}
.zr-strokebtn:hover{background:var(--cat);color:#fff}
.zr-strokebig{border:1px solid #d8dde5;background:#fff;color:#454e5c;font-size:12px;font-weight:700;
 padding:5px 11px;border-radius:999px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;
 transition:background .15s;margin-left:auto}
.zr-strokebig:hover{background:var(--cat);border-color:var(--cat);color:#fff}
@supports (background:color-mix(in srgb,red 10%,white)){
.zr-strokebig{border-color:color-mix(in srgb,var(--cat) 40%,white);
 color:color-mix(in srgb,var(--cat) 72%,#14181f)}
}
.zr-glyph{flex-wrap:wrap}
/* stroke overlay */
.zr-sov{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;
 background:rgba(15,18,24,.55);backdrop-filter:blur(2px)}
.zr-sov.on{display:flex}
.zr-sov-panel{background:#fff;border-radius:16px;padding:18px 18px 14px;max-width:92vw;text-align:center;
 box-shadow:0 12px 40px rgba(0,0,0,.25)}
.zr-sov-char{font-size:15px;font-weight:700;color:#2c3140;margin-bottom:8px}
.zr-sov-stage{width:min(250px,68vw);height:min(250px,68vw);margin:0 auto}
.zr-sov-stage svg{display:block}
.zr-sov-msg{font-size:12.5px;color:#8a8f98;margin-top:8px;min-height:17px}
.zr-sov-btns{display:flex;gap:8px;justify-content:center;margin-top:8px}
.zr-sov-btns button{border:1px solid #d8dde5;background:#fff;color:#454e5c;font-size:12.5px;
 font-weight:700;padding:6px 14px;border-radius:999px;cursor:pointer}
.zr-sov-btns button:hover{background:#eef1f6}
body.dark-mode .zr-sov-panel{background:#1c1f26}
body.dark-mode .zr-sov-char{color:#e6e9f0}
body.dark-mode .zr-sov-msg{color:#9aa3b2}
body.dark-mode .zr-sov-btns button{background:#262b34;border-color:#4a5260;color:#d7dbe2}
body.dark-mode .zr-strokebtn{background:rgba(255,255,255,.09);color:#c7cdd8}
body.dark-mode .zr-strokebtn:hover{background:var(--cat);color:#fff}
body.dark-mode .zr-strokebig{background:#262b34;border-color:#4a5260;color:#d7dbe2}
.zr-tip{margin-top:12px;border-radius:10px;padding:9px 12px;background:#faf4e4;
 border:1px solid #ead9a8;font-size:14px;line-height:1.65;color:#4a3a12}
@supports (background:color-mix(in srgb,red 10%,white)){
.zr-tip{background:color-mix(in srgb,#b07a12 8%,white);border-color:color-mix(in srgb,#b07a12 30%,white)}
}
.zr-tip .zr-tipvar{font-weight:700;color:#8a6410}
.zr-tip .zr-tipen{font-size:14px;line-height:1.6;font-weight:500}
.zr-tip .zr-tipzh{font-size:12.5px;line-height:1.6;opacity:.72;margin-top:3px}
.zr-tip .zr-tipbody{margin-top:2px}
/* intro */
.zr-intro{border:0;box-shadow:none;padding:0;background:transparent}
.zr-intro .zr-intro-body{background:var(--card-bg,#fff);border:1px solid var(--line,#e2e0da);
 border-radius:16px;padding:20px 22px}
.zr-intro h2{margin:0 0 4px;font-size:calc(26px * var(--card-font-scale,1));color:var(--ink,#161b22)}
.zr-intro .zr-i-en{font-size:14px;color:var(--ink,#8a8f98);margin-bottom:14px}
.zr-i-formula{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:10px 0 14px;
 font-size:17px;color:var(--ink,#2c3140)}
.zr-i-formula b{padding:4px 10px;border-radius:8px;background:#eef1f6;border:1px solid #d5dbe4}
.zr-intro .zr-i-sec{margin:14px 0 6px;font-weight:800;color:var(--ink,#161b22);font-size:15px}
.zr-intro table{border-collapse:collapse;width:100%;font-size:15px;margin:4px 0 6px}
.zr-intro td{padding:5px 10px;border-bottom:1px dashed var(--line,#e2e0da);color:var(--ink,#2c3140)}
.zr-intro td.zh{font-weight:700;width:150px}
.zr-intro td.en{color:var(--ink,#8a8f98);font-size:13px}
.zr-legend{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.zr-legend .lg{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line,#e2e0da);
 border-radius:999px;padding:4px 10px;font-size:12.5px;color:var(--ink,#5b6472);background:var(--card-bg,#fff)}
.zr-legend .lg i{width:9px;height:9px;border-radius:50%;display:inline-block}
body.dark-mode .zr-root{border-color:#39404d}
body.dark-mode .zr-chip{background:#2a2f38;color:#d7dbe2}
body.dark-mode .zr-actions button{color:#c7cdd8}
body.dark-mode .zr-actions button:hover{background:rgba(255,255,255,.08)}
body.dark-mode .zr-excell{background:#262b34;border-color:#4a5260;color:#e6e9f0}
body.dark-mode .zr-tip{background:#2a2620;border-color:#4a4130;color:#d9c9a0}
@supports (background:color-mix(in srgb,red 10%,#20242c)){
body.dark-mode .zr-root{background:color-mix(in srgb,var(--cat) 13%,#20242c)}
body.dark-mode .zr-chip{background:color-mix(in srgb,var(--cat) 15%,#262b34);
 border-color:color-mix(in srgb,var(--cat) 38%,#4a5260);color:#e8ebf2}
body.dark-mode .zr-excell{background:color-mix(in srgb,var(--cat) 15%,#262b34);
 border-color:color-mix(in srgb,var(--cat) 38%,#4a5260)}
body.dark-mode .zr-tip{background:color-mix(in srgb,#b07a12 13%,#20242c);
 border-color:color-mix(in srgb,#b07a12 35%,#4a4130)}
}
body.dark-mode .zr-intro .zr-intro-body{background:var(--card-bg,#1c1f26);border-color:var(--line,#2a2e38)}
body.dark-mode .zr-i-formula b{background:#232845;border-color:#39407a}
body.dark-mode .zr-intro td{border-bottom-color:#333845}
body.dark-mode .zr-legend .lg{background:var(--card-bg,#1c1f26);border-color:#333845;color:#c3c9d4}
'''

CARD_JS = r'''(function(){
var NAME='__NAME__';
var EN_BAND={'1-2':'1-2 strokes','3-4':'3-4 strokes','5-6':'5-6 strokes','7-9':'7-9 strokes','10+':'10+ strokes'};
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function iconBtn(kind, on){return '<button type="button" data-action="'+kind+'" title="'+({play:'朗读部首名',mark:'标记',favorite:'收藏'}[kind])+'">'
  + (kind==='play' ? '<i class="fa-solid fa-volume-high"></i>'
     : kind==='mark' ? '<i class="'+(on?'fa-solid':'fa-regular')+' fa-star"></i>'
     : '<i class="'+(on?'fa-solid':'fa-regular')+' fa-bookmark"></i>') + '</button>';}
function actionBar(api){var cd=api.getCardData?api.getCardData():{};
  return '<div class="zr-actions">'
   + iconBtn('play',0) + iconBtn('mark',!!(cd.is_unknown)) + iconBtn('favorite',!!(cd.is_favorite))
   + '</div>';}
/* ---- stroke order (Hanzi Writer, lazy CDN load, graceful offline degrade) ---- */
function hideStrokeBtns(root){(root||document).querySelectorAll('.zr-strokebtn,.zr-strokebig')
  .forEach(function(b){b.style.display='none';});}
function strokeLib(onOk,onFail){
  if(window.HanziWriter){onOk();return;}
  if(window.__zrStrokeFail){onFail();return;}
  window.__zrStrokeQ=window.__zrStrokeQ||[];
  window.__zrStrokeQ.push([onOk,onFail]);
  if(window.__zrStrokeLoading){return;}
  window.__zrStrokeLoading=true;
  var s=document.createElement('script');
  s.src='https://cdn.jsdelivr.net/npm/hanzi-writer@3/dist/hanzi-writer.min.js';
  s.onload=function(){window.__zrStrokeLoading=false;
    (window.__zrStrokeQ||[]).forEach(function(p){p[0]();});window.__zrStrokeQ=[];};
  s.onerror=function(){window.__zrStrokeFail=true;window.__zrStrokeLoading=false;
    hideStrokeBtns();(window.__zrStrokeQ||[]).forEach(function(p){p[1]();});window.__zrStrokeQ=[];};
  document.head.appendChild(s);}
function strokeOverlay(){
  var ov=document.getElementById('zr-sov');
  if(!ov){
    ov=document.createElement('div');ov.id='zr-sov';ov.className='zr-sov';
    ov.innerHTML='<div class="zr-sov-panel"><div class="zr-sov-char"></div>'
      +'<div class="zr-sov-stage"></div><div class="zr-sov-msg"></div>'
      +'<div class="zr-sov-btns"><button type="button" data-sov="replay"><i class="fa-solid fa-rotate-right"></i> 重播</button>'
      +'<button type="button" data-sov="close">关闭</button></div></div>';
    ov.addEventListener('click',function(ev){
      var t=ev.target;
      if(t.closest&&t.closest('[data-sov="close"]')||t===ov){ov.classList.remove('on');}
      else if(t.closest&&t.closest('[data-sov="replay"]')&&ov.__writer){ov.__writer.animateCharacter();}});
    document.body.appendChild(ov);}
  return ov;}
function openStroke(ch){
  var ov=strokeOverlay();
  ov.classList.add('on');
  ov.querySelector('.zr-sov-char').textContent='「'+ch+'」 笔顺演示';
  var stage=ov.querySelector('.zr-sov-stage');
  var msg=ov.querySelector('.zr-sov-msg');
  stage.innerHTML='';msg.textContent='笔顺加载中…';
  var dark=document.body.classList&&document.body.classList.contains('dark-mode');
  function fail(){msg.textContent='暂时拿不到笔顺数据（需联网），稍后再试';stage.innerHTML='';}
  strokeLib(function(){
    HanziWriter.loadCharacterData(ch).then(function(data){
      if(!ov.classList.contains('on')){return;}
      stage.innerHTML='';
      var W=Math.min(250,Math.max(150,(window.innerWidth||375)-100));
      var writer=HanziWriter.create(stage,ch,{width:W,height:W,padding:8,
        strokeAnimationSpeed:1,delayBetweenStrokes:230,
        strokeColor:dark?'#e6e9f0':'#2c3140',
        outlineColor:dark?'#3a4150':'#d8dde5',
        highlightColor:'#2f6ac0',showOutline:true});
      ov.__writer=writer;
      msg.textContent='共 '+(data.strokes?data.strokes.length:'')+' 画';
      writer.animateCharacter();
    }).catch(fail);
  },fail);}
function renderIntro(){
  var rows=[
    ['氵 → 海、洗、河','see 氵 and you expect water: sea, wash, river'],
    ['亻 → 你、他、们','亻 marks people: you, he, they'],
    ['木 → 树、林、桥','wood makes trees, forests, bridges'],
    ['讠 → 说、话、请','speech radicals talk: speak, words, please'],
    ['钅 → 钱、银、铁','metal makes money, silver, iron'],
    ['灬 → 热、点、照','four dots = fire: hot, dot, shine']];
  var table=rows.map(function(r){return '<tr><td class="zh">'+r[0]+'</td><td class="en">'+r[1]+'</td></tr>';}).join('');
  var leg=[['1-2','#2f6ac0'],['3-4','#0e8f84'],['5-6','#7c44b4'],['7-9','#c2572d'],['10+','#64748b']]
    .map(function(b){return '<span class="lg"><i style="background:'+b[1]+'"></i>'+b[0]+' 画 · '+EN_BAND[b[0]]+'</span>';}).join('');
  return '<div class="zr-root zr-intro" data-card-id="{{ID}}"><div class="zr-intro-body">'
   +'<h2>部首 · Chinese Radicals 214</h2>'
   +'<div class="zr-i-en">Every Chinese character has one <b>radical</b> (部首) — its meaning anchor. Spot the radical and you can guess what a character is about, and find it in a dictionary. This deck covers all 214 Kangxi radicals: the ~90 most useful ones come first, rare ones last.</div>'
   +'<div class="zr-i-formula"><b>部首</b><span>+</span><b>部件</b><span>=</span><b>汉字</b><span style="color:#8a8f98">radical + parts = character</span></div>'
   +'<div class="zr-i-sec">见部知义 · Spot the radical, guess the meaning</div>'+table
   +'<div class="zr-i-sec">按笔画分色 · Color-coded by stroke count</div><div class="zr-legend">'+leg+'</div>'
   +'<div class="zr-i-en" style="margin-top:12px;margin-bottom:0">Each card shows the radical, its name & pinyin (click ▶ to hear), the meaning it carries, 3 example characters with an HSK word (click to hear), and a variant tip — the English line is for you, the Chinese line is there to connect what you learn to real usage.</div>'
   +'</div></div>';}
function renderCard(d){
  var disp=d.disp||d.char;
  var vars=(d.var&&d.var.length)?'<span class="zr-varmini">'+d.var.map(esc).join(' ')+'</span>':'';
  var ex=(d.ex||[]).map(function(e){
    var hl=e[3]?('<span class="zr-hlv">'+esc(e[3].lv)+'</span>'):'';
    var wl=e[3]?(esc(e[3].w)+' '+esc(e[3].wp)+' · '+hl):'';
    return '<div class="zr-excell" data-word="'+esc(e[0])+'">'
      +'<button type="button" class="zr-strokebtn" data-stroke="'+esc(e[0])+'" title="Stroke order animation">'
      +'<i class="fa-solid fa-pen-nib"></i>Strokes</button>'
      +'<div class="zr-exchar">'+esc(e[0])+'</div>'
      +'<div class="zr-exp">'+esc(e[1])+' · '+esc(e[2])+'</div>'
      +(wl?'<div class="zr-exw">'+wl+'</div>':'')+'</div>';}).join('');
  return '<div class="zr-root" data-card-id="{{ID}}" style="--cat:'+d._col+'">'
   +'<div class="zr-top"><span class="zr-no">No.'+d.no+'</span>'
   +'<span class="zr-chip">'+d.st+' strokes</span>'
   +'<span class="zr-chip">'+(d.core?'常用 · common':'补充 · extended')+'</span>'
   +'<span class="zr-space"></span>'+actionBar(window.__zrApi||{})+'</div>'
   +'<div class="zr-glyph"><span class="zr-big">'+esc(disp)+'</span>'+vars
   +'<span class="zr-name">'+esc(d.nameZh)+'<span class="zr-py">'+esc(d.py)+'</span>'
   +'<span class="zr-en">'+esc(d.en)+'</span></span>'
   +'<button type="button" class="zr-strokebig" data-stroke="'+esc(disp)+'" title="Stroke order animation">'
   +'<i class="fa-solid fa-pen-nib"></i>Stroke order</button></div>'
   +'<div class="zr-mean"><span class="zr-mean-en">Characters with 「'+esc(disp)+'」 usually relate to <b>'+esc(d.semEn||d.sem)+'</b></span>'
   +'<span class="zr-men">凡带「'+esc(disp)+'」的字，多与'+esc(d.sem)+'有关。</span></div>'
   +'<div class="zr-exsec">Examples · 例字 — click to hear</div>'
   +'<div class="zr-ex">'+ex+'</div>'
   +'<div class="zr-tip"><span class="zr-tipvar">Variant tip · 变体提示</span>'
   +(vars?'<span class="zr-tipvar"> · Variants: '+d.var.map(esc).join(' ')+'</span>':'')
   +'<div class="zr-tipbody zr-tipen">'+esc(d.tipEn||d.tip)+'</div>'
   +'<div class="zr-tipbody zr-tipzh">'+esc(d.tip)+'</div></div>'
   +'</div>';}
window.cardTemplate={
  name:NAME,
  fields:[
    {key:'char',label:'部首',hideable:false},
    {key:'py',label:'读音',hideable:true},
    {key:'sem',label:'部首义',hideable:true},
    {key:'ex',label:'例字',hideable:true},
    {key:'tip',label:'变体提示',hideable:true}
  ],
  render:function(cardHtml,cardData,api){var d=cardData.data||cardData;
    window.__zrApi=api||{};
    var id=String((cardData.id!=null)?cardData.id:d.item_order);
    var html=(d.type==='intro')?renderIntro():renderCard(d);
    return html.split('{{ID}}').join(id);},
  init:function(el,cardData,api){var d=cardData.data||cardData;
    el.querySelectorAll('[data-action]').forEach(function(b){
      b.addEventListener('click',function(ev){ev.preventDefault();ev.stopPropagation();
        var a=b.getAttribute('data-action');
        if(a==='play'){api.playAudio(d.nameZh||d.char,'zh');api.track&&api.track('audio_play');}
        else if(a==='mark'){api.toggleMark&&api.toggleMark();api.rerender&&api.rerender();}
        else if(a==='favorite'){api.toggleFavorite&&api.toggleFavorite();api.rerender&&api.rerender();}
      });});
    el.querySelectorAll('[data-word]').forEach(function(c){
      c.addEventListener('click',function(ev){ev.preventDefault();ev.stopPropagation();
        api.playAudio(c.getAttribute('data-word'),'zh');api.track&&api.track('audio_play');});});
    el.querySelectorAll('[data-stroke]').forEach(function(b){
      b.addEventListener('click',function(ev){ev.preventDefault();ev.stopPropagation();
        api.track&&api.track('stroke_play');
        openStroke(b.getAttribute('data-stroke'));});});}
};
})();
'''.replace('__NAME__', NAME)

INTRO_DATA = {
    'type': 'intro', 'nameZh': '部首', 'nameEn': 'Chinese Radicals 214',
    'item_order': 1,
}


def build_cards(rows, char_map):
    cards = [dict(INTRO_DATA)]
    core_rows = sorted([r for r in rows if r['core']], key=lambda r: (r['st'], r['no']))
    ext_rows = sorted([r for r in rows if not r['core']], key=lambda r: (r['st'], r['no']))
    order = 2
    for r in core_rows + ext_rows:
        _, col = band_of(r['st'])
        ex = []
        for e in r['ex']:
            ch, py, en = e[0], e[1], e[2]
            ex.append([ch, py, en, best_hsk_word(char_map, ch)])
        cards.append({
            'type': 'radical', 'no': r['no'], 'char': r['char'],
            'disp': DISP.get(r['no']), 'nameZh': r['nameZh'], 'py': r['py'],
            'en': r['en'], 'st': r['st'], 'var': r['var'], 'core': bool(r['core']),
            'sem': r['sem'], 'semEn': r['semEn'], 'ex': ex,
            'tip': r['tip'], 'tipEn': r['tipEn'], '_col': col,
            'item_order': order,
        })
        order += 1
    return cards


SAMPLE = {
    'type': 'radical', 'no': 85, 'char': '水', 'disp': '氵', 'nameZh': '三点水',
    'py': 'shuǐ', 'en': 'water', 'st': 4, 'var': ['氵', '氺'], 'core': True,
    'sem': '水、液体、流动', 'semEn': 'water; liquids; flowing',
    'ex': [['海', 'hǎi', 'sea', {'w': '大海', 'wp': 'dàhǎi', 'lv': 'HSK4'}],
           ['洗', 'xǐ', 'wash', {'w': '洗手', 'wp': 'xǐshǒu', 'lv': 'HSK2'}],
           ['河', 'hé', 'river', {'w': '河流', 'wp': 'héliú', 'lv': 'HSK4'}]],
    'tip': '在左作「氵」（三点水），在底可作「氺」（如 泰/浆）。',
    'tipEn': 'On the left it becomes 氵 (three-dots water); at the bottom it can appear as 氺, as in 泰 and 浆.',
    '_col': '#0e8f84',
    'item_order': 2,
}


def emit(cards, template, preview):
    with open(os.path.join(BASE, 'cards.json'), 'w', encoding='utf-8') as f:
        json.dump(cards, f, ensure_ascii=False)
    with open(os.path.join(BASE, 'template.json'), 'w', encoding='utf-8') as f:
        json.dump(template, f, ensure_ascii=False, indent=2)
    with open(os.path.join(BASE, 'preview.html'), 'w', encoding='utf-8') as f:
        f.write(preview)


def audit_with_node():
    script = r'''
const fs=require('fs'),vm=require('vm');
const dir=__dirname;
const tpl=JSON.parse(fs.readFileSync(dir+'/template.json','utf8'));
const cards=JSON.parse(fs.readFileSync(dir+'/cards.json','utf8'));
const ctx={window:{},document:{},navigator:{}};
ctx.window.console=console; vm.createContext(ctx);
vm.runInContext(tpl.cardJs,ctx);
const t=ctx.window.cardTemplate;
if(!t||!t.render||!t.init){console.error('FAIL template missing render/init');process.exit(1);}
let fails=0;
for(const d of cards){
  try{
    const html=t.render('',{data:d,id:String(d.item_order)},fakeApi());
    if(!html.includes('data-card-id="'+d.item_order+'"')){fails++;console.error('FAIL no data-card-id card',d.item_order);continue;}
    if(/undefined|NaN/.test(html)){fails++;console.error('FAIL undefined/NaN card',d.item_order);continue;}
    const el={querySelectorAll:()=>[]};
    t.init(el,{data:d,id:String(d.item_order)},fakeApi());
  }catch(e){fails++;console.error('FAIL card',d.item_order,e.message);}
}
function fakeApi(){return{getCardData:()=>({is_unknown:false,is_favorite:false}),
 playAudio(){},track(){},toggleMark(){},toggleFavorite(){},rerender(){}};}
console.log(fails===0?('AUDIT PASS '+cards.length+'/'+cards.length):('AUDIT FAIL '+fails));
process.exit(fails===0?0:1);
'''
    r = subprocess.run(['node', '-e', script], cwd=BASE, capture_output=True, text=True)
    print(r.stdout.strip())
    if r.returncode != 0:
        print(r.stderr.strip())
        raise SystemExit('node audit failed')


def check_preview_embed():
    with open(os.path.join(BASE, 'cards.json'), encoding='utf-8') as f:
        cards_raw = json.load(f)
    with open(os.path.join(BASE, 'preview.html'), encoding='utf-8') as f:
        pv = f.read()
    embedded = pv.split('var CARDS = ', 1)[1].split('];', 1)[0] + ']'
    assert json.loads(embedded) == cards_raw, 'preview CARDS mismatch cards.json'
    print('preview-embed consistent: %d cards' % len(cards_raw))


def main():
    rows = load_data()
    char_map = load_hsk()
    cards = build_cards(rows, char_map)
    n_core = sum(1 for c in cards if c.get('core'))
    n_hsk = sum(1 for c in cards if c.get('ex') and all(e[3] for e in c['ex']))
    print('cards: %d (intro + 214 radicals; %d core-first, %d fully-HSK-tagged)'
          % (len(cards), n_core, n_hsk))

    template = {
        'name': NAME,
        'lang': LANG,
        'description': ('汉字部首 214 个（含 1 张引导卡）：面向 HSK 学习者，最常用的约 90 个部首排在前面，'
                        '生僻部殿后。每卡含部首形（学习用变体大字）、名称拼音、中英释义、例字格'
                        '（例字自动标注 HSK 例词）与变体提示。按笔画数分五色。朗读部首名（lang: zh），'
                        '例字可点击朗读，可隐藏例字/变体提示作自测。'),
        'cardHtml': '',
        'cardCss': CARD_CSS,
        'cardJs': CARD_JS,
        'trackedActions': [
            {'action': 'audio_play', 'label': '朗读'},
            {'action': 'stroke_play', 'label': '笔顺演示'},
            {'action': 'word_mark', 'label': '标记'},
            {'action': 'favorite_toggle', 'label': '收藏'},
        ],
        'sampleData': [dict(INTRO_DATA), SAMPLE],
    }

    pv_top = '''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>汉字部首 214 · Chinese Radicals · {n} 张预览</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<style>

:root{{--card-bg:#fff;--ink:#2c3140;--line:#e6e4dd}}
*{{box-sizing:border-box}}
body{{margin:0;background:#f6f5f1;color:#2c3140;font-family:-apple-system,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif}}
.wrap{{max-width:760px;margin:0 auto;padding:26px 18px 80px}}
header h1{{font-size:26px;margin:0 0 6px}}
header p{{margin:0;color:#6b7280;font-size:14px;line-height:1.7}}
.legend{{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 20px}}
.legend .lg{{display:inline-flex;align-items:center;gap:7px;border:1px solid #ddd8cf;background:#fff;
 border-radius:999px;padding:6px 13px;font-size:15px;font-weight:600}}
.legend .lg i{{width:10px;height:10px;border-radius:50%;display:inline-block}}
.dark-toggle{{position:fixed;top:14px;right:14px;z-index:9;border:1px solid #ddd8cf;background:#fff;
 border-radius:999px;padding:6px 14px;font-size:13px;cursor:pointer;color:#2c3140}}
body.dark-mode{{--card-bg:#1c1f26;--line:#2a2e38;background:#15171c;color:#e6e8ee}}
body.dark-mode header p{{color:#9aa3b2}}
body.dark-mode .dark-toggle{{background:#23262e;color:#d7dbe2;border-color:#333845}}
body.dark-mode .legend .lg{{background:#1c1f26;border-color:#333845;color:#c3c9d4}}

{css}
</style>
</head>
<body>
<button class="dark-toggle" onclick="document.body.classList.toggle('dark-mode')">夜间模式</button>
<div class="wrap">
<header>
<h1>汉字部首 214 · Chinese Radicals</h1>
<p>面向 HSK 学习者 · 常用部首优先，生僻部首殿后 · 例字自动标注 HSK 例词<br>
214 radicals · ~90 common first · click any example character to hear it</p>
</header>
<div class="legend">
<span class="lg"><i style="background:#2f6ac0"></i>1-2 画</span>
<span class="lg"><i style="background:#0e8f84"></i>3-4 画</span>
<span class="lg"><i style="background:#7c44b4"></i>5-6 画</span>
<span class="lg"><i style="background:#c2572d"></i>7-9 画</span>
<span class="lg"><i style="background:#64748b"></i>10+ 画</span>
</div>
<div id="cards"></div>
</div>
<script>
var CARDS = {cards_json};
</script>
<script>
{js}
</script>
<script>
var api = {{getCardData:function(){{return{{is_unknown:false,is_favorite:false}};}},
  playAudio:function(t,lang){{try{{var u=new SpeechSynthesisUtterance(t);u.lang=lang||'zh-CN';speechSynthesis.speak(u);}}catch(e){{}}}},
  track:function(){{}},toggleMark:function(){{}},toggleFavorite:function(){{}},rerender:function(){{}}}};
CARDS.forEach(function(d, i){{
  var html = window.cardTemplate.render('', {{data:d, id:String(d.item_order)}}, api);
  var div = document.createElement('div');
  div.innerHTML = html;
  document.getElementById('cards').appendChild(div.firstChild);
  window.cardTemplate.init(div, {{data:d, id:String(d.item_order)}}, api);
}});
</script>
</body>
</html>'''.format(n=len(cards), css=CARD_CSS, js=CARD_JS,
                 cards_json=json.dumps(cards, ensure_ascii=False))

    emit(cards, template, pv_top)
    check_preview_embed()
    audit_with_node()
    print('done:', BASE)


if __name__ == '__main__':
    main()
