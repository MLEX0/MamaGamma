"use strict";

function createFretboard(section, togglePitch) {
    const { pitchAt } = ScaleFinder;
    const markers = new Set([0, 3, 5, 7, 9]);
    const grid = section.querySelector(".fretboard");
    const strings = section.querySelector(".strings");
    const frets = section.querySelector(".frets");
    const scroll = section.querySelector(".fret-scroll");
    const previous = section.querySelector(".previous");
    const next = section.querySelector(".arrow:not(.previous)");
    const range = section.querySelector(".fret-range");
    const title = section.querySelector(".board-instrument h2, .board-instrument h3");
    const tuningLabel = section.querySelector(".tuning");
    const notes = [];
    const rangeView = section.hasAttribute("data-fret-range");
    let interactive = Boolean(togglePitch);
    let firstFret = 0;

    function build(resetScroll, enabled = Boolean(togglePitch), bounds = {}) {
        interactive = enabled;
        const position = scroll.scrollLeft;
        const instrument = FretSettings.instrument();
        const { pitches: tuning, midi, frets: fretCount } = FretSettings.setup();
        const pitchNames = NoteNames.names();
        const { from = 0, to = fretCount } = bounds;
        firstFret = from;
        if (rangeView) frets.style.setProperty("--fret-columns", Math.min(13, to - from + 1));
        const instrumentTitle = t(instrument.title || instrument.name);
        const stringLabels = tuning.map((_, index) => t(instrument.courses ? "stringPairNumber" : "stringNumber", { number: index + 1 }));
        title.textContent = instrumentTitle;
        tuningLabel.textContent = tuning.slice().reverse().map(pitch => pitchNames[pitch]).join(" · ");
        grid.setAttribute("aria-label", t("fretboardRange", { instrument: instrumentTitle, from, to }));
        grid.classList.toggle("paired-strings", Boolean(instrument.courses));

        notes.length = 0;
        strings.textContent = "";
        frets.textContent = "";
        strings.appendChild(element("span", "string-heading", t(instrument.courses ? "stringPairShort" : "stringShort")));
        tuning.forEach((openPitch, index) => {
            const label = element("span", "string-label", pitchNames[openPitch]);
            label.classList.toggle("long-note", pitchNames[openPitch].length > 3);
            label.dataset.string = index + 1;
            strings.appendChild(label);
        });

        for (let fret = from; fret <= to; fret += 1) {
            const positionLabel = fret ? t("fretNumber", { number: fret }) : t("openNote");
            const column = element("div", fret === 0 ? "fret open-fret" : "fret");
            const heading = element("span", "fret-number", fret);
            heading.setAttribute("aria-hidden", "true");
            if (fret > 0 && markers.has(fret % 12)) {
                heading.classList.add(fret % 12 === 0 ? "double-marker" : "marker");
            }
            column.appendChild(heading);

            tuning.forEach((openPitch, index) => {
                const pitch = pitchAt(openPitch, fret);
                const cell = element("button", "note");
                const label = `${pitchNames[pitch]}, ${stringLabels[index]}, ${positionLabel}`;
                cell.type = "button";
                cell.addEventListener("click", () => {
                    NoteAudio.play(midi[index] + fret);
                    if (interactive) togglePitch(pitch);
                });
                cell.dataset.string = index + 1;
                const key = element("span", "note-key", pitchNames[pitch]);
                key.classList.toggle("long-note", pitchNames[pitch].length > 3);
                cell.appendChild(key);
                column.appendChild(cell);
                notes.push({ cell, pitch, label });
            });
            frets.appendChild(column);
        }
        scroll.scrollLeft = resetScroll ? 0 : position;
        updateRange();
    }

    function render(scale, selected = [], supported = new Set()) {
        const pitches = scale ? scale.pitches : [];
        notes.forEach(({ cell, pitch, label }) => {
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
            cell.dataset.state = state;
            cell.classList.toggle("chosen-root", Boolean(chosen && root));
            if (interactive) {
                cell.setAttribute("aria-pressed", String(chosen));
            } else {
                const visible = state !== "plain";
                cell.disabled = !visible || !FretSettings.soundEnabled();
                cell.setAttribute("aria-hidden", String(!visible));
            }
            const hint = root ? t("noteTonic") : description;
            cell.setAttribute("aria-label", hint ? `${label}, ${hint}` : label);
        });
    }

    function setPlaying(midi) {
        const playingPitch = midi === null ? null : midi % 12;
        notes.forEach(({ cell, pitch }) => cell.classList.toggle("note-playing", pitch === playingPitch));
    }

    function updateRange() {
        if (!frets.firstElementChild) return;
        const width = frets.firstElementChild.getBoundingClientRect().width;
        if (!width) return;
        const start = Math.floor((scroll.scrollLeft + 1) / width);
        const end = Math.min(frets.children.length - 1, Math.ceil((scroll.scrollLeft + scroll.clientWidth - 1) / width) - 1);
        range.textContent = `${firstFret + start}–${firstFret + end}`;
        previous.disabled = scroll.scrollLeft <= 1;
        next.disabled = scroll.scrollLeft + scroll.clientWidth >= scroll.scrollWidth - 1;
    }

    function leadingFret() {
        const width = frets.firstElementChild.getBoundingClientRect().width;
        return firstFret + Math.round(scroll.scrollLeft / width);
    }

    function scrollToFret(fret, behavior = "auto") {
        const width = frets.firstElementChild.getBoundingClientRect().width;
        scroll.scrollTo({ left: (fret - firstFret) * width, behavior });
        updateRange();
    }

    function page(direction) {
        const width = frets.firstElementChild.getBoundingClientRect().width;
        const count = rangeView ? 1 : Math.max(1, Math.floor(scroll.clientWidth / width) - 1);
        scrollToFret(leadingFret() + direction * count, "smooth");
    }

    previous.addEventListener("click", () => page(-1));
    next.addEventListener("click", () => page(1));
    scroll.addEventListener("scroll", updateRange, { passive: true });
    window.addEventListener("resize", updateRange);
    return { build, render, setPlaying, updateRange, leadingFret, scrollToFret };
}
