"use strict";

(() => {
    const bridge = window.MamaGammaTuner;
    const dialog = document.getElementById("tuner-dialog");
    const targets = document.getElementById("tuner-strings");
    const meter = document.getElementById("tuner-meter");
    const note = document.getElementById("tuner-note");
    const frequencyLabel = document.getElementById("tuner-frequency");
    const centsLabel = document.getElementById("tuner-cents");
    const status = document.getElementById("tuner-status");
    const toggle = document.getElementById("tuner-toggle");
    let phase = "idle";
    let frequency = 0;
    let selected;
    let strings = [];
    let format;

    function noteLabel(midi) {
        return `${NoteNames.name(midi % 12)}${Math.floor(midi / 12) - 1}`;
    }

    function running() {
        return phase === "requesting" || phase === "starting" || phase === "listening";
    }

    function showReading() {
        let message = "tunerInstruction";
        let cents = 0;
        let reading = "—";
        let state = "idle";
        const heard = phase === "listening" && frequency > 0;
        if (heard) {
            const position = 69 + 12 * Math.log2(frequency / 440);
            const midi = Math.round(position);
            const target = strings[selected] ?? midi;
            cents = Math.round((position - target) * 100);
            reading = noteLabel(midi);
            state = Math.abs(cents) <= 4 ? "center" : cents < 0 ? "flat" : "sharp";
            message = { center: "tunerInTune", flat: "tunerFlat", sharp: "tunerSharp" }[state];
        } else if (!bridge) message = "tunerUnavailable";
        else if (phase === "requesting") message = "microphoneRequest";
        else if (phase === "starting") message = "tunerStarting";
        else if (phase === "denied") message = "tunerDenied";
        else if (phase === "error") message = "tunerError";

        meter.dataset.state = state;
        meter.style.setProperty("--tuner-offset", `${50 + Math.max(-50, Math.min(50, cents))}%`);
        note.textContent = reading;
        frequencyLabel.textContent = heard ? t("tunerFrequency", { frequency: format.format(frequency) }) : "";
        const signedCents = cents > 0 ? `+${cents}` : String(cents);
        centsLabel.textContent = heard ? t("tunerCents", { cents: signedCents }) : "";
        const label = t(message);
        if (status.textContent !== label) status.textContent = label;
    }

    function showState(next, hz) {
        phase = next;
        frequency = Number.isFinite(hz) && hz > 0 ? hz : 0;
        toggle.textContent = t(running() ? "tunerStop" : "tunerStart");
        toggle.disabled = !bridge;
        showReading();
    }

    function renderTargets() {
        const instrument = FretSettings.instrument();
        strings = FretSettings.setup().midi;
        document.getElementById("tuner-target-label").textContent = t(instrument.name);
        targets.textContent = "";
        const buttons = [element("button", "secondary-button", t("tunerChromatic"))];
        strings.forEach((midi, index) => {
            const stringLabel = t(instrument.courses ? "stringPairNumber" : "stringNumber", { number: index + 1 });
            const button = element("button", "secondary-button", `${index + 1} · ${noteLabel(midi)}`);
            button.setAttribute("aria-label", `${stringLabel}, ${noteLabel(midi)}`);
            buttons.push(button);
        });
        buttons.forEach((button, index) => {
            button.type = "button";
            button.setAttribute("aria-pressed", String(index === 0));
            button.addEventListener("click", () => {
                selected = index - 1;
                buttons.forEach((target, position) => target.setAttribute("aria-pressed", String(position === index)));
                showReading();
            });
            targets.appendChild(button);
        });
    }

    document.getElementById("tuner-open").addEventListener("click", () => {
        format = new Intl.NumberFormat(I18n.language(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        selected = -1;
        renderTargets();
        showState("idle", 0);
        showDialog(dialog);
    });
    toggle.addEventListener("click", () => {
        if (!bridge) return;
        if (running()) {
            bridge.stop();
            showState("idle", 0);
        } else {
            NoteAudio.stop();
            showState("starting", 0);
            bridge.start();
        }
    });
    dialog.addEventListener("close", () => { if (bridge) bridge.stop(); });
    window.addEventListener("pagehide", () => { if (bridge) bridge.stop(); });
    window.updateTuner = (next, hz) => { if (dialog.open) showState(next, hz); };
})();
