import React from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { AbsoluteFill, Easing, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame } from 'remotion'
import type { Item } from './timeline'
import { C, FPS, H, W, jp } from './theme'

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const ease = Easing.out(Easing.cubic)
const fadeUp = (f: number, at: number, dur = 16, dy = 36) => ({
  opacity: interpolate(f, [at, at + dur], [0, 1], clamp),
  transform: `translateY(${interpolate(f, [at, at + dur], [dy, 0], { ...clamp, easing: ease })}px)`,
})

export function Stage({ children, bg = C.bg }: { children: ReactNode; bg?: string }) {
  return <AbsoluteFill style={{ background: bg, fontFamily: jp, color: C.text, overflow: 'hidden' }}>{children}</AbsoluteFill>
}

/** 生成カットの注記（右上） */
function AiNote() {
  return (
    <div style={{ position: 'absolute', right: 40, top: 30, fontSize: 22, fontWeight: 500, color: 'rgba(244,241,232,0.78)', textShadow: '0 1px 10px rgba(0,0,0,.6)' }}>
      ※映像はAI生成のイメージです
    </div>
  )
}

/** 左下の見出し。声が始まる少し前に出て、場面の終わりまで残る */
export function Caption({ item, size = 'normal' }: { item: Item; size?: 'normal' | 'small' }) {
  const f = useCurrentFrame()
  const at = Math.max(0, item.start - 6)
  const { kicker, main, sub } = item.title
  const longest = Math.max(...main.split('\n').map((l) => l.length))
  const mainSize = size === 'small' ? (longest > 22 ? 44 : 50) : longest > 26 ? 44 : longest > 19 ? 52 : 62
  return (
    <div style={{ position: 'absolute', left: 120, bottom: 110, maxWidth: 1500 }}>
      {kicker ? (
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '0.18em', color: C.accent2, marginBottom: 14, ...fadeUp(f, at, 12, -14) }}>{kicker}</div>
      ) : null}
      <div style={{ fontSize: mainSize, fontWeight: 900, lineHeight: 1.25, letterSpacing: '0.02em', whiteSpace: 'pre-line', textShadow: '0 2px 28px rgba(0,0,0,.55)', ...fadeUp(f, at + 4) }}>{main}</div>
      <div style={{ height: 7, borderRadius: 4, background: C.accent, marginTop: 16, width: interpolate(f, [at + 16, at + 30], [0, 240], { ...clamp, easing: ease }) }} />
      {sub ? (
        <div style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.5, marginTop: 18, color: C.muted, textShadow: '0 1px 14px rgba(0,0,0,.5)', ...fadeUp(f, at + 28, 14, 16) }}>{sub}</div>
      ) : null}
    </div>
  )
}

function Shade({ strong = false }: { strong?: boolean }) {
  return (
    <>
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(0,0,0,0) ${strong ? 28 : 45}%, rgba(5,12,8,${strong ? 0.88 : 0.78}) 100%)` }} />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,.45) 100%)' }} />
    </>
  )
}

/** Veo の8秒カット。場面が長いときは遅回しにし、足りない分は最後のコマで止める */
export function VeoScene({ cut, items, len, children, strong }: { cut: string; items: Item[]; len: number; children?: ReactNode; strong?: boolean }) {
  const f = useCurrentFrame()
  const sec = len / FPS
  const rate = Math.max(0.4, Math.min(1, 8 / sec))
  const zoom = interpolate(f, [0, len], [1.0, 1.05], clamp)
  const fadeIn = interpolate(f, [0, 14], [0, 1], clamp)
  return (
    <Stage>
      <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: '50% 45%', opacity: fadeIn }}>
        <OffthreadVideo src={staticFile(`gen/veo/${cut}.mp4`)} playbackRate={rate} muted style={{ width: W, height: H, objectFit: 'cover' }} />
      </AbsoluteFill>
      <Shade strong={strong} />
      {children}
      <AiNote />
      {items.map((it) => (
        <Caption key={it.id} item={it} />
      ))}
    </Stage>
  )
}

/** 俯瞰カットに灯すピン */
export function Pins({ at, pins }: { at: number; pins: { label: string; x: number; y: number }[] }) {
  const f = useCurrentFrame()
  return (
    <>
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
        {pins.map((p, i) => {
          const t0 = at + i * 24
          const o = interpolate(f, [t0, t0 + 8], [0, 1], clamp)
          const r = interpolate(f, [t0, t0 + 48], [12, 150], { ...clamp, easing: ease })
          const ro = interpolate(f, [t0, t0 + 48], [0.9, 0], clamp)
          return (
            <g key={p.label}>
              <circle cx={p.x * W} cy={p.y * H} r={r} fill="none" stroke={C.accent2} strokeWidth={4} opacity={ro} />
              <circle cx={p.x * W} cy={p.y * H} r={13} fill={C.accent2} stroke={C.bg} strokeWidth={4} opacity={o} />
            </g>
          )
        })}
      </svg>
      {pins.map((p, i) => (
        <div key={p.label} style={{ position: 'absolute', left: p.x * W + 24, top: p.y * H - 24, fontSize: 32, fontWeight: 700, textShadow: '0 2px 16px rgba(0,0,0,.8)', ...fadeUp(f, at + i * 24 + 4, 10, 0) }}>
          {p.label}
        </div>
      ))}
    </>
  )
}

/** ガイドラインの4点 */
export function Chips({ at, labels }: { at: number; labels: string[] }) {
  const f = useCurrentFrame()
  return (
    <div style={{ position: 'absolute', left: 120, top: 110, display: 'flex', gap: 18 }}>
      {labels.map((l, i) => (
        <div key={l} style={{ fontSize: 30, fontWeight: 700, padding: '10px 24px', borderRadius: 999, background: 'rgba(11,20,16,.62)', border: `2px solid ${C.accent2}`, textShadow: '0 1px 8px rgba(0,0,0,.6)', ...fadeUp(f, at + i * 12, 12, 14) }}>
          {l}
        </div>
      ))}
    </div>
  )
}

/** 節1: 統計がない（文字だけ） */
export function StatScene({ items }: { items: Item[] }) {
  const f = useCurrentFrame()
  const it = items[0]
  const at = it.start
  const rows = ['農薬事故統計', '公害苦情調査', '都道府県への空中散布計画書']
  return (
    <Stage bg={`radial-gradient(ellipse at 50% 35%, ${C.bg2} 0%, ${C.bg} 70%)`}>
      <div style={{ position: 'absolute', left: 160, top: 120, right: 160 }}>
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '0.18em', color: C.accent2, ...fadeUp(f, at - 10, 12, -10) }}>分かっていること、分かっていないこと</div>
        <div style={{ fontSize: 50, fontWeight: 900, marginTop: 16, ...fadeUp(f, at) }}>事前の周知は、どれだけ行われているのか。</div>
        <div style={{ marginTop: 56 }}>
          {rows.map((r, i) => (
            <div key={r} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,.18)', padding: '22px 8px', ...fadeUp(f, at + 150 + i * 30, 12, 0), transform: `translateX(${interpolate(f, [at + 150 + i * 30, at + 162 + i * 30], [-24, 0], { ...clamp, easing: ease })}px)` }}>
              <span style={{ fontSize: 36, fontWeight: 700 }}>{r}</span>
              <span style={{ fontSize: 30, color: C.muted }}>
                「周知を行った割合」の集計　<b style={{ fontSize: 44, color: C.warn, marginLeft: 14 }}>なし</b>
              </span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 66, fontWeight: 900, marginTop: 64, ...fadeUp(f, at + 330) }}>測る仕組みが、そもそもない。</div>
        <div style={{ height: 7, borderRadius: 4, background: C.accent, marginTop: 16, width: interpolate(f, [at + 350, at + 366], [0, 240], { ...clamp, easing: ease }) }} />
        <div style={{ fontSize: 28, color: C.muted, marginTop: 18, ...fadeUp(f, at + 420, 14, 12) }}>特定の自治体の取り組みが不足している、という話ではありません。</div>
      </div>
    </Stage>
  )
}

/** 転換: 白へ抜けて「だから、道具を作っています。」 */
export function TurnScene({ items }: { items: Item[] }) {
  const f = useCurrentFrame()
  const it = items[0]
  const white = interpolate(f, [0, 10, 26], [1, 1, 0], clamp)
  return (
    <Stage bg={`radial-gradient(ellipse at 50% 40%, ${C.bg2} 0%, ${C.bg} 70%)`}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 440, textAlign: 'center', fontSize: 76, fontWeight: 900, ...fadeUp(f, it.start - 4, 18) }}>{it.title.main}</div>
      <div style={{ position: 'absolute', left: '50%', top: 560, height: 7, borderRadius: 4, background: C.accent, width: interpolate(f, [it.start + 16, it.start + 32], [0, 180], { ...clamp, easing: ease }), transform: 'translateX(-50%)' }} />
      <AbsoluteFill style={{ background: '#fff', opacity: white, pointerEvents: 'none' }} />
    </Stage>
  )
}

/** パソコンの実画面。角丸の枠に入れ、ゆっくり寄る。別の画面へ切り替えることもできる */
export function ScreenScene({ img, img2, switchAt, items, len, highlight, badge, zoomTo }: {
  img: string
  img2?: string
  switchAt?: number
  items: Item[]
  len: number
  highlight?: { x: number; y: number; w: number; h: number; at: number } // 1440x900 の画面上の座標
  badge?: { text: string; x: number; y: number; at: number }
  zoomTo?: { x: number; y: number; scale: number; at: number } // 画面上の点へ寄る
}) {
  const f = useCurrentFrame()
  const it = items[0]
  const fw = 1680, fh = 1050 // 1440x900 を 1.1667 倍
  const k = fw / 1440
  const fx = (W - fw) / 2, fy = 40
  const base = interpolate(f, [0, len], [1.0, 1.03], clamp)
  const zs = zoomTo ? interpolate(f, [zoomTo.at, zoomTo.at + 30], [1, zoomTo.scale], { ...clamp, easing: ease }) : 1
  const origin = zoomTo ? `${zoomTo.x * k}px ${zoomTo.y * k}px` : '50% 40%'
  const o2 = img2 && switchAt !== undefined ? interpolate(f, [switchAt, switchAt + 14], [0, 1], clamp) : 0
  return (
    <Stage>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 20%, ${C.bg2} 0%, ${C.bg} 70%)` }} />
      <div style={{ position: 'absolute', left: fx, top: fy, width: fw, height: fh, borderRadius: 20, overflow: 'hidden', boxShadow: '0 36px 90px rgba(0,0,0,.6)', border: '1px solid rgba(255,255,255,.10)', background: C.frame, opacity: interpolate(f, [0, 12], [0, 1], clamp), transform: `scale(${interpolate(f, [0, 20], [1.04, 1], { ...clamp, easing: ease })})` }}>
        <div style={{ position: 'absolute', inset: 0, transform: `scale(${base * zs})`, transformOrigin: origin }}>
          <Img src={staticFile(`screens/${img}`)} style={{ width: fw, height: fh, display: 'block' }} />
          {img2 ? <Img src={staticFile(`screens/${img2}`)} style={{ position: 'absolute', inset: 0, width: fw, height: fh, opacity: o2 }} /> : null}
          {highlight ? (
            <div style={{ position: 'absolute', left: highlight.x * k, top: highlight.y * k, width: highlight.w * k, height: highlight.h * k, border: `4px solid ${C.accent}`, borderRadius: 10, boxShadow: '0 0 0 6px rgba(126,217,87,.25)', opacity: interpolate(f, [highlight.at, highlight.at + 10], [0, 1], clamp) }} />
          ) : null}
          {badge ? (
            <div style={{ position: 'absolute', left: badge.x * k, top: badge.y * k, fontSize: 26, fontWeight: 900, color: C.bg, background: C.warn, padding: '6px 16px', borderRadius: 8, opacity: interpolate(f, [badge.at, badge.at + 10], [0, 1], clamp) }}>{badge.text}</div>
          ) : null}
        </div>
      </div>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(5,12,8,.85) 100%)', pointerEvents: 'none' }} />
      <Caption item={it} size="small" />
    </Stage>
  )
}

/** 締め */
export function CloseScene({ items, final }: { items: Item[]; final?: boolean }) {
  const f = useCurrentFrame()
  const it = items[0]
  const at = it.start - 6
  const lines = it.title.main.split('\n')
  const style: CSSProperties = { textAlign: 'center' }
  return (
    <Stage bg={`radial-gradient(ellipse at 50% 40%, ${C.bg2} 0%, ${C.bg} 70%)`}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: final ? 420 : 330, ...style }}>
        {final ? (
          <>
            <div style={{ fontSize: 52, fontWeight: 700, letterSpacing: '0.06em', ...fadeUp(f, at) }}>
              となりの畑セーフティ<span style={{ fontSize: 32, fontWeight: 500, opacity: 0.8 }}>（仮称）</span>
            </div>
            <div style={{ height: 7, borderRadius: 4, background: C.accent, margin: '30px auto 0', width: interpolate(f, [at + 14, at + 30], [0, 160], { ...clamp, easing: ease }) }} />
            <div style={{ fontSize: 30, color: C.muted, marginTop: 34, ...fadeUp(f, at + 30, 14, 12) }}>{it.title.sub}</div>
          </>
        ) : (
          <>
            {lines.map((l, i) => (
              <div key={l} style={{ fontSize: 64, fontWeight: 900, lineHeight: 1.35, ...fadeUp(f, at + i * 10) }}>{l}</div>
            ))}
            <div style={{ height: 7, borderRadius: 4, background: C.accent, margin: '30px auto 0', width: interpolate(f, [at + 30, at + 46], [0, 200], { ...clamp, easing: ease }) }} />
            <div style={{ fontSize: 46, fontWeight: 700, marginTop: 36, ...fadeUp(f, at + 150, 16, 14) }}>{it.title.sub}</div>
          </>
        )}
      </div>
    </Stage>
  )
}
