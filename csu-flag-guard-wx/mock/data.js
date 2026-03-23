var members = [
  {
    id: 'm001', name: '刘伟', gender: '男', studentId: '8301120001',
    college: '计算机学院', major: '计算机科学与技术', grade: '2023',
    className: '计科2301班', phone: '13800138001', wechat: 'liuwei_wx',
    joinDate: '2023-09-01', position: '队长', status: '在队', remark: '表现优秀'
  },
  {
    id: 'm002', name: '王芳', gender: '女', studentId: '8301120002',
    college: '文学与新闻传播学院', major: '汉语言文学', grade: '2023',
    className: '文学2301班', phone: '13800138002', wechat: 'wangfang_wx',
    joinDate: '2023-09-01', position: '副队长', status: '在队', remark: ''
  },
  {
    id: 'm003', name: '张强', gender: '男', studentId: '8301120003',
    college: '机电工程学院', major: '机械设计制造及自动化', grade: '2024',
    className: '机械2401班', phone: '13800138003', wechat: 'zhangqiang_wx',
    joinDate: '2024-09-01', position: '队员', status: '在队', remark: ''
  },
  {
    id: 'm004', name: '李敏', gender: '女', studentId: '8301120004',
    college: '外国语学院', major: '英语', grade: '2024',
    className: '英语2401班', phone: '13800138004', wechat: 'limin_wx',
    joinDate: '2024-09-01', position: '队员', status: '在队', remark: ''
  },
  {
    id: 'm005', name: '陈浩', gender: '男', studentId: '8301120005',
    college: '土木工程学院', major: '土木工程', grade: '2023',
    className: '土木2301班', phone: '13800138005', wechat: 'chenhao_wx',
    joinDate: '2023-09-15', position: '旗手', status: '在队', remark: ''
  },
  {
    id: 'm006', name: '赵雪', gender: '女', studentId: '8301120006',
    college: '数学与统计学院', major: '数学与应用数学', grade: '2024',
    className: '数学2401班', phone: '13800138006', wechat: 'zhaoxue_wx',
    joinDate: '2024-09-01', position: '队员', status: '在队', remark: '新队员'
  }
];

var trainings = [
  {
    id: 't001', title: '基础队列训练', date: '2024-03-15', time: '07:00-08:00',
    location: '校本部田径场', type: '日常训练', createdBy: 'admin',
    description: '练习立正、稍息、向左转、向右转等基础队列动作',
    attendance: [
      { memberId: 'm001', name: '刘伟', status: '已到' },
      { memberId: 'm002', name: '王芳', status: '已到' },
      { memberId: 'm003', name: '张强', status: '迟到' },
      { memberId: 'm004', name: '李敏', status: '已到' },
      { memberId: 'm005', name: '陈浩', status: '缺勤' },
      { memberId: 'm006', name: '赵雪', status: '请假' }
    ]
  },
  {
    id: 't002', title: '正步训练', date: '2024-03-17', time: '07:00-08:30',
    location: '校本部田径场', type: '专项训练', createdBy: 'admin',
    description: '正步走、齐步换正步等动作的强化训练',
    attendance: [
      { memberId: 'm001', name: '刘伟', status: '已到' },
      { memberId: 'm002', name: '王芳', status: '已到' },
      { memberId: 'm003', name: '张强', status: '已到' },
      { memberId: 'm004', name: '李敏', status: '迟到' },
      { memberId: 'm005', name: '陈浩', status: '已到' },
      { memberId: 'm006', name: '赵雪', status: '已到' }
    ]
  },
  {
    id: 't003', title: '升旗仪式彩排', date: '2024-03-20', time: '06:30-08:00',
    location: '国旗广场', type: '彩排', createdBy: 'admin',
    description: '完整升旗流程彩排，包括出旗、升旗、收旗',
    attendance: [
      { memberId: 'm001', name: '刘伟', status: '已到' },
      { memberId: 'm002', name: '王芳', status: '已到' },
      { memberId: 'm003', name: '张强', status: '已到' },
      { memberId: 'm004', name: '李敏', status: '已到' },
      { memberId: 'm005', name: '陈浩', status: '已到' },
      { memberId: 'm006', name: '赵雪', status: '迟到' }
    ]
  }
];

var flagCeremonies = [
  {
    id: 'f001', title: '周一升旗仪式', date: '2024-03-18', time: '07:20',
    type: '升旗', location: '校本部国旗广场', createdBy: 'admin',
    description: '每周一例行升旗仪式',
    attendance: [
      { memberId: 'm001', name: '刘伟', status: '正常' },
      { memberId: 'm002', name: '王芳', status: '正常' },
      { memberId: 'm003', name: '张强', status: '正常' },
      { memberId: 'm004', name: '李敏', status: '迟到' },
      { memberId: 'm005', name: '陈浩', status: '正常' },
      { memberId: 'm006', name: '赵雪', status: '请假' }
    ]
  },
  {
    id: 'f002', title: '周五降旗', date: '2024-03-22', time: '18:00',
    type: '降旗', location: '校本部国旗广场', createdBy: 'admin',
    description: '每周五例行降旗',
    attendance: [
      { memberId: 'm001', name: '刘伟', status: '正常' },
      { memberId: 'm002', name: '王芳', status: '正常' },
      { memberId: 'm003', name: '张强', status: '缺席' },
      { memberId: 'm004', name: '李敏', status: '正常' },
      { memberId: 'm005', name: '陈浩', status: '正常' },
      { memberId: 'm006', name: '赵雪', status: '正常' }
    ]
  },
  {
    id: 'f003', title: '国庆升旗仪式', date: '2024-10-01', time: '06:30',
    type: '升旗', location: '校本部国旗广场', createdBy: 'admin',
    description: '国庆节特别升旗仪式',
    attendance: [
      { memberId: 'm001', name: '刘伟', status: '正常' },
      { memberId: 'm002', name: '王芳', status: '正常' },
      { memberId: 'm003', name: '张强', status: '正常' },
      { memberId: 'm004', name: '李敏', status: '正常' },
      { memberId: 'm005', name: '陈浩', status: '正常' },
      { memberId: 'm006', name: '赵雪', status: '正常' }
    ]
  }
];

var tutorials = [
  {
    id: 'tu001', title: '立正', category: '基础动作', createdBy: 'admin',
    content: '立正是军事训练中最基本的姿势。\n\n动作要领：\n1. 两脚跟靠拢并齐，两脚尖向外分开约60度\n2. 两腿挺直，小腹微收\n3. 自然挺胸，上体正直，微向前倾\n4. 两肩要平，稍向后张\n5. 两臂自然下垂，手指并拢自然微屈\n6. 头要端正，颈要直，口要闭，下颌微收，两眼向前平视',
    tips: '1. 保持身体重心在两脚之间\n2. 精神集中，姿态端正\n3. 注意呼吸均匀',
    commonMistakes: '1. 两脚尖分开角度过大或过小\n2. 挺胸过度导致腰部前凸\n3. 两手位置不正确',
    summary: '立正是所有队列动作的基础，必须反复练习直到形成肌肉记忆。建议每天对镜练习。'
  },
  {
    id: 'tu002', title: '正步走', category: '行进动作', createdBy: 'admin',
    content: '正步走是阅兵和重大仪式中使用的行进方式。\n\n动作要领：\n1. 左脚向正前方踢出约75厘米\n2. 脚掌离地面约25厘米\n3. 右臂前摆，手与最下方衣扣同高\n4. 左臂后摆，手臂自然伸直\n5. 上体正直，微向前倾\n6. 脚掌着地时要有力',
    tips: '1. 注意节奏感，步速每分钟约110-116步\n2. 手臂摆动要有力度\n3. 目视前方，保持身体平稳',
    commonMistakes: '1. 踢腿高度不够或过高\n2. 步幅不均匀\n3. 上体晃动\n4. 手臂摆动幅度不一致',
    summary: '正步走是国旗班最核心的动作之一，需要大量重复训练。建议分解动作练习，先慢后快。'
  },
  {
    id: 'tu003', title: '升旗流程', category: '仪式流程', createdBy: 'admin',
    content: '标准升旗仪式流程：\n\n1. 集合整队：全体队员在指定位置集合\n2. 出旗：旗手持旗，护旗手随行，齐步走至旗杆处\n3. 升旗：奏国歌，旗手展旗并匀速升旗\n4. 敬礼：全体队员面向国旗行举手礼\n5. 礼毕：国歌结束，国旗升至旗杆顶端\n6. 收队：队长下达收队口令',
    tips: '1. 升旗速度要与国歌节奏配合\n2. 展旗动作要干净利落\n3. 所有队员动作要整齐划一',
    commonMistakes: '1. 升旗速度与国歌不同步\n2. 展旗动作不够干脆\n3. 队列不够整齐',
    summary: '升旗仪式代表国家荣誉，每个环节都要精益求精。定期彩排是保证仪式质量的关键。'
  },
  {
    id: 'tu004', title: '敬礼与礼毕', category: '基础动作', createdBy: 'admin',
    content: '举手礼是标准敬礼方式。\n\n动作要领：\n1. 上体正直，右手取捷径迅速抬起\n2. 五指并拢，手掌摆平\n3. 中指微接帽檐右角前约2厘米处\n4. 手腕不得弯曲，大臂略平\n5. 同时注视受礼者\n\n礼毕：将手放下，取捷径，成立正姿势',
    tips: '1. 动作干脆有力\n2. 手掌角度要正确\n3. 目光坚定注视前方',
    commonMistakes: '1. 手掌没有摆平\n2. 手腕弯曲\n3. 动作拖沓不干脆',
    summary: '敬礼体现军人风范，必须做到规范标准。'
  },
  {
    id: 'tu005', title: '齐步走', category: '行进动作', createdBy: 'admin',
    content: '齐步走是队列行进的基本步法。\n\n动作要领：\n1. 左脚向正前方迈出约75厘米\n2. 按照先脚跟后脚掌的顺序着地\n3. 上体正直，微向前倾\n4. 手指轻轻握拢，拇指贴于食指第二节\n5. 两臂前后自然摆动',
    tips: '1. 步幅要均匀\n2. 保持上体稳定\n3. 臂部摆动自然协调',
    commonMistakes: '1. 步幅过大或过小\n2. 身体左右晃动\n3. 手臂摆动不协调',
    summary: '齐步走要做到步幅一致、步速均匀、上体平稳。'
  },
  {
    id: 'tu006', title: '降旗流程', category: '仪式流程', createdBy: 'admin',
    content: '标准降旗仪式流程：\n\n1. 集合整队：全体队员在旗杆附近指定位置集合\n2. 降旗准备：旗手就位\n3. 降旗：奏国歌（或号角），匀速降旗\n4. 收旗：旗手将国旗收好、折叠整齐\n5. 带回：旗手持旗，全体队员齐步带回',
    tips: '1. 降旗速度要与音乐配合\n2. 收旗折叠要规范\n3. 全程保持庄严肃穆',
    commonMistakes: '1. 降旗速度不均匀\n2. 收旗折叠不规范\n3. 队列松散',
    summary: '降旗仪式同样庄严，不可马虎。收旗折叠是关键环节。'
  }
];

module.exports = {
  members: members,
  trainings: trainings,
  flagCeremonies: flagCeremonies,
  tutorials: tutorials
};
