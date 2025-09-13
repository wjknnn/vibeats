import { PLAYER_WIDTH } from '@/common/general'
import { useSettingStore } from '@/store'
import { Note, type NoteProps } from './Note'

type LaneProps = {
  order: number
  notes: NoteProps[]
}

export const Lane = ({
  //  order,
  notes,
}: LaneProps) => {
  const { keys } = useSettingStore()

  return (
    <div
      style={{ width: PLAYER_WIDTH / keys }}
      className='flex h-dvh bg-zinc-950 relative group'
    >
      <div className='w-0 h-full outline outline-zinc-800 absolute right-0 group-last:hidden' />
      {notes.map((note) => (
        <Note
          key={note.id}
          id={note.id}
          order={note.order}
          duration={note.duration}
          end={note.end}
          height={note.height}
        />
      ))}
    </div>
  )
}
