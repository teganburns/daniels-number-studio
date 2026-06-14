export type PracticeLevel = {
  id: string
  title: string
  subtitle: string
  level: string
  accent: 'teal' | 'yellow' | 'green' | 'blue' | 'coral'
  samples: string[]
}

export const PRACTICE_LEVELS: PracticeLevel[] = [
  {
    id: 'hundreds',
    title: 'Hundreds',
    subtitle: 'Build place value',
    level: 'Level 1',
    accent: 'teal',
    samples: ['105', '318', '404', '719', '990', '1,006', '3,240', '9,875']
  },
  {
    id: 'thousands',
    title: 'Thousands',
    subtitle: 'Chunk big numbers',
    level: 'Level 2',
    accent: 'yellow',
    samples: ['4,205', '12,030', '42,105', '91,004', '650,218', '999,999']
  },
  {
    id: 'millions',
    title: 'Millions',
    subtitle: 'Say long groups',
    level: 'Level 3',
    accent: 'green',
    samples: ['1,000,005', '3,420,105', '18,250,004', '700,001,900', '9,876,543,210']
  },
  {
    id: 'decimals',
    title: 'Decimals',
    subtitle: 'Point by point',
    level: 'Level 2',
    accent: 'blue',
    samples: ['0.25', '8.04', '42,105.37', '100.09', '5,001.607', '900,000.010']
  },
  {
    id: 'mixed',
    title: 'Mixed Review',
    subtitle: 'Everything together',
    level: 'Level 2',
    accent: 'coral',
    samples: ['105', '42,105.37', '2,000,006', '13.50', '800,040,002', '72,000,000,001']
  }
]

export function getNextSample(level: PracticeLevel, completedCount: number): string {
  return level.samples[completedCount % level.samples.length]
}
