// 抽词算法（REQUIREMENTS §4 F1）
//
// 三种模式：
//   unseen — 优先未讲过。未完成过权重 4，完成过 1 次权重 2，完成过 >=2 次权重 1
//   random — 纯随机，等概率
//   review — 只从标记了 needsReview 的词里抽
//
// 用加权随机而不是"先抽未讲过的池子、抽空了再抽讲过的"——后者在词库快cover完时
// 会出现明显的"末尾集中"手感，加权能平滑过渡。

function pickUniform(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function pickWeighted(items) {
  const total = items.reduce((sum, it) => sum + it.w, 0)
  if (total <= 0) return items[0].t
  let r = Math.random() * total
  for (const it of items) {
    r -= it.w
    if (r <= 0) return it.t
  }
  return items[items.length - 1].t
}

/**
 * 滚动动画的填充池：和真正抽词同一个范围，免得滚出一堆别的分类的词。
 * 池子太小就退回全量，否则滚动框里会反复闪同几个词，很假。
 */
export function fillerPool({ terms, category = null }) {
  const enabled = terms.filter((t) => t.enabled !== false)
  const scoped = category ? enabled.filter((t) => t.category === category) : enabled
  return scoped.length >= 8 ? scoped : enabled
}

/** 每个词完成过几次（只算 done，放弃/跳过不算） */
export function doneCounts(sessions) {
  const map = new Map()
  for (const s of sessions) {
    if (s.status === 'done') map.set(s.termId, (map.get(s.termId) || 0) + 1)
  }
  return map
}

/**
 * @returns {{term: object|null, reason?: string}}
 *   reason: 'empty' 词库为空 / 'empty-review' 待复习池为空 / 'single' 池中只有一个词无法避开重抽
 */
export function drawTerm({ terms, sessions, mode = 'unseen', category = null, excludeId = null }) {
  let pool = terms.filter((t) => t.enabled !== false)

  if (category) pool = pool.filter((t) => t.category === category)

  if (mode === 'review') {
    const reviewIds = new Set(sessions.filter((s) => s.needsReview).map((s) => s.termId))
    pool = pool.filter((t) => reviewIds.has(t.id))
    if (pool.length === 0) return { term: null, reason: 'empty-review' }
  }

  if (pool.length === 0) return { term: null, reason: 'empty' }

  // 换一个时避开当前这个词；池里只剩一个词就只能它了
  if (excludeId && pool.length > 1) pool = pool.filter((t) => t.id !== excludeId)

  if (mode === 'random' || mode === 'review') return { term: pickUniform(pool) }

  // unseen：加权
  const counts = doneCounts(sessions)
  const weighted = pool.map((t) => {
    const n = counts.get(t.id) || 0
    return { t, w: n === 0 ? 4 : n === 1 ? 2 : 1 }
  })
  return { term: pickWeighted(weighted) }
}
