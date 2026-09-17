小学初中英语词汇（糖果积木版）
================================

面向小学到初中的英语词汇卡组：糖果积木字母 + 单词卡 / 拼写 / 记忆拼词 / 找字母拼词。
字母配色统一：**元音暖橙、辅音青紫**（颜色与字母绑定，帮助记忆）。

模板（每个独立，一模板一件事）
----------------
- template_word_v2.json     糖果单词卡：糖果积木字母 + 四线三格，点读 / 中文 / 音标 / 例句全直显。
- template_blocks_v2.json   字母拼拼乐：把打乱的糖果字母砖按顺序点进四线三格，点砖读字母名，拼错不扣分。
- template_grid.json        光点拼词 · 记忆版：看一眼全亮 → 熄灭 → 凭记忆按顺序点亮字母方块。（单卡模式）
- template_grid5.json       光点拼词 · 简版：字母常亮（大小写各一块）+ 干扰字母，点对拼出单词，三档难度。（单卡模式）
- template_word.json / template_blocks.json  旧版（v1 手写笔画风），如需可继续使用。

数据格式（初中英语）
-------------------
每条卡数据含：word / phonetic_us / paraphrase_en / paraphrase_zh / examples（数组）/ coca_rank / form_note

```json
{ "item_order": 1, "word": "ability",
  "phonetic_us": "[əˈbɪləti]",
  "paraphrase_en": "[\"The power or skill to do something\"]",
  "paraphrase_zh": "[\"n. 能力；才能\"]",
  "examples": [{ "en": "She has the ability to solve complex problems.", "zh": "她有能力解决复杂问题。" }] }
```

> 也兼容旧格式（word/zh/phonetic），parseData 会自动识别。

配色
----
字母方块统一：**元音 a/e/i/o/u → 暖橙；辅音 → 青/蓝/紫**（饱和底 + 白色字母）。
卡片氛围色（背景渐变 / 强调色）可通过卡内色板条切换（糖果 / 海洋 / 森林 / 夕阳 / 星空 / 莓果），
记忆在 localStorage（dc-pk2-theme）。只影响卡片氛围，不影响卡组内容与数据。

使用
----
1. 新建卡组，选一个模板（单词卡 / 拼拼乐 / 记忆版 / 简版）
2. 导入你的词汇数据（初中英语格式）
3. 单词卡：点卡片任意处听发音；拼写与两个游戏模板需切到「单卡模式」玩

游戏规则
--------
- 记忆版：开场字母全亮 + 倒计时（时长随词长自动算），熄灭后凭记忆按拼写顺序点亮方块；点对读字母并飞入拼写槽，点错闪红 0.6s 不扣分。「提示」让需要的方块亮 0.8s，「再看一遍」重开演示。
- 简版：字母常亮（大小写各一块），点对灰显锁定并飞入拼写槽（槽内始终小写）；点错抖红计失误。难度：简单 4×4 / 中等 5×5 干扰 3 / 较难 5×5 全满。「换个位置」重新随机。

构建
----
- _build/       v1 旧版源文件与打包器
- _build_v2/    v2 糖果版源文件与打包器（core.css/core.js + word/blocks/grid/grid5）
- _preview/     游戏原型（记忆版 proto_grid.html / 简版 proto_grid5.html）

作者
----
Alfred Long (alfred.long@qq.com) · DragonCard Data License v1.0