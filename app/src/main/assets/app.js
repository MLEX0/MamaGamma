"use strict";

const { pitchNames, match } = ScaleFinder;
const previewLimit = 5;
const storageKey = "gammama-session-v1";
const byId = id => document.getElementById(id);

const workspace = byId("workspace");
const instrumentPanel = byId("instrument-panel");
const matchPanel = byId("match-panel");
const noteMode = byId("mode-notes");
const chordMode = byId("mode-chords");
const chordForm = byId("chord-search");
const chordInput = byId("chord-input");
const chordError = byId("chord-error");
const picker = byId("scale-picker");
const scaleOpen = byId("scale-open");
const selection = byId("selected-notes");
const reset = byId("reset");
const matchSection = byId("match-section");
const matchStatus = byId("match-status");
const results = byId("results");
const more = byId("more");
const hintLegend = byId("hint-legend");
const counter = byId("match-count");
const finder = byId("finder");
const finderHeader = byId("finder-header");
const scaleView = byId("scale-view");
const detailBack = byId("detail-close");
const mainBoard = createFretboard(byId("main-board"), togglePitch);
const detailBoard = createFretboard(byId("detail-board"));

const session = restore();
let chordMatches = session.chordAnalyzed ? ChordFinder.match(ChordFinder.parse(session.chordText).chords) : [];
let matches = [];
let activeScale = null;
let showAll = false;
let finderPosition = 0;
let detailOpener = null;

function restore() {
    let saved;
    try {
        saved = JSON.parse(localStorage.getItem(storageKey));
    } catch (error) {
        // Storage may be unavailable. The current session still works.
    }
    saved = saved || {};
    const pitches = Array.isArray(saved.selected) ? saved.selected : [];
    return {
        selected: Array.from(new Set(pitches.filter(pitch => Number.isInteger(pitch) && pitch >= 0 && pitch < 12))),
        pinnedScale: saved.pinnedScale || null,
        chordScale: saved.chordScale || null,
        mode: saved.mode === "chords" ? "chords" : "notes",
        chordText: typeof saved.chordText === "string" ? saved.chordText.slice(0, chordInput.maxLength) : "",
        chordAnalyzed: saved.chordAnalyzed === true,
    };
}

function persist() {
    try {
        localStorage.setItem(storageKey, JSON.stringify(session));
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

function pitchesOf(scale) {
    return scale.pitches.map(pitch => pitchNames[pitch]).join(" · ");
}

function togglePitch(pitch) {
    if (session.selected.includes(pitch)) {
        session.selected = session.selected.filter(note => note !== pitch);
    } else {
        session.selected.push(pitch);
    }
    updateMatches();
}

function pinnedKey() {
    return session.mode === "notes" ? "pinnedScale" : "chordScale";
}

function updateMatches() {
    matches = session.mode === "notes" ? match(session.selected) : chordMatches;
    const key = pinnedKey();
    activeScale = matches.find(scale => scale.id === session[key]);
    if (!activeScale) {
        session[key] = null;
        activeScale = matches[0] || null;
    }
    workspace.classList.toggle("has-scale", Boolean(activeScale));
    showAll = false;
    persist();
    renderPicker();
    renderBoard();
    renderSelection();
    renderResults();
}

function renderPicker() {
    picker.textContent = "";
    picker.disabled = !activeScale;
    scaleOpen.disabled = !activeScale;
    if (picker.disabled) {
        const label = session.mode === "chords" ? "Введи аккорды для поиска" : "Нет подходящих гамм";
        picker.appendChild(new Option(label));
        return;
    }
    matches.forEach(scale => picker.appendChild(new Option(scale.name, scale.id)));
    picker.value = activeScale.id;
}

function setPreview(id) {
    const scale = matches.find(candidate => candidate.id === id);
    if (!scale) return;
    activeScale = scale;
    session[pinnedKey()] = id;
    picker.value = id;
    persist();
    renderBoard();
    updateActiveResult();
}

function renderBoard() {
    const selected = session.mode === "notes" ? session.selected : [];
    const supported = new Set();
    if (selected.length) matches.forEach(scale => scale.pitches.forEach(pitch => supported.add(pitch)));
    const preview = activeScale ? activeScale.pitches : [];
    hintLegend.hidden = !Array.from(supported).some(pitch => !preview.includes(pitch));
    mainBoard.render(activeScale, selected, supported);
    mainBoard.updateRange();
}

function openDetail(scale, opener) {
    finderPosition = window.scrollY;
    detailOpener = opener;
    byId("detail-title").textContent = scale.name;
    byId("detail-pitches").textContent = pitchesOf(scale);
    finder.hidden = true;
    finderHeader.hidden = true;
    scaleView.hidden = false;
    window.scrollTo(0, 0);
    detailBoard.build(true);
    detailBoard.render(scale);
    detailBack.focus({ preventScroll: true });
    if (window.GammaMamaAppearance) window.GammaMamaAppearance.setScaleFullscreen(true);
}

function closeScaleView() {
    if (scaleView.hidden) return false;
    if (window.GammaMamaAppearance) window.GammaMamaAppearance.setScaleFullscreen(false);
    scaleView.hidden = true;
    finderHeader.hidden = false;
    finder.hidden = false;
    window.scrollTo(0, finderPosition);
    mainBoard.updateRange();
    detailOpener.focus({ preventScroll: true });
    detailOpener = null;
    return true;
}

function renderSelection() {
    selection.textContent = "";
    reset.disabled = session.selected.length === 0;
    if (reset.disabled) {
        selection.appendChild(element("p", "selection-placeholder", "Выбери первую ноту на грифе."));
        return;
    }
    session.selected.forEach(pitch => {
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
    matchSection.hidden = session.mode === "chords" && !chordMatches.length;
    const approximate = session.mode === "chords" && matches.length && matches[0].outside.length;
    matchStatus.hidden = !approximate;
    matchStatus.textContent = approximate ? "Полного совпадения нет. Показаны ближайшие гаммы." : "";
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
        const row = element("div", "result-row");
        const expand = element("button", "open-scale");
        expand.type = "button";
        expand.setAttribute("aria-label", `Открыть на весь экран — ${scale.name}`);
        expand.setAttribute("aria-controls", "scale-view");
        const icon = element("span", "expand-icon");
        icon.setAttribute("aria-hidden", "true");
        expand.appendChild(icon);
        expand.addEventListener("click", () => openDetail(scale, expand));

        const button = element("button", "result");
        button.type = "button";
        button.dataset.scale = scale.id;
        let lastTap = -Infinity;
        button.addEventListener("click", event => {
            const now = performance.now();
            if (event.detail > 0 && now - lastTap <= 380) {
                lastTap = -Infinity;
                openDetail(scale, button);
                return;
            }
            lastTap = event.detail > 0 ? now : -Infinity;
            setPreview(scale.id);
        });
        const text = element("span", "result-text");
        text.appendChild(element("strong", "result-name", scale.name));
        text.appendChild(element("span", "result-pitches", pitchesOf(scale)));
        if (scale.outside && scale.outside.length) {
            const outside = Array.from(new Set(scale.outside));
            const summary = outside.slice(0, 4).join(", ") + (outside.length > 4 ? ` и ещё ${outside.length - 4}` : "");
            text.appendChild(element("span", "outside-chords", `Вне гаммы — ${summary}`));
        }
        button.appendChild(text);
        const check = element("span", "result-check", "✓");
        check.setAttribute("aria-hidden", "true");
        button.appendChild(check);
        row.appendChild(button);
        row.appendChild(expand);
        results.appendChild(row);
    });
    updateActiveResult();
}

function updateActiveResult() {
    results.querySelectorAll(".result").forEach(button => {
        const active = button.dataset.scale === activeScale.id;
        button.parentElement.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
    });
}

function changeMode(mode) {
    session.mode = mode;
    workspace.dataset.mode = mode;
    const notes = mode === "notes";
    noteMode.setAttribute("aria-pressed", String(notes));
    chordMode.setAttribute("aria-pressed", String(!notes));
    chordForm.hidden = notes;
    byId("note-search").hidden = !notes;
    byId("chosen-legend").hidden = !notes;
    workspace.insertBefore(instrumentPanel, notes ? matchPanel : null);
    mainBoard.build(false, notes);
    updateMatches();
}

function showChordError(message) {
    chordError.textContent = message;
    chordError.hidden = !message;
    chordInput.setAttribute("aria-invalid", String(Boolean(message)));
}

chordInput.value = session.chordText;
chordInput.addEventListener("input", () => {
    session.chordText = chordInput.value;
    showChordError("");
    if (session.chordAnalyzed) {
        session.chordAnalyzed = false;
        chordMatches = [];
        updateMatches();
    } else {
        persist();
    }
});
chordForm.addEventListener("submit", event => {
    event.preventDefault();
    session.chordText = chordInput.value;
    const { chords, invalid } = ChordFinder.parse(session.chordText);
    if (invalid.length) {
        const sample = invalid.slice(0, 4).join(", ") + (invalid.length > 4 ? "…" : "");
        showChordError(`Проверь обозначения аккордов — ${sample}`);
        chordInput.focus();
        return;
    }
    if (!chords.length) {
        showChordError("Введи хотя бы один аккорд, например Am или G7.");
        chordInput.focus();
        return;
    }
    chordInput.blur();
    showChordError("");
    session.chordAnalyzed = true;
    chordMatches = ChordFinder.match(chords);
    updateMatches();
    if (matchSection.getBoundingClientRect().top > window.innerHeight - 110) {
        matchSection.scrollIntoView({ block: "start" });
    }
});

noteMode.addEventListener("click", () => changeMode("notes"));
chordMode.addEventListener("click", () => changeMode("chords"));
picker.addEventListener("change", () => setPreview(picker.value));
scaleOpen.addEventListener("click", () => openDetail(activeScale, scaleOpen));
detailBack.addEventListener("click", closeScaleView);
document.addEventListener("keydown", event => {
    if (event.key === "Escape" && closeScaleView()) event.preventDefault();
});
reset.addEventListener("click", () => {
    session.selected = [];
    session.pinnedScale = null;
    updateMatches();
});
more.addEventListener("click", () => {
    showAll = !showAll;
    renderResults();
    if (!showAll) more.scrollIntoView({ block: "nearest" });
});

FretSettings.init(resetScroll => {
    mainBoard.build(resetScroll, session.mode === "notes");
    renderBoard();
});
changeMode(session.mode);
