# Counter Book — Android app

This wraps your `clinic-billing-5-14.html` app in a native Kotlin/WebView shell so it
installs and runs as a real Android app (own icon, own window, works offline).

## What's inside
- Your HTML/CSS/JS is unchanged and lives at `app/src/main/assets/clinic-billing.html`,
  except for one small addition to `exportBackup()` so it can save backup files
  through Android instead of a browser download (which doesn't work inside a WebView).
- `MainActivity.kt` — loads the HTML file into a full-screen WebView, keeps
  localStorage enabled (so your data persists between launches), and wires up:
  - **Restore from backup**: opens Android's native file picker when you tap
    "Restore from backup file".
  - **Download backup**: saves the JSON file straight to the phone's
    `Downloads` folder.

## How to build the APK
1. Install [Android Studio](https://developer.android.com/studio) (free).
2. Open Android Studio → **Open** → select this `CounterBook` folder.
3. Let it sync Gradle (first time takes a few minutes, downloads the Android SDK if needed).
4. Plug in your phone (with USB debugging on) or use an emulator, then click **Run ▶**.
   - Or: **Build → Build Bundle(s) / APK(s) → Build APK(s)** to get an installable
     `.apk` file under `app/build/outputs/apk/debug/`.
5. To install on a phone without a cable: copy the `.apk` to the phone and open it
   (you'll need to allow "install unknown apps" for whichever app you copied it with).

## If you want it on the Play Store
You'll need a signed **release** build (Android Studio can generate a signing key
for you: Build → Generate Signed Bundle/APK) and a Google Play Developer account
($25 one-time fee).

## Notes
- Minimum Android version supported: Android 7.0 (API 24).
- All your data (medicines, bills, notes) is stored locally on the device via
  localStorage, exactly as it was in the browser version — nothing changed there.
