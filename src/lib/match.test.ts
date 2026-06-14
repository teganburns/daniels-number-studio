import { describe, expect, it } from 'vitest'
import { parseNumberInput } from './numberWords'
import { normalizeTranscript, speechMatchesNumber } from './match'

function parsed(input: string) {
  const result = parseNumberInput(input)
  if (!result.ok) {
    throw new Error(result.error)
  }

  return result.value
}

describe('speech matching', () => {
  it('normalizes speech recognition filler words and punctuation', () => {
    expect(normalizeTranscript('Forty-two thousand, one hundred and five!')).toBe(
      'forty two thousand one hundred five'
    )
  })

  it('accepts the expected spoken phrase', () => {
    const result = speechMatchesNumber(
      'forty two thousand one hundred and five point three seven',
      parsed('42,105.37')
    )
    expect(result.matched).toBe(true)
  })

  it('accepts recognized digits', () => {
    expect(speechMatchesNumber('I heard 42,105.37', parsed('42,105.37')).matched).toBe(
      true
    )
  })

  it('accepts oh as zero in decimals', () => {
    expect(speechMatchesNumber('one hundred point oh nine', parsed('100.09')).matched).toBe(
      true
    )
  })

  it('requires trailing decimal zeros when they are part of the target', () => {
    expect(
      speechMatchesNumber(
        'forty two thousand one hundred five point three seven zero zero zero',
        parsed('42,105.37000')
      ).matched
    ).toBe(true)
    expect(
      speechMatchesNumber(
        'forty two thousand one hundred five point three seven',
        parsed('42,105.37000')
      ).matched
    ).toBe(false)
  })

  it('rejects a meaningfully different number', () => {
    expect(speechMatchesNumber('one hundred fifty', parsed('105')).matched).toBe(false)
    expect(speechMatchesNumber('forty two thousand nine', parsed('42,105')).matched).toBe(
      false
    )
  })
})
