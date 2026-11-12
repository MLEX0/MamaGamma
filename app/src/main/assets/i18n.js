"use strict";

const I18n = (() => {
    // Message columns are Russian, English, German, Spanish, French, Ukrainian, and Japanese.
    const codes = ["ru", "en", "de", "es", "fr", "uk", "ja"];
    const languages = [
        { id: "en", name: "English" },
        { id: "de", name: "Deutsch" },
        { id: "es", name: "Español" },
        { id: "fr", name: "Français" },
        { id: "ru", name: "Русский" },
        { id: "uk", name: "Українська" },
        { id: "ja", name: "日本語" },
    ];
    const messages = {
        ...UI_MESSAGES,
        ...SEARCH_MESSAGES,
        guitarName: ["Гитара", "Guitar", "Gitarre", "Guitarra", "Guitare", "Гітара", "ギター"],
        bassName: ["Бас-гитара", "Bass guitar", "E-Bass", "Bajo eléctrico", "Basse électrique", "Бас-гітара", "ベース"],
        ukuleleName: ["Укулеле", "Ukulele", "Ukulele", "Ukelele", "Ukulélé", "Укулеле", "ウクレレ"],
        mandolinName: ["Мандолина", "Mandolin", "Mandoline", "Mandolina", "Mandoline", "Мандоліна", "マンドリン"],
        standardTuning: ["Стандартный", "Standard", "Standard", "Estándar", "Standard", "Стандартний", "標準"],
        baritoneTuning: ["Баритон", "Baritone", "Bariton", "Barítono", "Baryton", "Баритон", "バリトン"],
        customTuning: ["Свой строй", "Custom tuning", "Eigene Stimmung", "Afinación personalizada", "Accordage personnalisé", "Власний стрій", "カスタムチューニング"],
        openStringPairs: ["Ноты открытых пар струн", "Open string pairs", "Leere Saitenpaare", "Pares de cuerdas al aire", "Paires de cordes à vide", "Ноти відкритих пар струн", "開放弦ペアの音"],
        stringNumber: ["Струна {number}", "String {number}", "Saite {number}", "Cuerda {number}", "Corde {number}", "Струна {number}", "{number}弦"],
        stringPairNumber: ["Пара струн {number}", "String pair {number}", "Saitenpaar {number}", "Par de cuerdas {number}", "Paire de cordes {number}", "Пара струн {number}", "第{number}コース"],
        stringShort: ["Стр.", "Str.", "Sait.", "Cda.", "Cde", "Стр.", "弦"],
        stringPairShort: ["Пар.", "Pair", "Paar", "Par", "Paire", "Пар.", "組"],
        fretboardRange: ["{instrument}, лады от {from} до {to}", "{instrument}, frets {from} to {to}", "{instrument}, Bünde {from} bis {to}", "{instrument}, trastes del {from} al {to}", "{instrument}, cases {from} à {to}", "{instrument}, лади від {from} до {to}", "{instrument}、{from}〜{to}フレット"],
        fretNumber: ["лад {number}", "fret {number}", "Bund {number}", "traste {number}", "case {number}", "лад {number}", "{number}フレット"],
        openNote: ["открытая", "open", "leer", "al aire", "à vide", "відкрита", "開放弦"],
        noteInScale: ["в гамме", "in the scale", "in der Tonleiter", "en la escala", "dans la gamme", "у гамі", "スケール内"],
        noteInOtherScale: ["подходит к другой гамме", "fits another scale", "passt zu einer anderen Tonleiter", "encaja en otra escala", "appartient à une autre gamme", "підходить до іншої гами", "別のスケールに一致"],
        noteTonic: ["тоника", "tonic", "Grundton", "tónica", "tonique", "тоніка", "主音"],
        versionLabel: ["Версия {version}", "Version {version}", "Version {version}", "Versión {version}", "Version {version}", "Версія {version}", "バージョン {version}"],
        scaleMajor: ["{note} мажор", "{note} major", "{note}-Dur", "{note} mayor", "{note} majeur", "{note} мажор", "{note}メジャー"],
        scaleMinor: ["{note} натуральный минор", "{note} natural minor", "{note}-Moll (natürlich)", "{note} menor natural", "{note} mineur naturel", "{note} натуральний мінор", "{note}ナチュラルマイナー"],
        scaleMajorPentatonic: ["{note} мажорная пентатоника", "{note} major pentatonic", "{note}-Dur-Pentatonik", "{note} pentatónica mayor", "{note} pentatonique majeure", "{note} мажорна пентатоніка", "{note}メジャーペンタトニック"],
        scaleMinorPentatonic: ["{note} минорная пентатоника", "{note} minor pentatonic", "{note}-Moll-Pentatonik", "{note} pentatónica menor", "{note} pentatonique mineure", "{note} мінорна пентатоніка", "{note}マイナーペンタトニック"],
        scaleBlues: ["{note} блюзовая", "{note} blues", "{note}-Bluestonleiter", "{note} blues", "{note} blues", "{note} блюзова", "{note}ブルース"],
        scaleHarmonicMinor: ["{note} гармонический минор", "{note} harmonic minor", "{note}-Moll (harmonisch)", "{note} menor armónica", "{note} mineur harmonique", "{note} гармонічний мінор", "{note}ハーモニックマイナー"],
        scaleMelodicMinor: ["{note} мелодический минор ↑", "{note} melodic minor ↑", "{note}-Moll (melodisch) ↑", "{note} menor melódica ↑", "{note} mineur mélodique ↑", "{note} мелодичний мінор ↑", "{note}メロディックマイナー ↑"],
        scaleDorian: ["{note} дорийский лад", "{note} Dorian", "{note}-Dorisch", "{note} dórico", "{note} dorien", "{note} дорійський лад", "{note}ドリアン"],
        scalePhrygian: ["{note} фригийский лад", "{note} Phrygian", "{note}-Phrygisch", "{note} frigio", "{note} phrygien", "{note} фригійський лад", "{note}フリジアン"],
        scaleLydian: ["{note} лидийский лад", "{note} Lydian", "{note}-Lydisch", "{note} lidio", "{note} lydien", "{note} лідійський лад", "{note}リディアン"],
        scaleMixolydian: ["{note} миксолидийский лад", "{note} Mixolydian", "{note}-Mixolydisch", "{note} mixolidio", "{note} mixolydien", "{note} міксолідійський лад", "{note}ミクソリディアン"],
        scaleLocrian: ["{note} локрийский лад", "{note} Locrian", "{note}-Lokrisch", "{note} locrio", "{note} locrien", "{note} локрійський лад", "{note}ロクリアン"],
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
