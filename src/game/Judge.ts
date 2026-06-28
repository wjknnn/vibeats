// 판정 윈도우/점수 — 순수 로직. 렌더러 독립적.

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

// Pixi 텍스트 색상 (0xRRGGBB)
export const JUDGE_COLOR: Record<JudgeType, number> = {
  PERFECT: 0xffe9a8,
  GREAT: 0xed9cff,
  GOOD: 0x6acbff,
  BAD: 0x7effbe,
  MISS: 0x8a8a92,
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
