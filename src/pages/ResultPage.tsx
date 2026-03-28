import { useLocation, useNavigate } from 'react-router'
import { MainContainer } from '@/components'
import { JUDGE_COLOR, type JudgeType } from '@/engine'

type ResultState = {
  accuracy: number
  maxCombo: number
  totalNotes: number
  counts: Record<JudgeType, number>
}

const RANK_COLORS: Record<string, string> = {
  'S+': 'perfect-gradient-text',
  'S': 'text-amber-300',
  'A+': 'text-emerald-400',
  'A': 'text-emerald-500',
  'B': 'text-sky-400',
  'C': 'text-orange-400',
  'D': 'text-red-400',
}

export default function ResultPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const result = location.state as ResultState | null

  if (!result) {
    return (
      <MainContainer className='flex-col'>
        <p className='text-[20px] font-bold text-white/50'>결과 없음</p>
        <button
          onClick={() => navigate('/home', { replace: true })}
          className='mt-6 px-6 py-2.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08]
            text-white/60 hover:text-white text-[14px] font-medium transition-all cursor-pointer'
        >
          홈으로
        </button>
      </MainContainer>
    )
  }

  const { accuracy, maxCombo, totalNotes, counts } = result

  const getRank = (acc: number) => {
    if (acc >= 99) return 'S+'
    if (acc >= 97) return 'S'
    if (acc >= 94) return 'A+'
    if (acc >= 90) return 'A'
    if (acc >= 85) return 'B'
    if (acc >= 80) return 'C'
    return 'D'
  }

  const rank = getRank(accuracy)

  return (
    <MainContainer className='flex-col'>
      <div className='absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(100,80,200,0.06)_0%,transparent_60%)]' />

      <div className='z-10 flex flex-col items-center animate-appearBottom'>
        {/* 랭크 */}
        <h1 className={`text-[96px] font-black leading-none ${RANK_COLORS[rank] ?? 'text-white'}`}>
          {rank}
        </h1>

        {/* 정확도 */}
        <p className='text-[40px] font-bold text-white/80 mt-2 tabular-nums'>
          {accuracy.toFixed(2)}%
        </p>

        {/* 서브 정보 */}
        <div className='flex gap-8 mt-4 text-center'>
          <div>
            <p className='text-[12px] text-white/25 font-medium tracking-wider uppercase'>Max Combo</p>
            <p className='text-[22px] font-bold text-white/60 tabular-nums'>{maxCombo}</p>
          </div>
          <div>
            <p className='text-[12px] text-white/25 font-medium tracking-wider uppercase'>Total Notes</p>
            <p className='text-[22px] font-bold text-white/60 tabular-nums'>{totalNotes}</p>
          </div>
        </div>

        {/* 판정 카운트 */}
        <div className='flex gap-5 mt-10'>
          {(['PERFECT', 'GREAT', 'GOOD', 'BAD', 'MISS'] as const).map((j) => (
            <div key={j} className='flex flex-col items-center min-w-[64px]'>
              <span className={`text-[11px] font-bold tracking-wider ${JUDGE_COLOR[j]}`}>
                {j}
              </span>
              <span className='text-[26px] font-black text-white/70 tabular-nums mt-1'>
                {counts[j]}
              </span>
            </div>
          ))}
        </div>

        {/* 버튼 */}
        <div className='flex gap-3 mt-12'>
          <button
            onClick={() => navigate('/music-list', { replace: true })}
            className='px-7 py-2.5 rounded-lg text-[14px] font-bold tracking-wider
              bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.1] hover:border-white/[0.2]
              text-white/70 hover:text-white transition-all cursor-pointer'
          >
            곡 선택
          </button>
          <button
            onClick={() => navigate('/home', { replace: true })}
            className='px-7 py-2.5 rounded-lg text-[14px] font-medium tracking-wider
              bg-transparent hover:bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.12]
              text-white/40 hover:text-white/60 transition-all cursor-pointer'
          >
            홈으로
          </button>
        </div>
      </div>
    </MainContainer>
  )
}
