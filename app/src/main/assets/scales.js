"use strict";

const ScaleFinder = (() => {
    const pitchNames = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
    const families = [
        ["major", "scaleMajor", [0, 2, 4, 5, 7, 9, 11]],
        ["minor", "scaleMinor", [0, 2, 3, 5, 7, 8, 10]],
        ["major-pentatonic", "scaleMajorPentatonic", [0, 2, 4, 7, 9]],
        ["minor-pentatonic", "scaleMinorPentatonic", [0, 3, 5, 7, 10]],
        ["blues", "scaleBlues", [0, 3, 5, 6, 7, 10]],
        ["harmonic-minor", "scaleHarmonicMinor", [0, 2, 3, 5, 7, 8, 11]],
        ["melodic-minor", "scaleMelodicMinor", [0, 2, 3, 5, 7, 9, 11]],
        ["dorian", "scaleDorian", [0, 2, 3, 5, 7, 9, 10]],
        ["phrygian", "scalePhrygian", [0, 1, 3, 5, 7, 8, 10]],
        ["lydian", "scaleLydian", [0, 2, 4, 6, 7, 9, 11]],
        ["mixolydian", "scaleMixolydian", [0, 2, 4, 5, 7, 9, 10]],
        ["locrian", "scaleLocrian", [0, 1, 3, 5, 6, 8, 10]],
    ];

    function pitchAt(openPitch, fret) {
        return (openPitch + fret) % 12;
    }

    const catalog = [];
    pitchNames.forEach((note, root) => {
        families.forEach(([id, name, intervals]) => {
            const pitches = intervals.map(interval => pitchAt(root, interval));
            catalog.push({ id: `${root}-${id}`, get name() { return t(name, { note }); }, root, pitches, order: catalog.length });
        });
    });

    function match(selected) {
        const matches = catalog.filter(scale => selected.every(pitch => scale.pitches.includes(pitch)));
        const first = selected[0];
        return matches.sort((a, b) => {
            const exact = Number(b.pitches.length === selected.length) - Number(a.pitches.length === selected.length);
            const tonic = Number(b.root === first) - Number(a.root === first);
            return exact || tonic || a.order - b.order;
        });
    }

    return { pitchNames, pitchAt, match };
})();
