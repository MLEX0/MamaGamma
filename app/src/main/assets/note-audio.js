"use strict";

const NoteAudio = (() => {
    let context;
    let output;
    let wave;
    let voice;
    let playback;
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

    function canPlay() {
        return FretSettings.soundEnabled() && FretSettings.noteVolume() > 0 && Boolean(window.AudioContext);
    }

    function whenReady(id, start, unavailable = () => {}) {
        if (!canPlay()) {
            unavailable();
            return;
        }
        if (!context) {
            try {
                const audioContext = new AudioContext();
                const harmonics = new Float32Array([0, 1, 0.42, 0.26, 0.14, 0.08, 0.045]);
                wave = audioContext.createPeriodicWave(new Float32Array(harmonics.length), harmonics);
                output = audioContext.createGain();
                output.gain.value = FretSettings.noteVolume();
                output.connect(audioContext.destination);
                audioContext.onstatechange = () => {
                    if (playback?.timer !== undefined && audioContext.state !== "running") stop();
                };
                context = audioContext;
            } catch (error) {
                unavailable();
                return;
            }
        }
        if (context.state === "running") {
            start();
        } else {
            context.resume().then(() => {
                if (id !== request) return;
                if (context.state === "running" && canPlay()) start();
                else unavailable();
            }, () => {
                if (id === request) unavailable();
            });
        }
    }

    function play(midi) {
        stop();
        whenReady(request, () => startNote(midi));
    }

    function playScale(midis, bpm, onStep, onEnd) {
        stop();
        if (!midis.length || !Number.isFinite(bpm) || bpm <= 0) {
            onEnd?.();
            return;
        }

        const sequence = { onEnd };
        playback = sequence;
        const beat = 60 / bpm;
        let index = 0;
        let nextBeat;

        function scheduleStep() {
            sequence.timer = setTimeout(step, Math.ceil((nextBeat - context.currentTime) * 1000));
        }

        function step() {
            if (playback !== sequence) return;
            if (context.state !== "running" || !canPlay()) {
                stop();
                return;
            }
            const now = context.currentTime;
            // The first timer can fire before the audio clock has warmed up.
            if (now + 0.004 < nextBeat) {
                scheduleStep();
                return;
            }
            if (index === midis.length) {
                stop();
                return;
            }
            const midi = midis[index++];
            startNote(midi);
            nextBeat += beat;
            // Keep the tempo on the audio clock, without rushing through notes after a stall.
            if (nextBeat - now < beat / 2) nextBeat = now + beat;
            scheduleStep();
            onStep?.(midi);
        }

        whenReady(request, () => {
            nextBeat = context.currentTime;
            step();
        }, stop);
    }

    function stop() {
        request += 1;
        stopVoice();
        if (!playback) return;
        const { timer, onEnd } = playback;
        playback = null;
        clearTimeout(timer);
        onEnd?.();
    }

    function updateVolume() {
        if (output) output.gain.value = FretSettings.noteVolume();
        if (FretSettings.noteVolume() === 0) stop();
    }

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) stop();
    });

    return { play, playScale, stop, updateVolume };
})();
