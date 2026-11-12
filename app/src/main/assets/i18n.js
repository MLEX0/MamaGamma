"use strict";

const I18n = (() => {
    // Message columns are Russian, English, German, Spanish, and French.
    const codes = ["ru", "en", "de", "es", "fr"];
    const languages = [
        { id: "en", name: "English" },
        { id: "de", name: "Deutsch" },
        { id: "es", name: "Español" },
        { id: "fr", name: "Français" },
        { id: "ru", name: "Русский" },
    ];
    const messages = {
        ...UI_MESSAGES,
        ...SEARCH_MESSAGES,
        guitarName: ["Гитара", "Guitar", "Gitarre", "Guitarra", "Guitare"],
        bassName: ["Бас-гитара", "Bass guitar", "E-Bass", "Bajo eléctrico", "Basse électrique"],
        ukuleleName: ["Укулеле", "Ukulele", "Ukulele", "Ukelele", "Ukulélé"],
        mandolinName: ["Мандолина", "Mandolin", "Mandoline", "Mandolina", "Mandoline"],
        standardTuning: ["Стандартный", "Standard", "Standard", "Estándar", "Standard"],
        baritoneTuning: ["Баритон", "Baritone", "Bariton", "Barítono", "Baryton"],
        customTuning: ["Свой строй", "Custom tuning", "Eigene Stimmung", "Afinación personalizada", "Accordage personnalisé"],
        openStringPairs: ["Ноты открытых пар струн", "Open string pairs", "Leere Saitenpaare", "Pares de cuerdas al aire", "Paires de cordes à vide"],
        stringNumber: ["Струна {number}", "String {number}", "Saite {number}", "Cuerda {number}", "Corde {number}"],
        stringPairNumber: ["Пара струн {number}", "String pair {number}", "Saitenpaar {number}", "Par de cuerdas {number}", "Paire de cordes {number}"],
        stringShort: ["Стр.", "Str.", "Sait.", "Cda.", "Cde"],
        stringPairShort: ["Пар.", "Pair", "Paar", "Par", "Paire"],
        fretboardRange: ["{instrument}, лады от {from} до {to}", "{instrument}, frets {from} to {to}", "{instrument}, Bünde {from} bis {to}", "{instrument}, trastes del {from} al {to}", "{instrument}, cases {from} à {to}"],
        fretNumber: ["лад {number}", "fret {number}", "Bund {number}", "traste {number}", "case {number}"],
        openNote: ["открытая", "open", "leer", "al aire", "à vide"],
        noteInScale: ["в гамме", "in the scale", "in der Tonleiter", "en la escala", "dans la gamme"],
        noteInOtherScale: ["подходит к другой гамме", "fits another scale", "passt zu einer anderen Tonleiter", "encaja en otra escala", "appartient à une autre gamme"],
        noteTonic: ["тоника", "tonic", "Grundton", "tónica", "tonique"],
        versionLabel: ["Версия {version}", "Version {version}", "Version {version}", "Versión {version}", "Version {version}"],
        scaleMajor: ["{note} мажор", "{note} major", "{note}-Dur", "{note} mayor", "{note} majeur"],
        scaleMinor: ["{note} натуральный минор", "{note} natural minor", "{note}-Moll (natürlich)", "{note} menor natural", "{note} mineur naturel"],
        scaleMajorPentatonic: ["{note} мажорная пентатоника", "{note} major pentatonic", "{note}-Dur-Pentatonik", "{note} pentatónica mayor", "{note} pentatonique majeure"],
        scaleMinorPentatonic: ["{note} минорная пентатоника", "{note} minor pentatonic", "{note}-Moll-Pentatonik", "{note} pentatónica menor", "{note} pentatonique mineure"],
        scaleBlues: ["{note} блюзовая", "{note} blues", "{note}-Bluestonleiter", "{note} blues", "{note} blues"],
        scaleHarmonicMinor: ["{note} гармонический минор", "{note} harmonic minor", "{note}-Moll (harmonisch)", "{note} menor armónica", "{note} mineur harmonique"],
        scaleMelodicMinor: ["{note} мелодический минор ↑", "{note} melodic minor ↑", "{note}-Moll (melodisch) ↑", "{note} menor melódica ↑", "{note} mineur mélodique ↑"],
        scaleDorian: ["{note} дорийский лад", "{note} Dorian", "{note}-Dorisch", "{note} dórico", "{note} dorien"],
        scalePhrygian: ["{note} фригийский лад", "{note} Phrygian", "{note}-Phrygisch", "{note} frigio", "{note} phrygien"],
        scaleLydian: ["{note} лидийский лад", "{note} Lydian", "{note}-Lydisch", "{note} lidio", "{note} lydien"],
        scaleMixolydian: ["{note} миксолидийский лад", "{note} Mixolydian", "{note}-Mixolydisch", "{note} mixolidio", "{note} mixolydien"],
        scaleLocrian: ["{note} локрийский лад", "{note} Locrian", "{note}-Lokrisch", "{note} locrio", "{note} locrien"],
    };
    let current;

    function systemLanguage() {
        const nativeTags = window.GammaMamaAppearance?.systemLanguageTags?.();
        const tags = nativeTags ? nativeTags.split(",") : navigator.languages || [navigator.language];
        return tags.map(tag => tag.toLowerCase().split(/[-_]/)[0]).find(code => codes.includes(code)) || "en";
    }

    function t(key, values = {}) {
        const template = messages[key]?.[codes.indexOf(current || "en")] ?? key;
        return template.replace(/\{(\w+)\}/g, (placeholder, name) => values[name] ?? placeholder);
    }

    function setMode(mode) {
        const next = codes.includes(mode) ? mode : systemLanguage();
        if (next === current) return false;
        current = next;
        document.documentElement.lang = current;
        document.querySelectorAll("[data-i18n]").forEach(node => {
            node.textContent = t(node.dataset.i18n);
        });
        for (const attribute of ["aria-label", "placeholder", "title"]) {
            const key = `data-i18n-${attribute}`;
            document.querySelectorAll(`[${key}]`).forEach(node => {
                node.setAttribute(attribute, t(node.getAttribute(key)));
            });
        }
        return true;
    }

    return { language: () => current, languages, setMode, t };
})();

const { t } = I18n;
