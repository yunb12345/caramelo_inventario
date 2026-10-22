/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base de la API sin el sufijo `/api`. Vacio = mismo origen. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
