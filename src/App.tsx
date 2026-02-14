import './App.css'
import { GameCanvasLayer } from './game/core'

function App() {
  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">React + TypeScript + Vite + Bun</p>
        <h1>Fruit Ninja Clone</h1>
        <p className="subtitle">Scaffold ready. Gameplay systems are not implemented yet.</p>
      </header>

      <section className="panel">
        <h2>Game Stage</h2>
        <GameCanvasLayer />
        <p className="hint">
          Controls: slice fruits, avoid bombs, 3 misses end the run. Space pause/resume, R restart, D debug overlay.
        </p>
      </section>

      <section className="panel">
        <h2>Included Basics</h2>
        <ul>
          <li>TypeScript-enabled React app bootstrapped with Vite</li>
          <li>Bun lockfile and Bun scripts for dev/build/lint</li>
          <li>Canvas layer wired to a reusable requestAnimationFrame game loop</li>
          <li>Headless fixed-timestep engine with start/pause/resume/stop/reset lifecycle</li>
          <li>Wave-based entity spawning with ballistic arcs (fruits, bombs, and power-ups)</li>
          <li>Pointer trail input model with timestamped ring buffers and slice-velocity threshold</li>
          <li>Segment-vs-circle slicing with fruit split events and juice particle bursts</li>
          <li>Classic round rules with strikes, bomb game-over, combo scoring, and best-score persistence</li>
          <li>Initial game-oriented folder structure under <code>src/game</code></li>
        </ul>
      </section>
    </main>
  )
}

export default App
