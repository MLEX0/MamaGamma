"use strict";

const ChordFinder = (() => {
    const formulas = {
        "": [0, 4, 7], m: [0, 3, 7], "5": [0, 7], dim: [0, 3, 6], aug: [0, 4, 8],
        sus2: [0, 2, 7], sus4: [0, 5, 7], "7sus2": [0, 2, 7, 10], "7sus4": [0, 5, 7, 10],
        "6": [0, 4, 7, 9], m6: [0, 3, 7, 9], "6/9": [0, 4, 7, 9, 2], m69: [0, 3, 7, 9, 2],
        "7": [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], mmaj7: [0, 3, 7, 11],
        dim7: [0, 3, 6, 9], m7b5: [0, 3, 6, 10], aug7: [0, 4, 8, 10], augmaj7: [0, 4, 8, 11],
        add9: [0, 4, 7, 2], madd9: [0, 3, 7, 2], add11: [0, 4, 7, 5], madd11: [0, 3, 7, 5],
        "9": [0, 4, 7, 10, 2], maj9: [0, 4, 7, 11, 2], m9: [0, 3, 7, 10, 2],
        "11": [0, 4, 7, 10, 2, 5], maj11: [0, 4, 7, 11, 2, 5], m11: [0, 3, 7, 10, 2, 5],
        "13": [0, 4, 7, 10, 2, 9], maj13: [0, 4, 7, 11, 2, 9], m13: [0, 3, 7, 10, 2, 9],
    };
    const aliases = { maj: "", sus: "sus4", "7sus": "7sus4", "69": "6/9", "m6/9": "m69", "ø": "m7b5", "ø7": "m7b5" };
    const alterations = { b5: [7, 6], "#5": [7, 8], b9: [2, 1], "#9": [2, 3], "#11": [5, 6], b13: [9, 8] };

    function chordIntervals(suffix) {
        const quality = suffix.replace(/[()]/g, "")
            .replace(/^m?M(?=\d|$)/, match => match.length === 2 ? "mmaj" : "maj")
            .toLowerCase().replace(/^(?:minor|min|-)/, "m").replace(/^major/, "maj")
            .replace(/Δ|△/gi, "maj").replace(/^°/, "dim").replace(/^\+/, "aug");
        const name = Object.prototype.hasOwnProperty.call(aliases, quality) ? aliases[quality] : quality;
        if (Object.prototype.hasOwnProperty.call(formulas, name)) return formulas[name];

        const altered = name.match(/^(7|9|11|13|maj7|m7)(b5|#5|b9|#9|#11|b13)$/);
        if (!altered) return null;
        const [natural, replacement] = alterations[altered[2]];
        return formulas[altered[1]].filter(interval => interval !== natural).concat(replacement);
    }

    function parseChord(label, mode) {
        const slash = label.lastIndexOf("/");
        const afterSlash = slash === -1 ? "" : label.slice(slash + 1);
        const bassText = afterSlash.trim();
        const bass = NoteNames.readRoots(bassText, mode).find(note => note.length === bassText.length);
        // A longer note name can overlap a chord suffix, as in Asus4 in German notation.
        for (const root of NoteNames.readRoots(label, mode)) {
            const suffix = label.slice(root.length, bass ? slash : label.length)
                .trim().replace(/\s*\/\s*/g, "/").replace(/♯/g, "#").replace(/♭/g, "b").replace(/−/g, "-");
            const intervals = chordIntervals(suffix);
            if (!intervals) continue;
            const pitches = new Set(intervals.map(interval => ScaleFinder.pitchAt(root.pitch, interval)));
            if (bass) pitches.add(bass.pitch);
            return {
                label: label.replace(/\s*\/\s*/g, "/"), text: label, root: root.pitch,
                pitches: [...pitches], dominant: intervals.includes(4) && intervals.includes(10),
                rootLength: root.length, bass,
                bassStart: bass ? slash + 1 + afterSlash.length - afterSlash.trimStart().length : label.length,
            };
        }
        return null;
    }

    function mapTokens(text, mode, transform) {
        const hyphenSeparator = new RegExp("([-−](?=(?:" + NoteNames.rootPattern(mode) + ")))", "iu");
        return text.replace(/(?:[^/\s,;|:–—\[\]{}·・、，｜]+|\s*\/\s*)+/gu, chunk =>
            chunk.split(hyphenSeparator).map((token, index) => {
                if (index % 2 || !token || token === "-" || token === "−") return token;
                const wrapped = token.startsWith("(") && token.endsWith(")");
                const label = wrapped ? token.slice(1, -1) : token;
                return transform(token, parseChord(label, mode), wrapped);
            }).join(""));
    }

    function parse(text, mode = NoteNames.mode()) {
        const chords = [];
        const invalid = [];
        mapTokens(text, mode, (token, chord) => {
            if (chord) chords.push(chord);
            else invalid.push(token);
            return token;
        });
        return { chords, invalid: Array.from(new Set(invalid)) };
    }

    function rewrite(text, fromMode, toMode) {
        if (fromMode === toMode) return text;
        return mapTokens(text, fromMode, (token, chord, wrapped) => {
            if (!chord) return token;
            const { text: label, root, rootLength, bass, bassStart } = chord;
            const rootName = NoteNames.name(root, toMode);
            const bassName = bass ? NoteNames.name(bass.pitch, toMode) + label.slice(bassStart + bass.length) : "";
            const rewritten = rootName + label.slice(rootLength, bassStart) + bassName;
            return wrapped ? "(" + rewritten + ")" : rewritten;
        });
    }

    function match(chords) {
        if (!chords.length) return [];
        const first = chords[0].root;
        const last = chords[chords.length - 1].root;
        const scales = ScaleFinder.match([]).map(scale => {
            const dominant = ScaleFinder.pitchAt(scale.root, 7);
            const outside = [];
            let missing = 0;
            let cadence = false;
            chords.forEach((chord, index) => {
                const absent = chord.pitches.filter(note => !scale.pitches.includes(note)).length;
                if (absent) {
                    outside.push(chord.label);
                    missing += absent;
                } else if (chord.root === dominant && chords[index + 1] && chords[index + 1].root === scale.root
                    && chords[index + 1].pitches.every(note => scale.pitches.includes(note))) {
                    cadence = true;
                }
            });
            const family = scale.id.slice(scale.id.indexOf("-") + 1);
            // When several scales cover the same chords, prefer common tonal centers and a V–I resolution.
            const tonal = (family === "major" || family === "minor" ? 6 : family === "harmonic-minor" ? 4 : 0)
                + (first === scale.root ? 3 : 0) + (last === scale.root ? 3 : 0) + (cadence ? 5 : 0)
                + (chords.some(chord => chord.root === dominant && chord.dominant) ? 2 : 0);
            return { ...scale, get name() { return scale.name; }, outside, missing, tonal };
        });
        scales.sort((a, b) => a.outside.length - b.outside.length || a.missing - b.missing || b.tonal - a.tonal || a.order - b.order);
        const best = scales[0];
        return scales.filter(scale => scale.outside.length === best.outside.length && scale.missing <= best.missing + (best.missing ? 1 : 0));
    }

    return { parse, match, rewrite };
})();
