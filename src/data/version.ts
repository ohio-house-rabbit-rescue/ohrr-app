// App build/version info, injected at build time (see vite.config.ts) and shown
// in Settings → About and in the staff area, so a tester or a volunteer can say
// which build they are on without guessing.
export const build = {
  version: __APP_VERSION__,
  /** Goes up by one with every release; same number as the Android versionCode. */
  revision: __APP_REVISION__,
  commit: __APP_COMMIT__,
  commitShort: __APP_COMMIT__.slice(0, 7),
  builtAt: __APP_BUILD_TIME__,
}

/** "v0.2.2 · rev 5" — the one string to quote when reporting something. */
export const buildLabel = `v${build.version} · rev ${build.revision}`
