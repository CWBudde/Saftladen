/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_DEBUG?: '0' | '1'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
