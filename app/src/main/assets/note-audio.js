"use strict";

const NoteAudio = (() => {
    // The initial upper harmonics are damped as the note rings out.
    const noteTone = {
        harmonics: [0, 1, 0.42, 0.26, 0.14, 0.08, 0.045],
        brightness: 7, damping: 1.8, dampingTime: 0.24,
        attack: 0.005, decay: 0.14, sustain: 0.1875, duration: 0.63, strum: 0,
    };
    const chordTones = {
        piano: {
            harmonics: [0, 1, 0.38, 0.20, 0.13, 0.09, 0.04, 0.03],
            brightness: 10, damping: 3.2, dampingTime: 0.26,
            attack: 0.009, decay: 0.19, sustain: 0.32, duration: 1.18, strum: 0,
        },
        guitar: {
            harmonics: [0, 1, 0.60, 0.33, 0.16, 0.08, -0.06, -0.08, -0.05, -0.015],
            brightness: 14, damping: 2.5, dampingTime: 0.22,
            attack: 0.003, decay: 0.14, sustain: 0.32, duration: 1.10, strum: 0.012,
        },
        bass: {
            harmonics: [0, 1, 0.44, 0.23, 0.12, 0.065, 0.04, 0.02],
            brightness: 13, damping: 3.5, dampingTime: 0.24,
            attack: 0.005, decay: 0.19, sustain: 0.39, duration: 1.24, strum: 0.012,
        },
        ukulele: {
            harmonics: [0, 1, 0.51, 0.25, 0.12, 0.03, -0.04, -0.065, -0.04],
            brightness: 12, damping: 2.8, dampingTime: 0.15,
            attack: 0.004, decay: 0.13, sustain: 0.24, duration: 0.88, strum: 0.009,
        },
        mandolin: {
            harmonics: [0, 1, 0.64, 0.43, 0.20, 0.12, 0.06, -0.08, -0.095, -0.06, -0.03],
            brightness: 16, damping: 3.8, dampingTime: 0.16,
            attack: 0.003, decay: 0.12, sustain: 0.22, duration: 0.89, strum: 0.007,
        },
    };
    let context;
    let output;
    const waves = new Map();
    const voices = new Set();
    let playback;
    let request = 0;

    function stopVoices() {
        for (const { oscillator, volume, startsAt } of voices) {
            const now = context.currentTime;
            if (startsAt > now) {
                oscillator.stop(now);
                continue;
            }
            volume.gain.cancelScheduledValues(now);
            volume.gain.setTargetAtTime(0.0001, now, 0.006);
            oscillator.stop(now + 0.035);
        }
        voices.clear();
    }

    function waveFor(tone) {
        if (!waves.has(tone)) {
            const harmonics = new Float32Array(tone.harmonics);
            waves.set(tone, context.createPeriodicWave(new Float32Array(harmonics.length), harmonics));
        }
        return waves.get(tone);
    }

    function startVoice(midi, now, duration, level, tone) {
        const hz = 440 * Math.pow(2, (midi - 69) / 12);
        const oscillator = context.createOscillator();
        const filter = context.createBiquadFilter();
        const volume = context.createGain();

        oscillator.setPeriodicWave(waveFor(tone));
        oscillator.frequency.value = hz;
        filter.type = "lowpass";
        const initialCutoff = Math.min(hz * tone.brightness, 10000);
        filter.frequency.setValueAtTime(initialCutoff, now);
        filter.frequency.exponentialRampToValueAtTime(Math.min(initialCutoff, Math.max(hz * tone.damping, 125)),
            now + Math.min(tone.dampingTime, duration / 2));
        volume.gain.setValueAtTime(0.0001, now);
        volume.gain.exponentialRampToValueAtTime(level, now + Math.min(tone.attack, duration / 4));
        volume.gain.exponentialRampToValueAtTime(level * tone.sustain, now + Math.min(tone.decay, duration / 2));
        volume.gain.exponentialRampToValueAtTime(0.0001, now + duration - 0.01);

        oscillator.connect(filter);
        filter.connect(volume);
        volume.connect(output);
        const voice = { oscillator, volume, startsAt: now };
        voices.add(voice);
        oscillator.onended = () => {
            oscillator.disconnect();
            filter.disconnect();
            volume.disconnect();
            voices.delete(voice);
        };
        oscillator.start(now);
        oscillator.stop(now + duration);
    }

    function startNotes(midis, duration, tone) {
        stopVoices();
        const now = context.currentTime;
        const level = 0.24 / Math.sqrt(midis.length);
        const spacing = Math.min(tone.strum, duration * 0.15 / Math.max(1, midis.length - 1));
        midis.forEach((midi, index) => {
            const offset = index * spacing;
            startVoice(midi, now + offset, duration - offset, level, tone);
        });
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
        whenReady(request, () => startNotes([midi], noteTone.duration, noteTone));
    }

    function playChord(midis, instrumentId = "piano") {
        stop();
        const tone = chordTones[instrumentId] || chordTones.piano;
        if (midis.length) whenReady(request, () => startNotes(midis, tone.duration, tone));
    }

    function playScale(midis, bpm, onStep, onEnd) {
        playSequence(midis.map(midi => [midi]), 60 / bpm, noteTone.duration,
            index => onStep?.(midis[index]), onEnd, noteTone);
    }

    function playChords(chords, bpm, onStep, onEnd, instrumentId = "piano") {
        const interval = 120 / bpm;
        const tone = chordTones[instrumentId] || chordTones.piano;
        playSequence(chords, interval, Math.min(tone.duration, interval * 0.94), onStep, onEnd, tone);
    }

    function playSequence(groups, beat, duration, onStep, onEnd, tone) {
        stop();
        if (!groups.length || !Number.isFinite(beat) || beat <= 0) {
            onEnd?.();
            return;
        }

        const sequence = { onEnd };
        playback = sequence;
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
            if (index === groups.length) {
                stop();
                return;
            }
            const current = index++;
            startNotes(groups[current], duration, tone);
            nextBeat += beat;
            // Keep the tempo on the audio clock, without rushing through notes after a stall.
            if (nextBeat - now < beat / 2) nextBeat = now + beat;
            scheduleStep();
            onStep?.(current);
        }

        whenReady(request, () => {
            nextBeat = context.currentTime;
            step();
        }, stop);
    }

    function stop() {
        request += 1;
        stopVoices();
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

    return { play, playChord, playScale, playChords, canPlay, stop, updateVolume };
})();
