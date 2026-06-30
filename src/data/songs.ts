/** 하나의 채보. (키수 × 난이도) 조합으로 식별. */
export type Chart = {
  keys: number // 4 | 5 | 6
  difficulty: string // 라벨, 예: EASY / NORMAL / HARD
  level?: number
  beatmapUrl: string
}

export type SongData = {
  id: number
  title: string
  /** 작곡가 — 한 명(string) 또는 여러 명(string[]) */
  artist: string | string[]
  musicUrl: string
  previewStart: number
  /** 프리뷰 끝(ms). 없으면 previewStart + 기본 길이 */
  previewEnd?: number
  volume: number
  offset: number
  /** 곡 BPM. 0이면 마디선 비표시 */
  bpm: number
  /** 첫 박(다운비트)의 시각(ms). 모르면 0 — 마디선 위상 보정용 */
  firstBeatMs?: number
  /** 커버 이미지 (data URL 또는 경로) */
  cover?: string
  /** 라이선스/출처 정보 텍스트 (여러 줄 가능) */
  license?: string
  /** 키수×난이도별 채보 목록 */
  charts: Chart[]
}

export const KEY_MODES = [4, 5, 6] as const

/** 난이도 5종 (낮은 → 높은 순) */
export const DIFFICULTIES = ['EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER'] as const
export type Difficulty = (typeof DIFFICULTIES)[number]
/** 난이도별 색 (CSS hex) */
export const DIFFICULTY_COLORS: Record<string, string> = {
  EASY: '#5ad17f',
  NORMAL: '#5a9fff',
  HARD: '#ffcf5a',
  EXPERT: '#ff6a8b',
  MASTER: '#b87aff',
}
export const difficultyOrder = (d: string) => {
  const i = (DIFFICULTIES as readonly string[]).indexOf(d)
  return i === -1 ? DIFFICULTIES.length : i
}

/**
 * 카탈로그 단일 소스는 public/songs.json 이다.
 * 이 배열은 앱 시작 시 initSongs()가 songs.json 내용으로 채운다(런타임 보관소).
 * 직접 곡을 추가하지 말 것 — 에디터(또는 songs.json)에서 관리한다.
 */
export const SONGS: SongData[] = []

export function getSongById(id: number): SongData | undefined {
  return SONGS.find((s) => s.id === id)
}

/** 작곡가를 표시용 문자열로 (여러 명이면 ', '로 결합) */
export function formatArtist(artist: string | string[]): string {
  return Array.isArray(artist) ? artist.join(', ') : artist
}

/** 특정 키수의 차트들 (난이도 EASY→MASTER 순) */
export function chartsForKeys(song: SongData, keys: number): Chart[] {
  return song.charts
    .filter((c) => c.keys === keys)
    .sort((a, b) => difficultyOrder(a.difficulty) - difficultyOrder(b.difficulty) || (a.level ?? 0) - (b.level ?? 0))
}

export function getChart(song: SongData, keys: number, difficulty: string): Chart | undefined {
  return song.charts.find((c) => c.keys === keys && c.difficulty === difficulty)
}

/** 앱 시작 시 1회: songs.json이 있으면 카탈로그를 그것으로 교체(없으면 위 시드 유지). */
export async function initSongs(): Promise<void> {
  try {
    const res = await fetch('/songs.json', { cache: 'no-store' })
    if (!res.ok) return
    const data = await res.json()
    if (Array.isArray(data) && data.length) SONGS.splice(0, SONGS.length, ...data)
  } catch {
    /* 시드 유지 */
  }
}

/** dev: 현재 카탈로그를 songs.json 파일에 저장. */
export async function saveSongs(): Promise<boolean> {
  if (!import.meta.env.DEV) return false
  try {
    const res = await fetch('/__save-beatmap', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ file: 'songs.json', data: SONGS }),
    })
    return res.ok
  } catch {
    return false
  }
}
