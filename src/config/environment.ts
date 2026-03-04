export const ENV = import.meta.env.VITE_ENV || 'development'
export const IS_DEV = ENV === 'development'
export const IS_PROD = ENV === 'production'
export const APP_TITLE = import.meta.env.VITE_APP_TITLE || 'Bar Chores [DEV]'
