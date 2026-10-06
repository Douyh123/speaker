// 计时核心
//
// 关键约束（REQUIREMENTS §4 F2.2）：一律用绝对时间戳算剩余时间，禁止用
// setInterval 每次减 1 累加。用户 15 分钟里都在别的标签页，浏览器会把后台
// 标签页的定时器节流到最低 1 次/分钟，累加法必然走慢，一轮下来能差好几分钟。
//
// 所以 setInterval 在这里只负责"多久刷新一次显示"，算数全交给 Date.now()。

/** 距离计时结束还剩多少毫秒。已结束返回 0。 */
export function remainingMs(session) {
  if (!session || session.status !== 'running' || !session.startedAt) return 0
  const elapsed = Date.now() - session.startedAt
  return Math.max(0, session.plannedDuration * 1000 - elapsed)
}

/** 已经过去多少毫秒 */
export function elapsedMs(session) {
  if (!session || !session.startedAt) return 0
  return Date.now() - session.startedAt
}

export function formatMMSS(ms) {
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * 启动计时循环。
 *
 * @param session  running 状态的 session 对象
 * @param handlers.onTick(ms, fraction) 每次刷新（约 4 次/秒）
 * @param handlers.onThreshold(seconds) 跨过 5:00 / 1:00 时触发一次
 * @param handlers.onEnd()              归零时触发一次
 * @returns stop()  停止计时（离开 running 视图时必须调用）
 *
 * 断点恢复时不会补发已经错过的阈值 —— 从 12:00 恢复到 4:00，不会再响一次
 * "还剩 5 分钟"，那只会让人困惑。
 */
export function startTimer(session, handlers = {}) {
  const { onTick, onThreshold, onEnd } = handlers
  const total = session.plannedDuration * 1000

  // 比总时长还长的阈值没有意义（比如 5 分钟的轮次不提示"剩 5 分钟"）
  const thresholds = [300, 60].filter((t) => t * 1000 < total)
  const fired = new Set()

  let last = remainingMs(session)
  let ended = false

  // 恢复时，已经低于的阈值直接标记为已响过
  for (const t of thresholds) {
    if (last <= t * 1000) fired.add(t)
  }

  function tick() {
    if (ended) return
    const ms = remainingMs(session)

    if (onTick) onTick(ms, total > 0 ? 1 - ms / total : 1)

    if (ms <= 0) {
      ended = true
      stop()
      if (onEnd) onEnd()
      return
    }

    if (onThreshold) {
      for (const t of thresholds) {
        if (!fired.has(t) && ms <= t * 1000 && last > t * 1000) {
          fired.add(t)
          onThreshold(t)
        }
      }
    }

    last = ms
  }

  const id = setInterval(tick, 250)

  function stop() {
    clearInterval(id)
  }

  tick() // 立即渲染一帧，避免挂载后等 250ms 才显示
  return stop
}
