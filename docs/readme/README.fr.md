<p align="center">
  <img src="../media/banner.svg" width="100%" alt="Mama Gamma">
</p>

<p align="center"><a href="../../README.md">English</a> · <a href="README.ru.md">Русский</a> · <a href="README.de.md">Deutsch</a> · <a href="README.es.md">Español</a> · <strong>Français</strong> · <a href="README.uk.md">Українська</a> · <a href="README.ja.md">日本語</a></p>

# Mama Gamma

Trouve des gammes à partir de notes, d’accords ou d’un enregistrement. Joue les gammes trouvées sur le manche virtuel.

**Version 1.9.0** · Android 8.0 ou version ultérieure · Analyse sur l’appareil

## Démarrage rapide

1. Ouvre **Par accords** et saisis `C – G – Am – F` avec la notation internationale.
2. Touche **Trouver les gammes** et sélectionne **C majeur**.
3. Touche deux fois le nom de la gamme ou une fois le bouton à sa droite pour ouvrir le manche en plein écran.

<details>
<summary>Voir une recherche par accords</summary>

<p align="center"><img src="../media/chords.gif" width="300" alt="Saisie des accords et ouverture d’une gamme trouvée"></p>

</details>

## Trouver des gammes

- **Par notes.** Touche les notes d’une mélodie sur le manche. Chaque note sélectionnée est mise en évidence dans toutes les octaves. Touche-la de nouveau pour la retirer. Les suggestions indiquent les notes que tu peux ajouter.
- **Par accords.** Saisis des accords comme `Dm7 | G7 | Cmaj7`. Sépare-les par des espaces, des tirets, des barres verticales ou des sauts de ligne. Si aucune gamme ne correspond exactement, l’application affiche les plus proches et signale les accords qui sortent de la gamme.
- **Par audio.** Enregistre un extrait avec **Enregistrer**, puis touche **Arrêter et analyser**. Tu peux aussi ouvrir un fichier MP3, WAV ou M4A encodé en AAC avec **Choisir un fichier**. Depuis une autre application, utilise **Partager → Mama Gamma**. L’analyse des 20 premières secondes fournit jusqu’à trois tonalités majeures ou mineures probables.

Les captures montrent l’interface en russe.

<p align="center">
  <img src="../media/notes.webp" width="255" alt="Recherche par notes sur le manche">
  <img src="../media/audio.webp" width="255" alt="Résultat de l’analyse d’un fichier M4A">
</p>

## Manche et paramètres

Touche une fois un résultat pour mettre la gamme en évidence sur le manche principal. En plein écran, choisis une plage de cases, par exemple **5–12**, puis fais défiler le manche avec un geste ou les flèches. **Manche seul** masque les commandes et la légende. Le bouton **⋯** ou l’action **Retour** d’Android les fait réapparaître.

<p align="center"><img src="../media/fretboard.webp" width="760" alt="Gamme sur le manche en plein écran"></p>

- **Instrument et accordage.** Choisis la guitare, la basse, le ukulélé ou la mandoline. Règle les cordes à vide et sélectionne de 12 à 36 cases.
- **Son et thème.** Règle le volume des notes, coupe le son ou sélectionne le thème clair, sombre ou celui du système. **Écouter une note** joue le degré suivant de la gamme active.
- **Langue.** L’interface est disponible en anglais, russe, allemand, espagnol, français, ukrainien et japonais. Par défaut, l’application utilise la première langue Android prise en charge. Si aucune langue ne convient, elle s’ouvre en anglais.
- **Noms des notes.** Choisis-les indépendamment de la langue de l’interface. Les notations proposées sont internationale **C D E**, allemande **C D E … H** (**B** désigne si bémol), solfège **Do Re Mi**, cyrillique **До Ре Ми** et japonaise **ハ ニ ホ**.
- **Historique.** La barre supérieure donne accès aux 100 dernières recherches ayant abouti. Touche une gamme pour la rouvrir. Effacer l’historique et réinitialiser les paramètres sont deux actions distinctes.

<p align="center">
  <img src="../media/settings.webp" width="255" alt="Paramètres de langue et d’instrument">
  <img src="../media/history.webp" width="255" alt="Historique de recherche">
</p>

## Installation et compilation

### Installer un APK existant

Transfère `Mama Gamma.apk` ou le fichier `app-debug.apk` compilé sur ton appareil Android. Ouvre le fichier, touche **Installer** et lance Mama Gamma. Si Android demande une autorisation, permets l’installation depuis l’application qui ouvre le fichier APK.

### Compiler l’APK depuis le code source

Installe **Android SDK Platform 35**, **Android SDK Build-Tools 35.0.0** et **JDK 17**. Ouvre le projet dans Android Studio ou indique le chemin du SDK avec `ANDROID_HOME`. La première compilation nécessite une connexion à Internet. [Android Studio](https://developer.android.com/studio) · [Android Gradle Plugin](https://developer.android.com/build/releases/agp-8-11-0-release-notes)

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

**APK compilé** — `app/build/outputs/apk/debug/app-debug.apk`.

<details>
<summary>Installation avec ADB</summary>

Active le débogage USB, connecte l’appareil et accepte la demande sur son écran. Lance la commande à la racine du projet avec Android SDK Platform-Tools installé.

```sh
adb devices
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

</details>

[Recherche sur l’analyse audio](../audio-scale-research.md)
