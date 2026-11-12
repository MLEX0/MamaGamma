<p align="center">
  <img src="../media/banner.svg" width="100%" alt="Mama Gamma">
</p>

<p align="center"><a href="../../README.md">English</a> · <a href="README.ru.md">Русский</a> · <a href="README.de.md">Deutsch</a> · <a href="README.es.md">Español</a> · <a href="README.fr.md">Français</a> · <a href="README.uk.md">Українська</a> · <strong>日本語</strong></p>

# Mama Gamma

音符、コード、音声からスケールを探し、仮想指板で練習できます。

**バージョン 1.9.0** · Android 8.0 以降 · 端末上で解析

## クイックスタート

1. **コードから** を開き、国際式の音名で `C – G – Am – F` と入力します。
2. **スケールを検索** をタップし、**Cメジャー** を選びます。
3. スケール名をダブルタップするか、右側のボタンをタップして指板を全画面で開きます。

<details>
<summary>コード検索のデモを見る</summary>

<p align="center"><img src="../media/chords.gif" width="300" alt="コードを入力して検索結果のスケールを開く操作"></p>

</details>

## スケールの検索

- **音名から**。メロディーの音を指板でタップします。選択した音はすべてのオクターブで強調されます。もう一度タップすると選択が解除されます。候補表示から、次に追加できる音を確認できます。
- **コードから**。`Dm7 | G7 | Cmaj7` のようにコードを入力します。スペース、ダッシュ、縦線、改行で区切れます。完全に一致するスケールが見つからない場合は、近いスケールと、そのスケールに含まれないコードが表示されます。
- **音声から**。**録音** で演奏を録り、**停止して分析** をタップします。**ファイルを選択** から MP3、WAV、AAC 形式の M4A を開くこともできます。別のアプリからは **共有 → Mama Gamma** を選びます。音声の最初の 20 秒を分析し、長調と短調の候補を最大 3 件表示します。

スクリーンショットではロシア語の画面を使用しています。

<p align="center">
  <img src="../media/notes.webp" width="255" alt="指板上の音からスケールを検索した画面">
  <img src="../media/audio.webp" width="255" alt="M4A ファイルの解析結果">
</p>

## 指板と設定

検索結果を 1 回タップすると、メインの指板にスケールが表示されます。全画面では **5–12** などのフレット範囲を指定し、スワイプまたは矢印で指板を動かせます。**指板のみ** で操作パネルと凡例を非表示にできます。**⋯** または Android の **戻る** 操作で表示を戻せます。

<p align="center"><img src="../media/fretboard.webp" width="760" alt="全画面の指板に表示されたスケール"></p>

- **楽器とチューニング**。ギター、ベース、ウクレレ、マンドリンから選べます。開放弦の音と、12〜36 のフレット数を設定できます。
- **音とテーマ**。音量の調整、消音、ライト・ダーク・システムテーマの選択ができます。**試聴** をタップすると、現在のスケールの次の音を再生します。
- **言語**。英語、ロシア語、ドイツ語、スペイン語、フランス語、ウクライナ語、日本語に対応しています。既定では Android に設定された対応言語のうち最優先のものを使います。対応言語が設定されていない場合は英語で開きます。
- **音名**。画面の言語とは別に選べます。国際式の **C D E**、ドイツ式の **C D E … H**（**B** は B♭）、イタリア式の **Do Re Mi**、キリル文字の **До Ре Ми**、日本式の **ハ ニ ホ** に対応しています。
- **履歴**。上部バーから直近 100 件の検索結果を確認できます。スケールをタップすると指板が再び開きます。履歴の消去と設定のリセットはそれぞれ実行できます。

<p align="center">
  <img src="../media/settings.webp" width="255" alt="言語と楽器の設定画面">
  <img src="../media/history.webp" width="255" alt="検索履歴">
</p>

## インストールとビルド

### APK をインストールする

`Mama Gamma.apk` またはビルドした `app-debug.apk` を Android 端末へ転送します。ファイルを開いて **インストール** を選択し、Mama Gamma を起動します。Android に許可を求められたら、APK を開いたアプリからのインストールを許可します。

### ソースコードから APK をビルドする

**Android SDK Platform 35**、**Android SDK Build-Tools 35.0.0**、**JDK 17** をインストールします。Android Studio でプロジェクトを開くか、`ANDROID_HOME` で SDK の場所を指定します。初回のビルドにはインターネット接続が必要です。 [Android Studio](https://developer.android.com/studio) · [Android Gradle Plugin](https://developer.android.com/build/releases/agp-8-11-0-release-notes)

```sh
git clone https://github.com/MLEX0/GammaMama.git
cd GammaMama
```

**Windows PowerShell**

```powershell
.\gradlew.bat :app:assembleDebug
```

**Linux / macOS**

```sh
./gradlew :app:assembleDebug
```

**ビルドした APK** — `app/build/outputs/apk/debug/app-debug.apk`.

<details>
<summary>ADB でインストールする</summary>

USB デバッグを有効にして端末を接続し、端末側で接続を許可します。Android SDK Platform-Tools をインストールした状態で、プロジェクトのルートからコマンドを実行します。

```sh
adb devices
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

</details>

[音声分析に関する調査](../audio-scale-research.md)
