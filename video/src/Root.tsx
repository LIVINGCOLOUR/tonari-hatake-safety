import React from 'react'
import { Composition } from 'remotion'
import { Main, TOTAL } from './Main'
import { FPS, H, W } from './theme'

export function Root() {
  return <Composition id="Main" component={Main} durationInFrames={TOTAL} fps={FPS} width={W} height={H} />
}
