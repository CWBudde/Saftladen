import type { EntityId } from '../types'

let nextEntityNumber = 1

export function createEntityId(): EntityId {
  const id = `entity_${nextEntityNumber}` as EntityId
  nextEntityNumber += 1
  return id
}

export function resetEntityIds(startAt = 1): void {
  nextEntityNumber = Math.max(1, Math.floor(startAt))
}
