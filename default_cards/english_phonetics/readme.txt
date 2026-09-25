音标拼读 · English Phonetics
============================

一个卡组，两种卡（工具顶栏切换）：
  · 音标 48  —— 每个音素一张：符号、类别、常见拼写、3 个例词、中文要领
  · 拼读 109 —— 每条规则一张：字母/组合、对应音标、例词、英文规则、中文要领

每张卡前面各有一张引导卡（共 159 张）。

数据说明
  cards.json   卡组数据。每张卡带 kind 字段（ipa / ph），工具靠它分组。
  生成方式      gen_merge.py 由 english_ipa + english_phonics 两份数据合并而来；
                正文卡的字段一字未改，只加了 kind 与重排 item_order。

音频
  音素发音不在本卡组数据里，由配套小工具 english-phonetics 提供
  （assets/phonemes/*.mp3，48 段，来源 soundsamerican.net，CC BY-NC-ND 4.0，仅供自用）。

词条内容受 DragonCard Data License v1.0 保护，见 LICENSE。
