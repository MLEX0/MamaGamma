"use strict";

function createPiano(section, togglePitch) {
    const whitePitches = new Set([0, 2, 4, 5, 7, 9, 11]);
    const navigation = element("div", "piano-octave-navigation");
    const scroll = element("div", "piano-scroll");
    const keyboard = element("div", "piano-keys");
    const legend = element("ul", "legend piano-legend");
    const keys = [];
    let interactive = Boolean(togglePitch);
    let range;
    let leadingOctave;
    let playingKey;

    navigation.setAttribute("role", "group");
    navigation.dataset.i18nAriaLabel = "pianoOctaves";
    legend.dataset.i18nAriaLabel = "legend";
    scroll.addEventListener("scroll", updateOctave, { passive: true });
    new ResizeObserver(updateOctave).observe(scroll);

    const legendItems = [
        ["chosen", "legendSelected", "✓"],
        ["root", "legendTonic", "1"],
        ["scale", "legendInScale"],
        ["hint", "legendSuggested"],
        ["plain", "legendOutOfScale"],
    ].map(([state, label, symbol]) => {
        const item = element("li");
        const marker = element("span", "piano-legend-mark", symbol);
        const text = element("span");
        item.dataset.state = state;
        marker.setAttribute("aria-hidden", "true");
        text.dataset.i18n = label;
        item.append(marker, text);
        legend.appendChild(item);
        return { item, text, state, label };
    });

    scroll.appendChild(keyboard);
    section.classList.add("piano-board");
    section.append(navigation, scroll, legend);

    function octaveWidth() {
        return keyboard.clientWidth / range.octaveCount;
    }

    function updateOctave() {
        if (!range) return;
        const width = octaveWidth();
        if (!width) return;

        const first = Math.round(scroll.scrollLeft / width);
        const count = Math.max(1, Math.round(scroll.clientWidth / width));
        leadingOctave = range.firstOctave + first;
        Array.from(navigation.children).forEach((button, index) => {
            const visible = String(index >= first && index < first + count);
            if (button.getAttribute("aria-pressed") !== visible) button.setAttribute("aria-pressed", visible);
        });
    }

    function scrollToOctave(octave, animate = true) {
        const width = octaveWidth();
        const left = (octave - range.firstOctave) * width;
        const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
        scroll.scrollTo({ left, behavior: animate && !reducedMotion ? "smooth" : "auto" });
    }

    function octaveButton(octave) {
        const label = `${NoteNames.name(0)}${octave}–${NoteNames.name(11)}${octave}`;
        const button = element("button", "piano-octave-button", label);
        button.type = "button";
        button.dataset.octave = octave;
        button.addEventListener("click", () => scrollToOctave(octave));
        return button;
    }

    function buildOctave(octave) {
        const page = element("div", "piano-octave-keys");
        let whites = 0;
        for (let pitch = 0; pitch < 12; pitch += 1) {
            const midi = (octave + 1) * 12 + pitch;
            const note = NoteNames.name(pitch);
            const white = whitePitches.has(pitch);
            const key = element("button", white ? "piano-key piano-white" : "piano-key piano-black");
            const name = element("span", "piano-key-name", note);
            const mark = element("span", "piano-key-mark");
            let pressedTimer;

            key.type = "button";
            key.dataset.midi = midi;
            key.dataset.pitch = pitch;
            key.style.setProperty("--piano-key-position", `${100 * whites / 7}%`);
            mark.setAttribute("aria-hidden", "true");
            if (pitch === 0) name.appendChild(element("span", "piano-octave", octave));
            key.append(mark, name);
            key.addEventListener("click", () => {
                key.classList.add("piano-struck");
                clearTimeout(pressedTimer);
                pressedTimer = setTimeout(() => key.classList.remove("piano-struck"), 140);
                NoteAudio.play(midi);
                if (interactive) togglePitch(pitch);
            });

            page.appendChild(key);
            keys.push({ key, mark, pitch, label: t("pianoKeyLabel", { note, octave }) });
            if (white) whites += 1;
        }
        return page;
    }

    function build(resetScroll, enabled = Boolean(togglePitch)) {
        interactive = enabled;
        range = FretSettings.pianoRange();
        const { firstOctave, octaveCount } = range;
        leadingOctave = resetScroll ? firstOctave : Math.max(firstOctave, Math.min(firstOctave + octaveCount - 1, leadingOctave ?? firstOctave));
        section.dataset.octaveCount = octaveCount;
        keyboard.style.setProperty("--piano-octave-count", octaveCount);
        navigation.hidden = octaveCount === 1;
        playingKey = null;
        keys.length = 0;
        navigation.setAttribute("aria-label", t("pianoOctaves"));
        legend.setAttribute("aria-label", t("legend"));
        legendItems.forEach(({ text, label }) => { text.textContent = t(label); });
        const octaves = Array.from({ length: octaveCount }, (_, index) => firstOctave + index);
        navigation.replaceChildren(...octaves.map(octaveButton));
        keyboard.replaceChildren(...octaves.map(buildOctave));
        scrollToOctave(leadingOctave, false);
        updateOctave();
    }

    function render(scale, selected = [], supported = new Set()) {
        const pitches = scale ? scale.pitches : [];
        legendItems.forEach(({ item, state }) => {
            item.hidden = state === "chosen" || state === "hint" ? !interactive : !scale;
        });
        legend.hidden = !interactive && !scale;
        keys.forEach(({ key, mark, pitch, label }) => {
            const root = scale && pitch === scale.root;
            const chosen = selected.includes(pitch);
            let state = "plain";
            let description = scale ? t("legendOutOfScale") : "";
            if (chosen) {
                state = "chosen";
                description = "";
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
            mark.textContent = root && chosen ? "1 ✓" : root ? "1" : chosen ? "✓" : "";
            mark.hidden = !root && !chosen;
            if (interactive) key.setAttribute("aria-pressed", String(chosen));
            const hint = root ? t("noteTonic") : description;
            key.setAttribute("aria-label", hint ? `${label}, ${hint}` : label);
        });
    }

    function playbackTonic(pitch) {
        const lastStart = range.firstOctave + Math.max(0, range.octaveCount - 2);
        return (Math.min(leadingOctave, lastStart) + 1) * 12 + pitch;
    }

    function setPlaying(midi) {
        playingKey?.classList.remove("piano-playing");
        playingKey = null;
        if (midi === null) return;

        const firstMidi = (range.firstOctave + 1) * 12;
        // In a one-octave layout, show the pitch class when the phrase wraps above the displayed keys.
        const index = range.octaveCount === 1 ? midi % 12 : midi - firstMidi;
        playingKey = keys[index]?.key;
        if (!playingKey) return;
        playingKey.classList.add("piano-playing");

        const width = octaveWidth();
        const octaveIndex = Math.floor(index / 12);
        const offset = octaveIndex * width;
        if (offset < scroll.scrollLeft - 1 || offset + width > scroll.scrollLeft + scroll.clientWidth + 1) {
            scrollToOctave(range.firstOctave + octaveIndex);
        }
    }

    return { build, render, playbackTonic, setPlaying };
}
