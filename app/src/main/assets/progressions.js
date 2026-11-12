"use strict";

const ProgressionFinder = (() => {
    const limit = 24;
    const continuationLength = 3;
    const patternsPerKey = 3;
    const families = {
        major: {
            numerals: ["I", "ii", "iii", "IV", "V", "vi", "vii°"],
            patterns: [
                [0, 4, 5, 3], // I–V–vi–IV
                [0, 3, 4, 0], // I–IV–V–I
                [5, 3, 0, 4], // vi–IV–I–V
                [0, 5, 3, 4], // I–vi–IV–V
                [1, 4, 0],    // ii–V–I
                [0, 3, 1, 4], // I–IV–ii–V
            ],
        },
        minor: {
            numerals: ["i", "ii°", "♭III", "iv", "v", "♭VI", "♭VII"],
            patterns: [
                [0, 5, 2, 6], // i–♭VI–♭III–♭VII
                [0, 3, 4, 0], // i–iv–v–i
                [0, 6, 5, 6], // i–♭VII–♭VI–♭VII
                [0, 2, 6, 3], // i–♭III–♭VII–iv
                [0, 5, 3, 4], // i–♭VI–iv–v
                [0, 1, 4, 0], // i–ii°–v–i
            ],
        },
    };
    const majorCadences = [
        [2, 5, 1, 4, 0], // iii–vi–ii–V–I
        [6, 0, 3, 4, 0], // vii°–I–IV–V–I
    ];

    function familyOf(scale) {
        return families[scale.id.slice(scale.id.indexOf("-") + 1)];
    }

    function triads(scale, numerals) {
        return scale.pitches.map((root, degree, notes) => {
            const third = notes[(degree + 2) % notes.length];
            const fifth = notes[(degree + 4) % notes.length];
            const thirdInterval = (third - root + 12) % 12;
            const fifthInterval = (fifth - root + 12) % 12;
            const suffix = fifthInterval === 6 ? "dim" : thirdInterval === 3 ? "m" : "";
            return { root, suffix, degree: numerals[degree], pitches: [root, third, fifth] };
        });
    }

    function match(selectedPitches, preferredScaleId = null) {
        if (!Array.isArray(selectedPitches) || !selectedPitches.length
            || selectedPitches.some(pitch => !Number.isInteger(pitch) || pitch < 0 || pitch > 11)) return [];

        const notes = [...new Set(selectedPitches)];
        const candidates = [];
        for (const scale of ScaleFinder.match(notes)) {
            const family = familyOf(scale);
            if (!family) continue;

            const chordsByDegree = triads(scale, family.numerals);
            let rank = 0;
            for (const pattern of family.patterns) {
                const chords = pattern.map(degree => chordsByDegree[degree]);
                const covered = new Set(chords.flatMap(chord => chord.pitches));
                if (notes.every(note => covered.has(note))) {
                    const openingMatches = notes.filter(note => chords[0].pitches.includes(note)).length;
                    candidates.push({ scale, chords, rank: rank++, openingMatches });
                }
            }
        }

        // Offer different keys before repeating a key with another matching pattern.
        candidates.sort((a, b) => a.rank - b.rank
            || Number(b.scale.id === preferredScaleId) - Number(a.scale.id === preferredScaleId)
            || Number(b.scale.root === notes[0]) - Number(a.scale.root === notes[0])
            || b.openingMatches - a.openingMatches);

        return distinct(candidates);
    }

    function forKeys(scales, preferredScaleId = null) {
        const keys = Array.from(new Map(scales.filter(scale => familyOf(scale)).map(scale => [scale.id, scale])).values());
        keys.sort((a, b) => Number(b.id === preferredScaleId) - Number(a.id === preferredScaleId));
        const options = keys.map(scale => {
            const { numerals, patterns } = familyOf(scale);
            const chords = triads(scale, numerals);
            return patterns.slice(0, patternsPerKey).map(pattern => ({ scale, chords: pattern.map(degree => chords[degree]) }));
        });
        return Array.from({ length: patternsPerKey }, (_, index) => options.map(variants => variants[index]))
            .flat().slice(0, limit);
    }

    function keyFit(scale, family, chords) {
        let outside = 0;
        let missing = 0;
        const dominant = ScaleFinder.pitchAt(scale.root, 7);
        const leadingTone = ScaleFinder.pitchAt(scale.root, 11);
        for (const chord of chords) {
            // A major V is common in minor, even when the suggested chords use natural minor.
            const minorDominant = family === families.minor && chord.root === dominant
                && (chord.dominant || chord.pitches.includes(ScaleFinder.pitchAt(dominant, 7)));
            const absent = chord.pitches.filter(pitch => !scale.pitches.includes(pitch)
                && !(minorDominant && pitch === leadingTone)).length;
            if (absent) outside++;
            missing += absent;
        }
        return { outside, missing };
    }

    function fitsChord(chord, triad) {
        if (chord.root !== triad.root) return false;
        if (triad.pitches.every(pitch => chord.pitches.includes(pitch))) return true;
        const majorThird = chord.pitches.includes(ScaleFinder.pitchAt(chord.root, 4));
        const minorThird = chord.pitches.includes(ScaleFinder.pitchAt(chord.root, 3));
        // Suspensions and power chords leave the third open. In minor, V can stand in for v.
        return chord.pitches.includes(triad.pitches[2])
            && (triad.degree === "v" || !majorThird && !minorThird);
    }

    function matchingTail(input, pattern, end) {
        const length = Math.min(input.length, pattern.length);
        let matched = 0;
        while (matched < length && fitsChord(input[input.length - 1 - matched],
            pattern[(end - matched + pattern.length) % pattern.length])) matched++;
        return matched;
    }

    function nextChords(pattern, end, last) {
        const chords = [];
        let previous = last;
        for (let offset = 1; chords.length < continuationLength && offset <= pattern.length + 1; offset++) {
            const next = pattern[(end + offset) % pattern.length];
            if (previous.root === next.root && next.pitches.every(pitch => previous.pitches.includes(pitch))) continue;
            chords.push(next);
            previous = next;
        }
        return chords;
    }

    function continueChords(input, preferredScaleId = null) {
        if (!Array.isArray(input) || !input.length) return [];
        const first = input[0];
        const last = input[input.length - 1];
        const keys = ScaleFinder.match([]).flatMap(scale => {
            const family = familyOf(scale);
            return family ? [{ scale, family, ...keyFit(scale, family, input) }] : [];
        });
        keys.sort((a, b) => a.outside - b.outside || a.missing - b.missing);
        const best = keys[0];
        const candidates = [];
        for (const { scale, family, outside, missing } of keys) {
            if (outside !== best.outside || missing > best.missing + Number(best.missing > 0)) break;
            const triadsByDegree = triads(scale, family.numerals);
            const patterns = family === families.major ? family.patterns.concat(majorCadences) : family.patterns;
            const options = [];
            patterns.forEach((degrees, rank) => {
                const pattern = degrees.map(degree => triadsByDegree[degree]);
                pattern.forEach((_, end) => {
                    const matched = matchingTail(input, pattern, end);
                    if (!matched) return;
                    const chords = nextChords(pattern, end, last);
                    const resolution = last.dominant && last.root === ScaleFinder.pitchAt(scale.root, 7)
                        && chords[0].root === scale.root;
                    options.push({ scale, chords, matched, rank, resolution, missing, approximate: outside > 0 });
                });
            });
            if (!options.length) {
                const pattern = [0, 3, 4, 0].map(degree => triadsByDegree[degree]);
                options.push({ scale, chords: nextChords(pattern, -1, last), matched: 0, rank: patterns.length,
                    resolution: false, missing, approximate: outside > 0 });
            }
            candidates.push(...options);
        }
        candidates.sort((a, b) => b.matched - a.matched || a.missing - b.missing
            || Number(b.resolution) - Number(a.resolution)
            || Number(b.scale.id === preferredScaleId) - Number(a.scale.id === preferredScaleId)
            || Number(b.scale.root === first.root) - Number(a.scale.root === first.root)
            || a.rank - b.rank);
        return distinct(candidates);
    }

    function distinct(candidates) {
        const results = [];
        const seen = new Set();
        for (const { scale, chords, approximate } of candidates) {
            const signature = chords.map(chord => `${chord.root}${chord.suffix}`).join("/");
            if (seen.has(signature)) continue;
            seen.add(signature);
            results.push(approximate ? { scale, chords, approximate } : { scale, chords });
            if (results.length === limit) break;
        }
        return results;
    }

    return { match, continueChords, forKeys };
})();
