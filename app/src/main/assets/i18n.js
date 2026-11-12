"use strict";

const I18n = (() => {
    // Message columns are Russian, English, German, Spanish, French, Ukrainian, Japanese, and Simplified Chinese.
    const codes = ["ru", "en", "de", "es", "fr", "uk", "ja", "zh"];
    const languages = [
        { id: "en", name: "English" },
        { id: "de", name: "Deutsch" },
        { id: "es", name: "Español" },
        { id: "fr", name: "Français" },
        { id: "ru", name: "Русский" },
        { id: "uk", name: "Українська" },
        { id: "ja", name: "日本語" },
        { id: "zh", name: "简体中文" },
    ];
    const messages = {
        ...UI_MESSAGES,
        ...SEARCH_MESSAGES,
        guitarName: ["Гитара", "Guitar", "Gitarre", "Guitarra", "Guitare", "Гітара", "ギター", "吉他"],
        bassName: ["Бас-гитара", "Bass guitar", "E-Bass", "Bajo eléctrico", "Basse électrique", "Бас-гітара", "ベース", "贝斯"],
        ukuleleName: ["Укулеле", "Ukulele", "Ukulele", "Ukelele", "Ukulélé", "Укулеле", "ウクレレ", "尤克里里"],
        mandolinName: ["Мандолина", "Mandolin", "Mandoline", "Mandolina", "Mandoline", "Мандоліна", "マンドリン", "曼陀林"],
        standardTuning: ["Стандартный", "Standard", "Standard", "Estándar", "Standard", "Стандартний", "標準", "标准调弦"],
        baritoneTuning: ["Баритон", "Baritone", "Bariton", "Barítono", "Baryton", "Баритон", "バリトン", "低音调弦"],
        customTuning: ["Свой строй", "Custom tuning", "Eigene Stimmung", "Afinación personalizada", "Accordage personnalisé", "Власний стрій", "カスタムチューニング", "自定义调弦"],
        openStringPairs: ["Ноты открытых пар струн", "Open string pairs", "Leere Saitenpaare", "Pares de cuerdas al aire", "Paires de cordes à vide", "Ноти відкритих пар струн", "開放弦ペアの音", "空弦组"],
        stringNumber: ["Струна {number}", "String {number}", "Saite {number}", "Cuerda {number}", "Corde {number}", "Струна {number}", "{number}弦", "第 {number} 弦"],
        stringPairNumber: ["Пара струн {number}", "String pair {number}", "Saitenpaar {number}", "Par de cuerdas {number}", "Paire de cordes {number}", "Пара струн {number}", "第{number}コース", "第 {number} 弦组"],
        stringShort: ["Стр.", "Str.", "Sait.", "Cda.", "Cde", "Стр.", "弦", "弦"],
        stringPairShort: ["Пар.", "Pair", "Paar", "Par", "Paire", "Пар.", "組", "组"],
        fretboardRange: ["{instrument}, лады от {from} до {to}", "{instrument}, frets {from} to {to}", "{instrument}, Bünde {from} bis {to}", "{instrument}, trastes del {from} al {to}", "{instrument}, cases {from} à {to}", "{instrument}, лади від {from} до {to}", "{instrument}、{from}〜{to}フレット", "{instrument}，第 {from} 至 {to} 品"],
        fretNumber: ["лад {number}", "fret {number}", "Bund {number}", "traste {number}", "case {number}", "лад {number}", "{number}フレット", "第 {number} 品"],
        openNote: ["открытая", "open", "leer", "al aire", "à vide", "відкрита", "開放弦", "空弦"],
        noteInScale: ["в гамме", "in the scale", "in der Tonleiter", "en la escala", "dans la gamme", "у гамі", "スケール内", "属于此音阶"],
        noteInOtherScale: ["подходит к другой гамме", "fits another scale", "passt zu einer anderen Tonleiter", "encaja en otra escala", "appartient à une autre gamme", "підходить до іншої гами", "別のスケールに一致", "适用于其他音阶"],
        noteTonic: ["тоника", "tonic", "Grundton", "tónica", "tonique", "тоніка", "主音", "主音"],
        versionLabel: ["Версия {version}", "Version {version}", "Version {version}", "Versión {version}", "Version {version}", "Версія {version}", "バージョン {version}", "版本 {version}"],
        scaleMajor: ["{note} мажор", "{note} major", "{note}-Dur", "{note} mayor", "{note} majeur", "{note} мажор", "{note}メジャー", "{note} 大调"],
        scaleMinor: ["{note} натуральный минор", "{note} natural minor", "{note}-Moll (natürlich)", "{note} menor natural", "{note} mineur naturel", "{note} натуральний мінор", "{note}ナチュラルマイナー", "{note} 自然小调"],
        scaleMajorPentatonic: ["{note} мажорная пентатоника", "{note} major pentatonic", "{note}-Dur-Pentatonik", "{note} pentatónica mayor", "{note} pentatonique majeure", "{note} мажорна пентатоніка", "{note}メジャーペンタトニック", "{note} 大调五声音阶"],
        scaleMinorPentatonic: ["{note} минорная пентатоника", "{note} minor pentatonic", "{note}-Moll-Pentatonik", "{note} pentatónica menor", "{note} pentatonique mineure", "{note} мінорна пентатоніка", "{note}マイナーペンタトニック", "{note} 小调五声音阶"],
        scaleBlues: ["{note} блюзовая", "{note} blues", "{note}-Bluestonleiter", "{note} blues", "{note} blues", "{note} блюзова", "{note}ブルース", "{note} 布鲁斯音阶"],
        scaleHarmonicMinor: ["{note} гармонический минор", "{note} harmonic minor", "{note}-Moll (harmonisch)", "{note} menor armónica", "{note} mineur harmonique", "{note} гармонічний мінор", "{note}ハーモニックマイナー", "{note} 和声小调"],
        scaleMelodicMinor: ["{note} мелодический минор ↑", "{note} melodic minor ↑", "{note}-Moll (melodisch) ↑", "{note} menor melódica ↑", "{note} mineur mélodique ↑", "{note} мелодичний мінор ↑", "{note}メロディックマイナー ↑", "{note} 旋律小调 ↑"],
        scaleDorian: ["{note} дорийский лад", "{note} Dorian", "{note}-Dorisch", "{note} dórico", "{note} dorien", "{note} дорійський лад", "{note}ドリアン", "{note} 多利亚调式"],
        scalePhrygian: ["{note} фригийский лад", "{note} Phrygian", "{note}-Phrygisch", "{note} frigio", "{note} phrygien", "{note} фригійський лад", "{note}フリジアン", "{note} 弗里吉亚调式"],
        scaleLydian: ["{note} лидийский лад", "{note} Lydian", "{note}-Lydisch", "{note} lidio", "{note} lydien", "{note} лідійський лад", "{note}リディアン", "{note} 利底亚调式"],
        scaleMixolydian: ["{note} миксолидийский лад", "{note} Mixolydian", "{note}-Mixolydisch", "{note} mixolidio", "{note} mixolydien", "{note} міксолідійський лад", "{note}ミクソリディアン", "{note} 混合利底亚调式"],
        scaleLocrian: ["{note} локрийский лад", "{note} Locrian", "{note}-Lokrisch", "{note} locrio", "{note} locrien", "{note} локрійський лад", "{note}ロクリアン", "{note} 洛克里亚调式"],
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
