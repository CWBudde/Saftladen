import { gameAssets, type ImageAssetKey } from '../assets'
import { createViewportTransform, worldPointToCanvas } from '../core/viewport'
import { DEFAULT_COSMETIC_SELECTION } from '../ui/cosmetics'
import { drawBackgroundLayer, type WoodTextureCache } from './backgroundLayer'
import { createBoardCache } from './boardCache'
import { drawDojoScenery } from './cosmeticArt'
import { drawBoundingCircle, drawFpsOverlay, drawPointerProbe, drawSpawnEnvelopes, drawTrailStats } from './debugDraw'
import { drawDecalLayer, drawFruitBombPowerLayer, drawFruitHalfLayer, drawParticleLayer, type FruitImageSet, type FruitImages } from './entityLayers'
import { drawBladeTrails, drawScoreFeedbackLayer } from './feedbackLayers'
import { createImpactFeedback } from './impactFeedback'
import { collectRenderBuckets, createRenderBuckets } from './renderHelpers'
import type { Renderer } from './renderTypes'

export type { PointerTrailDebug, RendererDebugData, RenderContext, Renderer } from './renderTypes'

function createFruitImageSet(
  wholeKey: ImageAssetKey, cutKey?: ImageAssetKey,
  leftKey?: ImageAssetKey, rightKey?: ImageAssetKey,
): FruitImageSet {
  const whole = gameAssets.getImage(wholeKey)
  const cut = cutKey ? gameAssets.getImage(cutKey) : null
  const cutLeft = leftKey ? gameAssets.getImage(leftKey) : null
  const cutRight = rightKey ? gameAssets.getImage(rightKey) : null
  return {
    whole, cut, cutLeft, cutRight,
    wholeReady: whole !== null, cutReady: cut !== null,
    cutLeftReady: cutLeft !== null, cutRightReady: cutRight !== null,
  }
}

function readFruitImages(): FruitImages {
  return {
    apple: createFruitImageSet('appleWhole', 'appleCut'),
    orange: createFruitImageSet('orangeWhole', undefined, 'orangeLeft', 'orangeRight'),
    watermelon: createFruitImageSet('watermelonWhole', 'watermelonCut'),
    pineapple: createFruitImageSet('pineappleWhole', undefined, 'pineappleLeft', 'pineappleRight'),
    banana: createFruitImageSet('bananaWhole', 'bananaCut'),
    starfruit: createFruitImageSet('starfruitWhole', undefined, 'starfruitLeft', 'starfruitRight'),
  }
}

export function createRenderer(): Renderer {
  let woodTextureCache: WoodTextureCache | null = null
  const boardCache = createBoardCache()
  const buckets = createRenderBuckets()
  const impacts = createImpactFeedback()
  let observedRunId: string | null = null
  let assetSnapshot = gameAssets.getSnapshot()
  let fruitImages = readFruitImages()

  return {
    render: (ctx, state, frameInfo, context) => {
      const nextAssetSnapshot = gameAssets.getSnapshot()
      if (nextAssetSnapshot !== assetSnapshot) {
        assetSnapshot = nextAssetSnapshot
        fruitImages = readFruitImages()
      }
      const preferredBackgroundImage = gameAssets.getImage('background')
      const preferredBackgroundReady = preferredBackgroundImage !== null
      const bombImage = gameAssets.getImage('bomb')
      const bombImageReady = bombImage !== null
      const freezeGlyphImage = gameAssets.getImage('freeze')
      const freezeGlyphReady = freezeGlyphImage !== null
      const { widthCssPx, heightCssPx } = context.metrics
      const viewport = createViewportTransform(context.metrics, state.world.bounds)
      const scaleX = viewport.scale
      const scaleY = viewport.scale
      const reducedMotion = context.reducedMotion ?? false
      const cosmetics = context.cosmetics ?? DEFAULT_COSMETIC_SELECTION
      collectRenderBuckets(state.world.entities, buckets, !reducedMotion)
      if (state.run.id !== observedRunId || state.phase === 'idle') impacts.reset()
      observedRunId = state.run.id
      if (state.phase !== 'idle') impacts.consume(context.presentationEvents ?? [], frameInfo.timestampMs, state.world.bounds)
      boardCache.draw(ctx, context.metrics, cosmetics.dojo, preferredBackgroundImage, (boardCtx) => {
        if (cosmetics.dojo === 'great-wave') woodTextureCache = drawBackgroundLayer(
          boardCtx,
          widthCssPx,
          heightCssPx,
          woodTextureCache,
          preferredBackgroundImage,
          preferredBackgroundReady,
        )
        else boardCtx.clearRect(0, 0, widthCssPx, heightCssPx)
        drawDojoScenery(boardCtx, widthCssPx, heightCssPx, cosmetics.dojo, cosmetics.dojo === 'great-wave')
        // Shade the board behind the HUD; draw objects afterward to retain bright art.
        const boardShade = boardCtx.createLinearGradient(0, 0, 0, Math.min(200, heightCssPx * 0.45))
        boardShade.addColorStop(0, 'rgba(25, 16, 12, 0.88)')
        boardShade.addColorStop(1, 'rgba(25, 16, 12, 0)')
        boardCtx.fillStyle = boardShade
        boardCtx.fillRect(0, 0, widthCssPx, heightCssPx)
      })
      ctx.save()
      ctx.translate(viewport.offsetX, viewport.offsetY)
      drawDecalLayer(ctx, buckets.decals, scaleX, scaleY)
      drawFruitBombPowerLayer(ctx, buckets.objects, scaleX, scaleY, fruitImages, bombImage, bombImageReady, freezeGlyphImage, freezeGlyphReady)
      drawFruitHalfLayer(ctx, buckets.halves, scaleX, scaleY, fruitImages, reducedMotion)
      if (!reducedMotion) {
        drawParticleLayer(ctx, buckets.particles, scaleX, scaleY)
      }
      drawScoreFeedbackLayer(ctx, state.world.scoreFeedbackEvents, state.world.elapsedMs, scaleX, scaleY, reducedMotion)
      ctx.restore()
      drawBladeTrails(ctx, context, frameInfo.timestampMs)
      impacts.draw(ctx, frameInfo.timestampMs, viewport, state.world.bounds, widthCssPx, heightCssPx, reducedMotion)

      if (context.debug.enabled) {
        drawSpawnEnvelopes(ctx, state, viewport)
        for (const entity of buckets.objects) {
          drawBoundingCircle(ctx, worldPointToCanvas(entity.position, viewport), entity.radius * viewport.scale)
        }
        drawPointerProbe(ctx, context)
        drawTrailStats(ctx, context)
        drawFpsOverlay(ctx, frameInfo, context)
      }
    },
  }
}
