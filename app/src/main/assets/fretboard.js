"use strict";

function createFretboard(section, togglePitch) {
    const { pitchNames, pitchAt } = ScaleFinder;
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
    let interactive = Boolean(togglePitch);

    function build(resetScroll, enabled = Boolean(togglePitch)) {
        interactive = enabled;
        const position = scroll.scrollLeft;
        const instrument = FretSettings.instrument();
        const { pitches: tuning, frets: fretCount } = FretSettings.setup();
        const string = instrument.courses ? "пара струн" : "струна";
        title.textContent = instrument.title;
        tuningLabel.textContent = tuning.slice().reverse().map(pitch => pitchNames[pitch]).join(" · ");
        grid.setAttribute("aria-label", `${instrument.title}, лады от 0 до ${fretCount}`);
        grid.classList.toggle("paired-strings", Boolean(instrument.courses));

        notes.length = 0;
        strings.textContent = "";
        frets.textContent = "";
        strings.appendChild(element("span", "string-heading", instrument.courses ? "Пар." : "Стр."));
        tuning.forEach((openPitch, index) => {
            const label = element("span", "string-label", pitchNames[openPitch]);
            label.dataset.string = index + 1;
            strings.appendChild(label);
        });

        for (let fret = 0; fret <= fretCount; fret += 1) {
            const column = element("div", fret === 0 ? "fret open-fret" : "fret");
            const heading = element("span", "fret-number", fret);
            heading.setAttribute("aria-hidden", "true");
            if (fret > 0 && markers.has(fret % 12)) {
                heading.classList.add(fret % 12 === 0 ? "double-marker" : "marker");
            }
            column.appendChild(heading);

            tuning.forEach((openPitch, index) => {
                const pitch = pitchAt(openPitch, fret);
                const cell = element(interactive ? "button" : "span", "note");
                const label = `${pitchNames[pitch]}, ${string} ${index + 1}, ${fret ? `лад ${fret}` : "открытая"}`;
                if (interactive) {
                    cell.type = "button";
                    cell.addEventListener("click", () => togglePitch(pitch));
                } else {
                    cell.setAttribute("role", "img");
                }
                cell.dataset.string = index + 1;
                cell.appendChild(element("span", "note-key", pitchNames[pitch]));
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
                description = ", в гамме";
            } else if (supported.has(pitch)) {
                state = "hint";
                description = ", подходит к другой гамме";
            }
            cell.dataset.state = state;
            cell.classList.toggle("chosen-root", Boolean(chosen && root));
            if (interactive) cell.setAttribute("aria-pressed", String(chosen));
            else cell.setAttribute("aria-hidden", String(state === "plain"));
            cell.setAttribute("aria-label", label + (root ? ", тоника" : description));
        });
    }

    function updateRange() {
        if (!frets.firstElementChild) return;
        const width = frets.firstElementChild.getBoundingClientRect().width;
        if (!width) return;
        const start = Math.floor((scroll.scrollLeft + 1) / width);
        const end = Math.min(frets.children.length - 1, Math.ceil((scroll.scrollLeft + scroll.clientWidth - 1) / width) - 1);
        range.textContent = `${start}–${end}`;
        previous.disabled = scroll.scrollLeft <= 1;
        next.disabled = scroll.scrollLeft + scroll.clientWidth >= scroll.scrollWidth - 1;
    }

    function page(direction) {
        const width = frets.firstElementChild.getBoundingClientRect().width;
        const count = Math.max(1, Math.floor(scroll.clientWidth / width) - 1);
        const start = Math.round(scroll.scrollLeft / width);
        scroll.scrollTo({ left: (start + direction * count) * width, behavior: "smooth" });
    }

    previous.addEventListener("click", () => page(-1));
    next.addEventListener("click", () => page(1));
    scroll.addEventListener("scroll", updateRange, { passive: true });
    window.addEventListener("resize", updateRange);
    return { build, render, updateRange };
}
