// 自检脚本：验证不依赖 DOM 的纯逻辑。
// 涉及 localStorage 的部分用一个内存 shim 顶替 —— 见文件末尾的 [存储] 段。
import { BUILTIN_TERMS, CATEGORIES, categoriesOf } from '../src/data/terms.js'
import { drawTerm, doneCounts, fillerPool } from '../src/draw.js'
import { remainingMs, formatMMSS } from '../src/timer.js'
import {
  coveredIds, totalDone, streakDays, heatmapData,
  categoryProgress, termSummary,
} from '../src/stats.js'
import {
  localDay, saveTerms, loadSessions, saveSessions, clearSessions,
  restoreBuiltinTerms, storageBytes, ensureTerms,
} from '../src/store.js'
import {
  makeBackup, backupFileName, parseBackup, applyBackup,
  backupAgeDays, needsBackupReminder, BACKUP_REMIND_DAYS,
} from '../src/backup.js'

let pass = 0
let fail = 0

function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}`) }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`) }
}

const terms = BUILTIN_TERMS.map((t) => ({ ...t, enabled: true }))

// ── 词库 ──────────────────────────────────────────────
console.log('\n[词库]')
ok('共 80 个词', terms.length === 80, `实际 ${terms.length}`)
ok('id 无重复', new Set(terms.map((t) => t.id)).size === terms.length)
ok('词条无重复', new Set(terms.map((t) => t.term)).size === terms.length)
const byCat = {}
for (const t of terms) byCat[t.category] = (byCat[t.category] || 0) + 1
console.log('       分类分布:', JSON.stringify(byCat))
ok('分类数与 CATEGORIES 一致', Object.keys(byCat).length === CATEGORIES.length)
ok('每类 >= 10 个', Object.values(byCat).every((n) => n >= 10))
ok('分类无越界', Object.keys(byCat).every((c) => CATEGORIES.includes(c)))

const session = (over) => ({
  id: 'x', termId: 'soc-01', termText: '羊群效应', category: '社会心理学',
  startedAt: null, endedAt: null, plannedDuration: 900,
  status: 'done', selfRating: 'clear', needsReview: false, ...over,
})

// ── 抽词 ──────────────────────────────────────────────
console.log('\n[抽词]')
const empty = drawTerm({ terms: [], sessions: [], mode: 'unseen' })
ok('空词库返回 empty', empty.term === null && empty.reason === 'empty')

const base = drawTerm({ terms, sessions: [], mode: 'unseen' })
ok('能抽出词', !!base.term)

const filtered = drawTerm({ terms, sessions: [], mode: 'unseen', category: '认知偏差' })
ok('分类筛选生效', filtered.term.category === '认知偏差')

// 权重验证：用一个只有 3 个词的池子，样本量给足，噪声才不会盖过信号
// （全量词库测会稀释到不可判读 —— 78 个未讲过的词把权重 1 的词压到期望只有 19 次）
const trio = terms.slice(0, 3)
const trioSessions = [session({ termId: 'soc-02' }), session({ termId: 'soc-03' }), session({ termId: 'soc-03' })]
const trioCounts = { 'soc-01': 0, 'soc-02': 0, 'soc-03': 0 }
const N = 42000
for (let i = 0; i < N; i++) {
  const r = drawTerm({ terms: trio, sessions: trioSessions, mode: 'unseen' })
  trioCounts[r.term.id]++
}
const exp = { 'soc-01': N * 4 / 7, 'soc-02': N * 2 / 7, 'soc-03': N * 1 / 7 }
console.log(`       实测 ${trioCounts['soc-01']} / ${trioCounts['soc-02']} / ${trioCounts['soc-03']}`)
console.log(`       期望 ${exp['soc-01'].toFixed(0)} / ${exp['soc-02'].toFixed(0)} / ${exp['soc-03'].toFixed(0)}`)
const near = (a, b) => Math.abs(a - b) / b < 0.08
ok('未讲过的词权重 4', near(trioCounts['soc-01'], exp['soc-01']))
ok('讲过 1 次权重 2', near(trioCounts['soc-02'], exp['soc-02']))
ok('讲过 2 次权重 1', near(trioCounts['soc-03'], exp['soc-03']))

// 换一个：不应抽到同一个词
let dup = 0
for (let i = 0; i < 500; i++) {
  const r = drawTerm({ terms, sessions: [], mode: 'unseen', excludeId: 'soc-01' })
  if (r.term.id === 'soc-01') dup++
}
ok('excludeId 生效（500 次未重复）', dup === 0, `重复 ${dup} 次`)

// 只剩一个词时，excludeId 不能把它排除掉
const oneTerm = [{ ...terms[0], enabled: true }]
const only = drawTerm({ terms: oneTerm, sessions: [], mode: 'unseen', excludeId: 'soc-01' })
ok('池里只剩一个词时仍能抽出', only.term?.id === 'soc-01')

// 待复习
const reviewEmpty = drawTerm({ terms, sessions: [], mode: 'review' })
ok('待复习池为空时返回 empty-review', reviewEmpty.term === null && reviewEmpty.reason === 'empty-review')
const marked = [session({ termId: 'bias-05', needsReview: true })]
const reviewDraw = drawTerm({ terms, sessions: marked, mode: 'review' })
ok('待复习模式只抽标记过的词', reviewDraw.term.id === 'bias-05')

// 禁用的词不参与
const disabled = terms.map((t) => ({ ...t, enabled: t.id !== 'soc-01' }))
const neverPicked = Array.from({ length: 800 }, () => drawTerm({ terms: disabled, sessions: [], mode: 'unseen' }).term.id)
ok('禁用的词不会被抽到', !neverPicked.includes('soc-01'))

// 纯随机：分布应大致均匀
const rand = {}
for (let i = 0; i < 8000; i++) {
  const r = drawTerm({ terms, sessions: trioSessions, mode: 'random' })
  rand[r.term.id] = (rand[r.term.id] || 0) + 1
}
const nums = Object.values(rand)
ok('纯随机覆盖全部词', nums.length === 80)
ok('纯随机分布均匀（极差 < 2 倍均值）',
  Math.max(...nums) < 2 * (8000 / 80) && Math.min(...nums) > 0.5 * (8000 / 80))

// ── 计时 ──────────────────────────────────────────────
console.log('\n[计时]')
ok('非 running 状态剩余为 0', remainingMs({ status: 'ready', startedAt: Date.now(), plannedDuration: 900 }) === 0)
ok('无 startedAt 剩余为 0', remainingMs({ status: 'running', startedAt: null, plannedDuration: 900 }) === 0)

const started = { status: 'running', startedAt: Date.now() - 60_000, plannedDuration: 900 }
const rem = remainingMs(started)
ok('已过 60s -> 剩余约 840s', Math.abs(rem - 840_000) < 1200, `实测 ${rem}ms`)

const overdue = { status: 'running', startedAt: Date.now() - 1_000_000, plannedDuration: 900 }
ok('超时不返回负数', remainingMs(overdue) === 0)

ok('formatMMSS 900000 -> 15:00', formatMMSS(900_000) === '15:00')
ok('formatMMSS 0 -> 00:00', formatMMSS(0) === '00:00')
ok('formatMMSS 59999 -> 01:00（向上取整）', formatMMSS(59_999) === '01:00')
ok('formatMMSS 60000 -> 01:00', formatMMSS(60_000) === '01:00')

// ── 统计 ──────────────────────────────────────────────
console.log('\n[统计]')
const day = (offset) => {
  const d = new Date()
  d.setDate(d.getDate() - offset)
  d.setHours(12, 0, 0, 0)
  return d.getTime()
}

const s = [
  session({ termId: 'soc-01', endedAt: day(0) }),
  session({ termId: 'soc-02', endedAt: day(1) }),
  session({ termId: 'soc-03', endedAt: day(2) }),
  session({ termId: 'soc-01', endedAt: day(2) }),          // 同一天第二次，只算一天
  session({ termId: 'bias-01', endedAt: day(2), status: 'abandoned' }), // 不算
  session({ termId: 'bias-02', endedAt: day(5) }),          // 断层
]
ok('累计讲解只算 done', totalDone(s) === 5, `实际 ${totalDone(s)}`)
ok('已覆盖去重（soc-01 讲两次只算一个词）', coveredIds(s).size === 4, `实际 ${coveredIds(s).size}`)
ok('连续 3 天', streakDays(s) === 3, `实际 ${streakDays(s)}`)

const noToday = [session({ endedAt: day(1) }), session({ endedAt: day(2) })]
ok('今天还没练，streak 不归零', streakDays(noToday) === 2, `实际 ${streakDays(noToday)}`)

const broken = [session({ endedAt: day(2) }), session({ endedAt: day(3) })]
ok('昨天和今天都没练，streak 为 0', streakDays(broken) === 0, `实际 ${streakDays(broken)}`)

ok('空记录 streak 为 0', streakDays([]) === 0)

const dc = doneCounts(s)
ok('doneCounts 只计 done', dc.get('soc-01') === 2 && dc.get('bias-01') === undefined)

// ── 热力图 ────────────────────────────────────────────
console.log('\n[热力图]')
const heat = heatmapData(s, 90)
const grid = heat.filter((c) => !c.future)
ok('格子数是 7 的整数倍', heat.length % 7 === 0, `实际 ${heat.length}`)
ok('每列正好一周', heat.length / 7 === Math.ceil(grid.length / 7))

// 首格必须是周一 —— 否则每列的含义会错位
const firstDow = new Date(grid[0].key + 'T12:00:00').getDay()
ok('首格是周一', firstDow === 1, `实际 getDay()=${firstDow}`)

const todayKey = localDay()
ok('最后一格是今天', grid[grid.length - 1].key === todayKey, `实际 ${grid[grid.length - 1].key}`)

const cellOf = (off) => heat.find((c) => c.key === localDay(day(off)))
ok('今天有 1 次', cellOf(0).count === 1, `实际 ${cellOf(0).count}`)
ok('前天有 2 次', cellOf(2).count === 2, `实际 ${cellOf(2).count}`)
ok('放弃的不计入', cellOf(2).count === 2)
ok('空白天为 0', cellOf(4).count === 0)

// 窗口边界：30 天窗口不该包含 40 天前的记录
const heat30 = heatmapData([session({ endedAt: day(40) })], 30)
const fortyAgo = heat30.find((c) => c.key === localDay(day(40)))
ok('30 天窗口不含 40 天前', fortyAgo === undefined)
ok('窗口外数据不出现', heat30.every((c) => c.count === 0))

// ── 分类进度 ──────────────────────────────────────────
console.log('\n[分类进度]')
const prog = categoryProgress({ terms, sessions: s })
ok('返回 5 个分类', prog.length === 5, `实际 ${prog.length}`)
ok('总数之和 = 80', prog.reduce((n, r) => n + r.total, 0) === 80)
const socRow = prog.find((r) => r.category === '社会心理学')
ok('社会心理学总数 16', socRow.total === 16, `实际 ${socRow.total}`)
// s 里覆盖了 soc-01/02/03 + bias-01(放弃,不算) + bias-02
ok('社会心理学覆盖 3', socRow.done === 3, `实际 ${socRow.done}`)
ok('进度是比例', Math.abs(socRow.pct - 3 / 16) < 1e-9)
ok('按总数降序', prog.every((r, i) => i === 0 || prog[i - 1].total >= r.total))

const progNoDisabled = categoryProgress({
  terms: terms.map((t) => (t.category === '经典实验' ? { ...t, enabled: false } : t)),
  sessions: [],
})
ok('禁用分类不计入', progNoDisabled.length === 4, `实际 ${progNoDisabled.length}`)

// ── 词条汇总 ──────────────────────────────────────────
console.log('\n[词条汇总]')
const sum = termSummary(s)
const soc01 = sum.find((r) => r.termId === 'soc-01')
ok('只统计 done 的词', sum.length === 4, `实际 ${sum.length}`)
ok('soc-01 讲了 2 次', soc01.count === 2, `实际 ${soc01.count}`)
ok('单次讲解没有趋势', sum.find((r) => r.termId === 'soc-02').trend === 'flat')

const t0 = day(4), t1 = day(3), t2 = day(2)
const improving = termSummary([
  session({ termId: 'x', selfRating: 'failed', endedAt: t0 }),
  session({ termId: 'x', selfRating: 'rough', endedAt: t1 }),
  session({ termId: 'x', selfRating: 'clear', endedAt: t2 }),
])[0]
ok('自评变好 -> trend=up', improving.trend === 'up', `实际 ${improving.trend}`)
ok('最后一次自评 clear', improving.last === 'clear')
ok('最佳自评 clear', improving.best === 'clear')
ok('讲解次数 3', improving.count === 3)

const worsening = termSummary([
  session({ termId: 'y', selfRating: 'clear', endedAt: t0 }),
  session({ termId: 'y', selfRating: 'rough', endedAt: t2 }),
])[0]
ok('自评变差 -> trend=down', worsening.trend === 'down', `实际 ${worsening.trend}`)

// ── 滚动池 ────────────────────────────────────────────
console.log('\n[滚动池]')
const poolAll = fillerPool({ terms })
ok('无分类筛选时返回全部启用词', poolAll.length === 80, `实际 ${poolAll.length}`)
const poolSmall = fillerPool({ terms, category: '经典实验' })   // 13 个，够用
ok('大分类用本分类的词', poolSmall.length === 13 && poolSmall.every((t) => t.category === '经典实验'))

// 只剩 4 个词时该退回全量，否则滚动框里会反复闪同几个词
const thinTerms = terms.filter((t) => t.category !== '经典实验')
  .concat(terms.filter((t) => t.category === '经典实验').slice(0, 4))
const poolThin = fillerPool({ terms: thinTerms, category: '经典实验' })
// 回退到"全部启用的词"，也就是 80 - 13 + 4 = 71，而不是那个只有 4 个词的分类
ok('池子太小退回全量', poolThin.length === 71, `实际 ${poolThin.length}`)

const poolDisabled = fillerPool({
  terms: terms.map((t) => (t.category === '经典实验' ? { ...t, enabled: false } : t)),
})
ok('禁用的词不进滚动池', poolDisabled.length === 67, `实际 ${poolDisabled.length}`)

// ── 分类列表 ──────────────────────────────────────────
console.log('\n[分类列表]')
ok('内置词库有 5 个分类', categoriesOf(terms).length === 5)
ok('顺序沿用 CATEGORIES', categoriesOf(terms).join() === CATEGORIES.join())

const withCustom = [...terms, { id: 'u-1', term: '自建词', category: '教育心理学', enabled: true }]
const listCustom = categoriesOf(withCustom)
ok('自建分类追加在后面', listCustom.length === 6 && listCustom[5] === '教育心理学')
ok('自建词停用后不参与抽词',
  !categoriesOf([{ ...withCustom[80], enabled: false }], { enabledOnly: true }).includes('教育心理学'))

// 某一类的词全停用了：抽词下拉不该再列它（选中了只会抽到空），
// 但词库管理页还得看得见，不然没法把它重新开起来
const noExp = terms.map((t) => (t.category === '经典实验' ? { ...t, enabled: false } : t))
ok('抽词时排除没有启用词条的分类',
  !categoriesOf(noExp, { enabledOnly: true }).includes('经典实验'))
ok('管理页仍然列出该分类', categoriesOf(noExp).includes('经典实验'))
ok('空词库不炸', categoriesOf([]).length === 0)
ok('terms 为 undefined 也不炸', categoriesOf(undefined).length === 0)

// ── 备份 ──────────────────────────────────────────────
console.log('\n[备份]')
const NOON = new Date(2026, 9, 6, 12, 0, 0).getTime()   // 本地时间，跨时区都稳

const bkp = makeBackup({
  terms: trio, sessions: s, settings: { duration: 600 }, now: NOON,
})
ok('带 format 标记', bkp.format === 'speaker-backup')
ok('带版本号', typeof bkp.version === 'number')
ok('exportedAt 是 ISO 串', /^\d{4}-\d{2}-\d{2}T/.test(bkp.exportedAt))
ok('文件名带本地日期', backupFileName(NOON) === '讲明白-备份-2026-10-06.json', backupFileName(NOON))

ok('非 JSON 被拒', parseBackup('这不是 json').ok === false)
ok('JSON 但不是备份被拒', parseBackup('{"a":1}').ok === false)
ok('id 不是字符串的词条被拒',
  parseBackup(JSON.stringify({ format: 'speaker-backup', terms: [{ id: 1, term: 'x' }] })).ok === false)

const parsed = parseBackup(JSON.stringify(bkp))
ok('正常备份能解析', parsed.ok === true)
ok('解析出 3 个词条', parsed.data.terms.length === 3)
ok('解析出 6 条记录', parsed.data.sessions.length === 6, `实际 ${parsed.data.sessions.length}`)

// 缺字段的备份不该把应用打挂
const thin = parseBackup('{"format":"speaker-backup"}')
ok('缺 terms/sessions 时补空数组',
  thin.ok === true && thin.data.terms.length === 0 && thin.data.sessions.length === 0)

// 合并：按 id 求并集，同 id 以备份为准
const cur = {
  terms: [
    { id: 'a', term: '本地词A' },
    { id: 'b', term: '本地词B' },
  ],
  sessions: [{ id: 's1', termId: 'a' }],
  settings: { duration: 900, sound: true },
}
const incoming = {
  terms: [{ id: 'a', term: '备份里的A' }, { id: 'c', term: '备份独有C' }],
  sessions: [{ id: 's1', termId: 'z' }, { id: 's2', termId: 'a' }],
  settings: { duration: 600 },
}

const merged = applyBackup({ data: incoming, current: cur, mode: 'merge' })
ok('合并后词条 3 个', merged.terms.length === 3, `实际 ${merged.terms.length}`)
ok('同 id 以备份为准', merged.terms.find((t) => t.id === 'a').term === '备份里的A')
ok('本地独有的留着', merged.terms.some((t) => t.id === 'b'))
ok('备份独有的加进来', merged.terms.some((t) => t.id === 'c'))
ok('合并后记录 2 条', merged.sessions.length === 2, `实际 ${merged.sessions.length}`)
ok('同 id 的记录以备份为准', merged.sessions.find((x) => x.id === 's1').termId === 'z')
ok('设置按字段合并', merged.settings.duration === 600 && merged.settings.sound === true)

// 覆盖：现有数据一点都不留
const replaced = applyBackup({ data: incoming, current: cur, mode: 'replace' })
ok('覆盖后只剩备份的 2 个词条', replaced.terms.length === 2)
ok('覆盖后没有本地词条', !replaced.terms.some((t) => t.id === 'b'))
ok('覆盖后设置也不合并', replaced.settings.sound === undefined)
ok('不共享引用（改结果不影响入参）', (replaced.terms[0].term = 'x', incoming.terms[0].term === '备份里的A'))

// 备份提醒
const DAY = 86400000
ok('没备份过不报天数', backupAgeDays({}) === null)
ok('15 天前备份 -> 15', backupAgeDays({ lastBackupAt: new Date(NOON - 15 * DAY).toISOString() }, NOON) === 15)
ok('没有任何记录时不提醒', needsBackupReminder({ settings: {}, sessions: [] }) === false)
ok('有记录但从没备份过 -> 提醒', needsBackupReminder({ settings: {}, sessions: s }) === true)
ok('今天备份过 -> 不提醒',
  needsBackupReminder({ settings: { lastBackupAt: new Date(NOON).toISOString() }, sessions: s }, NOON) === false)
ok('刚好到阈值 -> 提醒',
  needsBackupReminder({
    settings: { lastBackupAt: new Date(NOON - BACKUP_REMIND_DAYS * DAY).toISOString() },
    sessions: s,
  }, NOON) === true)

// ── 存储（用内存 shim 顶替 localStorage）──────────────
console.log('\n[存储]')

globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null },
  setItem(k, v) { this._m.set(k, String(v)) },
  removeItem(k) { this._m.delete(k) },
}

// 内置词条只能停用不能删，靠的就是这两条：缺失的补回来，已有的别动
globalThis.localStorage.setItem('speaker.terms.v1', JSON.stringify([
  { id: 'soc-01', term: '我改的名字', category: '社会心理学', enabled: false, builtin: true },
]))
const ens = ensureTerms()
ok('ensureTerms 不覆盖已有内置词条', ens.terms.find((t) => t.id === 'soc-01').term === '我改的名字')
ok('ensureTerms 不把停用的翻回启用', ens.terms.find((t) => t.id === 'soc-01').enabled === false)
ok('ensureTerms 把缺的补到 80', ens.terms.length === 80, `实际 ${ens.terms.length}`)

saveTerms([
  { id: 'soc-01', term: '羊群效应（我改过）', category: '社会心理学', enabled: false, builtin: true },
  { id: 'u-9', term: '我自己加的词', category: '我的分类', enabled: true },
])
const restored = restoreBuiltinTerms()
ok('内置词条改回出厂', restored.find((t) => t.id === 'soc-01').term === '羊群效应')
ok('恢复时保留停用状态', restored.find((t) => t.id === 'soc-01').enabled === false)
ok('自建词条不受影响', restored.some((t) => t.id === 'u-9'))
ok('内置补齐到 80 个', restored.filter((t) => t.builtin).length === 80)
ok('总数 = 80 内置 + 1 自建', restored.length === 81, `实际 ${restored.length}`)

saveSessions([{ id: 'x' }, { id: 'y' }])
ok('清空前有 2 条', loadSessions().length === 2)
clearSessions()
ok('clearSessions 清空记录', loadSessions().length === 0)
ok('storageBytes 是正数', storageBytes() > 0)
ok('storageBytes 是数字', typeof storageBytes() === 'number')

// ── 结果 ──────────────────────────────────────────────
console.log(`\n${'='.repeat(44)}`)
console.log(`  ${pass} passed, ${fail} failed`)
console.log('='.repeat(44))
process.exit(fail > 0 ? 1 : 0)
