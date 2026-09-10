/* ===================================================================
   大事年表 — 内置时间轴：文化史（专题史）
   参照人教版高中历史选择性必修 3《文化交流与传播》。
   只写历史常识与高中教材相关表述，不含来源、章节、评论、外部链接。
   =================================================================== */
(function () {
  'use strict';
  var C = window.CHRONO || (window.CHRONO = {});
  var T = 'culture-history';
  var E = function (id, title, display, date, level, summary, extra) {
    return C.makeEvent(T, id, title, display, date, level, summary, extra);
  };

  C.builtinTimelines.push({
    id: 'culture-history',
    title: '文化史',
    subtitle: '思想、信仰与文明互鉴',
    category: '专题史',
    color: '#b07de0',
    order: 40,
    description: '以文化传承与交流为主线串起中外历史：中华文化的形成、世界多元文明、人口迁徙与文化认同、商路贸易、战争碰撞与遗产保护，参照人教版选择性必修 3《文化交流与传播》。',
    source: 'builtin',
    version: 1,
    events: [

      /* ---------- 中华文化的形成与发展 ---------- */
      E('cul-liangzhu', '良渚文化与早期中华文明', '约公元前3300年',
        { year: -3300, precision: 'circa', circa: true }, 3,
        '长江下游的良渚文化出现大型古城、水利系统与精美玉器，表明当时已进入早期文明社会。',
        { tags: ['考古发现'], region: '南方' }),

      E('cul-hundred-schools', '百家争鸣与中华文化奠基', '公元前770—前221年',
        { year: -495, precision: 'range', rangeStart: -770, rangeEnd: -221 }, 1,
        '春秋战国时期儒、道、墨、法等学派著书立说，互相争辩又彼此吸收，奠定了中华文化的基本格局与精神内核。',
        { tags: ['思想文化'] }),

      E('cul-qin-book-burning', '秦朝焚书坑儒', '公元前213年',
        { year: -213, precision: 'year' }, 3,
        '秦始皇下令焚毁民间收藏的《诗》《书》与百家著作，又坑杀方士儒生，实行文化专制，儒学受到沉重打击。',
        { tags: ['思想文化'] }),

      E('cul-han-confucianism', '汉武帝尊崇儒术', '公元前134年',
        { year: -134, precision: 'year' }, 1,
        '汉武帝采纳董仲舒建议，罢黜百家、尊崇儒术，儒学成为国家正统思想，此后长期居于主流地位。',
        { tags: ['思想文化'] }),

      E('cul-tai-xue', '汉代太学与五经', '公元前124年',
        { year: -124, precision: 'year' }, 3,
        '汉武帝设立五经博士、兴办太学，儒学教育与选官相结合，形成读经入仕的传统。',
        { tags: ['教育'] }),

      E('cul-buddhism-in', '佛教传入中国', '公元1世纪',
        { year: 65, precision: 'century', circa: true }, 2,
        '佛教在两汉之际经西域传入中原，此后逐步与中国本土文化融合，成为中华文化的重要组成部分。',
        { tags: ['宗教'] }),

      E('cul-daoism', '道教的形成', '公元2世纪',
        { year: 150, precision: 'century', circa: true }, 3,
        '东汉时期道教在神仙方术与黄老思想的基础上形成，中国本土宗教自此确立。',
        { tags: ['宗教'] }),

      E('cul-grottoes', '敦煌莫高窟开始营建', '公元366年',
        { year: 366, precision: 'year' }, 2,
        '敦煌莫高窟自十六国时期开始营建，历北朝、隋唐至元代不断开凿，是中外文化交融的艺术宝库。',
        { tags: ['艺术'], region: '西北' }),

      E('cul-xuanxue', '魏晋玄学与佛教盛行', '公元4—5世纪',
        { year: 400, precision: 'range', rangeStart: 300, rangeEnd: 500 }, 3,
        '魏晋时期玄学兴起，士人崇尚清谈；佛教广泛传播，寺院经济与佛教艺术迅速发展。',
        { tags: ['思想文化'] }),

      E('cul-taika', '日本大化改新与吸收唐文化', '公元646年',
        { year: 646, precision: 'year' }, 2,
        '日本进行大化改新，仿照唐朝制度建立中央集权国家，借用汉字创制文字，东亚文化圈逐步形成。',
        { tags: ['文化交流'], region: '东亚' }),

      E('cul-tang-three-religions', '隋唐三教并行与遣唐使', '公元7—9世纪',
        { year: 750, precision: 'range', rangeStart: 600, rangeEnd: 900 }, 1,
        '唐朝实行三教并行政策，日本多次派遣唐使来华，学习制度、文字与技术，中华文化深刻影响东亚地区。',
        { tags: ['文化交流'] }),

      E('cul-tang-poetry', '唐诗与古文运动', '公元8—9世纪',
        { year: 800, precision: 'range', rangeStart: 650, rangeEnd: 900 }, 3,
        '唐代诗歌达到高峰，李白、杜甫等名家辈出；韩愈、柳宗元倡导古文运动，反对骈文、主张文以载道。',
        { tags: ['文学'] }),

      E('cul-song-neoconfucianism', '宋明理学形成', '公元11—13世纪',
        { year: 1150, precision: 'range', rangeStart: 1000, rangeEnd: 1300 }, 1,
        '程颢、程颐、朱熹等以儒学为核心吸收佛道思想，形成理学，成为此后数百年的官方哲学。',
        { tags: ['思想文化'] }),

      E('cul-academy', '书院教育与科举', '公元12世纪',
        { year: 1150, precision: 'century', circa: true }, 3,
        '宋代书院兴盛，讲学与科举并重，儒学教育普及，印刷术的进步促进了书籍流传。',
        { tags: ['教育'] }),

      E('cul-ming-qing-fiction', '明清小说与市民文化', '公元14—18世纪',
        { year: 1600, precision: 'range', rangeStart: 1350, rangeEnd: 1800 }, 3,
        '《三国演义》《水浒传》《西游记》《红楼梦》等长篇小说相继问世，戏曲繁荣，市民文化兴起。',
        { tags: ['文学'] }),

      E('cul-forbidden-city', '北京故宫建成', '公元1420年',
        { year: 1420, precision: 'year' }, 2,
        '明成祖时期北京宫城建成，是中国现存规模最大、保存最完整的古代宫殿建筑群，集中体现了传统建筑与礼制文化。',
        { tags: ['建筑'], region: '华北' }),

      E('cul-west-learning', '西学东渐与传教士来华', '公元16—18世纪',
        { year: 1650, precision: 'range', rangeStart: 1550, rangeEnd: 1750 }, 2,
        '利玛窦等传教士来华，传播天文、历法、数学与地理知识，同时把中国文化介绍到欧洲。',
        { tags: ['文化交流'] }),

      E('cul-open-eyes', '开眼看世界与《海国图志》', '公元1842年',
        { year: 1842, precision: 'year' }, 2,
        '鸦片战争后，林则徐、魏源等开始了解西方，魏源编成《海国图志》，提出「师夷长技以制夷」。',
        { tags: ['思想文化'], region: '中国' }),

      E('cul-imperial-college', '京师大学堂创办', '公元1898年',
        { year: 1898, precision: 'year' }, 3,
        '戊戌变法期间设立京师大学堂，是中国近代第一所国立综合性大学，成为新式教育的开端。',
        { tags: ['教育'], region: '中国' }),

      E('cul-new-culture', '新文化运动提倡民主与科学', '公元1915年9月',
        { year: 1915, month: 9, precision: 'month' }, 1,
        '陈独秀创办《青年杂志》，提倡民主与科学，反对旧道德旧文化，掀起思想解放潮流。',
        { tags: ['思想文化'], region: '中国' }),

      E('cul-marxism-china', '马克思主义在中国传播', '公元1918年',
        { year: 1918, precision: 'year' }, 1,
        '十月革命后，李大钊率先在中国系统介绍马克思主义；五四运动后马克思主义广泛传播，为新思想的发展开辟了道路。',
        { tags: ['思想文化'], region: '中国' }),

      /* ---------- 世界多元文化 ---------- */
      E('cul-egypt-culture', '古埃及的宗教与文字', '约公元前3000年',
        { year: -3000, precision: 'circa', circa: true }, 3,
        '古埃及人创造象形文字，信奉多神教并相信来世，金字塔与相关文献体现了其独特的宗教与生死观。',
        { tags: ['宗教', '文字'], region: '北非' }),

      E('cul-hammurabi', '《汉谟拉比法典》', '约公元前18世纪',
        { year: -1750, precision: 'century', circa: true }, 2,
        '古巴比伦国王汉谟拉比颁布法典，是世界上现存最早的较为完备的成文法典，体现了两河流域的法律传统。',
        { tags: ['法律'], region: '西亚' }),

      E('cul-india-caste', '古印度种姓制度与婆罗门教', '约公元前1500年',
        { year: -1500, precision: 'circa', circa: true }, 2,
        '雅利安人进入印度后形成婆罗门、刹帝利、吠舍、首陀罗四个等级，种姓制度与婆罗门教深刻影响印度社会。',
        { tags: ['社会', '宗教'], region: '南亚' }),

      E('cul-greek-philosophy', '古希腊哲学与史学', '公元前5—前4世纪',
        { year: -450, precision: 'range', rangeStart: -600, rangeEnd: -300 }, 1,
        '苏格拉底、柏拉图、亚里士多德奠定西方哲学传统；希罗多德、修昔底德开创西方史学。',
        { tags: ['思想文化'], region: '欧洲' }),

      E('cul-ashoka-buddhism', '佛教兴盛与阿育王传播', '约公元前3世纪',
        { year: -250, precision: 'century', circa: true }, 2,
        '阿育王皈依佛教并向周边派遣传教使团，佛教由印度向南亚、东南亚和中亚传播。',
        { tags: ['宗教'], region: '南亚' }),

      E('cul-roman-law', '罗马法与拉丁文化', '公元前5—公元6世纪',
        { year: 100, precision: 'range', rangeStart: -450, rangeEnd: 565 }, 2,
        '从《十二铜表法》到《查士丁尼法典》，罗马法不断完备，拉丁语通行地中海，成为大陆法系的源头。',
        { tags: ['法律'], region: '欧洲' }),

      E('cul-arab-culture', '阿拉伯帝国与东西方文化传播', '公元8—12世纪',
        { year: 900, precision: 'range', rangeStart: 700, rangeEnd: 1200 }, 1,
        '阿拉伯人吸收希腊、波斯、印度文化，翻译典籍并发展数学与天文，把印度数字、中国造纸术传到欧洲。',
        { tags: ['文化交流'], region: '欧亚' }),

      E('cul-renaissance', '文艺复兴', '公元14—17世纪',
        { year: 1500, precision: 'range', rangeStart: 1300, rangeEnd: 1650 }, 1,
        '意大利兴起以人文主义为核心的思想文化运动，但丁、达·芬奇、莎士比亚等巨匠辈出，推动了思想解放。',
        { tags: ['思想文化'], region: '欧洲', sharedEventId: 'renaissance' }),

      E('cul-reformation', '马丁·路德宗教改革', '公元1517年',
        { year: 1517, precision: 'year' }, 1,
        '马丁·路德发表《九十五条论纲》，反对罗马教廷的权威与赎罪券，宗教改革推动了民族语言与民族国家的发展。',
        { tags: ['宗教'], region: '欧洲' }),

      E('cul-copernicus', '哥白尼提出日心说', '公元1543年',
        { year: 1543, precision: 'year' }, 2,
        '哥白尼发表《天体运行论》，提出日心说，动摇了地心说的统治地位，近代自然科学由此起步。',
        { tags: ['科学'], region: '欧洲' }),

      E('cul-newton', '牛顿建立经典力学体系', '公元1687年',
        { year: 1687, precision: 'year' }, 2,
        '牛顿发表《自然哲学的数学原理》，提出运动三定律与万有引力定律，近代科学革命达到高峰。',
        { tags: ['科学'], region: '欧洲' }),

      E('cul-enlightenment', '启蒙运动', '公元17—18世纪',
        { year: 1750, precision: 'range', rangeStart: 1650, rangeEnd: 1800 }, 1,
        '伏尔泰、孟德斯鸠、卢梭等提倡理性、自由、平等与法治，为资产阶级革命和近代政治制度提供了思想武器。',
        { tags: ['思想文化'], region: '欧洲' }),

      E('cul-darwin', '达尔文与进化论', '公元1859年',
        { year: 1859, precision: 'year' }, 2,
        '达尔文发表《物种起源》，提出生物进化与自然选择学说，冲击了神创论，也影响了社会科学思潮。',
        { tags: ['科学'] }),

      E('cul-romantic-realism', '浪漫主义与现实主义文艺', '公元19世纪',
        { year: 1850, precision: 'century' }, 3,
        '浪漫主义强调情感与想象，现实主义注重批判社会现实，雨果、巴尔扎克、托尔斯泰等留下大量名著。',
        { tags: ['文学艺术'] }),

      /* ---------- 人口迁徙与文化认同 ---------- */
      E('cul-germanic-migration', '日耳曼人大迁徙', '公元4—5世纪',
        { year: 450, precision: 'range', rangeStart: 370, rangeEnd: 500 }, 1,
        '日耳曼各部族大规模迁入罗马帝国境内，西罗马帝国灭亡，欧洲进入中世纪，民族与文化重新组合。',
        { tags: ['人口迁徙'], region: '欧洲' }),

      E('cul-china-southward', '中国古代人口南迁', '公元4—6世纪',
        { year: 400, precision: 'range', rangeStart: 300, rangeEnd: 600 }, 2,
        '西晋末年以来北方人口大量南迁，带来先进技术与劳动力，江南得到开发，南北文化加速融合。',
        { tags: ['人口迁徙'], region: '中国' }),

      E('cul-mongol-westward', '蒙古西征与东西方交流', '公元13世纪',
        { year: 1250, precision: 'century', circa: true }, 2,
        '蒙古西征建立起横跨欧亚的庞大帝国，促进了东西方人员、技术与文化交流，同时也带来巨大破坏。',
        { tags: ['战争', '交流'], region: '欧亚' }),

      E('cul-migration-after-voyages', '新航路开辟后的跨洲移民', '公元16—19世纪',
        { year: 1750, precision: 'range', rangeStart: 1500, rangeEnd: 1900 }, 2,
        '欧洲人迁往美洲、大洋洲，非洲黑奴被贩卖到美洲，形成世界性的人口迁移与族群重构。',
        { tags: ['人口迁徙'] }),

      E('cul-chinese-laborers', '华工与海外华人社会', '公元19世纪中叶',
        { year: 1850, precision: 'century', circa: true }, 3,
        '大量华工赴美洲、东南亚等地谋生，为当地开发作出贡献，同时形成海外华人社会，传播了中华文化。',
        { tags: ['人口迁徙'], region: '全球' }),

      E('cul-usa-immigration', '美国移民社会', '公元19—20世纪',
        { year: 1900, precision: 'range', rangeStart: 1820, rangeEnd: 1920 }, 3,
        '欧洲、亚洲移民大量涌入美国，形成多元文化社会，同时也存在种族歧视与排华等排外现象。',
        { tags: ['人口迁徙'], region: '美国' }),

      E('cul-partition-india', '印巴分治与人口大迁移', '公元1947年',
        { year: 1947, precision: 'year' }, 3,
        '印度独立后按宗教分为印度和巴基斯坦，上千万人跨越新边界迁移，教派冲突造成大量伤亡。',
        { tags: ['人口迁徙'], region: '南亚' }),

      E('cul-israel-founded', '以色列建国与中东移民', '公元1948年',
        { year: 1948, precision: 'year' }, 3,
        '以色列建国后，世界各地犹太人陆续迁入，同时造成巴勒斯坦难民问题，中东局势长期动荡。',
        { tags: ['人口迁徙'], region: '西亚' }),

      /* ---------- 商路、贸易与文化交流 ---------- */
      E('cul-silk-road', '丝绸之路与文化交融', '公元前2世纪',
        { year: -130, precision: 'range', rangeStart: -138, rangeEnd: -119 }, 2,
        '丝绸之路不仅是商路，也是宗教、艺术与技术的传播通道，佛教、祆教、摩尼教等相继沿丝路东传。',
        { tags: ['交通', '交流'] }),

      E('cul-maritime-silk-road', '海上丝绸之路', '公元2—15世纪',
        { year: 1000, precision: 'range', rangeStart: 100, rangeEnd: 1500 }, 2,
        '中国与东南亚、印度、阿拉伯之间的海上航路持续繁荣，瓷器、香料、珠宝往来，宗教与艺术随之传播。',
        { tags: ['交通', '交流'] }),

      E('cul-paper-spread', '造纸术发明与西传', '公元105年',
        { year: 105, precision: 'year' }, 2,
        '东汉蔡伦改进造纸术，此后经中亚、阿拉伯传入欧洲，纸张取代羊皮与莎草，促进了文化传播与教育普及。',
        { tags: ['科技'], sharedEventId: 'paper' }),

      E('cul-four-inventions', '四大发明外传', '公元8—13世纪',
        { year: 1000, precision: 'range', rangeStart: 700, rangeEnd: 1300 }, 1,
        '造纸术、印刷术、火药、指南针经由阿拉伯人传入欧洲，对欧洲的社会转型产生了深远影响。',
        { tags: ['科技', '交流'] }),

      E('cul-marco-polo', '马可·波罗来华', '公元1271—1295年',
        { year: 1280, precision: 'range', rangeStart: 1271, rangeEnd: 1295 }, 2,
        '意大利人马可·波罗来到元朝，回国后口述《马可·波罗行纪》，激发了欧洲人对东方的向往。',
        { tags: ['文化交流'], region: '欧亚' }),

      E('cul-zhenghe', '郑和下西洋与文化交流', '公元1405年',
        { year: 1405, precision: 'year' }, 2,
        '郑和七下西洋，船队所至带去丝绸、瓷器与历法技术，也带回各地物产与见闻，促进了海上文化交流。',
        { tags: ['文化交流'], sharedEventId: 'zhenghe' }),

      E('cul-silver-trade', '跨太平洋的丝银贸易', '公元16—18世纪',
        { year: 1650, precision: 'range', rangeStart: 1565, rangeEnd: 1815 }, 3,
        '中国丝绸、瓷器经马尼拉大帆船运往美洲，美洲白银大量流入中国，形成连接三大洲的贸易网络。',
        { tags: ['贸易', '交流'] }),

      /* ---------- 战争与文化碰撞 ---------- */
      E('cul-alexander', '亚历山大东征与希腊化时代', '公元前334—前324年',
        { year: -329, precision: 'range', rangeStart: -334, rangeEnd: -324 }, 2,
        '亚历山大东征建立横跨欧亚非的帝国，希腊文化与西亚、埃及、印度文化交融，形成希腊化时代。',
        { tags: ['战争', '交流'], region: '欧亚' }),

      E('cul-napoleon-wars', '拿破仑战争与欧洲民族主义', '公元1799—1815年',
        { year: 1807, precision: 'range', rangeStart: 1799, rangeEnd: 1815 }, 3,
        '拿破仑战争传播了法国大革命的原则，也激发了被征服地区的民族意识，欧洲政治版图重新划分。',
        { tags: ['战争'], region: '欧洲' }),

      E('cul-gandhi', '甘地与非暴力不合作运动', '公元1920—1942年',
        { year: 1931, precision: 'range', rangeStart: 1920, rangeEnd: 1942 }, 2,
        '甘地领导印度非暴力不合作运动，反对英国殖民统治，推动了印度民族独立运动的发展。',
        { tags: ['抗争'], region: '南亚' }),

      E('cul-kemal', '凯末尔革命与土耳其现代化', '公元1919—1923年',
        { year: 1921, precision: 'range', rangeStart: 1919, rangeEnd: 1923 }, 3,
        '凯末尔领导土耳其民族解放战争，建立共和国并推行世俗化改革，探索出一条现代化道路。',
        { tags: ['改革'], region: '西亚' }),

      /* ---------- 文化的保护与传承 ---------- */
      E('cul-dunhuang-library', '敦煌藏经洞文献被发现', '公元1900年',
        { year: 1900, precision: 'year' }, 3,
        '敦煌莫高窟藏经洞被发现，出土数万件写本与文书，是研究中古中国与中外交流的珍贵资料，后大量流散海外。',
        { tags: ['文献'], region: '西北' }),

      E('cul-world-heritage', '《保护世界文化与自然遗产公约》', '公元1972年',
        { year: 1972, precision: 'year' }, 2,
        '联合国教科文组织通过世界遗产公约，中国于 1985 年加入，长城、故宫、莫高窟等先后列入世界遗产名录。',
        { tags: ['遗产保护'] }),

      E('cul-intangible-heritage', '《保护非物质文化遗产公约》', '公元2003年',
        { year: 2003, precision: 'year' }, 3,
        '联合国教科文组织通过保护非物质文化遗产公约，昆曲、古琴艺术、京剧等中国项目先后入选。',
        { tags: ['遗产保护'] }),

      E('cul-digital-heritage', '数字技术助力文化遗产保护', '公元21世纪',
        { year: 2010, precision: 'century', circa: true }, 3,
        '数字化采集、三维重建与在线开放让文物与古籍得以长期保存和广泛传播，文化遗产保护进入数字时代。',
        { tags: ['遗产保护', '科技'] })
    ]
  });
})();
