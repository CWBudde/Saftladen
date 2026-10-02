import { expect, test } from 'bun:test'
import { createVoicePool } from '../src/game/audio/voicePool'

test('voice budget removes finished effects and steals the oldest active voice', () => {
  const pool = createVoicePool(2)
  const stopped: number[] = []
  let firstPlaying = true
  pool.add({ playing: () => firstPlaying, stop: () => stopped.push(1) })
  pool.add({ playing: () => true, stop: () => stopped.push(2) })
  firstPlaying = false
  pool.prepare()
  expect(stopped).toEqual([])
  pool.add({ playing: () => true, stop: () => stopped.push(3) })
  pool.prepare()
  expect(stopped).toEqual([2])
  pool.add({ playing: () => true, stop: () => stopped.push(4) })
  pool.clear()
  expect(stopped).toEqual([2, 3, 4])
  pool.prepare()
  expect(stopped).toEqual([2, 3, 4])
})
