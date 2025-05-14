import { create } from 'zustand'

type Page = 'home' | 'game' | 'result'

type CommonState = {
  page: Page
  setPage: (page: Page) => void
}

export const useCommonStore = create<CommonState>((set) => ({
  page: 'home',
  setPage: (page: Page) => set({ page }),
}))
