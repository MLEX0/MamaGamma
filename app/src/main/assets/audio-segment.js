"use strict";

function createAudioSegment(bridge) {
    const editor = document.getElementById("audio-segment");
    const analyze = document.getElementById("audio-analyze-segment");
    const save = document.getElementById("audio-save");
    const warning = document.getElementById("audio-segment-error");
    const melody = document.getElementById("audio-melody");
    const caption = document.getElementById("audio-melody-caption");
    const notesList = document.getElementById("audio-melody-notes");
    const live = document.getElementById("audio-live");
    const liveTime = document.getElementById("audio-live-time");
    const liveBars = document.getElementById("audio-live-bars");
    const controls = ["from", "to"].map(bound => document.getElementById(`audio-segment-${bound}`));
    const wave = document.getElementById("audio-wave-editor");
    const track = document.getElementById("audio-wave-track");
    const bars = document.getElementById("audio-wave-bars");
    const highlight = document.getElementById("audio-wave-selection");
    const handles = ["from", "to"].map(bound => document.getElementById(`audio-wave-${bound}`));
    const pan = document.getElementById("audio-wave-pan");
    const zoomIn = document.getElementById("audio-wave-zoom-in");
    const zoomOut = document.getElementById("audio-wave-zoom-out");
    const durationLabel = document.getElementById("audio-range-duration");
    const leftLabel = document.getElementById("audio-wave-left");
    const rightLabel = document.getElementById("audio-wave-right");
    const waveStatus = document.getElementById("audio-wave-status");
    const minimum = 100;
    const maximum = 20000;
    let duration = 0;
    let source = "";
    let busy = false;
    let waveform = [];
    let waveformDuration = 0;
    let waveformProcessed = 0;
    let waveformComplete = false;
    let selection = [0, 0];
    let viewStart = 0;
    let viewSpan = 0;
    let drawnView = "";
    let drag;
    const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

    function renderRecording(recording) {
        if (live.hidden === !recording) return;
        live.hidden = !recording;
        liveTime.textContent = "0:00.0";
        liveBars.textContent = "";
    }

    window.updateRecordingWaveform = (peaks, elapsedMs) => {
        if (live.hidden || !Array.isArray(peaks) || !Number.isFinite(elapsedMs)) return;
        const tenths = Math.max(0, Math.floor(elapsedMs / 100));
        liveTime.textContent = `${Math.floor(tenths / 600)}:${(tenths % 600 / 10).toFixed(1).padStart(4, "0")}`;
        const visible = peaks.slice(-200);
        while (liveBars.children.length < visible.length) liveBars.appendChild(document.createElement("i"));
        while (liveBars.children.length > visible.length) liveBars.lastElementChild.remove();
        visible.forEach((peak, index) => {
            liveBars.children[index].style.height = `${Math.max(3, Math.sqrt(clamp(Number(peak) || 0, 0, 1)) * 90)}%`;
        });
    };

    function time(ms) {
        const seconds = Math.round(ms / 10) / 100;
        const minutes = Math.floor(seconds / 60);
        return `${minutes}:${(seconds % 60).toFixed(2).padStart(5, "0")}`;
    }

    function values() {
        return controls.map(number => Math.round(number.valueAsNumber * 1000));
    }

    function validate() {
        const [from, to] = values();
        const valid = from >= 0 && to <= duration && to - from >= minimum && to - from <= maximum;
        analyze.disabled = !valid || busy;
        warning.hidden = valid || editor.hidden || busy;
        warning.textContent = warning.hidden ? "" : t("audioSegmentInvalid");
        return valid;
    }

    function setValues(from, to) {
        selection = [Math.round(from), Math.round(to)];
        controls.forEach((input, index) => { input.value = selection[index] / 1000; });
        validate();
        renderWave();
    }

    function renderWave() {
        renderWaveStatus();
        if (wave.hidden || !viewSpan) return;
        const [from, to] = selection;
        const offset = point => (point - viewStart) / viewSpan;
        const left = clamp(offset(from), 0, 1);
        const right = clamp(offset(to), 0, 1);
        highlight.style.left = `${100 * left}%`;
        highlight.style.width = `${100 * (right - left)}%`;
        handles.forEach((handle, index) => {
            const point = offset(selection[index]);
            handle.hidden = point < -0.001 || point > 1.001;
            handle.style.left = `${100 * clamp(point, 0, 1)}%`;
            handle.title = time(selection[index]);
        });
        durationLabel.textContent = time(to - from);
        leftLabel.textContent = time(viewStart);
        rightLabel.textContent = time(viewStart + viewSpan);
        pan.hidden = viewSpan >= duration;
        pan.max = Math.max(0, duration - viewSpan);
        pan.value = viewStart;
        pan.setAttribute("aria-valuetext", leftLabel.textContent);
        zoomIn.disabled = busy || viewSpan <= Math.max(1000, to - from + 100);
        zoomOut.disabled = busy || viewSpan >= duration;
        drawWave();
    }

    function renderWaveStatus() {
        const key = !waveformComplete ? "audioWaveLoading" : !waveform.length ? "audioWaveUnavailable" : "";
        const message = key ? t(key) : "";
        if (waveStatus.textContent !== message) waveStatus.textContent = message;
        waveStatus.hidden = wave.hidden || !message;
    }

    function drawWave() {
        const width = bars.clientWidth;
        const view = `${width}:${viewStart}:${viewSpan}`;
        if (!width || !viewSpan || drawnView === view) return;
        drawnView = view;
        bars.textContent = "";
        if (!waveform.length || !waveformDuration) return;
        const count = Math.max(1, Math.floor(width / 3));
        const fragment = document.createDocumentFragment();
        for (let index = 0; index < count; index += 1) {
            const point = viewStart + index / count * viewSpan;
            const start = Math.floor(point / waveformDuration * waveform.length);
            const stop = Math.ceil((point + viewSpan / count) / waveformDuration * waveform.length);
            let peak = 0;
            for (let bin = start; bin < Math.min(waveform.length, stop); bin += 1) peak = Math.max(peak, waveform[bin]);
            const bar = document.createElement("i");
            bar.style.height = `${Math.max(2, Math.sqrt(peak) * 86)}%`;
            if (!waveformComplete && point >= waveformProcessed) bar.style.opacity = 0;
            fragment.appendChild(bar);
        }
        bars.appendChild(fragment);
    }

    window.updateAudioWaveform = (bars, totalMs, complete = true, processedMs = totalMs) => {
        waveform = Array.isArray(bars) ? bars.slice(0, 2048).map(value => clamp(Number(value) || 0, 0, 1)) : [];
        waveformDuration = Math.max(0, Number(totalMs) || 0);
        waveformProcessed = clamp(Number(processedMs) || 0, 0, waveformDuration);
        waveformComplete = waveformDuration > 0 && complete === true;
        drawnView = "";
        renderWaveStatus();
        drawWave();
    };
    new ResizeObserver(drawWave).observe(track);

    function positionView(center, span) {
        viewSpan = clamp(Math.round(span), Math.min(duration, 1000), duration);
        viewStart = Math.round(clamp(center - viewSpan / 2, 0, duration - viewSpan));
        renderWave();
    }

    function revealSelection() {
        const [from, to] = selection;
        if (from < viewStart || to > viewStart + viewSpan) {
            positionView((from + to) / 2, Math.max(viewSpan, to - from + 100));
        }
    }

    function zoom(factor) {
        const [from, to] = selection;
        positionView((from + to) / 2, Math.max(viewSpan * factor, to - from + 100));
    }

    zoomIn.addEventListener("click", () => zoom(.5));
    zoomOut.addEventListener("click", () => zoom(2));
    pan.addEventListener("input", () => {
        viewStart = pan.valueAsNumber;
        renderWave();
    });
    controls.forEach(input => input.addEventListener("input", () => {
        if (!validate()) return;
        selection = values();
        revealSelection();
        renderWave();
    }));

    function resizeSelection(index, point) {
        const [from, to] = selection;
        if (index === 0) setValues(clamp(point, Math.max(0, to - maximum), to - minimum), to);
        else setValues(from, clamp(point, from + minimum, Math.min(duration, from + maximum)));
    }

    handles.forEach((handle, index) => handle.addEventListener("keydown", event => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const step = event.shiftKey ? 1000 : 100;
        resizeSelection(index, selection[index] + (event.key === "ArrowLeft" ? -step : step));
        revealSelection();
    }));

    const pointerTime = event => {
        const bounds = track.getBoundingClientRect();
        return viewStart + (event.clientX - bounds.left) / bounds.width * viewSpan;
    };

    track.addEventListener("pointerdown", event => {
        if (busy || drag || event.button !== 0) return;
        const index = handles.indexOf(event.target);
        const point = pointerTime(event);
        const length = selection[1] - selection[0];
        if (index < 0 && (point < selection[0] || point > selection[1])) {
            const from = clamp(point - length / 2, 0, duration - length);
            setValues(from, from + length);
        }
        drag = { pointer: event.pointerId, index, length, offset: point - selection[index < 0 ? 0 : index] };
        track.setPointerCapture(event.pointerId);
    });
    track.addEventListener("pointermove", event => {
        if (!drag || event.pointerId !== drag.pointer || busy) return;
        const point = Math.round((pointerTime(event) - drag.offset) / 10) * 10;
        if (drag.index >= 0) resizeSelection(drag.index, point);
        else {
            const from = clamp(point, 0, duration - drag.length);
            setValues(from, from + drag.length);
        }
    });
    track.addEventListener("lostpointercapture", () => { drag = null; });

    analyze.addEventListener("click", () => {
        if (!validate() || busy) return;
        NoteAudio.stop();
        bridge.analyzeSegment(...values());
    });
    save.addEventListener("click", () => bridge.saveRecording());

    function render(file, available, blocked) {
        busy = blocked;
        const nextSource = available && file ? JSON.stringify([file.name, file.size, file.durationMs, file.recording]) : "";
        const hasRange = Boolean(nextSource) && file.durationMs >= minimum;
        editor.hidden = !hasRange && !(available && file?.recording);
        wave.hidden = !hasRange;
        controls[0].parentElement.parentElement.hidden = !hasRange;
        save.hidden = !available || !file?.recording;
        save.disabled = busy;
        analyze.hidden = !hasRange;
        [...controls, ...handles, pan].forEach(input => { input.disabled = busy; });
        track.classList.toggle("audio-wave-busy", busy);
        if (nextSource !== source) {
            source = nextSource;
            duration = hasRange ? Math.round(file.durationMs) : 0;
            controls.forEach(number => { number.max = duration / 1000; });
            viewStart = 0;
            viewSpan = Math.min(duration, 60000);
            setValues(0, Math.min(duration, maximum));
        }
        renderWave();
        validate();
        if (!hasRange) warning.hidden = true;
    }

    function renderMelody(analysis) {
        melody.hidden = !analysis;
        notesList.textContent = "";
        if (!analysis) return;
        caption.textContent = analysis.notes.length
            ? t("audioMelodyRange", { from: time(analysis.fromMs), to: time(analysis.toMs) })
            : t("audioNoMelody");
        const notes = document.createDocumentFragment();
        for (const { midi, startMs, endMs } of analysis.notes) {
            const row = element("li");
            const label = `${NoteNames.name(midi % 12)}${Math.floor(midi / 12) - 1}`;
            const button = element("button", "secondary-button melody-note", label);
            button.type = "button";
            button.disabled = !FretSettings.soundEnabled() || FretSettings.noteVolume() === 0;
            button.addEventListener("click", () => NoteAudio.play(midi));
            row.append(button, element("span", "melody-time", `${time(startMs)}–${time(endMs)}`));
            notes.appendChild(row);
        }
        notesList.appendChild(notes);
    }

    return { render, renderRecording, renderMelody, time };
}
