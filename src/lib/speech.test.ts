import { afterEach, describe, expect, it } from 'vitest'
import {
  browserSpeechProvider,
  getSpeechRecognitionConstructor,
  isSpeechRecognitionSupported,
  selectVoice
} from './speech'

const originalSpeechSynthesis = window.speechSynthesis
const originalRecognition = window.SpeechRecognition
const originalWebkitRecognition = window.webkitSpeechRecognition

afterEach(() => {
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: originalSpeechSynthesis
  })
  Object.defineProperty(window, 'SpeechRecognition', {
    configurable: true,
    value: originalRecognition
  })
  Object.defineProperty(window, 'webkitSpeechRecognition', {
    configurable: true,
    value: originalWebkitRecognition
  })
})

describe('speech helpers', () => {
  it('reports unsupported synthesis when the browser API is missing', () => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: undefined
    })

    expect(browserSpeechProvider.isSupported()).toBe(false)
  })

  it('selects a preferred or friendly English voice', () => {
    const voices = [
      voice('a', 'Robot', 'en-US'),
      voice('b', 'Samantha', 'en-US'),
      voice('c', 'Ava', 'en-GB')
    ]

    expect(selectVoice(voices, 'c')?.voiceURI).toBe('c')
    expect(selectVoice(voices)?.voiceURI).toBe('b')
  })

  it('detects unsupported speech recognition', () => {
    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      value: undefined
    })
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      configurable: true,
      value: undefined
    })

    expect(getSpeechRecognitionConstructor()).toBe(null)
    expect(isSpeechRecognitionSupported()).toBe(false)
  })

  it('detects prefixed speech recognition', () => {
    class Recognition {}
    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      value: undefined
    })
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      configurable: true,
      value: Recognition
    })

    expect(getSpeechRecognitionConstructor()).toBe(Recognition)
    expect(isSpeechRecognitionSupported()).toBe(true)
  })
})

function voice(
  voiceURI: string,
  name: string,
  lang: string
): SpeechSynthesisVoice {
  return {
    voiceURI,
    name,
    lang,
    localService: true,
    default: false
  } as SpeechSynthesisVoice
}
