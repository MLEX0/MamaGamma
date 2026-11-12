"use strict";

const NoteNames = (() => {
    const systems = [
        { id: "international", label: "notationInternational" },
        { id: "german", label: "notationGerman" },
        { id: "solfege", label: "notationSolfege" },
        { id: "cyrillic", label: "notationCyrillic" },
        { id: "japanese", label: "notationJapanese" },
    ];
    const displayNames = {
        international: ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"],
        german: ["C", "Cis", "D", "Es", "E", "F", "Fis", "G", "As", "A", "B", "H"],
        solfege: ["Do", "Do♯", "Re", "Mi♭", "Mi", "Fa", "Fa♯", "Sol", "La♭", "La", "Si♭", "Si"],
        cyrillic: ["До", "До♯", "Ре", "Ми♭", "Ми", "Фа", "Фа♯", "Соль", "Ля♭", "Ля", "Си♭", "Си"],
        japanese: ["ハ", "嬰ハ", "ニ", "変ホ", "ホ", "ヘ", "嬰ヘ", "ト", "変イ", "イ", "変ロ", "ロ"],
    };
    const ukrainianNames = ["До", "До♯", "Ре", "Мі♭", "Мі", "Фа", "Фа♯", "Соль", "Ля♭", "Ля", "Сі♭", "Сі"];
    const naturalPitches = [0, 2, 4, 5, 7, 9, 11];
    const international = naturalRoots(["C", "D", "E", "F", "G", "A", "B"]);
    const japanese = ["ハ", "ニ", "ホ", "ヘ", "ト", "イ", "ロ"];
    const hiragana = ["は", "に", "ほ", "へ", "と", "い", "ろ"];
    const german = [
        ...naturalRoots(["C", "D", "E", "F", "G", "A", "H"]),
        ["Cis", 1], ["Des", 1], ["Dis", 3], ["Es", 3], ["Eis", 5], ["Fes", 4],
        ["Fis", 6], ["Ges", 6], ["Gis", 8], ["As", 8], ["Ais", 10],
        ["B", 10], ["Hes", 10], ["His", 0], ["Ces", 11],
    ];
    const roots = new Map([
        ["international", profile([])],
        ["german", profile(german)],
        ["solfege", profile([
            ...naturalRoots(["Do", "Re", "Mi", "Fa", "Sol", "La", "Si"]),
            ...naturalRoots(["Do", "Ré", "Mi", "Fa", "Sol", "La", "Ti"]),
        ])],
        ["cyrillic", profile([
            ...naturalRoots(["До", "Ре", "Ми", "Фа", "Соль", "Ля", "Си"]),
            ...naturalRoots(["До", "Ре", "Мі", "Фа", "Соль", "Ля", "Сі"]),
        ])],
        ["japanese", profile([
            ...naturalRoots(japanese), ...naturalRoots(hiragana),
            ...naturalRoots(["ド", "レ", "ミ", "ファ", "ソ", "ラ", "シ"]),
            ...japaneseAccidentals(japanese), ...japaneseAccidentals(hiragana),
        ])],
    ]);
    let current = "international";

    function naturalRoots(notes) {
        return notes.flatMap((note, index) => {
            const pitch = naturalPitches[index];
            const sharp = (pitch + 1) % 12;
            const flat = (pitch + 11) % 12;
            return [[note, pitch], [note + "#", sharp], [note + "♯", sharp], [note + "b", flat], [note + "♭", flat]];
        });
    }

    function japaneseAccidentals(notes) {
        return notes.flatMap((note, index) => {
            const pitch = naturalPitches[index];
            return [["嬰" + note, (pitch + 1) % 12], ["変" + note, (pitch + 11) % 12]];
        });
    }

    function profile(localRoots) {
        const pitches = new Map(international.concat(localRoots).map(([note, pitch]) => [note.toLowerCase(), pitch]));
        const keys = [...pitches.keys()];
        const source = keys
            .map(note => note.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
        return { pitches, source, longest: Math.max(...keys.map(note => note.length)) };
    }

    function getProfile(mode) {
        return roots.get(mode) || roots.get("international");
    }

    function names(mode = current) {
        if (mode === "cyrillic" && typeof I18n !== "undefined" && I18n.language() === "uk") return ukrainianNames;
        return roots.has(mode) ? displayNames[mode] : displayNames.international;
    }

    function setMode(mode) {
        const next = roots.has(mode) ? mode : "international";
        if (next === current) return false;
        current = next;
        return true;
    }

    function readRoots(text, mode = current) {
        const { pitches, longest } = getProfile(mode);
        const candidates = [];
        for (let length = Math.min(text.length, longest); length > 0; length -= 1) {
            const pitch = pitches.get(text.slice(0, length).toLowerCase());
            if (pitch !== undefined) candidates.push({ pitch, length });
        }
        return candidates;
    }

    return {
        systems, names, setMode, readRoots,
        mode: () => current,
        name: (pitch, mode = current) => names(mode)[pitch],
        rootPattern: mode => getProfile(mode).source,
    };
})();
