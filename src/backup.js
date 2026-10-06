// 备份：导出/导入 JSON。
//
// 一个 .json 装下全部数据（词库 + 历史 + 设置）。笔记照片不上传，没有二进制资源
// 要打包，所以用不上 zip。解析逻辑抽成纯函数（不碰 FileReader），这样在没有 DOM
// 的环境里也能测。

export const BACKUP_FORMAT = 'speaker-backup'
export const BACKUP_VERSION = 1
export const BACKUP_REMIND_DAYS = 14

/** 组装一份可导出的数据 */
export function makeBackup({ terms, sessions, settings, now = Date.now() }) {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date(now).toISOString(),
    terms,
    sessions,
    settings,
  }
}

export function backupFileName(now = Date.now()) {
  const d = new Date(now)
  const p = (n) => String(n).padStart(2, '0')
  return `讲明白-备份-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`
}

/**
 * 解析备份文本。返回 { ok, data } 或 { ok:false, error }。
 * 不抛异常 —— 调用方拿到的是给用户看的一句话，不是堆栈。
 */
export function parseBackup(text) {
  let obj
  try {
    obj = JSON.parse(text)
  } catch {
    return { ok: false, error: '这不是一个 JSON 文件' }
  }

  if (!obj || typeof obj !== 'object') return { ok: false, error: '文件内容是空的' }
  if (obj.format !== BACKUP_FORMAT) return { ok: false, error: '不是「讲明白」的备份文件' }

  const terms = Array.isArray(obj.terms) ? obj.terms : []
  const sessions = Array.isArray(obj.sessions) ? obj.sessions : []

  // 词条是最小可用单位：没有 id 或 term 的条目没有意义，直接剔掉
  const bad = terms.filter((t) => !t || typeof t.id !== 'string' || typeof t.term !== 'string')
  if (bad.length > 0) return { ok: false, error: `备份里有 ${bad.length} 条词条结构不对` }

  return {
    ok: true,
    data: {
      format: obj.format,
      version: obj.version ?? 1,
      exportedAt: obj.exportedAt ?? null,
      terms,
      sessions,
      settings: obj.settings && typeof obj.settings === 'object' ? obj.settings : {},
    },
  }
}

/** 按 id 求并集：本地已有的留着，备份里同 id 的覆盖过来，备份独有的追加 */
function unionById(local, incoming) {
  const out = []
  const index = new Map()
  for (const item of local) {
    if (!item || !item.id) continue
    index.set(item.id, out.length)
    out.push(item)
  }
  for (const item of incoming) {
    if (!item || !item.id) continue
    const at = index.get(item.id)
    if (at === undefined) {
      index.set(item.id, out.length)
      out.push(item)
    } else {
      out[at] = item
    }
  }
  return out
}

export function mergeTerms(local, incoming) {
  return unionById(local || [], incoming || [])
}

export function mergeSessions(local, incoming) {
  return unionById(local || [], incoming || [])
}

/**
 * 把备份应用成新的数据集。
 *   mode 'replace' —— 完全换成备份的内容（相当于"恢复快照"）
 *   mode 'merge'   —— 并集，同 id 以备份为准（换设备/合并两份练习记录）
 */
export function applyBackup({ data, current, mode }) {
  if (mode === 'merge') {
    return {
      terms: mergeTerms(current.terms, data.terms),
      sessions: mergeSessions(current.sessions, data.sessions),
      settings: { ...current.settings, ...data.settings },
    }
  }
  return {
    terms: data.terms.map((t) => ({ ...t })),
    sessions: data.sessions.map((s) => ({ ...s })),
    settings: { ...data.settings },
  }
}

/** 距上次备份多少天；从没备份过返回 null */
export function backupAgeDays(settings, now = Date.now()) {
  if (!settings?.lastBackupAt) return null
  const t = new Date(settings.lastBackupAt).getTime()
  if (!Number.isFinite(t)) return null
  return Math.floor((now - t) / 86400000)
}

/** 该不该在首页提一句备份？有记录可丢时才提。 */
export function needsBackupReminder({ settings, sessions, now = Date.now() }) {
  if (!sessions || sessions.length === 0) return false
  const age = backupAgeDays(settings, now)
  return age === null || age >= BACKUP_REMIND_DAYS
}

// ── 浏览器侧 ──────────────────────────────────────────────────
// 下面两个碰 DOM/File API，纯逻辑测试不会调用它们。

export function downloadBackup(data) {
  const text = JSON.stringify(data, null, 2)
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = backupFileName()
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => reject(fr.error || new Error('读取文件失败'))
    fr.readAsText(file)
  })
}
