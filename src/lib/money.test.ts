import { describe, expect, it } from 'vitest'
import {
  MONEY_DENOMINATIONS,
  formatMoneyTotal,
  getMoneyDenomination,
  isMoneyDenominationId,
  totalMoneyPieces
} from './money'

describe('money helpers', () => {
  it('includes bills and countable coins without pennies, half dollars, or dollar coins', () => {
    expect(MONEY_DENOMINATIONS.map((denomination) => denomination.id)).toEqual([
      'bill-1',
      'bill-5',
      'bill-10',
      'bill-20',
      'coin-nickel',
      'coin-dime',
      'coin-quarter'
    ])
    expect(MONEY_DENOMINATIONS.map((denomination) => denomination.label)).not.toContain('Penny')
    expect(MONEY_DENOMINATIONS.map((denomination) => denomination.label)).not.toContain(
      'Half dollar'
    )
    expect(MONEY_DENOMINATIONS.map((denomination) => denomination.label)).not.toContain(
      'Dollar coin'
    )
  })

  it('totals placed money in cents', () => {
    expect(
      totalMoneyPieces([
        { denominationId: 'bill-5' },
        { denominationId: 'coin-quarter' },
        { denominationId: 'coin-dime' },
        { denominationId: 'coin-nickel' }
      ])
    ).toBe(540)
  })

  it('provides local image asset paths for each denomination', () => {
    const assetPaths = MONEY_DENOMINATIONS.map((denomination) => denomination.assetSrc)

    expect(assetPaths.every((assetPath) => assetPath.startsWith('/money-assets/'))).toBe(true)
    expect(new Set(assetPaths).size).toBe(MONEY_DENOMINATIONS.length)
    expect(getMoneyDenomination('coin-quarter').assetSrc).toBe(
      '/money-assets/us-quarter-obverse.png'
    )
  })

  it('formats money totals as dollars and cents', () => {
    expect(formatMoneyTotal(0)).toBe('$0.00')
    expect(formatMoneyTotal(5)).toBe('$0.05')
    expect(formatMoneyTotal(540)).toBe('$5.40')
    expect(formatMoneyTotal(2115)).toBe('$21.15')
  })

  it('throws for unknown denominations', () => {
    expect(() => getMoneyDenomination('coin-penny' as never)).toThrow(
      'Unknown money denomination'
    )
  })

  it('checks known denomination ids for drag and drop data', () => {
    expect(isMoneyDenominationId('bill-20')).toBe(true)
    expect(isMoneyDenominationId('coin-penny')).toBe(false)
  })
})
