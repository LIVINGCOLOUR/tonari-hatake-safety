import { loadFont } from '@remotion/google-fonts/NotoSansJP'

export const jp = loadFont('normal', { weights: ['400', '500', '700', '900'], subsets: ['japanese', 'latin'], ignoreTooManyRequestsWarning: true }).fontFamily

export const C = {
  bg: '#0b1410',
  bg2: '#16271d',
  text: '#f4f1e8',
  muted: '#c9d1c6',
  faint: '#8a948c',
  accent: '#7ed957',
  accent2: '#9fe88a',
  warn: '#f0b35a',
  frame: '#111111',
}

export const FPS = 30
export const W = 1920
export const H = 1080
