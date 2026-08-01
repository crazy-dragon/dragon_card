/* DragonCard 使用文档（中英双语）— 应用内嵌，语言随 i18n 切换 */
(function () {
    'use strict';

    var DOCS = {
        zh: {
            intro: 'DragonCard 是一款通用卡片学习框架：数据、模板、引擎三层解耦。用自定义模板学习任何内容。',
            philosophy: {
                title: '写在前面：这不是 Anki',
                paragraphs: [
                    'DragonCard 不是 Anki。它没有复杂的间隔重复算法，只有一种很简单的分类学习方法——把知识快速呈现在你面前：标记未掌握的内容，掌握靠前，难点靠前，仅此而已。它不替你安排复习节奏，也不承诺"多少天记住"。',
                    '因为记忆的本质从来不是技巧，而是重复。艾宾浩斯用一生证明：记忆的关键就是重复。所以我们相信的是你——你的坚持本身。持之以恒，必有收获。',
                    '而这里还有一个更深的机制在起作用：大脑是一个极其擅长偷懒的器官。当你长期坚持做同一件事，它不会一直停留在最初吃力的状态，而会逐渐演变成一件越来越省力的事——原本需要刻意专注的动作，会慢慢变成自然的习惯，甚至成为本能。DragonCard 利用的，正是这个机制。',
                    '它提供的不是魔法，而是一个简单的容器：你把知识放进去，然后把"重复"这件最朴素的事，交给每天都来的自己。久而久之，你会发现记忆的潜力远比想象中更大——而这，正是探索自己记忆潜力的方式。'
                ]
            },
            sections: [
                {
                    title: '一、快速开始',
                    blocks: [
                        { type: 'steps', items: [
                            '点击「新建卡组」，填写名称并选择类型（语言 / 知识 / 逻辑 / 技能 / 其它）。',
                            '进入卡组 → 点击「管理卡组」→ 在「模板」区上传模板文件（JSON）。',
                            '在「数据」区上传数据文件（JSON 或 Excel），然后返回目录开始学习。'
                        ] }
                    ]
                },
                {
                    title: '二、卡组管理',
                    blocks: [
                        { type: 'p', text: '点击卡组卡片右上角的齿轮图标（鼠标悬停显示）打开管理面板。' },
                        { type: 'ul', items: [
                            '类型与图标：每种类型有专属图标与配色，可在管理面板中修改类型。',
                            '模板区：每个卡组最多绑定 3 个模板，点击卡片可预览渲染效果，点击底部圆点可设为当前模板。',
                            '数据区：显示数据条数，支持上传（JSON/Excel）、导出、重新打乱。'
                        ] }
                    ]
                },
                {
                    title: '三、开始学习',
                    blocks: [
                        { type: 'p', text: '点击卡组卡片主体进入学习视图。目录页按每页 100 张分页，点击页码打开学习页。' },
                        { type: 'ul', items: [
                            '单卡模式：点击顶栏「网格」图标切换，用左右方向键或空格键翻卡。',
                            '发音：点击卡片上的喇叭按钮，TTS 会按模板语言自动选择语音朗读当前词。',
                            '语音选择：顶栏麦克风图标，语音按语言分组显示，选择后按语言记忆。',
                            '标记与收藏：星星标记生词/已掌握，书签收藏重点卡片。',
                            '切换释义：眼睛按钮控制释义/翻译的显示与隐藏。'
                        ] }
                    ]
                },
                {
                    title: '四、学习引擎',
                    blocks: [
                        { type: 'p', text: '学习引擎保持固定，模板只负责外观与交互。' },
                        { type: 'ul', items: [
                            '标记机制：标记为「未掌握」的卡片会前移，已掌握的靠后。',
                            '重新打乱：管理面板数据区的「旋转」按钮，输入确认短语后打乱所有卡片顺序并开启新学习轮次。',
                            '进度持久化：学习进度、标记状态自动保存，重新进入卡组不丢失。'
                        ] }
                    ]
                },
                {
                    title: '五、数据与备份',
                    blocks: [
                        { type: 'ul', items: [
                            '导出数据：管理面板数据区「下载」按钮，导出当前卡组的 JSON 数据。',
                            '导入数据：支持 JSON 与 Excel（.xlsx/.xls），同名数据会覆盖更新。',
                            '模板备份：删除模板时自动备份到服务器的 backups/ 目录，可恢复。'
                        ] }
                    ]
                },
                {
                    title: '六、统计与成就',
                    blocks: [
                        { type: 'ul', items: [
                            '数据统计：热力图（全年活动分布）、日/周/月视图，可按卡组筛选。',
                            '掌握统计：卡组内热力图、掌握分布、学习轮次金字塔。',
                            '成就系统：称号（按卡组学习轮次升级）、连续学习天数、卡组数量、互动次数等成就。'
                        ] }
                    ]
                },
                {
                    title: '七、语言与外观',
                    blocks: [
                        { type: 'ul', items: [
                            '语言切换：主页顶栏「中/EN」按钮，切换中文与英文界面。',
                            '深色模式：主页顶栏月亮/太阳按钮切换。',
                            '字体大小：学习视图顶栏「A」按钮调节卡片内容字号。'
                        ] }
                    ]
                },
                {
                    title: '八、常见问题（FAQ）',
                    blocks: [
                        { type: 'ul', items: [
                            '卡片空白 / 未渲染：模板未正确加载。请确认已上传模板且设为当前模板，刷新页面重试。',
                            '发音不对：确认模板的 lang 字段（如 en/ja/zh），并在语音选择中为该语言选择可用语音。',
                            '没有声音：浏览器需支持 speechSynthesis，且需在支持的网络环境中（部分语音为在线服务）。',
                            '数据导入失败：JSON 需为对象数组或 { items: [...] } 结构；Excel 首行需为表头。'
                        ] }
                    ]
                }
            ]
        },
        en: {
            intro: 'DragonCard is a generic flashcard learning framework: data, template, and engine are decoupled. Study anything with custom card templates.',
            philosophy: {
                title: 'Foreword: This is not Anki',
                paragraphs: [
                    'DragonCard is not Anki. It has no complex spaced-repetition algorithm—only a very simple way of classifying and learning: knowledge is presented to you quickly; you mark what you have not mastered, mastered items move forward, difficult ones come to the front. That is all. It does not schedule your reviews or promise "memorized in N days".',
                    'Because the essence of memory is never technique—it is repetition. Ebbinghaus proved with a lifetime of work that repetition is the key to memory. So what we trust in is you—your own persistence. Keep at it, and the results will come.',
                    'There is a deeper mechanism at work here: the brain is an organ extremely good at taking the easy way out. When you persist at the same thing for a long time, it will not stay in that initial hard state—it gradually evolves into something easier and easier. Actions that once required deliberate focus slowly become natural habits, even instinct. DragonCard leverages exactly this mechanism.',
                    'What it offers is not magic, but a simple container: you put knowledge in, and leave the simplest act of all—repetition—to the self that shows up every day. Over time, you will discover that the potential of memory is far greater than you imagined. And this is exactly how you explore your own memory\'s potential.'
                ]
            },
            sections: [
                {
                    title: '1. Quick Start',
                    blocks: [
                        { type: 'steps', items: [
                            'Click "New Deck", enter a name and pick a type (Language / Knowledge / Logic / Skill / Other).',
                            'Open the deck → click "Manage deck" → upload a template file (JSON) in the Templates area.',
                            'Upload a data file (JSON or Excel) in the Data area, then return to the catalogue to start studying.'
                        ] }
                    ]
                },
                {
                    title: '2. Deck Management',
                    blocks: [
                        { type: 'p', text: 'Hover a deck card and click the gear icon (top-right) to open the management panel.' },
                        { type: 'ul', items: [
                            'Type & icon: each type has its own icon and color; you can change the type in the management panel.',
                            'Templates: up to 3 templates per deck. Click a card to preview, click the dot at the bottom to set it active.',
                            'Data: shows item count; supports upload (JSON/Excel), export, and shuffle.'
                        ] }
                    ]
                },
                {
                    title: '3. Start Studying',
                    blocks: [
                        { type: 'p', text: 'Click the deck card body to enter study view. The catalogue paginates at 100 cards per page; click a page number to open it.' },
                        { type: 'ul', items: [
                            'Single-card mode: toggle with the grid icon in the top bar; use arrow keys or Space to flip.',
                            'Pronunciation: click the speaker on a card; TTS picks the right voice automatically by the template language.',
                            'Voice picker: the mic icon in the top bar; voices are grouped by language and remembered per language.',
                            'Mark & favorite: star marks unknown/mastered, bookmark favorites key cards.',
                            'Toggle definition: the eye button shows/hides the translation.'
                        ] }
                    ]
                },
                {
                    title: '4. Learning Engine',
                    blocks: [
                        { type: 'p', text: 'The learning engine is fixed; templates only define look and interaction.' },
                        { type: 'ul', items: [
                            'Marking: cards marked "unknown" move forward, mastered ones fall behind.',
                            'Shuffle: use the rotate button in the Data area, type the confirm phrase to reshuffle all cards and start a new round.',
                            'Persistence: progress and marks are saved automatically and survive re-entering the deck.'
                        ] }
                    ]
                },
                {
                    title: '5. Data & Backup',
                    blocks: [
                        { type: 'ul', items: [
                            'Export data: the download button in the Data area exports the deck as JSON.',
                            'Import data: supports JSON and Excel (.xlsx/.xls); same-named entries are overwritten.',
                            'Template backup: deleting a template auto-backups it to the server backups/ directory.'
                        ] }
                    ]
                },
                {
                    title: '6. Statistics & Achievements',
                    blocks: [
                        { type: 'ul', items: [
                            'Data stats: yearly heatmap, day/week/month views, filterable by deck.',
                            'Mastery stats: per-deck heatmap, state distribution, and study-round pyramid.',
                            'Achievements: titles (level up by study rounds), study streak, deck count, and interaction counts.'
                        ] }
                    ]
                },
                {
                    title: '7. Language & Appearance',
                    blocks: [
                        { type: 'ul', items: [
                            'Language: the "中/EN" button in the home top bar switches between Chinese and English.',
                            'Dark mode: the moon/sun button in the home top bar.',
                            'Font size: the "A" button in the study top bar adjusts card content size.'
                        ] }
                    ]
                },
                {
                    title: '8. FAQ',
                    blocks: [
                        { type: 'ul', items: [
                            'Blank / unrendered cards: the template may not be loaded. Make sure a template is uploaded and set active, then refresh.',
                            'Wrong pronunciation: check the template lang field (e.g. en/ja/zh) and pick an available voice for that language.',
                            'No sound: your browser must support speechSynthesis; some voices are online services and need network access.',
                            'Import fails: JSON must be an array of objects or { items: [...] }; Excel needs a header row.'
                        ] }
                    ]
                }
            ]
        }
    };

    function escapeHtml(s) {
        if (s === null || s === undefined) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function renderBlock(block) {
        if (block.type === 'p') return '<p>' + escapeHtml(block.text) + '</p>';
        if (block.type === 'ul') {
            return '<ul>' + block.items.map(function (it) { return '<li>' + escapeHtml(it) + '</li>'; }).join('') + '</ul>';
        }
        if (block.type === 'steps') {
            return '<ol class="docs-steps">' + block.items.map(function (it) { return '<li>' + escapeHtml(it) + '</li>'; }).join('') + '</ol>';
        }
        return '';
    }

    window.renderDocs = function () {
        var container = document.getElementById('docs-content');
        if (!container) return;
        var lang = (window.i18n && window.i18n.lang === 'en') ? 'en' : 'zh';
        var doc = DOCS[lang] || DOCS.zh;

        var html = '<div class="docs-intro">' + escapeHtml(doc.intro) + '</div>';

        if (doc.philosophy) {
            html += '<div class="docs-philosophy">';
            html += '<h3>' + escapeHtml(doc.philosophy.title) + '</h3>';
            doc.philosophy.paragraphs.forEach(function (p) {
                html += '<p>' + escapeHtml(p) + '</p>';
            });
            html += '</div>';
        }

        doc.sections.forEach(function (sec) {
            html += '<div class="docs-section"><h3>' + escapeHtml(sec.title) + '</h3>';
            sec.blocks.forEach(function (b) { html += renderBlock(b); });
            html += '</div>';
        });
        container.innerHTML = html;

        var headerP = document.querySelector('#ph-docs .docs-header p');
        if (headerP) headerP.textContent = lang === 'en' ? 'DragonCard User Guide' : 'DragonCard 使用说明';
        var headerH2 = document.querySelector('#ph-docs .docs-header h2');
        if (headerH2) headerH2.textContent = lang === 'en' ? 'Documentation' : '使用文档';
    };
})();