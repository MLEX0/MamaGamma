"use strict";

const WorkspaceNavigation = (() => {
    const finder = document.getElementById("finder");
    const tools = document.getElementById("tools-workspace");
    const navigation = document.getElementById("workspace-nav");
    const finderButton = document.getElementById("workspace-finder");
    const toolsButton = document.getElementById("workspace-tools");
    let finderPosition = 0;

    function showTools() {
        if (navigation.hidden || !tools.hidden) return false;
        finderPosition = window.scrollY;
        NoteAudio.stop();
        finder.hidden = true;
        tools.hidden = false;
        finderButton.removeAttribute("aria-current");
        toolsButton.setAttribute("aria-current", "page");
        window.scrollTo(0, 0);
        return true;
    }

    function showFinder() {
        if (navigation.hidden || tools.hidden) return false;
        tools.hidden = true;
        finder.hidden = false;
        toolsButton.removeAttribute("aria-current");
        finderButton.setAttribute("aria-current", "page");
        window.scrollTo(0, finderPosition);
        return true;
    }

    function setFullscreen(enabled) {
        navigation.hidden = enabled;
    }

    finderButton.addEventListener("click", showFinder);
    toolsButton.addEventListener("click", showTools);
    return { showFinder, showTools, setFullscreen };
})();
