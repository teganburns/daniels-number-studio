import { describe, expect, it } from 'vitest'
import {
  TIME_CHALLENGES,
  addHours,
  addMinutes,
  angleToHour,
  angleToMinute,
  createCurrentTimeValue,
  formatTimeValue,
  fromDayMinutes,
  getNextTimeChallenge,
  getTimeTeachingCue,
  isSameTime,
  normalizeHour,
  normalizeTime,
  pointToClockAngle,
  randomTimeValue,
  setPeriod,
  setPresetMinute,
  timeToAngles,
  timeToSpeechText,
  toDayMinutes
} from './time'

describe('time helpers', () => {
  it('normalizes 12-hour times and wraps minutes through AM and PM', () => {
    expect(normalizeHour(0)).toBe(12)
    expect(normalizeHour(13)).toBe(1)
    expect(formatTimeValue(normalizeTime({ hour: 12, minute: 75, period: 'PM' }))).toBe(
      '1:15 PM'
    )
    expect(formatTimeValue(addMinutes({ hour: 11, minute: 59, period: 'PM' }, 1))).toBe(
      '12:00 AM'
    )
    expect(formatTimeValue(addHours({ hour: 12, minute: 30, period: 'AM' }, -1))).toBe(
      '11:30 PM'
    )
  })

  it('converts between day minutes and display time', () => {
    expect(fromDayMinutes(0)).toEqual({ hour: 12, minute: 0, period: 'AM' })
    expect(fromDayMinutes(12 * 60)).toEqual({ hour: 12, minute: 0, period: 'PM' })
    expect(toDayMinutes({ hour: 3, minute: 45, period: 'PM' })).toBe(945)
  })

  it('formats speech for clock times', () => {
    expect(timeToSpeechText({ hour: 3, minute: 45, period: 'PM' })).toBe(
      'three forty-five P M'
    )
    expect(timeToSpeechText({ hour: 7, minute: 5, period: 'AM' })).toBe(
      'seven oh five A M'
    )
    expect(timeToSpeechText({ hour: 12, minute: 0, period: 'PM' })).toBe(
      "twelve o'clock P M"
    )
  })

  it('supports period and preset changes', () => {
    expect(setPeriod({ hour: 6, minute: 15, period: 'AM' }, 'PM')).toEqual({
      hour: 6,
      minute: 15,
      period: 'PM'
    })
    expect(setPresetMinute({ hour: 6, minute: 15, period: 'AM' }, 45)).toEqual({
      hour: 6,
      minute: 45,
      period: 'AM'
    })
  })

  it('creates deterministic utility times', () => {
    expect(createCurrentTimeValue(new Date('2026-06-14T15:45:00'))).toEqual({
      hour: 3,
      minute: 45,
      period: 'PM'
    })
    expect(randomTimeValue(() => 0)).toEqual({ hour: 1, minute: 0, period: 'AM' })
  })

  it('builds teaching cues for landmark and between-landmark minutes', () => {
    expect(getTimeTeachingCue({ hour: 12, minute: 0, period: 'PM' })).toMatchObject({
      hourLabel: '12 (twelve)',
      minuteLabel: '00 minutes',
      phrase: "o'clock",
      spokenText: "twelve o'clock P M"
    })
    expect(getTimeTeachingCue({ hour: 6, minute: 15, period: 'AM' }).phrase).toBe(
      'quarter past'
    )
    expect(getTimeTeachingCue({ hour: 8, minute: 40, period: 'PM' }).phrase).toBe(
      'twenty to'
    )
  })

  it('converts analog angles to exact clock values', () => {
    expect(timeToAngles({ hour: 3, minute: 30, period: 'PM' })).toEqual({
      hourAngle: 105,
      minuteAngle: 180
    })
    expect(angleToMinute(180)).toBe(30)
    expect(angleToHour(105, 30)).toBe(3)
    expect(pointToClockAngle(180, 40, 180, 180)).toBe(0)
    expect(pointToClockAngle(320, 180, 180, 180)).toBe(90)
  })

  it('generates deterministic time challenges and matches full 12-hour values', () => {
    expect(getNextTimeChallenge(0)).toEqual({ hour: 3, minute: 45, period: 'PM' })
    expect(getNextTimeChallenge(TIME_CHALLENGES.length)).toEqual(TIME_CHALLENGES[0])
    expect(
      isSameTime(
        { hour: 3, minute: 45, period: 'PM' },
        { hour: 3, minute: 45, period: 'PM' }
      )
    ).toBe(true)
    expect(
      isSameTime(
        { hour: 3, minute: 45, period: 'PM' },
        { hour: 3, minute: 45, period: 'AM' }
      )
    ).toBe(false)
  })
})
