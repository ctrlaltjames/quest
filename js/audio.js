/**
 * ============================================
 * CHIPTUNE AUDIO SYSTEM
 * ============================================
 * Nintendo 8-bit style sound effects and music
 * using Web Audio API (no external files needed)
 */

const AudioSystem = (function () {
    let audioCtx = null;
    let isInitialized = false;

    // Current playing nodes
    let currentMusicNode = null;
    let currentMusicGain = null;
    let currentMusicNodes = []; // Track all nodes for cleanup

    // Track which stage music is playing
    let currentStage = -1; // -1 = no music, 0 = intro, 1-4 = stages, 5 = treasure, 6 = proposal

    // Typing interval for Stage 3
    let typingInterval = null;

    // Intro music interval
    let introMusicInterval = null;

    /**
     * Initialize Web Audio context (must be called from user gesture)
     */
    function init() {
        if (isInitialized) return;

        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            isInitialized = true;
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }

    /**
     * Resume audio context if suspended (browser autoplay policy)
     */
    function resumeContext() {
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    /**
     * Create a square wave oscillator (NES-style)
     */
    function createSquareWave(frequency, volume = 0.15, duration = 0.1) {
        if (!audioCtx) return null;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);

        gain.gain.setValueAtTime(volume, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        return { osc, gain };
    }

    /**
     * Create a triangle wave oscillator (warm, soft sound)
     */
    function createTriangleWave(frequency, volume = 0.12, duration = 0.15) {
        if (!audioCtx) return null;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);

        gain.gain.setValueAtTime(volume, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        return { osc, gain };
    }

    /**
     * Create a noise burst (for typing sounds)
     */
    function createNoiseBurst(duration = 0.03, volume = 0.08) {
        if (!audioCtx) return null;

        const bufferSize = audioCtx.sampleRate * duration;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * volume;
        }

        const source = audioCtx.createBufferSource();
        source.buffer = buffer;

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(volume, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

        // Highpass filter for clickier sound
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 1000;

        source.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);

        return { source, gain };
    }

    /**
     * Play a single note with given frequency and duration
     */
    function playNote(frequency, duration, waveType = 'square', volume = 0.12) {
        if (!audioCtx) return;

        const createFunc = waveType === 'triangle' ? createTriangleWave : createSquareWave;
        const nodes = createFunc(frequency, volume, duration);
        if (nodes) {
            nodes.osc.start();
            nodes.osc.stop(audioCtx.currentTime + duration);
            return nodes;
        }
    }

    /**
     * Play a sequence of notes (arpeggio)
     */
    function playArpeggio(notes, waveType = 'square', volume = 0.12, speed = 0.1) {
        if (!audioCtx) return;

        notes.forEach((freq, i) => {
            setTimeout(() => {
                playNote(freq, speed * 0.9, waveType, volume);
            }, i * speed * 1000);
        });
    }

    /**
     * ==========================================
     * SOUND EFFECTS
     * ==========================================
     */

    /**
     * Correct answer sound - NES-style success arpeggio (C-E-G)
     */
    function playCorrectAnswer() {
        resumeContext();
        playArpeggio([
            523.25, // C5
            659.25, // E5
            783.99, // G5
            1046.50 // C6
        ], 'square', 0.15, 0.08);
    }

    /**
     * Treasure fanfare - Zelda-like triumphant sound
     */
    function playTreasureFanfare() {
        resumeContext();
        // Ascending triumphant melody
        const melody = [
            { freq: 659.25, dur: 0.1 },  // E5
            { freq: 783.99, dur: 0.1 },  // G5
            { freq: 880.00, dur: 0.1 },  // A5
            { freq: 1046.50, dur: 0.2 }, // C6
            { freq: 1174.66, dur: 0.1 }, // D6
            { freq: 1318.51, dur: 0.3 }, // E6
        ];

        melody.forEach((note, i) => {
            setTimeout(() => {
                // Lead melody (square wave)
                playNote(note.freq, note.dur, 'square', 0.15);
                // Harmony (triangle wave, octave lower)
                playNote(note.freq / 2, note.dur, 'triangle', 0.1);
            }, i * 120);
        });
    }

    /**
     * YES fireworks - Zelda treasure find celebration
     */
    function playYesFireworks() {
        resumeContext();

        // Multiple rapid ascending arpeggios
        const arpeggios = [
            [523.25, 659.25, 783.99, 1046.50, 1318.51], // C major
            [587.33, 739.99, 880.00, 1174.66, 1468.33], // D major
            [659.25, 830.61, 987.77, 1318.51, 1567.98], // E major
            [698.46, 880.00, 1046.50, 1396.00, 1760.00], // F major
            [783.99, 987.77, 1174.66, 1567.98, 2093.00], // G major
        ];

        arpeggios.forEach((arp, i) => {
            setTimeout(() => {
                arp.forEach((freq, j) => {
                    setTimeout(() => {
                        playNote(freq, 0.12, 'square', 0.12);
                        if (j % 2 === 0) {
                            playNote(freq / 2, 0.12, 'triangle', 0.08);
                        }
                    }, j * 60);
                });
            }, i * 400);
        });
    }

    /**
     * Play celebratory victory fanfare - chiptune "congratulations" song
     * Classic RPG-style triumph melody
     */
    function playCelebrationSong() {
        resumeContext();

        // Victory fanfare melody (like classic RPG celebration)
        const melody = [
            { f: 659.25, d: 0.15 },  // E5
            { f: 659.25, d: 0.15 },  // E5
            { f: 659.25, d: 0.15 },  // E5
            { f: 783.99, d: 0.4 },   // G5 (hold)
            { f: 698.46, d: 0.4 },   // F5 (hold)
            { f: 659.25, d: 0.4 },   // E5 (hold)
            { f: 587.33, d: 0.4 },   // D5 (hold)
            { f: 659.25, d: 0.15 },  // E5
            { f: 783.99, d: 0.15 },  // G5
            { f: 1046.50, d: 0.6 },  // C6 (victory note!)
        ];

        // Bass line
        const bass = [
            { f: 329.63, d: 0.15 },  // E4
            { f: 329.63, d: 0.15 },  // E4
            { f: 329.63, d: 0.15 },  // E4
            { f: 392.00, d: 0.4 },   // G4
            { f: 349.23, d: 0.4 },   // F4
            { f: 329.63, d: 0.4 },   // E4
            { f: 293.66, d: 0.4 },   // D4
            { f: 329.63, d: 0.15 },  // E4
            { f: 392.00, d: 0.15 },  // G4
            { f: 523.25, d: 0.6 },   // C5
        ];

        // Arpeggiated chords for richness
        const chords = [
            { f: 415.30, d: 0.15 },  // E4 (low)
            { f: 493.88, d: 0.15 },  // B4
            { f: 659.25, d: 0.15 },  // E5
            { f: 830.61, d: 0.4 },   // E6 (hold)
            { f: 392.00, d: 0.15 },  // G4
            { f: 440.00, d: 0.15 },  // A4
            { f: 587.33, d: 0.15 },  // D5
            { f: 698.46, d: 0.4 },   // F5 (hold)
            { f: 329.63, d: 0.15 },  // E4
            { f: 392.00, d: 0.15 },  // G4
            { f: 493.88, d: 0.15 },  // B4
            { f: 659.25, d: 0.15 },  // E5
            { f: 783.99, d: 0.15 },  // G5
            { f: 987.77, d: 0.15 },  // B5
            { f: 1318.51, d: 0.6 },  // E6 (victory!)
        ];

        let time = 0;

        // Play melody (square wave) + bass (triangle wave) simultaneously
        melody.forEach((note, i) => {
            setTimeout(() => {
                playNote(note.f, note.d, 'square', 0.15);
                if (bass[i]) {
                    playNote(bass[i].f, note.d, 'triangle', 0.12);
                }
            }, time);
            time += note.d * 1000;
        });

        // Add arpeggiated chords as a layer (softer, for richness)
        setTimeout(() => {
            chords.forEach((note, i) => {
                setTimeout(() => {
                    playNote(note.f, note.d * 0.8, 'square', 0.06);
                    playNote(note.f / 2, note.d * 0.8, 'triangle', 0.05);
                }, i * 150);
            });
        }, 500); // Start chords slightly after melody
    }

    /**
     * ==========================================
     * STAGE MUSIC
     * ==========================================
     */

    /**
     * Stop all current music
     */
    function stopAllMusic() {
        // Stop all playing nodes
        currentMusicNodes.forEach(node => {
            try {
                if (node.osc) node.osc.stop();
                if (node.source) node.source.stop();
            } catch (e) {}
        });
        currentMusicNodes = [];

        // Stop intervals
        if (introMusicInterval) {
            clearInterval(introMusicInterval);
            introMusicInterval = null;
        }
        if (typingInterval) {
            clearInterval(typingInterval);
            typingInterval = null;
        }

        currentStage = -1;
    }

    /**
     * Fade out current music
     */
    function fadeOutMusic(duration = 1000) {
        if (!currentMusicGain) return;

        currentMusicGain.gain.setValueAtTime(currentMusicGain.gain.value, audioCtx.currentTime);
        currentMusicGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration / 1000);

        setTimeout(() => {
            stopAllMusic();
        }, duration);
    }

    /**
     * Start intro music (slow, ambient pad version)
     */
    function startIntroMusic() {
        if (!audioCtx || currentStage === 0) return;
        resumeContext();
        currentStage = 0;

        // Simple ambient melody notes (C major pentatonic)
        const melody = [
            523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25, 440.00,
            493.88, 523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25,
        ];
        const bassNotes = [
            130.81, 130.81, 130.81, 130.81, 146.83, 146.83, 146.83, 146.83,
            164.81, 164.81, 164.81, 164.81, 174.61, 174.61, 174.61, 174.61,
        ];

        let noteIndex = 0;
        const noteDuration = 0.5; // Slower tempo (was 0.2)

        // Create ambient pad layer - soft sustained chord
        const padGain = audioCtx.createGain();
        padGain.gain.setValueAtTime(0, audioCtx.currentTime);
        padGain.gain.linearRampToValueAtTime(0.03, audioCtx.currentTime + 2);
        padGain.connect(audioCtx.destination);
        currentMusicNodes.push({ gain: padGain });

        // Low ambient drone note
        const droneOsc = audioCtx.createOscillator();
        const droneOscGain = audioCtx.createGain();
        droneOsc.type = 'sine';
        droneOsc.frequency.setValueAtTime(65.41, audioCtx.currentTime); // C2 - low C
        droneOscGain.gain.setValueAtTime(0, audioCtx.currentTime);
        droneOscGain.gain.linearRampToValueAtTime(0.04, audioCtx.currentTime + 3);
        droneOsc.connect(droneOscGain);
        droneOscGain.connect(padGain);
        droneOsc.start();
        currentMusicNodes.push({ osc: droneOsc, gain: droneOscGain });

        // Fifth above drone (G2) for harmonic depth
        const droneOsc2 = audioCtx.createOscillator();
        const droneOscGain2 = audioCtx.createGain();
        droneOsc2.type = 'sine';
        droneOsc2.frequency.setValueAtTime(98.00, audioCtx.currentTime); // G2
        droneOscGain2.gain.setValueAtTime(0, audioCtx.currentTime);
        droneOscGain2.gain.linearRampToValueAtTime(0.025, audioCtx.currentTime + 3);
        droneOsc2.connect(droneOscGain2);
        droneOscGain2.connect(padGain);
        droneOsc2.start();
        currentMusicNodes.push({ osc: droneOsc2, gain: droneOscGain2 });

        // Play melody loop - slower, more spacious
        introMusicInterval = setInterval(() => {
            const freq = melody[noteIndex % melody.length];
            // Melody (triangle wave for softer sound, longer sustain)
            playNote(freq, noteDuration * 1.5, 'triangle', 0.06);
            // Delayed echo for ambient effect
            setTimeout(() => {
                playNote(freq * 0.998, noteDuration * 0.7, 'triangle', 0.025);
            }, 300);
            // Bass (triangle wave, longer sustain)
            playNote(bassNotes[noteIndex % bassNotes.length], noteDuration * 1.2, 'triangle', 0.05);
            noteIndex++;
        }, noteDuration * 1000);

        // Store reference for cleanup
        const intervalNode = { type: 'interval', id: introMusicInterval };
        currentMusicNodes.push(intervalNode);
    }

    /**
     * Stop intro music
     */
    function stopIntroMusic() {
        if (introMusicInterval) {
            clearInterval(introMusicInterval);
            introMusicInterval = null;
        }
        currentStage = -1;
    }

    /**
     * Start Stage 1 music - World War Z-style marching drums
     * Rhythmic war drums with pounding tempo and building urgency
     * Mimics the apocalypse approaching: hordes of zombies closing in
     * Inspired by Ilan Eshkeri's score: deep taiko drums + brass stabs
     */
    function startStage1Music() {
        if (!audioCtx || currentStage === 1) return;
        resumeContext();
        currentStage = 1;

        // Stop previous music
        stopAllMusic();

        // ========================================
        // MASTER VOLUME
        // ========================================
        const masterGain = audioCtx.createGain();
        masterGain.gain.setValueAtTime(0.7, audioCtx.currentTime);
        masterGain.connect(audioCtx.destination);
        currentMusicNodes.push({ gain: masterGain });

        // ========================================
        // LAYER 1: WAR DRUMS (Deep timpani/taiko)
        // Amplitude-modulated noise through bandpass = boom sound
        // ========================================
        function playWarDrum(freq, time, duration, volume) {
            const now = audioCtx.currentTime + time;

            // Create noise burst for drum body
            const bufferSize = audioCtx.sampleRate * 0.3;
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1);
            }

            const noiseSource = audioCtx.createBufferSource();
            noiseSource.buffer = buffer;

            // Bandpass filter for drum body
            const drumFilter = audioCtx.createBiquadFilter();
            drumFilter.type = 'bandpass';
            drumFilter.frequency.setValueAtTime(freq, now);
            drumFilter.Q.setValueAtTime(2, now);

            // Envelope gain
            const drumGain = audioCtx.createGain();
            drumGain.gain.setValueAtTime(volume, now);
            drumGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            noiseSource.connect(drumFilter);
            drumFilter.connect(drumGain);
            drumGain.connect(masterGain);
            noiseSource.start(now);
            noiseSource.stop(now + duration + 0.01);
            currentMusicNodes.push({ source: noiseSource, gain: drumGain });

            // Pitch envelope for "boom" character
            const pitchOsc = audioCtx.createOscillator();
            const pitchGain = audioCtx.createGain();
            pitchOsc.type = 'sine';
            pitchOsc.frequency.setValueAtTime(freq * 2, now);
            pitchOsc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + duration * 0.5);
            pitchGain.gain.setValueAtTime(volume * 0.5, now);
            pitchGain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.3);
            pitchOsc.connect(pitchGain);
            pitchGain.connect(masterGain);
            pitchOsc.start(now);
            pitchOsc.stop(now + duration + 0.01);
            currentMusicNodes.push({ osc: pitchOsc, gain: pitchGain });
        }

        // ========================================
        // LAYER 2: MARCHING RHYTHM PATTERN
        // Booming pattern with building urgency
        // ========================================
        let beatIndex = 0;
        let baseBPM = 60; // Start slow

        function playMarchingPattern() {
            if (currentStage !== 1) return;

            // Calculate current BPM (builds over ~60 seconds then loops)
            const cycleTime = (audioCtx.currentTime % 60) / 60; // 0-1 over 60 seconds
            const currentBPM = baseBPM + cycleTime * 60; // 60 → 120 BPM
            const beatDuration = 60 / currentBPM;

            // Pattern: Heavy-轻-Heavy-轻(fill) - like marching footsteps
            const pattern = [
                { beat: 0, time: 0, heavy: true },
                { beat: 1, time: beatDuration, heavy: false },
                { beat: 2, time: beatDuration * 2, heavy: true },
                { beat: 3, time: beatDuration * 3, heavy: false },
                // Drum fill on beat 4
                { beat: 4, time: beatDuration * 4, heavy: false, fill: true },
                { beat: 5, time: beatDuration * 4.25, heavy: false, fill: true },
                { beat: 6, time: beatDuration * 4.5, heavy: false, fill: true },
                { beat: 7, time: beatDuration * 4.75, heavy: false, fill: true },
            ];

            pattern.forEach(note => {
                if (note.fill) {
                    // Drum roll - quick rolls at end
                    for (let i = 0; i < 4; i++) {
                        const rollTime = note.time + i * (beatDuration * 0.08);
                        playWarDrum(80 + i * 10, rollTime, beatDuration * 0.06, 0.04 * (1 - i * 0.2));
                    }
                } else {
                    const vol = note.heavy ? 0.15 : 0.08;
                    const dur = note.heavy ? 0.8 : 0.5;
                    const drumFreq = note.heavy ? 55 : 70;
                    playWarDrum(drumFreq, note.time, dur, vol);
                }
            });

            // Schedule next pattern
            const patternDuration = beatDuration * 5;
            setTimeout(() => {
                if (currentStage === 1) {
                    playMarchingPattern();
                }
            }, patternDuration * 1000 - 100);

            beatIndex++;
        }

        // Start pattern after 1 second
        setTimeout(playMarchingPattern, 1000);

        // ========================================
        // LAYER 3: BRASS STABS (Dramatic hits)
        // Sharp, powerful chords on heavy beats
        // ========================================
        const brassNotes = [
            // A minor chord (dramatic, tense)
            { freq: 220.00, dur: 0.6 },  // A3
            { freq: 261.63, dur: 0.6 },  // C4
            { freq: 329.63, dur: 0.6 },  // E3
            { freq: 440.00, dur: 0.4 },  // A4 (high stab)
        ];

        function playBrassStab(time, volume) {
            const now = audioCtx.currentTime + time;

            brassNotes.forEach(note => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                const filter = audioCtx.createBiquadFilter();

                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(note.freq, now);

                // Lowpass filter for brass body
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(2000, now);
                filter.Q.setValueAtTime(3, now);

                // Sharp attack, quick decay
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(volume * 0.06, now + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.001, now + note.dur);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(masterGain);
                osc.start(now);
                osc.stop(now + note.dur + 0.01);
                currentMusicNodes.push({ osc, gain, filter });
            });
        }

        // Schedule brass stabs on heavy beats
        function scheduleBrass() {
            if (currentStage !== 1) return;

            const cycleTime = (audioCtx.currentTime % 60) / 60;
            const currentBPM = baseBPM + cycleTime * 60;
            const beatDuration = 60 / currentBPM;

            // Brass hits on beats 1 and 3 (every 2 beats)
            const beatsPerPhrase = 8;
            const phraseDuration = beatDuration * beatsPerPhrase;

            // Start brass on first heavy beat
            playBrassStab(0, 1.0); // Full volume
            // Second hit
            setTimeout(() => {
                if (currentStage === 1) {
                    playBrassStab(beatDuration * 2, 0.8);
                }
            }, beatDuration * 2 * 1000 - 50);

            // Schedule next phrase
            setTimeout(scheduleBrass, phraseDuration * 1000 - 200);
        }

        setTimeout(scheduleBrass, 1000);

        // ========================================
        // LAYER 4: SUB-BASS PULSE (Physical impact)
        // Deep sine wave below hearing range
        // ========================================
        const subBassOsc = audioCtx.createOscillator();
        const subBassGain = audioCtx.createGain();
        const subBassFilter = audioCtx.createBiquadFilter();
        subBassOsc.type = 'sine';
        subBassOsc.frequency.setValueAtTime(40, audioCtx.currentTime);
        subBassFilter.type = 'lowpass';
        subBassFilter.frequency.value = 55;
        subBassGain.gain.setValueAtTime(0.10, audioCtx.currentTime);

        // Pulse sub-bass with the rhythm
        function pulseSubBass() {
            if (currentStage !== 1) return;

            const cycleTime = (audioCtx.currentTime % 60) / 60;
            const currentBPM = baseBPM + cycleTime * 60;
            const beatDuration = 60 / currentBPM;

            // Pulse on heavy beats
            const now = audioCtx.currentTime;
            subBassGain.gain.setValueAtTime(0.10, now);
            subBassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

            setTimeout(() => {
                if (currentStage === 1) pulseSubBass();
            }, beatDuration * 2 * 1000 - 100);
        }

        subBassOsc.connect(subBassFilter);
        subBassFilter.connect(subBassGain);
        subBassGain.connect(masterGain);
        subBassOsc.start();
        currentMusicNodes.push({ osc: subBassOsc, gain: subBassGain });

        setTimeout(pulseSubBass, 1000);

        // ========================================
        // LAYER 5: DISTANT ROAR (Zombie horde ambience)
        // Low, rumbling noise for atmosphere
        // ========================================
        function playHordeRoar() {
            if (currentStage !== 1) return;

            const now = audioCtx.currentTime;
            const duration = 2 + Math.random() * 3;

            // Create roaring noise
            const bufferSize = audioCtx.sampleRate * duration;
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                // Modulate to create "roar" effect
                const mod = Math.sin(i / audioCtx.sampleRate * 3) * 0.5 + 0.5;
                data[i] = (Math.random() * 2 - 1) * mod;
            }

            const roarSource = audioCtx.createBufferSource();
            roarSource.buffer = buffer;

            const roarFilter = audioCtx.createBiquadFilter();
            roarFilter.type = 'bandpass';
            roarFilter.frequency.value = 120;
            roarFilter.Q.value = 1;

            const roarGain = audioCtx.createGain();
            roarGain.gain.setValueAtTime(0, now);
            roarGain.gain.linearRampToValueAtTime(0.015, now + 0.5);
            roarGain.gain.setValueAtTime(0.015, now + duration * 0.5);
            roarGain.gain.linearRampToValueAtTime(0, now + duration);

            roarSource.connect(roarFilter);
            roarFilter.connect(roarGain);
            roarGain.connect(masterGain);
            roarSource.start(now);
            roarSource.stop(now + duration + 0.01);
            currentMusicNodes.push({ source: roarSource, gain: roarGain });

            // Schedule next roar
            const nextRoar = 10000 + Math.random() * 20000; // 10-30 seconds
            setTimeout(playHordeRoar, nextRoar);
        }

        setTimeout(playHordeRoar, 5000);
    }

    /**
     * Start Stage 2 music - Romantic theme
     */
    function startStage2Music() {
        if (!audioCtx || currentStage === 2) return;
        resumeContext();
        currentStage = 2;

        stopAllMusic();

        // Romantic melody notes (warm, flowing)
        const melody = [
            329.63, 392.00, 440.00, 523.25, 440.00, 392.00, 329.63, 293.66,
            329.63, 349.23, 440.00, 523.25, 493.88, 440.00, 349.23, 329.63,
            261.63, 329.63, 392.00, 523.25, 392.00, 329.63, 261.63, 220.00,
            246.94, 329.63, 440.00, 523.25, 440.00, 329.63, 261.63, 293.66,
        ];
        const harmony = [
            164.81, 196.00, 220.00, 261.63, 220.00, 196.00, 164.81, 146.83,
            164.81, 174.61, 220.00, 261.63, 246.94, 220.00, 174.61, 164.81,
            130.81, 164.81, 196.00, 261.63, 196.00, 164.81, 130.81, 110.00,
            123.47, 164.81, 220.00, 261.63, 220.00, 164.81, 130.81, 146.83,
        ];

        let noteIndex = 0;
        const noteDuration = 0.5;

        typingInterval = setInterval(() => {
            const melFreq = melody[noteIndex % melody.length];
            const harpFreq = harmony[noteIndex % harmony.length];

            // Melody (triangle wave for warm sound)
            playNote(melFreq, noteDuration * 0.9, 'triangle', 0.08);
            // Harmony (triangle wave, softer)
            playNote(harpFreq, noteDuration * 0.9, 'triangle', 0.05);
            noteIndex++;
        }, noteDuration * 1000);

        currentMusicNodes.push({ type: 'interval', id: typingInterval });
    }

    /**
     * Start Stage 3 audio - Typing sounds
     */
    function startStage3Music() {
        if (!audioCtx || currentStage === 3) return;
        resumeContext();
        currentStage = 3;

        stopAllMusic();

        // Rhythmic typing pattern
        const typingPattern = [
            { delay: 0, sound: true },
            { delay: 80, sound: true },
            { delay: 150, sound: true },
            { delay: 300, sound: true },
            { delay: 400, sound: true },
            { delay: 500, sound: false }, // pause
            { delay: 600, sound: true },
            { delay: 680, sound: true },
            { delay: 800, sound: true },
            { delay: 950, sound: true },
            { delay: 1000, sound: true },
            { delay: 1100, sound: true },
            { delay: 1200, sound: false }, // pause
        ];

        let patternIndex = 0;

        typingInterval = setInterval(() => {
            const pattern = typingPattern[patternIndex % typingPattern.length];

            if (pattern.sound) {
                // Vary the click sound slightly for realism
                const volume = 0.04 + Math.random() * 0.04;
                const duration = 0.02 + Math.random() * 0.02;
                createNoiseBurst(duration, volume);
            }
            patternIndex++;
        }, 1200); // Pattern repeats every 1200ms

        currentMusicNodes.push({ type: 'interval', id: typingInterval });
    }

    /**
     * Start Stage 4 music - 8-bit video game music
     */
    function startStage4Music() {
        if (!audioCtx || currentStage === 4) return;
        resumeContext();
        currentStage = 4;

        stopAllMusic();

        // Upbeat 8-bit game music melody
        const melody = [
            392.00, 523.25, 392.00, 329.63,
            349.23, 440.00, 349.23, 293.66,
            329.63, 440.00, 329.63, 261.63,
            293.66, 392.00, 293.66, 246.94,
            329.63, 392.00, 523.25, 392.00,
            349.23, 440.00, 349.23, 329.63,
            293.66, 349.23, 440.00, 523.25,
            493.88, 392.00, 329.63, 349.23,
        ];
        const bass = [
            196.00, 196.00, 196.00, 196.00,
            174.61, 174.61, 174.61, 174.61,
            164.81, 164.81, 164.81, 164.81,
            146.83, 146.83, 146.83, 146.83,
            164.81, 164.81, 164.81, 164.81,
            174.61, 174.61, 174.61, 174.61,
            196.00, 196.00, 196.00, 196.00,
            220.00, 220.00, 220.00, 220.00,
        ];

        let noteIndex = 0;
        const noteDuration = 0.15;

        typingInterval = setInterval(() => {
            const melFreq = melody[noteIndex % melody.length];
            const bassFreq = bass[noteIndex % bass.length];

            // Fast melody (square wave)
            playNote(melFreq, noteDuration * 0.8, 'square', 0.08);
            // Bouncy bass (triangle wave)
            playNote(bassFreq, noteDuration * 0.8, 'triangle', 0.07);
            noteIndex++;
        }, noteDuration * 1000);

        currentMusicNodes.push({ type: 'interval', id: typingInterval });
    }

    /**
     * Start treasure screen music - faster paced, building tension
     */
    function startTreasureMusic() {
        if (!audioCtx || currentStage === 5) return;
        resumeContext();
        currentStage = 5;

        stopAllMusic();

        // Ascending chord progression - builds tension toward climax
        const chords = [
            [523.25, 659.25, 783.99],  // C4 major - start humble
            [587.33, 739.99, 880.00],  // D4 major
            [659.25, 830.61, 987.77],  // E4 major
            [698.46, 880.00, 1046.50], // F4 major
            [783.99, 987.77, 1174.66], // G4 major - building
            [880.00, 1108.73, 1318.51], // A4 major - peak tension
            // Loop back but play more intensely
            [523.25, 659.25, 783.99, 1046.50], // C4 major + C5 (full chord)
            [659.25, 830.61, 987.77, 1318.51], // E4 major + E5
            [783.99, 987.77, 1174.66, 1567.98], // G4 major + G5
            [1046.50, 1318.51, 1567.98, 2093.00], // C5 major - FULL TREASURE CLIMAX
        ];

        let chordIndex = 0;
        const chordDuration = 0.8; // Faster chord changes (was 2.0s)

        typingInterval = setInterval(() => {
            const chord = chords[chordIndex % chords.length];
            const progress = chordIndex % chords.length; // Position within loop (0-9)

            // Volume swells as we approach the climax
            const volumeMultiplier = 0.5 + (progress / 10) * 0.5; // 0.5 → 1.0

            // Play chord tones (harmony) - faster arpeggio upward
            chord.forEach((freq, i) => {
                const delay = i * 40; // 40ms between each note
                setTimeout(() => {
                    playNote(freq, chordDuration * 0.5, 'triangle', 0.04 * volumeMultiplier);
                }, delay);
            });

            // Bass note - punchier on beat
            playNote(chord[0] / 4, chordDuration * 0.7, 'triangle', 0.06 * volumeMultiplier);

            // More frequent high sparkles as we build tension
            if (Math.random() < (0.4 + progress * 0.06)) {
                const sparkle = chord[chord.length - 1] * 1.5;
                playNote(sparkle, 0.2, 'square', 0.015 * volumeMultiplier);
            }

            // Double sparkle on climax chords
            if (progress >= 8 && Math.random() < 0.5) {
                const sparkle2 = chord[0] * 3;
                playNote(sparkle2, 0.3, 'square', 0.01 * volumeMultiplier);
            }

            chordIndex++;
        }, chordDuration * 1000);

        currentMusicNodes.push({ type: 'interval', id: typingInterval });
    }

    /**
     * ==========================================
     * STAGE MANAGEMENT
     * ==========================================
     */

    /**
     * Start appropriate music for a given stage
     */
    function startStageMusic(stageNum) {
        if (!audioCtx) return;

        switch (stageNum) {
            case 0: // Title screen
                startIntroMusic();
                break;
            case 1: // Stage 1 - Spooky
                startStage1Music();
                break;
            case 2: // Stage 2 - Romantic
                startStage2Music();
                break;
            case 3: // Stage 3 - Typing
                startStage3Music();
                break;
            case 4: // Stage 4 - 8-bit game
                startStage4Music();
                break;
            case 6: // Treasure screen
                startTreasureMusic();
                break;
            case 5: // Proposal - stop music
                stopAllMusic();
                break;
        }
    }

    /**
     * Called when transitioning between stages
     * Handles crossfading between stage music
     */
    function onStageChange(fromStage, toStage) {
        if (!audioCtx) return;

        // If going to proposal screen, stop all music immediately (no fade)
        if (toStage === 5) {
            stopAllMusic();
            return;
        }

        // If going to treasure screen, quick transition
        if (toStage === 6) {
            stopAllMusic();
            setTimeout(() => {
                startTreasureMusic();
            }, 200);
            return;
        }

        // If going to title screen, quick transition
        if (toStage === 0) {
            stopAllMusic();
            setTimeout(() => {
                startIntroMusic();
            }, 200);
            return;
        }

        // For game stages, quick crossfade between music
        if (fromStage !== toStage && toStage >= 1 && toStage <= 4) {
            stopAllMusic();
            // Start new music after brief pause
            setTimeout(() => {
                startStageMusic(toStage);
            }, 200);
        }
    }

    /**
     * Initialize audio on first user interaction
     */
    function ensureInitialized() {
        if (!isInitialized) {
            init();
        }
        resumeContext();
    }

    /**
     * Public API
     */
    return {
        // Initialization
        init: ensureInitialized,

        // Sound effects
        playCorrectAnswer,
        playTreasureFanfare,
        playYesFireworks,
        playCelebrationSong,

        // Stage music
        startStageMusic,
        onStageChange,
        stopAllMusic,

        // Called when any user interaction happens (for autoplay policy)
        ensureInitialized,
    };
})();

// ============================================
// AUTO-INITIALIZE ON FIRST USER INTERACTION
// ============================================
document.addEventListener('click', function initAudioOnce() {
    AudioSystem.ensureInitialized();
    document.removeEventListener('click', initAudioOnce);
}, { once: true });

document.addEventListener('keydown', function initAudioOnce() {
    AudioSystem.ensureInitialized();
    document.removeEventListener('keydown', initAudioOnce);
}, { once: true });