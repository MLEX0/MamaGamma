"use strict";

const SearchHistory = (() => {
    const storageKey = "gammama-history-v1";
    const limit = 100;
    const sources = new Map([
        ["notes", "По нотам"],
        ["chords", "По аккордам"],
        ["microphone", "Микрофон"],
        ["file", "Аудиофайл"],
        ["shared", "Из другого приложения"],
    ]);
    const entries = restore();

    function restore() {
        try {
            const saved = JSON.parse(localStorage.getItem(storageKey));
            if (Array.isArray(saved)) {
                return saved.filter(entry => entry && sources.has(entry.source)
                    && Number.isFinite(entry.time) && Math.abs(entry.time) <= 8.64e15
                    && typeof entry.input === "string" && Array.isArray(entry.scales)).slice(0, limit);
            }
        } catch (error) {
            // The current session can still keep history in memory.
        }
        return [];
    }

    function persist() {
        try {
            localStorage.setItem(storageKey, JSON.stringify(entries));
        } catch (error) {
            // Keep the history available in memory.
        }
    }

    function add(source, input, scales) {
        if (!scales.length) return;
        const previous = entries[0];
        if ((source === "notes" || source === "chords") && previous?.source === source && previous.input === input) return;
        entries.unshift({ source, input, time: Date.now(), scales: scales.slice(0, 3).map(scale => scale.id) });
        if (entries.length > limit) entries.pop();
        persist();
    }

    function clear() {
        entries.length = 0;
        persist();
    }

    return { add, clear, list: () => entries.slice(), sourceName: source => sources.get(source) };
})();
