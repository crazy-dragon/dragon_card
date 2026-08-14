Pack Template - 数据包制作模板
===============================

复制整个目录，按下面说明填充即可成为一个完整的数据包。

Files
-----
- template.json   卡片模板（字段/样式/交互）
- cards.json      卡组数据（每条必须带 item_order，从 1 递增）
- meta.json       元信息（作者/版本/来源/许可）
- LICENSE         版权声明（DragonCard Data License v1.0）
- readme.txt      使用说明（本文件）

制作步骤
--------
1. 复制本目录为一个新名字（如 `my_deck/`）
2. 编辑 template.json：
   - 修改 `name`、`description`
   - 在 `fields` 里声明你的数据字段（word/meaning/...）
   - 在 `cardHtml` / `cardCss` / `cardJs` 里定义卡片外观与交互
   - 可在 `sampleData` 提供预览示例
3. 编辑 cards.json：替换为你的真实数据，每条带递增的 `item_order`
4. 编辑 meta.json：填写真实名称/版本/来源
5. 保留 LICENSE（或替换为你自己的许可）

导入方式（买家侧）
------------------
1. 新建卡组，管理卡组 → 上传模版（template.json）
2. 管理卡组 → 上传数据（cards.json）
3. 开始学习

注意
----
- `item_order` 是覆盖更新的关键：导入时按它对齐，重复导入不会产生重复卡片
- 无 item_order 的数据会按追加处理，且无法用新文件覆盖旧数据
- 中文/英文说明可自行增删；付费包请保留 LICENSE 随包分发

------------------------------------------------------------

数据包制作模板
================

复制整个目录，按说明填充即可成为一个完整的数据包。

文件
----
- template.json   卡片模板（字段/样式/交互）
- cards.json      卡组数据（每条必须带 item_order，从 1 递增）
- meta.json       元信息（作者/版本/来源/许可）
- LICENSE         版权声明（DragonCard Data License v1.0）
- readme.txt      使用说明（本文件）

制作步骤
--------
1. 复制本目录为一个新名字（如 `my_deck/`）
2. 编辑 template.json：
   - 修改 `name`、`description`
   - 在 `fields` 里声明你的数据字段（word/meaning/...）
   - 在 `cardHtml` / `cardCss` / `cardJs` 里定义卡片外观与交互
   - 可在 `sampleData` 提供预览示例
3. 编辑 cards.json：替换为你的真实数据，每条带递增的 `item_order`
4. 编辑 meta.json：填写真实名称/版本/来源
5. 保留 LICENSE（或替换为你自己的许可）

导入方式（买家侧）
------------------
1. 新建卡组，管理卡组 → 上传模版（template.json）
2. 管理卡组 → 上传数据（cards.json）
3. 开始学习

注意
----
- `item_order` 是覆盖更新的关键：导入时按它对齐，重复导入不会产生重复卡片
- 无 item_order 的数据会按追加处理，且无法用新文件覆盖旧数据
- 中文/英文说明可自行增删；付费包请保留 LICENSE 随包分发
