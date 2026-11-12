"use strict";

const FretSettings = (() => {
    const { pitchNames } = ScaleFinder;
    const storageKey = "gammama-settings-v1";
    const themes = ["system", "light", "dark"];
    const minFrets = 12;
    const maxFrets = 36;
    const lowestOctave = 2;
    const highestOctave = 7;
    const maxOctaveCount = 5;
    const defaultOctaveCount = 2;
    const defaultFirstOctave = 4;
    const minTempo = 50;
    const maxTempo = 180;
    const defaultTempo = 96;

    function preset(id, name, notes) {
        const midi = notes.split(" ").reverse().map(note => {
            const octave = Number(note.slice(-1));
            return 12 * (octave + 1) + pitchNames.indexOf(note.slice(0, -1));
        });
        return { id, name, midi, pitches: midi.map(note => note % 12) };
    }

    // Presets are written in physical order, from the last string to the first.
    const instruments = [
        {
            id: "guitar", name: "guitarName", title: "guitarFretboard",
            tunings: [
                preset("standard", "standardTuning", "E2 A2 D3 G3 B3 E4"),
                preset("drop-d", "Drop D", "D2 A2 D3 G3 B3 E4"),
                preset("d-standard", "D Standard", "D2 G2 C3 F3 A3 D4"),
                preset("open-g", "Open G", "D2 G2 D3 G3 B3 D4"),
                preset("open-d", "Open D", "D2 A2 D3 F♯3 A3 D4"),
                preset("dadgad", "DADGAD", "D2 A2 D3 G3 A3 D4"),
            ],
        },
        {
            id: "bass", name: "bassName",
            tunings: [
                preset("standard", "standardTuning", "E1 A1 D2 G2"),
                preset("drop-d", "Drop D", "D1 A1 D2 G2"),
                preset("d-standard", "D Standard", "D1 G1 C2 F2"),
            ],
        },
        {
            id: "ukulele", name: "ukuleleName",
            tunings: [
                preset("standard", "standardTuning", "G4 C4 E4 A4"),
                preset("baritone", "baritoneTuning", "D3 G3 B3 E4"),
            ],
        },
        {
            id: "mandolin", name: "mandolinName", courses: true,
            tunings: [preset("standard", "standardTuning", "G3 D4 A4 E5")],
        },
    ];

    const themeOptions = document.getElementById("theme-options");
    const languagePicker = document.getElementById("language-picker");
    const noteSystemPicker = document.getElementById("note-system-picker");
    const sharpsOnlySwitch = document.getElementById("sharps-only");
    const soundSwitch = document.getElementById("note-sound");
    const volumeSlider = document.getElementById("note-volume");
    const volumeValue = document.getElementById("note-volume-value");
    const previewButton = document.getElementById("note-preview");
    const tempoSlider = document.getElementById("scale-tempo");
    const tempoValue = document.getElementById("scale-tempo-value");
    const octaveCountPicker = document.getElementById("piano-octave-count");
    const firstOctavePicker = document.getElementById("piano-first-octave");
    const instrumentPicker = document.getElementById("instrument-picker");
    const tuningPicker = document.getElementById("tuning-picker");
    const stringTuning = document.getElementById("string-tuning");
    const stringsTitle = document.getElementById("strings-title");
    const fretLength = document.getElementById("fret-length");
    const less = document.getElementById("length-less");
    const more = document.getElementById("length-more");
    const systemTheme = AppTheme.system;
    const appearance = window.GammaMamaAppearance;
    let state = restore();
    I18n.setMode(state.language);
    NoteNames.setMode(state.noteSystem);
    NoteNames.setSharpsOnly(state.sharpsOnly);

    function restore() {
        let saved;
        try {
            saved = JSON.parse(localStorage.getItem(storageKey));
        } catch (error) {
            // The settings still work if local storage is unavailable.
        }
        saved = saved || {};
        return readSettings(saved, appearance ? appearance.themeMode() : saved.theme);
    }

    function readSettings(saved, theme) {
        const instrument = instruments.find(item => item.id === saved.instrument) || instruments[0];
        const setups = {};
        instruments.forEach(item => {
            const previous = saved.setups && saved.setups[item.id] || {};
            const standard = item.tunings[0];
            const known = item.tunings.find(tuning => tuning.id === previous.tuning);
            const customPitches = previous.customPitches;
            const validCustom = Array.isArray(customPitches) && customPitches.length === standard.pitches.length
                && customPitches.every(pitch => Number.isInteger(pitch) && pitch >= 0 && pitch < pitchNames.length);
            const validFrets = Number.isInteger(previous.frets) && previous.frets >= minFrets && previous.frets <= maxFrets;
            setups[item.id] = {
                tuning: previous.tuning === "custom" && validCustom ? "custom" : (known || standard).id,
                customPitches: validCustom ? customPitches : null,
                frets: validFrets ? previous.frets : minFrets,
            };
        });
        const volume = Number.isInteger(saved.volume) && saved.volume >= 0 && saved.volume <= 100 ? saved.volume : 100;
        const language = I18n.languages.some(item => item.id === saved.language) ? saved.language : "system";
        const noteSystem = NoteNames.systems.some(item => item.id === saved.noteSystem) ? saved.noteSystem : "international";
        const tempo = Number.isInteger(saved.tempo) ? Math.min(maxTempo, Math.max(minTempo, saved.tempo)) : defaultTempo;
        const piano = readPianoRange(saved.piano || {});
        return { instrument: instrument.id, theme: themes.includes(theme) ? theme : "system", language, noteSystem,
            sharpsOnly: saved.sharpsOnly === true, sound: saved.sound !== false, volume, tempo, piano, setups };
    }

    function readPianoRange({ firstOctave, octaveCount }) {
        const count = Number.isInteger(octaveCount) ? Math.min(maxOctaveCount, Math.max(1, octaveCount)) : defaultOctaveCount;
        const start = Number.isInteger(firstOctave) ? firstOctave : defaultFirstOctave;
        return {
            firstOctave: Math.min(highestOctave - count + 1, Math.max(lowestOctave, start)),
            octaveCount: count,
        };
    }

    function persist() {
        try {
            localStorage.setItem(storageKey, JSON.stringify(state));
        } catch (error) {
            // Keep the current configuration available in memory.
        }
    }

    function instrument() {
        return instruments.find(item => item.id === state.instrument);
    }

    function profile() {
        return state.setups[state.instrument];
    }

    function setup() {
        const { tuning, customPitches, frets } = profile();
        const tunings = instrument().tunings;
        if (tuning !== "custom") {
            const { pitches, midi } = tunings.find(item => item.id === tuning);
            return { pitches, midi, frets };
        }
        // Custom tuning stores pitch classes. Use the nearest pitch to each standard open string.
        const midi = tunings[0].midi.map((note, index) => note + (customPitches[index] - note % 12 + 18) % 12 - 6);
        return { pitches: customPitches, midi, frets };
    }

    function soundEnabled() {
        return state.sound;
    }

    function noteVolume() {
        return state.volume / 100;
    }

    function pianoRange() {
        return { ...state.piano };
    }

    function scaleTempo() {
        return state.tempo;
    }

    function applyTheme() {
        AppTheme.apply(state.theme);
        if (appearance) appearance.setThemeMode(state.theme);
    }

    function options(select, items) {
        select.textContent = "";
        items.forEach(({ id, name }) => select.add(new Option(t(name), id)));
    }

    function renderStrings() {
        stringTuning.textContent = "";
        const courses = instrument().courses;
        stringsTitle.textContent = t(courses ? "openStringPairs" : "openStrings");
        setup().pitches.forEach((pitch, index) => {
            const label = document.createElement("label");
            const number = document.createElement("span");
            const select = document.createElement("select");
            number.textContent = index + 1;
            number.setAttribute("aria-hidden", "true");
            select.className = "settings-select";
            select.dataset.stringIndex = index;
            select.setAttribute("aria-label", t(courses ? "stringPairNumber" : "stringNumber", { number: index + 1 }));
            NoteNames.names().forEach((name, value) => select.add(new Option(name, value)));
            select.value = String(pitch);
            label.appendChild(number);
            label.appendChild(select);
            stringTuning.appendChild(label);
        });
    }

    function renderFrets() {
        const frets = setup().frets;
        fretLength.value = frets;
        less.disabled = frets <= minFrets;
        more.disabled = frets >= maxFrets;
    }

    function renderSetup() {
        options(tuningPicker, instrument().tunings.concat({ id: "custom", name: "customTuning" }));
        tuningPicker.value = profile().tuning;
        renderStrings();
        renderFrets();
    }

    function renderVolume() {
        volumeSlider.value = state.volume;
        volumeSlider.disabled = !state.sound;
        previewButton.disabled = !state.sound || state.volume === 0;
        volumeSlider.setAttribute("aria-valuetext", `${state.volume}%`);
        volumeValue.value = `${state.volume}%`;
    }

    function renderTempo() {
        tempoSlider.value = state.tempo;
        tempoValue.value = t("tempoBpm", { tempo: state.tempo });
        tempoSlider.setAttribute("aria-valuetext", tempoValue.value);
    }

    function renderPianoRange() {
        const { firstOctave, octaveCount } = state.piano;
        octaveCountPicker.value = String(octaveCount);
        firstOctavePicker.textContent = "";
        const maxStart = highestOctave - octaveCount + 1;
        for (let octave = lowestOctave; octave <= maxStart; octave += 1) {
            firstOctavePicker.add(new Option(`${NoteNames.name(0)}${octave}`, octave));
        }
        firstOctavePicker.value = String(firstOctave);
    }

    function renderSettings() {
        applyTheme();
        themeOptions.querySelector(`input[value="${state.theme}"]`).checked = true;
        soundSwitch.checked = state.sound;
        renderVolume();
        renderTempo();
        renderPianoRange();
        options(languagePicker, [{ id: "system", name: "systemLanguage" }, ...I18n.languages]);
        languagePicker.value = state.language;
        options(noteSystemPicker, NoteNames.systems.map(({ id, label }) => ({ id, name: label })));
        noteSystemPicker.value = state.noteSystem;
        sharpsOnlySwitch.checked = state.sharpsOnly;
        options(instrumentPicker, instruments);
        instrumentPicker.value = state.instrument;
        renderSetup();
        if (appearance?.appVersion) {
            const version = document.getElementById("app-version");
            version.textContent = t("versionLabel", { version: appearance.appVersion() });
            version.hidden = false;
        }
    }

    function reset() {
        state = readSettings({}, "system");
        I18n.setMode(state.language);
        NoteNames.setMode(state.noteSystem);
        NoteNames.setSharpsOnly(state.sharpsOnly);
        renderSettings();
        persist();
    }

    function init(onSetupChange, onSoundChange, onVolumeChange, onPreview, onLanguageChange, onNotationChange) {
        if (!appearance && systemTheme.addEventListener) systemTheme.addEventListener("change", applyTheme);
        languagePicker.addEventListener("change", () => {
            state.language = languagePicker.value;
            const changed = I18n.setMode(state.language);
            if (changed) {
                renderSettings();
                onLanguageChange();
            }
            persist();
        });
        noteSystemPicker.addEventListener("change", () => {
            state.noteSystem = noteSystemPicker.value;
            if (NoteNames.setMode(state.noteSystem)) {
                renderStrings();
                renderPianoRange();
                onNotationChange();
            }
            persist();
        });
        sharpsOnlySwitch.addEventListener("change", () => {
            state.sharpsOnly = sharpsOnlySwitch.checked;
            NoteNames.setSharpsOnly(state.sharpsOnly);
            renderStrings();
            onNotationChange();
            persist();
        });
        themeOptions.addEventListener("change", event => {
            state.theme = event.target.value;
            applyTheme();
            persist();
        });

        soundSwitch.addEventListener("change", () => {
            state.sound = soundSwitch.checked;
            renderVolume();
            persist();
            onSoundChange(state.sound);
        });
        volumeSlider.addEventListener("input", () => {
            state.volume = volumeSlider.valueAsNumber;
            renderVolume();
            onVolumeChange();
        });
        volumeSlider.addEventListener("change", () => {
            persist();
            if (state.volume > 0) onPreview();
        });
        previewButton.addEventListener("click", onPreview);

        tempoSlider.min = minTempo;
        tempoSlider.max = maxTempo;
        tempoSlider.addEventListener("input", () => {
            state.tempo = tempoSlider.valueAsNumber;
            renderTempo();
        });
        tempoSlider.addEventListener("change", persist);

        for (let count = 1; count <= maxOctaveCount; count += 1) {
            octaveCountPicker.add(new Option(String(count), count));
        }
        const setPianoRange = () => {
            state.piano = readPianoRange({
                firstOctave: Number(firstOctavePicker.value),
                octaveCount: Number(octaveCountPicker.value),
            });
            renderPianoRange();
            persist();
            onSetupChange(false);
        };
        firstOctavePicker.addEventListener("change", setPianoRange);
        octaveCountPicker.addEventListener("change", setPianoRange);

        instrumentPicker.addEventListener("change", () => {
            state.instrument = instrumentPicker.value;
            renderSetup();
            persist();
            onSetupChange(true);
        });

        tuningPicker.addEventListener("change", () => {
            const active = profile();
            if (tuningPicker.value === "custom" && !active.customPitches) {
                active.customPitches = setup().pitches.slice();
            }
            active.tuning = tuningPicker.value;
            renderStrings();
            persist();
            onSetupChange(false);
        });

        stringTuning.addEventListener("change", event => {
            const select = event.target;
            const active = profile();
            const pitches = setup().pitches.slice();
            pitches[Number(select.dataset.stringIndex)] = Number(select.value);
            active.customPitches = pitches;
            active.tuning = "custom";
            tuningPicker.value = "custom";
            persist();
            onSetupChange(false);
        });

        function setFrets(value) {
            const active = profile();
            const previous = active.frets;
            active.frets = Number.isFinite(value) ? Math.min(maxFrets, Math.max(minFrets, Math.round(value))) : previous;
            renderFrets();
            if (active.frets !== previous) {
                persist();
                onSetupChange(false);
            }
        }

        fretLength.min = minFrets;
        fretLength.max = maxFrets;
        fretLength.addEventListener("change", () => setFrets(fretLength.valueAsNumber));
        fretLength.addEventListener("keydown", event => {
            if (event.key === "Enter") fretLength.blur();
        });
        less.addEventListener("click", () => setFrets(profile().frets - 1));
        more.addEventListener("click", () => setFrets(profile().frets + 1));
        renderSettings();
    }

    return { instrument, setup, soundEnabled, noteVolume, pianoRange, scaleTempo, init, reset };
})();
