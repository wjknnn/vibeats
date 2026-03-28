import { nextNoteId, type NoteData } from '@/engine'

export type RawBeatmap = {
  map: [number, number, number][]
}

export async function loadBeatmap(url: string): Promise<RawBeatmap> {
  const res = await fetch(url)
  return res.json()
}

export function parseBeatmapToNotes(raw: RawBeatmap): NoteData[] {
  return raw.map.map(([lane, time, endTime]) => ({
    id: nextNoteId(),
    lane,
    time,
    endTime,
    judged: false,
    holding: false,
    holdStartJudge: null,
    lastTickTime: 0,
  }))
}
