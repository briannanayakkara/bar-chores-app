import { IS_DEV } from '../../config/environment'

export default function DevBadge() {
  if (!IS_DEV) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-yellow-400 py-1 text-center text-xs font-bold text-black shadow-md">
      ⚠ DEVELOPMENT ENVIRONMENT
    </div>
  )
}
