import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type SettingState = {
  speed: number
  setSpeed: (speed: number) => void
  keys: number
  setKeys: (keys: number) => void
  musicVolume: number
  setMusicVolume: (volume: number) => void
  effectVolume: number
  setEffectVolume: (volume: number) => void
  songVolume: number
  setSongVolume: (volume: number) => void
  key4: string[]
  setKey4: (keys: string[]) => void
  key5: string[]
  setKey5: (keys: string[]) => void
  key6: string[]
  setKey6: (keys: string[]) => void
}

export const useSettingStore = create<SettingState>()(
  persist(
    (set) => ({
      speed: 6,
      setSpeed: (speed: number) => set({ speed }),
      keys: 4,
      setKeys: (keys: number) => set({ keys }),
      // 볼륨: 0~100 퍼센트(선형). AudioEngine 마스터 게인에 적용.
      musicVolume: 80,
      setMusicVolume: (volume: number) => set({ musicVolume: volume }),
      effectVolume: 80,
      setEffectVolume: (volume: number) => set({ effectVolume: volume }),
      songVolume: 80,
      setSongVolume: (volume: number) => set({ songVolume: volume }),
      key4: ['d', 'f', 'j', 'k'],
      setKey4: (keys: string[]) => set({ key4: keys }),
      key5: ['s', 'd', 'f|j', 'k', 'l'],
      setKey5: (keys: string[]) => set({ key5: keys }),
      key6: ['s', 'd', 'f', 'j', 'k', 'l'],
      setKey6: (keys: string[]) => set({ key6: keys }),
    }),
    {
      name: 'setting',
      version: 3,
      migrate: (persisted, version) => {
        const state = persisted as SettingState
        if (!state) return state
        if (version < 2 && state.speed < 6) state.speed = 6
        // v3: 볼륨을 dB → 퍼센트(0~100) 체계로 전환. 기존값은 기본값으로 리셋.
        if (version < 3) {
          state.musicVolume = 80
          state.effectVolume = 80
          state.songVolume = 80
        }
        return state
      },
    },
  ),
)
