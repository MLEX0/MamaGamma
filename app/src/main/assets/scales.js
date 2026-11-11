"use strict";

const ScaleFinder = (() => {
    const pitchNames = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
    const families = [
        ["major", "мажор", [0, 2, 4, 5, 7, 9, 11]],
        ["minor", "натуральный минор", [0, 2, 3, 5, 7, 8, 10]],
        ["major-pentatonic", "мажорная пентатоника", [0, 2, 4, 7, 9]],
        ["minor-pentatonic", "минорная пентатоника", [0, 3, 5, 7, 10]],
        ["blues", "блюзовая", [0, 3, 5, 6, 7, 10]],
        ["harmonic-minor", "гармонический минор", [0, 2, 3, 5, 7, 8, 11]],
        ["melodic-minor", "мелодический минор ↑", [0, 2, 3, 5, 7, 9, 11]],
        ["dorian", "дорийский лад", [0, 2, 3, 5, 7, 9, 10]],
        ["phrygian", "фригийский лад", [0, 1, 3, 5, 7, 8, 10]],
        ["lydian", "лидийский лад", [0, 2, 4, 6, 7, 9, 11]],
        ["mixolydian", "миксолидийский лад", [0, 2, 4, 5, 7, 9, 10]],
        ["locrian", "локрийский лад", [0, 1, 3, 5, 6, 8, 10]],
    ];

    function pitchAt(openPitch, fret) {
        return (openPitch + fret) % 12;
    }

    const catalog = [];
    pitchNames.forEach((note, root) => {
        families.forEach(([id, name, intervals]) => {
            const pitches = intervals.map(interval => pitchAt(root, interval));
            catalog.push({ id: `${root}-${id}`, name: `${note} ${name}`, root, pitches, order: catalog.length });
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
