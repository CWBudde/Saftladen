import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { SOUND_RECIPES, comboPlaybackRate } from '../src/game/audio/soundDesign'
import { sfxGain, type AudioSfxName } from '../src/game/audio/sfxMix'
import { encodeWavPcm16, synthesizeSound } from '../src/game/audio/tone'

// Offline listening artifact only; no external samples, network or autoplay.
const output = resolve('output/audio-preview')
await mkdir(output, { recursive: true })
const rows: string[] = []
for (const name of Object.keys(SOUND_RECIPES) as AudioSfxName[]) {
  for (const [index, recipe] of SOUND_RECIPES[name].entries()) {
    const file = `${name}-${index + 1}.wav`
    await writeFile(resolve(output, file), new Uint8Array(encodeWavPcm16(synthesizeSound(recipe))))
    rows.push(
      `<li><label>${name} · variation ${index + 1}<br><audio controls preload="none" src="${file}" data-volume="${sfxGain(name, 0.42)}"></audio></label></li>`,
    )
  }
}
for (const count of [3, 4, 5, 7]) {
  rows.push(
    `<li><label>Combo · ${count} fruit<br><audio controls preload="none" src="combo-1.wav" data-volume="${sfxGain('combo', 0.42)}" data-rate="${comboPlaybackRate(count)}"></audio></label></li>`,
  )
}
await writeFile(
  resolve(output, 'index.html'),
  `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Saftladen audio audition</title>
<style>body{font:18px system-ui;max-width:760px;margin:2rem auto;padding:0 1rem;background:#201812;color:#fff1cf}li{margin:1rem 0}audio{width:min(100%,360px)}</style>
<h1>Saftladen audio audition</h1>
<p>Effects use the default 42% master mix. Listen on headphones and phone speakers, then check the mix in an actual run with music.</p>
<p>Check blade/cut/juice separation, variation fatigue, rising combos, explosion clarity, quiet expiry versus activation, and comfortable volume during rapid groups. Confirm master zero, bomb/game-over ducking and restoration in the game.</p>
<ul>${rows.join('\n')}</ul>
<script>for(const audio of document.querySelectorAll('audio')){audio.volume=Number(audio.dataset.volume);audio.playbackRate=Number(audio.dataset.rate||1);audio.preservesPitch=false;audio.addEventListener('play',()=>{for(const other of document.querySelectorAll('audio'))if(other!==audio)other.pause()})}</script>
</html>`,
)
console.log(`Audio audition: ${resolve(output, 'index.html')}`)
