"use strict";

const ChordFinder = (() => {
    const roots = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
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

    function pitch(note) {
        const accidental = note[1] === "#" ? 1 : note[1] === "b" ? -1 : 0;
        return (roots[note[0].toUpperCase()] + accidental + 12) % 12;
    }

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

    function parseChord(label) {
        const token = label.replace(/♯/g, "#").replace(/♭/g, "b").replace(/−/g, "-");
        const parts = token.match(/^([A-Ga-g][#b]?)(.*?)(?:\/([A-Ga-g][#b]?))?$/);
        if (!parts) return null;
        const [, note, suffix, bass] = parts;
        const intervals = chordIntervals(suffix);
        if (!intervals) return null;
        const root = pitch(note);
        const pitches = new Set(intervals.map(interval => ScaleFinder.pitchAt(root, interval)));
        if (bass) pitches.add(pitch(bass));
        return { label, root, pitches: Array.from(pitches), dominant: intervals.includes(4) && intervals.includes(10) };
    }

    function parse(text) {
        const tokens = text.replace(/\s*\/\s*/g, "/").replace(/-(?=[A-Ga-g])/g, " ")
            .split(/[\s,;|:–—\[\]{}]+/).filter(token => token && token !== "-");
        const chords = [];
        const invalid = [];
        tokens.forEach(token => {
            const label = token.startsWith("(") && token.endsWith(")") ? token.slice(1, -1) : token;
            const chord = parseChord(label);
            if (chord) chords.push(chord);
            else invalid.push(token);
        });
        return { chords, invalid: Array.from(new Set(invalid)) };
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

    return { parse, match };
})();
