// App build/version info, injected at build time (see vite.config.ts) and shown
// in Settings → About so anyone can confirm which build is live.
export const build = {
  version: __APP_VERSION__,
  commit: __APP_COMMIT__,
  commitShort: __APP_COMMIT__.slice(0, 7),
  builtAt: __APP_BUILD_TIME__,
}
