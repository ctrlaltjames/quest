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
     * Start Stage 1 music - 28 Days Later theme inspired horror drone
     * Slowly building, intensely dissonant string cluster with exponential volume sweep
     * Inspired by Jon Hopkins' iconic score: close-interval clusters that build to crushing
     * crescendos, creating a sense of inevitable dread
     */
    function startStage1Music() {
        if (!audioCtx || currentStage === 1) return;
        resumeContext();
        currentStage = 1;

        // Stop previous music
        stopAllMusic();

        // ========================================
        // MASTER VOLUME CONTROL for exponential sweep
        // ========================================
        const masterGain = audioCtx.createGain();
        masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
        masterGain.connect(audioCtx.destination);
        currentMusicNodes.push({ gain: masterGain });

        // ========================================
        // LAYER 1: String cluster - ~10 detuned oscillators
        // Mimics the close-interval string wall of sound
        // Base pitch around A1 (55 Hz) range
        // ========================================
        const clusterBaseFreq = 55.00; // A1
        // Close intervals mimicking string cluster (semitones above base)
        // These create beating, dissonance when detuned and played together
        const clusterSemitones = [
            0,      // A1 (unison)
            0.08,   // Slightly detuned unison
            -0.06,  // Slightly detuned unison (beating)
            1.2,    // Very close to Bb1 - crushing minor 2nd
            1.8,    // Slightly flat Bb1
            3.5,    // Between B1 and C2 - dissonant
            5.0,    // C#2
            7.0,    // D2
            9.0,    // E2
            11.0,   // F#2 (fifth above - adds depth)
        ];

        const clusterOscillators = [];
        const clusterGains = [];

        clusterSemitones.forEach((semitoneOffset, i) => {
            const freq = clusterBaseFreq * Math.pow(2, semitoneOffset / 12);

            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            const filter = audioCtx.createBiquadFilter();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

            // Low-pass filter to muffle into string-like quality
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, audioCtx.currentTime);
            filter.Q.setValueAtTime(2, audioCtx.currentTime);

            // Individual gain (will be overridden by master sweep)
            gain.gain.setValueAtTime(0.015, audioCtx.currentTime);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(masterGain);
            osc.start();

            clusterOscillators.push(osc);
            clusterGains.push(gain);
            currentMusicNodes.push({ osc: osc, gain: gain, filter: filter });
        });

        // ========================================
        // LAYER 2: Sub-bass foundation
        // Deep rumble below the cluster for physical impact
        // ========================================
        const subOsc = audioCtx.createOscillator();
        const subGain = audioCtx.createGain();
        const subFilter = audioCtx.createBiquadFilter();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(36.71, audioCtx.currentTime); // D1
        subFilter.type = 'lowpass';
        subFilter.frequency.value = 55;
        subGain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        subOsc.connect(subFilter);
        subFilter.connect(subGain);
        subGain.connect(masterGain);
        subOsc.start();
        currentMusicNodes.push({ osc: subOsc, gain: subGain });

        // ========================================
        // LAYER 3: High harmonic shimmer
        // Quiet overtone that adds ethereal quality
        // ========================================
        const highOsc = audioCtx.createOscillator();
        const highGain = audioCtx.createGain();
        const highFilter = audioCtx.createBiquadFilter();
        highOsc.type = 'sine';
        highOsc.frequency.setValueAtTime(clusterBaseFreq * 6, audioCtx.currentTime); // A4 (6 octaves up)
        highFilter.type = 'lowpass';
        highFilter.frequency.value = 1500;
        highGain.gain.setValueAtTime(0.003, audioCtx.currentTime);
        highOsc.connect(highFilter);
        highFilter.connect(highGain);
        highGain.connect(masterGain);
        highOsc.start();
        currentMusicNodes.push({ osc: highOsc, gain: highGain });

        // ========================================
        // LAYER 4: Slow pitch climb (the "inevitable approach")
        // The entire cluster slowly shifts up in pitch
        // ========================================
        let climbStartTime = audioCtx.currentTime;
        const climbDuration = 30; // Full climb takes 30 seconds
        const climbRange = 3.0;   // Total climb range: 3 semitones (minor 3rd)

        // ========================================
        // THE EXPONENTIAL VOLUME SWEEP
        // Core of 28 Days Later theme: near-silent → deafening → near-silent
        // Loop cycle: ~20 seconds
        // ========================================
        const cycleDuration = 20; // Full cycle time
        const buildPhase = 0.65;   // 65% of cycle building up
        const releasePhase = 0.15; // 15% releasing to silence
        const restPhase = 0.20;    // 20% resting in silence

        function startVolumeCycle(startTime) {
            const phaseBuild = cycleDuration * buildPhase;  // 13 seconds
            const phaseRelease = cycleDuration * releasePhase; // 3 seconds
            const phaseRest = cycleDuration * restPhase;      // 4 seconds
            const phaseRecovery = 1.0;                         // 1 second fade back to start

            const totalCycle = phaseBuild + phaseRelease + phaseRest + phaseRecovery;

            // Phase 1: Exponential build from near-silence to peak
            masterGain.gain.cancelScheduledValuesAtTime(startTime);
            masterGain.gain.setValueAtTime(0.0001, startTime); // Nearly silent start
            masterGain.gain.exponentialRampToValueAtTime(0.35, startTime + phaseBuild); // Build to loud!

            // Phase 2: Release back to silence (abrupt cut, then fade)
            masterGain.gain.setValueAtTime(0.35, startTime + phaseBuild);
            masterGain.gain.exponentialRampToValueAtTime(0.0001, startTime + phaseBuild + phaseRelease);

            // Phase 3: Rest in silence
            masterGain.gain.setValueAtTime(0.0001, startTime + phaseBuild + phaseRelease);

            // Phase 4: Quick recovery to start
            masterGain.gain.setValueAtTime(0.0001, startTime + phaseBuild + phaseRelease + phaseRest);
            masterGain.gain.exponentialRampToValueAtTime(0.0001, startTime + totalCycle);

            // Schedule next cycle
            setTimeout(() => {
                if (currentStage === 1) {
                    startVolumeCycle(audioCtx.currentTime);
                }
            }, (totalCycle - phaseRecovery) * 1000);
        }

        startVolumeCycle(audioCtx.currentTime + 1); // Start after 1 second delay

        // ========================================
        // LAYER 5: Slow pitch climb on cluster
        // ========================================
        let climbTime = 0;
        const climbInterval = setInterval(() => {
            climbTime += 0.1;
            // Sine wave climb: goes up and down slowly
            const climbAmount = Math.sin(climbTime * 0.15) * (climbRange / 2);
            const currentClimb = ((climbTime % 30) / 30) * climbRange; // Gradual climb over 30s

            clusterOscillators.forEach((osc, i) => {
                const baseFreq = clusterBaseFreq * Math.pow(2, clusterSemitones[i] / 12);
                osc.frequency.linearRampToValueAtTime(
                    baseFreq * Math.pow(2, currentClimb / 12),
                    audioCtx.currentTime + 0.1
                );
            });
        }, 100);
        currentMusicNodes.push({ type: 'interval', id: climbInterval });

        // ========================================
        // LAYER 6: Sub-bass LFO modulation
        // Deep rumbling/rolling effect
        // ========================================
        const subLFO = audioCtx.createOscillator();
        const subLFOGain = audioCtx.createGain();
        subLFO.type = 'sine';
        subLFO.frequency.setValueAtTime(0.2, audioCtx.currentTime);
        subLFOGain.gain.setValueAtTime(2, audioCtx.currentTime);
        subLFO.connect(subLFOGain);
        subLFOGain.connect(subOsc.frequency);
        subLFO.start();
        currentMusicNodes.push({ osc: subLFO, gain: subLFOGain });

        // ========================================
        // LAYER 7: Cluster "breathing" - secondary volume modulation
        // Subtle pulsing within the main sweep
        // ========================================
        const breatheOsc = audioCtx.createOscillator();
        const breatheGain = audioCtx.createGain();
        breatheOsc.type = 'sine';
        breatheOsc.frequency.setValueAtTime(0.06, audioCtx.currentTime); // Very slow - ~17 second cycle
        breatheGain.gain.setValueAtTime(0.008, audioCtx.currentTime);
        breatheOsc.connect(breatheGain);
        breatheGain.connect(masterGain.gain); // Modulate master volume subtly
        breatheOsc.start();
        currentMusicNodes.push({ osc: breatheOsc, gain: breatheGain });
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