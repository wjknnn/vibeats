import { useCommonStore } from '@/store'

import IntroPage from '@/pages/IntroPage'
import HomePage from '@/pages/HomePage'
import GamePage from '@/pages/GamePage'
import ResultPage from '@/pages/ResultPage'

function App() {
  const { page } = useCommonStore()

  if (page === 'intro') {
    return <IntroPage />
  } else if (page === 'home') {
    return <HomePage />
  } else if (page === 'game') {
    return <GamePage />
  } else if (page === 'result') {
    return <ResultPage />
  }

  return <>what? nothing!</>
}

export default App
