<p align="center">
  <img src="docs/media/banner.svg" width="100%" alt="Mama Gamma">
</p>

<p align="center">
  Find the key from notes, chords, or audio and open the scale on a fretboard.
</p>

<p align="center">
  <strong>Version 1.9.0</strong> · Android 8.0 and later · Works offline
</p>

<p align="center">
  <strong>English</strong> ·
  <a href="docs/readme/README.ru.md">Русский</a> ·
  <a href="docs/readme/README.de.md">Deutsch</a> ·
  <a href="docs/readme/README.es.md">Español</a> ·
  <a href="docs/readme/README.fr.md">Français</a> ·
  <a href="docs/readme/README.uk.md">Українська</a> ·
  <a href="docs/readme/README.ja.md">日本語</a>
</p>

<p align="center">
  <a href="#install">Install</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#find-a-scale">Find a scale</a> ·
  <a href="#fretboard-and-settings">Fretboard and settings</a>
</p>

## Quick start

1. Open **By chords** and enter `C – G – Am – F`.
2. Tap **Find scales**. Select **C major** in the results to highlight its notes on the fretboard.
3. Tap the expand button next to a result or double-tap its name. The fretboard opens in landscape.

> The example uses the default International note names. To match the English labels in this guide, open **Settings → Language → English**. The screenshots show the Russian interface.

<details>
<summary>Watch a chord search</summary>

<p align="center">
  <img src="docs/media/chords.gif" width="300" alt="Entering C, G, Am and F, finding scales, and opening the search history">
</p>

</details>

## Find a scale

| What you have | Where to start | What you get |
| --- | --- | --- |
| A few notes from a melody | **By notes** | Scales that contain those notes and suggestions for the next note |
| The chords of a song | **By chords** | Scales that fit the progression, with any out-of-scale chords listed |
| A riff, recording, or song | **By audio** | Up to three likely major or minor keys |

### By notes

Tap notes on the fretboard, such as **C**, **E**, and **G**. Each selection applies across octaves. Tap a note or its chip again to remove it.

| Fretboard legend | Meaning |
| --- | --- |
| **Selected** | The note is part of the search |
| **Tonic** | The first degree of the displayed scale |
| **In scale** | The note belongs to the displayed scale |
| **Suggested** | Adding the note would still match another candidate scale |

### By chords

Paste a progression, such as `Dm7 | G7 | Cmaj7`, and tap **Find scales**. You can separate chords with spaces, dashes, vertical bars, or line breaks. If the progression has no exact match, the app lists the closest scales and identifies the chords outside each one. Use **Clear** to empty the input and results.

### By audio

| Source | How to start |
| --- | --- |
| **Microphone** | Tap **Record**, allow microphone access, and play a short phrase. Tap **Stop and analyze** to finish early. |
| **File** | Tap **Choose file** and open an MP3, WAV, or AAC-encoded M4A file. |
| **Telegram or another app** | Open Android's **Share** menu for an audio file and choose **Mama Gamma**. Analysis starts automatically. |

The app analyzes up to 20 seconds on your device and shows available file details. If it returns several keys, open each scale and compare it with what you hear. For a quiet or short clip, try a passage with several clear notes or chords.

<p align="center">
  <img src="docs/media/notes.webp" width="255" alt="The notes C, E and G selected on the guitar fretboard">
  <img src="docs/media/audio.webp" width="255" alt="An M4A analysis result with its detected key and file details">
</p>

## Fretboard and settings

### Practice a scale

1. Tap a result once to preview its notes, or open it full screen with the expand button or a double-tap.
2. Set the first and last fret, for example **5–12**. Swipe to move along the fretboard or use the arrows to move one fret at a time.
3. Tap **Fretboard only** for a larger playing area. The **⋯** button in the top-left corner or Android **Back** brings back the controls.

Tap a highlighted note to hear its pitch for that string, tuning, and fret.

<p align="center">
  <img src="docs/media/fretboard.webp" width="760" alt="Scale notes across frets 5 through 12 in Fretboard only mode">
</p>

### Change language and note names

**Settings → Language** follows Android by default and falls back to English if none of the system's languages are supported. Choose English, Russian, German, Spanish, French, Ukrainian, or Japanese to override it.

**Settings → Note names** controls the notation separately. It applies to the fretboard, scale names, open-string tuning, and chord input.

| Note names | Natural notes, starting at C |
| --- | --- |
| **International** | C, D, E, F, G, A, B |
| **German** | C, D, E, F, G, A, H. In this notation, B means B♭. |
| **Solfège** | Do, Re, Mi, Fa, Sol, La, Si |
| **Cyrillic solfège** | До, Ре, Ми / Мі, Фа, Соль, Ля, Си / Сі |
| **Japanese** | ハ, ニ, ホ, ヘ, ト, イ, ロ |

With Solfège selected, the quick-start progression reads `Do – Sol – Lam – Fa`. Chord suffixes such as `m`, `maj7`, and `sus4` work across all five systems.

### Make it yours

- **Instrument and tuning.** Choose guitar, bass, ukulele, or mandolin. Use a preset or set open strings by hand, with 12 to 36 frets per instrument.
- **Note sound.** Set the volume or turn it off. A volume change or **Preview note** plays the next degree of the selected scale and loops back to the tonic.
- **Theme.** Choose light, dark, or system.
- **Reset settings.** Restore the defaults, including language and note names. Find the app version at the bottom of Settings.

### Reopen a past search

Tap **History** in the top bar to see the last 100 successful searches on your device. Each entry shows the time, search method, and up to three scales. Consecutive identical note or chord searches create one entry. Tap a scale to open it on the fretboard, or use **Clear history** to delete the entries.

<p align="center">
  <img src="docs/media/settings.webp" width="255" alt="Mama Gamma settings with language, theme, sound and instrument controls">
  <img src="docs/media/history.webp" width="255" alt="Search history with entries from audio, chords, and notes">
</p>

## Install

### Install an APK you already have

1. Copy `Mama Gamma.apk` or the built `app-debug.apk` to your Android device.
2. Open the file. If Android prompts you, allow installs from the app you used to open it. [Android installation help](https://support.google.com/pixelphone/answer/7391672)
3. Tap **Install**, then open **Mama Gamma**.

### Build from source

1. Install Android Studio. In SDK Manager, add **Android SDK Platform 35** and **Android SDK Build-Tools 35.0.0**. Use **JDK 17** to run Gradle. [Android Studio](https://developer.android.com/studio) · [SDK Manager](https://developer.android.com/studio/intro/update#sdk-manager) · [Android Gradle Plugin compatibility](https://developer.android.com/build/releases/agp-8-11-0-release-notes)
2. Clone the repository and enter its directory.

   ```sh
   git clone https://github.com/MLEX0/GammaMama.git
   cd GammaMama
   ```

3. Open the project in Android Studio to set up the SDK path. When building from a terminal, you can set `ANDROID_HOME` to your installed SDK directory.
4. Run the command for your system from the repository root. The first build needs internet access to download Gradle and its dependencies.

   **Windows PowerShell**

   ```powershell
   .\gradlew.bat :app:assembleDebug
   ```

   **Linux and macOS**

   ```sh
   ./gradlew :app:assembleDebug
   ```

5. Install `app/build/outputs/apk/debug/app-debug.apk`. [Build Android apps from the command line](https://developer.android.com/build/building-cmdline)

<details>
<summary>Install over USB with ADB</summary>

Enable USB debugging, connect your phone, and approve the connection on the device. Run these commands from the repository root. Android SDK Platform-Tools includes `adb`.

```sh
adb devices
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

To update an existing install, use an APK signed with the same key. Uninstalling the app removes its local settings and history. [ADB documentation](https://developer.android.com/tools/adb)

</details>

## For developers

- The UI, fretboard, and scale finder live in the [app assets](app/src/main/assets/).
- Recording and audio decoding run in the [Android code](app/src/main/java/app/gammama/scales/).
- The [audio analysis research notes](docs/audio-scale-research.md) describe the design and alternatives in Russian.
