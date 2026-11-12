"use strict";

const { pitchNames, match } = ScaleFinder;
const previewLimit = 5;
const storageKey = "gammama-session-v1";
const byId = id => document.getElementById(id);

const workspace = byId("workspace");
const instrumentPanel = byId("instrument-panel");
const fretboardView = byId("show-fretboard");
const pianoView = byId("show-piano");
const mainFretboardSection = byId("main-board");
const mainPianoSection = byId("main-piano");
const detailFretboardSection = byId("detail-board");
const detailPianoSection = byId("detail-piano");
const matchPanel = byId("match-panel");
const noteMode = byId("mode-notes");
const chordMode = byId("mode-chords");
const audioMode = byId("mode-audio");
const audioPanel = byId("audio-search");
const audioRecord = byId("audio-record");
const audioFile = byId("audio-file");
const audioCancel = byId("audio-cancel");
const audioClear = byId("audio-clear");
const audioStatus = byId("audio-status");
const audioFileInfo = byId("audio-file-info");
const audioFileName = byId("audio-file-name");
const audioFileDetails = byId("audio-file-details");
const audioBridge = window.MamaGammaAudio;
const audioEditor = createAudioSegment(audioBridge);
const audioStatusKeys = {
    requesting: "microphoneRequest",
    choosing: "audioFileChoosing",
    recording: "audioRecording",
    analyzing: "audioAnalyzing",
    saving: "audioSaving",
};
const chordForm = byId("chord-search");
const chordInput = byId("chord-input");
const chordTextLimit = chordInput.maxLength;
const chordError = byId("chord-error");
const chordPreview = byId("chord-preview");
const resetChords = byId("reset-chords");
const picker = byId("scale-picker");
const scaleOpen = byId("scale-open");
const scalePlay = byId("scale-play");
const selection = byId("selected-notes");
const reset = byId("reset");
const matchSection = byId("match-section");
const scaleResults = byId("show-scale-results");
const progressionResults = byId("show-progression-results");
const matchStatus = byId("match-status");
const results = byId("results");
const more = byId("more");
const hintLegend = byId("hint-legend");
const counter = byId("match-count");
const finder = byId("finder");
const finderHeader = byId("finder-header");
const scaleView = byId("scale-view");
const detailBack = byId("detail-close");
const detailScalePlay = byId("detail-scale-play");
const hideDetailControls = byId("detail-hide-controls");
const showDetailControls = byId("detail-show-controls");
const detailFrom = byId("detail-fret-from");
const detailTo = byId("detail-fret-to");
const settingsDialog = byId("settings-dialog");
const historyDialog = byId("history-dialog");
const historyOpen = byId("history-open");
const historyClear = byId("history-clear");
const confirmDialog = byId("confirm-dialog");
const mainBoard = createFretboard(mainFretboardSection, togglePitch);
const detailBoard = createFretboard(detailFretboardSection);
const mainPiano = createPiano(mainPianoSection, togglePitch);
const detailPiano = createPiano(detailPianoSection);

const session = restore();
const scaleCatalog = new Map(match([]).map(scale => [scale.id, scale]));
let audioPhase = "idle";
let audioMessage = "";
let audioSource = "file";
let audioAvailable = false;
let chordValidation = null;
let notesHistoryTimer = null;
let analyzedChords = session.chordAnalyzed ? ChordFinder.parse(session.chordText).chords : [];
let chordMatches = ChordFinder.match(analyzedChords);
let matches = [];
let activeScale = null;
let volumePreviewScale = null;
let volumePreviewDegree = 0;
let showAll = false;
let finderPosition = 0;
let detailOpener = null;
let detailScale = null;
let detailScrollFret = null;
let scalePlaybackButton = null;
let chordSequenceButton = null;

function restore() {
    let saved;
    try {
        saved = JSON.parse(localStorage.getItem(storageKey));
    } catch (error) {
        // Storage may be unavailable. The current session still works.
    }
    saved = saved || {};
    const pitches = Array.isArray(saved.selected) ? saved.selected : [];
    const savedChordText = typeof saved.chordText === "string" ? saved.chordText : "";
    const savedNotation = NoteNames.systems.find(system => system.id === saved.chordNotation)?.id || "international";
    const chordNotation = NoteNames.mode();
    const chordSharps = NoteNames.sharpsOnly();
    const savedViews = saved.progressionViews || {};
    return {
        selected: Array.from(new Set(pitches.filter(pitch => Number.isInteger(pitch) && pitch >= 0 && pitch < 12))),
        pianoMode: saved.pianoMode === true,
        progressionViews: {
            notes: (savedViews.notes ?? saved.showProgressions) === true,
            chords: savedViews.chords === true,
            audio: savedViews.audio === true,
        },
        pinnedScale: saved.pinnedScale || null,
        chordScale: saved.chordScale || null,
        audioScale: saved.audioScale || null,
        audioKeys: Array.isArray(saved.audioKeys) ? saved.audioKeys.filter(isAudioKey).slice(0, 3) : [],
        audioFile: readAudioFile(saved.audioFile),
        audioAnalysis: readAudioAnalysis(saved.audioAnalysis),
        detailFrom: Number.isInteger(saved.detailFrom) && saved.detailFrom >= 0 ? saved.detailFrom : 0,
        detailTo: Number.isInteger(saved.detailTo) && saved.detailTo >= 0 ? saved.detailTo : null,
        mode: ["notes", "chords", "audio"].includes(saved.mode) ? saved.mode : "notes",
        chordText: ChordFinder.rewrite(savedChordText, savedNotation, chordNotation,
            { force: (saved.chordSharps === true) !== chordSharps }),
        chordNotation,
        chordSharps,
        chordAnalyzed: saved.chordAnalyzed === true,
    };
}

function isAudioKey(id) {
    return typeof id === "string" && /^(?:[0-9]|1[01])-(?:major|minor)$/.test(id);
}

function readAudioFile(value) {
    if (!value || typeof value.name !== "string") return null;
    return {
        name: value.name.slice(0, 512),
        format: typeof value.format === "string" ? value.format.slice(0, 16) : "",
        codec: typeof value.codec === "string" ? value.codec.slice(0, 16) : "",
        size: Number.isFinite(value.size) ? value.size : -1,
        durationMs: Number.isFinite(value.durationMs) ? value.durationMs : -1,
        recording: value.recording === true,
    };
}

function readAudioAnalysis(value) {
    if (!value || !Array.isArray(value.notes) || !Number.isFinite(value.fromMs)
        || !Number.isFinite(value.toMs) || value.fromMs < 0 || value.toMs <= value.fromMs) return null;
    const notes = value.notes.slice(0, 400).filter(note => note && Number.isInteger(note.midi)
        && note.midi >= 0 && note.midi <= 127 && Number.isFinite(note.startMs) && Number.isFinite(note.endMs)
        && note.startMs >= value.fromMs && note.endMs <= value.toMs && note.endMs > note.startMs)
        .map(({ midi, startMs, endMs }) => ({ midi, startMs, endMs }))
        .sort((left, right) => left.startMs - right.startMs);
    return { fromMs: value.fromMs, toMs: value.toMs, notes };
}

function audioDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secondPart = String(seconds % 60).padStart(2, "0");
    if (minutes < 60) return `${minutes}:${secondPart}`;
    return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}:${secondPart}`;
}

function audioSize(bytes) {
    const format = new Intl.NumberFormat(I18n.language(), { maximumFractionDigits: 1 });
    if (bytes < 1000) return t("sizeBytes", { size: format.format(bytes) });
    if (bytes < 1000000) return t("sizeKilobytes", { size: format.format(bytes / 1000) });
    if (bytes < 1000000000) return t("sizeMegabytes", { size: format.format(bytes / 1000000) });
    return t("sizeGigabytes", { size: format.format(bytes / 1000000000) });
}

function renderAudioFile() {
    const file = session.audioFile;
    audioFileInfo.hidden = !file;
    audioFileName.textContent = file ? file.name || t("historyAudioFile") : "";
    audioFileDetails.textContent = "";
    if (!file) return;

    const format = Array.from(new Set([file.format, file.codec].filter(Boolean))).join(" · ");
    const details = [
        ["fileFormat", format],
        ["fileDuration", file.durationMs >= 0 ? audioDuration(file.durationMs) : ""],
        ["fileSize", file.size >= 0 ? audioSize(file.size) : ""],
    ];
    details.forEach(([label, value]) => {
        if (!value) return;
        const entry = element("div");
        entry.appendChild(element("dt", "", t(label)));
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
    stopScalePlayback();
    stopChordSequence();
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
    byId("confirm-title").textContent = t(title);
    byId("confirm-message").textContent = t(message);
    const button = byId("confirm-action");
    button.textContent = t(label);
    button.onclick = () => {
        confirmDialog.close();
        action();
    };
    showDialog(confirmDialog);
}

function renderHistory() {
    const entries = SearchHistory.list();
    const historyDate = new Intl.DateTimeFormat(I18n.language(), {
        year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
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
        if (entry.input) row.appendChild(element("p", "history-input", historyInput(entry)));
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

function historyInput(entry) {
    if (entry.source === "chords") {
        return ChordFinder.rewrite(entry.input, "international", NoteNames.mode(), { force: NoteNames.sharpsOnly() });
    }
    if (entry.source !== "notes") return entry.input;
    return entry.input.split(" · ").map(name => {
        const pitch = pitchNames.indexOf(name);
        return pitch < 0 ? name : NoteNames.name(pitch);
    }).join(" · ");
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
    return scale.pitches.map(pitch => NoteNames.name(pitch)).join(" · ");
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

function selectMatches() {
    if (session.mode === "audio") matches = session.audioKeys.map(id => scaleCatalog.get(id));
    else matches = session.mode === "notes" ? match(session.selected) : chordMatches;
    const key = pinnedKey();
    activeScale = matches.find(scale => scale.id === session[key]);
    if (!activeScale) {
        session[key] = null;
        activeScale = matches[0] || null;
    }
    workspace.classList.toggle("has-scale", Boolean(activeScale));
}

function updateMatches() {
    stopScalePlayback();
    selectMatches();
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
    renderScalePlayback();
    if (picker.disabled) {
        const label = session.mode === "audio" ? "chooseAudioHint"
            : session.mode === "chords" ? "enterChordsHint" : "noFittingScales";
        picker.appendChild(new Option(t(label)));
        return;
    }
    matches.forEach(scale => picker.appendChild(new Option(scale.name, scale.id)));
    picker.value = activeScale.id;
}

function setPreview(id) {
    const scale = matches.find(candidate => candidate.id === id);
    if (!scale) return;
    if (scale.id !== activeScale?.id) stopScalePlayback();
    activeScale = scale;
    session[pinnedKey()] = id;
    picker.value = id;
    persist();
    renderBoard();
    if (isProgressionView()) renderResults();
    else updateActiveResult();
}

function renderScalePlayback() {
    const audible = FretSettings.soundEnabled() && FretSettings.noteVolume() > 0;
    for (const [button, scale] of [[scalePlay, activeScale], [detailScalePlay, detailScale]]) {
        const playing = scalePlaybackButton === button;
        const label = t(playing ? "stopScale" : "playScale");
        button.disabled = !playing && (!scale || !audible);
        button.classList.toggle("is-playing", playing);
        button.setAttribute("aria-label", label);
        button.title = scale && !audible ? t("playScaleMuted") : label;
        button.querySelector(".scale-play-label").textContent = t(playing ? "stopScaleShort" : "playScaleShort");
    }
}

function stopScalePlayback() {
    if (scalePlaybackButton) NoteAudio.stop();
}

function playScale(scale, button, board) {
    if (scalePlaybackButton) {
        stopScalePlayback();
        return;
    }
    if (button.disabled || !scale) return;
    const tonic = session.pianoMode ? board.playbackTonic(scale.root) : 60 + scale.root;
    const notes = scale.pitches.map(pitch => tonic + (pitch - scale.root + 12) % 12);
    notes.push(tonic + 12);
    scalePlaybackButton = button;
    renderScalePlayback();
    NoteAudio.playScale(notes, FretSettings.scaleTempo(), midi => board.setPlaying(midi), () => {
        board.setPlaying(null);
        scalePlaybackButton = null;
        renderScalePlayback();
    });
}

function renderBoard() {
    const selected = session.mode === "notes" ? session.selected : [];
    const supported = new Set();
    if (selected.length) matches.forEach(scale => scale.pitches.forEach(pitch => supported.add(pitch)));
    const preview = activeScale ? activeScale.pitches : [];
    hintLegend.hidden = !Array.from(supported).some(pitch => !preview.includes(pitch));
    if (session.pianoMode) mainPiano.render(activeScale, selected, supported);
    else {
        mainBoard.render(activeScale, selected, supported);
        mainBoard.updateRange();
    }
}

function renderDetailFrets(from, to) {
    detailFrom.value = String(from);
    detailTo.value = String(to);
    detailBoard.build(true, false, { from, to });
    detailBoard.render(detailScale);
}

function setDetailFrets(from, to, leadingFret = from) {
    stopScalePlayback();
    session.detailFrom = from;
    session.detailTo = to === FretSettings.setup().frets ? null : to;
    persist();
    renderDetailFrets(from, to);
    if (leadingFret > from && leadingFret <= to) detailBoard.scrollToFret(leadingFret);
}

function openDetailFretboard() {
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
}

function openDetail(scale, opener) {
    WorkspaceNavigation.showFinder();
    stopScalePlayback();
    flushNotesHistory(scale);
    finderPosition = window.scrollY;
    detailOpener = opener;
    detailScale = scale;
    renderScalePlayback();
    byId("detail-title").textContent = scale.name;
    byId("detail-pitches").textContent = pitchesOf(scale);
    scaleView.classList.remove("board-only");
    showDetailControls.hidden = true;
    hideDetailControls.hidden = session.pianoMode;
    detailFretboardSection.hidden = session.pianoMode;
    detailPianoSection.hidden = !session.pianoMode;
    finder.hidden = true;
    finderHeader.hidden = true;
    scaleView.hidden = false;
    WorkspaceNavigation.setFullscreen(true);
    window.scrollTo(0, 0);
    if (session.pianoMode) {
        detailPiano.build(true);
        detailPiano.render(scale);
    } else openDetailFretboard();
    detailBack.focus({ preventScroll: true });
    if (window.GammaMamaAppearance) window.GammaMamaAppearance.setScaleFullscreen(true);
}

function setBoardOnly(enabled) {
    if (enabled) stopScalePlayback();
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
    stopScalePlayback();
    detailScale = null;
    renderScalePlayback();
    if (!session.pianoMode) detailScrollFret = detailBoard.leadingFret();
    if (window.GammaMamaAppearance) window.GammaMamaAppearance.setScaleFullscreen(false);
    scaleView.hidden = true;
    WorkspaceNavigation.setFullscreen(false);
    finderHeader.hidden = false;
    finder.hidden = false;
    window.scrollTo(0, finderPosition);
    if (!session.pianoMode) mainBoard.updateRange();
    detailOpener.focus({ preventScroll: true });
    detailOpener = null;
    return true;
}

function renderSelection() {
    selection.textContent = "";
    reset.disabled = session.selected.length === 0;
    if (reset.disabled) {
        selection.appendChild(element("p", "selection-placeholder", t(session.pianoMode ? "firstPianoNoteHint" : "firstNoteHint")));
        return;
    }
    session.selected.forEach(pitch => {
        const name = NoteNames.name(pitch);
        const chip = element("button", "selected-chip", name);
        chip.type = "button";
        chip.setAttribute("aria-label", t("removeNote", { note: name }));
        const remove = element("span", "", "×");
        remove.setAttribute("aria-hidden", "true");
        chip.appendChild(remove);
        chip.addEventListener("click", () => togglePitch(pitch));
        selection.appendChild(chip);
    });
}

function isProgressionView() {
    return session.progressionViews[session.mode];
}

function setResultView(showProgressions) {
    if (isProgressionView() === showProgressions) return;
    session.progressionViews[session.mode] = showProgressions;
    showAll = false;
    persist();
    renderResults();
}

function prepareResultList(title, count, countLabel, moreLabel) {
    byId("matches-title").textContent = t(title);
    counter.textContent = count;
    counter.setAttribute("aria-label", t(countLabel, { count }));
    results.textContent = "";
    more.hidden = count <= previewLimit;
    more.textContent = showAll ? t("collapseScales") : t(moreLabel, { count });
    more.setAttribute("aria-expanded", String(showAll));
}

function renderProgressions() {
    const selected = session.mode === "notes" ? session.selected : [];
    let title = "matchingProgressions";
    let empty = session.pianoMode ? "progressionSelectPianoNotes" : "progressionSelectNotes";
    if (selected.length) empty = "progressionNoMatch";
    let context = "";
    let progressions;
    if (session.mode === "chords") {
        title = "chordContinuationsTitle";
        empty = "progressionNoChordContinuation";
        progressions = ProgressionFinder.continueChords(analyzedChords, session.chordScale);
        const tail = analyzedChords.slice(-4).map(chord => chord.label);
        if (analyzedChords.length > tail.length) tail.unshift("…");
        if (tail.length) context = t("chordContinuationContext", { chords: tail.join(" – ") });
    } else if (session.mode === "audio") {
        title = "audioProgressionsTitle";
        empty = "progressionNoAudioKeys";
        progressions = ProgressionFinder.forKeys(matches, session.audioScale);
    } else {
        progressions = ProgressionFinder.match(selected, session.pinnedScale);
    }
    prepareResultList(title, progressions.length, "progressionsFound", "showAllProgressions");
    matchStatus.hidden = !context;
    matchStatus.textContent = context;
    if (!progressions.length) {
        results.appendChild(element("p", "empty", t(empty)));
        return;
    }

    const visible = showAll ? progressions : progressions.slice(0, previewLimit);
    visible.forEach(({ scale, chords, approximate }) => {
        const card = element("article", "progression-card");
        const heading = element("div", "progression-heading");
        heading.appendChild(element("h3", "progression-key", scale.name));
        if (approximate) heading.appendChild(element("span", "progression-key-hint", t("progressionApproximateKey")));
        const sequence = buildChordSequence(chords, selected);
        heading.appendChild(sequence.play);
        card.append(heading, sequence.list);
        results.appendChild(card);
    });
}

function stopChordSequence() {
    if (chordSequenceButton) NoteAudio.stop();
}

function chordInstrument() {
    return session.pianoMode ? "piano" : FretSettings.instrument().id;
}

function updateChordPlaybackControls() {
    const disabled = !NoteAudio.canPlay();
    document.querySelectorAll(".chord-hear, .chord-sequence-play").forEach(button => { button.disabled = disabled; });
}

function buildChordSequence(chords, selected = []) {
    const list = element("ol", "progression-chords playable-chords");
    const play = element("button", "secondary-button chord-sequence-play", t("playChordSequence"));
    const audible = NoteAudio.canPlay();
    play.type = "button";
    play.disabled = !audible;
    const cards = chords.map(chord => {
        const card = element("li", "progression-chord");
        const name = ChordLibrary.name(chord);
        const hear = element("button", "chord-hear");
        hear.type = "button";
        hear.disabled = !audible;
        hear.setAttribute("aria-label", t("playChord", { chord: name }));
        if (chord.degree) {
            const degree = NoteNames.sharpsOnly() ? chord.degree.replace(/^♭/, "") : chord.degree;
            hear.appendChild(element("span", "progression-degree", degree));
        }
        hear.append(element("strong", "progression-chord-name", name),
            element("span", "chord-note-list", ChordLibrary.noteNames(chord).join(" · ")));
        hear.addEventListener("click", () => ChordLibrary.play(chord, chordInstrument()));
        const notes = selected.filter(pitch => chord.pitches.includes(pitch)).map(pitch => NoteNames.name(pitch)).join(" · ");
        if (notes) {
            const badge = element("span", "progression-notes", notes);
            badge.title = t("progressionMatches", { notes });
            hear.appendChild(badge);
        }
        const voicings = element("button", "chord-show-shapes", "⋯");
        voicings.type = "button";
        voicings.title = t("openChordVoicings", { chord: name });
        voicings.setAttribute("aria-label", voicings.title);
        voicings.addEventListener("click", () => ChordLibrary.open(chord, chordInstrument()));
        card.append(hear, voicings);
        list.appendChild(card);
        return card;
    });
    play.addEventListener("click", () => {
        if (chordSequenceButton === play) {
            stopChordSequence();
            return;
        }
        stopChordSequence();
        stopScalePlayback();
        chordSequenceButton = play;
        play.textContent = t("stopChordSequence");
        let active;
        ChordLibrary.playProgression(chords, index => {
            active?.classList.remove("chord-sounding");
            active = cards[index];
            active?.classList.add("chord-sounding");
            if (list.scrollWidth > list.clientWidth && active) {
                list.scrollLeft += active.getBoundingClientRect().left - list.getBoundingClientRect().left;
            }
        }, () => {
            active?.classList.remove("chord-sounding");
            play.textContent = t("playChordSequence");
            chordSequenceButton = null;
        }, chordInstrument());
    });
    return { list, play };
}

function renderChordPreview() {
    chordPreview.hidden = session.mode !== "chords" || !analyzedChords.length;
    chordPreview.textContent = "";
    if (chordPreview.hidden) return;
    const sequence = buildChordSequence(analyzedChords);
    chordPreview.append(sequence.play, sequence.list);
}

function renderResults() {
    stopChordSequence();
    renderChordPreview();
    const progressions = isProgressionView();
    scaleResults.setAttribute("aria-pressed", String(!progressions));
    progressionResults.setAttribute("aria-pressed", String(progressions));
    matchSection.hidden = session.mode !== "notes" && !matches.length;
    matchStatus.classList.toggle("progression-context", progressions);
    if (progressions) {
        renderProgressions();
        return;
    }

    prepareResultList(session.mode === "audio" ? "probableKeys" : "fittingScales", matches.length, "scalesFound", "showAllScales");
    const approximate = session.mode === "chords" && matches.length && matches[0].outside.length;
    matchStatus.hidden = !approximate;
    matchStatus.textContent = approximate ? t("closestScales") : "";

    if (!matches.length) {
        results.appendChild(element("p", "empty", t("noScalesForNotes")));
        return;
    }

    const visible = showAll ? matches : matches.slice(0, previewLimit);
    visible.forEach(scale => {
        const row = element("div", "result-row");
        const expand = element("button", "open-scale");
        expand.type = "button";
        expand.setAttribute("aria-label", t("openScaleFullScreen", { name: scale.name }));
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
            const rest = outside.length > 4 ? ` ${t("additionalChords", { count: outside.length - 4 })}` : "";
            const summary = outside.slice(0, 4).join(", ") + rest;
            text.appendChild(element("span", "outside-chords", t("chordsOutsideScale", { chords: summary })));
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
    stopScalePlayback();
    stopChordSequence();
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
    byId("note-search").hidden = !notes;
    byId("chosen-legend").hidden = !notes;
    workspace.insertBefore(instrumentPanel, notes ? matchPanel : null);
    buildMainBoard(false);
    updateMatches();
}

function audioBusy() {
    return ["requesting", "choosing", "recording", "analyzing", "saving"].includes(audioPhase);
}

function openSharedAudio() {
    Array.from(document.querySelectorAll("dialog[open]")).reverse().forEach(dialog => dialog.close());
    closeScaleView();
    WorkspaceNavigation.showFinder();
    NoteAudio.stop();
    audioSource = "shared";
    resetAudioState();
    changeMode("audio");
    window.scrollTo(0, 0);
}

function cancelAudioSearch() {
    if (!audioBridge || !audioBusy() || audioPhase === "saving") return false;
    audioBridge.cancel();
    return true;
}

function resetAudioState() {
    audioPhase = "idle";
    audioMessage = "";
    audioAvailable = false;
    session.audioFile = null;
    session.audioAnalysis = null;
    session.audioKeys = [];
    session.audioScale = null;
    renderAudioFile();
    renderAudioControls();
}

function renderAudioControls() {
    const recording = audioPhase === "recording";
    audioEditor.renderRecording(recording);
    const busy = audioBusy();
    audioRecord.textContent = t(recording ? "stopAndAnalyze" : "recordAudio");
    audioRecord.disabled = !audioBridge || (busy && !recording);
    audioFile.disabled = !audioBridge || busy;
    audioCancel.hidden = !recording && audioPhase !== "analyzing";
    audioClear.disabled = !audioBridge || (!busy && !session.audioFile && !session.audioAnalysis
        && !session.audioKeys.length && !audioMessage);
    audioEditor.render(session.audioFile, audioAvailable, busy);
    audioEditor.renderMelody(session.audioAnalysis);
    const status = audioMessage || audioStatusKeys[audioPhase];
    audioStatus.textContent = status ? t(status) : "";
    audioStatus.hidden = !audioStatus.textContent;
    audioStatus.classList.toggle("chord-error", audioPhase === "error");
}

function updateAudioSearch(phase, keys, message, file, analysis) {
    const previousPhase = audioPhase;
    audioPhase = phase;
    audioMessage = message;
    if (phase === "recording" && session.mode !== "audio") {
        cancelAudioSearch();
        return;
    }
    const recording = phase === "recording";
    if (recording) audioSource = "microphone";
    if (phase === "analyzing" && previousPhase === "choosing") audioSource = "file";
    const cleared = phase === "idle" && !file;
    if (file || cleared || recording || phase === "analyzing") {
        audioAvailable = file?.available === true;
        session.audioFile = readAudioFile(file);
        renderAudioFile();
    }
    if (cleared || recording || phase === "analyzing" || phase === "done" || (phase === "error" && analysis)) {
        session.audioKeys = Array.isArray(keys) ? Array.from(new Set(keys.filter(isAudioKey))).slice(0, 3) : [];
        session.audioAnalysis = readAudioAnalysis(analysis);
        session.audioScale = null;
        if (session.mode === "audio") updateMatches();
        else persist();
    } else if (file) {
        persist();
    }
    renderAudioControls();
    if (phase === "done" && session.audioKeys.length) {
        const analyzed = session.audioAnalysis;
        const name = session.audioFile?.name || "";
        const query = analyzed && analyzed.fromMs > 0
            ? `${name} · ${audioEditor.time(analyzed.fromMs)}–${audioEditor.time(analyzed.toMs)}` : name;
        recordSearch(session.audioFile?.recording ? "microphone" : audioSource, query,
            session.audioKeys.map(id => scaleCatalog.get(id)));
    }
}

function renderChordError() {
    const message = chordValidation ? t(chordValidation.key, {
        minorChord: `${NoteNames.name(9)}m`,
        seventhChord: `${NoteNames.name(7)}7`,
        ...chordValidation.params,
    }) : "";
    chordError.textContent = message;
    chordError.hidden = !message;
    chordInput.setAttribute("aria-invalid", String(Boolean(message)));
}

function showChordError(key, params) {
    chordValidation = key ? { key, params } : null;
    renderChordError();
}

function renderChordText() {
    chordInput.maxLength = Math.max(chordTextLimit, session.chordText.length);
    chordInput.value = session.chordText;
    resetChords.disabled = !chordInput.value;
}

function renderChordPlaceholder() {
    chordInput.placeholder = [NoteNames.name(0), NoteNames.name(7), `${NoteNames.name(9)}m`, NoteNames.name(5)].join(" – ");
}

renderChordText();
renderChordPlaceholder();

function updateChordInput() {
    session.chordText = chordInput.value;
    resetChords.disabled = !chordInput.value;
    showChordError();
    if (session.chordAnalyzed) {
        session.chordAnalyzed = false;
        session.chordScale = null;
        setChordAnalysis([]);
        updateMatches();
    } else {
        persist();
    }
}

function setChordAnalysis(chords) {
    analyzedChords = chords;
    chordMatches = ChordFinder.match(chords);
}

function insertLibraryChord(chord) {
    const sequence = [chordInput.value.trim(), ChordLibrary.name(chord)].filter(Boolean).join(" – ");
    if (sequence.length > chordInput.maxLength) return;
    WorkspaceNavigation.showFinder();
    if (session.mode !== "chords") changeMode("chords");
    chordInput.value = sequence;
    updateChordInput();
    chordForm.scrollIntoView({ block: "nearest" });
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
        showChordError("invalidChords", { chords: sample });
        chordInput.focus();
        return;
    }
    if (!chords.length) {
        showChordError("missingChords");
        chordInput.focus();
        return;
    }
    chordInput.blur();
    showChordError();
    let submitted = chords;
    if (NoteNames.sharpsOnly()) {
        const mode = NoteNames.mode();
        const rewritten = ChordFinder.rewrite(session.chordText, mode, mode, { force: true });
        if (rewritten !== session.chordText) {
            session.chordText = rewritten;
            renderChordText();
            submitted = ChordFinder.parse(rewritten).chords;
        }
    }
    session.chordAnalyzed = true;
    setChordAnalysis(submitted);
    updateMatches();
    const query = submitted.map(chord => chord.label).join(" · ");
    const canonical = ChordFinder.rewrite(query, NoteNames.mode(), "international",
        { sharpsOnly: false, force: NoteNames.sharpsOnly() });
    recordSearch("chords", canonical, chordMatches);
    if (matchSection.getBoundingClientRect().top > window.innerHeight - 110) {
        matchSection.scrollIntoView({ block: "start" });
    }
});

noteMode.addEventListener("click", () => changeMode("notes"));
chordMode.addEventListener("click", () => changeMode("chords"));
audioMode.addEventListener("click", () => changeMode("audio"));
scaleResults.addEventListener("click", () => setResultView(false));
progressionResults.addEventListener("click", () => setResultView(true));
fretboardView.addEventListener("click", () => setPianoMode(false));
pianoView.addEventListener("click", () => setPianoMode(true));
audioRecord.addEventListener("click", () => {
    if (!audioBridge) return;
    NoteAudio.stop();
    audioBridge.recordOrStop();
});
audioFile.addEventListener("click", () => {
    if (!audioBridge) return;
    stopScalePlayback();
    audioBridge.pickFile();
});
audioCancel.addEventListener("click", cancelAudioSearch);
audioClear.addEventListener("click", () => {
    NoteAudio.stop();
    resetAudioState();
    updateMatches();
    audioBridge.clear();
});
if (!audioBridge) updateAudioSearch("error", [], "audioAndroidOnly");
picker.addEventListener("change", () => setPreview(picker.value));
scalePlay.addEventListener("click", () => playScale(activeScale, scalePlay, session.pianoMode ? mainPiano : mainBoard));
detailScalePlay.addEventListener("click", () => playScale(detailScale, detailScalePlay, session.pianoMode ? detailPiano : detailBoard));
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
    if (event.key === "Escape" && !document.querySelector("dialog[open]")
        && (dismissScaleView() || WorkspaceNavigation.showFinder())) event.preventDefault();
});
byId("workspace-tools").addEventListener("click", () => {
    if (audioPhase === "recording") audioBridge.recordOrStop();
    else if (audioPhase === "requesting") cancelAudioSearch();
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

function buildMainBoard(resetScroll) {
    const piano = session.pianoMode;
    const interactive = session.mode === "notes";
    mainFretboardSection.hidden = piano;
    mainPianoSection.hidden = !piano;
    fretboardView.setAttribute("aria-pressed", String(!piano));
    pianoView.setAttribute("aria-pressed", String(piano));
    byId("scale-picker-label").textContent = t(piano ? "pianoScale" : "fretboardScale");
    if (piano) mainPiano.build(resetScroll, interactive);
    else mainBoard.build(resetScroll, interactive);
}

function setPianoMode(enabled) {
    if (session.pianoMode === enabled) return;
    stopScalePlayback();
    session.pianoMode = enabled;
    persist();
    refreshSetup(false);
    renderSelection();
    renderResults();
}

function refreshSetup(resetScroll) {
    stopScalePlayback();
    buildMainBoard(resetScroll);
    renderBoard();
}

function refreshInterface(resetScroll = false) {
    refreshSetup(resetScroll);
    renderPicker();
    renderSelection();
    renderResults();
    renderChordPlaceholder();
    renderChordError();
    renderAudioControls();
    renderAudioFile();
    if (historyDialog.open) renderHistory();
    if (!scaleView.hidden) {
        byId("detail-title").textContent = detailScale.name;
        byId("detail-pitches").textContent = pitchesOf(detailScale);
        if (session.pianoMode) {
            detailPiano.build(false);
            detailPiano.render(detailScale);
        } else {
            const leadingFret = detailBoard.leadingFret();
            renderDetailFrets(Number(detailFrom.value), Number(detailTo.value));
            detailBoard.scrollToFret(leadingFret);
        }
    }
}

function refreshNotation(resetScroll = false) {
    const nextNotation = NoteNames.mode();
    const nextSharps = NoteNames.sharpsOnly();
    const sharpsChanged = session.chordSharps !== nextSharps;
    if (session.chordNotation !== nextNotation || sharpsChanged) {
        session.chordText = ChordFinder.rewrite(session.chordText, session.chordNotation, nextNotation, { force: sharpsChanged });
        session.chordNotation = nextNotation;
        session.chordSharps = nextSharps;
        renderChordText();
        if (session.chordAnalyzed) setChordAnalysis(ChordFinder.parse(session.chordText).chords);
        if (session.mode === "chords") selectMatches();
    }
    persist();
    refreshInterface(resetScroll);
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
    confirmAction("resetSettingsTitle", "resetSettingsDescription", "resetSettingsAction", () => {
        FretSettings.reset();
        NoteAudio.stop();
        NoteAudio.updateVolume();
        session.detailFrom = 0;
        session.detailTo = null;
        session.pianoMode = false;
        detailScrollFret = null;
        refreshNotation(true);
    });
});
historyOpen.addEventListener("click", () => {
    flushNotesHistory();
    renderHistory();
    showDialog(historyDialog);
});
historyClear.addEventListener("click", () => {
    confirmAction("clearHistoryTitle", "clearHistoryDescription", "clearHistoryAction", () => {
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
    renderScalePlayback();
    audioEditor.renderMelody(session.audioAnalysis);
    updateChordPlaybackControls();
}, () => {
    NoteAudio.updateVolume();
    renderScalePlayback();
    audioEditor.renderMelody(session.audioAnalysis);
    updateChordPlaybackControls();
}, previewVolume, refreshInterface, refreshNotation);
ChordLibrary.init(showDialog, insertLibraryChord, chordInstrument);
renderAudioControls();
renderAudioFile();
changeMode(session.mode);
document.documentElement.classList.remove("starting");
if (audioBridge) audioBridge.ready();
