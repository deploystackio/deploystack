/// <reference types="vite/client" />

declare module '*.svg' {
  const src: string
  export default src
}

interface ImportMetaEnv {
  readonly VITE_DEPLOYSTACK_BACKEND_URL: string
  readonly VITE_APP_TITLE: string
  // add more env variables here
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
