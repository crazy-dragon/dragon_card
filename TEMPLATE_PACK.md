# 模板包规范（轻量格式）

DragonCard 的模板以**轻量格式**发布与分发：一个模板包就是一个目录（或 zip），包含以下文件。购买后分别导入即可，无需 zip 解压逻辑。

## 模板包结构

```
template-pack-name/
├── template.json    # 模板定义（必填，导入方式：管理卡组 → 上传模版）
├── cards.json       # 示例数据（可选，导入方式：管理卡组 → 上传数据）
├── meta.json        # 卡组元信息（推荐：作者/版本/许可等）
├── LICENSE          # 版权声明（推荐，自定义数据许可）
├── preview.png      # 预览图（可选，展示页 / 付费平台商品页用）
└── README.md        # 使用说明（可选）
```

## 文件规范

### template.json

DragonCard 模板格式，字段：

| 字段 | 必填 | 说明 |
|------|------|------|
| `name` | 是 | 模板显示名称 |
| `lang` | 否 | 语音语言（BCP47，默认 en） |
| `description` | 否 | 简短描述 |
| `cardHtml` | 是 | HTML 骨架 |
| `cardCss` | 是 | 卡片样式（纯 CSS） |
| `cardJs` | 是 | 交互逻辑（`window.cardTemplate`）|
| `sampleData` | 否 | 预览示例数据 |
| `trackedActions` | 否 | 观测埋点声明 `[{action,label}]`，最多 5 个 |

### cards.json

数据数组（对象数组），每条可含 `item_order` 与 `data`：

```json
[
  { "item_order": 1, "data": { "word": "serendipity", "meaning": "意外发现" } }
]
```

### meta.json

卡组元信息（可选，推荐）。用于标识作者、版本、来源与许可：

```json
{
  "name": "英语词汇卡组",
  "description": "COCA 前 2000 高频词。",
  "version": "1.0.0",
  "author": "Alfred Long",
  "email": "alfred.long@qq.com",
  "license": "DragonCard Data License v1.0",
  "updated": "2026-08-15"
}
```

### LICENSE

版权许可声明。本项目的卡组数据默认采用 **DragonCard Data License v1.0**（见各卡组目录 `LICENSE`）：允许个人学习使用，禁止转售/商业再分发。付费数据包发布时请保留此文件。

## 商品发布流程

1. 将模板包目录压缩为 zip（可选，或直接上传 template.json + cards.json）
2. 在付费平台上传商品：文件 + 描述 + preview.png
3. 展示页（独立站点 `dragon-memory-market` 的商店页）的商品条目指向该付费链接

## 示例

参考 `default_cards/reading_card/`（阅读卡）、`default_cards/dinosaur_3d/`（3D 卡片）等。
