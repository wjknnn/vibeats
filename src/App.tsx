import { useAudioManager } from '@/audio/AudioManagerContext'
import { useCommonStore } from '@/store'

import IntroPage from '@/pages/IntroPage'
import HomePage from '@/pages/HomePage'
import GamePage from '@/pages/GamePage'
import ResultPage from '@/pages/ResultPage'
import MusicListPage from '@/pages/MusicList'

function App() {
  const { page } = useCommonStore()
  const audio = useAudioManager()

  if (audio.tone.context.state === 'suspended') {
    return <IntroPage />
  }

  switch (page) {
    case 'intro':
      return <IntroPage />
    case 'home':
      return <HomePage />
    case 'game':
      return <GamePage />
    case 'result':
      return <ResultPage />
    case 'musicList':
      return <MusicListPage />
    default:
      return <>what? nothing!</>
  }
}

export default App
