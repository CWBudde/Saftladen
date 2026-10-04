import { useEffect, useRef } from 'react'
import { gameAssets } from '../assets'
import { drawBladeSegment, drawDojoScenery } from '../render/cosmeticArt'
import {
  BLADE_UNLOCKS,
  DOJO_UNLOCKS,
  getCosmeticUnlock,
  type CosmeticSelection,
  type CosmeticUnlock,
} from './cosmetics'
import type { RewardProfile } from './rewards'

function CosmeticPreview({ item }: { item: CosmeticUnlock }) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const dojo = DOJO_UNLOCKS.find((entry) => entry.id === item.id)
      if (dojo) {
        const wood = dojo.id === 'great-wave' ? gameAssets.getImage('background') : null
        if (wood) ctx.drawImage(wood, 0, 0, canvas.width, canvas.height)
        drawDojoScenery(ctx, canvas.width, canvas.height, dojo.id, wood !== null)
      } else {
        const blade = BLADE_UNLOCKS.find((entry) => entry.id === item.id)
        ctx.fillStyle = '#19100c'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        if (blade)
          for (let segment = 0; segment < 20; segment++) {
            const x = 28 + segment * 11
            const y = (offset: number) =>
              89 - Math.sin((((segment + offset) / 20) * Math.PI) / 2) * 55
            drawBladeSegment(
              ctx,
              blade.id,
              { x, y: y(0) },
              { x: x + 11, y: y(1) },
              1.5 + (segment / 20) * 5,
            )
          }
      }
    }
    draw()
    return gameAssets.subscribe(draw)
  }, [item])
  return (
    <canvas
      ref={ref}
      width={280}
      height={126}
      className="cosmetic-preview"
      role="img"
      aria-label={`${item.name} preview: ${item.description}`}
    />
  )
}

export function CosmeticCard({
  item,
  profile,
  selection,
  onEquip,
}: {
  item: CosmeticUnlock
  profile: RewardProfile
  selection: CosmeticSelection
  onEquip: (item: CosmeticUnlock) => void
}) {
  const unlock = getCosmeticUnlock(item, profile)
  const equipped = item.id === selection.blade || item.id === selection.dojo
  return (
    <li className={`cosmetic-card ${equipped ? 'equipped' : ''}`}>
      <CosmeticPreview item={item} />
      <strong>{item.name}</strong>
      <span>{item.description}</span>
      <span>{unlock.status}</span>
      <button
        type="button"
        className="ghost-button"
        disabled={!unlock.unlocked}
        aria-label={`${equipped ? 'Equipped' : 'Equip'} ${item.name}`}
        aria-pressed={equipped}
        onClick={() => onEquip(item)}
      >
        {equipped ? 'Equipped' : unlock.unlocked ? 'Equip' : 'Locked'}
      </button>
    </li>
  )
}
