/* ===================================================================
   大事年表 — 内置时间轴：经济史（专题史）
   参照人教版高中历史选择性必修 2《经济与社会生活》与《中外历史纲要》经济主线。
   只写历史常识与高中教材相关表述，不含来源、章节、评论、外部链接。
   =================================================================== */
(function () {
  'use strict';
  var C = window.CHRONO || (window.CHRONO = {});
  var T = 'economy-history';
  var E = function (id, title, display, date, level, summary, extra) {
    return C.makeEvent(T, id, title, display, date, level, summary, extra);
  };

  C.builtinTimelines.push({
    id: 'economy-history',
    title: '经济史',
    subtitle: '食物生产、商贸与工业化',
    category: '专题史',
    color: '#5cb98c',
    order: 30,
    description: '以经济活动为主线串起中外历史：从农业起源、赋役制度、商路贸易到工业革命、世界市场与全球化，参照人教版选择性必修 2《经济与社会生活》。',
    source: 'builtin',
    version: 1,
    events: [

      /* ---------- 农业起源与古代经济 ---------- */
      E('eco-west-asia-agri', '西亚原始农业出现', '约公元前9000年',
        { year: -9000, precision: 'circa', circa: true }, 2,
        '西亚地区最早培育小麦、大麦，并驯养绵羊、山羊，人类由采集渔猎转向食物生产，史称「农业革命」。',
        { tags: ['经济', '起源'], region: '西亚' }),

      E('eco-rice-china', '中国长江中下游栽培水稻', '约公元前8000年',
        { year: -8000, precision: 'circa', circa: true }, 2,
        '长江中下游地区出现水稻栽培，中国是世界上最早培植水稻的地区之一，南方稻作农业由此形成。',
        { tags: ['经济', '起源'], region: '南方' }),

      E('eco-millet-china', '中国黄河流域栽培粟', '约公元前6000年',
        { year: -6000, precision: 'circa', circa: true }, 3,
        '黄河流域出现粟作农业，形成北粟南稻的原始农业格局，为中华文明的产生提供了物质基础。',
        { tags: ['经济', '起源'], region: '北方' }),

      E('eco-maize-america', '中美洲栽培玉米', '约公元前5000年',
        { year: -5000, precision: 'circa', circa: true }, 3,
        '中美洲居民开始栽培玉米，玉米、马铃薯、甘薯等作物后来传播到世界，改变了各地的食物结构。',
        { tags: ['经济', '起源'], region: '美洲' }),

      E('eco-mesopotamia-irrigation', '两河流域的灌溉农业', '约公元前3000年',
        { year: -3000, precision: 'circa', circa: true }, 3,
        '两河流域居民修建灌溉系统，用牛拉犁耕作，农业生产率提高，为城邦和早期国家的出现提供了物质基础。',
        { tags: ['经济', '水利'], region: '西亚' }),

      E('eco-zhou-jingtian', '西周井田制与青铜农具', '约公元前11世纪',
        { year: -1050, precision: 'century', circa: true }, 3,
        '西周实行井田制，土地归国家所有、集体耕作；农业生产以青铜工具和耒耜为主，耕作技术仍较原始。',
        { tags: ['经济', '制度'], region: '中原' }),

      E('eco-iron-ox', '铁制农具与牛耕推广', '约公元前5世纪',
        { year: -500, precision: 'century', circa: true }, 1,
        '春秋战国时期铁制农具和牛耕逐步推广，生产力显著提高，井田制走向瓦解，土地私有制逐渐确立。',
        { tags: ['经济', '技术'] }),

      E('eco-shangyang-econ', '商鞅变法中的经济改革', '公元前356年',
        { year: -356, precision: 'year' }, 2,
        '废井田、开阡陌，承认土地私有并允许买卖；奖励耕织、统一度量衡，奠定了此后两千余年的基本经济制度框架。',
        { tags: ['经济', '改革'], region: '秦国', sharedEventId: 'shangyang' }),

      E('eco-rome-villa', '罗马的奴隶制庄园与地中海贸易', '约公元前2世纪',
        { year: -150, precision: 'century', circa: true }, 3,
        '罗马征服地中海周边后，奴隶制大庄园和手工业发展，地中海成为罗马的「内海」，商业往来频繁。',
        { tags: ['经济'], region: '欧洲' }),

      E('eco-qin-unify-currency', '秦统一货币与度量衡', '公元前221年',
        { year: -221, precision: 'year' }, 2,
        '秦朝统一货币为圆形方孔半两钱，统一度量衡与车轨，废除六国旧币，促进了全国范围内的经济往来。',
        { tags: ['经济', '制度'] }),

      E('eco-silk-road', '丝绸之路开通', '公元前2世纪',
        { year: -130, precision: 'range', rangeStart: -138, rangeEnd: -119 }, 1,
        '张骞通西域后，连接中国与中亚、西亚直达欧洲的丝绸之路逐步开通，丝绸、漆器西传，香料、琉璃、良马东来。',
        { tags: ['贸易', '交通'] }),

      E('eco-han-daitian', '汉代代田法与耧车', '公元前1世纪',
        { year: -100, precision: 'century', circa: true }, 3,
        '汉代推行代田法，推广耧车播种与牛耕，配合水利工程，单位面积产量得到提高。',
        { tags: ['技术'] }),

      E('eco-han-salt-iron', '汉武帝推行盐铁官营', '公元前119年',
        { year: -119, precision: 'year' }, 3,
        '汉武帝推行盐铁官营、均输平准，把盐、铁等重要物资收归国家经营，加强了朝廷对经济的控制。',
        { tags: ['制度'] }),

      E('eco-rome-trade', '罗马帝国的地中海贸易网', '公元1世纪',
        { year: 50, precision: 'century', circa: true }, 3,
        '罗马帝国境内道路与海路畅通，粮食、葡萄酒、橄榄油与东方奢侈品形成规模贸易，金币广泛流通。',
        { tags: ['贸易'], region: '欧洲' }),

      E('eco-manor', '西欧庄园制兴起', '公元5世纪',
        { year: 500, precision: 'century', circa: true }, 3,
        '西罗马帝国灭亡后，西欧形成庄园制度，土地归领主所有，农奴承担劳役地租，经济自给自足、商品经济衰退。',
        { tags: ['制度'], region: '欧洲' }),

      E('eco-juntian-zutiao', '北魏均田制与租调制', '公元485年',
        { year: 485, precision: 'year' }, 3,
        '北魏孝文帝改革推行均田制，按人口分配国家掌握的土地，配套租调制，有利于农业恢复和国家赋税征收。',
        { tags: ['制度'] }),

      E('eco-byzantium-arab-route', '拜占庭与阿拉伯商路', '公元7世纪',
        { year: 650, precision: 'century', circa: true }, 3,
        '拜占庭帝国控制东西方陆海商路；阿拉伯帝国兴起后贯通波斯湾、红海与地中海，转口贸易十分繁荣。',
        { tags: ['贸易'], region: '欧亚' }),

      E('eco-grand-canal', '隋朝开通大运河', '公元605年',
        { year: 605, precision: 'year' }, 1,
        '隋炀帝下令开凿贯通南北的大运河，连接政治中心与经济富庶地区，成为南北物资运输的大动脉。',
        { tags: ['交通'] }),

      E('eco-curved-plow', '曲辕犁与筒车', '公元8世纪',
        { year: 750, precision: 'century', circa: true }, 3,
        '唐代江东地区出现曲辕犁，可以调节犁地深浅；筒车用于提水灌溉，农业生产工具进一步改进。',
        { tags: ['技术'] }),

      E('eco-liangshuifa', '唐朝推行两税法', '公元780年',
        { year: 780, precision: 'year' }, 1,
        '宰相杨炎建议推行两税法，按资产和土地征税、分夏秋两次征收，改变了自战国以来以人丁为主的赋税制度。',
        { tags: ['制度'] }),

      E('eco-medieval-town', '中世纪西欧城市与行会', '公元11世纪',
        { year: 1050, precision: 'century', circa: true }, 3,
        '西欧城市重新兴起，手工业者组成行会，商人阶层壮大，市民争取自治，为资本主义萌芽提供了条件。',
        { tags: ['经济'], region: '欧洲' }),

      E('eco-song-jiaozi', '宋代商品经济与纸币「交子」', '公元1023年',
        { year: 1023, precision: 'year' }, 2,
        '北宋在四川出现世界上最早的纸币「交子」，城市商业突破市坊界限，商品流通规模明显扩大。',
        { tags: ['经济', '金融'] }),

      E('eco-hanseatic', '汉萨同盟与地中海商业', '公元12—14世纪',
        { year: 1275, precision: 'range', rangeStart: 1150, rangeEnd: 1400 }, 3,
        '北欧汉萨同盟控制波罗的海贸易，意大利威尼斯、热那亚商人经营地中海转运贸易，东西方商品在此交汇。',
        { tags: ['贸易'], region: '欧洲' }),

      E('eco-mongol-route', '蒙古西征后欧亚商路通畅', '公元13世纪',
        { year: 1250, precision: 'century', circa: true }, 3,
        '蒙古西征后欧亚大陆商路通畅，驿站制度发达，东西方商品与技术交流空前活跃。',
        { tags: ['贸易'], region: '欧亚' }),

      E('eco-zhenghe-trade', '郑和下西洋与朝贡贸易', '公元1405年',
        { year: 1405, precision: 'year' }, 2,
        '郑和七下西洋，以朝贡贸易形式与东南亚、南亚、西亚各国往来，是中国古代规模最大的海上远航。',
        { tags: ['贸易'], sharedEventId: 'zhenghe' }),

      E('eco-single-whip', '明朝推行一条鞭法', '公元1581年',
        { year: 1581, precision: 'year' }, 1,
        '张居正改革推行一条鞭法，把田赋、徭役、杂税合并折银征收、按亩折算，赋役制度由实物转向货币。',
        { tags: ['制度'] }),

      E('eco-tan-ding', '清朝推行摊丁入亩', '公元1712年',
        { year: 1712, precision: 'year' }, 2,
        '康熙宣布「滋生人丁，永不加赋」，雍正推行摊丁入亩，把丁银摊入田赋，延续两千年的人头税基本废除。',
        { tags: ['制度'] }),

      /* ---------- 新航路与工业化 ---------- */
      E('eco-new-route', '新航路开辟与商业革命', '公元15世纪末—16世纪',
        { year: 1500, precision: 'range', rangeStart: 1487, rangeEnd: 1550 }, 1,
        '哥伦布、达·伽马等开辟新航路，欧洲贸易中心由地中海转移到大西洋沿岸，世界市场开始形成。',
        { tags: ['贸易', '全球化'] }),

      E('eco-price-revolution', '欧洲价格革命', '公元16世纪',
        { year: 1550, precision: 'century' }, 2,
        '美洲白银大量流入欧洲，物价飞涨，封建地主收入相对下降、新兴资产阶级财富增长，加速了社会分化。',
        { tags: ['经济'], region: '欧洲' }),

      E('eco-triangle-trade', '大西洋三角贸易与黑奴贸易', '公元16—19世纪',
        { year: 1700, precision: 'range', rangeStart: 1550, rangeEnd: 1850 }, 2,
        '欧洲商人把工业品运往非洲换取黑奴，运到美洲出售后运回蔗糖、棉花，血腥的三角贸易使非洲丧失大量人口。',
        { tags: ['贸易'], region: '大西洋' }),

      E('eco-east-india', '东印度公司成立', '公元1600年',
        { year: 1600, precision: 'year' }, 2,
        '英国东印度公司获得女王特许状，垄断对东方的贸易，成为欧洲殖民扩张与商业资本积累的重要工具。',
        { tags: ['贸易', '殖民'], region: '欧洲' }),

      E('eco-mercantilism', '重商主义与殖民争夺', '公元17世纪',
        { year: 1650, precision: 'century' }, 3,
        '欧洲各国奉行重商主义，把金银视为财富，通过关税、航海条例和殖民地贸易争夺商业霸权。',
        { tags: ['政策'], region: '欧洲' }),

      E('eco-enclosure', '英国圈地运动与农业革命', '公元18世纪',
        { year: 1750, precision: 'century', circa: true }, 3,
        '英国圈地运动使土地集中经营，农业技术与产量提高，同时为工业提供了自由劳动力与国内市场。',
        { tags: ['经济'], region: '欧洲' }),

      E('eco-industrial', '工业革命开始', '公元18世纪60年代',
        { year: 1765, precision: 'decade' }, 1,
        '英国首先出现以蒸汽机为标志的机器大生产，工厂制度确立，人类进入「蒸汽时代」。',
        { tags: ['经济', '技术'], sharedEventId: 'industrial' }),

      E('eco-railway', '世界第一条铁路通车', '公元1825年',
        { year: 1825, precision: 'year' }, 3,
        '英国斯托克顿至达灵顿的铁路通车，铁路运输迅速推广，大幅降低了运输成本、扩大了市场范围。',
        { tags: ['交通'] }),

      E('eco-yangwu-industry', '洋务运动创办近代工业', '公元1861年',
        { year: 1861, precision: 'year' }, 2,
        '洋务派以自强、求富为口号创办军事和民用工业，中国出现第一批近代企业，民族资本主义工业随之产生。',
        { tags: ['经济', '近代化'], region: '中国' }),

      E('eco-second-industrial', '第二次工业革命与垄断组织', '公元19世纪70年代',
        { year: 1870, precision: 'decade' }, 1,
        '电力、内燃机与化学工业广泛应用，生产与资本加速集中，垄断组织出现，主要资本主义国家进入垄断阶段。',
        { tags: ['经济', '技术'] }),

      E('eco-world-market', '资本主义世界市场最终形成', '公元19世纪末20世纪初',
        { year: 1900, precision: 'range', rangeStart: 1870, rangeEnd: 1914 }, 2,
        '交通与通讯革命、资本输出和殖民扩张把世界联结为整体，资本主义世界市场最终形成。',
        { tags: ['全球化'] }),

      E('eco-national-industry', '民族工业的短暂春天', '公元1912—1919年',
        { year: 1915, precision: 'range', rangeStart: 1912, rangeEnd: 1919 }, 3,
        '辛亥革命后，列强忙于第一次世界大战，民族资本主义工业获得快速发展，纺织业与面粉业尤为突出。',
        { tags: ['经济'], region: '中国' }),

      E('eco-great-depression', '资本主义世界经济大危机', '公元1929年10月',
        { year: 1929, month: 10, precision: 'month' }, 1,
        '美国股市崩盘引发席卷资本主义世界的经济大危机，生产锐减、企业破产、失业激增，各国纷纷转嫁危机。',
        { tags: ['经济'] }),

      E('eco-new-deal', '罗斯福新政', '公元1933年',
        { year: 1933, precision: 'year' }, 1,
        '美国推行新政，整顿金融、调整工农业生产、实行以工代赈与社会保障，国家开始大规模干预经济。',
        { tags: ['政策'], region: '美国' }),

      E('eco-keynes', '凯恩斯《就业、利息和货币通论》', '公元1936年',
        { year: 1936, precision: 'year' }, 3,
        '凯恩斯主张国家通过财政与货币政策扩大有效需求，为国家干预经济提供了理论依据。',
        { tags: ['理论'] }),

      /* ---------- 战后经济与全球化 ---------- */
      E('eco-bretton-woods', '布雷顿森林体系建立', '公元1944年',
        { year: 1944, precision: 'year' }, 1,
        '美英等国达成布雷顿森林协议，确立以美元为中心的国际货币体系，并建立国际货币基金组织和世界银行。',
        { tags: ['金融', '体系'] }),

      E('eco-gatt', '《关税与贸易总协定》签署', '公元1947年',
        { year: 1947, precision: 'year' }, 2,
        '二十多个国家签署关贸总协定，通过削减关税推动国际贸易自由化，成为战后世界经济体系的支柱之一。',
        { tags: ['贸易', '体系'] }),

      E('eco-marshall', '马歇尔计划', '公元1948年',
        { year: 1948, precision: 'year' }, 2,
        '美国向西欧提供大规模经济援助，帮助西欧恢复经济，同时加强了美国对西欧的经济与政治影响。',
        { tags: ['政策'] }),

      E('eco-land-reform', '中国土地改革完成', '公元1952年底',
        { year: 1952, precision: 'year' }, 2,
        '全国基本完成土地改革，废除封建土地所有制，农民获得土地，为农业发展和工业化创造了条件。',
        { tags: ['制度'], region: '中国' }),

      E('eco-five-year', '第一个五年计划', '公元1953—1957年',
        { year: 1955, precision: 'range', rangeStart: 1953, rangeEnd: 1957 }, 1,
        '中国实施第一个五年计划，优先发展重工业，初步建立起独立的工业体系。',
        { tags: ['经济'], region: '中国' }),

      E('eco-oil-crisis', '第一次石油危机', '公元1973年',
        { year: 1973, precision: 'year' }, 2,
        '石油输出国组织提高油价并实施禁运，引发西方经济滞胀，各国被迫调整产业结构与能源政策。',
        { tags: ['能源'] }),

      E('eco-household-contract', '家庭联产承包责任制推行', '公元1978年',
        { year: 1978, precision: 'year' }, 1,
        '安徽凤阳小岗村等地率先实行包产到户，此后家庭联产承包责任制在全国推广，农业生产迅速恢复发展。',
        { tags: ['改革'], region: '中国' }),

      E('eco-sez', '中国经济特区设立', '公元1980年',
        { year: 1980, precision: 'year' }, 2,
        '中国设立深圳、珠海、汕头、厦门等经济特区，实行特殊经济政策，成为对外开放的窗口和试验场。',
        { tags: ['改革', '开放'], region: '中国' }),

      E('eco-socialist-market', '确立社会主义市场经济体制目标', '公元1992年',
        { year: 1992, precision: 'year' }, 2,
        '中共十四大明确提出建立社会主义市场经济体制的目标，中国经济体制改革进入新阶段。',
        { tags: ['改革'], region: '中国' }),

      E('eco-wto-establish', '世界贸易组织成立', '公元1995年',
        { year: 1995, precision: 'year' }, 1,
        '世界贸易组织取代关贸总协定，成为具有法人地位的国际组织，进一步推动全球贸易自由化。',
        { tags: ['贸易', '体系'] }),

      E('eco-china-wto', '中国加入世界贸易组织', '公元2001年12月',
        { year: 2001, month: 12, precision: 'month' }, 1,
        '中国正式加入世界贸易组织，进一步融入世界经济体系，对外开放进入新阶段。',
        { tags: ['贸易', '开放'], region: '中国' }),

      E('eco-euro', '欧元正式流通', '公元2002年',
        { year: 2002, precision: 'year' }, 3,
        '欧元纸币与硬币在欧元区正式流通，欧洲经济货币一体化取得重大进展。',
        { tags: ['金融'], region: '欧洲' }),

      E('eco-digital', '数字经济与移动支付兴起', '公元21世纪',
        { year: 2010, precision: 'century', circa: true }, 3,
        '互联网、大数据、人工智能与移动支付快速发展，电子商务和数字金融深刻改变了生产与生活方式。',
        { tags: ['经济', '科技'] })
    ]
  });
})();
