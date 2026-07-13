# SandScape

A mobile-first, gravity-responsive liquid sand-art simulation inspired by physical moving sand picture frames.

This repository contains the working PWA simulation, Capacitor mobile configuration, build scripts, tests, and implementation documentation.

## Quick start

```powershell
npm ci
npm run start
```

Then open the local URL shown in the terminal. On mobile, enable motion access and tilt the device. On desktop, drag inside the frame to control gravity.

## Mobile builds

```powershell
npm ci
npx cap sync
npx cap open android
# macOS only:
npx cap open ios
```

See `docs/BUILD-STATUS.md` and `docs/ACCEPTANCE-TESTS.md` for verified status and physical-device validation requirements.
