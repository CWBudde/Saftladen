import type { AudioSfxName } from '../audio/sfxMix'
import type { GamePresentationEvent } from '../types'

/** Map every event in a catch-up batch; score changes are never used as a proxy. */
export function eventSounds(events: readonly GamePresentationEvent[]): AudioSfxName[] {
  const sounds: AudioSfxName[] = []
  for (const event of events) {
    switch (event.type) {
      case 'fruit-slice':
        sounds.push('slice')
        break
      case 'stroke-combo': sounds.push('combo'); break
      case 'fruit-miss': sounds.push('miss'); break
      case 'bomb-hit': sounds.push('bomb'); break
      case 'power-up-activated': sounds.push('power-up'); break
      case 'power-up-expired': sounds.push('power-up-expired'); break
      case 'run-end': sounds.push('game-over'); break
    }
  }
  return sounds
}

export function eventAnnouncement(events: readonly GamePresentationEvent[]): string | null {
  const messages: string[] = []
  let misses = 0
  for (const event of events) {
    switch (event.type) {
      case 'run-start': messages.push(`${event.mode} started.`); break
      case 'fruit-miss': misses += 1; break
      case 'bomb-hit': messages.push(event.penalty > 0 ? `Bomb hit. Lost ${event.penalty} points.` : 'Bomb hit.'); break
      case 'power-up-activated': messages.push(`${event.powerUp.replaceAll('-', ' ')} activated.`); break
      case 'power-up-expired': messages.push(`${event.powerUp.replaceAll('-', ' ')} ended.`); break
      case 'stroke-combo': messages.push(`Stroke combo. ${event.fruitCount} fruit, ${event.bonus} bonus points.`); break
      case 'run-end': messages.push(`Run complete. Score ${event.score}.`); break
    }
  }
  if (misses > 0) messages.unshift(`${misses} fruit missed.`)
  return messages.length > 0 ? messages.join(' ') : null
}
