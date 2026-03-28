import { useAudio } from '@/audio/AudioEngineContext'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'

type SettingsDialogProps = {
  open?: boolean
  setOpen?: (open?: boolean) => void
  trigger?: React.ReactNode
}

export const SettingsDialog = ({ open, setOpen, trigger }: SettingsDialogProps) => {
  const audio = useAudio()

  const onOpenChange = (isOpen: boolean) => {
    audio.setBgmMuffled(isOpen, { volume: isOpen ? -24 : -12 })
    if (setOpen) setOpen(isOpen)
  }

  return (
    <Dialog
      open={open === undefined ? undefined : open}
      onOpenChange={onOpenChange}
    >
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className='h-[600px] w-[1200px]'></DialogContent>
    </Dialog>
  )
}
