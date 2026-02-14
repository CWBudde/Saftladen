/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEBUG?: '0' | '1'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
