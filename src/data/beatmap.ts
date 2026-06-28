// 비트맵 포맷: map = [lane, time(ms), endTime(ms)][]
// endTime === 0 이면 일반(탭) 노트, > 0 이면 롱(홀드) 노트.
// 노트 객체로의 변환은 GameEngine.loadBeatmap이 담당한다.

export type BeatmapEntry = [number, number, number]

export type RawBeatmap = {
  // 타이밍 정보(에디터로 수정·저장 가능). 없으면 SongData 값으로 폴백.
  bpm?: number
  offset?: number
  firstBeatMs?: number
  map: BeatmapEntry[]
}

export async function loadBeatmap(url: string): Promise<RawBeatmap> {
  const res = await fetch(url)
  return res.json()
}
