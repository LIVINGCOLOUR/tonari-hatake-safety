// ナレーションを Vertex AI の Gemini TTS（Gacrux）で作り、長さを src/narration.json に書く
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { LINES } from '../src/lines.mjs'
import { endpoint, post } from './vertex.mjs'

const root = new URL('..', import.meta.url).pathname
const NARRATOR = { voice: 'Gacrux', style: 'ドキュメンタリーのナレーションとして、落ち着いた低めの声で、ゆっくり、文の間に少し間を置いて読んでください。売り込みの抑揚は付けず、淡々と、しかし冷たくならないように。' }

async function tts(text, { voice, style }, m4a) {
  const r = await post(endpoint('global', 'gemini-3.8-flash-tts', 'generateContent'), {
    contents: [{ role: 'user', parts: [{ text, speech_metadata: { style } }] }],
    generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { voice } } },
  })
  const data = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data
  if (!data) throw new Error(`${m4a}: no audio (${JSON.stringify(r).slice(0, 200)})`)
  const wav = m4a.replace(/\.m4a$/, '.wav')
  writeFileSync(wav, Buffer.from(data, 'base64'))
  execFileSync('/opt/homebrew/bin/ffmpeg', ['-v', 'error', '-y', '-i', wav, '-c:a', 'aac', '-b:a', '96k', m4a])
  rmSync(wav)
}
const length = (f) => Number(execFileSync('/opt/homebrew/bin/ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString())

mkdirSync(join(root, 'public/narration'), { recursive: true })
const durations = {}
for (const [id, text] of Object.entries(LINES)) {
  const f = join(root, 'public/narration', `${id}.m4a`)
  if (!existsSync(f)) await tts(text, NARRATOR, f)
  durations[id] = length(f)
  console.log(id, durations[id].toFixed(2), 's')
}
writeFileSync(join(root, 'src/narration.json'), JSON.stringify(durations, null, 2) + '\n')
