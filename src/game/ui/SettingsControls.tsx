import type { UiSettings } from './viewModel'

type SettingsControlsProps = {
  settings: UiSettings
  onChange: (patch: Partial<UiSettings>) => void
}

export function SettingsControls({ settings, onChange }: SettingsControlsProps) {
  return (
    <fieldset className="settings-controls">
      <legend>Settings</legend>
      <label className="volume-row">
        <span className="volume-label">Music</span>
        <input type="range" className="volume-slider" min={0} max={1} step={0.05}
          value={settings.musicVolume} aria-valuetext={`${Math.round(settings.musicVolume * 100)} percent`}
          onChange={(event) => onChange({ musicVolume: Number(event.target.value) })} />
        <span className="volume-value" aria-hidden="true">{Math.round(settings.musicVolume * 100)}%</span>
      </label>
      <label className="volume-row">
        <span className="volume-label">SFX</span>
        <input type="range" className="volume-slider" min={0} max={1} step={0.05}
          value={settings.sfxVolume} aria-valuetext={`${Math.round(settings.sfxVolume * 100)} percent`}
          onChange={(event) => onChange({ sfxVolume: Number(event.target.value) })} />
        <span className="volume-value" aria-hidden="true">{Math.round(settings.sfxVolume * 100)}%</span>
      </label>
      <label className="volume-row">
        <span className="volume-label">Blade sensitivity</span>
        <input type="range" className="volume-slider" min={0.5} max={2} step={0.1}
          value={settings.sliceSensitivity} aria-valuetext={`${Math.round(settings.sliceSensitivity * 100)} percent`}
          onChange={(event) => onChange({ sliceSensitivity: Number(event.target.value) })} />
        <span className="volume-value" aria-hidden="true">{Math.round(settings.sliceSensitivity * 100)}%</span>
      </label>
      <p className="settings-help">Higher sensitivity makes slower swipes count as cuts.</p>
      <label className="motion-row">
        <input type="checkbox" checked={settings.reducedMotion}
          aria-describedby="motion-help"
          onChange={(event) => onChange({ reducedMotion: event.target.checked })} />
        Reduce motion and flashes
      </label>
      <p id="motion-help" className="settings-help">Hides flashes, bursts and particles. Score and bomb messages stay visible.</p>
    </fieldset>
  )
}
