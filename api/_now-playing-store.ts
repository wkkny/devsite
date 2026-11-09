import {
  createUpstashNowPlayingStateStore,
  hasNowPlayingSharedStateConfiguration,
  requiresNowPlayingSharedState,
  type NowPlayingStateStore,
} from "./_now-playing-shared-state.js"
import { memoryNowPlayingStateStore } from "./_now-playing-memory-state.js"

let storeInitialized = false
let stateStore: NowPlayingStateStore | null = null

export function getNowPlayingStateStore(): NowPlayingStateStore | null {
  if (storeInitialized) return stateStore
  storeInitialized = true

  if (hasNowPlayingSharedStateConfiguration()) {
    stateStore = createUpstashNowPlayingStateStore()
  } else if (!requiresNowPlayingSharedState()) {
    stateStore = memoryNowPlayingStateStore
  }

  return stateStore
}
