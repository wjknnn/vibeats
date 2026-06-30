// 게임플레이 레이아웃/튜닝 상수 — 렌더러와 로직이 공유한다.

/** 기본 키 수 */
export const DEFAULT_KEYS = 4

/** 플레이필드(노트가 떨어지는 영역) 가로 폭 px */
export const PLAYER_WIDTH = 480

/** 일반 노트 높이 px */
export const NOTE_HEIGHT = 32

/** 판정선 위치 — 화면 높이 대비 비율(위에서부터). 0.82 = 아래쪽 */
export const JUDGE_LINE_RATIO = 0.82

/**
 * 키 매핑 (4/5/6키). 레인마다 여러 키 허용.
 * 5키 가운데(레인 2)는 f/j 둘 다 받는다.
 */
export const KEY_BINDINGS: Record<number, string[][]> = {
  4: [['d'], ['f'], ['j'], ['k']],
  5: [['s'], ['d'], ['f', 'j'], ['k'], ['l']],
  6: [['s'], ['d'], ['f'], ['j'], ['k'], ['l']],
}

/** 눌린 키가 어느 레인인지. 없으면 -1. */
export function laneForKey(keys: number, key: string): number {
  const binding = KEY_BINDINGS[keys] ?? KEY_BINDINGS[4]
  return binding.findIndex((laneKeys) => laneKeys.includes(key))
}

/**
 * 노트가 화면 위에서 판정선까지 도달하는 데 걸리는 시간(ms).
 * speed가 높을수록 짧다 = 노트가 빨리 떨어진다.
 */
export function calcApproachTime(speed: number): number {
  return 6000 / Math.pow(1.6, speed - 1)
}

type LaneColor = { note: number; head: number; glow: number }

// 4키 기준 레인 색상 (외곽=보라, 안쪽=파랑). Pixi는 0xRRGGBB 숫자 사용.
const LANE_COLORS_4: LaneColor[] = [
  { note: 0xc8a2ff, head: 0xb87aff, glow: 0xb48cff },
  { note: 0x7ab8ff, head: 0x5a9fff, glow: 0x64aaff },
  { note: 0x7ab8ff, head: 0x5a9fff, glow: 0x64aaff },
  { note: 0xc8a2ff, head: 0xb87aff, glow: 0xb48cff },
]

const DEFAULT_LANE_COLOR: LaneColor = { note: 0xc8a2ff, head: 0xb87aff, glow: 0xb48cff }

export function getLaneColor(lane: number, keys: number): LaneColor {
  if (keys === 4) return LANE_COLORS_4[lane] ?? DEFAULT_LANE_COLOR
  return DEFAULT_LANE_COLOR
}
