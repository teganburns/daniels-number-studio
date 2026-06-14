export type MoneyDenominationId =
  | 'bill-1'
  | 'bill-5'
  | 'bill-10'
  | 'bill-20'
  | 'coin-nickel'
  | 'coin-dime'
  | 'coin-quarter'

export type MoneyKind = 'bill' | 'coin'

export type MoneyDenomination = {
  id: MoneyDenominationId
  kind: MoneyKind
  label: string
  display: string
  valueCents: number
  assetSrc: string
}

export type MoneyPiece = {
  denominationId: MoneyDenominationId
}

export const MONEY_DENOMINATIONS: MoneyDenomination[] = [
  {
    id: 'bill-1',
    kind: 'bill',
    label: 'One dollar',
    display: '$1',
    valueCents: 100,
    assetSrc: '/money-assets/us-one-dollar-front.jpg'
  },
  {
    id: 'bill-5',
    kind: 'bill',
    label: 'Five dollars',
    display: '$5',
    valueCents: 500,
    assetSrc: '/money-assets/us-five-dollar-front.jpg'
  },
  {
    id: 'bill-10',
    kind: 'bill',
    label: 'Ten dollars',
    display: '$10',
    valueCents: 1000,
    assetSrc: '/money-assets/us-ten-dollar-front.jpg'
  },
  {
    id: 'bill-20',
    kind: 'bill',
    label: 'Twenty dollars',
    display: '$20',
    valueCents: 2000,
    assetSrc: '/money-assets/us-twenty-dollar-front.jpg'
  },
  {
    id: 'coin-nickel',
    kind: 'coin',
    label: 'Nickel',
    display: '5¢',
    valueCents: 5,
    assetSrc: '/money-assets/us-nickel-obverse.jpg'
  },
  {
    id: 'coin-dime',
    kind: 'coin',
    label: 'Dime',
    display: '10¢',
    valueCents: 10,
    assetSrc: '/money-assets/us-dime-obverse.png'
  },
  {
    id: 'coin-quarter',
    kind: 'coin',
    label: 'Quarter',
    display: '25¢',
    valueCents: 25,
    assetSrc: '/money-assets/us-quarter-obverse.png'
  }
]

const DENOMINATIONS_BY_ID = new Map(
  MONEY_DENOMINATIONS.map((denomination) => [denomination.id, denomination])
)

export function getMoneyDenomination(id: MoneyDenominationId): MoneyDenomination {
  const denomination = DENOMINATIONS_BY_ID.get(id)
  if (!denomination) {
    throw new Error(`Unknown money denomination: ${id}`)
  }

  return denomination
}

export function isMoneyDenominationId(id: string): id is MoneyDenominationId {
  return DENOMINATIONS_BY_ID.has(id as MoneyDenominationId)
}

export function totalMoneyPieces(pieces: readonly MoneyPiece[]): number {
  return pieces.reduce(
    (total, piece) => total + getMoneyDenomination(piece.denominationId).valueCents,
    0
  )
}

export function formatMoneyTotal(cents: number): string {
  const normalizedCents = Math.max(0, Math.trunc(cents))
  const dollars = Math.floor(normalizedCents / 100)
  const remainder = normalizedCents % 100

  return `$${dollars}.${String(remainder).padStart(2, '0')}`
}
