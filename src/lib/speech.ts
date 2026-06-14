export type SpeechSettings = {
  voiceURI?: string
  rate: number
  pitch: number
}

export type SpeakOptions = {
  text: string
  settings: SpeechSettings
}

export type NumberAudioProvider = {
  isSupported: () => boolean
  getVoices: () => SpeechSynthesisVoice[]
  speak: (options: SpeakOptions) => Promise<void>
  cancel: () => void
}

export const DEFAULT_SPEECH_SETTINGS: SpeechSettings = {
  rate: 0.86,
  pitch: 1.05
}

export const browserSpeechProvider: NumberAudioProvider = {
  isSupported() {
    return typeof window !== 'undefined' && window.speechSynthesis !== undefined
  },
  getVoices() {
    if (!this.isSupported()) {
      return []
    }

    return window.speechSynthesis
      .getVoices()
      .filter((voice) => voice.lang.toLowerCase().startsWith('en'))
  },
  cancel() {
    if (this.isSupported()) {
      window.speechSynthesis.cancel()
    }
  },
  speak({ text, settings }) {
    if (!this.isSupported()) {
      return Promise.reject(new Error('Speech synthesis is not available.'))
    }

    window.speechSynthesis.cancel()

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'en-US'
      utterance.rate = settings.rate
      utterance.pitch = settings.pitch
      utterance.voice = selectVoice(this.getVoices(), settings.voiceURI)
      utterance.onend = () => resolve()
      utterance.onerror = () => reject(new Error('Speech playback failed.'))
      window.speechSynthesis.speak(utterance)
    })
  }
}

export function selectVoice(
  voices: SpeechSynthesisVoice[],
  preferredVoiceURI?: string
): SpeechSynthesisVoice | null {
  if (voices.length === 0) {
    return null
  }

  const preferred = voices.find((voice) => voice.voiceURI === preferredVoiceURI)
  if (preferred) {
    return preferred
  }

  const friendlyNames = ['samantha', 'google us english', 'ava', 'allison', 'joanna']
  const englishUS = voices.filter((voice) => voice.lang.toLowerCase().startsWith('en-us'))
  const friendly = englishUS.find((voice) =>
    friendlyNames.some((name) => voice.name.toLowerCase().includes(name))
  )

  return friendly ?? englishUS[0] ?? voices[0] ?? null
}

export function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') {
    return null
  }

  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null
}
