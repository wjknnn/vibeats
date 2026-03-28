import { PLAYER_WIDTH, NOTE_HEIGHT } from '@/common/general'
import { useSettingStore } from '@/store'

export type NoteProps = {
  lane: number
  /** 0 = 판정선 위치, 1 = 화면 맨 위. 음수 = 판정선 아래 */
  progress: number
  height: number
}

export const Note = ({ lane, progress, height }: NoteProps) => {
  const { keys } = useSettingStore()
  const laneWidth = PLAYER_WIDTH / keys
  const judgeLine = window.innerHeight * 0.8
  const h = height || NOTE_HEIGHT

  // progress: 1(맨 위) -> 0(판정선)
  const top = judgeLine - progress * judgeLine - h

  return (
    <div
      style={{
        left: lane * laneWidth,
        width: laneWidth,
        height: h,
        top,
      }}
      className='rounded-md absolute bg-white pointer-events-none'
    />
  )
}
