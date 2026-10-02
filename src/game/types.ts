export type GamePhase = 'idle' | 'running' | 'paused' | 'game-over'

export type EntityId = `entity_${number}`
export type CoordinateSpace = 'world' | 'screen'

export type Vec2 = {
  x: number
  y: number
}

export type EntityKind = 'fruit' | 'fruit-half' | 'bomb' | 'power-up' | 'particle' | 'decal'

export type BaseEntity = {
  id: EntityId
  kind: EntityKind
  space: CoordinateSpace
  position: Vec2
  velocity: Vec2
  rotationRad: number
  angularVelocityRadPerS: number
  radius: number
}

export type FruitType = 'apple' | 'orange' | 'watermelon' | 'pineapple' | 'banana' | 'starfruit'

export type FruitEntity = BaseEntity & {
  kind: 'fruit'
  fruitType: FruitType
  color: string
  sliced: boolean
}

export type FruitHalfEntity = BaseEntity & {
  kind: 'fruit-half'
  fruitType: FruitType
  color: string
  half: 'left' | 'right'
  sourceFruitId: EntityId
  lifetimeMs: number
  ageMs: number
  /** Slice normal angle in the fruit's local coordinates at impact. */
  cutAngleRad: number
}

export type BombEntity = BaseEntity & {
  kind: 'bomb'
  color: string
}

export type PowerUpType = 'freeze' | 'frenzy' | 'double-points'

export type PowerUpEntity = BaseEntity & {
  kind: 'power-up'
  powerUpType: PowerUpType
  color: string
}

export type ParticleEntity = BaseEntity & {
  kind: 'particle'
  color: string
  lifetimeMs: number
  ageMs: number
}

export type DecalEntity = BaseEntity & {
  kind: 'decal'
  color: string
  lifetimeMs: number
  ageMs: number
  maxRadius: number
}

export type SliceTrailPoint = Vec2 & {
  tMs: number
}

export type SliceTrail = {
  pointerId: number
  points: SliceTrailPoint[]
}

export type SliceEvent = {
  entityId: EntityId
  pointerId: number
  atMs: number
  hitPosition: Vec2
  direction: Vec2
}

export type ScoreFeedbackEvent = {
  id: number
  amount: number
  combo: number
  position: Vec2
  createdAtMs: number
  lifetimeMs: number
}

export type TimeScalePreset = 'normal' | 'slow' | 'freeze'
export type GameMode = 'classic' | 'arcade' | 'zen'
export type ActivePowerUp = PowerUpType

export type TimeScale = {
  preset: TimeScalePreset
  factor: number
}

export type GameSettings = {
  fixedDtMs: number
  maxFrameDeltaMs: number
  timeScale: TimeScale
}

export type GameScore = {
  current: number
  combo: number
  best: number
  comboWindowMs: number
  lastSliceAtMs: number | null
}

export type StrikeState = {
  max: number
  remaining: number
  lastStrikeAtMs: number | null
}

export type PendingSpawnEntry = {
  spawnAtMs: number
  entity: GameEntity
}

export type SpawnState = {
  nextWaveAtMs: number
  wavesSpawned: number
  pending: PendingSpawnEntry[]
}

export type MissInfo = {
  count: number
  lastMissedFruitId: EntityId | null
  lastMissedAtMs: number | null
}

export type GameEntity = FruitEntity | FruitHalfEntity | BombEntity | PowerUpEntity | ParticleEntity | DecalEntity

export type WorldState = {
  tick: number
  elapsedMs: number
  bounds: Vec2
  entities: Record<EntityId, GameEntity>
  spawn: SpawnState
  misses: MissInfo
  sliceEvents: SliceEvent[]
  scoreFeedbackEvents: ScoreFeedbackEvent[]
  nextScoreFeedbackId: number
  lastBombHitAtMs: number | null
}

export type RunState = {
  id: string
  seed: number
  rngCalls: number
  simulationSteps: number
  cosmeticRngCalls: number
  stats: RunStats
}

export type RunStats = {
  fruitSliced: number
  missedFruits: number
  bombHits: number
  peakCombo: number
}

export type PresentationEventPayload = { atMs: number } & (
  | { type: 'run-start'; mode: GameMode; seed: number }
  | { type: 'fruit-slice'; entityId: EntityId; fruitType: FruitType; position: Readonly<Vec2>; direction: Readonly<Vec2>; points: number; combo: number }
  | { type: 'fruit-miss'; entityId: EntityId; position: Readonly<Vec2> }
  | { type: 'bomb-hit'; entityId: EntityId; position: Readonly<Vec2>; penalty: number }
  | { type: 'power-up-activated'; powerUp: PowerUpType; position: Readonly<Vec2>; durationMs: number }
  | { type: 'power-up-expired'; powerUp: PowerUpType }
  | { type: 'run-end'; mode: GameMode; score: number; durationMs: number; peakCombo: number; stats: Readonly<RunStats> }
)

export type GamePresentationEvent = Readonly<PresentationEventPayload & { id: number; runId: string }>

export type ArcadePowerUpTimers = {
  freezeMs: number
  frenzyMs: number
  doublePointsMs: number
}

export type ArcadeModeState = {
  roundDurationMs: number
  remainingMs: number
  powerUpTimers: ArcadePowerUpTimers
}

export type ZenModeState = {
  roundDurationMs: number
  remainingMs: number
}

export type ModeState = {
  arcade: ArcadeModeState
  zen: ZenModeState
}

export type GameState = {
  mode: GameMode
  phase: GamePhase
  settings: GameSettings
  score: GameScore
  strikes: StrikeState
  world: WorldState
  run: RunState
  modeState: ModeState
}
