import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router'

import IntroPage from '@/pages/IntroPage'
import HomePage from '@/pages/HomePage'
import GamePage from '@/pages/GamePage'
import ResultPage from '@/pages/ResultPage'
import MusicListPage from '@/pages/MusicList'

// dev 전용 채보 에디터 (프로덕션에선 라우트가 없어 로드되지 않음)
const EditorPage = lazy(() => import('@/pages/EditorPage'))

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<IntroPage />} />
        <Route path='/home' element={<HomePage />} />
        <Route path='/game' element={<GamePage />} />
        <Route path='/result' element={<ResultPage />} />
        <Route path='/music-list' element={<MusicListPage />} />
        {import.meta.env.DEV && (
          <Route
            path='/editor'
            element={
              <Suspense fallback={null}>
                <EditorPage />
              </Suspense>
            }
          />
        )}
        <Route path='*' element={<Navigate to='/' replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
