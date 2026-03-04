import { IS_DEV } from '../../config/environment'

export default function DevBadge() {
  if (!IS_DEV) return null

  return (
    <div className="fixed top-2 right-2 z-[9999] rounded-full bg-orange-500 px-3 py-1 text-xs font-bold text-white shadow-lg">
      DEV
    </div>
  )
}
