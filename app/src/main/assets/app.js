"use strict";

const { pitchNames, pitchAt, match } = ScaleFinder;
const tuning = [4, 11, 7, 2, 9, 4];
const lastFret = 24;
const markers = new Set([3, 5, 7, 9, 12, 15, 17, 19, 21, 24]);
const previewLimit = 5;
const storageKey = "gammama-session-v1";
const byId = id => document.getElementById(id);

const picker = byId("scale-picker");
const board = byId("frets");
const scroll = byId("fret-scroll");
const strings = byId("strings");
const previous = byId("fret-prev");
const next = byId("fret-next");
const range = byId("fret-range");
const selection = byId("selected-notes");
const reset = byId("reset");
const results = byId("results");
const more = byId("more");
const hintLegend = byId("hint-legend");
const counter = byId("match-count");

let { selected, pinnedScale } = restore();
let matches = [];
let activeScale = null;
let showAll = false;
const fretButtons = [];

function restore() {
    try {
        const saved = JSON.parse(localStorage.getItem(storageKey));
        if (saved && Array.isArray(saved.selected)) {
            const pitches = saved.selected.filter(pitch => Number.isInteger(pitch) && pitch >= 0 && pitch < 12);
            return { selected: Array.from(new Set(pitches)), pinnedScale: saved.pinnedScale };
        }
    } catch (error) {
        // Storage may be unavailable. The current session still works.
    }
    return { selected: [], pinnedScale: null };
}

function persist() {
    try {
        localStorage.setItem(storageKey, JSON.stringify({ selected, pinnedScale }));
    } catch (error) {
        // The next change will remain usable in memory.
    }
}

function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
}

function buildBoard() {
    strings.appendChild(element("span", "string-heading", "Стр."));
    tuning.forEach((openPitch, index) => {
        const label = element("span", "string-label", pitchNames[openPitch]);
        label.dataset.string = index + 1;
        strings.appendChild(label);
    });

    for (let fret = 0; fret <= lastFret; fret += 1) {
        const column = element("div", fret === 0 ? "fret open-fret" : "fret");
        const heading = element("span", "fret-number", fret);
        heading.setAttribute("aria-hidden", "true");
        if (markers.has(fret)) {
            heading.classList.add(fret % 12 === 0 ? "double-marker" : "marker");
        }
        column.appendChild(heading);

        tuning.forEach((openPitch, index) => {
            const pitch = pitchAt(openPitch, fret);
            const button = element("button", "note");
            const label = `${pitchNames[pitch]}, струна ${index + 1}, ${fret ? `лад ${fret}` : "открытая"}`;
            button.type = "button";
            button.dataset.string = index + 1;
            button.appendChild(element("span", "note-key", pitchNames[pitch]));
            button.addEventListener("click", () => togglePitch(pitch));
            column.appendChild(button);
            fretButtons.push({ button, pitch, label });
        });
        board.appendChild(column);
    }
}

function togglePitch(pitch) {
    if (selected.includes(pitch)) {
        selected = selected.filter(note => note !== pitch);
    } else {
        selected.push(pitch);
    }
    updateMatches();
}

function updateMatches() {
    matches = match(selected);
    activeScale = matches.find(scale => scale.id === pinnedScale);
    if (!activeScale) {
        pinnedScale = null;
        activeScale = matches[0] || null;
    }
    showAll = false;
    persist();
    renderPicker();
    renderBoard();
    renderSelection();
    renderResults();
}

function renderPicker() {
    picker.textContent = "";
    picker.disabled = matches.length === 0;
    if (picker.disabled) {
        picker.appendChild(element("option", "", "Нет подходящих гамм"));
        return;
    }
    matches.forEach(scale => {
        const option = element("option", "", scale.name);
        option.value = scale.id;
        picker.appendChild(option);
    });
    picker.value = activeScale.id;
}

function setPreview(id) {
    const scale = matches.find(candidate => candidate.id === id);
    if (!scale) return;
    activeScale = scale;
    pinnedScale = id;
    picker.value = id;
    persist();
    renderBoard();
    updateActiveResult();
}

function renderBoard() {
    const supported = new Set();
    if (selected.length) {
        matches.forEach(scale => scale.pitches.forEach(pitch => supported.add(pitch)));
    }
    const previewPitches = activeScale ? activeScale.pitches : [];
    hintLegend.hidden = !Array.from(supported).some(pitch => !previewPitches.includes(pitch));

    fretButtons.forEach(({ button, pitch, label }) => {
        const chosen = selected.includes(pitch);
        const root = activeScale && pitch === activeScale.root;
        let state = "plain";
        let description = "";
        if (chosen) {
            state = "chosen";
            if (root) description = ", тоника";
        } else if (root) {
            state = "root";
            description = ", тоника";
        } else if (previewPitches.includes(pitch)) {
            state = "scale";
            description = ", в гамме";
        } else if (supported.has(pitch)) {
            state = "hint";
            description = ", подходит к другой гамме";
        }
        button.dataset.state = state;
        button.classList.toggle("chosen-root", Boolean(chosen && root));
        button.setAttribute("aria-pressed", String(chosen));
        button.setAttribute("aria-label", label + description);
    });
}

function renderSelection() {
    selection.textContent = "";
    reset.disabled = selected.length === 0;
    if (reset.disabled) {
        selection.appendChild(element("p", "selection-placeholder", "Выбери первую ноту на грифе."));
        return;
    }
    selected.forEach(pitch => {
        const chip = element("button", "selected-chip", pitchNames[pitch]);
        chip.type = "button";
        chip.setAttribute("aria-label", `Убрать ноту ${pitchNames[pitch]}`);
        const remove = element("span", "", "×");
        remove.setAttribute("aria-hidden", "true");
        chip.appendChild(remove);
        chip.addEventListener("click", () => togglePitch(pitch));
        selection.appendChild(chip);
    });
}

function renderResults() {
    counter.textContent = matches.length;
    counter.setAttribute("aria-label", `Найдено гамм — ${matches.length}`);
    results.textContent = "";
    more.hidden = matches.length <= previewLimit;
    more.textContent = showAll ? "Свернуть список" : `Показать все (${matches.length})`;
    more.setAttribute("aria-expanded", String(showAll));

    if (!matches.length) {
        results.appendChild(element("p", "empty", "Для этого набора нот гамм не найдено. Убери одну из выбранных нот."));
        return;
    }

    const visible = showAll ? matches : matches.slice(0, previewLimit);
    visible.forEach(scale => {
        const button = element("button", "result");
        button.type = "button";
        button.dataset.scale = scale.id;
        button.addEventListener("click", () => setPreview(scale.id));
        button.appendChild(element("span", "result-root", pitchNames[scale.root]));
        const text = element("span", "result-text");
        text.appendChild(element("strong", "result-name", scale.name));
        text.appendChild(element("span", "result-pitches", scale.pitches.map(pitch => pitchNames[pitch]).join("  ·  ")));
        button.appendChild(text);
        const check = element("span", "result-check", "✓");
        check.setAttribute("aria-hidden", "true");
        button.appendChild(check);
        results.appendChild(button);
    });
    updateActiveResult();
}

function updateActiveResult() {
    results.querySelectorAll(".result").forEach(button => {
        const active = button.dataset.scale === activeScale.id;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
    });
}

function updateFretRange() {
    const width = board.firstElementChild.getBoundingClientRect().width;
    if (!width) return;
    const start = Math.floor((scroll.scrollLeft + 1) / width);
    const end = Math.min(lastFret, Math.ceil((scroll.scrollLeft + scroll.clientWidth - 1) / width) - 1);
    range.textContent = `${start}–${end}`;
    previous.disabled = scroll.scrollLeft <= 1;
    next.disabled = scroll.scrollLeft + scroll.clientWidth >= scroll.scrollWidth - 1;
}

function pageFrets(direction) {
    const width = board.firstElementChild.getBoundingClientRect().width;
    const count = Math.max(1, Math.floor(scroll.clientWidth / width) - 1);
    const start = Math.round(scroll.scrollLeft / width);
    scroll.scrollTo({ left: (start + direction * count) * width, behavior: "smooth" });
}

picker.addEventListener("change", () => setPreview(picker.value));
reset.addEventListener("click", () => {
    selected = [];
    pinnedScale = null;
    updateMatches();
});
more.addEventListener("click", () => {
    showAll = !showAll;
    renderResults();
    if (!showAll) more.scrollIntoView({ block: "nearest" });
});
previous.addEventListener("click", () => pageFrets(-1));
next.addEventListener("click", () => pageFrets(1));
scroll.addEventListener("scroll", updateFretRange, { passive: true });
window.addEventListener("resize", updateFretRange);

buildBoard();
updateMatches();
updateFretRange();
