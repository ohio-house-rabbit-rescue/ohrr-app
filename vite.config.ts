import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

// Build-time version info, surfaced in Settings → About and in the staff area
// so anyone can say exactly which build they are looking at.
//
//   version   package.json "version"  — 0.2.2
//   revision  package.json "revision" — a number that goes up with every
//             release we publish, and matches the Android versionCode / iOS
//             build number, so "rev 5" means the same thing everywhere.
//   commit    the exact source, from whichever host built it (Cloudflare Pages
//             sets CF_PAGES_COMMIT_SHA; Netlify set COMMIT_REF), else the local
//             git HEAD, else "dev".
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))
function localCommit(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim()
  } catch {
    return 'dev'
  }
}
const commit = process.env.CF_PAGES_COMMIT_SHA || process.env.COMMIT_REF || localCommit()
const revision = Number(pkg.revision ?? 0)
const buildTime = new Date().toISOString()

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(commit),
    __APP_REVISION__: JSON.stringify(revision),
    __APP_BUILD_TIME__: JSON.stringify(buildTime),
  },
  plugins: [react(), tailwindcss()],
})
