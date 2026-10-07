# Martec Buddy

iOS and Android app for the Formelopslag workbook at [uplo.tv](https://uplo.tv).
The calculation engine, catalogs and water diagram are the offline build of
[grumskull-art/Formelopslag](https://github.com/grumskull-art/Formelopslag)
at commit `0d76f80`. Mathcad export is removed. The phone layout is in `mobile/`.

## Included

- Search across EL and TM, including formula codes
- Saved entries on the device
- Topic shortcuts, subtopics and the calculation-path finder
- Known quantities, situations, incomplete paths, and the AC / RLC / three-phase source-gap filter
- Formula cards with conditions, explanation, steps, conversion, pitfalls, examples, sources, plain text and LaTeX
- Copy link, print, light/dark/auto theme, and feedback mail
- Notes, teaching constants and materials, and the source-scope note
- log(p)-h diagram for water (IAPWS-IF97 regions 1, 2 and 4), including the dry-expansion cycle
- Works offline after install

## Not included

- Copy to Mathcad
- Mathcad-valg
- Mathcad worksheet XML

Mathcad Prime is not available on iOS, so those controls are not in the app.

## Phone layout

- Bottom tabs: Formler and Diagram
- Search and saved entries stacked for the thumb
- Topics scroll sideways
- One column on a phone, two columns from 900px
- The diagram is shown before its inputs
- 16px fields so iOS does not zoom, and 44px controls
- Safe areas, and the tab bar moves away while the keyboard is open

## Build the web bundle

From this folder:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-www.ps1
```

The script reads `vendor/Formelopslag/docs/index.html`, drops Mathcad, and writes `www/`.
If the vendor file is missing it clones that one file from GitHub.

Open `www/index.html` in a phone-sized browser window to review the layout.
A store build uses the same `www` folder.

## iOS and Android projects

Node.js 20 or newer:

```powershell
npm install
npx cap add android
npx cap add ios
npm run cap:sync
```

- Android opens in Android Studio with `npm run android`. An APK needs the Android SDK on this machine.
- iOS project files can be generated on Windows. Signing and TestFlight need a Mac with Xcode. `npm run ios` opens the project when Xcode is installed.
- Bundle id: `com.solodreams.MartecBuddy`
- App Store Connect SKU: `MartecBuddy2026`
- App Store Connect Apple ID: `6820046436`
- A push to `main` runs `.github/workflows/ios-testflight.yml` and uploads a build to TestFlight.
- The repository is public. Certificates, the App Store Connect API key, and the provisioning profile are GitHub Actions secrets. Do not commit `.p8`, `.p12`, or `.mobileprovision` files.

## Refresh from Formelopslag

Fetch a newer `docs/index.html` into `vendor/Formelopslag` and run `scripts/build-www.ps1` again.
Do not edit formulas inside `www/index.html`. That file is generated.
Phone-only changes belong in `mobile/mobile.css` and `mobile/mobile.js`.
