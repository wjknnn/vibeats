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
      musicVolume: -10,
      setMusicVolume: (volume: number) => set({ musicVolume: volume }),
      effectVolume: -10,
      setEffectVolume: (volume: number) => set({ effectVolume: volume }),
      songVolume: -10,
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
      // 저장된 배속을 새 기본값(6)으로 1회 올려준다(더 높게 설정해둔 경우는 유지).
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as SettingState
        if (version < 2 && state && state.speed < 6) state.speed = 6
        return state
      },
    },
  ),
)
