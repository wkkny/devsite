import { randomUUID } from "node:crypto"

import type {
  SharedSpotifyState,
  SpotifyStateStore,
  StoredSnapshot,
} from "./_spotify-shared-state.js"

const REFRESH_LOCK_MS = 30_000

let snapshot: StoredSnapshot | null = null
let cooldownUntil = 0
let lockToken: string | null = null
let lockExpiresAt = 0

export const memorySpotifyStateStore: SpotifyStateStore = {
  async read(): Promise<SharedSpotifyState> {
    return {
      snapshot: snapshot ? { ...snapshot } : null,
      cooldownUntil: cooldownUntil > Date.now() ? cooldownUntil : 0,
    }
  },

  async writeSnapshot(nextSnapshot) {
    snapshot = { ...nextSnapshot }
  },

  async extendCooldown(retryAfterSeconds) {
    const proposed = Date.now() + Math.max(1, Math.ceil(retryAfterSeconds)) * 1_000
    cooldownUntil = Math.max(cooldownUntil, proposed)
    return cooldownUntil
  },

  async acquireRefreshLock() {
    if (lockToken && lockExpiresAt > Date.now()) return null

    lockToken = randomUUID()
    lockExpiresAt = Date.now() + REFRESH_LOCK_MS
    return lockToken
  },

  async releaseRefreshLock(token) {
    if (token !== lockToken) return
    lockToken = null
    lockExpiresAt = 0
  },
}
