// 存储层：localStorage 封装
//
// key 一律带版本号后缀，方便日后结构变更时做迁移（speaker.terms.v1 -> v2）。
// 只放结构化小数据（词库 / 记录 / 设置）。笔记照片不上传，所以没有 IndexedDB
// 那一层 —— 5MB 额度对这点文字来说绰绰有余。

import { BUILTIN_TERMS } from './data/terms.js'

const K = {
  terms: 'speaker.terms.v1',
  sessions: 'speaker.sessions.v1',
  settings: 'speaker.settings.v1',
  active: 'speaker.activeSession.v1',
}

export const DEFAULT_SETTINGS = {
  duration: 900,        // 秒
  sound: true,
  voice: false,
  notify: true,
  drawMode: 'unseen',   // unseen | random | review
  category: null,       // null = 全部
  lastBackupAt: null,   // M3 用
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw)
  } catch (err) {
    console.error(`[store] 读取 ${key} 失败，已回退默认值`, err)
    return fallback
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (err) {
    // 配额写满或隐私模式下会抛。M1 只有小数据，正常不该发生。
    console.error(`[store] 写入 ${key} 失败`, err)
    return false
  }
}

// ── 词库 ──────────────────────────────────────────────────────

export function loadTerms() {
  return read(K.terms, [])
}

/**
 * 首次启动灌入内置词库；之后若内置词库新增了词条，按 id 补齐。
 * 用户改过的词条（term/note/enabled）不会被内置数据覆盖。
 */
export function ensureTerms() {
  const stored = loadTerms()
  const byId = new Map(stored.map((t) => [t.id, t]))
  let added = 0

  for (const builtin of BUILTIN_TERMS) {
    if (!byId.has(builtin.id)) {
      stored.push({ ...builtin, builtin: true, enabled: true, createdAt: Date.now() })
      added++
    }
  }

  if (added > 0) write(K.terms, stored)
  return { terms: stored, added }
}

export function saveTerms(terms) {
  return write(K.terms, terms)
}

/**
 * 「恢复内置词库」：把内置词条的数据改回出厂状态，但：
 *   - 用户自己加的词条（没有 builtin 标记）原样留着
 *   - 用户删掉的内置词条会被重新补回来（否则「恢复」名不副实）
 * 返回新的词库数组，调用方负责存回并刷新内存。
 */
export function restoreBuiltinTerms() {
  const stored = loadTerms()
  const byId = new Map(stored.map((t) => [t.id, t]))
  const out = []

  for (const builtin of BUILTIN_TERMS) {
    const existing = byId.get(builtin.id)
    byId.delete(builtin.id)
    out.push({
      ...builtin,
      builtin: true,
      // 启用状态是用户的实际诉求，恢复内置也不该把它翻回 true
      enabled: existing ? existing.enabled !== false : true,
      createdAt: existing?.createdAt ?? Date.now(),
    })
  }

  // byId 里剩下的就是用户自建词条
  for (const t of stored) {
    if (byId.has(t.id)) { out.push(t); byId.delete(t.id) }
  }

  write(K.terms, out)
  return out
}

// ── 练习记录 ──────────────────────────────────────────────────

export function loadSessions() {
  return read(K.sessions, [])
}

export function appendSession(session) {
  const sessions = loadSessions()
  sessions.push(session)
  return write(K.sessions, sessions)
}

export function saveSessions(sessions) {
  return write(K.sessions, sessions)
}

export function deleteSession(id) {
  return write(K.sessions, loadSessions().filter((s) => s.id !== id))
}

/** 清空历史，保留词库和设置 */
export function clearSessions() {
  return write(K.sessions, [])
}

/** 清空一切：词库回退到内置、历史清空、设置回默认、进行中的 session 一并丢掉 */
export function clearAll() {
  clearActive()
  try {
    localStorage.removeItem(K.terms)
    localStorage.removeItem(K.sessions)
    localStorage.removeItem(K.settings)
  } catch (err) {
    console.error('[store] 清空数据失败', err)
    return false
  }
  return true
}

/** 粗略估算本站占用（字节）。偏小 —— 按 UTF-16 每字符 2 字节算，不含浏览器自身开销。 */
export function storageBytes() {
  let total = 0
  try {
    for (const k of Object.values(K)) {
      const v = localStorage.getItem(k)
      // UTF-16 存储，一个字符 2 字节，再加 key 本身
      if (v) total += (v.length + k.length) * 2
    }
  } catch (err) {
    console.error('[store] 统计存储占用失败', err)
  }
  return total
}

// ── 设置 ──────────────────────────────────────────────────────

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...read(K.settings, {}) }
}

export function saveSettings(settings) {
  return write(K.settings, settings)
}

// ── 进行中的 session（断点恢复用）─────────────────────────────
//
// 计时期间每一跳都往这里写。用户误关标签页、系统休眠、浏览器崩溃，
// 重新打开时都能按这个恢复。没有它，一次误操作就毁掉一整轮练习。

export function loadActive() {
  return read(K.active, null)
}

export function saveActive(session) {
  return write(K.active, session)
}

export function clearActive() {
  try {
    localStorage.removeItem(K.active)
  } catch (err) {
    console.error('[store] 清除 activeSession 失败', err)
  }
}

// ── 工具 ──────────────────────────────────────────────────────

export function uid(prefix = 's') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/** 本地自然日，格式 YYYY-MM-DD。跨时区/跨日按用户本机时间算。 */
export function localDay(ts = Date.now()) {
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
