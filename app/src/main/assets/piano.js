"use strict";

function createPiano(section, togglePitch) {
    const whitePitches = new Set([0, 2, 4, 5, 7, 9, 11]);
    const scroll = element("div", "piano-scroll");
    const keyboard = element("div", "piano-keys");
    const keys = [];
    let interactive = Boolean(togglePitch);

    scroll.appendChild(keyboard);
    section.classList.add("piano-board");
    section.appendChild(scroll);

    function build(resetScroll, enabled = Boolean(togglePitch)) {
        interactive = enabled;
        const position = scroll.scrollLeft;
        const fragment = document.createDocumentFragment();
        let whites = 0;
        keys.length = 0;

        for (let midi = 60; midi < 84; midi += 1) {
            const pitch = midi % 12;
            const octave = Math.floor(midi / 12) - 1;
            const note = NoteNames.name(pitch);
            const white = whitePitches.has(pitch);
            const key = element("button", white ? "piano-key piano-white" : "piano-key piano-black");
            const name = element("span", "piano-key-name", note);
            const label = t("pianoKeyLabel", { note, octave });

            key.type = "button";
            key.dataset.midi = midi;
            key.dataset.pitch = pitch;
            key.style.setProperty("--piano-key-position", `${100 * whites / 14}%`);
            key.setAttribute("aria-label", label);
            key.appendChild(name);
            if (pitch === 0) key.appendChild(element("span", "piano-octave", octave));
            key.addEventListener("click", () => {
                NoteAudio.play(midi);
                if (interactive) togglePitch(pitch);
            });

            fragment.appendChild(key);
            keys.push({ key, pitch, label });
            if (white) whites += 1;
        }

        keyboard.textContent = "";
        keyboard.appendChild(fragment);
        scroll.scrollLeft = resetScroll ? 0 : position;
    }

    function render(scale, selected = [], supported = new Set()) {
        const pitches = scale ? scale.pitches : [];
        keys.forEach(({ key, pitch, label }) => {
            const root = scale && pitch === scale.root;
            const chosen = selected.includes(pitch);
            let state = "plain";
            let description = "";
            if (chosen) {
                state = "chosen";
            } else if (root) {
                state = "root";
            } else if (pitches.includes(pitch)) {
                state = "scale";
                description = t("noteInScale");
            } else if (supported.has(pitch)) {
                state = "hint";
                description = t("noteInOtherScale");
            }

            key.dataset.state = state;
            key.classList.toggle("piano-chosen-root", Boolean(chosen && root));
            if (interactive) {
                key.setAttribute("aria-pressed", String(chosen));
            } else {
                const visible = state !== "plain";
                key.disabled = !visible || !FretSettings.soundEnabled();
                key.setAttribute("aria-hidden", String(!visible));
            }
            const hint = root ? t("noteTonic") : description;
            key.setAttribute("aria-label", hint ? `${label}, ${hint}` : label);
        });
    }

    return { build, render };
}
