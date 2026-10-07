import narration from './narration.json'
import { LINES, TITLES } from './lines.mjs'
import { FPS } from './theme'

// 場面の種類。どの素材で見せるかは Main.tsx の SCENES で決める
export type SceneKey =
  | 'open' | 'stat' | 'guide' | 'm1' | 'm2' | 'm3' | 'rec1' | 'rec2'
  | 'turn' | 'app1' | 'app2' | 'app3' | 'app4' | 'app5' | 'close1' | 'close2'
type Id = keyof typeof LINES

// 話す順番と、どの場面で話すか（ナレーションの長さが場面の長さを決める）
const ORDER: [Id, SceneKey][] = [
  ['n01', 'open'],
  ['n02', 'stat'],
  ['n03', 'guide'],
  ['n04', 'm1'],
  ['n05', 'm2'],
  ['n06', 'm3'],
  ['n07a', 'rec1'],
  ['n07b', 'rec2'],
  ['n08', 'turn'],
  ['n09', 'app1'],
  ['n10', 'app2'],
  ['n11', 'app3'],
  ['n12', 'app4'],
  ['n13', 'app5'],
  ['n14', 'close1'],
  ['n15', 'close2'],
]

export interface Item {
  id: Id
  text: string
  title: { kicker: string; main: string; sub: string }
  start: number // 動画の頭からのフレーム
  len: number
}
export interface SceneSpan {
  key: SceneKey
  from: number
  len: number
  items: Item[] // start は場面の頭からのフレーム
}

const f = (sec: number) => Math.round(sec * FPS)
const LEAD = 0.9 // 場面が始まってから声が出るまで
const GAP = 0.6 // 声が終わってから次の場面へ

function build() {
  const items: (Item & { scene: SceneKey })[] = []
  let t = 1.6 // 冒頭は絵だけを少し見せる
  ORDER.forEach(([id, scene], i) => {
    const dur = (narration as Record<string, number>)[id]
    if (dur === undefined) throw new Error(`narration.json に ${id} がない。npm run narration を実行する`)
    if (i > 0 && ORDER[i - 1][1] !== scene) t += GAP + LEAD
    items.push({ id, text: LINES[id], title: TITLES[id], start: f(t), len: f(dur), scene })
    t += dur + 0.35
  })
  const keys = [...new Set(ORDER.map(([, s]) => s))]
  const starts = keys.map((k, i) => (i === 0 ? 0 : items.find((x) => x.scene === k)!.start - f(LEAD)))
  const last = items[items.length - 1]
  const total = last.start + last.len + f(3.0)
  const scenes: SceneSpan[] = keys.map((key, i) => {
    const from = starts[i]
    const to = i + 1 < keys.length ? starts[i + 1] : total
    return { key, from, len: to - from, items: items.filter((x) => x.scene === key).map((x) => ({ ...x, start: x.start - from })) }
  })
  return { items, scenes, total }
}

export const TIMELINE = build()
