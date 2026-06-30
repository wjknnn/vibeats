import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Game } from '@/game'
import { useSettingStore, useCommonStore } from '@/store'
import { getSongById } from '@/data/songs'

/**
 * 게임 화면. React는 캔버스 컨테이너만 마운트하고 Pixi `Game` 인스턴스를
 * 생성/파괴한다. 게임 중 React 리렌더는 일어나지 않는다(루프·렌더는 전부 Pixi).
 */
export default function GamePage() {
  const navigate = useNavigate()
  const speed = useSettingStore((s) => s.speed)
  const selectedMusicId = useCommonStore((s) => s.selectedMusicId)
  const selectedKeys = useCommonStore((s) => s.selectedKeys)
  const selectedDifficulty = useCommonStore((s) => s.selectedDifficulty)
  const containerRef = useRef<HTMLDivElement>(null)
  // runId가 바뀌면 effect가 재실행 → Game 인스턴스 재생성 = 인앱 재시작(페이지 리로드 X)
  const [runId, setRunId] = useState(0)

  useEffect(() => {
    const container = containerRef.current
    const song = getSongById(selectedMusicId ?? 1)
    const chart = song?.charts.find((c) => c.keys === selectedKeys && c.difficulty === selectedDifficulty)
    if (!container || !song || !chart) {
      navigate('/music-list', { replace: true })
      return
    }

    const game = new Game()
    game.start(container, {
      song,
      beatmapUrl: chart.beatmapUrl,
      speed,
      keys: chart.keys,
      hitVolume: 0.4, // 효과음 마스터(설정)가 전체 볼륨을 제어

      onComplete: (result) => {
        navigate('/result', { replace: true, state: result })
      },
      onRestart: () => setRunId((n) => n + 1),
      onExit: () => navigate('/music-list', { replace: true }),
    })

    // StrictMode 이중 마운트 + 라우트 이탈/재시작 시 완전 정리(오디오 정지, rAF 취소, 텍스처 해제)
    return () => game.destroy()
    // 곡/키/스피드는 진입 시점 값으로 고정. runId 변경 시에만 재생성(재시작).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId])

  return (
    <main className="min-h-dvh w-full overflow-hidden bg-[#050508]">
      <div ref={containerRef} className="fixed inset-0" />
    </main>
  )
}
