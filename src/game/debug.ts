export function isGameDebugEnabled(): boolean {
  return import.meta.env.VITE_DEBUG === '1'
}
