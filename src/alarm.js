// 提醒三件套：提示音、语音播报、系统通知
//
// 全部走 Web API，不引任何音频资源文件 —— 单文件产物里塞不下 mp3，
// 用 Web Audio 现场合成一个正弦音就够了。

let audioCtx = null

function getCtx() {
  if (!audioCtx) {
    const Ctor = window.AudioContext || window.webkitAudioContext
    if (!Ctor) return null
    audioCtx = new Ctor()
  }
  return audioCtx
}

/**
 * 响几声。总时长控制在 1 秒左右，别太吵。
 * AudioContext 在用户没交互过时是 suspended，resume() 需要手势 —— 用户点过
 * "开始计时"，所以这里一定是解锁状态。
 */
export function beep({ freq = 880, duration = 0.16, times = 3, gap = 0.24 } = {}) {
  try {
    const ac = getCtx()
    if (!ac) return
    if (ac.state === 'suspended') ac.resume()

    const now = ac.currentTime
    for (let i = 0; i < times; i++) {
      const t = now + i * gap
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
      osc.connect(gain)
      gain.connect(ac.destination)
      osc.start(t)
      osc.stop(t + duration + 0.02)
    }
  } catch (err) {
    console.warn('[alarm] 提示音失败', err)
  }
}

export function speak(text) {
  try {
    if (!('speechSynthesis' in window)) return
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'zh-CN'
    u.rate = 1
    speechSynthesis.speak(u)
  } catch (err) {
    console.warn('[alarm] 语音播报失败', err)
  }
}

/** 在"开始计时"时调用，这时有用户手势，是申请通知权限的最佳时机 */
export async function requestNotifyPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  try {
    return (await Notification.requestPermission()) === 'granted'
  } catch (err) {
    console.warn('[alarm] 通知权限申请失败', err)
    return false
  }
}

export function notify(title, body) {
  try {
    if (!('Notification' in window)) return false
    if (Notification.permission !== 'granted') return false
    // tag 相同会覆盖上一条，避免连着响两次时堆两条通知
    new Notification(title, { body, tag: 'speaker-timer' })
    return true
  } catch (err) {
    console.warn('[alarm] 系统通知失败', err)
    return false
  }
}
