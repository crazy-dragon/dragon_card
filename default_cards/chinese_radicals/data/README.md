# data/ — 部首卡组生成原料

本目录是 `gen_radicals.py` 的**输入原料**，不直接导入应用。导入应用只用生成器产出的三件套（`cards.json` / `template.json` / `preview.html`）。

## 文件说明

| 文件 | 内容 |
|------|------|
| `radicals_a.json` | 部首原始数据，第 1–110 号（字形/名称拼音/英文释义/笔画/变体/常用标记/中文语义/例字/中文变体提示） |
| `radicals_b.json` | 同上，第 111–214 号 |
| `en_patch.json` | 英文化补丁（2026-09-05）：以部首号 `no` 为键，每条含 `semEn`（英文语义，必填）、`tipEn`（英文变体提示，必填），可选 `en`（覆盖原始英文释义，用于修正词典腔，如 广 dotted cliff → building; shelter） |

## 修改流程

1. 改数据：单条英文改 `en_patch.json`；新增部首/例字改 `radicals_a/b.json`
2. 重跑生成器：`python3 gen_radicals.py`（自动校验 + Node 渲染审计）
3. 用新的 `cards.json` + `template.json` 重新导入应用（改了数据字段时两个都要导）

## 校验规则（gen_radicals.py 自动执行）

- 必须 214 个部首、`no` 无重复、`en_patch.json` 全覆盖
- `semEn` / `tipEn` 必须含英文单词（防止漏配）
- `en` 禁止回归词典腔黑名单（dotted cliff / bristle / seal / leaf 等）
- 例字自动标注 HSK 例词（来自 memory_market_goods/hsk1-9），无需手填
