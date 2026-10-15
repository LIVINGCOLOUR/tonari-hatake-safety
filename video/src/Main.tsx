import React from 'react'
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile } from 'remotion'
import { Chips, CloseScene, Pins, ScreenScene, StatScene, TurnScene, VeoScene } from './Scenes'
import { TIMELINE, type Item, type SceneKey } from './timeline'
import { C, FPS } from './theme'

type P = { items: Item[]; len: number }

// 場面ごとの素材。Veo のカット番号は scripts/gen-veo.mjs の CUTS
const SCENES: Record<SceneKey, (p: P) => React.ReactElement> = {
  open: (p) => <VeoScene cut="cut01" {...p} />,
  stat: (p) => <StatScene {...p} />,
  guide: (p) => (
    <VeoScene cut="cut03" strong {...p}>
      <Pins
        at={p.items[0].start + 20}
        pins={[
          { label: '有機のほ場', x: 0.46, y: 0.63 },
          { label: '学校', x: 0.56, y: 0.46 },
          { label: '家屋', x: 0.36, y: 0.5 },
          { label: '蜜蜂の巣箱', x: 0.18, y: 0.57 },
        ]}
      />
      <Chips at={p.items[0].start + 330} labels={['① 散布の日時', '② 使用目的', '③ 使用農薬の種類', '④ 実施主体の連絡先']} />
    </VeoScene>
  ),
  // cut04 は2秒目から稲の上に霧が流れ、飛散が起きているように見えるため、霧の出ない冒頭1.6秒だけを使う
  m1: (p) => <VeoScene cut="cut04" useSec={1.6} {...p} />,
  m2: (p) => <VeoScene cut="cut05" {...p} />,
  m3: (p) => <VeoScene cut="cut06" {...p} />,
  rec1: (p) => <VeoScene cut="cut02" strong {...p} />,
  rec2: (p) => <VeoScene cut="cut07" strong {...p} />,
  turn: (p) => <TurnScene {...p} />,
  // 画面は video/public/screens/（2026-10-16 撮影、/app.html?preview=1 の通常画面、1440×900）。座標はその画面上の位置
  app1: (p) => <ScreenScene img="plan.png" highlight={{ x: 308, y: 305, w: 1092, h: 75, at: p.items[0].start + 40 }} {...p} />,
  app2: (p) => <ScreenScene img="map.png" zoomTo={{ x: 665, y: 446, scale: 1.25, at: p.items[0].start + 60 }} {...p} />,
  // 「文面コピー」ボタンは字幕の影に入るため枠を付けず、文面に寄るだけにする
  app3: (p) => <ScreenScene img="notify.png" zoomTo={{ x: 560, y: 480, scale: 1.15, at: p.items[0].start + 60 }} {...p} />,
  // 延期: 延期のお知らせ文に差し替わり、宛先が全員「未連絡」に戻った画面
  app4: (p) => <ScreenScene img="reschedule.png" highlight={{ x: 318, y: 280, w: 500, h: 30, at: p.items[0].start + 20 }} zoomTo={{ x: 700, y: 400, scale: 1.15, at: p.items[0].start + 30 }} {...p} />,
  // 「開発中」は字幕（TITLES.n13.sub）で示す。画面に札を重ねない
  app5: (p) => <ScreenScene img="report.png" img2="history.png" switchAt={p.items[0].start + 330} {...p} />,
  close1: (p) => <CloseScene {...p} />,
  close2: (p) => <CloseScene final {...p} />,
}

export const TOTAL = TIMELINE.total

// 音楽: 転換の場面まで静かな曲、そこから少し明るい曲。32秒のクリップを2秒重ねてつなぐ
const CLIP = Math.round(32.7 * FPS)
const XF = 2 * FPS
const turnAt = TIMELINE.scenes.find((s) => s.key === 'turn')!.from

function musicPlan() {
  const out: { src: string; from: number; len: number }[] = []
  const calm = ['gen/music/calm-1.wav', 'gen/music/calm-2.wav', 'gen/music/calm-0.wav']
  const lift = ['gen/music/lift-1.wav', 'gen/music/lift-2.wav']
  let t = 0, i = 0
  while (t < turnAt) {
    out.push({ src: calm[i % calm.length], from: t, len: Math.min(CLIP, turnAt - t + XF) })
    t += CLIP - XF
    i++
  }
  t = turnAt
  i = 0
  while (t < TOTAL) {
    out.push({ src: lift[i % lift.length], from: t, len: Math.min(CLIP, TOTAL - t) })
    t += CLIP - XF
    i++
  }
  return out
}
const MUSIC = musicPlan()

export function Main() {
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {TIMELINE.scenes.map(({ key, from, len, items }) => (
        <Sequence key={key} from={from} durationInFrames={len}>
          {SCENES[key]({ items, len })}
          {items.map((it) => (
            <Sequence key={it.id} from={it.start}>
              <Audio src={staticFile(`narration/${it.id}.m4a`)} />
            </Sequence>
          ))}
        </Sequence>
      ))}

      {MUSIC.map((m, idx) => (
        <Sequence key={`${m.src}-${idx}`} from={m.from} durationInFrames={m.len}>
          <Audio
            src={staticFile(m.src)}
            volume={(f) => {
              const t = f + m.from
              // 声の間は音楽を下げる。曲の頭と尻は2秒で重ねる。最後は3秒で消える
              const speaking = TIMELINE.items.some((it) => t >= it.start - 6 && t <= it.start + it.len + 6)
              const base = (t < turnAt ? 0.26 : 0.34) * (speaking ? 0.45 : 1)
              const edge = interpolate(f, [0, XF, m.len - XF, m.len], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
              const tail = interpolate(t, [TOTAL - 3 * FPS, TOTAL], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
              return base * edge * tail
            }}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}
