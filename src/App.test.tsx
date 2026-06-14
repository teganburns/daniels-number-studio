import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'

describe('App navigation', () => {
  beforeEach(() => {
    window.localStorage.clear()
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

    fireEvent.click(screen.getByRole('button', { name: 'Progress' }))
    expect(screen.getByRole('heading', { name: 'Progress', level: 1 })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByRole('heading', { name: 'Settings', level: 1 })).toBeInTheDocument()
  })
})
