"use strict";

const FretSettings = (() => {
    const { pitchNames } = ScaleFinder;
    const storageKey = "gammama-settings-v1";
    const themes = ["system", "light", "dark"];
    const minFrets = 12;
    const maxFrets = 36;

    function preset(id, name, notes) {
        return { id, name, pitches: notes.split(" ").reverse().map(note => pitchNames.indexOf(note)) };
    }

    // Presets are written in physical order, from the last string to the first.
    const instruments = [
        {
            id: "guitar", name: "Гитара", title: "Гитарный гриф", defaultFrets: 24,
            tunings: [
                preset("standard", "Стандартный", "E A D G B E"),
                preset("drop-d", "Drop D", "D A D G B E"),
                preset("d-standard", "D Standard", "D G C F A D"),
                preset("open-g", "Open G", "D G D G B D"),
                preset("open-d", "Open D", "D A D F♯ A D"),
                preset("dadgad", "DADGAD", "D A D G A D"),
            ],
        },
        {
            id: "bass", name: "Бас-гитара", title: "Бас-гитара", defaultFrets: 24,
            tunings: [
                preset("standard", "Стандартный", "E A D G"),
                preset("drop-d", "Drop D", "D A D G"),
                preset("d-standard", "D Standard", "D G C F"),
            ],
        },
        {
            id: "ukulele", name: "Укулеле", title: "Укулеле", defaultFrets: 18,
            tunings: [
                preset("standard", "Стандартный", "G C E A"),
                preset("baritone", "Баритон", "D G B E"),
            ],
        },
        {
            id: "mandolin", name: "Мандолина", title: "Мандолина", defaultFrets: 20, courses: true,
            tunings: [preset("standard", "Стандартный", "G D A E")],
        },
    ];

    const dialog = document.getElementById("settings-dialog");
    const open = document.getElementById("settings-open");
    const themeOptions = document.getElementById("theme-options");
    const instrumentPicker = document.getElementById("instrument-picker");
    const tuningPicker = document.getElementById("tuning-picker");
    const stringTuning = document.getElementById("string-tuning");
    const stringsTitle = document.getElementById("strings-title");
    const fretLength = document.getElementById("fret-length");
    const less = document.getElementById("length-less");
    const more = document.getElementById("length-more");
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
    const appearance = window.GammaMamaAppearance;
    const state = restore();

    function restore() {
        let saved;
        try {
            saved = JSON.parse(localStorage.getItem(storageKey));
        } catch (error) {
            // The settings still work if local storage is unavailable.
        }
        saved = saved || {};
        const instrument = instruments.find(item => item.id === saved.instrument) || instruments[0];
        const theme = appearance ? appearance.themeMode() : saved.theme;
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
                frets: validFrets ? previous.frets : item.defaultFrets,
            };
        });
        return { instrument: instrument.id, theme: themes.includes(theme) ? theme : "system", setups };
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
        const pitches = tuning === "custom" ? customPitches : instrument().tunings.find(item => item.id === tuning).pitches;
        return { pitches, frets };
    }

    function applyTheme() {
        const systemDark = appearance ? appearance.systemDark() : systemTheme.matches;
        const dark = state.theme === "dark" || (state.theme === "system" && systemDark);
        document.documentElement.dataset.theme = dark ? "dark" : "light";
        if (appearance) appearance.setThemeMode(state.theme);
    }

    function options(select, items) {
        select.textContent = "";
        items.forEach(({ id, name }) => select.add(new Option(name, id)));
    }

    function renderStrings() {
        stringTuning.textContent = "";
        const courses = instrument().courses;
        stringsTitle.textContent = courses ? "Ноты открытых пар струн" : "Ноты открытых струн";
        setup().pitches.forEach((pitch, index) => {
            const label = document.createElement("label");
            const number = document.createElement("span");
            const select = document.createElement("select");
            number.textContent = index + 1;
            number.setAttribute("aria-hidden", "true");
            select.className = "settings-select";
            select.dataset.stringIndex = index;
            select.setAttribute("aria-label", `${courses ? "Пара" : "Струна"} ${index + 1}`);
            pitchNames.forEach((name, value) => select.add(new Option(name, value)));
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
        options(tuningPicker, instrument().tunings.concat({ id: "custom", name: "Свой строй" }));
        tuningPicker.value = profile().tuning;
        renderStrings();
        renderFrets();
    }

    function init(onSetupChange) {
        applyTheme();
        if (!appearance && systemTheme.addEventListener) systemTheme.addEventListener("change", applyTheme);
        themeOptions.querySelector(`input[value="${state.theme}"]`).checked = true;
        themeOptions.addEventListener("change", event => {
            state.theme = event.target.value;
            applyTheme();
            persist();
        });

        options(instrumentPicker, instruments);
        instrumentPicker.value = state.instrument;
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
        open.addEventListener("click", () => dialog.showModal());
        document.getElementById("settings-close").addEventListener("click", () => dialog.close());
        document.getElementById("settings-done").addEventListener("click", () => dialog.close());
        dialog.addEventListener("click", event => {
            if (event.target === dialog) dialog.close();
        });
        renderSetup();
    }

    return { instrument, setup, init };
})();
