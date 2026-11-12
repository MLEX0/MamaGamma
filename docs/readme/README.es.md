<p align="center">
  <img src="../media/banner.svg" width="100%" alt="Mama Gamma">
</p>

<p align="center"><a href="../../README.md">English</a> · <a href="README.ru.md">Русский</a> · <a href="README.de.md">Deutsch</a> · <strong>Español</strong> · <a href="README.fr.md">Français</a> · <a href="README.uk.md">Українська</a> · <a href="README.ja.md">日本語</a></p>

# Mama Gamma

Encuentra escalas a partir de notas, acordes o audio. Practica los resultados en el diapasón virtual.

**Versión 1.9.0** · Android 8.0 o posterior · Análisis en el dispositivo

## Inicio rápido

1. Abre **Por acordes** e introduce `C – G – Am – F` con los nombres internacionales de las notas.
2. Toca **Buscar escalas** y selecciona **C mayor**.
3. Toca dos veces el nombre de la escala o una vez el botón a su derecha para abrir el diapasón a pantalla completa.

<details>
<summary>Ver una búsqueda por acordes</summary>

<p align="center"><img src="../media/chords.gif" width="300" alt="Introducción de acordes y selección de una escala"></p>

</details>

## Buscar escalas

- **Por notas.** Toca las notas de una melodía en el diapasón. Cada nota elegida se resalta en todas las octavas. Tócala otra vez para quitarla. Las sugerencias indican qué notas puedes añadir.
- **Por acordes.** Introduce acordes como `Dm7 | G7 | Cmaj7`. Puedes separarlos con espacios, rayas, barras verticales o saltos de línea. Si no hay coincidencia exacta, aparecen las escalas más cercanas y los acordes que quedan fuera de ellas.
- **Por audio.** Toca **Grabar** y después **Detener y analizar**. También puedes abrir un archivo MP3, WAV o M4A con AAC desde **Elegir archivo**. Desde otra aplicación, usa **Compartir → Mama Gamma**. Se analizan los primeros 20 segundos y se muestran hasta tres tonalidades mayores o menores probables.

Las capturas muestran la interfaz en ruso.

<p align="center">
  <img src="../media/notes.webp" width="255" alt="Búsqueda por notas en el diapasón">
  <img src="../media/audio.webp" width="255" alt="Resultado del análisis de un archivo M4A">
</p>

## Diapasón y ajustes

Toca un resultado una vez para resaltarlo en el diapasón principal. En pantalla completa, elige un rango de trastes, por ejemplo **5–12**, y desplázate con un gesto o con las flechas. **Solo diapasón** oculta la barra y la leyenda. El botón **⋯** o la acción **Atrás** de Android vuelve a mostrar los controles.

<p align="center"><img src="../media/fretboard.webp" width="760" alt="Escala en el diapasón a pantalla completa"></p>

- **Instrumento y afinación.** Elige guitarra, bajo, ukelele o mandolina. Ajusta las cuerdas al aire y selecciona entre 12 y 36 trastes.
- **Sonido y tema.** Regula el volumen de las notas, siléncialas o selecciona un tema claro, oscuro o del sistema. **Escuchar nota** reproduce el siguiente grado de la escala actual.
- **Idioma.** La interfaz está disponible en inglés, ruso, alemán, español, francés, ucraniano y japonés. La aplicación usa por defecto el primer idioma de Android que admite. Si no hay ninguno, se abre en inglés.
- **Nombres de las notas.** Se eligen por separado del idioma de la interfaz. Puedes usar el sistema internacional **C D E**, alemán **C D E … H** (**B** es si bemol), solfeo **Do Re Mi**, cirílico **До Ре Ми** o japonés **ハ ニ ホ**.
- **Historial.** La barra superior da acceso a las últimas 100 búsquedas con resultados. Toca una escala para volver a abrirla. Borrar el historial y restablecer los ajustes son acciones independientes.

<p align="center">
  <img src="../media/settings.webp" width="255" alt="Ajustes de idioma e instrumento">
  <img src="../media/history.webp" width="255" alt="Historial de búsqueda">
</p>

## Instalación y compilación

### Instalar un APK existente

Copia `Mama Gamma.apk` o el archivo `app-debug.apk` compilado a tu dispositivo Android. Abre el archivo, toca **Instalar** e inicia Mama Gamma. Si Android solicita permiso, autoriza la instalación desde la aplicación con la que abriste el APK.

### Compilar el APK desde el código fuente

Instala **Android SDK Platform 35**, **Android SDK Build-Tools 35.0.0** y **JDK 17**. Abre el proyecto en Android Studio o indica la ruta del SDK mediante `ANDROID_HOME`. La primera compilación requiere conexión a Internet. [Android Studio](https://developer.android.com/studio) · [Android Gradle Plugin](https://developer.android.com/build/releases/agp-8-11-0-release-notes)

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

**APK compilado** — `app/build/outputs/apk/debug/app-debug.apk`.

<details>
<summary>Instalación con ADB</summary>

Activa la depuración por USB, conecta el dispositivo y acepta la solicitud en su pantalla. Ejecuta el comando desde la raíz del proyecto con Android SDK Platform-Tools instalado.

```sh
adb devices
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

</details>

[Investigación sobre el análisis de audio](../audio-scale-research.md)
