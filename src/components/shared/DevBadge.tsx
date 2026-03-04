import { IS_DEV } from '../../config/environment'

const isNonProd = IS_DEV || __VERCEL_ENV__ === 'preview'

export default function DevBadge() {
  if (!isNonProd) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-yellow-400 py-1 text-center text-xs font-bold text-black shadow-md">
      ⚠ DEVELOPMENT ENVIRONMENT
    </div>
  )
}
