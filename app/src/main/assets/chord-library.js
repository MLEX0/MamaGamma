"use strict";

const ChordLibrary = (() => {
    const dialog = document.getElementById("chord-library");
    const searchForm = document.getElementById("chord-library-search");
    const query = document.getElementById("chord-library-query");
    const error = document.getElementById("chord-library-error");
    const rootPicker = document.getElementById("chord-library-root");
    const typePicker = document.getElementById("chord-library-type");
    const bassPicker = document.getElementById("chord-library-bass");
    const instrumentPicker = document.getElementById("chord-library-instrument");
    const heading = document.getElementById("chord-library-heading");
    const notes = document.getElementById("chord-library-notes");
    const shapes = document.getElementById("chord-library-shapes");
    const legend = document.getElementById("chord-library-legend");
    const playButton = document.getElementById("chord-library-play");
    const insertButton = document.getElementById("chord-library-insert");
    const pitchOf = midi => midi % 12;
    const noteWithOctave = midi => NoteNames.name(pitchOf(midi)) + (Math.floor(midi / 12) - 1);
    let show;
    let selected;

    function name(chord) {
        const root = NoteNames.name(chord.root);
        const bass = chord.bass ? "/" + NoteNames.name(chord.bass.pitch) : "";
        return root + chord.suffix + bass;
    }

    function noteNames(chord) {
        return chord.pitches.map(pitch => NoteNames.name(pitch));
    }

    function keyboardVoicing(chord, octave = 3) {
        const bass = chord.bass?.pitch ?? chord.root;
        const midi = (octave + 1) * 12 + bass;
        return chord.pitches.map(pitch => midi + (pitch - bass + 12) % 12).sort((a, b) => a - b);
    }

    function play(chord, instrumentId = "piano") {
        const setup = instrumentId === "piano" ? null : FretSettings.setupFor(instrumentId);
        const shape = setup ? stringVoicings(chord, setup)[0] : null;
        NoteAudio.playChord(shape?.midis || keyboardVoicing(chord), shape ? instrumentId : "piano");
    }

    function playProgression(chords, onStep, onEnd, instrumentId = "piano") {
        const setup = instrumentId === "piano" ? null : FretSettings.setupFor(instrumentId);
        const shapes = new Map();
        if (setup) {
            for (const chord of chords) {
                const label = name(chord);
                if (!shapes.has(label)) shapes.set(label, stringVoicings(chord, setup)[0]?.midis);
            }
        }
        const strings = setup && Array.from(shapes.values()).every(Boolean);
        const voicings = chords.map(chord => strings ? shapes.get(name(chord)) : keyboardVoicing(chord));
        NoteAudio.playChords(voicings, FretSettings.scaleTempo(),
            index => onStep?.(index, chords[index]), onEnd, strings ? instrumentId : "piano");
    }

    function stringVoicings(chord, setup) {
        const tuning = [...setup.midi].reverse();
        const bass = chord.bass?.pitch ?? chord.root;
        const required = Math.min(3, chord.pitches.length);
        const choices = tuning.map(() => []);
        const picked = [];
        const best = [];
        const limit = 6;

        function evaluate(firstFret, lastFret, lowestMidi, mask, muted, internalMutes) {
            if (pitchOf(lowestMidi) !== bass || (mask & (1 << chord.root)) === 0) return;
            const omitted = chord.pitches.filter(pitch => (mask & (1 << pitch)) === 0);
            if (chord.pitches.length - omitted.length < required) return;
            const omissionCost = omitted.reduce((total, pitch) => {
                const interval = (pitch - chord.root + 12) % 12;
                return total + (interval === 7 ? 1 : [2, 3, 4, 5, 10, 11].includes(interval) ? 4 : 2);
            }, 0);
            const score = omissionCost * 100 + (lastFret - firstFret) * 7 + firstFret * 3 + muted * 3 + internalMutes * 4;
            if (best.length === limit && score >= best.at(-1).score) return;
            best.push({ score, frets: [...picked], omitted });
            best.sort((a, b) => a.score - b.score);
            if (best.length > limit) best.pop();
        }

        function visit(index, start, firstFret, lastFret, lowestMidi, mask, muted, pendingMutes, internalMutes) {
            if (index === tuning.length) {
                if (firstFret === start || (start === 1 && firstFret === 0)) {
                    evaluate(firstFret, lastFret, lowestMidi, mask, muted, internalMutes);
                }
                return;
            }

            for (const fret of choices[index]) {
                picked[index] = fret;
                if (fret < 0) {
                    visit(index + 1, start, firstFret, lastFret, lowestMidi, mask,
                        muted + 1, mask ? pendingMutes + 1 : 0, internalMutes);
                    continue;
                }
                const midi = tuning[index] + fret;
                visit(index + 1, start, fret && !firstFret ? fret : firstFret, Math.max(lastFret, fret),
                    Math.min(lowestMidi, midi), mask | (1 << pitchOf(midi)), muted, 0, internalMutes + pendingMutes);
            }
        }

        for (let start = 1; start <= setup.frets; start += 1) {
            tuning.forEach((midi, index) => {
                const frets = choices[index];
                frets.length = 0;
                frets.push(-1);
                if (chord.pitches.includes(pitchOf(midi))) frets.push(0);
                for (let fret = start; fret <= Math.min(setup.frets, start + 3); fret += 1) {
                    if (chord.pitches.includes(pitchOf(midi + fret))) frets.push(fret);
                }
            });
            visit(0, start, 0, 0, Infinity, 0, 0, 0, 0);
        }

        return best.map(({ frets, omitted }) => ({
            frets, omitted, tuning, midis: frets.flatMap((fret, index) => fret < 0 ? [] : [tuning[index] + fret]),
        }));
    }

    function addOption(picker, label, value) {
        picker.add(new Option(label, String(value)));
    }

    function renderPickers(chord) {
        rootPicker.textContent = "";
        bassPicker.textContent = "";
        typePicker.textContent = "";
        const rootName = NoteNames.name(chord.root);
        addOption(bassPicker, t("chordRootPosition", { note: rootName }), "");
        NoteNames.names().forEach((label, pitch) => {
            addOption(rootPicker, label, pitch);
            if (pitch !== chord.root) addOption(bassPicker, label, pitch);
        });
        const suffixes = ChordFinder.suffixes.includes(chord.suffix)
            ? ChordFinder.suffixes : [...ChordFinder.suffixes, chord.suffix];
        suffixes.forEach(suffix => {
            const type = suffix === "" ? t("chordMajorType") : suffix === "m" ? t("chordMinorType") : rootName + suffix;
            addOption(typePicker, type, suffix);
        });
        rootPicker.value = String(chord.root);
        typePicker.value = chord.suffix;
        bassPicker.value = chord.bass && chord.bass.pitch !== chord.root ? String(chord.bass.pitch) : "";
    }

    function renderStringRow(shape, instrument) {
        const row = element("div", "chord-shape-strings");
        row.dataset.strings = shape.tuning.length;
        shape.frets.forEach((fret, index) => {
            const cell = element("div", "chord-shape-string");
            const open = shape.tuning[index];
            const string = t(instrument.courses ? "stringPairNumber" : "stringNumber", { number: shape.tuning.length - index });
            const position = fret < 0 ? t("chordStringMuted") : fret === 0 ? t("openNote") : t("fretNumber", { number: fret });
            cell.setAttribute("role", "group");
            cell.setAttribute("aria-label", t("chordStringPosition", { string, position }));
            cell.append(element("span", "chord-open-string", noteWithOctave(open)),
                element("strong", "chord-fret-number", fret < 0 ? "×" : fret),
                element("span", "chord-voiced-note", fret < 0 ? "–" : NoteNames.name(pitchOf(open + fret))));
            row.appendChild(cell);
        });
        return row;
    }

    function renderPianoRow(midis) {
        const row = element("div", "chord-shape-keys");
        midis.forEach(midi => {
            const key = element("button", "chord-shape-key", noteWithOctave(midi));
            key.type = "button";
            key.disabled = !NoteAudio.canPlay();
            key.addEventListener("click", () => NoteAudio.play(midi));
            row.appendChild(key);
        });
        return row;
    }

    function renderShape(shape, index, instrument) {
        const card = element("li", "chord-shape");
        const header = element("div", "chord-shape-header");
        const number = index + 1;
        const sound = element("button", "chord-shape-play secondary-button", "▶");
        sound.type = "button";
        sound.disabled = !NoteAudio.canPlay();
        sound.setAttribute("aria-label", t("chordPlayShape", { number }));
        sound.addEventListener("click", () => NoteAudio.playChord(shape.midis, instrument?.id || "piano"));
        header.append(element("h3", "", t("chordShapeNumber", { number })), sound);
        card.append(header, instrument ? renderStringRow(shape, instrument) : renderPianoRow(shape.midis));
        if (shape.omitted.length) {
            const missing = shape.omitted.map(pitch => NoteNames.name(pitch)).join(" · ");
            card.appendChild(element("p", "chord-shape-omissions", t("chordShapeOmissions", { notes: missing })));
        }
        shapes.appendChild(card);
    }

    function renderVoicings() {
        shapes.textContent = "";
        const instrument = FretSettings.instruments().find(item => item.id === instrumentPicker.value);
        legend.hidden = !instrument;
        const summary = document.getElementById("chord-library-no-shape");
        if (instrument) {
            const voicings = stringVoicings(selected, FretSettings.setupFor(instrument.id));
            summary.hidden = voicings.length > 0;
            voicings.forEach((shape, index) => renderShape(shape, index, instrument));
            return;
        }

        summary.hidden = true;
        const close = keyboardVoicing(selected, FretSettings.pianoRange().firstOctave);
        const spread = close.map((midi, index) => index === 1 ? midi + 12 : midi).sort((a, b) => a - b);
        [close, spread].forEach((midis, index) => renderShape({ midis, omitted: [] }, index));
    }

    function setChord(chord) {
        selected = chord;
        error.hidden = true;
        query.removeAttribute("aria-invalid");
        query.value = name(chord);
        renderPickers(chord);
        heading.textContent = name(chord);
        notes.textContent = noteNames(chord).join(" · ");
        playButton.disabled = !NoteAudio.canPlay();
        playButton.setAttribute("aria-label", t("playChord", { chord: name(chord) }));
        renderVoicings();
    }

    function updateChord() {
        const bass = bassPicker.value === "" ? null : Number(bassPicker.value);
        setChord(ChordFinder.build(Number(rootPicker.value), typePicker.value, bass));
    }

    function open(chord, instrumentId = FretSettings.instrument().id) {
        NoteAudio.stop();
        instrumentPicker.textContent = "";
        FretSettings.instruments().forEach(item => addOption(instrumentPicker, t(item.name), item.id));
        addOption(instrumentPicker, t("pianoView"), "piano");
        instrumentPicker.value = instrumentId;
        query.placeholder = NoteNames.name(0) + "maj7";
        setChord(chord || ChordFinder.build(0, ""));
        show(dialog);
        dialog.querySelector(".settings-content").scrollTop = 0;
    }

    function init(showDialog, onInsert, preferredInstrument = () => FretSettings.instrument().id) {
        show = showDialog;
        document.getElementById("chord-library-open").addEventListener("click", () => open(undefined, preferredInstrument()));
        searchForm.addEventListener("submit", event => {
            event.preventDefault();
            const parsed = ChordFinder.parse(query.value.trim());
            if (parsed.chords.length === 1 && !parsed.invalid.length) {
                query.blur();
                setChord(parsed.chords[0]);
                return;
            }
            error.textContent = t("chordLibraryInvalid", { chord: query.placeholder });
            error.hidden = false;
            query.setAttribute("aria-invalid", "true");
        });
        [rootPicker, typePicker, bassPicker].forEach(picker => picker.addEventListener("change", updateChord));
        instrumentPicker.addEventListener("change", renderVoicings);
        playButton.addEventListener("click", () => play(selected, instrumentPicker.value));
        insertButton.hidden = !onInsert;
        insertButton.addEventListener("click", () => {
            dialog.close();
            onInsert?.(selected);
        });
        dialog.addEventListener("close", NoteAudio.stop);
    }

    return { init, open, name, noteNames, play, playProgression, stringVoicings, keyboardVoicing };
})();
