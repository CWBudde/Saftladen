import { useEffect, useState } from 'react'
import type { GameEngine } from '../engine'
import {
  areGameUiSnapshotsEqual,
  loadUiSettings,
  saveUiSettings,
  selectGameUiSnapshot,
  type GameUiSnapshot,
  type UiSettings,
} from './viewModel'

export function useGameUiSnapshot(engine: GameEngine): GameUiSnapshot {
  const [snapshot, setSnapshot] = useState<GameUiSnapshot>(() => selectGameUiSnapshot(engine.getState()))

  useEffect(() => {
    return engine.subscribe((state) => {
      const next = selectGameUiSnapshot(state)
      setSnapshot((prev) => (areGameUiSnapshotsEqual(prev, next) ? prev : next))
    })
  }, [engine])

  return snapshot
}

export function useUiSettings(): [UiSettings, (patch: Partial<UiSettings>) => void] {
  const [settings, setSettings] = useState<UiSettings>(() => loadUiSettings())

  useEffect(() => {
    saveUiSettings(settings)
  }, [settings])

  const updateSettings = (patch: Partial<UiSettings>) => {
    setSettings((previous) => ({
      ...previous,
      ...patch,
    }))
  }

  return [settings, updateSettings]
}
