<p align="center">
  <img src="../media/banner.svg" width="100%" alt="Mama Gamma">
</p>

<p align="center"><a href="../../README.md">English</a> · <a href="README.ru.md">Русский</a> · <strong>Deutsch</strong> · <a href="README.es.md">Español</a> · <a href="README.fr.md">Français</a> · <a href="README.uk.md">Українська</a> · <a href="README.ja.md">日本語</a></p>

# Mama Gamma

Finde Tonleitern anhand von Noten, Akkorden oder Audio. Übe die Ergebnisse auf dem virtuellen Griffbrett.

**Version 1.9.0** · Android 8.0 oder neuer · Analyse auf dem Gerät

## Schnellstart

1. Öffne **Akkorde** und gib `C – G – Am – F` mit internationalen Notennamen ein.
2. Tippe auf **Tonleitern finden** und wähle **C-Dur**.
3. Tippe zweimal auf den Namen der Tonleiter oder einmal auf die Schaltfläche rechts daneben, um das Griffbrett im Vollbild zu öffnen.

<details>
<summary>Akkordsuche ansehen</summary>

<p align="center"><img src="../media/chords.gif" width="300" alt="Akkorde eingeben und eine gefundene Tonleiter öffnen"></p>

</details>

## Tonleitern finden

- **Noten.** Tippe auf die Töne einer Melodie auf dem Griffbrett. Die ausgewählte Note wird in allen Oktaven markiert. Tippe erneut darauf, um die Auswahl aufzuheben. Vorschläge zeigen, welche Töne du hinzufügen kannst.
- **Akkorde.** Gib Akkorde wie `Dm7 | G7 | Cmaj7` ein. Verwende Leerzeichen, Gedankenstriche, senkrechte Striche oder Zeilenumbrüche als Trennzeichen. Gibt es keine exakte Übereinstimmung, zeigt die App die nächsten Treffer und markiert Akkorde außerhalb der Tonleiter.
- **Audio.** Nimm mit **Aufnehmen** einen Ausschnitt auf und beende die Aufnahme mit **Stoppen und analysieren**. Öffne über **Datei auswählen** eine MP3-, WAV- oder AAC-kodierte M4A-Datei. Aus anderen Apps kannst du eine Datei über **Teilen → Mama Gamma** übergeben. Die App analysiert die ersten 20 Sekunden und zeigt bis zu drei wahrscheinliche Dur- oder Molltonarten.

Die Abbildungen zeigen die russische Oberfläche.

<p align="center">
  <img src="../media/notes.webp" width="255" alt="Notensuche auf dem Griffbrett">
  <img src="../media/audio.webp" width="255" alt="Ergebnis der Analyse einer M4A-Datei">
</p>

## Griffbrett und Einstellungen

Tippe einmal auf einen Treffer, um die Tonleiter auf dem Hauptgriffbrett zu markieren. Lege im Vollbild einen Bundbereich wie **5–12** fest. Wische über das Griffbrett oder bewege es mit den Pfeilen. **Nur Griffbrett** blendet Bedienleiste und Legende aus. **⋯** oder die Android-Zurück-Funktion bringt die Bedienelemente zurück.

<p align="center"><img src="../media/fretboard.webp" width="760" alt="Tonleiter auf dem Griffbrett im Vollbild"></p>

- **Instrument und Stimmung.** Wähle Gitarre, Bass, Ukulele oder Mandoline. Stelle die leeren Saiten ein und wähle 12 bis 36 Bünde.
- **Klang und Design.** Regle die Lautstärke der Noten, schalte sie stumm oder wähle ein helles, dunkles oder systemgesteuertes Design. **Note anhören** spielt die nächste Stufe der aktuellen Tonleiter.
- **Sprache.** Die Oberfläche ist auf Englisch, Russisch, Deutsch, Spanisch, Französisch, Ukrainisch und Japanisch verfügbar. Standardmäßig verwendet die App die erste unterstützte Android-Sprache. Falls keine davon unterstützt wird, erscheint die App auf Englisch.
- **Notennamen.** Die Wahl ist unabhängig von der Sprache. Verfügbar sind international **C D E**, deutsch **C D E … H** (**B** steht für B♭), Solfège **Do Re Mi**, kyrillisch **До Ре Ми** und japanisch **ハ ニ ホ**.
- **Verlauf.** In der oberen Leiste findest du die letzten 100 erfolgreichen Suchen. Tippe auf eine Tonleiter, um sie erneut zu öffnen. Verlauf löschen und Einstellungen zurücksetzen sind getrennte Aktionen.

<p align="center">
  <img src="../media/settings.webp" width="255" alt="Einstellungen für Sprache und Instrument">
  <img src="../media/history.webp" width="255" alt="Suchverlauf">
</p>

## Installation und Build

### Fertige APK installieren

Übertrage `Mama Gamma.apk` oder die erstellte `app-debug.apk` auf das Android-Gerät. Öffne die Datei, tippe auf **Installieren** und starte Mama Gamma. Wenn Android nach einer Berechtigung fragt, erlaube der App, mit der du die APK öffnest, die Installation aus dieser Quelle.

### APK aus dem Quellcode erstellen

Installiere **Android SDK Platform 35**, **Android SDK Build-Tools 35.0.0** und **JDK 17**. Öffne das Projekt in Android Studio oder gib den SDK-Pfad über `ANDROID_HOME` an. Für den ersten Build brauchst du eine Internetverbindung. [Android Studio](https://developer.android.com/studio) · [Android Gradle Plugin](https://developer.android.com/build/releases/agp-8-11-0-release-notes)

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

**Erstellte APK** — `app/build/outputs/apk/debug/app-debug.apk`.

<details>
<summary>Installation mit ADB</summary>

Aktiviere USB-Debugging, verbinde das Gerät und bestätige die Anfrage auf dem Bildschirm. Führe den Befehl im Projektverzeichnis mit installierten Android SDK Platform-Tools aus.

```sh
adb devices
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

</details>

[Hintergrund zur Audioanalyse](../audio-scale-research.md)
