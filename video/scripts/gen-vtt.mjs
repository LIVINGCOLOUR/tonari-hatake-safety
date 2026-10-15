// 3分版のナレーションから字幕（WebVTT）を作る。
// タイミングの計算は src/timeline.ts と同じ（LEAD/GAP/冒頭1.6秒/各行の後0.35秒）。
// 使い方: node video/scripts/gen-vtt.mjs [出力先]   既定は assets/promo/intro-ja.vtt
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { LINES } from '../src/lines.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const narration = JSON.parse(readFileSync(path.join(here, '../src/narration.json'), 'utf8'))
const out = process.argv[2] || path.join(here, '../../assets/promo/intro-ja.vtt')

// src/timeline.ts の ORDER と同じ並び（場面が変わるところで間が入る）
const ORDER = [
  ['n01', 'open'], ['n02', 'stat'], ['n03', 'guide'], ['n04', 'm1'], ['n05', 'm2'], ['n06', 'm3'],
  ['n07a', 'rec1'], ['n07b', 'rec2'], ['n08', 'turn'], ['n09', 'app1'], ['n10', 'app2'], ['n11', 'app3'],
  ['n12', 'app4'], ['n13', 'app5'], ['n14', 'close1'], ['n15', 'close2'],
]
const FPS = 30
const LEAD = 0.9
const GAP = 0.6
const MAX = 34 // 1枚の字幕の文字数の目安

const frame = (sec) => Math.round(sec * FPS) / FPS

// 「。」で切り、長い文は「、」で詰め直して MAX 文字前後にする
function chunks(text) {
  const sentences = text.match(/[^。]+。?/g) || [text]
  const pieces = []
  for (const s of sentences) {
    if (s.length <= MAX) { pieces.push(s); continue }
    const parts = s.match(/[^、]+、?/g) || [s]
    let cur = ''
    for (const p of parts) {
      if (cur && (cur + p).length > MAX) { pieces.push(cur); cur = '' }
      cur += p
    }
    if (cur) pieces.push(cur)
  }
  return pieces.map((p) => p.trim()).filter(Boolean)
}

function stamp(sec) {
  const ms = Math.round(sec * 1000)
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`
}

const cues = []
let t = 1.6
let last = { start: 0, len: 0 }
ORDER.forEach(([id, scene], i) => {
  const dur = narration[id]
  if (dur === undefined) throw new Error(`narration.json に ${id} がない`)
  if (i > 0 && ORDER[i - 1][1] !== scene) t += GAP + LEAD
  const start = frame(t)
  const len = frame(dur)
  const parts = chunks(LINES[id])
  const total = parts.reduce((n, p) => n + p.length, 0)
  let at = start
  parts.forEach((p, k) => {
    const share = (len * p.length) / total
    const end = k === parts.length - 1 ? start + len : at + share
    cues.push({ from: at, to: end, text: p })
    at = end
  })
  last = { start, len }
  t += dur + 0.35
})

const lines = ['WEBVTT', '', 'NOTE となりの畑セーフティ 紹介動画（4分版）の日本語字幕。video/scripts/gen-vtt.mjs で生成。', '']
cues.forEach((c, i) => {
  lines.push(String(i + 1), `${stamp(c.from)} --> ${stamp(c.to)}`, c.text, '')
})
writeFileSync(out, lines.join('\n'))
console.log(`${cues.length} cues, last ends ${stamp(last.start + last.len)}, expected total ${stamp(last.start + last.len + 3)} -> ${path.relative(process.cwd(), out)}`)
