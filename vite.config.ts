import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { zipSync } from 'fflate'
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

// In-app updates for the phone apps (src/native/updater.ts). On the live site's build, the finished
// web app is also zipped (index.html at the top) as /ota/bundle-<revision>.zip, with /ota/latest.json
// saying which revision is newest. A phone app downloads the zip and runs it, so a web change needs no
// new install. `minNativeBuild` (Android versionCode) and `minNativeBuildIos` (iOS build number) in package.json are the oldest phone-shell builds that can run this copy.
// Only on the hosted build (Cloudflare Pages sets CF_PAGES) or with OTA_BUILD=1: a local `cap sync`
// build must NOT carry the zip, or it would be copied into every APK.
function otaBundle(): Plugin {
  let outDir = 'dist'
  return {
    name: 'ohrr-ota-bundle',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir
    },
    closeBundle() {
      if (!process.env.CF_PAGES && !process.env.OTA_BUILD) return
      const files: Record<string, Uint8Array> = {}
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const full = join(dir, name)
          if (statSync(full).isDirectory()) walk(full)
          else files[relative(outDir, full).replaceAll('\\', '/')] = new Uint8Array(readFileSync(full))
        }
      }
      walk(outDir)
      if (!files['index.html']) throw new Error('ota: index.html missing from the build')
      const zip = zipSync(files, { level: 9 })
      if (zip.length > 24 * 1024 * 1024) throw new Error(`ota: the zip is ${zip.length} bytes; Cloudflare Pages allows 25 MB per file`)
      mkdirSync(join(outDir, 'ota'), { recursive: true })
      writeFileSync(join(outDir, 'ota', `bundle-${revision}.zip`), zip)
      writeFileSync(
        join(outDir, 'ota', 'latest.json'),
        JSON.stringify({ version: pkg.version, revision, url: `/ota/bundle-${revision}.zip`, minNativeBuild: Number(pkg.minNativeBuild ?? 0), minNativeBuildIos: Number(pkg.minNativeBuildIos ?? 0), builtAt: buildTime }, null, 2),
      )
      console.log(`ota: bundle-${revision}.zip (${(zip.length / 1048576).toFixed(1)} MB) + latest.json`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(commit),
    __APP_REVISION__: JSON.stringify(revision),
    __APP_BUILD_TIME__: JSON.stringify(buildTime),
  },
  plugins: [react(), tailwindcss(), otaBundle()],
})
