import type {
  BombEntity,
  DecalEntity,
  EntityId,
  FruitEntity,
  FruitHalfEntity,
  FruitType,
  ParticleEntity,
  PowerUpEntity,
  PowerUpType,
  Vec2,
} from '../types'
import { createEntityId } from './entityId'

type EntityMotionConfig = {
  position: Vec2
  velocity: Vec2
  rotationRad: number
  angularVelocityRadPerS: number
  radius: number
}

type FruitConfig = EntityMotionConfig & {
  fruitType: FruitType
  color: string
}

type BombConfig = EntityMotionConfig & {
  color: string
}

type PowerUpConfig = EntityMotionConfig & {
  powerUpType: PowerUpType
  color: string
}

type ParticleConfig = EntityMotionConfig & {
  color: string
  lifetimeMs: number
}

type FruitHalfConfig = EntityMotionConfig & {
  fruitType: FruitType
  color: string
  half: 'left' | 'right'
  sourceFruitId: EntityId
  lifetimeMs: number
}

type DecalConfig = EntityMotionConfig & {
  color: string
  lifetimeMs: number
  maxRadius: number
}

export function createFruitEntity(config: FruitConfig): FruitEntity {
  return {
    id: createEntityId(),
    kind: 'fruit',
    space: 'world',
    position: config.position,
    velocity: config.velocity,
    rotationRad: config.rotationRad,
    angularVelocityRadPerS: config.angularVelocityRadPerS,
    radius: config.radius,
    fruitType: config.fruitType,
    color: config.color,
    sliced: false,
  }
}

export function createBombEntity(config: BombConfig): BombEntity {
  return {
    id: createEntityId(),
    kind: 'bomb',
    space: 'world',
    position: config.position,
    velocity: config.velocity,
    rotationRad: config.rotationRad,
    angularVelocityRadPerS: config.angularVelocityRadPerS,
    radius: config.radius,
    color: config.color,
  }
}

export function createPowerUpEntity(config: PowerUpConfig): PowerUpEntity {
  return {
    id: createEntityId(),
    kind: 'power-up',
    space: 'world',
    position: config.position,
    velocity: config.velocity,
    rotationRad: config.rotationRad,
    angularVelocityRadPerS: config.angularVelocityRadPerS,
    radius: config.radius,
    powerUpType: config.powerUpType,
    color: config.color,
  }
}

export function createParticleEntity(config: ParticleConfig): ParticleEntity {
  return {
    id: createEntityId(),
    kind: 'particle',
    space: 'world',
    position: config.position,
    velocity: config.velocity,
    rotationRad: config.rotationRad,
    angularVelocityRadPerS: config.angularVelocityRadPerS,
    radius: config.radius,
    color: config.color,
    lifetimeMs: config.lifetimeMs,
    ageMs: 0,
  }
}

export function createFruitHalfEntity(config: FruitHalfConfig): FruitHalfEntity {
  return {
    id: createEntityId(),
    kind: 'fruit-half',
    space: 'world',
    position: config.position,
    velocity: config.velocity,
    rotationRad: config.rotationRad,
    angularVelocityRadPerS: config.angularVelocityRadPerS,
    radius: config.radius,
    fruitType: config.fruitType,
    color: config.color,
    half: config.half,
    sourceFruitId: config.sourceFruitId,
    lifetimeMs: config.lifetimeMs,
    ageMs: 0,
  }
}

export function createDecalEntity(config: DecalConfig): DecalEntity {
  return {
    id: createEntityId(),
    kind: 'decal',
    space: 'world',
    position: config.position,
    velocity: config.velocity,
    rotationRad: config.rotationRad,
    angularVelocityRadPerS: config.angularVelocityRadPerS,
    radius: config.radius,
    color: config.color,
    lifetimeMs: config.lifetimeMs,
    ageMs: 0,
    maxRadius: config.maxRadius,
  }
}
