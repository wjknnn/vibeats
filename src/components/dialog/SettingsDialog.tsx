import { useAudio } from '@/audio/AudioEngineContext'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { useSettingStore } from '@/store'

type SettingsDialogProps = {
  open?: boolean
  setOpen?: (open?: boolean) => void
  trigger?: React.ReactNode
}

export const SettingsDialog = ({ open, setOpen, trigger }: SettingsDialogProps) => {
  const audio = useAudio()
  const { musicVolume, setMusicVolume, effectVolume, setEffectVolume, speed, setSpeed } = useSettingStore()

  const onOpenChange = (isOpen: boolean) => {
    audio.setBgmMuffled(isOpen, { volume: isOpen ? -24 : -12 })
    setOpen?.(isOpen)
  }

  return (
    <Dialog open={open === undefined ? undefined : open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="!bg-[#0e0f15]/95 flex-col w-[440px] gap-0 p-0 border-white/10 text-white/85">
        {/* 헤더 */}
        <div className="px-6 pt-6 pb-4 border-b border-white/[0.07]">
          <h2 className="text-[22px] font-black tracking-tight">설정</h2>
          <p className="text-[11px] tracking-[0.3em] uppercase text-white/30 mt-0.5">Settings</p>
        </div>

        <div className="px-6 py-5 flex flex-col gap-7">
          {/* 음향 */}
          <section className="flex flex-col gap-4">
            <h3 className="text-[11px] font-bold tracking-[0.2em] uppercase text-white/35">음향</h3>

            <label className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[14px] text-white/75 font-medium">음악 볼륨</span>
                <span className="text-[12px] font-mono tabular-nums text-cyan-300/80">{musicVolume}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={musicVolume}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setMusicVolume(v)
                  audio.setMusicMasterVolume(v)
                }}
                className="w-full h-1.5 accent-cyan-400 cursor-pointer"
              />
            </label>

            <label className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[14px] text-white/75 font-medium">효과음 볼륨</span>
                <span className="text-[12px] font-mono tabular-nums text-cyan-300/80">{effectVolume}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={effectVolume}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setEffectVolume(v)
                  audio.setFxMasterVolume(v)
                  audio.playTap(0.5) // 미리듣기
                }}
                className="w-full h-1.5 accent-cyan-400 cursor-pointer"
              />
            </label>
          </section>

          {/* 게임 */}
          <section className="flex flex-col gap-4">
            <h3 className="text-[11px] font-bold tracking-[0.2em] uppercase text-white/35">게임</h3>
            <label className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[14px] text-white/75 font-medium">노트 속도</span>
                <span className="text-[12px] font-mono tabular-nums text-cyan-300/80">{speed.toFixed(1)}×</span>
              </div>
              <input
                type="range"
                min={1}
                max={7}
                step={0.1}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-full h-1.5 accent-cyan-400 cursor-pointer"
              />
              <span className="text-[11px] text-white/30">빠를수록 노트가 빨리 떨어집니다. 게임 중 +/− 로도 조절.</span>
            </label>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
