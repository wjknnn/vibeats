import { PLAYER_WIDTH } from '@/common/general'

type PlayerProps = {
  children: React.ReactNode
}

export const Player = ({ children }: PlayerProps) => {
  return (
    <section
      style={{
        width: PLAYER_WIDTH,
        minWidth: PLAYER_WIDTH,
        maxWidth: PLAYER_WIDTH,
      }}
      className='flex justify-center h-dvh bg-zinc-950 relative outline outline-zinc-800'
    >
      {children}
    </section>
  )
}
