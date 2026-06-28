export type SongData = {
  id: number
  title: string
  artist: string
  musicUrl: string
  beatmapUrl: string
  previewStart: number
  volume: number
  offset: number
  /** 곡 BPM. 0이면 마디선 비표시 */
  bpm: number
  /** 첫 박(다운비트)의 시각(ms). 모르면 0 — 마디선 위상 보정용 */
  firstBeatMs?: number
}

export const SONGS: SongData[] = [
  {
    id: 1,
    title: 'Odo',
    artist: 'Ado',
    musicUrl: '/music/Ado - Odo.mp3',
    beatmapUrl: '/beatmap/Ado - odo (hard).json',
    previewStart: 71700,
    volume: -16,
    offset: 0,
    bpm: 128,
    firstBeatMs: 0,
  },
  {
    id: 2,
    title: 'Show ( 唱 )',
    artist: 'Ado',
    musicUrl: '/music/Ado - Show.mp3',
    beatmapUrl: '',
    previewStart: 66200,
    volume: -10,
    offset: 0,
    bpm: 0,
  },
]

export function getSongById(id: number): SongData | undefined {
  return SONGS.find((s) => s.id === id)
}
