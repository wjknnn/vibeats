import { PLAYER_WIDTH } from '@/common/general'
import { useSettingStore } from '@/store'

type PlayerProps = {
  children: React.ReactNode
}

export const Player = ({ children }: PlayerProps) => {
  const { keys } = useSettingStore()
  const laneWidth = PLAYER_WIDTH / keys

  return (
    <section
      style={{
        width: PLAYER_WIDTH,
        minWidth: PLAYER_WIDTH,
        maxWidth: PLAYER_WIDTH,
      }}
      className='flex justify-center h-dvh relative overflow-hidden'
    >
      {/* 배경 그라데이션 */}
      <div className='absolute inset-0 bg-gradient-to-b from-[#08080c] via-[#0a0a14] to-[#0c0e1a]' />

      {/* 레인 구분선 */}
      {Array.from({ length: keys + 1 }).map((_, i) => (
        <div
          key={i}
          style={{ left: i * laneWidth }}
          className='absolute top-0 h-full w-px bg-white/[0.06]'
        />
      ))}

      {/* 가운데 레인 하이라이트 */}
      {keys === 4 && (
        <>
          <div
            style={{ left: laneWidth, width: laneWidth * 2 }}
            className='absolute top-0 h-full bg-white/[0.02]'
          />
        </>
      )}

      {/* 콘텐츠 */}
      <div className='relative w-full h-full z-10'>
        {children}
      </div>

      {/* 양쪽 테두리 */}
      <div className='absolute top-0 left-0 h-full w-px bg-white/10' />
      <div className='absolute top-0 right-0 h-full w-px bg-white/10' />
    </section>
  )
}
