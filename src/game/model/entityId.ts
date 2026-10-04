import type { EntityId } from '../types'

let nextEntityNumber = 1

/** Each engine owns independent gameplay and cosmetic number sequences. */
export function createEntityIdAllocator(startAt = 1, increment = 1) {
  let next = startAt
  return {
    next: (): EntityId => {
      const id = `entity_${next}` as EntityId
      next += increment
      return id
    },
    reset: () => {
      next = startAt
    },
  }
}

export function createEntityId(): EntityId {
  const id = `entity_${nextEntityNumber}` as EntityId
  nextEntityNumber += 1
  return id
}

export function resetEntityIds(startAt = 1): void {
  nextEntityNumber = Math.max(1, Math.floor(startAt))
}
