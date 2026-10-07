// 生成カットを Vertex AI の Veo 3.1（正式版 veo-3.1-generate-001、us-central1）で作る。
// 1本 8秒・16:9・1080p・音なし。既にあるカットは飛ばす。描かないことは docs/video/README.md のとおり。
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { endpoint, post } from './vertex.mjs'

const root = new URL('..', import.meta.url).pathname
const MODEL = 'veo-3.1-generate-001', LOC = 'us-central1'
const COMMON = ' Documentary realism, live-action look, 35mm film, soft natural light, muted colors, Japanese countryside. No text, no logos, no watermark.'
const NEG = 'small camera drone, consumer drone, DJI Mavic, text, watermark, logo, cartoon, anime, dramatic lighting, fast motion, fog rolling into houses, protective suits, dead crops, angry people, red target markers, radar overlay, crash'

export const CUTS = {
  cut01: 'Japanese rural rice paddies just before dawn, completely still water reflecting a pale sky, low mist over the fields, distant low mountains, a small white kei truck parked far away on a farm road. No people. No wind. Very slow dolly forward, locked horizon.',
  cut02: 'Close-up of a farmer\'s weathered hands in a blue work jacket pouring liquid from an unlabeled white container through a plastic funnel into a large white rectangular 20-liter tank mounted on a heavy black agricultural crop-spraying drone with thick carbon arms and spray nozzles, the drone sitting on the bed of a small white kei truck and mostly filling the frame; absolutely no brand names, no lettering, no camera gimbal. Early morning light, rice paddies softly out of focus behind. Face not visible. Slow, careful movement, slight handheld.',
  cut03: 'Slow aerial drone shot gliding forward over a small Japanese farming village at golden hour: rice paddies, vegetable fields, a cluster of farmhouses, a two-story school building with a schoolyard, a line of cedar trees, a narrow river. Wide, calm, everything visible in one frame. No people.',
  cut04: 'A middle-aged farmer in a gray work jacket and cap seen from behind, standing on a farm road beside a parked large agricultural spraying drone (a heavy-duty crop-spraying multirotor with a white tank and spray nozzles, like a DJI Agras; NOT a small camera drone), looking out across rice paddies and vegetable fields that all look the same green under a soft overcast morning. Static camera, slight breeze in the rice. Face not visible.',
  cut05: 'Overcast gray sky over Japanese rice paddies after rain, a wet farm road with puddles reflecting the clouds, raindrops dripping from a roadside grass, distant farmhouses. No people. Slow pan right, quiet.',
  cut06: 'A two-story Japanese elementary school building seen across flooded rice paddies in the early morning, its windows reflecting the sky, an empty schoolyard, cedar trees behind. No people. Static shot, gentle ripples on the water.',
  cut07: 'Neat rows of leafy vegetables in an organic field with wildflowers along the edge, morning light, a wooden stake at the row end with no readable writing, hills behind. No people. Very slow push-in at ground level.',
}

mkdirSync(join(root, 'public/gen/veo'), { recursive: true })
const only = process.argv.slice(2)
const ops = []
for (const [id, prompt] of Object.entries(CUTS)) {
  if (only.length && !only.includes(id)) continue
  const out = join(root, 'public/gen/veo', `${id}.mp4`)
  if (existsSync(out)) { console.log(id, 'exists'); continue }
  const r = await post(endpoint(LOC, MODEL, 'predictLongRunning'), {
    instances: [{ prompt: prompt + COMMON }],
    parameters: { aspectRatio: '16:9', durationSeconds: 8, resolution: '1080p', sampleCount: 1, generateAudio: false, negativePrompt: NEG, personGeneration: 'allow_adult' },
  })
  console.log(id, 'started')
  ops.push({ id, out, name: r.name })
}
while (ops.length) {
  await new Promise((r) => setTimeout(r, 20000))
  for (const op of [...ops]) {
    const r = await post(endpoint(LOC, MODEL, 'fetchPredictOperation'), { operationName: op.name })
    if (!r.done) continue
    ops.splice(ops.indexOf(op), 1)
    const v = r.response?.videos?.[0]
    if (!v?.bytesBase64Encoded) { console.log(op.id, 'FAILED', JSON.stringify(r).slice(0, 300)); continue }
    writeFileSync(op.out, Buffer.from(v.bytesBase64Encoded, 'base64'))
    console.log(op.id, 'saved', (r.response.raiMediaFilteredCount ? `filtered:${r.response.raiMediaFilteredCount}` : ''))
  }
}
