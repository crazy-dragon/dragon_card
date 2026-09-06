# -*- coding: utf-8 -*-
"""
western_allusions 西方典故卡组生成器
- 37 张双语典故卡（中文为主 + English Corner）
- 平铺阅读卡：名字(中英) → 一句话速记 → 典故故事 → 现代用法 → English Corner → 出处
- 书卷气暖纸白设计，四组低饱和主题色
"""
import json, os

OUT = '/Users/alfred/CodeBase/Python/dragoncard/default_cards/western_allusions'
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------------------
# 卡片数据（item_order 自动重排 1..37）
# group: greek(希腊神话) / history(罗马与历史) / bible(圣经) / literature(文学与童话)
# ---------------------------------------------------------------------------
CARDS = [
  # ================= 希腊神话 13 =================
  {"item_order":1,"group":"greek","groupZh":"希腊神话","nameZh":"阿喀琉斯之踵","nameEn":"Achilles' Heel",
   "tagline":"刀枪不入的英雄，唯一的弱点在脚后跟。",
   "story":"英雄阿喀琉斯出生时，被母亲握着他的脚踝浸入冥河斯提克斯，全身刀枪不入，唯独被握住的那处脚后跟没沾到神水。特洛伊战争中他战无不胜，最终被一支毒箭射中脚踝而亡。",
   "usageZh":"中文用它比喻强者身上唯一的、致命的弱点，常说「XX 的阿喀琉斯之踵」。",
   "ecText":"one's Achilles' heel = the one fatal weakness of a powerful person",
   "ecExample":"His pride is the Achilles' heel that may cost him the deal.",
   "ecZh":"骄傲是可能让他丢掉这笔生意的阿喀琉斯之踵。",
   "sourceZh":"希腊神话 · 公有领域"},

  {"item_order":2,"group":"greek","groupZh":"希腊神话","nameZh":"普罗米修斯盗火","nameEn":"Prometheus",
   "tagline":"从神界盗来火种送给人间，甘愿承受永罚的先驱。",
   "story":"普罗米修斯怜悯人类的蒙昧，从天庭盗取火种与技艺带到人间。宙斯震怒，将他锁在高加索山崖上，让巨鹰日日啄食他的肝脏，而肝脏每到夜晚又会重新长好，痛苦永无休止。",
   "usageZh":"中文用「普罗米修斯式」形容为了他人福祉不惜自我牺牲的先行者。",
   "ecText":"Promethean = boldly creative, or self-sacrificing for others",
   "ecExample":"The open-source pioneers made a Promethean choice to share their code freely.",
   "ecZh":"那些开源先驱做出了普罗米修斯式的选择，把自己的代码无偿分享。",
   "sourceZh":"希腊神话 · 公有领域"},

  {"item_order":3,"group":"greek","groupZh":"希腊神话","nameZh":"潘多拉魔盒","nameEn":"Pandora's Box",
   "tagline":"打开就再也关不上的盒子，放出了人间一切灾祸。",
   "story":"宙斯为惩罚人类，命众神造出美丽的潘多拉，送她一只密封的盒子，叮嘱绝不可打开。潘多拉抵不住好奇掀开盒盖，疾病、嫉妒、灾祸纷纷飞出；她慌忙盖上时，只有「希望」被留在了盒底。",
   "usageZh":"「打开潘多拉魔盒」指开启了一连串无法收拾的祸端，常用来形容一次轻率的决定。",
   "ecText":"to open a Pandora's box = to start something that unleashes many problems",
   "ecExample":"The leaked report opened a Pandora's box of scandals.",
   "ecZh":"那份外泄的报告打开了一个接一个丑闻的潘多拉魔盒。",
   "sourceZh":"希腊神话 · 公有领域"},

  {"item_order":4,"group":"greek","groupZh":"希腊神话","nameZh":"西西弗斯推石","nameEn":"Sisyphus",
   "tagline":"把巨石推上山巅，眼看它滚落，再从头推起。",
   "story":"西西弗斯因欺骗死神被罚：将一块巨石推上山顶，可每当石头将到山顶就必然滚回山脚。他只得日复一日、永无止境地重复这徒劳的劳作。加缪说，西西弗斯是幸福的——他在推石中反抗命运。",
   "usageZh":"「西西弗斯式」形容看似徒劳却必须坚持的重复劳动，也引申为知其不可而为之的韧性。",
   "ecText":"a Sisyphean task = endless work that never stays done",
   "ecExample":"Answering the same questions daily felt like a Sisyphean task.",
   "ecZh":"每天回答同样的问题，感觉像在推西西弗斯的石头。",
   "sourceZh":"希腊神话 · 公有领域"},

  {"item_order":5,"group":"greek","groupZh":"希腊神话","nameZh":"忒修斯之船","nameEn":"Ship of Theseus",
   "tagline":"船板一块块换新之后，它还是原来那艘船吗？",
   "story":"忒修斯的船被雅典人世代保存，人们不断用新木板替换朽坏的旧板，直到所有部件都不再是原件。哲人由此发问：当组成事物的每一部分都被更换，它还是原来的那个它吗？这一思想实验至今仍是讨论「身份」的经典。",
   "usageZh":"中文语境常借「忒修斯之船」讨论自我认同、组织传承与科技迭代：换了全部零件的我还是我吗？",
   "ecText":"the Ship of Theseus = a thought experiment on identity and renewal",
   "ecExample":"With every cell replaced, are you still the same person? — the Ship of Theseus.",
   "ecZh":"当每个细胞都被更新，你还是原来的你吗？这便是忒修斯之船。",
   "sourceZh":"古希腊哲学（普鲁塔克）· 公有领域"},

  {"item_order":6,"group":"greek","groupZh":"希腊神话","nameZh":"特洛伊木马","nameEn":"Trojan Horse",
   "tagline":"一座「礼物」木马，里面藏了一支奇兵。",
   "story":"希腊联军围困特洛伊十年不下，遂造一只巨大木马，佯装撤军。特洛伊人将木马当战利品拖入城中，藏在马腹的希腊勇士趁夜而出，里应外合攻陷了特洛伊。",
   "usageZh":"中文语境从「特洛伊木马」引申出两个常用义：伪装成礼物的陷阱，以及计算机里的「木马病毒」。",
   "ecText":"a Trojan horse = something that looks harmless but destroys you from within",
   "ecExample":"That free app was a Trojan horse that stole users' private data.",
   "ecZh":"那款免费应用其实是窃取用户隐私的特洛伊木马。",
   "sourceZh":"荷马《奥德赛》/ 维吉尔《埃涅阿斯纪》· 公有领域"},

  {"item_order":7,"group":"greek","groupZh":"希腊神话","nameZh":"米达斯点金术","nameEn":"The Midas Touch",
   "tagline":"手指所触皆成黄金，直到连食物与女儿都变成金子。",
   "story":"米达斯王祈求酒神赐他点金之术——凡手指触碰之物皆化为黄金。起初他狂喜，随即发现面包成了金块、清水成了金液，连心爱的女儿也变成一尊金像，他这才哀求收回恩赐。",
   "usageZh":"中文说「米达斯之手 / 点石成金」，形容极擅把经手之事做成的人；英文 the Midas touch 多带褒义，指总能成功。",
   "ecText":"to have the Midas touch = to be successful at everything one does",
   "ecExample":"Everything she invests in turns to gold — she has the Midas touch.",
   "ecZh":"她投什么什么就赚钱——真有米达斯的点金之手。",
   "sourceZh":"希腊神话（奥维德《变形记》）· 公有领域"},

  {"item_order":8,"group":"greek","groupZh":"希腊神话","nameZh":"那喀索斯","nameEn":"Narcissus",
   "tagline":"爱上自己水中倒影的美少年，最终枯坐而死。",
   "story":"那喀索斯是世间最俊美的少年，拒绝了一切爱慕。复仇女神让他看见自己在水中的倒影，他从此迷恋不已，日日夜夜望着水面，却永远无法触及，最终憔悴而死，化作水边一株水仙。",
   "usageZh":"「自恋」一词正源于他的名字（narcissism）；中文也常用「顾影自怜」指只爱自己的人。",
   "ecText":"narcissism = excessive love of oneself",
   "ecExample":"Social media feeds our narcissism by turning life into a mirror.",
   "ecZh":"社交媒体把生活变成一面镜子，喂养着我们的自恋。",
   "sourceZh":"希腊神话（奥维德《变形记》）· 公有领域"},

  {"item_order":9,"group":"greek","groupZh":"希腊神话","nameZh":"伊卡洛斯","nameEn":"Icarus",
   "tagline":"用蜡粘成的翅膀飞向太阳，越飞越高，蜡融翼散。",
   "story":"巧匠代达罗斯用羽毛和蜡为儿子伊卡洛斯制成翅膀，叮嘱他别飞太低（海水会打湿羽毛），也别飞太高（太阳会融化蜡）。伊卡洛斯飞得忘形，直冲太阳，蜡翼融化，他坠入大海。",
   "usageZh":"「伊卡洛斯」喻好高骛远、得意忘形以致毁灭的人；也提醒人们「飞得离太阳太近」的代价。",
   "ecText":"to fly too close to the sun = to fail by overreaching",
   "ecExample":"The startup grew too fast and flew too close to the sun.",
   "ecZh":"这家初创公司扩张得太快，飞得太靠近太阳了。",
   "sourceZh":"希腊神话（奥维德《变形记》）· 公有领域"},

  {"item_order":10,"group":"greek","groupZh":"希腊神话","nameZh":"斯芬克斯之谜","nameEn":"Riddle of the Sphinx",
   "tagline":"「什么生物早上四只脚、中午两只脚、晚上三只脚？」",
   "story":"狮身人面兽斯芬克斯守在底比斯城外，向路人出谜，猜不中者即被吞噬。俄狄浦斯答出谜底——人：幼时爬行、壮年行走、暮年拄杖。斯芬克斯羞愤坠崖。",
   "usageZh":"「斯芬克斯之谜」指极难破解的难题；谜底「人」也隐喻认识自我之难。",
   "ecText":"the riddle of the Sphinx = a famously difficult puzzle",
   "ecExample":"The cause of the crash remains a riddle of the Sphinx.",
   "ecZh":"坠机的原因至今仍是一个斯芬克斯之谜。",
   "sourceZh":"希腊神话（索福克勒斯《俄狄浦斯王》）· 公有领域"},

  {"item_order":11,"group":"greek","groupZh":"希腊神话","nameZh":"金苹果之争","nameEn":"Apple of Discord",
   "tagline":"一颗「献给最美者」的金苹果，点燃了特洛伊战火。",
   "story":"众神之宴上，不和女神厄里斯丢下一颗金苹果，上书「献给最美者」。赫拉、雅典娜、阿芙洛狄忒相争不下，请特洛伊王子帕里斯裁决；帕里斯将苹果判给许诺他「世上最美女人」的阿芙洛狄忒，而这桩裁决最终引发了特洛伊战争。",
   "usageZh":"「金苹果」喻指引发纷争的根源；英文 an apple of discord 即「祸端」。",
   "ecText":"an apple of discord = the root cause of a quarrel",
   "ecExample":"The inheritance became an apple of discord among the three brothers.",
   "ecZh":"那份遗产成了三兄弟反目的金苹果。",
   "sourceZh":"希腊神话 · 公有领域"},

  {"item_order":12,"group":"greek","groupZh":"希腊神话","nameZh":"阿里阿德涅之线","nameEn":"Ariadne's Thread",
   "tagline":"顺着这条线，才走出了回环往复的迷宫。",
   "story":"雅典王子忒修斯进入克里特迷宫斩杀牛头怪，公主阿里阿德涅赠他一团线：将线头系在入口，边走边放线。忒修斯杀掉怪物后循线而归，平安走出迷宫。",
   "usageZh":"「阿里阿德涅之线」喻指引人走出困局、理清头绪的方法或线索。",
   "ecText":"Ariadne's thread = a clue that guides one through a complex problem",
   "ecExample":"The old diary gave the detective Ariadne's thread through the case.",
   "ecZh":"那本旧日记给了侦探破译此案的阿里阿德涅之线。",
   "sourceZh":"希腊神话 · 公有领域"},

  {"item_order":13,"group":"greek","groupZh":"希腊神话","nameZh":"奥德赛","nameEn":"The Odyssey",
   "tagline":"战后归乡十年，漂流中历尽艰险与诱惑。",
   "story":"特洛伊战后，英雄奥德修斯踏上归途，却被诸神与命运捉弄，在海上漂泊十年：遭遇独眼巨人、女巫喀耳刻、海妖塞壬，同伴尽数罹难。他最终独自回到伊萨卡，与苦等二十年的妻子佩涅洛佩重逢。",
   "usageZh":"「奥德赛」已成英语中「漫长艰辛的旅程」的代名词，中文也常直用此词形容曲折历程。",
   "ecText":"an odyssey = a long, eventful journey full of trials",
   "ecExample":"Recovering the lost painting became a ten-year odyssey for the curator.",
   "ecZh":"找回那幅失窃名画成了策展人长达十年的奥德赛。",
   "sourceZh":"荷马《奥德赛》· 公有领域"},

  # ================= 罗马与历史 4 =================
  {"item_order":14,"group":"history","groupZh":"罗马与历史","nameZh":"达摩克利斯之剑","nameEn":"Sword of Damocles",
   "tagline":"王座上方，悬着一柄仅由一根马鬃系住的利剑。",
   "story":"叙拉古僭主狄奥尼修斯让羡慕王权的宠臣达摩克利斯坐上宝座体验一天，却在他头顶悬一柄仅用一根马鬃系住的利剑。达摩克利斯这才明白：权势与享乐之上，永远悬着致命的危险。",
   "usageZh":"「达摩克利斯之剑」喻指随时可能降临的危机，中文常写「头顶悬着一把达摩克利斯之剑」。",
   "ecText":"to hang by a thread = to be in imminent, ever-present danger",
   "ecExample":"The lawsuit hung over the company like the sword of Damocles.",
   "ecZh":"那场诉讼像达摩克利斯之剑一样悬在公司头顶。",
   "sourceZh":"古罗马典故（西塞罗）· 公有领域"},

  {"item_order":15,"group":"history","groupZh":"罗马与历史","nameZh":"皮洛士式胜利","nameEn":"Pyrrhic Victory",
   "tagline":"连战连捷，却感叹「再来一次这样的胜利，我就完了」。",
   "story":"伊庇鲁斯国王皮洛士是希腊化时代的名将，他率军渡海迎战新兴的罗马，接连取胜。可每场胜利都让他损失惨重——罗马兵源源源不断，他的精锐却无从补充。相传阿斯库卢姆战役后，面对道贺的部下，他说：「再打一次这样的胜仗，我就彻底完了。」",
   "usageZh":"「皮洛士式胜利」指赢得太惨、代价远超收益的胜利，中文常说「惨胜」「杀敌一千，自损八百」，常见于商战、谈判与竞技。",
   "ecText":"a Pyrrhic victory = a win that costs more than it is worth",
   "ecExample":"Winning the lawsuit was a Pyrrhic victory that nearly bankrupted the company.",
   "ecZh":"打赢官司是一场皮洛士式胜利——公司差点为此破产。",
   "sourceZh":"古希腊罗马史（皮洛士战争）· 公有领域"},

  {"item_order":16,"group":"history","groupZh":"罗马与历史","nameZh":"渡过卢比孔河","nameEn":"Cross the Rubicon",
   "tagline":"一旦过河，便再无回头之路。",
   "story":"公元前 49 年，凯撒率军来到罗马的界河卢比孔河——按律法，将领带兵渡河即是对共和国的宣战。凯撒沉思良久，说出「骰子已经掷下」，毅然渡河，内战由此爆发，罗马由共和走向帝制。",
   "usageZh":"「渡过卢比孔河」意为作出破釜沉舟、不可逆转的决定；中文语境常说「没有回头路」。",
   "ecText":"to cross the Rubicon = to take an irreversible step",
   "ecExample":"By publishing the report, she crossed the Rubicon and burned her bridges.",
   "ecZh":"发表那份报告后，她便渡过了卢比孔河，再无退路。",
   "sourceZh":"古罗马史（凯撒）· 公有领域"},

  {"item_order":16,"group":"history","groupZh":"罗马与历史","nameZh":"滑铁卢","nameEn":"Waterloo",
   "tagline":"一代枭雄的最后一战，从此「滑铁卢」成了惨败的代名词。",
   "story":"1815 年，拿破仑在比利时滑铁卢与英普联军决战，惨败收场。这位曾横扫欧洲的皇帝第二次退位，被流放至圣赫勒拿岛，政治生涯就此终结。此后，「遭遇滑铁卢」成了「一败涂地」的通用说法。",
   "usageZh":"中文「遭遇滑铁卢」极常用，指从巅峰跌落、彻底失败，如考试、比赛、事业上的惨败。",
   "ecText":"to meet one's Waterloo = to suffer a decisive, final defeat",
   "ecExample":"The undefeated champion finally met his Waterloo in the final round.",
   "ecZh":"这位不败冠军终于在最关键的决赛中遭遇滑铁卢。",
   "sourceZh":"欧洲历史（1815 滑铁卢战役）· 公有领域"},

  # ================= 圣经 8 =================
  {"item_order":17,"group":"bible","groupZh":"圣经","nameZh":"诺亚方舟","nameEn":"Noah's Ark",
   "tagline":"洪水灭世时，一艘载着万物希望的大船。",
   "story":"上帝见人间充满罪恶，决意降下洪水。义人诺亚受命造一艘大船，携家人与各类飞禽走兽各一对登舟。洪水退后，方舟停泊在亚拉腊山，人类与万物由此延续。",
   "usageZh":"「诺亚方舟」喻指灾难中最后的避难所或救赎，中文也常说「最后的救命稻草」。",
   "ecText":"Noah's Ark = a refuge that saves life in catastrophe",
   "ecExample":"The seed bank is a modern Noah's Ark for endangered crops.",
   "ecZh":"那座种子库是濒危作物的一艘现代诺亚方舟。",
   "sourceZh":"《圣经·创世记》· 公有领域"},

  {"item_order":18,"group":"bible","groupZh":"圣经","nameZh":"巴别塔","nameEn":"Tower of Babel",
   "tagline":"人们想建一座通天的塔，上帝却让他们各说各话。",
   "story":"大洪水后，人类同心协力要建造一座塔顶通天的城塔。上帝见人心骄傲，便变乱了他们的语言，使他们无法沟通，工程半途而废，众人也分散到世界各地。",
   "usageZh":"「巴别塔」喻指因语言不通或沟通混乱而无法成事；babel 在英文里也引申为「嘈杂喧闹」。",
   "ecText":"a Babel of voices = a confusion of many languages or opinions",
   "ecExample":"The meeting was a Babel of languages with no translator in sight.",
   "ecZh":"那场会议各说各话，现场又没有翻译，简直是座巴别塔。",
   "sourceZh":"《圣经·创世记》· 公有领域"},

  {"item_order":19,"group":"bible","groupZh":"圣经","nameZh":"替罪羊","nameEn":"Scapegoat",
   "tagline":"众人的罪过，都归于一头被放逐荒野的羊。",
   "story":"古犹太教的赎罪日仪式中，大祭司将手按在一头活羊头上，把民众的罪孽「转移」到羊身上，再将羊放逐到旷野，让它带走一切过错。这头羊便是「替罪羊」。",
   "usageZh":"「替罪羊」指代人受过者，中文常说「背锅」；英文 scapegoat 指为他人过错受罚的人。",
   "ecText":"a scapegoat = someone blamed for the faults of others",
   "ecExample":"After the scandal, the junior clerk was made the scapegoat for the whole board.",
   "ecZh":"丑闻之后，那个初级职员成了替整个董事会背锅的替罪羊。",
   "sourceZh":"《圣经·利未记》· 公有领域"},

  {"item_order":20,"group":"bible","groupZh":"圣经","nameZh":"犹大之吻","nameEn":"Judas Kiss",
   "tagline":"以亲吻作暗号，出卖了自己追随的夫子。",
   "story":"犹大是耶稣十二门徒之一，为三十枚银币出卖耶稣，约定「我亲吻谁，谁就是耶稣」。客西马尼园中，犹大上前亲吻耶稣，士兵随即拿住了他。此后犹大悔恨自尽，而那三十枚银币成了叛徒报酬的象征。",
   "usageZh":"「犹大」在中文里是叛徒的代称；「犹大之吻」指貌似亲热实则背叛的行为。",
   "ecText":"a Judas / a Judas kiss = betrayal disguised as friendship",
   "ecExample":"His warm praise turned out to be a Judas kiss before the takeover.",
   "ecZh":"他那番热情的赞美，原来是收购前的一记犹大之吻。",
   "sourceZh":"《圣经·马太福音》· 公有领域"},

  {"item_order":21,"group":"bible","groupZh":"圣经","nameZh":"大卫与歌利亚","nameEn":"David and Goliath",
   "tagline":"少年牧童用一颗石子，击败了不可一世的巨人。",
   "story":"非利士巨人歌利亚日日叫阵以色列军，无人敢应。少年大卫拒绝铠甲，只带投石索迎战，一石击中巨人额头，歌利亚倒地身亡，战局就此逆转。后来大卫成为以色列最伟大的君王之一。",
   "usageZh":"「大卫与歌利亚」喻以弱胜强的对决；商界常形容小公司挑战巨头。",
   "ecText":"a David-and-Goliath contest = an underdog's fight against a giant",
   "ecExample":"The tiny startup's lawsuit against the tech giant is pure David and Goliath.",
   "ecZh":"这家小公司状告科技巨头，堪称一场大卫与歌利亚之战。",
   "sourceZh":"《圣经·撒母耳记上》· 公有领域"},

  {"item_order":22,"group":"bible","groupZh":"圣经","nameZh":"所罗门的审判","nameEn":"Judgment of Solomon",
   "tagline":"「把孩子劈成两半」——一句判决试出了真正的母亲。",
   "story":"两个妇人争抢一个婴儿，都自称生母。所罗门王命人将婴儿劈成两半分给二人。真母亲痛心疾首，宁愿放弃孩子也要保全他性命；假母亲却无动于衷。所罗门据此把孩子判给了真正的母亲。",
   "usageZh":"「所罗门式裁决」指以巧妙方式揭示真相的智慧判决；中文有时用「所罗门王的智慧」形容洞察人心。",
   "ecText":"the judgment of Solomon = a wise ruling that reveals the truth",
   "ecExample":"Splitting the contested asset in half was a judgment of Solomon.",
   "ecZh":"把争执的资产一分为二，正是所罗门式的裁决。",
   "sourceZh":"《圣经·列王纪上》· 公有领域"},

  {"item_order":23,"group":"bible","groupZh":"圣经","nameZh":"伊甸园与禁果","nameEn":"Eden & the Forbidden Fruit",
   "tagline":"一切本自圆满，直到偷尝了那枚不该吃的果子。",
   "story":"上帝在伊甸园造了亚当与夏娃，吩咐不可吃分别善恶树上的果子。夏娃受蛇引诱，与亚当一同吃了禁果，从此「眼睛明亮」却失去纯真，被逐出乐园，人类开始承受劳苦与死亡。",
   "usageZh":"「伊甸园」喻指完美乐土；「禁果」喻指被禁止却格外诱人的事物，尤指禁忌之恋。",
   "ecText":"forbidden fruit = something desired precisely because it is forbidden",
   "ecExample":"The classified files were forbidden fruit to the young journalist.",
   "ecZh":"那份机密文件对年轻记者来说，就是一枚禁果。",
   "sourceZh":"《圣经·创世记》· 公有领域"},

  {"item_order":24,"group":"bible","groupZh":"圣经","nameZh":"以眼还眼","nameEn":"An Eye for an Eye",
   "tagline":"「以眼还眼，以牙还牙」——对等的报复，还是冤冤相报？",
   "story":"《旧约》记载古以色列的律法原则：「以眼还眼，以牙还牙」，强调刑罚须与伤害对等，不可滥杀泄愤。后来《新约》中耶稣却提出更高的准则：有人打你的右脸，连左脸也转过来由他打——以宽恕化解仇恨。",
   "usageZh":"中文「以眼还眼，以牙还牙」常用来表达针锋相对的报复；英文此谚语后常接 makes the whole world blind（甘地语）。",
   "ecText":"an eye for an eye = retaliation in equal measure",
   "ecExample":"An eye for an eye makes the whole world blind.",
   "ecZh":"以眼还眼，只会让整个世界都变成瞎子。",
   "sourceZh":"《圣经·出埃及记》/ 甘地 · 公有领域"},

  # ================= 文学与童话 12 =================
  {"item_order":25,"group":"literature","groupZh":"文学与童话","nameZh":"堂吉诃德","nameEn":"Don Quixote",
   "tagline":"把风车当巨人、把客栈当城堡的「疯骑士」。",
   "story":"乡绅堂吉诃德读了太多骑士小说，披上旧铠甲出门行侠仗义。他冲向风车、解救苦役、向羊群宣战，处处碰壁却始终不改其志。塞万提斯本想讽刺骑士文学，却塑造出一个令人又笑又敬的理想主义者。",
   "usageZh":"「堂吉诃德式」形容脱离现实、一厢情愿的理想主义；也含知其不可而为之的悲壮。",
   "ecText":"quixotic = idealistic but impractical",
   "ecExample":"His quixotic plan to save the library won few supporters.",
   "ecZh":"他那拯救图书馆的堂吉诃德式计划，应者寥寥。",
   "sourceZh":"塞万提斯《堂吉诃德》(1605) · 公有领域"},

  {"item_order":26,"group":"literature","groupZh":"文学与童话","nameZh":"浮士德交易","nameEn":"Faustian Bargain",
   "tagline":"把灵魂卖给魔鬼，换取人间的知识与享乐。",
   "story":"老学者浮士德与魔鬼梅菲斯特立约：魔鬼在人间满足他一切欲望，死后他的灵魂归魔鬼所有。浮士德纵情学问、权力与享乐，最终为这桩交易付出沉重代价。",
   "usageZh":"「浮士德式交易」喻指为眼前利益出卖长远价值或原则的交换，常用于科技、商业伦理讨论。",
   "ecText":"a Faustian bargain = trading long-term good for short-term gain",
   "ecExample":"The city's deal with the polluting factory was a Faustian bargain.",
   "ecZh":"这座城市与污染工厂的交易，是一场浮士德式的交换。",
   "sourceZh":"歌德《浮士德》(1808) · 公有领域"},

  {"item_order":27,"group":"literature","groupZh":"文学与童话","nameZh":"弗兰肯斯坦","nameEn":"Frankenstein",
   "tagline":"造物者亲手创造的生命，最终反噬了他的一切。",
   "story":"科学家弗兰肯斯坦用尸块拼出一个人形并赋予它生命，却因它的丑陋而弃之不顾。被遗弃的造物由悲愤走向复仇，接连夺去科学家的亲人，一路将他追到北极。故事的教训：创造者须为创造负责。",
   "usageZh":"「弗兰肯斯坦式」指人造物反噬创造者，如失控的 AI、基因改造等；注意：怪物常被误称弗兰肯斯坦，其实那是造物主的名字。",
   "ecText":"a Frankenstein's monster = a creation that turns against its creator",
   "ecExample":"The algorithm became a Frankenstein's monster that no one could control.",
   "ecZh":"那个算法成了失控反噬的弗兰肯斯坦怪物，无人能管。",
   "sourceZh":"玛丽·雪莱《弗兰肯斯坦》(1818) · 公有领域"},

  {"item_order":28,"group":"literature","groupZh":"文学与童话","nameZh":"化身博士","nameEn":"Dr Jekyll and Mr Hyde",
   "tagline":"白天是德高望重的医生，夜里是作恶多端的怪物。",
   "story":"杰基尔医生研制出药剂，将自己体内的「恶」分离成海德先生。起初他享受双面人生的刺激，渐渐地海德越来越强大，杰基尔无法自控，最终以自杀结束这场人格分裂。",
   "usageZh":"「Jekyll and Hyde」喻双重人格、善恶判若两人；中文常译「化身博士」或「双面人」。",
   "ecText":"a Jekyll and Hyde = a person with two very different sides",
   "ecExample":"He is a Jekyll and Hyde: calm in court, raging at home.",
   "ecZh":"他是个化身博士式的人物：在法庭上冷静，在家里暴怒。",
   "sourceZh":"史蒂文森《化身博士》(1886) · 公有领域"},

  {"item_order":29,"group":"literature","groupZh":"文学与童话","nameZh":"灰姑娘","nameEn":"Cinderella",
   "tagline":"午夜十二点的钟声一响，魔法就会消失。",
   "story":"灰姑娘受继母与姐姐们欺凌，仙女的魔法让她穿上华服与水晶鞋出席舞会，与王子一见钟情。午夜魔法消散，她仓皇离去只留下一只水晶鞋；王子凭鞋寻人，最终与灰姑娘重逢相爱。",
   "usageZh":"「灰姑娘」喻出身低微却一朝成功、被赏识的人；英文 Cinderella story 泛指逆袭故事（黑马），不限性别。",
   "ecText":"a Cinderella story = an unexpected rise from obscurity to success",
   "ecExample":"The rookie team's playoff run is a true Cinderella story.",
   "ecZh":"这支新秀队伍的季后赛之旅，是一个真正的灰姑娘故事。",
   "sourceZh":"夏尔·佩罗《灰姑娘》(1697) · 公有领域"},

  {"item_order":30,"group":"literature","groupZh":"文学与童话","nameZh":"丑小鸭","nameEn":"The Ugly Duckling",
   "tagline":"被嫌弃的「丑鸭子」，原是误入鸭群的天鹅。",
   "story":"一只小天鹅误生在鸭群里，因模样怪异受尽嘲笑与排挤。寒冬里它独自捱过苦难，春天到来时，它低头看见水中的倒影——自己已长成一只优雅的白天鹅。",
   "usageZh":"「丑小鸭变天鹅」喻早年不起眼、后来大放异彩的人，鼓励孩子别因当下的不同而自卑。",
   "ecText":"an ugly duckling = someone who becomes beautiful or successful later",
   "ecExample":"Awkward in school, she was the ugly duckling who grew into a star.",
   "ecZh":"上学时笨拙的她，是后来长成明星的丑小鸭。",
   "sourceZh":"安徒生《丑小鸭》(1843) · 公有领域"},

  {"item_order":31,"group":"literature","groupZh":"文学与童话","nameZh":"皇帝的新衣","nameEn":"The Emperor's New Clothes",
   "tagline":"全城都在夸赞那件并不存在的华服，除了一个孩子。",
   "story":"两个骗子为虚荣的皇帝织「只有聪明人看得见」的新衣。大臣们怕显愚蠢，纷纷称颂；游行那天，百姓也齐声赞美。直到一个孩子喊出「他什么也没穿！」，谎言才被戳穿。",
   "usageZh":"「皇帝的新衣」喻指集体自欺欺人、无人敢说真话的荒谬局面；常用于批评阿谀奉承与从众心理。",
   "ecText":"the emperor has no clothes = the obvious truth everyone pretends not to see",
   "ecExample":"Everyone praised the plan until an intern said the emperor had no clothes.",
   "ecZh":"人人都夸那方案，直到一个实习生说出皇帝没穿衣服。",
   "sourceZh":"安徒生《皇帝的新衣》(1837) · 公有领域"},

  {"item_order":32,"group":"literature","groupZh":"文学与童话","nameZh":"匹诺曹","nameEn":"Pinocchio",
   "tagline":"每说一次谎，鼻子就会变长一截。",
   "story":"老木匠杰佩托雕出木偶匹诺曹，一心盼他成为真正的男孩。匹诺曹贪玩逃学、轻信坏人，每次说谎鼻子就变长。历经被狐狸欺骗、被吞入鱼腹等劫难后，他终于学会诚实与担当，变成了真正的男孩。",
   "usageZh":"中文常说「鼻子变长了」调侃说谎者；心理学里的「匹诺曹效应」亦借指说谎时的生理反应。",
   "ecText":"Pinocchio's nose = a visible sign that someone is lying",
   "ecExample":"Every denial made his nose grow like Pinocchio's.",
   "ecZh":"他每否认一次，鼻子就像匹诺曹一样变长。",
   "sourceZh":"科洛迪《木偶奇遇记》(1883) · 公有领域"},

  {"item_order":33,"group":"literature","groupZh":"文学与童话","nameZh":"彼得潘","nameEn":"Peter Pan",
   "tagline":"永远长不大的男孩，和他的永无岛。",
   "story":"彼得潘是个永远不会长大的男孩，带着温迪与她的弟弟们飞往梦幻的永无岛，与海盗胡克船长斗智斗勇。温迪终将长大，而彼得潘选择永远留在童年。",
   "usageZh":"「彼得潘综合征」指成年人逃避责任、不愿长大；中文里也把这类人叫「长不大的大人」。",
   "ecText":"Peter Pan syndrome = adults who refuse to grow up",
   "ecExample":"At forty he still lives with his mother — a textbook Peter Pan.",
   "ecZh":"四十岁还和母亲同住，是教科书级的彼得潘。",
   "sourceZh":"巴里《彼得潘》(1904) · 公有领域"},

  {"item_order":34,"group":"literature","groupZh":"文学与童话","nameZh":"罗密欧与朱丽叶","nameEn":"Romeo and Juliet",
   "tagline":"两个世仇家族的儿女，用生命成全了爱情。",
   "story":"蒙太古家的罗密欧与凯普莱特家的朱丽叶一见钟情，却因家族世仇无法公开结合。他们秘密成婚，又因一连串误会与决斗双双殉情。两家最终在儿女的坟前握手言和。",
   "usageZh":"中文用「罗密欧与朱丽叶」指生死相许的恋人；英文 Romeo 有时也指多情的青年男子。",
   "ecText":"a Romeo = a passionate, romantic lover",
   "ecExample":"He turned into a regular Romeo whenever she walked in.",
   "ecZh":"她一走进来，他就变成十足的罗密欧。",
   "sourceZh":"莎士比亚《罗密欧与朱丽叶》(1597) · 公有领域"},

  {"item_order":35,"group":"literature","groupZh":"文学与童话","nameZh":"哈姆雷特之问","nameEn":"Hamlet's Question",
   "tagline":"「生存还是毁灭，这是一个问题。」",
   "story":"丹麦王子哈姆雷特得知叔父弑父篡位，决心复仇，却一再犹豫：装疯、试探、误杀、流放……最终在比剑中与仇人同归于尽。「To be, or not to be」成为文学史上最著名的独白。",
   "usageZh":"「哈姆雷特式」形容优柔寡断；中文常说「一千个读者就有一千个哈姆雷特」，指解读因人而异。",
   "ecText":"to be or not to be = the fundamental question of existence",
   "ecExample":"To be or not to be — she weighed the offer all night.",
   "ecZh":"接受还是拒绝——她权衡那份邀请权衡了一整夜，像极了哈姆雷特之问。",
   "sourceZh":"莎士比亚《哈姆雷特》(1603) · 公有领域"},

  {"item_order":36,"group":"literature","groupZh":"文学与童话","nameZh":"海的女儿","nameEn":"The Little Mermaid",
   "tagline":"为爱献上歌喉与鱼尾，最终化为海上泡沫。",
   "story":"小美人鱼救下王子并爱上了他，用美妙的声音向女巫换来双腿，每走一步都如刀割。王子却娶了邻国公主。姐姐们告诉她：只要刺死王子就能回归大海。她不忍下手，在黎明化作泡沫。安徒生让她因善行获得不灭的灵魂。",
   "usageZh":"中文以「海的女儿 / 小美人鱼」喻无怨无悔的牺牲之爱；也提醒人们爱并非总有回报。",
   "ecText":"bittersweet sacrifice — to give everything for love and ask for nothing",
   "ecExample":"Like the little mermaid, she loved silently and let him go.",
   "ecZh":"她像小美人鱼一样默默爱着，然后放手让他离去。",
   "sourceZh":"安徒生《海的女儿》(1837) · 公有领域"},
]

assert len(CARDS) == 37, f'expected 37 cards, got {len(CARDS)}'
# 按列表顺序自动重排 item_order，增删卡片后无需手工维护序号
for i, c in enumerate(CARDS, 1):
    c['item_order'] = i

# ---------------------------------------------------------------------------
# 卡片 CSS（书卷气暖纸白 + 四组低饱和色；深浅两套变量）
# ---------------------------------------------------------------------------
CARD_CSS = """
.wa-root{ background:var(--card); border:1px solid var(--border); border-top:5px solid var(--grp); border-radius:18px; box-shadow:0 6px 18px rgba(45,35,15,.08); margin-bottom:18px; padding:16px 20px 14px; overflow:hidden; transition:box-shadow .2s ease, transform .2s ease; }
.wa-root:hover{ box-shadow:0 10px 26px rgba(45,35,15,.13); transform:translateY(-1px); }
.wa-top{ display:flex; align-items:center; justify-content:space-between; gap:12px; }
.wa-badge{ display:inline-flex; align-items:center; gap:6px; font-size:11.5px; font-weight:800; letter-spacing:.8px; padding:4px 12px; border-radius:9999px; color:#fff; background:var(--grp); box-shadow:0 2px 7px rgba(0,0,0,.14); white-space:nowrap; }
.wa-badge .fa{ font-size:9.5px; opacity:.9; }
.wa-actions{ display:flex; gap:7px; }
.wa-act{ position:relative; width:40px; height:40px; border-radius:9999px; border:1px solid var(--border); cursor:pointer; background:var(--card); color:var(--ink3); font-size:15px; display:inline-flex; align-items:center; justify-content:center; box-shadow:0 1px 3px rgba(0,0,0,.04); transition:all .18s ease; }
.wa-act:hover{ background:var(--grp); border-color:var(--grp); color:#fff; }
.wa-act:active{ transform:scale(.92); }
.wa-act.act-mark.is-active{ background:var(--gold); border-color:var(--gold); color:#fff; }
.wa-act.act-fav.is-active{ background:var(--rose); border-color:var(--rose); color:#fff; }
.wa-act::after{ content:attr(data-tip); position:absolute; top:100%; left:50%; transform:translateX(-50%) translateY(3px); background:var(--ink); color:var(--card); font-size:11.5px; font-weight:600; padding:4px 9px; border-radius:7px; white-space:nowrap; opacity:0; visibility:hidden; pointer-events:none; z-index:20; transition:opacity .18s ease, transform .18s ease, visibility .18s; }
.wa-act:hover::after{ opacity:1; visibility:visible; transform:translateX(-50%) translateY(7px); }
.wa-title{ margin-top:12px; }
.wa-name{ font-size:31px; font-weight:900; color:var(--ink); line-height:1.25; letter-spacing:-.4px; }
.wa-name-en{ margin-top:4px; font-family:Georgia,'Times New Roman',serif; font-size:14px; font-weight:600; color:var(--grptxt); text-transform:uppercase; letter-spacing:2.2px; }
.wa-tag{ margin-top:12px; border-left:4px solid var(--grp); border-radius:0 8px 8px 0; background:var(--grpsoft); padding:8px 13px; font-size:14.5px; line-height:1.7; color:var(--tagfg); font-weight:600; }
.wa-body{ margin-top:6px; }
.wa-sec{ margin-top:15px; }
.wa-sec-label{ display:flex; align-items:center; gap:7px; font-size:10.5px; font-weight:800; letter-spacing:2.4px; color:var(--grptxt); text-transform:uppercase; }
.wa-sec-label::before{ content:''; width:16px; height:3px; background:var(--grp); border-radius:3px; flex:0 0 auto; }
.wa-para{ margin-top:7px; font-size:15px; line-height:1.9; color:var(--body); }
.wa-para + .wa-para{ margin-top:8px; }
.wa-ec{ margin-top:15px; background:var(--grpsoft); border:1px solid var(--grpbdr); border-left:4px solid var(--grp); border-radius:12px; padding:12px 15px 13px; }
.wa-ec-head{ font-size:10.5px; font-weight:800; letter-spacing:2.6px; text-transform:uppercase; color:var(--grptxt); margin-bottom:7px; }
.wa-ec-text{ font-size:15px; font-weight:700; color:var(--ink); line-height:1.55; font-family:Georgia,'Times New Roman',serif; }
.wa-ec-ex{ margin-top:7px; font-size:15px; font-style:italic; color:var(--body); line-height:1.6; font-family:Georgia,'Times New Roman',serif; }
.wa-ec-ex::before{ content:'e.g. '; font-style:normal; font-size:11px; font-weight:700; letter-spacing:.8px; color:var(--grptxt); }
.wa-ec-zh{ margin-top:6px; font-size:13px; color:var(--ink3); line-height:1.6; }
.wa-source{ margin-top:14px; padding-top:9px; border-top:1px dashed var(--border); font-size:11px; color:var(--ink3); letter-spacing:.4px; }
.wa-source b{ font-weight:700; letter-spacing:1.2px; }
"""
# 组色变量：--grp(强) / --grpsoft(浅底) / --grpbdr(浅边) / --grptxt(EC 标题)
CARD_GROUP_CSS = """
:root{
  --card:#ffffff; --border:#e7e2d4; --ink:#211d15; --body:#403a2f; --ink2:#57503f; --ink3:#6d6451;
  --chip:#f1ece0; --gold:#a67c00; --rose:#b3436f; --tagbg:#fbf7ea; --tagfg:#5a4f33;
}
.wa-greek     { --grp:#2f6ac0; --grpsoft:#e7f0fc; --grpbdr:#c4d8f3; --grptxt:#2a5fae; }
.wa-history   { --grp:#c2572d; --grpsoft:#fdeee7; --grpbdr:#f2cfbe; --grptxt:#b14e26; }
.wa-bible     { --grp:#a1841c; --grpsoft:#f7f3de; --grpbdr:#e5d9a9; --grptxt:#917717; }
.wa-literature{ --grp:#7c44b4; --grpsoft:#f2ebfb; --grpbdr:#ddc9f1; --grptxt:#6f3ba8; }
body.dark-mode{
  --card:#221e16; --border:#3c362a; --ink:#f4ecd6; --body:#d7ccb2; --ink2:#b6aa8c; --ink3:#a2957a;
  --chip:#3a3323; --gold:#d4a92c; --rose:#d96b98; --tagbg:#332d1d; --tagfg:#d5c79f;
}
body.dark-mode .wa-greek     { --grp:#7fa9e8; --grpsoft:#232c3d; --grpbdr:#3d4a66; --grptxt:#a9c6f2; }
body.dark-mode .wa-history   { --grp:#e08a5f; --grpsoft:#3a2a22; --grpbdr:#5a3d30; --grptxt:#f0b08f; }
body.dark-mode .wa-bible     { --grp:#cbb553; --grpsoft:#38331e; --grpbdr:#5a4f28; --grptxt:#e0d08a; }
body.dark-mode .wa-literature{ --grp:#c19bf0; --grpsoft:#322a40; --grpbdr:#4c3d63; --grptxt:#d8c0f7; }
body.dark-mode .wa-badge{ color:#19140c; }
body.dark-mode .wa-act::after{ background:#f4ecd6; color:#221e16; }
"""

# ---------------------------------------------------------------------------
# 卡片 JS
# ---------------------------------------------------------------------------
CARD_JS = r"""(function () {
  'use strict';
  function esc(s){ if(s==null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  window.cardTemplate = {
    name: '西方典故 · Western Allusions',
    fields: [
      { key:'group',      label:'分组(内部)',   hideable:false },
      { key:'groupZh',    label:'分组名',       hideable:false },
      { key:'nameZh',     label:'典故名',       hideable:false },
      { key:'nameEn',     label:'英文典故名',   hideable:false },
      { key:'tagline',    label:'一句话速记',   hideable:true  },
      { key:'story',      label:'典故故事',     hideable:false },
      { key:'usageZh',    label:'现代用法',     hideable:true  },
      { key:'ecText',     label:'English Corner', hideable:true  },
      { key:'ecExample',  label:'英文例句',     hideable:true  },
      { key:'ecZh',       label:'例句翻译',     hideable:true  },
      { key:'sourceZh',   label:'出处',         hideable:true  }
    ],
    render: function (cardHtml, cardData, api) {
      var data = (api && api.getCardData) ? api.getCardData() : cardData;
      var d = data.data || {};
      var hidden = (api.getHiddenFields && api.getHiddenFields()) || {};
      function h(k, html){ return (hidden.has && hidden.has(k)) ? '' : html; }
      var g = (d.group === 'history' || d.group === 'bible' || d.group === 'literature') ? d.group : 'greek';
      return '<div class="wa-root wa-'+esc(g)+'" data-card-id="'+esc(data.id)+'">'
        + '<div class="wa-top">'
        +   '<span class="wa-badge"><i class="fa-solid fa-scroll"></i>'+esc(d.groupZh || '')+'</span>'
        +   '<div class="wa-actions">'
        +     '<button class="wa-act act-audio" data-action="audio" data-tip="朗读"><i class="fa-solid fa-volume-high"></i></button>'
        +     '<button class="wa-act act-mark" data-action="mark" data-tip="标记"><i class="fa-regular fa-star"></i></button>'
        +     '<button class="wa-act act-fav" data-action="favorite" data-tip="收藏"><i class="fa-regular fa-bookmark"></i></button>'
        +   '</div>'
        + '</div>'
        + '<div class="wa-title">'
        +   '<div class="wa-name">'+esc(d.nameZh)+'</div>'
        +   h('nameEn', '<div class="wa-name-en">'+esc(d.nameEn)+'</div>')
        + '</div>'
        + h('tagline', '<div class="wa-tag">'+esc(d.tagline)+'</div>')
        + '<div class="wa-body">'
        +   h('story', '<div class="wa-sec"><div class="wa-sec-label">故事 Story</div>'
        +     '<div class="wa-para">'+esc(d.story)+'</div></div>')
        +   h('usageZh', '<div class="wa-sec"><div class="wa-sec-label">现代用法 Today</div>'
        +     '<div class="wa-para">'+esc(d.usageZh)+'</div></div>')
        +   '<div class="wa-sec">'
        +     '<div class="wa-sec-label">English Corner</div>'
        +     '<div class="wa-ec">'
        +       h('ecText', '<div class="wa-ec-text">'+esc(d.ecText)+'</div>')
        +       h('ecExample', '<div class="wa-ec-ex">'+esc(d.ecExample)+'</div>')
        +       h('ecZh', '<div class="wa-ec-zh">'+esc(d.ecZh)+'</div>')
        +     '</div>'
        +   '</div>'
        + '</div>'
        + h('sourceZh', '<div class="wa-source"><b>出处 Source</b> · '+esc(d.sourceZh)+'</div>')
        + '</div>';
    },
    init: function (el, cardData, api) {
      var data = (api && api.getCardData) ? api.getCardData() : cardData;
      var d = data.data || {};
      var ab = el.querySelector('.act-audio');
      if (ab) ab.addEventListener('click', function(){ if(api&&api.playAudio) api.playAudio(d.nameZh || ''); if(api&&api.track) api.track('audio_play'); });
      var mb = el.querySelector('.act-mark');
      if (mb) mb.addEventListener('click', function(){ if(api&&api.toggleMark) api.toggleMark(); mb.classList.toggle('is-active'); var i=mb.querySelector('i'); if(i){ i.classList.toggle('fa-regular'); i.classList.toggle('fa-solid'); } if(api&&api.track) api.track('word_mark'); });
      var vb = el.querySelector('.act-fav');
      if (vb) vb.addEventListener('click', function(){ if(api&&api.toggleFavorite) api.toggleFavorite(); vb.classList.toggle('is-active'); var i=vb.querySelector('i'); if(i){ i.classList.toggle('fa-regular'); i.classList.toggle('fa-solid'); } if(api&&api.track) api.track('favorite_toggle'); });
    }
  };
})();"""

# ---------------------------------------------------------------------------
# Preview 页面（独立自包含，内嵌全部 36 张）
# ---------------------------------------------------------------------------
PAGE_CSS = """
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,"PingFang SC","Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#e9e3d3;color:#322d24;padding:30px 16px 70px;transition:background .2s}
body.dark-mode{background:#17130c}
.wrap{max-width:620px;margin:0 auto}
header{text-align:center;margin-bottom:6px}
header h1{font-size:24px;margin:0 0 6px;color:var(--h1,#322d24);font-weight:800}
header p{margin:0;color:var(--sub,#6f6650);font-size:13.5px;line-height:1.7}
body.dark-mode header h1{--h1:#f0e7cf}
body.dark-mode header p{--sub:#a7987b}
.legend{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:18px 0 26px;font-size:12px;color:var(--sub,#6f6650)}
body.dark-mode .legend{--sub:#a7987b}
.legend .lg{display:inline-flex;align-items:center;gap:6px;background:var(--card,#fdfcf8);border:1px solid var(--border,#e6dfcb);border-radius:9999px;padding:4px 11px}
body.dark-mode .legend{--card:#262016;--border:#3d3625}
.legend .dot{width:10px;height:10px;border-radius:3px;display:inline-block}
#cards{display:flex;flex-direction:column}
.dark-toggle{position:fixed;top:16px;right:16px;z-index:50;border:none;cursor:pointer;background:var(--card,#fdfcf8);color:var(--ink,#322d24);border:1px solid var(--border,#e6dfcb);border-radius:9999px;padding:8px 14px;font-size:13px;font-weight:600;box-shadow:0 1px 4px rgba(0,0,0,.08)}
body.dark-mode .dark-toggle{--card:#262016;--ink:#f0e7cf;--border:#3d3625}
"""

def build_preview():
    legend_items = [
      ('希腊神话', '#4f71a6'), ('罗马与历史', '#9d614a'),
      ('圣经', '#7c6d31'), ('文学与童话', '#7a5ca0'),
    ]
    legend_html = ''.join(
      '<span class="lg"><span class="dot" style="background:%s"></span>%s</span>' % (c, t)
      for t, c in legend_items)
    return """<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>西方典故 · Western Allusions · 37 张双语卡预览</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<style>
%s
%s
%s
</style>
</head>
<body>
<button class="dark-toggle" onclick="document.body.classList.toggle('dark-mode')">深色</button>
<div class="wrap">
<header>
<h1>西方典故 · Western Allusions</h1>
<p>37 张双语卡 · 四组（希腊神话 13 / 罗马与历史 4 / 圣经 8 / 文学与童话 12）· 平铺阅读<br>中文为主 + English Corner · 出处均为公有领域，内容自撰</p>
</header>
<div class="legend">%s</div>
<div id="cards"></div>
</div>
<script>
%s
var CARDS = %s;
var wrap = document.getElementById('cards');
CARDS.forEach(function(d, i){
  var api = {
    getCardData: function(){ return {id: i+1, data: d}; },
    getHiddenFields: function(){ return {}; },
    playAudio: function(t, lang){ try{ var u=new SpeechSynthesisUtterance(t); u.lang = lang || 'zh-CN'; speechSynthesis.speak(u); }catch(e){} },
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
</html>""" % (
        PAGE_CSS, CARD_GROUP_CSS, CARD_CSS, legend_html,
        CARD_JS, json.dumps(CARDS, ensure_ascii=False)
    )

# ---------------------------------------------------------------------------
# 写文件
# ---------------------------------------------------------------------------
template = {
  'name': '西方典故 · Western Allusions',
  'lang': 'zh',
  'description': '西方典故双语卡：中文为主 + English Corner，平铺阅读（希腊神话/罗马与历史/圣经/文学与童话，37 张）。',
  'cardHtml': '',
  'cardCss': CARD_GROUP_CSS + '\n' + CARD_CSS,
  'cardJs': CARD_JS,
  'trackedActions': [
    {'action': 'audio_play', 'label': '朗读'},
    {'action': 'word_mark', 'label': '标记'},
    {'action': 'favorite_toggle', 'label': '收藏'}
  ],
  'sampleData': [CARDS[0], CARDS[13], CARDS[17], CARDS[25]]
}

with open(os.path.join(OUT, 'cards.json'), 'w', encoding='utf-8') as f:
    json.dump(CARDS, f, ensure_ascii=False, indent=2)
    f.write('\n')
with open(os.path.join(OUT, 'template.json'), 'w', encoding='utf-8') as f:
    json.dump(template, f, ensure_ascii=False, indent=2)
    f.write('\n')
with open(os.path.join(OUT, 'preview.html'), 'w', encoding='utf-8') as f:
    f.write(build_preview())

print('Wrote template.json + cards.json + preview.html to', OUT)
print('Cards:', len(CARDS), '| groups:',
      {k: sum(1 for c in CARDS if c['group'] == k) for k in ('greek','history','bible','literature')})
