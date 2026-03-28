export const JUDGE_WINDOW = {
  PERFECT: 40,
  GREAT: 80,
  GOOD: 120,
  BAD: 180,
} as const

export const JUDGE_SCORE = {
  PERFECT: 100,
  GREAT: 95,
  GOOD: 90,
  BAD: 85,
  MISS: 0,
} as const

export type JudgeType = keyof typeof JUDGE_SCORE

export const JUDGE_COLOR: Record<JudgeType, string> = {
  PERFECT: 'perfect-gradient-text',
  GREAT: 'text-[#ED9CFF]',
  GOOD: 'text-[#6ACBFF]',
  BAD: 'text-[#7EFFBE]',
  MISS: 'text-[#EFEFEF]',
}

export type JudgeResult = {
  id: number
  type: JudgeType
  offset?: number
}

let judgeIdCounter = 0

export function nextJudgeId(): number {
  return ++judgeIdCounter
}

export function judge(noteTimeMs: number, inputTimeMs: number): JudgeType {
  const diff = Math.abs(noteTimeMs - inputTimeMs)
  if (diff <= JUDGE_WINDOW.PERFECT) return 'PERFECT'
  if (diff <= JUDGE_WINDOW.GREAT) return 'GREAT'
  if (diff <= JUDGE_WINDOW.GOOD) return 'GOOD'
  if (diff <= JUDGE_WINDOW.BAD) return 'BAD'
  return 'MISS'
}
