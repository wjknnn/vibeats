import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AudioEngineProvider } from './audio/AudioEngineContext.tsx'
import { initSongs } from './data/songs.ts'
import { audioEngine } from './audio/AudioEngine.ts'
import { useSettingStore } from './store/settingStore.ts'

// 저장된 볼륨을 오디오 마스터에 적용
const s = useSettingStore.getState()
audioEngine.setMusicMasterVolume(s.musicVolume)
audioEngine.setFxMasterVolume(s.effectVolume)

// 카탈로그(songs.json) 로드 후 렌더 — getSongById/SONGS 동기 접근 보장
initSongs().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AudioEngineProvider>
        <App />
      </AudioEngineProvider>
    </StrictMode>,
  )
})
