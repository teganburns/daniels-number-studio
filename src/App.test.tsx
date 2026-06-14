import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const originalSpeechSynthesis = window.speechSynthesis

function createDataTransfer() {
  const values = new Map<string, string>()

  return {
    dropEffect: 'none',
    effectAllowed: 'all',
    getData: vi.fn((format: string) => values.get(format) ?? ''),
    setData: vi.fn((format: string, value: string) => {
      values.set(format, value)
    })
  } as unknown as DataTransfer
}

describe('App navigation', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-14T15:45:00'))
  })

  afterEach(() => {
    cleanup()
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: originalSpeechSynthesis
    })
    vi.unstubAllGlobals()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('changes the central workspace when side navigation changes', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'Number Explorer', level: 1 })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Listen' }))
    expect(
      screen.getByRole('heading', { name: 'Listening Challenge', level: 1 })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Speak' }))
    expect(
      screen.getByRole('heading', { name: 'Speaking Challenge', level: 1 })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Time' }))
    expect(screen.getByRole('heading', { name: 'Time Studio', level: 1 })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Money' }))
    expect(screen.getByRole('heading', { name: 'Money Count', level: 1 })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Progress' }))
    expect(screen.getByRole('heading', { name: 'Progress', level: 1 })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByRole('heading', { name: 'Settings', level: 1 })).toBeInTheDocument()
  })

  it('updates the digital and analog clocks with shared controls', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Time' }))
    fireEvent.click(screen.getByRole('button', { name: 'Increase minute' }))

    expect(screen.getByRole('slider', { name: 'Digital minute' })).toHaveAttribute(
      'aria-valuenow',
      '46'
    )
    expect(screen.getByRole('slider', { name: 'Analog minute hand' })).toHaveAttribute(
      'aria-valuenow',
      '46'
    )

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Analog minute hand' }), {
      key: 'ArrowRight'
    })
    expect(screen.getByRole('slider', { name: 'Digital minute' })).toHaveAttribute(
      'aria-valuenow',
      '47'
    )

    fireEvent.click(screen.getByRole('button', { name: "Set O'clock" }))
    expect(screen.getByRole('slider', { name: 'Digital minute' })).toHaveAttribute(
      'aria-valuenow',
      '0'
    )

    fireEvent.click(screen.getByRole('button', { name: 'AM' }))
    expect(screen.getByLabelText('Selected time 3:00 AM')).toBeInTheDocument()
  })

  it('speaks the selected time with browser text-to-speech', () => {
    const speak = vi.fn()
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        cancel: vi.fn(),
        getVoices: vi.fn(() => []),
        speak
      }
    })
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class MockSpeechSynthesisUtterance {
        lang = ''
        rate = 1
        pitch = 1
        voice: SpeechSynthesisVoice | null = null
        onend?: () => void
        onerror?: () => void

        constructor(public text: string) {}
      }
    )

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Time' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hear Time' }))

    expect(speak).toHaveBeenCalled()
    expect(speak.mock.calls[0][0].text).toBe('three forty-five P M')
  })

  it('records time practice progress when Daniel matches the target', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Time' }))
    fireEvent.click(screen.getByRole('button', { name: 'Check my time' }))

    expect(screen.getAllByText('That matches.')).not.toHaveLength(0)
    expect(window.localStorage.getItem('daniels-number-studio-progress')).toContain(
      '"timeWins":1'
    )
  })

  it('counts money pieces in free play without changing saved progress', () => {
    const { container } = render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Money' }))
    expect(
      container.querySelector('img[src="/money-assets/us-one-dollar-front.jpg"]')
    ).toBeInTheDocument()
    expect(
      container.querySelector('img[src="/money-assets/us-quarter-obverse.png"]')
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add One dollar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add Quarter' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add Dime' }))

    expect(screen.getAllByText('$1.35')).not.toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Remove Quarter' }))
    expect(screen.getAllByText('$1.10')).not.toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Clear tray' }))
    expect(screen.getAllByText('$0.00')).not.toHaveLength(0)
    expect(window.localStorage.getItem('daniels-number-studio-progress')).not.toContain(
      'money'
    )
  })

  it('removes one placed money piece when it is dragged out of the tray', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Money' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add Nickel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add Dime' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add Quarter' }))

    expect(screen.getAllByText('$0.40')).not.toHaveLength(0)

    const placedDime = screen.getByRole('button', { name: 'Remove Dime' })
    const moneyBank = screen.getByRole('region', { name: 'Money Pieces' })
    const dataTransfer = createDataTransfer()

    fireEvent.dragStart(placedDime, { dataTransfer })
    fireEvent.dragOver(moneyBank, { dataTransfer })
    fireEvent.drop(moneyBank, { dataTransfer })

    expect(screen.getAllByText('$0.30')).not.toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'Remove Dime' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Nickel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Quarter' })).toBeInTheDocument()
  })

  it('drops money pieces into the tray', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Money' }))

    const fiveDollarBill = screen.getByRole('button', { name: 'Add Five dollars' })
    const tray = screen.getByRole('region', { name: 'Counting tray' })
    const dataTransfer = createDataTransfer()

    fireEvent.dragStart(fiveDollarBill, { dataTransfer })
    fireEvent.dragOver(tray, { dataTransfer })
    fireEvent.drop(tray, { dataTransfer })

    expect(screen.getAllByText('$5.00')).not.toHaveLength(0)
  })
})
