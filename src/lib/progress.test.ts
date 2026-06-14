import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PROGRESS,
  loadProgress,
  recordListenWin,
  saveProgress,
  updateSpeechSettings
} from './progress'

describe('progress persistence', () => {
  it('saves and restores progress with speech settings', () => {
    const storage = new MemoryStorage()
    const updated = updateSpeechSettings(recordListenWin(DEFAULT_PROGRESS, 'decimals'), {
      voiceURI: 'voice-a',
      rate: 0.78,
      pitch: 1.12
    })

    saveProgress(updated, storage)
    expect(loadProgress(storage)).toMatchObject({
      completed: { decimals: 1 },
      listenWins: 1,
      settings: {
        voiceURI: 'voice-a',
        rate: 0.78,
        pitch: 1.12
      }
    })
  })
})

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}
