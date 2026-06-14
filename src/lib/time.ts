export type TimePeriod = 'AM' | 'PM'

export type TimeValue = {
  hour: number
  minute: number
  period: TimePeriod
}

export type TimeTeachingCue = {
  hourLabel: string
  minuteLabel: string
  phrase: string
  spokenText: string
}

export type TimeAngles = {
  hourAngle: number
  minuteAngle: number
}

const DAY_MINUTES = 24 * 60
const HOUR_MINUTES = 60
const HOUR_WORDS = [
  'twelve',
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
  'eleven'
]
const SMALL_WORDS = [
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
]
const TENS_WORDS: Record<number, string> = {
  20: 'twenty',
  30: 'thirty',
  40: 'forty',
  50: 'fifty'
}

export const TIME_CHALLENGES: TimeValue[] = [
  { hour: 3, minute: 45, period: 'PM' },
  { hour: 7, minute: 5, period: 'AM' },
  { hour: 12, minute: 0, period: 'PM' },
  { hour: 6, minute: 30, period: 'PM' },
  { hour: 9, minute: 15, period: 'AM' },
  { hour: 11, minute: 59, period: 'AM' },
  { hour: 1, minute: 8, period: 'PM' },
  { hour: 10, minute: 40, period: 'AM' }
]

export function createCurrentTimeValue(date = new Date()): TimeValue {
  return fromDayMinutes(date.getHours() * HOUR_MINUTES + date.getMinutes())
}

export function normalizeHour(hour: number): number {
  if (!Number.isFinite(hour)) {
    return 12
  }

  const wrapped = modulo(Math.trunc(hour), 12)
  return wrapped === 0 ? 12 : wrapped
}

export function normalizeTime(time: TimeValue): TimeValue {
  const periodOffset = time.period === 'PM' ? 12 * HOUR_MINUTES : 0
  const hourOffset = (normalizeHour(time.hour) % 12) * HOUR_MINUTES
  const minuteOffset = Number.isFinite(time.minute) ? Math.trunc(time.minute) : 0

  return fromDayMinutes(periodOffset + hourOffset + minuteOffset)
}

export function toDayMinutes(time: TimeValue): number {
  const normalized = normalizeTime(time)
  const hour24 = (normalized.hour % 12) + (normalized.period === 'PM' ? 12 : 0)

  return hour24 * HOUR_MINUTES + normalized.minute
}

export function fromDayMinutes(minutes: number): TimeValue {
  const normalizedMinutes = modulo(Math.trunc(minutes), DAY_MINUTES)
  const hour24 = Math.floor(normalizedMinutes / HOUR_MINUTES)
  const minute = normalizedMinutes % HOUR_MINUTES
  const hour = hour24 % 12 || 12

  return {
    hour,
    minute,
    period: hour24 >= 12 ? 'PM' : 'AM'
  }
}

export function addMinutes(time: TimeValue, minuteDelta: number): TimeValue {
  return fromDayMinutes(toDayMinutes(time) + minuteDelta)
}

export function addHours(time: TimeValue, hourDelta: number): TimeValue {
  return addMinutes(time, hourDelta * HOUR_MINUTES)
}

export function setPeriod(time: TimeValue, period: TimePeriod): TimeValue {
  return {
    ...normalizeTime(time),
    period
  }
}

export function setPresetMinute(time: TimeValue, minute: number): TimeValue {
  return normalizeTime({
    ...time,
    minute
  })
}

export function randomTimeValue(random = Math.random): TimeValue {
  return normalizeTime({
    hour: Math.floor(random() * 12) + 1,
    minute: Math.floor(random() * 60),
    period: random() >= 0.5 ? 'PM' : 'AM'
  })
}

export function formatTimeValue(time: TimeValue): string {
  const normalized = normalizeTime(time)
  return `${normalized.hour}:${String(normalized.minute).padStart(2, '0')} ${normalized.period}`
}

export function timeToSpeechText(time: TimeValue): string {
  const normalized = normalizeTime(time)
  const hour = HOUR_WORDS[normalized.hour % 12]
  const period = normalized.period.split('').join(' ')

  if (normalized.minute === 0) {
    return `${hour} o'clock ${period}`
  }

  if (normalized.minute < 10) {
    return `${hour} oh ${numberToWords(normalized.minute)} ${period}`
  }

  return `${hour} ${numberToWords(normalized.minute)} ${period}`
}

export function getNextTimeChallenge(completed: number): TimeValue {
  return TIME_CHALLENGES[modulo(completed, TIME_CHALLENGES.length)]
}

export function isSameTime(left: TimeValue, right: TimeValue): boolean {
  return toDayMinutes(left) === toDayMinutes(right)
}

export function getTimeTeachingCue(time: TimeValue): TimeTeachingCue {
  const normalized = normalizeTime(time)
  const minuteText = String(normalized.minute).padStart(2, '0')

  return {
    hourLabel: `${normalized.hour} (${HOUR_WORDS[normalized.hour % 12]})`,
    minuteLabel: `${minuteText} ${normalized.minute === 1 ? 'minute' : 'minutes'}`,
    phrase: getMinutePhrase(normalized.minute),
    spokenText: timeToSpeechText(normalized)
  }
}

export function timeToAngles(time: TimeValue): TimeAngles {
  const normalized = normalizeTime(time)
  return {
    hourAngle: modulo((normalized.hour % 12) * 30 + normalized.minute * 0.5, 360),
    minuteAngle: normalized.minute * 6
  }
}

export function angleToMinute(angle: number): number {
  return modulo(Math.round(normalizeAngle(angle) / 6), 60)
}

export function angleToHour(angle: number, minute: number): number {
  return normalizeHour(Math.round((normalizeAngle(angle) - minute * 0.5) / 30))
}

export function pointToClockAngle(
  x: number,
  y: number,
  centerX: number,
  centerY: number
): number {
  const radians = Math.atan2(y - centerY, x - centerX)
  return normalizeAngle((radians * 180) / Math.PI + 90)
}

function numberToWords(value: number): string {
  if (value < 20) {
    return SMALL_WORDS[value]
  }

  const tens = Math.floor(value / 10) * 10
  const ones = value % 10

  return ones === 0 ? TENS_WORDS[tens] : `${TENS_WORDS[tens]}-${SMALL_WORDS[ones]}`
}

function getMinutePhrase(minute: number): string {
  if (minute === 0) {
    return "o'clock"
  }

  if (minute === 15) {
    return 'quarter past'
  }

  if (minute === 30) {
    return 'half past'
  }

  if (minute === 45) {
    return 'quarter to'
  }

  if (minute < 30) {
    return `${numberToWords(minute)} past`
  }

  return `${numberToWords(60 - minute)} to`
}

function normalizeAngle(angle: number): number {
  return modulo(angle, 360)
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}
