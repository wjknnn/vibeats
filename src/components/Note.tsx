type NoteProps = {
  id: string
  order: number
  duration: number
  color: string
  height: number
  end: (id: string) => void
}

export const Note = ({
  id,
  order,
  duration,
  color,
  height,
  end,
}: NoteProps) => {
  return (
    <div
      style={{
        animationDuration: `${duration}ms`,
        backgroundColor: color,
        left: order * 121,
        height,
        top: -height + 10,
      }}
      onAnimationEnd={() => end(id)}
      className='w-[120px] rounded-md animate-falling absolute'
    />
  )
}
