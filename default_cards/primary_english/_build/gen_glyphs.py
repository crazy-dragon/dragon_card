#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成 26 个小写字母的「单线手写体」SVG 笔画，输出 src/glyphs.js。

坐标约定（数学坐标系，y 向上）
    2.0 ── 上格顶线（字母顶端）
    1.0 ── 中格顶线（x-height）
    0.0 ── 基线
   -1.0 ── 下格底线（降部）

为什么不用字体：四线三格要求「升部高度 = 2 × x 高度」，而任何一款屏幕字体的比例都在
1.4 左右，直接排版会得到「字母没顶到第一条线」或「字碗比旁边大一圈」。所以自绘笔画，
顺便白送手写体的两个教学正确点：单层 a / g、整体右倾。全部用直线 + 贝塞尔表示
（不用圆弧指令，规避 scale(1,-1) 翻转时 sweep 标志被反向的坑）。

用法：python3 _build/gen_glyphs.py
"""
import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'src', 'glyphs.js')

K = 0.5522847498          # 圆的四段三次贝塞尔近似
ASC, BASE, DESC = 2.0, 0.0, -1.0


def n(v):
    """压缩数字：1.000 -> 1，0.500 -> .5（省字节，SVG 合法）"""
    s = ('%.3f' % float(v)).rstrip('0').rstrip('.')
    if s.startswith('0.'):
        s = s[1:]
    elif s.startswith('-0.'):
        s = '-' + s[2:]
    return s or '0'


def _pt(x, y):
    """原样输出数学坐标。翻转交给渲染侧的 <g transform="translate(0,2) scale(1,-1)">，
    这样倾斜 skewX 也在"y 向上"的数学系里施加（顶端右倾 = skewX 正角度），不会左右颠倒。"""
    return (n(x), n(y))


def P(*args):
    """把扁平的数字参数两两成对，输出 'x,y x,y ...'"""
    if len(args) == 1 and isinstance(args[0], (list, tuple)):
        args = tuple(args[0])
    assert len(args) % 2 == 0, '坐标必须成对：%r' % (args,)
    pairs = [(args[i], args[i + 1]) for i in range(0, len(args), 2)]
    return ' '.join('%s,%s' % _pt(x, y) for x, y in pairs)


def M(x, y):
    return 'M%s,%s' % _pt(x, y)


def L(*pts):
    return 'L%s' % P(*pts)


def cub(*pts):
    """三次贝塞尔：cub(x0,y0, c1x,c1y, c2x,c2y, x1,y1)"""
    return 'C%s' % P(*pts)


def quad(x0, y0, cx, cy, x1, y1):
    p0, pc, p1 = _pt(x0, y0), _pt(cx, cy), _pt(x1, y1)
    return 'M%s,%s Q%s,%s %s,%s' % (p0[0], p0[1], pc[0], pc[1], p1[0], p1[1])


def circ(cx, cy, r):
    k = K * r
    d = M(cx - r, cy)
    d += ' ' + cub(cx - r, cy + k, cx - k, cy + r, cx, cy + r)
    d += ' ' + cub(cx + k, cy + r, cx + r, cy + k, cx + r, cy)
    d += ' ' + cub(cx + r, cy - k, cx + k, cy - r, cx, cy - r)
    d += ' ' + cub(cx - k, cy - r, cx - r, cy - k, cx - r, cy)
    return d + 'Z'


def arc(cx, cy, r, a0, a1):
    """数学角（度，逆时针）从 a0 到 a1 的圆弧，按 ≤90° 拆成贝塞尔"""
    total = float(a1 - a0)
    steps = max(1, int(math.ceil(abs(total) / 90.0)))
    step = total / steps
    d = ''
    a = float(a0)
    d += M(cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a)))
    for _ in range(steps):
        b = a + step
        kk = (4.0 / 3.0) * math.tan(math.radians(step / 4.0))
        x0, y0 = cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a))
        x1, y1 = cx + r * math.cos(math.radians(b)), cy + r * math.sin(math.radians(b))
        c1x, c1y = x0 - kk * r * math.sin(math.radians(a)), y0 + kk * r * math.cos(math.radians(a))
        c2x, c2y = x1 + kk * r * math.sin(math.radians(b)), y1 - kk * r * math.cos(math.radians(b))
        d += ' ' + cub(c1x, c1y, c2x, c2y, x1, y1)
        a = b
    return d


def J(*parts):
    """把若干段笔画拼成一个 path（多段 M 起点，一笔画完）"""
    return ' '.join(parts)


# ---------------------------------------------------------------- 字母定义
# 返回值：(path, 字宽)  —— 字宽只用于给砖定宽，笔画本身按上面的网格画
# 中格字母（acemnorsuvwxz）：只占 0..1
# 上中格（bdhiklt）：升到 2.0    中下格（gpqy）：降到 -1.0     上中下（fj）：两端都伸

def _defs():
    g = {}
    g['a'] = (J(circ(0.50, 0.50, 0.50), M(1.00, 1.00) + L(1.00, 0.00)), 1.00)
    g['b'] = (J(M(0.00, 2.00) + L(0.00, 0.00), circ(0.50, 0.50, 0.50)), 1.00)
    g['c'] = (arc(0.50, 0.50, 0.50, 45, 315), 1.00)
    g['d'] = (J(circ(0.50, 0.50, 0.50), M(1.00, 2.00) + L(1.00, 0.00)), 1.00)
    g['e'] = (J(M(0.00, 0.50) + L(1.00, 0.50), arc(0.50, 0.50, 0.50, 0, 315)), 1.00)
    g['f'] = (J(quad(0.92, 1.70, 0.90, 2.02, 0.50, 2.00), M(0.50, 2.00) + L(0.50, -1.00),
                M(0.10, 1.00) + L(0.92, 1.00)), 1.00)
    g['g'] = (J(circ(0.50, 0.50, 0.50), M(1.00, 1.00) + L(1.00, -0.60),
                quad(1.00, -0.60, 1.00, -0.95, 0.50, -0.95)), 1.00)
    # 拱顶必须落在中格顶线上（圆角"方拱"，不是半圆）——半圆会让 n/h 长得跟 b 一样高
    g['h'] = (J(M(0.00, 2.00) + L(0.00, 0.00),
                M(0.00, 0.66) + arc(0.34, 0.66, 0.34, 180, 90)
                + L(0.66, 1.00) + arc(0.66, 0.66, 0.34, 90, 0) + L(1.00, 0.00)), 1.00)
    g['i'] = (J(circ(0.10, 1.44, 0.10), M(0.10, 1.00) + L(0.10, 0.00)), 0.30)
    g['j'] = (J(circ(0.45, 1.44, 0.10), M(0.45, 1.00) + L(0.45, -0.60),
                quad(0.45, -0.60, 0.45, -0.95, 0.05, -0.92)), 0.60)
    g['k'] = (J(M(0.00, 2.00) + L(0.00, 0.00), M(0.75, 1.00) + L(0.00, 0.28),
                M(0.28, 0.52) + L(0.80, 0.00)), 0.85)
    g['l'] = (M(0.12, 2.00) + L(0.12, 0.00), 0.26)
    g['m'] = (J(M(0.00, 1.00) + L(0.00, 0.00),
                M(0.00, 0.70) + arc(0.30, 0.70, 0.30, 180, 90)
                + L(0.30, 1.00) + arc(0.30, 0.70, 0.30, 90, 0) + L(0.60, 0.00),
                M(0.60, 0.70) + arc(0.90, 0.70, 0.30, 180, 90)
                + L(0.90, 1.00) + arc(0.90, 0.70, 0.30, 90, 0) + L(1.20, 0.00)), 1.20)
    g['n'] = (J(M(0.00, 1.00) + L(0.00, 0.00),
                M(0.00, 0.66) + arc(0.34, 0.66, 0.34, 180, 90)
                + L(0.66, 1.00) + arc(0.66, 0.66, 0.34, 90, 0) + L(1.00, 0.00)), 1.00)
    g['o'] = (circ(0.50, 0.50, 0.50), 1.00)
    g['p'] = (J(M(0.00, 1.00) + L(0.00, -1.00), circ(0.50, 0.50, 0.50)), 1.00)
    g['q'] = (J(circ(0.50, 0.50, 0.50), M(1.00, 1.00) + L(1.00, -1.00)), 1.00)
    g['r'] = (J(M(0.00, 1.00) + L(0.00, 0.00),
                M(0.00, 0.70) + arc(0.30, 0.70, 0.30, 180, 90) + L(0.58, 1.00)), 0.62)
    g['s'] = (M(0.86, 0.84)
              + ' ' + cub(0.80, 1.04, 0.50, 1.08, 0.36, 0.98)
              + ' ' + cub(0.18, 0.86, 0.26, 0.66, 0.50, 0.56)
              + ' ' + cub(0.74, 0.46, 0.86, 0.30, 0.78, 0.14)
              + ' ' + cub(0.68, -0.04, 0.32, -0.04, 0.14, 0.16), 1.00)
    g['t'] = (J(M(0.44, 1.75) + L(0.44, 0.16),
                quad(0.44, 0.16, 0.44, -0.08, 0.78, -0.04),
                M(0.06, 1.00) + L(0.86, 1.00)), 0.90)
    g['u'] = (J(M(0.00, 1.00) + L(0.00, 0.50), arc(0.50, 0.50, 0.50, 180, 360),
                M(1.00, 0.50) + L(1.00, 0.00)), 1.00)
    g['v'] = (M(0.05, 1.00) + L(0.50, 0.00, 0.95, 1.00), 1.00)
    g['w'] = (M(0.05, 1.00) + L(0.36, 0.00, 0.68, 0.72, 1.00, 0.00, 1.31, 1.00), 1.36)
    g['x'] = (J(M(0.05, 1.00) + L(0.85, 0.00), M(0.85, 1.00) + L(0.05, 0.00)), 0.90)
    g['y'] = (J(M(0.05, 1.00) + L(0.50, 0.05), M(0.95, 1.00) + L(0.28, -0.70),
                quad(0.28, -0.70, 0.18, -0.98, 0.02, -0.90)), 1.00)
    g['z'] = (M(0.06, 1.00) + L(0.86, 1.00, 0.06, 0.00, 0.88, 0.00), 0.94)
    return g


# 占格分类（人教版教辅口径）。仅用于文档/预览标注，字号本身由笔画的几何决定。
BANDS = {
    'mid':     'acemnorsuvwxz',
    'upmid':   'bdhiklt',
    'middown': 'gpqy',
    'all':     'fj',
}


def main():
    g = _defs()
    missing = set('abcdefghijklmnopqrstuvwxyz') - set(g)
    assert not missing, '缺字母：%s' % missing
    band_of = {}
    for k, letters in BANDS.items():
        for ch in letters:
            band_of[ch] = k
    assert len(band_of) == 26, '占格分类重复或缺失：%d' % len(band_of)

    payload = {ch: {'w': round(g[ch][1], 3), 'b': band_of[ch], 'd': g[ch][0]}
               for ch in sorted(g)}
    js = ('/* 自动生成，勿手改 —— 见 _build/gen_glyphs.py */\n'
          'window.PK_GLYPHS = ' + json.dumps(payload, ensure_ascii=False, indent=0,
                                             separators=(',', ':')) + ';\n')
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(js)
    print('写出 %s（%d 个字母，%d 字节）' % (OUT, len(payload), len(js)))
    print('最宽的字母：', sorted(payload.items(), key=lambda kv: -kv[1]['w'])[:4])


if __name__ == '__main__':
    main()
