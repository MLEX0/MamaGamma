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
const audioMode = byId("mode-audio");
const audioPanel = byId("audio-search");
const audioRecord = byId("audio-record");
const audioFile = byId("audio-file");
const audioCancel = byId("audio-cancel");
const audioStatus = byId("audio-status");
const audioFileInfo = byId("audio-file-info");
const audioFileName = byId("audio-file-name");
const audioFileDetails = byId("audio-file-details");
const audioBridge = window.MamaGammaAudio;
const audioSizeFormat = new Intl.NumberFormat("ru", { maximumFractionDigits: 1 });
const chordForm = byId("chord-search");
const chordInput = byId("chord-input");
const chordError = byId("chord-error");
const resetChords = byId("reset-chords");
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
const hideDetailControls = byId("detail-hide-controls");
const showDetailControls = byId("detail-show-controls");
const detailFrom = byId("detail-fret-from");
const detailTo = byId("detail-fret-to");
const settingsDialog = byId("settings-dialog");
const historyDialog = byId("history-dialog");
const historyOpen = byId("history-open");
const historyClear = byId("history-clear");
const confirmDialog = byId("confirm-dialog");
const historyDate = new Intl.DateTimeFormat("ru", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
});
const mainBoard = createFretboard(byId("main-board"), togglePitch);
const detailBoard = createFretboard(byId("detail-board"));

const session = restore();
const scaleCatalog = new Map(match([]).map(scale => [scale.id, scale]));
let audioPhase = "idle";
let audioSource = "file";
let notesHistoryTimer = null;
let chordMatches = session.chordAnalyzed ? ChordFinder.match(ChordFinder.parse(session.chordText).chords) : [];
let matches = [];
let activeScale = null;
let volumePreviewScale = null;
let volumePreviewDegree = 0;
let showAll = false;
let finderPosition = 0;
let detailOpener = null;
let detailScale = null;
let detailScrollFret = null;

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
        audioScale: saved.audioScale || null,
        audioKeys: Array.isArray(saved.audioKeys) ? saved.audioKeys.filter(isAudioKey).slice(0, 3) : [],
        audioFile: readAudioFile(saved.audioFile),
        detailFrom: Number.isInteger(saved.detailFrom) && saved.detailFrom >= 0 ? saved.detailFrom : 0,
        detailTo: Number.isInteger(saved.detailTo) && saved.detailTo >= 0 ? saved.detailTo : null,
        mode: ["notes", "chords", "audio"].includes(saved.mode) ? saved.mode : "notes",
        chordText: typeof saved.chordText === "string" ? saved.chordText.slice(0, chordInput.maxLength) : "",
        chordAnalyzed: saved.chordAnalyzed === true,
    };
}

function isAudioKey(id) {
    return typeof id === "string" && /^(?:[0-9]|1[01])-(?:major|minor)$/.test(id);
}

function readAudioFile(value) {
    if (!value || typeof value.name !== "string" || !value.name) return null;
    return {
        name: value.name.slice(0, 512),
        format: typeof value.format === "string" ? value.format.slice(0, 16) : "",
        codec: typeof value.codec === "string" ? value.codec.slice(0, 16) : "",
        size: Number.isFinite(value.size) ? value.size : -1,
        durationMs: Number.isFinite(value.durationMs) ? value.durationMs : -1,
    };
}

function audioDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secondPart = String(seconds % 60).padStart(2, "0");
    if (minutes < 60) return `${minutes}:${secondPart}`;
    return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}:${secondPart}`;
}

function audioSize(bytes) {
    if (bytes < 1000) return `${bytes} Б`;
    if (bytes < 1000000) return `${audioSizeFormat.format(bytes / 1000)} КБ`;
    if (bytes < 1000000000) return `${audioSizeFormat.format(bytes / 1000000)} МБ`;
    return `${audioSizeFormat.format(bytes / 1000000000)} ГБ`;
}

function renderAudioFile() {
    const file = session.audioFile;
    audioFileInfo.hidden = !file;
    audioFileName.textContent = file ? file.name : "";
    audioFileDetails.textContent = "";
    if (!file) return;

    const format = Array.from(new Set([file.format, file.codec].filter(Boolean))).join(" · ");
    const details = [
        ["Формат", format],
        ["Длительность", file.durationMs >= 0 ? audioDuration(file.durationMs) : ""],
        ["Размер", file.size >= 0 ? audioSize(file.size) : ""],
    ];
    details.forEach(([label, value]) => {
        if (!value) return;
        const entry = element("div");
        entry.appendChild(element("dt", "", label));
        entry.appendChild(element("dd", "", value));
        audioFileDetails.appendChild(entry);
    });
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

function showDialog(dialog) {
    dialog.showModal();
    document.documentElement.classList.add("modal-open");
}

function dismissDialog() {
    const openDialogs = document.querySelectorAll("dialog[open]");
    if (!openDialogs.length) return false;
    openDialogs[openDialogs.length - 1].close();
    return true;
}

function confirmAction(title, message, label, action) {
    byId("confirm-title").textContent = title;
    byId("confirm-message").textContent = message;
    const button = byId("confirm-action");
    button.textContent = label;
    button.onclick = () => {
        confirmDialog.close();
        action();
    };
    showDialog(confirmDialog);
}

function renderHistory() {
    const entries = SearchHistory.list();
    const list = byId("history-list");
    list.textContent = "";
    list.hidden = !entries.length;
    byId("history-empty").hidden = Boolean(entries.length);
    historyClear.disabled = !entries.length;
    entries.forEach(entry => {
        const row = element("li", "history-entry");
        const heading = element("div", "history-meta");
        const date = new Date(entry.time);
        const time = element("time", "", historyDate.format(date));
        time.dateTime = date.toISOString();
        heading.append(element("strong", "", SearchHistory.sourceName(entry.source)), time);
        row.appendChild(heading);
        if (entry.input) row.appendChild(element("p", "history-input", entry.input));
        const scales = element("div", "history-scales");
        entry.scales.map(id => scaleCatalog.get(id)).filter(Boolean).forEach(scale => {
            const button = element("button", "secondary-button", scale.name);
            button.type = "button";
            button.addEventListener("click", () => {
                historyDialog.close();
                openDetail(scale, historyOpen);
            });
            scales.appendChild(button);
        });
        row.appendChild(scales);
        list.appendChild(row);
    });
}

function recordSearch(source, input, scales) {
    SearchHistory.add(source, input, scales);
    if (historyDialog.open) renderHistory();
}

function flushNotesHistory(preview = activeScale) {
    if (notesHistoryTimer === null) return;
    clearTimeout(notesHistoryTimer);
    notesHistoryTimer = null;
    if (!preview || !session.selected.length) return;
    const notes = session.selected.map(pitch => pitchNames[pitch]).join(" · ");
    recordSearch("notes", notes, [preview, ...matches.filter(scale => scale.id !== preview.id)]);
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
    clearTimeout(notesHistoryTimer);
    notesHistoryTimer = session.selected.length && activeScale ? setTimeout(flushNotesHistory, 800) : null;
}

function pinnedKey() {
    if (session.mode === "audio") return "audioScale";
    return session.mode === "notes" ? "pinnedScale" : "chordScale";
}

function updateMatches() {
    if (session.mode === "audio") matches = session.audioKeys.map(id => scaleCatalog.get(id));
    else matches = session.mode === "notes" ? match(session.selected) : chordMatches;
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
        const label = session.mode === "audio" ? "Запиши или выбери аудио"
            : session.mode === "chords" ? "Введи аккорды для поиска" : "Нет подходящих гамм";
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

function renderDetailFrets(from, to) {
    detailFrom.value = String(from);
    detailTo.value = String(to);
    detailBoard.build(true, false, { from, to });
    detailBoard.render(detailScale);
}

function setDetailFrets(from, to, leadingFret = from) {
    session.detailFrom = from;
    session.detailTo = to === FretSettings.setup().frets ? null : to;
    persist();
    renderDetailFrets(from, to);
    if (leadingFret > from && leadingFret <= to) detailBoard.scrollToFret(leadingFret);
}

function openDetail(scale, opener) {
    flushNotesHistory(scale);
    finderPosition = window.scrollY;
    detailOpener = opener;
    detailScale = scale;
    byId("detail-title").textContent = scale.name;
    byId("detail-pitches").textContent = pitchesOf(scale);
    scaleView.classList.remove("board-only");
    showDetailControls.hidden = true;
    finder.hidden = true;
    finderHeader.hidden = true;
    scaleView.hidden = false;
    window.scrollTo(0, 0);
    const lastFret = FretSettings.setup().frets;
    detailFrom.textContent = "";
    detailTo.textContent = "";
    for (let fret = 0; fret <= lastFret; fret += 1) {
        detailFrom.add(new Option(String(fret), fret));
        detailTo.add(new Option(String(fret), fret));
    }
    const to = Math.min(session.detailTo ?? lastFret, lastFret);
    const from = Math.min(session.detailFrom, to);
    renderDetailFrets(from, to);
    if (detailScrollFret > from && detailScrollFret <= to) detailBoard.scrollToFret(detailScrollFret);
    detailBack.focus({ preventScroll: true });
    if (window.GammaMamaAppearance) window.GammaMamaAppearance.setScaleFullscreen(true);
}

function setBoardOnly(enabled) {
    scaleView.classList.toggle("board-only", enabled);
    showDetailControls.hidden = !enabled;
    (enabled ? showDetailControls : hideDetailControls).focus({ preventScroll: true });
}

function dismissScaleView() {
    if (scaleView.hidden) return false;
    if (scaleView.classList.contains("board-only")) {
        setBoardOnly(false);
        return true;
    }
    return closeScaleView();
}

function closeScaleView() {
    if (scaleView.hidden) return false;
    detailScrollFret = detailBoard.leadingFret();
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
    matchSection.hidden = session.mode !== "notes" && !matches.length;
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
    if (session.mode === "notes" && mode !== "notes") flushNotesHistory();
    if (session.mode === "audio" && mode !== "audio") cancelAudioSearch();
    session.mode = mode;
    workspace.dataset.mode = mode;
    const notes = mode === "notes";
    noteMode.setAttribute("aria-pressed", String(notes));
    chordMode.setAttribute("aria-pressed", String(mode === "chords"));
    audioMode.setAttribute("aria-pressed", String(mode === "audio"));
    chordForm.hidden = mode !== "chords";
    audioPanel.hidden = mode !== "audio";
    byId("matches-title").textContent = mode === "audio" ? "Вероятные тональности" : "Подходящие гаммы";
    byId("note-search").hidden = !notes;
    byId("chosen-legend").hidden = !notes;
    workspace.insertBefore(instrumentPanel, notes ? matchPanel : null);
    mainBoard.build(false, notes);
    updateMatches();
}

function audioBusy() {
    return ["requesting", "choosing", "recording", "analyzing"].includes(audioPhase);
}

function openSharedAudio() {
    Array.from(document.querySelectorAll("dialog[open]")).reverse().forEach(dialog => dialog.close());
    closeScaleView();
    NoteAudio.stop();
    audioSource = "shared";
    session.audioKeys = [];
    session.audioScale = null;
    session.audioFile = null;
    renderAudioFile();
    changeMode("audio");
    window.scrollTo(0, 0);
}

function cancelAudioSearch() {
    if (!audioBridge || !audioBusy()) return false;
    audioBridge.cancel();
    return true;
}

function updateAudioSearch(phase, keys, message, file) {
    audioPhase = phase;
    if (phase === "recording" && session.mode !== "audio") {
        cancelAudioSearch();
        return;
    }
    const recording = phase === "recording";
    if (recording) audioSource = "microphone";
    if (phase === "choosing") audioSource = "file";
    const busy = audioBusy();
    audioRecord.textContent = recording ? "Стоп и анализ" : "Записать";
    audioRecord.disabled = !audioBridge || (busy && !recording);
    audioFile.disabled = !audioBridge || busy;
    audioCancel.hidden = !recording && phase !== "analyzing";
    const status = {
        requesting: "Ожидание доступа к микрофону…",
        choosing: "Выбор аудиофайла…",
        recording: "Идёт запись, до 20 секунд…",
        analyzing: "Ищем тональность…",
    };
    audioStatus.textContent = message || status[phase] || "";
    audioStatus.hidden = !audioStatus.textContent;
    audioStatus.classList.toggle("chord-error", phase === "error");

    if (recording || phase === "analyzing") {
        session.audioFile = readAudioFile(file);
        renderAudioFile();
    }
    if (recording || phase === "analyzing" || phase === "done") {
        session.audioKeys = phase === "done" ? Array.from(new Set(keys.filter(isAudioKey))).slice(0, 3) : [];
        session.audioScale = null;
        if (session.mode === "audio") updateMatches();
        else persist();
    }
    if (phase === "done") {
        recordSearch(audioSource, session.audioFile?.name || "", session.audioKeys.map(id => scaleCatalog.get(id)));
    }
}

function showChordError(message) {
    chordError.textContent = message;
    chordError.hidden = !message;
    chordInput.setAttribute("aria-invalid", String(Boolean(message)));
}

chordInput.value = session.chordText;
resetChords.disabled = !chordInput.value;

function updateChordInput() {
    session.chordText = chordInput.value;
    resetChords.disabled = !chordInput.value;
    showChordError("");
    if (session.chordAnalyzed) {
        session.chordAnalyzed = false;
        session.chordScale = null;
        chordMatches = [];
        updateMatches();
    } else {
        persist();
    }
}

chordInput.addEventListener("input", updateChordInput);
resetChords.addEventListener("click", () => {
    chordInput.value = "";
    updateChordInput();
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
    recordSearch("chords", chords.map(chord => chord.label).join(" · "), chordMatches);
    if (matchSection.getBoundingClientRect().top > window.innerHeight - 110) {
        matchSection.scrollIntoView({ block: "start" });
    }
});

noteMode.addEventListener("click", () => changeMode("notes"));
chordMode.addEventListener("click", () => changeMode("chords"));
audioMode.addEventListener("click", () => changeMode("audio"));
audioRecord.addEventListener("click", () => {
    if (!audioBridge) return;
    NoteAudio.stop();
    audioBridge.recordOrStop();
});
audioFile.addEventListener("click", () => { if (audioBridge) audioBridge.pickFile(); });
audioCancel.addEventListener("click", cancelAudioSearch);
if (!audioBridge) updateAudioSearch("error", [], "Анализ аудио доступен в Android-приложении.");
picker.addEventListener("change", () => setPreview(picker.value));
scaleOpen.addEventListener("click", () => openDetail(activeScale, scaleOpen));
detailBack.addEventListener("click", closeScaleView);
hideDetailControls.addEventListener("click", () => setBoardOnly(true));
showDetailControls.addEventListener("click", () => setBoardOnly(false));
detailFrom.addEventListener("change", () => {
    const from = Number(detailFrom.value);
    setDetailFrets(from, Math.max(from, Number(detailTo.value)));
});
detailTo.addEventListener("change", () => {
    const to = Number(detailTo.value);
    setDetailFrets(Math.min(to, Number(detailFrom.value)), to, detailBoard.leadingFret());
});
document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !document.querySelector("dialog[open]") && dismissScaleView()) event.preventDefault();
});
reset.addEventListener("click", () => {
    flushNotesHistory();
    session.selected = [];
    session.pinnedScale = null;
    updateMatches();
});
more.addEventListener("click", () => {
    showAll = !showAll;
    renderResults();
    if (!showAll) more.scrollIntoView({ block: "nearest" });
});

function refreshSetup(resetScroll) {
    mainBoard.build(resetScroll, session.mode === "notes");
    renderBoard();
}

function previewVolume() {
    if (!FretSettings.soundEnabled() || FretSettings.noteVolume() === 0) return;
    const scale = activeScale || scaleCatalog.get("0-major");
    if (volumePreviewScale !== scale.id) {
        volumePreviewScale = scale.id;
        volumePreviewDegree = 0;
    }
    const pitch = scale.pitches[volumePreviewDegree];
    const interval = (pitch - scale.root + 12) % 12;
    NoteAudio.play(60 + scale.root + interval);
    volumePreviewDegree = (volumePreviewDegree + 1) % scale.pitches.length;
}

for (const dialog of document.querySelectorAll("dialog")) {
    dialog.addEventListener("close", () => {
        document.documentElement.classList.toggle("modal-open", Boolean(document.querySelector("dialog[open]")));
    });
    dialog.addEventListener("click", event => {
        if (event.target === dialog) dialog.close();
    });
    dialog.querySelectorAll("[data-close-dialog]").forEach(button => {
        button.addEventListener("click", () => dialog.close());
    });
}
byId("settings-open").addEventListener("click", () => showDialog(settingsDialog));
byId("settings-reset").addEventListener("click", () => {
    confirmAction("Сбросить настройки?", "Тема, звук, инструменты и диапазон ладов вернутся к исходным значениям.", "Сбросить", () => {
        FretSettings.reset();
        NoteAudio.stop();
        NoteAudio.updateVolume();
        session.detailFrom = 0;
        session.detailTo = null;
        detailScrollFret = null;
        persist();
        refreshSetup(true);
    });
});
historyOpen.addEventListener("click", () => {
    flushNotesHistory();
    renderHistory();
    showDialog(historyDialog);
});
historyClear.addEventListener("click", () => {
    confirmAction("Очистить историю?", "Все сохранённые результаты поиска будут удалены.", "Очистить", () => {
        clearTimeout(notesHistoryTimer);
        notesHistoryTimer = null;
        SearchHistory.clear();
        renderHistory();
        historyDialog.querySelector("[data-close-dialog]").focus();
    });
});

FretSettings.init(refreshSetup, enabled => {
    if (!enabled) NoteAudio.stop();
    renderBoard();
}, NoteAudio.updateVolume, previewVolume);
renderAudioFile();
changeMode(session.mode);
if (audioBridge) audioBridge.ready();
