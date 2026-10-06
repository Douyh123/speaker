// 统计。M1 只用首页那几个数字，热力图和分类进度条留到 M2。
//
// 所有指标都从 sessions 现算，不落库 —— 存一份就等于有两个真相来源，
// 迟早对不上。

import { localDay } from './store.js'
import { doneCounts } from './draw.js'

/** 至少完成过一次的词 id 集合（"已覆盖"的口径） */
export function coveredIds(sessions) {
  return new Set(sessions.filter((s) => s.status === 'done').map((s) => s.termId))
}

/** 累计讲解次数 */
export function totalDone(sessions) {
  return sessions.filter((s) => s.status === 'done').length
}

/** 今天讲了几次 */
export function doneToday(sessions) {
  const today = localDay()
  return sessions.filter(
    (s) => s.status === 'done' && localDay(s.endedAt || s.startedAt) === today
  ).length
}

/**
 * 连续打卡天数。
 * 口径：本地自然日内有 >=1 条 done 记录即算打卡。
 * 今天还没练不算断 —— 从昨天往前数，不然一觉醒来 streak 就归零了，很打击人。
 */
export function streakDays(sessions) {
  const days = new Set(
    sessions.filter((s) => s.status === 'done').map((s) => localDay(s.endedAt || s.startedAt))
  )
  if (days.size === 0) return 0

  const cursor = new Date()

  if (!days.has(localDay(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
    if (!days.has(localDay(cursor))) return 0
  }

  let n = 0
  while (days.has(localDay(cursor))) {
    n++
    cursor.setDate(cursor.getDate() - 1)
  }
  return n
}

/** 每个词完成过几次 —— 历史页的"按词条"视图用 */
export function perTerm(sessions) {
  return doneCounts(sessions)
}

/**
 * 近 N 天的打卡热力图数据。
 * 返回的格子从"含今天在内往前 N 天、并对齐到周一"开始，所以实际会略多于 N 天。
 * 对齐周一否则列会错位 —— 每列是一周，7 行是周一到周日。
 */
export function heatmapData(sessions, days = 90) {
  const counts = new Map()
  for (const s of sessions) {
    if (s.status !== 'done') continue
    const key = localDay(s.endedAt || s.startedAt)
    counts.set(key, (counts.get(key) || 0) + 1)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const start = new Date(today)
  start.setDate(start.getDate() - (days - 1))
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))   // 回退到周一

  const cells = []
  const cursor = new Date(start)
  while (cursor <= today) {
    const key = localDay(cursor.getTime())
    cells.push({ key, count: counts.get(key) || 0, future: false })
    cursor.setDate(cursor.getDate() + 1)
  }
  // 补满最后一周，否则网格右下角缺一块
  while (cells.length % 7 !== 0) {
    cells.push({ key: null, count: 0, future: true })
  }
  return cells
}

/** 每个分类的覆盖进度 */
export function categoryProgress({ terms, sessions }) {
  const covered = coveredIds(sessions)
  const byCat = new Map()

  for (const t of terms) {
    if (t.enabled === false) continue
    if (!byCat.has(t.category)) byCat.set(t.category, { total: 0, done: 0 })
    const row = byCat.get(t.category)
    row.total++
    if (covered.has(t.id)) row.done++
  }

  return [...byCat.entries()]
    .map(([category, row]) => ({ category, ...row, pct: row.total ? row.done / row.total : 0 }))
    .sort((a, b) => b.total - a.total)
}

/** 一个词的讲解次数、最近自评、趋势 —— 历史页"按词条"视图用 */
export function termSummary(sessions) {
  const byTerm = new Map()

  for (const s of sessions) {
    if (s.status !== 'done') continue
    if (!byTerm.has(s.termId)) {
      byTerm.set(s.termId, { termId: s.termId, termText: s.termText, category: s.category, count: 0, ratings: [], lastAt: 0, needsReview: false })
    }
    const row = byTerm.get(s.termId)
    row.count++
    row.ratings.push(s.selfRating)
    const at = s.endedAt || s.startedAt || 0
    if (at > row.lastAt) row.lastAt = at
    if (s.needsReview) row.needsReview = true
  }

  const score = { clear: 3, rough: 2, failed: 1 }

  for (const row of byTerm.values()) {
    // ratings 是按 sessions 顺序 push 的，不一定按时间排。这里按时间重排一遍
    const ordered = sessions
      .filter((s) => s.status === 'done' && s.termId === row.termId)
      .sort((a, b) => (a.endedAt || a.startedAt) - (b.endedAt || b.startedAt))
      .map((s) => s.selfRating)

    row.last = ordered[ordered.length - 1] || null
    row.best = ordered.filter(Boolean).sort((a, b) => score[b] - score[a])[0] || null
    // 只看最近两次，多于两次的老数据对"在变好还是变差"这个判断没有增量
    const tail = ordered.filter(Boolean).slice(-2)
    row.trend = tail.length < 2 ? 'flat'
      : score[tail[1]] > score[tail[0]] ? 'up'
      : score[tail[1]] < score[tail[0]] ? 'down' : 'flat'
  }

  return [...byTerm.values()].sort((a, b) => b.lastAt - a.lastAt)
}
