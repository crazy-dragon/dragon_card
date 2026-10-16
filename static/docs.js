/* DragonCard user guide (Chinese/English), rendered in the app's current language. */
(function () {
    'use strict';

    var DOCS = {
        zh: {
            intro: 'DragonCard 把卡片数据和展示方式分开管理：卡组保存数据，可绑定一个小工具来展示卡片并提供交互。',
            principle: {
                title: 'DragonCard 如何工作',
                paragraphs: [
                    '一个卡组由卡片数据和可选绑定的小工具组成。小工具可以有自己的卡片样式与操作，通过 window.cardAPI 与 DragonCard 读取卡片、保存标记和记录学习事件。',
                    'DragonCard 不按日期强制安排复习。标记未掌握的卡片后，手动执行「轮回」会将未掌握卡片排到前面，并记录新一轮；何时继续学习由你决定。'
                ]
            },
            sections: [
                {
                    title: '快速开始',
                    blocks: [
                        { type: 'steps', items: [
                            '点击「新建卡组」，填写名称并选择分类。',
                            '打开卡组管理，上传小工具 zip 绑定到卡组。zip 根目录必须有 index.html；manifest.json 用于声明工具名称、语言等信息。',
                            '在卡组数据区上传 cards.json。建议使用对象数组，每条包含从 1 开始的 item_order 和 data。',
                            '回到首页点击卡组，即可在新标签页打开绑定的小工具。'
                        ] }
                    ]
                },
                {
                    title: '卡组与小工具',
                    blocks: [
                        { type: 'p', text: '点击卡组卡片右上角的管理按钮，打开卡组管理面板。一个卡组绑定一个小工具。' },
                        { type: 'ul', items: [
                            '上传工具：选择 tool.zip 绑定到卡组；重新上传可替换当前工具，下载可导出工具 zip，解绑只解除关联，不删除卡组数据。',
                            '工具结构：index.html 必须位于 zip 根目录。工具所需的 CSS、JavaScript、图片等资源应放在 zip 内。manifest.json 可声明 name、lang、description、fields 和 trackedActions。',
                            '卡组分类只用于整理和筛选，不会改变卡组数据或工具的运行方式。'
                        ] }
                    ]
                },
                {
                    title: '导入与导出卡片数据',
                    blocks: [
                        { type: 'ul', items: [
                            '数据格式：支持 JSON 对象数组，也支持 { "items": [...] }。推荐每条使用 { "item_order": 1, "data": { ... } } 结构。',
                            'item_order：建议从 1 开始连续编号。重复导入时，编号相同的卡片会更新；新增编号会添加卡片；文件中缺少的编号会从卡组移除。',
                            '学习记录：更新同一编号的卡片会保留对应学习进度；导入前如果不确定，请先导出一份数据备份。',
                            '管理面板中的「导出数据」导出卡片 JSON；工具 zip 可通过工具区域的下载操作单独导出。'
                        ] }
                    ]
                },
                {
                    title: '学习、标记与轮回',
                    blocks: [
                        { type: 'p', text: '卡组打开后由绑定的小工具负责呈现卡片和学习操作，因此不同工具的按钮和界面可能不同。' },
                        { type: 'ul', items: [
                            '工具可通过 window.cardAPI 分页读取卡片，并按需保存未掌握、收藏和交互事件。支持哪些操作由具体工具决定。',
                            '标记未掌握不会按日期自动安排复习。执行「轮回」时，卡片按 item_order 重新排列，未掌握的排在前面，并开始新一轮。',
                            '学习进度、标记和轮次会保存在 DragonCard 中，重新打开卡组后仍可继续。'
                        ] }
                    ]
                },
                {
                    title: '统计与成就',
                    blocks: [
                        { type: 'ul', items: [
                            '首页卡组卡片展示卡片数量、掌握情况、轮次和今年的学习天数。',
                            '统计页可查看学习活动和卡组数据；成就页展示连续学习、轮次和互动等记录。'
                        ] }
                    ]
                },
                {
                    title: '语言、主题与常见问题',
                    blocks: [
                        { type: 'ul', items: [
                            '界面语言：使用首页顶栏的中/EN 按钮切换中文和英文。',
                            '明暗主题：点击月亮/太阳按钮切换浅色和深色主题；选择会保存在当前浏览器。',
                            '没有声音：朗读由浏览器 Web Speech API 提供，请确认浏览器支持语音合成，并检查系统可用语音。',
                            '小工具打不开：确认卡组已绑定工具，并确认 zip 根目录包含 index.html。',
                            '导入后卡片变化：导入会按 item_order 同步卡片；文件里不存在的编号会从卡组移除。重要数据建议先导出备份。'
                        ] }
                    ]
                }
            ]
        },
        en: {
            intro: 'DragonCard keeps card data separate from presentation: a deck stores cards and can bind one tool to render them and provide interactions.',
            principle: {
                title: 'How DragonCard works',
                paragraphs: [
                    'A deck consists of card data and an optional bound tool. A tool defines its own card presentation and controls, and uses window.cardAPI to read cards, save marks, and record learning events.',
                    'DragonCard does not schedule reviews by date. After marking cards as unknown, use Samsara to move them to the front and record a new round. You decide when to study again.'
                ]
            },
            sections: [
                {
                    title: 'Quick start',
                    blocks: [
                        { type: 'steps', items: [
                            'Click “New Deck”, enter a name, and choose a category.',
                            'Open deck management and upload a tool zip to bind it. The zip must contain index.html at its root; manifest.json can declare the tool name, language, and other metadata.',
                            'Upload cards.json in the deck data area. Use an array of objects with item_order (starting at 1) and data for each card.',
                            'Return to the home page and open the deck. Its bound tool launches in a new tab.'
                        ] }
                    ]
                },
                {
                    title: 'Decks and tools',
                    blocks: [
                        { type: 'p', text: 'Click the management button at the top-right of a deck card to open its management panel. Each deck binds one tool.' },
                        { type: 'ul', items: [
                            'Upload a tool: choose tool.zip to bind it. Upload again to replace the current tool, download to export its zip, or unbind it without deleting the deck data.',
                            'Tool structure: index.html must be at the zip root. Include required CSS, JavaScript, images, and other assets in the zip. manifest.json can declare name, lang, description, fields, and trackedActions.',
                            'Deck categories help organize and filter decks; they do not change deck data or how a tool runs.'
                        ] }
                    ]
                },
                {
                    title: 'Importing and exporting cards',
                    blocks: [
                        { type: 'ul', items: [
                            'Data format: a JSON array of objects or { "items": [...] }. Each item should contain item_order and data, for example { "item_order": 1, "data": { ... } }.',
                            'item_order: use consecutive numbers starting at 1. Re-importing updates matching numbers, adds new numbers, and removes cards whose numbers are absent from the file.',
                            'Study progress: updating a card at the same item_order keeps its progress. Export a backup first if you are unsure about the import.',
                            'Use “Export data” in deck management to export card JSON. The tool zip can be downloaded separately from the tool section.'
                        ] }
                    ]
                },
                {
                    title: 'Studying, marking, and Samsara',
                    blocks: [
                        { type: 'p', text: 'The bound tool presents the cards and study controls, so buttons and interactions may differ between tools.' },
                        { type: 'ul', items: [
                            'A tool can use window.cardAPI to read paginated cards and, as needed, save unknown marks, favorites, and interaction events. Available actions depend on the tool.',
                            'Unknown marks do not schedule date-based reviews. Samsara reorders cards by item_order, placing unknown cards first, and starts a new round.',
                            'Progress, marks, and rounds are stored by DragonCard and remain available when you reopen a deck.'
                        ] }
                    ]
                },
                {
                    title: 'Statistics and achievements',
                    blocks: [
                        { type: 'ul', items: [
                            'Deck cards on the home page show card count, mastery, rounds, and study days this year.',
                            'The Statistics page shows study activity and deck data; Achievements tracks streaks, rounds, interactions, and other milestones.'
                        ] }
                    ]
                },
                {
                    title: 'Language, theme, and FAQ',
                    blocks: [
                        { type: 'ul', items: [
                            'Interface language: use the 中/EN button in the home header to switch between Chinese and English.',
                            'Light/dark theme: use the moon/sun button in the home header. The choice is saved in this browser.',
                            'No audio: speech uses the browser Web Speech API. Check browser support and the voices available on your system.',
                            'A tool will not open: confirm that the deck has a bound tool and that index.html is at the zip root.',
                            'Cards changed after import: imports synchronize by item_order; cards absent from the file are removed. Export a backup first if the data is important.'
                        ] }
                    ]
                }
            ]
        }
    };

    function escapeHtml(value) {
        if (value === null || value === undefined) return '';
        return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function renderBlock(block) {
        if (block.type === 'p') return '<p>' + escapeHtml(block.text) + '</p>';
        if (block.type === 'ul') {
            return '<ul>' + block.items.map(function (item) {
                return '<li>' + escapeHtml(item) + '</li>';
            }).join('') + '</ul>';
        }
        if (block.type === 'steps') {
            return '<ol class="docs-steps">' + block.items.map(function (item) {
                return '<li>' + escapeHtml(item) + '</li>';
            }).join('') + '</ol>';
        }
        return '';
    }

    window.renderDocs = function () {
        var container = document.getElementById('docs-content');
        if (!container) return;
        var lang = (window.i18n && window.i18n.lang === 'en') ? 'en' : 'zh';
        var doc = DOCS[lang] || DOCS.zh;
        var html = '<div class="docs-intro">' + escapeHtml(doc.intro) + '</div>';

        if (doc.principle) {
            html += '<section class="docs-philosophy"><h3>' + escapeHtml(doc.principle.title) + '</h3>';
            doc.principle.paragraphs.forEach(function (paragraph) {
                html += '<p>' + escapeHtml(paragraph) + '</p>';
            });
            html += '</section>';
        }

        html += '<nav class="docs-toc" aria-label="' + (lang === 'en' ? 'Guide sections' : '文档章节') + '">';
        doc.sections.forEach(function (section, index) {
            html += '<a href="#docs-section-' + index + '">' + escapeHtml(section.title) + '</a>';
        });
        html += '</nav>';

        doc.sections.forEach(function (section, index) {
            html += '<section class="docs-section" id="docs-section-' + index + '"><h3>' + escapeHtml(section.title) + '</h3>';
            section.blocks.forEach(function (block) { html += renderBlock(block); });
            html += '</section>';
        });
        container.innerHTML = html;

        var headerP = document.querySelector('#ph-docs .docs-header p');
        if (headerP) headerP.textContent = lang === 'en' ? 'A practical guide to your decks and tools' : '卡组与小工具使用指南';
        var headerH2 = document.querySelector('#ph-docs .docs-header h2');
        if (headerH2) headerH2.textContent = lang === 'en' ? 'User guide' : '使用文档';
    };
})();
