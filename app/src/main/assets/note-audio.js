"use strict";

const NoteAudio = (() => {
    let context;
    let output;
    let wave;
    let voice;
    let request = 0;

    function stopVoice() {
        if (!voice) return;
        const now = context.currentTime;
        voice.volume.gain.cancelScheduledValues(now);
        voice.volume.gain.setTargetAtTime(0.0001, now, 0.006);
        voice.oscillator.stop(now + 0.035);
        voice = null;
    }

    function startNote(midi) {
        stopVoice();
        const now = context.currentTime;
        const hz = 440 * Math.pow(2, (midi - 69) / 12);
        const oscillator = context.createOscillator();
        const filter = context.createBiquadFilter();
        const volume = context.createGain();

        oscillator.setPeriodicWave(wave);
        oscillator.frequency.value = hz;
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(Math.min(hz * 7, 10000), now);
        filter.frequency.exponentialRampToValueAtTime(Math.max(hz * 1.8, 125), now + 0.24);
        volume.gain.setValueAtTime(0.0001, now);
        volume.gain.exponentialRampToValueAtTime(0.24, now + 0.005);
        volume.gain.exponentialRampToValueAtTime(0.045, now + 0.14);
        volume.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);

        oscillator.connect(filter);
        filter.connect(volume);
        volume.connect(output);
        voice = { oscillator, volume };
        oscillator.onended = () => {
            oscillator.disconnect();
            filter.disconnect();
            volume.disconnect();
            if (voice && voice.oscillator === oscillator) voice = null;
        };
        oscillator.start(now);
        oscillator.stop(now + 0.63);
    }

    function play(midi) {
        if (!FretSettings.soundEnabled() || !window.AudioContext) return;
        const id = ++request;
        if (!context) {
            try {
                const audioContext = new AudioContext();
                const harmonics = new Float32Array([0, 1, 0.42, 0.26, 0.14, 0.08, 0.045]);
                wave = audioContext.createPeriodicWave(new Float32Array(harmonics.length), harmonics);
                output = audioContext.createGain();
                output.gain.value = FretSettings.noteVolume();
                output.connect(audioContext.destination);
                context = audioContext;
            } catch (error) {
                return;
            }
        }
        if (context.state === "running") {
            startNote(midi);
        } else {
            context.resume().then(() => {
                if (id === request && FretSettings.soundEnabled()) startNote(midi);
            }).catch(() => {
                // A rejected audio resume must not interrupt note selection.
            });
        }
    }

    function stop() {
        request += 1;
        stopVoice();
    }

    function updateVolume() {
        if (output) output.gain.value = FretSettings.noteVolume();
    }

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) stop();
    });

    return { play, stop, updateVolume };
})();
