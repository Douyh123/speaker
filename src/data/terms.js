// 内置词库：80 个心理学词条
//
// 字段说明：
//   id       — 稳定标识，导入导出靠它去重，不要随意改
//   term     — 词条本身
//   category — 分类
//   aliases  — 别名，仅用于搜索，不参与抽词
//   note     — 备注/来源。**只在复盘阶段之后可见**（见 REQUIREMENTS §5）
//
// 注意：这里刻意不写任何一句话释义。计时结束前页面上不出现任何词义，
// 这是产品的硬约束（不许问 AI），不是遗漏。

export const CATEGORIES = [
  '社会心理学',
  '认知偏差',
  '情绪与动机',
  '人格与发展',
  '经典实验',
]

export const BUILTIN_TERMS = [
  // ── 社会心理学 ──────────────────────────────────────────
  { id: 'soc-01', term: '羊群效应', category: '社会心理学', aliases: ['从众效应', 'herd effect'], note: '' },
  { id: 'soc-02', term: '破窗效应', category: '社会心理学', aliases: ['Broken Windows Theory'], note: '' },
  { id: 'soc-03', term: '旁观者效应', category: '社会心理学', aliases: ['Bystander Effect', '责任分散'], note: '' },
  { id: 'soc-04', term: '认知失调', category: '社会心理学', aliases: ['Cognitive Dissonance'], note: '' },
  { id: 'soc-05', term: '基本归因错误', category: '社会心理学', aliases: ['Fundamental Attribution Error'], note: '' },
  { id: 'soc-06', term: '自利偏差', category: '社会心理学', aliases: ['Self-serving Bias'], note: '' },
  { id: 'soc-07', term: '光环效应', category: '社会心理学', aliases: ['晕轮效应', 'Halo Effect'], note: '' },
  { id: 'soc-08', term: '刻板印象', category: '社会心理学', aliases: ['Stereotype'], note: '' },
  { id: 'soc-09', term: '从众', category: '社会心理学', aliases: ['Conformity'], note: '' },
  { id: 'soc-10', term: '服从权威', category: '社会心理学', aliases: ['Obedience to Authority'], note: '' },
  { id: 'soc-11', term: '社会惰化', category: '社会心理学', aliases: ['社会懈怠', 'Social Loafing'], note: '' },
  { id: 'soc-12', term: '去个体化', category: '社会心理学', aliases: ['Deindividuation'], note: '' },
  { id: 'soc-13', term: '互惠原理', category: '社会心理学', aliases: ['Reciprocity'], note: '' },
  { id: 'soc-14', term: '登门槛效应', category: '社会心理学', aliases: ['Foot-in-the-door'], note: '' },
  { id: 'soc-15', term: '社会助长', category: '社会心理学', aliases: ['Social Facilitation'], note: '' },
  { id: 'soc-16', term: '群体极化', category: '社会心理学', aliases: ['Group Polarization'], note: '' },

  // ── 认知偏差 ────────────────────────────────────────────
  { id: 'bias-01', term: '锚定效应', category: '认知偏差', aliases: ['Anchoring Effect'], note: '' },
  { id: 'bias-02', term: '确认偏误', category: '认知偏差', aliases: ['Confirmation Bias'], note: '' },
  { id: 'bias-03', term: '可得性启发', category: '认知偏差', aliases: ['Availability Heuristic'], note: '' },
  { id: 'bias-04', term: '代表性启发', category: '认知偏差', aliases: ['Representativeness Heuristic'], note: '' },
  { id: 'bias-05', term: '损失厌恶', category: '认知偏差', aliases: ['Loss Aversion'], note: '' },
  { id: 'bias-06', term: '沉没成本谬误', category: '认知偏差', aliases: ['Sunk Cost Fallacy'], note: '' },
  { id: 'bias-07', term: '框架效应', category: '认知偏差', aliases: ['Framing Effect'], note: '' },
  { id: 'bias-08', term: '禀赋效应', category: '认知偏差', aliases: ['Endowment Effect'], note: '' },
  { id: 'bias-09', term: '达克效应', category: '认知偏差', aliases: ['邓宁-克鲁格效应', 'Dunning-Kruger Effect'], note: '' },
  { id: 'bias-10', term: '巴纳姆效应', category: '认知偏差', aliases: ['Barnum Effect', '福勒效应'], note: '' },
  { id: 'bias-11', term: '后见之明偏差', category: '认知偏差', aliases: ['Hindsight Bias', '我早知道'], note: '' },
  { id: 'bias-12', term: '幸存者偏差', category: '认知偏差', aliases: ['Survivorship Bias'], note: '' },
  { id: 'bias-13', term: '赌徒谬误', category: '认知偏差', aliases: ['Gambler\u2019s Fallacy'], note: '' },
  { id: 'bias-14', term: '现状偏差', category: '认知偏差', aliases: ['Status Quo Bias'], note: '' },
  { id: 'bias-15', term: '选择悖论', category: '认知偏差', aliases: ['选择过载', 'Paradox of Choice'], note: '' },
  { id: 'bias-16', term: '峰终定律', category: '认知偏差', aliases: ['Peak-End Rule'], note: '' },
  { id: 'bias-17', term: '首因效应', category: '认知偏差', aliases: ['Primacy Effect'], note: '' },
  { id: 'bias-18', term: '近因效应', category: '认知偏差', aliases: ['Recency Effect'], note: '' },
  { id: 'bias-19', term: '单纯曝光效应', category: '认知偏差', aliases: ['Mere Exposure Effect'], note: '' },
  { id: 'bias-20', term: '乐观偏差', category: '认知偏差', aliases: ['Optimism Bias'], note: '' },

  // ── 情绪与动机 ──────────────────────────────────────────
  { id: 'emo-01', term: '习得性无助', category: '情绪与动机', aliases: ['Learned Helplessness'], note: '' },
  { id: 'emo-02', term: '马斯洛需求层次理论', category: '情绪与动机', aliases: ['Maslow\u2019s Hierarchy'], note: '' },
  { id: 'emo-03', term: '自我决定理论', category: '情绪与动机', aliases: ['Self-Determination Theory'], note: '' },
  { id: 'emo-04', term: '延迟满足', category: '情绪与动机', aliases: ['Delayed Gratification'], note: '' },
  { id: 'emo-05', term: '心流', category: '情绪与动机', aliases: ['Flow'], note: '' },
  { id: 'emo-06', term: '耶克斯-多德森定律', category: '情绪与动机', aliases: ['Yerkes-Dodson Law'], note: '' },
  { id: 'emo-07', term: '情绪ABC理论', category: '情绪与动机', aliases: ['理性情绪行为疗法', 'REBT'], note: '' },
  { id: 'emo-08', term: '认知重评', category: '情绪与动机', aliases: ['Cognitive Reappraisal'], note: '' },
  { id: 'emo-09', term: '詹姆斯-兰格理论', category: '情绪与动机', aliases: ['James-Lange Theory'], note: '' },
  { id: 'emo-10', term: '坎农-巴德理论', category: '情绪与动机', aliases: ['Cannon-Bard Theory'], note: '' },
  { id: 'emo-11', term: '蔡格尼克效应', category: '情绪与动机', aliases: ['Zeigarnik Effect'], note: '' },
  { id: 'emo-12', term: '挫折-攻击假说', category: '情绪与动机', aliases: ['Frustration-Aggression Hypothesis'], note: '' },
  { id: 'emo-13', term: '内在动机与外在动机', category: '情绪与动机', aliases: ['Intrinsic / Extrinsic Motivation'], note: '' },
  { id: 'emo-14', term: '情绪劳动', category: '情绪与动机', aliases: ['Emotional Labor'], note: '' },
  { id: 'emo-15', term: '自我效能感', category: '情绪与动机', aliases: ['Self-Efficacy'], note: '' },
  { id: 'emo-16', term: '心理韧性', category: '情绪与动机', aliases: ['复原力', 'Resilience'], note: '' },

  // ── 人格与发展 ──────────────────────────────────────────
  { id: 'dev-01', term: '罗森塔尔效应', category: '人格与发展', aliases: ['皮格马利翁效应', '教师期望效应'], note: '' },
  { id: 'dev-02', term: '依恋类型', category: '人格与发展', aliases: ['Attachment Styles'], note: '' },
  { id: 'dev-03', term: '皮亚杰认知发展阶段', category: '人格与发展', aliases: ['Piaget\u2019s Stages'], note: '' },
  { id: 'dev-04', term: '埃里克森心理社会发展八阶段', category: '人格与发展', aliases: ['Erikson\u2019s Stages'], note: '' },
  { id: 'dev-05', term: '大五人格', category: '人格与发展', aliases: ['Big Five', 'OCEAN'], note: '' },
  { id: 'dev-06', term: '本我、自我与超我', category: '人格与发展', aliases: ['Id Ego Superego'], note: '' },
  { id: 'dev-07', term: '防御机制', category: '人格与发展', aliases: ['Defense Mechanisms'], note: '' },
  { id: 'dev-08', term: '集体无意识', category: '人格与发展', aliases: ['Collective Unconscious', '荣格'], note: '' },
  { id: 'dev-09', term: '自我实现预言', category: '人格与发展', aliases: ['Self-fulfilling Prophecy'], note: '' },
  { id: 'dev-10', term: '科尔伯格道德发展', category: '人格与发展', aliases: ['三水平六阶段', 'Kohlberg'], note: '' },
  { id: 'dev-11', term: '气质类型', category: '人格与发展', aliases: ['胆汁质 多血质 黏液质 抑郁质'], note: '' },
  { id: 'dev-12', term: '自我概念', category: '人格与发展', aliases: ['Self-concept'], note: '' },
  { id: 'dev-13', term: '自我同一性', category: '人格与发展', aliases: ['Identity', '同一性危机'], note: '' },
  { id: 'dev-14', term: '心理理论', category: '人格与发展', aliases: ['Theory of Mind', '心智理论'], note: '' },
  { id: 'dev-15', term: '关键期', category: '人格与发展', aliases: ['Critical Period'], note: '' },

  // ── 经典实验 ────────────────────────────────────────────
  { id: 'exp-01', term: '斯坦福监狱实验', category: '经典实验', aliases: ['Stanford Prison Experiment', '津巴多'], note: '' },
  { id: 'exp-02', term: '米尔格拉姆服从实验', category: '经典实验', aliases: ['Milgram Experiment', '电击实验'], note: '' },
  { id: 'exp-03', term: '罗森汉恩假病人实验', category: '经典实验', aliases: ['Rosenhan Experiment', 'On Being Sane in Insane Places'], note: '' },
  { id: 'exp-04', term: '巴甫洛夫条件反射', category: '经典实验', aliases: ['Pavlov', '经典条件作用'], note: '' },
  { id: 'exp-05', term: '斯金纳箱', category: '经典实验', aliases: ['Skinner Box', '操作性条件作用'], note: '' },
  { id: 'exp-06', term: '哈洛恒河猴实验', category: '经典实验', aliases: ['Harlow', '绒布妈妈'], note: '' },
  { id: 'exp-07', term: '波波玩偶实验', category: '经典实验', aliases: ['Bobo Doll', '班杜拉'], note: '' },
  { id: 'exp-08', term: '阿希从众实验', category: '经典实验', aliases: ['Asch Conformity Experiment', '线段实验'], note: '' },
  { id: 'exp-09', term: '棉花糖实验', category: '经典实验', aliases: ['Marshmallow Test'], note: '' },
  { id: 'exp-10', term: '看不见的大猩猩', category: '经典实验', aliases: ['Invisible Gorilla', '选择性注意'], note: '' },
  { id: 'exp-11', term: '莫扎特效应', category: '经典实验', aliases: ['Mozart Effect'], note: '' },
  { id: 'exp-12', term: '霍桑实验', category: '经典实验', aliases: ['Hawthorne Effect', '霍桑效应'], note: '' },
  { id: 'exp-13', term: '罗伯斯山洞实验', category: '经典实验', aliases: ['Robbers Cave Experiment', '谢里夫'], note: '' },
]

/**
 * 实际用到的分类列表 —— 内置 5 类排前面，用户自建的追加在后面。
 * 筛选下拉一律走这里，别直接用 CATEGORIES，否则自建分类的词会抽不到。
 *
 * enabledOnly：抽词的下拉要它 —— 一个词都没启用的分类出现在选项里是个陷阱，
 * 选中了只会抽到空。词库管理页则要看到全部，好把停用的重新开起来。
 */
export function categoriesOf(terms, { enabledOnly = false } = {}) {
  const order = []
  const seen = new Set()
  for (const t of terms || []) {
    if (!t.category) continue
    if (enabledOnly && t.enabled === false) continue
    if (seen.has(t.category)) continue
    seen.add(t.category)
    order.push(t.category)
  }
  // 内置分类排前面，自建的按出现顺序跟在后面
  const builtin = CATEGORIES.filter((c) => seen.has(c))
  const extra = order.filter((c) => !CATEGORIES.includes(c))
  return [...builtin, ...extra]
}
