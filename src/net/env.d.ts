interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** מזהה הבנייה, מוזרק ב-vite.config.ts. */
declare const __BUILD_ID__: string;
