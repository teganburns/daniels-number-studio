import { describe, expect, it } from 'vitest'
import {
  formatDisplayNumber,
  parseNumberInput,
  sanitizeNumberInput,
  wholeNumberToWords
} from './numberWords'

function expectPhrase(input: string, phrase: string) {
  const parsed = parseNumberInput(input)
  expect(parsed.ok).toBe(true)

  if (parsed.ok) {
    expect(parsed.value.phrase).toBe(phrase)
  }
}

describe('number wording', () => {
  it('pronounces zero', () => {
    expectPhrase('0', 'zero')
  })

  it('pronounces hundreds without inserting and', () => {
    expectPhrase('105', 'one hundred five')
  })

  it('pronounces large numbers in chunks', () => {
    expectPhrase('42,105.37', 'forty-two thousand one hundred five point three seven')
  })

  it('pronounces millions and trillions', () => {
    expectPhrase('1,000,005', 'one million five')
    expect(wholeNumberToWords('999999999999999')).toContain('trillion')
  })

  it('preserves decimal zeros', () => {
    expectPhrase('100.09', 'one hundred point zero nine')
    expectPhrase('900,000.010', 'nine hundred thousand point zero one zero')
  })

  it('keeps trailing decimal zeros for display and speech synthesis', () => {
    const parsed = parseNumberInput('42,105.37000')

    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.value.display).toBe('42,105.37000')
      expect(parsed.value.phrase).toBe(
        'forty-two thousand one hundred five point three seven zero zero zero'
      )
      expect(parsed.value.speechText).toBe(
        'forty-two thousand, one hundred five, point, three, seven, zero, zero, zero'
      )
    }
  })

  it('formats and sanitizes typed input', () => {
    expect(sanitizeNumberInput(' 42,105.37 ')).toBe('42105.37')
    expect(formatDisplayNumber('42105', '37')).toBe('42,105.37')
  })

  it('rejects unsupported input', () => {
    expect(parseNumberInput('-1').ok).toBe(false)
    expect(parseNumberInput('1,000,000,000,000,000').ok).toBe(false)
    expect(parseNumberInput('1.1234567').ok).toBe(false)
    expect(parseNumberInput('12.3.4').ok).toBe(false)
  })
})
