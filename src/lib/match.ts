import { ParsedNumber, parseNumberInput } from './numberWords'

export type MatchResult = {
  matched: boolean
  score: number
  normalizedTranscript: string
}

const FILLER_WORDS = new Set(['and', 'uh', 'um', 'please'])
const DIGITLIKE_WORDS = new Map([
  ['oh', 'zero'],
  ['o', 'zero'],
  ['to', 'two'],
  ['too', 'two'],
  ['for', 'four'],
  ['ate', 'eight']
])

const NUMERIC_TOKEN_RE = /\d[\d,]*(?:\.\d+)?/g

export function normalizeTranscript(input: string): string {
  return input
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[.,!?;:()[\]{}]/g, ' ')
    .replace(/[-/]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => DIGITLIKE_WORDS.get(token) ?? token)
    .filter((token) => !FILLER_WORDS.has(token))
    .join(' ')
}

export function speechMatchesNumber(transcript: string, expected: ParsedNumber): MatchResult {
  const numericMatch = transcript.match(NUMERIC_TOKEN_RE)
  if (numericMatch?.some((token) => numericTokenMatches(token, expected.normalized))) {
    return {
      matched: true,
      score: 1,
      normalizedTranscript: normalizeTranscript(transcript)
    }
  }

  const normalizedTranscript = normalizeTranscript(transcript)
  const normalizedExpected = normalizeTranscript(expected.phrase)

  if (normalizedTranscript === normalizedExpected) {
    return { matched: true, score: 1, normalizedTranscript }
  }

  const expectedTokens = normalizedExpected.split(' ')
  const transcriptTokens = normalizedTranscript.split(' ')

  if (transcriptTokens.length === 0) {
    return { matched: false, score: 0, normalizedTranscript }
  }

  const coverage = orderedCoverage(expectedTokens, transcriptTokens)
  const firstMatches = transcriptTokens.includes(expectedTokens[0])
  const lastMatches = transcriptTokens.includes(expectedTokens[expectedTokens.length - 1])
  const decimalOK = decimalTokensMatch(expectedTokens, transcriptTokens)
  const threshold = expectedTokens.length <= 3 ? 0.9 : 0.78
  const matched = coverage >= threshold && firstMatches && lastMatches && decimalOK

  return { matched, score: coverage, normalizedTranscript }
}

function numericTokenMatches(token: string, expectedNormalized: string): boolean {
  const parsed = parseNumberInput(token)
  return parsed.ok && parsed.value.normalized === expectedNormalized
}

function orderedCoverage(expected: string[], actual: string[]): number {
  let actualIndex = 0
  let matched = 0

  for (const expectedToken of expected) {
    while (actualIndex < actual.length && actual[actualIndex] !== expectedToken) {
      actualIndex += 1
    }

    if (actualIndex < actual.length) {
      matched += 1
      actualIndex += 1
    }
  }

  return matched / expected.length
}

function decimalTokensMatch(expected: string[], actual: string[]): boolean {
  const pointIndex = expected.indexOf('point')
  if (pointIndex === -1) {
    return true
  }

  const expectedDecimal = expected.slice(pointIndex + 1).join(' ')
  const actualPointIndex = actual.indexOf('point')
  if (actualPointIndex === -1) {
    return false
  }

  return actual.slice(actualPointIndex + 1).join(' ').includes(expectedDecimal)
}
