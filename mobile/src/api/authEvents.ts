// Bridges the API layer (which lives outside the React tree) back to the auth
// context. On a 401 the client clears the token and emits here; AuthProvider
// subscribes and flips isSignedIn, which swaps the navigator to the auth stack.
type Listener = () => void

const listeners = new Set<Listener>()

export function onUnauthorized(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function emitUnauthorized(): void {
  listeners.forEach((fn) => fn())
}
