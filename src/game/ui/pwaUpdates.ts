// No automatic reload: even an update accepted in another tab must preserve a run.
type UpdateSnapshot = { available: boolean; applying: boolean; canReload: boolean; error: boolean }
let snapshot: UpdateSnapshot = { available: false, applying: false, canReload: false, error: false }
const listeners = new Set<() => void>()
let registration: ServiceWorkerRegistration | undefined
let started = false

function publish(change: Partial<UpdateSnapshot>) {
  snapshot = { ...snapshot, ...change }
  listeners.forEach((listener) => listener())
}

export const pwaUpdates = {
  getSnapshot: () => snapshot,
  subscribe: (listener: () => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  apply: async () => {
    if (snapshot.canReload) {
      publish({ applying: true })
      return
    }
    publish({ applying: true, error: false })
    try {
      // Registration handles can become stale across failed installs/reconnects
      // or another tab's activation. Resolve the current worker at acceptance.
      const current = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
      const worker = current?.waiting
      if (!worker) {
        publish(current?.active ? { canReload: true } : { applying: false, error: true })
        return
      }
      const finish = (success: boolean) => {
        clearTimeout(timeout)
        worker.removeEventListener('statechange', changed)
        publish(success ? { canReload: true } : { applying: false, error: true })
      }
      const changed = () => {
        if (worker.state === 'activated') finish(true)
        else if (worker.state === 'redundant') finish(false)
      }
      const timeout = setTimeout(() => finish(false), 15_000)
      worker.addEventListener('statechange', changed)
      worker.postMessage({ type: 'SKIP_WAITING' })
      changed()
    } catch {
      publish({ applying: false, error: true })
    }
  },
}

export function startPwaUpdates() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || started) return
  started = true
  let controller = navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (controller) publish({ available: true, canReload: true })
    controller = navigator.serviceWorker.controller
  })
  const watch = (current: ServiceWorkerRegistration) => {
    const installed = () => {
      if (current.waiting && current.active) publish({ available: true })
    }
    installed()
    const installing = () => {
      const worker = current.installing
      if (!worker) return
      worker.addEventListener('statechange', installed)
    }
    current.addEventListener('updatefound', installing)
    installing()
  }
  let checking = false
  const check = async () => {
    if (checking) return
    checking = true
    try {
      // A failed first install may unregister itself. Its old registration
      // handle cannot be updated; register again after the connection returns.
      if (
        registration &&
        !registration.active &&
        !registration.installing &&
        !registration.waiting
      ) {
        registration = undefined
      }
      if (!registration) {
        registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
          scope: import.meta.env.BASE_URL,
          updateViaCache: 'none',
        })
        watch(registration)
      } else {
        await registration.update()
      }
    } catch {
      // Offline/failed installs leave the current game usable. Retry on reconnect.
    } finally {
      checking = false
    }
  }
  window.addEventListener('online', () => {
    void check()
  })
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void check()
  })
  void check()
}
