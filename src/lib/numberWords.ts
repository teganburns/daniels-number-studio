export type PronunciationChunk = {
  id: string
  label: string
  words: string
  kind: 'whole' | 'decimal'
}

export type ParsedNumber = {
  raw: string
  normalized: string
  display: string
  wholeDigits: string
  decimalDigits: string
  chunks: PronunciationChunk[]
  phrase: string
  speechText: string
}

export type ParseNumberResult =
  | { ok: true; value: ParsedNumber }
  | { ok: false; error: string }

export const MAX_WHOLE_DIGITS = 15
export const MAX_DECIMAL_DIGITS = 6

const SMALL = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen'
] as const

const TENS = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety'
] as const

const SCALES = ['', 'thousand', 'million', 'billion', 'trillion'] as const

const DIGIT_WORDS = SMALL.slice(0, 10)

export function sanitizeNumberInput(input: string): string {
  return input.trim().replace(/[,_\s]/g, '')
}

export function parseNumberInput(input: string): ParseNumberResult {
  const cleaned = sanitizeNumberInput(input)

  if (cleaned.length === 0) {
    return { ok: false, error: 'Enter a number to practice.' }
  }

  if (cleaned.startsWith('-') || cleaned.includes('+')) {
    return { ok: false, error: 'Negative numbers are for a later lesson.' }
  }

  if (!/^\d*\.?\d*$/.test(cleaned)) {
    return { ok: false, error: 'Use digits, commas, and one decimal point.' }
  }

  if ((cleaned.match(/\./g) ?? []).length > 1) {
    return { ok: false, error: 'Use only one decimal point.' }
  }

  const [wholePart = '', decimalPart] = cleaned.split('.')
  const wholeDigits = stripLeadingZeros(wholePart.length > 0 ? wholePart : '0')

  if (wholeDigits.length > MAX_WHOLE_DIGITS) {
    return {
      ok: false,
      error: 'Use numbers up to the trillions for this version.'
    }
  }

  if (decimalPart !== undefined && decimalPart.length > MAX_DECIMAL_DIGITS) {
    return {
      ok: false,
      error: `Use up to ${MAX_DECIMAL_DIGITS} decimal places.`
    }
  }

  if (wholeDigits === '0' && decimalPart !== undefined && decimalPart.length === 0) {
    return { ok: false, error: 'Add digits after the decimal point.' }
  }

  const chunks = buildChunks(wholeDigits, decimalPart ?? '')
  const phrase = chunks.map((chunk) => chunk.words).join(' ')
  const speechText = buildSpeechText(chunks)
  const normalized =
    decimalPart !== undefined
      ? `${wholeDigits}.${decimalPart}`
      : wholeDigits

  return {
    ok: true,
    value: {
      raw: input,
      normalized,
      display: formatDisplayNumber(wholeDigits, decimalPart),
      wholeDigits,
      decimalDigits: decimalPart ?? '',
      chunks,
      phrase,
      speechText
    }
  }
}

export function formatDisplayNumber(wholeDigits: string, decimalDigits?: string): string {
  const whole = stripLeadingZeros(wholeDigits)
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return decimalDigits !== undefined ? `${grouped}.${decimalDigits}` : grouped
}

export function wholeNumberToWords(wholeDigits: string): string {
  const whole = stripLeadingZeros(wholeDigits)
  if (whole === '0') {
    return 'zero'
  }

  return wholeNumberChunks(whole)
    .map((chunk) => chunk.words)
    .join(' ')
}

export function decimalDigitsToWords(decimalDigits: string): string {
  return decimalDigits
    .split('')
    .map((digit) => DIGIT_WORDS[Number(digit)])
    .join(' ')
}

function buildChunks(wholeDigits: string, decimalDigits: string): PronunciationChunk[] {
  const wholeChunks = wholeNumberChunks(wholeDigits)

  if (decimalDigits.length === 0) {
    return wholeChunks
  }

  return [
    ...wholeChunks,
    {
      id: 'decimal',
      label: String(wholeChunks.length + 1),
      words: `point ${decimalDigitsToWords(decimalDigits)}`,
      kind: 'decimal'
    }
  ]
}

function buildSpeechText(chunks: PronunciationChunk[]): string {
  return chunks
    .map((chunk) => {
      if (chunk.kind !== 'decimal') {
        return chunk.words
      }

      return chunk.words.split(' ').join(', ')
    })
    .join(', ')
}

function wholeNumberChunks(wholeDigits: string): PronunciationChunk[] {
  const whole = stripLeadingZeros(wholeDigits)

  if (whole === '0') {
    return [{ id: 'whole-0', label: '1', words: 'zero', kind: 'whole' }]
  }

  const padded = whole.padStart(Math.ceil(whole.length / 3) * 3, '0')
  const groups = padded.match(/\d{3}/g) ?? []
  const nonZeroGroups: PronunciationChunk[] = []

  groups.forEach((group, index) => {
    const value = Number(group)
    if (value === 0) {
      return
    }

    const scaleIndex = groups.length - index - 1
    const scale = SCALES[scaleIndex]
    const words = [underThousandToWords(value), scale].filter(Boolean).join(' ')

    nonZeroGroups.push({
      id: `whole-${scale || 'ones'}`,
      label: String(nonZeroGroups.length + 1),
      words,
      kind: 'whole'
    })
  })

  return nonZeroGroups
}

function underThousandToWords(value: number): string {
  const words: string[] = []
  const hundreds = Math.floor(value / 100)
  const remainder = value % 100

  if (hundreds > 0) {
    words.push(SMALL[hundreds], 'hundred')
  }

  if (remainder > 0) {
    words.push(underHundredToWords(remainder))
  }

  return words.join(' ')
}

function underHundredToWords(value: number): string {
  if (value < 20) {
    return SMALL[value]
  }

  const ten = Math.floor(value / 10)
  const one = value % 10
  return one === 0 ? TENS[ten] : `${TENS[ten]}-${SMALL[one]}`
}

function stripLeadingZeros(value: string): string {
  const stripped = value.replace(/^0+(?=\d)/, '')
  return stripped.length === 0 ? '0' : stripped
}
