"use strict";

const AppTheme = (() => {
    const appearance = window.GammaMamaAppearance;
    const system = window.matchMedia("(prefers-color-scheme: dark)");

    function apply(mode) {
        const dark = mode === "dark" || (mode !== "light" && (appearance ? appearance.systemDark() : system.matches));
        document.documentElement.dataset.theme = dark ? "dark" : "light";
    }

    let mode = "system";
    try {
        mode = appearance ? appearance.themeMode() : JSON.parse(localStorage.getItem("gammama-settings-v1"))?.theme;
    } catch (error) {
        // The first frame can still use the system theme if storage is unavailable.
    }
    apply(mode);

    return { apply, system };
})();
