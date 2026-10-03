const ONBOARDING_STORAGE_KEY = 'saftladen.onboarding.v1'

export function hasSeenOnboarding(): boolean {
  try { return localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'seen' }
  catch { return false }
}

export function rememberOnboarding(): void {
  try { localStorage.setItem(ONBOARDING_STORAGE_KEY, 'seen') }
  catch { /* Help remains available when storage is unavailable. */ }
}
