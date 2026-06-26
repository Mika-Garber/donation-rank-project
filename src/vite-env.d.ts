/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_APP_ACCESS_TOKEN?: string
  readonly VITE_SHOW_ADMIN_TOOLS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
