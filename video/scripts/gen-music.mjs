// 音楽を Vertex AI の Lyria 2（lyria-002、32秒クリップ）で作る。Lyria 3 はこのプロジェクトでは使えない（2026-10-07）。
// 前半用（静か）と後半用（少し明るい）を数本ずつ作り、Remotion 側でつないで鳴らす。
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { endpoint, post } from './vertex.mjs'

const root = new URL('..', import.meta.url).pathname
const TRACKS = {
  calm: 'Quiet, warm, unhurried solo piano with very soft sustained strings, slow tempo around 60 BPM, minimal, reflective, documentary about rural Japan at dawn, sparse notes with space between phrases, no drums, no percussion, no vocals, consistent mood throughout, loopable.',
  lift: 'Calm and slightly brighter ambient piece: felt piano, soft pads, a touch of nylon guitar, slow and steady, warm major tonality, gentle and understated, cinematic documentary underscore, no drums, no vocals.',
}
const NEG = 'vocals, drums, percussion, EDM, distortion, brass, dramatic swells'
mkdirSync(join(root, 'public/gen/music'), { recursive: true })
for (const [key, prompt] of Object.entries(TRACKS)) {
  for (let i = 1; i <= 2; i++) {
    const out = join(root, 'public/gen/music', `${key}-${i}.wav`)
    if (existsSync(out)) { console.log(key, i, 'exists'); continue }
    const r = await post(endpoint('us-central1', 'lyria-002', 'predict'), { instances: [{ prompt, negative_prompt: NEG, seed: 7 * i + key.length * 13 }], parameters: {} })
    const p = r.predictions?.[0]
    const b64 = p?.bytesBase64Encoded || p?.audioContent
    if (!b64) { console.log(key, i, 'FAILED', JSON.stringify(r).slice(0, 200)); continue }
    writeFileSync(out, Buffer.from(b64, 'base64'))
    console.log(key, i, 'saved')
  }
}
