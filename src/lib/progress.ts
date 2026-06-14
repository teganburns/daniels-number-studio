import { DEFAULT_SPEECH_SETTINGS, SpeechSettings } from './speech'

const STORAGE_KEY = 'daniels-number-studio-progress'
const STORAGE_VERSION = 1

export type ProgressState = {
  version: number
  completed: Record<string, number>
  listenWins: number
  speakWins: number
  streak: number
  lastPracticedISO?: string
  settings: SpeechSettings
}

export const DEFAULT_PROGRESS: ProgressState = {
  version: STORAGE_VERSION,
  completed: {},
  listenWins: 0,
  speakWins: 0,
  streak: 0,
  settings: DEFAULT_SPEECH_SETTINGS
}

export function loadProgress(storage: Storage | undefined = getLocalStorage()): ProgressState {
  if (!storage) {
    return DEFAULT_PROGRESS
  }

  const raw = storage.getItem(STORAGE_KEY)
  if (!raw) {
    return DEFAULT_PROGRESS
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ProgressState>
    if (parsed.version !== STORAGE_VERSION) {
      return DEFAULT_PROGRESS
    }

    return {
      ...DEFAULT_PROGRESS,
      ...parsed,
      settings: {
        ...DEFAULT_SPEECH_SETTINGS,
        ...parsed.settings
      }
    }
  } catch {
    return DEFAULT_PROGRESS
  }
}

export function saveProgress(
  progress: ProgressState,
  storage: Storage | undefined = getLocalStorage()
): void {
  storage?.setItem(STORAGE_KEY, JSON.stringify(progress))
}

export function recordLevelWin(progress: ProgressState, levelId: string): ProgressState {
  const today = new Date().toISOString().slice(0, 10)
  const continuedStreak = progress.lastPracticedISO === today

  return {
    ...progress,
    completed: {
      ...progress.completed,
      [levelId]: (progress.completed[levelId] ?? 0) + 1
    },
    streak: continuedStreak ? progress.streak : progress.streak + 1,
    lastPracticedISO: today
  }
}

export function recordListenWin(progress: ProgressState, levelId: string): ProgressState {
  return {
    ...recordLevelWin(progress, levelId),
    listenWins: progress.listenWins + 1
  }
}

export function recordSpeakWin(progress: ProgressState): ProgressState {
  const today = new Date().toISOString().slice(0, 10)
  const continuedStreak = progress.lastPracticedISO === today

  return {
    ...progress,
    speakWins: progress.speakWins + 1,
    streak: continuedStreak ? progress.streak : progress.streak + 1,
    lastPracticedISO: today
  }
}

export function updateSpeechSettings(
  progress: ProgressState,
  settings: SpeechSettings
): ProgressState {
  return {
    ...progress,
    settings
  }
}

function getLocalStorage(): Storage | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }

  return window.localStorage
}
