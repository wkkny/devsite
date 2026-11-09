import {
  createUpstashSpotifyStateStore,
  hasSpotifySharedStateConfiguration,
  requiresSpotifySharedState,
  type SpotifyStateStore,
} from "./_spotify-shared-state.js"
import { memorySpotifyStateStore } from "./_spotify-memory-state.js"

let storeInitialized = false
let stateStore: SpotifyStateStore | null = null

export function getSpotifyStateStore(): SpotifyStateStore | null {
  if (storeInitialized) return stateStore
  storeInitialized = true

  if (hasSpotifySharedStateConfiguration()) {
    stateStore = createUpstashSpotifyStateStore()
  } else if (!requiresSpotifySharedState()) {
    stateStore = memorySpotifyStateStore
  }

  return stateStore
}
