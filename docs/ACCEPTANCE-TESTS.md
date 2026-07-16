# SandScape acceptance tests

Physical-device validation checklist. Automated coverage (invariants, browser
boot) lives in `tests/`; these steps need real hardware.

1. Launch in portrait and landscape; frame remains fully visible and clipped correctly.
2. On iOS, tap Enable tilt and grant motion permission. Gravity follows phone orientation without hand-tremor jitter.
3. On Android, enable tilt and verify orientation updates without a permission dialog where the browser does not require one.
4. Flip the frame and verify the sand mass clings to the ceiling, releasing in thin, uneven waterfalls rather than dropping as a sheet.
5. Wait for settling; visible colored striation must remain, heaviest band at the bottom.
6. Tap three different points; disturbance remains local.
7. Shake once; frame flips once and does not repeatedly retrigger for at least 1.6 seconds.
8. Long press; drawer opens. Switch between palette tabs (Exotic → Soccer) and verify immediate recoloring; Exotic palettes show tinted glitter.
9. Change flow speed from 0.5× to 3×; pour rate visibly follows.
10. Switch circle/square glass and verify the simulation re-pours inside the correct boundary.
11. Save PNG and verify the framed capture downloads.
12. Run the in-app Self-tests from the drawer; expect 11/11.
13. Install as PWA, enter airplane mode, and relaunch successfully.
14. Run for 20 minutes on iPhone 12 / Pixel 6 class devices and record average frame time and thermal state.
