import { NOTE_HEIGHT, PLAYER_WIDTH } from '@/common/general'
import { NOTE_SKIN } from '@/common/skin'
import { useSettingStore, useCustomStore } from '@/store'

export type NoteProps = {
  id: string
  order: number
  duration: number
  height: number
  end: (id: string) => void
}

export const Note = ({ id, order, duration, height, end }: NoteProps) => {
  const { noteSkin } = useCustomStore()
  const { keys } = useSettingStore()

  const skin = NOTE_SKIN[noteSkin]
  const h = height ?? skin.height

  return (
    <div
      style={{
        animationDuration: `${duration}ms`,
        left: order * 121,
        height: h,
        top: -h + NOTE_HEIGHT / 2,
        width: PLAYER_WIDTH / keys,
      }}
      onAnimationEnd={() => end(id)}
      className='rounded-md animate-falling absolute bg-white'
    />
  )
}
