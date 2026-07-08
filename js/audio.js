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
    let fadingOutNodes = []; // Nodes currently fading out (old music during crossfade)

    // Single shared master gain node for all audio output
    let masterGainNode = null;

    // Gain node management (no crossfading - sequential fade out then in)
    let currentMasterGain = null;  // The gain node currently playing
    let fadeOutDuration = 0.5;     // Duration of fade-out in seconds
    let fadeInDuration = 0.1;      // Duration of fade-in in seconds (reduced for faster music switching)
    let fadeOutTimeout = null;     // Timeout for sequential fade-out

    // Track which stage music is playing
    let currentStage = -1; // -1 = no music, 0 = intro, 1-4 = stages, 5 = treasure, 6 = proposal

    // Celebration song loop interval
    let celebrationSongInterval = null;

    // Typing interval for Stage 3
    let typingInterval = null;

    // Intro music interval
    let introMusicInterval = null;

    // Stage 1 heartbeat and melody timers
    let heartbeatInterval = null;
    let melodyInterval = null;

    // Stage 1 scheduled note timeouts (for horror stingers and groans)
    let scheduledTimeouts = [];

    // Static noise updater
    let staticUpdateInterval = null;

    /**
     * Initialize Web Audio context (must be called from user gesture)
     */
    function init() {
        if (isInitialized) return;

        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();

            // Create a single shared master gain node connected to destination
            masterGainNode = audioCtx.createGain();
            masterGainNode.gain.setValueAtTime(1, audioCtx.currentTime);
            masterGainNode.connect(audioCtx.destination);

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
     * Create a square wave oscillator (retro chiptune sound)
     */
    function createSquareWave(frequency, volume = 0.12, duration = 0.15, destination = null, startTime = null) {
        if (!audioCtx) return null;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const when = startTime !== null ? startTime : audioCtx.currentTime;

        osc.type = 'square';
        osc.frequency.setValueAtTime(frequency, when);

        gain.gain.setValueAtTime(volume, when);
        gain.gain.exponentialRampToValueAtTime(0.001, when + duration);

        osc.connect(gain);
        gain.connect(destination || masterGainNode);

        return { osc, gain, startTime: when };
    }

    /**
     * Create a triangle wave oscillator (warm, soft sound)
     */
    function createTriangleWave(frequency, volume = 0.12, duration = 0.15, destination = null, startTime = null) {
        if (!audioCtx) return null;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const when = startTime !== null ? startTime : audioCtx.currentTime;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(frequency, when);

        gain.gain.setValueAtTime(volume, when);
        gain.gain.exponentialRampToValueAtTime(0.001, when + duration);

        osc.connect(gain);
        gain.connect(destination || masterGainNode);

        return { osc, gain, startTime: when };
    }

    /**
     * Create a sine wave oscillator (smooth, pure sound)
     */
    function createSineWave(frequency, volume = 0.12, duration = 0.15, destination = null, startTime = null) {
        if (!audioCtx) return null;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const when = startTime !== null ? startTime : audioCtx.currentTime;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, when);

        gain.gain.setValueAtTime(volume, when);
        gain.gain.exponentialRampToValueAtTime(0.001, when + duration);

        osc.connect(gain);
        gain.connect(destination || masterGainNode);

        return { osc, gain, startTime: when };
    }

    /**
     * Create a noise burst (for typing sounds)
     */
    function createNoiseBurst(duration = 0.03, volume = 0.08, destination = null) {
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
        gain.connect(destination || masterGainNode);

        source.start();

        return { source, gain };
    }

    /**
     * Play a single note with given frequency and duration
     * @param {number} frequency - Note frequency in Hz
     * @param {number} duration - Note duration in seconds
     * @param {string} waveType - 'square' or 'triangle'
     * @param {number} volume - Gain volume (0-1)
     * @param {AudioNode|null} destination - Destination gain node
     * @param {number|null} startTime - Absolute audioContext time to start the note (null = now)
     */
    function playNote(frequency, duration, waveType = 'square', volume = 0.12, destination = null, startTime = null) {
        if (!audioCtx) return;

        const when = startTime !== null ? startTime : audioCtx.currentTime;
        let createFunc;
        if (waveType === 'triangle') {
            createFunc = createTriangleWave;
        } else if (waveType === 'sine') {
            createFunc = createSineWave;
        } else {
            createFunc = createSquareWave;
        }
        const nodes = createFunc(frequency, volume, duration, destination, when);
        if (nodes) {
            nodes.osc.start(when);
            nodes.osc.stop(when + duration);
            return nodes;
        }
    }

    /**
     * Play a sequence of notes (arpeggio)
     */
    function playArpeggio(notes, waveType = 'square', volume = 0.12, speed = 0.1, duration = 0.15, destination = null) {
        if (!audioCtx) return;

        notes.forEach((freq, i) => {
            setTimeout(() => {
                playNote(freq, duration * 0.9, waveType, volume, destination);
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
     * Treasure fanfare - Zelda-like triumphant sound (Rapid Arpeggio)
     */
    function playTreasureFanfare() {
        resumeContext();
        // Rapidly ascending C major arpeggio (C5, E5, G5, C6, E6)
        const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
        notes.forEach((freq, i) => {
            setTimeout(() => {
                // Lead melody (square wave for that classic 8-bit bite)
                playNote(freq, 0.15, 'square', 0.15);
                // Add a subtle triangle harmony for richness on every other note
                if (i % 2 === 0) {
                    playNote(freq / 2, 0.15, 'triangle', 0.08);
                }
            }, i * 60); // Very fast interval for that classic "brrrp" sound
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
     * Play original romantic chiptune celebration song - "Forever Begins Now"
     * A simple, elegant, romantic melody for the proposal moment.
     * Features a clear, singable melody in A major with gentle chord
     * accompaniment and subtle sparkle effects.
     * Key: A major | Tempo: ~100 BPM | Style: Romantic, simple, elegant
     * Loop duration: 10 seconds (seamless loop)
     */
    function playCelebrationSong() {
        resumeContext();

        // Clean up any previous celebration song to prevent duplicates
        if (celebrationSongInterval) {
            clearInterval(celebrationSongInterval);
            celebrationSongInterval = null;
        }

        currentStage = 6; // Proposal music stage identifier

        // Create new master gain for this stage
        const newMasterGain = audioCtx.createGain();
        newMasterGain.gain.setValueAtTime(0, audioCtx.currentTime);
        newMasterGain.connect(audioCtx.destination);

        // Fade in the new gain node
        newMasterGain.gain.setValueAtTime(0, audioCtx.currentTime);
        newMasterGain.gain.linearRampToValueAtTime(1, audioCtx.currentTime + fadeInDuration);

        // Update current master gain
        currentMasterGain = newMasterGain;

        // === LOOP DURATION (in ms) ===
        const loopDuration = 10000; // 10-second loop
        const loopSeconds = loopDuration / 1000; // 10 seconds

        // === NOTE SCHEDULE (absolute time offsets within each loop) ===
        // All notes use absolute offsets from loop start for perfect looping

        // --- MELODY: Simple romantic melody (triangle wave, warm and smooth) ---
        // A gentle, flowing melody that feels like a warm embrace
        // Uses triangle wave for warmth, longer notes for calm romance
        // Key: G major | Tempo: ~80 BPM feel | Style: Romantic, intimate, tender
        const melodyLoop = [
            // Phrase 1: Gentle opening (G major) — "You are my sunshine"
            { f: 392.00, d: 0.60, t: 0.0 },     // G4 - "You"
            { f: 440.00, d: 0.60, t: 0.60 },    // A4 - "are"
            { f: 392.00, d: 0.60, t: 1.20 },    // G4 - "my"
            { f: 329.63, d: 0.60, t: 1.80 },    // E4 - "sun"
            { f: 293.66, d: 1.00, t: 2.40 },    // D4 - "-shine" (hold)

            // Phrase 2: Gentle rise (Em) — "my love grows"
            { f: 329.63, d: 0.60, t: 3.40 },    // E4 - "my"
            { f: 392.00, d: 0.60, t: 4.00 },    // G4 - "love"
            { f: 440.00, d: 0.60, t: 4.60 },    // A4 - "grows"
            { f: 392.00, d: 0.60, t: 5.20 },    // G4 - "ev"
            { f: 329.63, d: 1.00, t: 5.80 },    // E4 - "-ery" (hold)

            // Phrase 3: Warm climax (C → D → G) — "forever begins"
            { f: 349.23, d: 0.60, t: 6.80 },    // F4 - "for"
            { f: 392.00, d: 0.60, t: 7.40 },    // G4 - "ev"
            { f: 440.00, d: 0.60, t: 8.00 },    // A4 - "-er"
            { f: 523.25, d: 0.60, t: 8.60 },    // C5 - "be"
            { f: 392.00, d: 1.00, t: 9.20 },    // G4 - "gins!" (resolution)
        ];

        // --- BASS LINE: One note per chord, sustained (sine wave) ---
        const bassLoop = [
            // G major (4 seconds)
            { f: 98.00, d: 4.0, t: 0.0 },       // G2
            // E minor (2 seconds)
            { f: 82.41, d: 2.0, t: 4.0 },       // E2
            // C major (2 seconds)
            { f: 65.41, d: 2.0, t: 6.0 },       // C2
            // D major (2 seconds)
            { f: 73.42, d: 2.0, t: 8.0 },       // D2
        ];

        // --- HARMONY CHORDS: Sparse triad chords (triangle wave) ---
        // Only 2 notes per chord (root + third) for warm, clean sound
        const chordLoop = [
            // G major: G3 + B3
            { f: 196.00, d: 4.0, t: 0.0 },      // G3
            { f: 246.94, d: 4.0, t: 0.0 },      // B3
            // E minor: E3 + G3
            { f: 164.81, d: 2.0, t: 4.0 },      // E3
            { f: 196.00, d: 2.0, t: 4.0 },      // G3
            // C major: C3 + E3
            { f: 130.81, d: 2.0, t: 6.0 },      // C3
            { f: 164.81, d: 2.0, t: 6.0 },      // E3
            // D major: D3 + A3
            { f: 146.83, d: 2.0, t: 8.0 },      // D3
            { f: 220.00, d: 2.0, t: 8.0 },      // A3
        ];

        // --- SPARKLE NOTES: Barely-there high notes (sine wave, very quiet) ---
        // Only 2 sparkles total, extremely subtle
        const sparkleLoop = [
            { f: 783.99, t: 2.0, d: 1.0 },      // G5 - gentle shimmer
            { f: 987.77, t: 6.0, d: 1.0 },      // D6 - mid shimmer
        ];

        // === SCHEDULE LOOP FUNCTION ===
        function scheduleLoop() {
            if (currentStage !== 6) return; // Stop if no longer playing celebration music

            const now = audioCtx.currentTime;
            const loopStart = now;

            // Schedule melody (triangle wave, warm and smooth)
            melodyLoop.forEach((note) => {
                const noteTime = loopStart + note.t;
                if (noteTime < now) return;
                if (noteTime > now + loopSeconds) return;

                // Main melody - triangle wave for warmth
                playNote(note.f, note.d, 'triangle', 0.16, newMasterGain, noteTime);
            });

            // Schedule bass (sine wave, warm and deep)
            bassLoop.forEach((note) => {
                const noteTime = loopStart + note.t;
                if (noteTime < now) return;
                if (noteTime > now + loopSeconds) return;

                playNote(note.f, note.d, 'sine', 0.10, newMasterGain, noteTime);
            });

            // Schedule harmony chords (triangle wave, gentle)
            chordLoop.forEach((note) => {
                const noteTime = loopStart + note.t;
                if (noteTime < now) return;
                if (noteTime > now + loopSeconds) return;

                playNote(note.f, note.d, 'triangle', 0.04, newMasterGain, noteTime);
            });

            // Schedule sparkle notes (high square wave, very subtle)
            sparkleLoop.forEach((note) => {
                const noteTime = loopStart + note.t;
                if (noteTime < now) return;
                if (noteTime > now + loopSeconds) return;

                playNote(note.f, note.d, 'square', 0.015, newMasterGain, noteTime);
            });
        }

        // Schedule the first loop immediately
        scheduleLoop();

        // Then loop every 10 seconds
        celebrationSongInterval = setInterval(() => {
            scheduleLoop();
        }, loopDuration);

        // Store interval reference for cleanup
        currentMusicNodes.push({ type: 'interval', id: celebrationSongInterval });
    }

    /**
     * ==========================================
     * CROSSFADE SYSTEM
     * ==========================================
     */

    /**
     * Fade out a gain node to silence and disconnect it
     */
    function fadeOutGainNode(gainNode, duration = fadeOutDuration) {
        if (!audioCtx || !gainNode) return;

        const now = audioCtx.currentTime;

        // Cancel any existing scheduled values
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.linearRampToValueAtTime(0, now + duration);

        // Schedule disconnection after fade completes
        const timeout = setTimeout(() => {
            try {
                gainNode.disconnect();
            } catch (e) {
                // Node may already be disconnected
            }
        }, duration * 1000 + 100);
    }

    /**
     * ==========================================
     * STAGE MUSIC
     * ==========================================
     */

    function fadeOutMusic(duration = 300) {
        if (!masterGainNode || !audioCtx) return;

        const now = audioCtx.currentTime;
        masterGainNode.gain.setValueAtTime(masterGainNode.gain.value, now);
        masterGainNode.gain.linearRampToValueAtTime(0, now + duration / 1000);
    }

    /**
     * Start intro music (slow, ambient pad version)
     */
    function startIntroMusic() {
        if (!audioCtx || currentStage === 0) return;
        resumeContext();

        // Clear any existing intro music interval to prevent duplicates
        if (introMusicInterval) {
            clearInterval(introMusicInterval);
            introMusicInterval = null;
        }

        currentStage = 0;

        // Create new master gain for this stage
        const newMasterGain = audioCtx.createGain();
        newMasterGain.gain.setValueAtTime(0, audioCtx.currentTime);
        newMasterGain.connect(audioCtx.destination);

        // Fade in the new gain node (no crossfade)
        newMasterGain.gain.setValueAtTime(0, audioCtx.currentTime);
        newMasterGain.gain.linearRampToValueAtTime(1, audioCtx.currentTime + fadeInDuration);

        // Update current master gain (no previous gain tracking needed)
        currentMasterGain = newMasterGain;

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
            // Melody (triangle wave for softer sound, longer sustain) - connect to masterGain for crossfading
            playNote(freq, noteDuration * 1.5, 'triangle', 0.06, newMasterGain);
            // Delayed echo for ambient effect
            setTimeout(() => {
                playNote(freq * 0.998, noteDuration * 0.7, 'triangle', 0.025, newMasterGain);
            }, 300);
            // Bass (triangle wave, longer sustain) - connect to masterGain for crossfading
            playNote(bassNotes[noteIndex % bassNotes.length], noteDuration * 1.2, 'triangle', 0.05, newMasterGain);
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
     * Start Stage 1 music - "Zombie Horror Movie Theme"
     * A simplified spooky horror-zombie chiptune theme with:
     * - Eerie main melody in minor/diminished scale
     * - Deep bass drone for atmosphere
     * - Periodic zombie groan sound effects
     * - Rhythmic heartbeat pulse
     * - Occasional horror "stinger" notes for jump-scare effect
     */
    function startStage1Music() {
        if (!audioCtx || currentStage === 1) return;
        resumeContext();

        // Clean up previous stage's resources (clears intervals and old notes)
        cleanupPreviousStage();
        currentStage = 1;

        // Create new master gain for this stage
        const newMasterGain = audioCtx.createGain();
        newMasterGain.gain.setValueAtTime(0, audioCtx.currentTime);
        newMasterGain.connect(audioCtx.destination);

        // Fade in the new gain node (no crossfade)
        newMasterGain.gain.setValueAtTime(0, audioCtx.currentTime);
        newMasterGain.gain.linearRampToValueAtTime(1, audioCtx.currentTime + fadeInDuration);

        // Update current master gain (no previous gain tracking needed)
        currentMasterGain = newMasterGain;

        // ==========================================
        // HORIZONTAL SHIFTS (chord progression)
        // ==========================================
        // E minor with horror elements:
        // Em -> C -> G -> D (cyclical progression)
        // Each shift = 2 seconds, loop repeats

        // ==========================================
        // MAIN MELODY - Eerie minor-key chiptune
        // ==========================================
        // Notes use E natural minor + diminished intervals for horror feel
        const melodyLoop = [
            // Measure 1 (E minor)
            { freq: 329.63, time: 0, dur: 0.5 },    // E4 (root)
            { freq: 0, time: 0.5, dur: 0.05 },      // rest
            { freq: 392.00, time: 0.55, dur: 0.25 }, // G4 (minor third)
            { freq: 466.16, time: 0.85, dur: 0.25 }, // Bb4 (diminished - horror note!)
            { freq: 440.00, time: 1.15, dur: 0.5 },  // A4 (back to safety)
            { freq: 0, time: 1.65, dur: 0.05 },      // rest

            // Measure 2 (C major)
            { freq: 523.25, time: 1.75, dur: 0.5 },  // C5
            { freq: 493.88, time: 2.25, dur: 0.25 }, // B4
            { freq: 440.00, time: 2.55, dur: 0.5 },  // A4
            { freq: 0, time: 3.05, dur: 0.05 },      // rest

            // Measure 3 (G major)
            { freq: 392.00, time: 3.15, dur: 0.35 }, // G4
            { freq: 440.00, time: 3.55, dur: 0.25 }, // A4
            { freq: 466.16, time: 3.85, dur: 0.15 }, // Bb4 (again, horror tension)
            { freq: 493.88, time: 4.05, dur: 0.5 },  // B4

            // Measure 4 (D major) - build tension
            { freq: 587.33, time: 4.55, dur: 0.25 }, // D5
            { freq: 523.25, time: 4.85, dur: 0.25 }, // C5
            { freq: 493.88, time: 5.15, dur: 0.25 }, // B4
            { freq: 440.00, time: 5.45, dur: 0.5 },  // A4

            // Resolve back to start
            { freq: 329.63, time: 5.95, dur: 0.5 },  // E4 (home!)
            { freq: 0, time: 6.45, dur: 0.55 },      // long rest
        ];

        const melodyLoopDuration = 7.0;

        // ==========================================
        // COUNTER-MELODY - Answers the main melody
        // ==========================================
        const counterMelodyLoop = [
            // Measure 1 - low, sparse
            { freq: 164.81, time: 0, dur: 0.8 },     // E5 (high harmony)
            { freq: 0, time: 1.0, dur: 0.75 },

            // Measure 2
            { freq: 131.87, time: 1.75, dur: 0.8 },  // C5
            { freq: 0, time: 2.55, dur: 0.5 },
            { freq: 146.83, time: 3.15, dur: 0.8 },  // D5
            { freq: 0, time: 4.05, dur: 0.5 },
            { freq: 146.83, time: 4.55, dur: 0.4 },  // D5
            { freq: 0, time: 5.0, dur: 0.95 },

            // Measure 3
            { freq: 131.87, time: 5.95, dur: 0.8 },  // C5
            { freq: 0, time: 6.75, dur: 0.25 },
        ];
        const counterMelodyDuration = 7.0;

        // ==========================================
        // BASS LINE - Deep, sustained
        // ==========================================
        const bassLoop = [
            { freq: 82.41, time: 0, dur: 1.75 },     // E2 (Em)
            { freq: 65.41, time: 1.75, dur: 1.75 },  // C2 (C major)
            { freq: 98.00, time: 3.5, dur: 1.75 },   // G2 (G major)
            { freq: 73.42, time: 5.25, dur: 1.75 },  // D2 (D major)
        ];
        const bassLoopDuration = 7.0;

        // ==========================================
        // SCHEDULE LOOP FUNCTIONS
        // ==========================================

        function scheduleMelodyLoop() {
            if (currentStage !== 1) return;

            const now = audioCtx.currentTime;
            const loopStart = now;

            // Schedule main melody
            for (let loop = 0; loop < 2; loop++) { // Schedule 2 loops ahead
                for (let i = 0; i < melodyLoop.length; i++) {
                    const note = melodyLoop[i];
                    const noteTime = loopStart + loop * melodyLoopDuration + note.time;
                    if (noteTime < now) continue;
                    if (noteTime > now + 2) continue; // Don't schedule too far ahead

                    if (note.freq > 0) {
                        // Square wave for eerie chiptune melody
                        const osc = audioCtx.createOscillator();
                        const gain = audioCtx.createGain();
                        const filter = audioCtx.createBiquadFilter();

                        osc.type = 'square';
                        osc.frequency.setValueAtTime(note.freq * 0.97, noteTime); // Slightly lower pitch

                        // Filter to muffle slightly for horror atmosphere
                        filter.type = 'lowpass';
                        filter.frequency.setValueAtTime(2500, noteTime);
                        filter.Q.setValueAtTime(1.0, noteTime);

                        // Envelope
                        gain.gain.setValueAtTime(0, noteTime);
                        gain.gain.linearRampToValueAtTime(0.10, noteTime + 0.01);
                        gain.gain.setValueAtTime(0.07, noteTime + note.dur * 0.5);
                        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + note.dur);

                        osc.connect(filter);
                        filter.connect(gain);
                        gain.connect(newMasterGain);
                        osc.start(noteTime);
                        osc.stop(noteTime + note.dur + 0.01);
                        currentMusicNodes.push({ osc, gain, filter });
                    }
                }
            }

            // Schedule counter-melody (softer, triangle wave for different timbre)
            for (let loop = 0; loop < 2; loop++) {
                for (let i = 0; i < counterMelodyLoop.length; i++) {
                    const note = counterMelodyLoop[i];
                    const noteTime = loopStart + loop * counterMelodyDuration + note.time;
                    if (noteTime < now) continue;
                    if (noteTime > now + 2) continue;

                    if (note.freq > 0) {
                        const osc = audioCtx.createOscillator();
                        const gain = audioCtx.createGain();

                        osc.type = 'triangle';
                        osc.frequency.setValueAtTime(note.freq, noteTime);

                        gain.gain.setValueAtTime(0, noteTime);
                        gain.gain.linearRampToValueAtTime(0.05, noteTime + 0.02);
                        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + note.dur);

                        osc.connect(gain);
                        gain.connect(newMasterGain);
                        osc.start(noteTime);
                        osc.stop(noteTime + note.dur + 0.01);
                        currentMusicNodes.push({ osc, gain });
                    }
                }
            }

            // Schedule bass (deep sine wave)
            for (let loop = 0; loop < 2; loop++) {
                for (let i = 0; i < bassLoop.length; i++) {
                    const note = bassLoop[i];
                    const noteTime = loopStart + loop * bassLoopDuration + note.time;
                    if (noteTime < now) continue;
                    if (noteTime > now + 2) continue;

                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();

                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(note.freq, noteTime);

                    gain.gain.setValueAtTime(0, noteTime);
                    gain.gain.linearRampToValueAtTime(0.13, noteTime + 0.05);
                    gain.gain.setValueAtTime(0.10, noteTime + note.dur * 0.7);
                    gain.gain.exponentialRampToValueAtTime(0.001, noteTime + note.dur);

                    osc.connect(gain);
                    gain.connect(newMasterGain);
                    osc.start(noteTime);
                    osc.stop(noteTime + note.dur + 0.01);
                    currentMusicNodes.push({ osc, gain });
                }
            }

            melodyInterval = setTimeout(scheduleMelodyLoop, melodyLoopDuration * 1000);
        }

        scheduleMelodyLoop();

        // ==========================================
        // ZOMBIE GROANS - Periodic eerie sounds
        // ==========================================
        function scheduleGroan() {
            if (currentStage !== 1) return;

            const now = audioCtx.currentTime;
            const duration = 0.4 + Math.random() * 0.5;
            const startFreq = 50 + Math.random() * 20;
            const endFreq = startFreq * 0.65;

            const groanOsc = audioCtx.createOscillator();
            const groanGain = audioCtx.createGain();
            const groanFilter = audioCtx.createBiquadFilter();

            groanOsc.type = 'sawtooth';
            groanOsc.frequency.setValueAtTime(startFreq, now);
            groanOsc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);

            groanFilter.type = 'lowpass';
            groanFilter.frequency.setValueAtTime(250, now);
            groanFilter.Q.setValueAtTime(4, now);

            groanGain.gain.setValueAtTime(0, now);
            groanGain.gain.linearRampToValueAtTime(0.08, now + 0.03);
            groanGain.gain.setValueAtTime(0.065, now + duration * 0.6);
            groanGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            groanOsc.connect(groanFilter);
            groanFilter.connect(groanGain);
            groanGain.connect(newMasterGain);
            groanOsc.start(now);
            groanOsc.stop(now + duration + 0.01);
            currentMusicNodes.push({ osc: groanOsc, gain: groanGain, filter: groanFilter });

            // Next groan in 3-6 seconds
            const nextGroan = 3000 + Math.random() * 3000;
            const groanTimeout = setTimeout(scheduleGroan, nextGroan);
            scheduledTimeouts.push(groanTimeout);
        }
        const firstGroanTimeout = setTimeout(scheduleGroan, 2500);
        scheduledTimeouts.push(firstGroanTimeout);

        // ==========================================
        // HEARTBEAT - Rhythmic pulse underneath
        // ==========================================
        function startHeartbeat() {
            const baseBPM = 68;
            const beatInterval = 60 / baseBPM;

            function beat() {
                if (currentStage !== 1) return;
                const now = audioCtx.currentTime;

                // First thump
                const osc1 = audioCtx.createOscillator();
                const gain1 = audioCtx.createGain();
                osc1.type = 'sine';
                osc1.frequency.setValueAtTime(55, now);
                gain1.gain.setValueAtTime(0, now);
                gain1.gain.linearRampToValueAtTime(0.20, now + 0.003);
                gain1.gain.exponentialRampToValueAtTime(0.001, now + beatInterval * 0.35);
                osc1.connect(gain1);
                gain1.connect(newMasterGain);
                osc1.start(now);
                osc1.stop(now + beatInterval * 0.35 + 0.01);
                currentMusicNodes.push({ osc: osc1, gain: gain1 });

                // Second thump (slightly later, softer)
                const secondBeatDelay = beatInterval * 0.3;
                const osc2 = audioCtx.createOscillator();
                const gain2 = audioCtx.createGain();
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(50, now + secondBeatDelay);
                gain2.gain.setValueAtTime(0, now + secondBeatDelay);
                gain2.gain.linearRampToValueAtTime(0.13, now + secondBeatDelay + 0.003);
                gain2.gain.exponentialRampToValueAtTime(0.001, now + secondBeatDelay + beatInterval * 0.2);
                osc2.connect(gain2);
                gain2.connect(newMasterGain);
                osc2.start(now + secondBeatDelay);
                osc2.stop(now + secondBeatDelay + beatInterval * 0.2 + 0.01);
                currentMusicNodes.push({ osc: osc2, gain: gain2 });

                const beatTimeout = setTimeout(beat, beatInterval * 1000);
                scheduledTimeouts.push(beatTimeout);
            }
            beat();
        }
        startHeartbeat();

        // ==========================================
        // HORROR STINGER NOTES - Occasional dissonant "jump-scare"
        // ==========================================
        function scheduleStinger() {
            if (currentStage !== 1) return;

            const now = audioCtx.currentTime;
            const stingerDelay = 8000 + Math.random() * 15000; // Every 8-23 seconds

            const stingerTimeout = setTimeout(() => {
                if (currentStage !== 1) return;

                const stingerFreqs = [
                    [277.18, 311.13],  // B4 + Db5 (tritone - classic horror interval!)
                    [233.08, 261.63],  // Bb3 + C5 (minor second - dissonant!)
                    [293.66, 329.63],  // D4 + E4 (minor second)
                    [220.00, 246.94],  // A4 + B4 (minor second)
                ];
                const stinger = stingerFreqs[Math.floor(Math.random() * stingerFreqs.length)];

                // High screech
                const osc1 = audioCtx.createOscillator();
                const gain1 = audioCtx.createGain();
                osc1.type = 'sawtooth';
                osc1.frequency.setValueAtTime(stinger[0], now);
                osc1.frequency.exponentialRampToValueAtTime(stinger[1], now + 0.3);
                gain1.gain.setValueAtTime(0, now);
                gain1.gain.linearRampToValueAtTime(0.06, now + 0.01);
                gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
                osc1.connect(gain1);
                gain1.connect(newMasterGain);
                osc1.start(now);
                osc1.stop(now + 0.51);
                currentMusicNodes.push({ osc: osc1, gain: gain1 });

                // Low rumble
                const osc2 = audioCtx.createOscillator();
                const gain2 = audioCtx.createGain();
                osc2.type = 'sawtooth';
                osc2.frequency.setValueAtTime(stinger[0] / 4, now);
                osc2.frequency.exponentialRampToValueAtTime(stinger[1] / 4, now + 0.4);
                gain2.gain.setValueAtTime(0, now);
                gain2.gain.linearRampToValueAtTime(0.08, now + 0.01);
                gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
                const rumbleFilter = audioCtx.createBiquadFilter();
                rumbleFilter.type = 'lowpass';
                rumbleFilter.frequency.setValueAtTime(400, now);
                osc2.connect(rumbleFilter);
                rumbleFilter.connect(gain2);
                gain2.connect(newMasterGain);
                osc2.start(now);
                osc2.stop(now + 0.41);
                currentMusicNodes.push({ osc: osc2, gain: gain2, filter: rumbleFilter });

                const nextStingerTimeout = setTimeout(scheduleStinger, stingerDelay);
                scheduledTimeouts.push(nextStingerTimeout);
            }, stingerDelay);
            scheduledTimeouts.push(stingerTimeout);
        }
        const firstStingerTimeout = setTimeout(scheduleStinger, 10000); // First stinger after 10 seconds
        scheduledTimeouts.push(firstStingerTimeout);
    }

    /**
     * Start Stage 2 audio - "Moonlit Waltz" (Option F)
     * A graceful waltz pattern with alternating bass notes (oom-pah) and
     * a lyrical melody above. Romantic ballroom feel — elegant, flowing,
     * and timeless under moonlight.
     * 12-second loop, 3/4 time signature with bass & melody
     */
    function startStage2Music() {
        if (!audioCtx || currentStage === 2) return;
        resumeContext();

        // Clean up previous stage's resources (clears intervals and old notes)
        cleanupPreviousStage();
        currentStage = 2;

        // Create new master gain for this stage
        const newMasterGain = audioCtx.createGain();
        newMasterGain.gain.setValueAtTime(0, audioCtx.currentTime);
        newMasterGain.connect(audioCtx.destination);

        // Fade in the new gain node (no crossfade)
        newMasterGain.gain.setValueAtTime(0, audioCtx.currentTime);
        newMasterGain.gain.linearRampToValueAtTime(1, audioCtx.currentTime + fadeInDuration);

        // Update current master gain (no previous gain tracking needed)
        currentMasterGain = newMasterGain;

        const loopDuration = 12;

        // Waltz pattern: bass note on beat 1, chord on beats 2 & 3
        // Progression: C → Am → F → G (each chord = 3 beats, 4 chords = 12 beats = 12 seconds at 1 beat/sec)
        const waltzChords = [
            { bass: 130.81, chord: [196.00, 261.63, 329.63] },  // C: C3 → (G3+C4+E4)
            { bass: 110.00, chord: [164.81, 220.00, 261.63] },  // Am: A3 → (E4+A4+C5)
            { bass: 65.41,  chord: [98.00, 130.81, 174.61] },   // F: C2 → (G3+C4+F4)
            { bass: 98.00,  chord: [146.83, 196.00, 246.94] },  // G: G2 → (D4+G4+B3)
        ];

        function scheduleWaltz() {
            if (currentStage !== 2) return;

            const now = audioCtx.currentTime;

            waltzChords.forEach((chord, i) => {
                const beatTime = now + i * 3.0;

                // Bass note (beat 1) - "oom"
                const bassOsc = audioCtx.createOscillator();
                const bassGain = audioCtx.createGain();
                bassOsc.type = 'sine';
                bassOsc.frequency.setValueAtTime(chord.bass, beatTime);
                bassGain.gain.setValueAtTime(0, beatTime);
                bassGain.gain.linearRampToValueAtTime(0.06, beatTime + 0.02);
                bassGain.gain.exponentialRampToValueAtTime(0.001, beatTime + 2.5);
                bassOsc.connect(bassGain);
                bassGain.connect(newMasterGain);
                bassOsc.start(beatTime);
                bassOsc.stop(beatTime + 2.6);
                currentMusicNodes.push({ osc: bassOsc, gain: bassGain });

                // Chord on beats 2 & 3 - "pah"
                chord.chord.forEach(freq => {
                    // Beat 2
                    const chordOsc2 = audioCtx.createOscillator();
                    const chordGain2 = audioCtx.createGain();
                    chordOsc2.type = 'triangle';
                    chordOsc2.frequency.setValueAtTime(freq, beatTime + 1.0);
                    chordGain2.gain.setValueAtTime(0, beatTime + 1.0);
                    chordGain2.gain.linearRampToValueAtTime(0.025, beatTime + 1.05);
                    chordGain2.gain.exponentialRampToValueAtTime(0.001, beatTime + 2.0);
                    chordOsc2.connect(chordGain2);
                    chordGain2.connect(newMasterGain);
                    chordOsc2.start(beatTime + 1.0);
                    chordOsc2.stop(beatTime + 2.1);
                    currentMusicNodes.push({ osc: chordOsc2, gain: chordGain2 });

                    // Beat 3
                    const chordOsc3 = audioCtx.createOscillator();
                    const chordGain3 = audioCtx.createGain();
                    chordOsc3.type = 'triangle';
                    chordOsc3.frequency.setValueAtTime(freq, beatTime + 2.0);
                    chordGain3.gain.setValueAtTime(0, beatTime + 2.0);
                    chordGain3.gain.linearRampToValueAtTime(0.025, beatTime + 2.05);
                    chordGain3.gain.exponentialRampToValueAtTime(0.001, beatTime + 3.0);
                    chordOsc3.connect(chordGain3);
                    chordGain3.connect(newMasterGain);
                    chordOsc3.start(beatTime + 2.0);
                    chordOsc3.stop(beatTime + 3.1);
                    currentMusicNodes.push({ osc: chordOsc3, gain: chordGain3 });
                });
            });

            // Melody: lyrical waltz melody over the accompaniment
            const melodyNotes = [
                { time: 0.5,  freq: 523.25, dur: 2.0 },   // C5 - "the first note"
                { time: 3.5,  freq: 587.33, dur: 1.5 },   // D5
                { time: 5.5,  freq: 523.25, dur: 2.0 },   // C5 (return)
                { time: 8.0,  freq: 440.00, dur: 2.5 },   // A4
                { time: 10.5, freq: 392.00, dur: 2.0 },   // G4 (resolve)
            ];

            melodyNotes.forEach(note => {
                const noteTime = now + note.time;
                if (noteTime < now) return;

                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(note.freq, noteTime);

                gain.gain.setValueAtTime(0, noteTime);
                gain.gain.linearRampToValueAtTime(0.08, noteTime + 0.04);
                gain.gain.setValueAtTime(0.06, noteTime + note.dur * 0.6);
                gain.gain.exponentialRampToValueAtTime(0.001, noteTime + note.dur);

                // Lowpass filter for piano-like warmth
                const filter = audioCtx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(2500, noteTime);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(newMasterGain);
                osc.start(noteTime);
                osc.stop(noteTime + note.dur + 0.01);
                currentMusicNodes.push({ osc, gain });
            });

            // Schedule next loop
            const nextLoop = setTimeout(scheduleWaltz, loopDuration * 1000);
            currentMusicNodes.push({ type: 'timeout', id: nextLoop });
        }

        scheduleWaltz();
    }

    /**
     * Create a clicky-clacky keyboard keypress sound
     * Sharper transient, louder volume, more high-frequency content
     */
    function createKeyPress(volume = 0.15, pitch = 2500, destination = null) {
        if (!audioCtx) return null;

        const now = audioCtx.currentTime;
        const group = [];

        // === SHARP CLICK TRANSIENT (very short, bright) ===
        const clickDuration = 0.004 + Math.random() * 0.004;
        const bufferSize = audioCtx.sampleRate * clickDuration;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            const envelope = Math.pow(1 - i / bufferSize, 3);
            data[i] = (Math.random() * 2 - 1) * envelope;
        }

        const clickSource = audioCtx.createBufferSource();
        clickSource.buffer = buffer;

        // High-pass filter for bright, sharp click
        const clickFilter = audioCtx.createBiquadFilter();
        clickFilter.type = 'highpass';
        clickFilter.frequency.value = pitch + Math.random() * 1500;
        clickFilter.Q.value = 0.7;

        const clickGain = audioCtx.createGain();
        clickGain.gain.setValueAtTime(volume, now);
        clickGain.gain.exponentialRampToValueAtTime(0.001, now + clickDuration);

        clickSource.connect(clickFilter);
        clickFilter.connect(clickGain);
        clickGain.connect(destination || masterGainNode);
        clickSource.start(now);
        group.push({ source: clickSource, gain: clickGain });

        // === SECOND CLICK LAYER (slightly delayed for mechanical depth) ===
        const click2Delay = 0.002 + Math.random() * 0.003;
        const click2Duration = clickDuration * 0.8;
        const bufferSize2 = audioCtx.sampleRate * click2Duration;
        const buffer2 = audioCtx.createBuffer(1, bufferSize2, audioCtx.sampleRate);
        const data2 = buffer2.getChannelData(0);
        for (let i = 0; i < bufferSize2; i++) {
            const envelope = Math.pow(1 - i / bufferSize2, 2);
            data2[i] = (Math.random() * 2 - 1) * envelope;
        }

        const clickSource2 = audioCtx.createBufferSource();
        clickSource2.buffer = buffer2;

        const clickFilter2 = audioCtx.createBiquadFilter();
        clickFilter2.type = 'bandpass';
        clickFilter2.frequency.value = pitch * 0.6 + Math.random() * 800;
        clickFilter2.Q.value = 2;

        const clickGain2 = audioCtx.createGain();
        clickGain2.gain.setValueAtTime(volume * 0.6, now + click2Delay);
        clickGain2.gain.exponentialRampToValueAtTime(0.001, now + click2Delay + click2Duration);

        clickSource2.connect(clickFilter2);
        clickFilter2.connect(clickGain2);
        clickGain2.connect(destination || masterGainNode);
        clickSource2.start(now + click2Delay);
        group.push({ source: clickSource2, gain: clickGain2 });

        // === LOW "THOCK" (key bottom-out body) ===
        const tonalDuration = 0.05 + Math.random() * 0.02;
        const tonalOsc = audioCtx.createOscillator();
        const tonalGain = audioCtx.createGain();
        tonalOsc.type = 'sine';
        tonalOsc.frequency.setValueAtTime(300 + Math.random() * 200, now);
        tonalGain.gain.setValueAtTime(volume * 0.5, now);
        tonalGain.gain.exponentialRampToValueAtTime(0.001, now + tonalDuration);

        tonalOsc.connect(tonalGain);
        tonalGain.connect(destination || masterGainNode);
        tonalOsc.start(now);
        tonalOsc.stop(now + tonalDuration + 0.01);
        group.push({ osc: tonalOsc, gain: tonalGain });

        return group;
    }

    /**
     * Start Stage 3 audio - Realistic keyboard typing loop
     * Simulates someone typing a message with natural rhythm and variation
     */
    function startStage3Music() {
        if (!audioCtx || currentStage === 3) return;
        resumeContext();

        // Clean up previous stage's resources (clears intervals and old notes)
        cleanupPreviousStage();
        currentStage = 3;

        // Create new master gain for this stage
        const newMasterGain = audioCtx.createGain();
        newMasterGain.gain.setValueAtTime(0, audioCtx.currentTime);
        newMasterGain.connect(audioCtx.destination);

        // Fade in the new gain node (no crossfade)
        newMasterGain.gain.setValueAtTime(0, audioCtx.currentTime);
        newMasterGain.gain.linearRampToValueAtTime(1, audioCtx.currentTime + fadeInDuration);

        // Update current master gain (no previous gain tracking needed)
        currentMasterGain = newMasterGain;

        // Natural typing pattern configuration
        // Word lengths weighted toward common English word lengths (2-7 letters)
        const wordLengthWeights = [
            2, 2,  // short words (a, I, oh)
            3, 3, 3,  // common (the, and, for)
            4, 4, 4, 4,  // most common (that, with, this)
            5, 5, 5,  // medium (every, where, what)
            6, 6,  // longer (around, behind)
            7,  // longest (another, never)
        ];
        // Timing ranges in ms
        const interClickMin = 100;
        const interClickMax = 200;       // Within a word (letters) - slower for natural feel
        const interWordMin = 400;
        const interWordMax = 800;        // Between words in a phrase
        const interPhraseMin = 1200;
        const interPhraseMax = 3500;     // Between phrases
        const cycleEndMin = 1500;
        const cycleEndMax = 4000;        // End of full cycle
        const jitterAmount = 20;          // Random timing variation for organic feel

        // Helper: random integer in range [min, max]
        function randomInt(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        // Helper: random float in range [min, max]
        function randomFloat(min, max) {
            return Math.random() * (max - min) + min;
        }

        // Generate a natural typing event sequence for one cycle
        function generateTypingPattern() {
            const events = [];
            let lastEventType = 'none'; // track what we just added

            // Each cycle has 2-4 phrases
            const numPhrases = randomInt(2, 4);

            for (let p = 0; p < numPhrases; p++) {
                // Each phrase has 2-6 words
                const numWords = randomInt(2, 6);

                for (let w = 0; w < numWords; w++) {
                    // Pick word length from weighted distribution
                    const wordLength = wordLengthWeights[Math.floor(Math.random() * wordLengthWeights.length)];

                    // Add clicks for this word
                    for (let c = 0; c < wordLength; c++) {
                        if (c > 0 || w > 0 || p > 0 || events.length > 0) {
                            // Inter-click timing within/between words
                            let clickDelay;
                            if (c > 0) {
                                // Within same word - faster
                                clickDelay = randomFloat(interClickMin, interClickMax);
                            } else if (w > 0) {
                                // Between words in same phrase
                                clickDelay = randomFloat(interWordMin, interWordMax);
                            } else {
                                // Between phrases
                                clickDelay = randomFloat(interPhraseMin, interPhraseMax);
                            }
                            // Add jitter for organic feel
                            clickDelay += (Math.random() * 2 - 1) * jitterAmount;
                            events.push({ type: 'pause', delay: Math.max(10, clickDelay) });
                        }
                        events.push({ type: 'click', delay: 0 });
                        lastEventType = 'click';
                    }

                    // Small pause between words (if not last word)
                    if (w < numWords - 1) {
                        const wordPause = randomFloat(interWordMin, interWordMax);
                        events.push({ type: 'pause', delay: wordPause + (Math.random() * 2 - 1) * jitterAmount });
                    }
                }

                // Pause between phrases (if not last phrase)
                if (p < numPhrases - 1) {
                    const phrasePause = randomFloat(interPhraseMin, interPhraseMax);
                    events.push({ type: 'pause', delay: phrasePause + (Math.random() * 2 - 1) * jitterAmount });
                }
            }

            // End of cycle pause
            const cycleEndPause = randomFloat(cycleEndMin, cycleEndMax);
            events.push({ type: 'pause', delay: cycleEndPause + (Math.random() * 2 - 1) * jitterAmount });

            return events;
        }

        // Generate a fresh natural typing pattern
        const typingPattern = generateTypingPattern();

        // Build cumulative timestamps
        const events = [];
        let cumulativeTime = 0;
        for (const entry of typingPattern) {
            cumulativeTime += entry.delay;
            events.push({ type: entry.type, time: cumulativeTime });
        }

        const totalCycleDuration = cumulativeTime + 100; // small buffer
        let eventIndex = 0;
        let lastTriggerTime = 0;

        typingInterval = setInterval(() => {
            const now = performance.now();

            // Fire all events that are due
            while (eventIndex < events.length) {
                const event = events[eventIndex];
                if (now - lastTriggerTime >= event.time) {
                    if (event.type === 'click') {
                        const pitchVariation = 2200 + Math.random() * 1300;
                        const volumeVariation = 0.13 + Math.random() * 0.07;
                        createKeyPress(volumeVariation, pitchVariation, newMasterGain);
                    }
                    eventIndex++;
                } else {
                    break;
                }
            }

            // Reset cycle when complete
            if (eventIndex >= events.length) {
                eventIndex = 0;
                lastTriggerTime = now;
            }
        }, 20);

        currentMusicNodes.push({ type: 'interval', id: typingInterval });
    }

    /**
     * Start Stage 4 music - 8-bit video game music
     */
    function startStage4Music() {
        if (!audioCtx || currentStage === 4) return;
        resumeContext();

        // Clean up previous stage's resources (clears intervals and old notes)
        cleanupPreviousStage();
        currentStage = 4;

        // Create new master gain for this stage
        const newMasterGain = audioCtx.createGain();
        newMasterGain.gain.setValueAtTime(0, audioCtx.currentTime);
        newMasterGain.connect(audioCtx.destination);

        // Fade in the new gain node (no crossfade)
        newMasterGain.gain.setValueAtTime(0, audioCtx.currentTime);
        newMasterGain.gain.linearRampToValueAtTime(1, audioCtx.currentTime + fadeInDuration);

        // Update current master gain (no previous gain tracking needed)
        currentMasterGain = newMasterGain;

        // Upbeat 8-bit game music melody - connect to master gain via playNote chain
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

            // Fast melody (square wave) - connect to masterGain for crossfading
            playNote(melFreq, noteDuration * 0.8, 'square', 0.08, newMasterGain);
            // Bouncy bass (triangle wave) - connect to masterGain for crossfading
            playNote(bassFreq, noteDuration * 0.8, 'triangle', 0.07, newMasterGain);
            noteIndex++;
        }, noteDuration * 1000);

        currentMusicNodes.push({ type: 'interval', id: typingInterval });
    }

    /**
     * Magical treasure discovery sound - 8 second dreamy, ethereal chiptune sound
     * A magical, sparkling sound effect for discovering treasure:
     * - Phase 1 (0-2.5s): Soft, high-pitched twinkling notes ascending slowly
     * - Phase 2 (2.5-5.5s): Main magical melody emerges with rising arpeggios
     * - Phase 3 (5.5-8s): Bright, sustained chord progression with sparkle notes
     */
    function playMagicalTreasureSound() {
        resumeContext();

        const now = audioCtx.currentTime;

        // === PHASE 1: Magical Buildup (0-2.5s) ===
        // Soft, high-pitched twinkling notes ascending slowly
        const buildupNotes = [
            { freq: 1046.50, time: 0.0, dur: 0.4 },    // C6 - first sparkle
            { freq: 1174.66, time: 0.5, dur: 0.4 },    // D6
            { freq: 1318.51, time: 1.0, dur: 0.5 },    // E6
            { freq: 1396.00, time: 1.6, dur: 0.5 },    // F6
            { freq: 1567.98, time: 2.2, dur: 0.6 },    // G6 - reaching up
        ];

        buildupNotes.forEach((note) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(note.freq, now + note.time);

            gain.gain.setValueAtTime(0, now + note.time);
            gain.gain.linearRampToValueAtTime(0.06, now + note.time + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + note.time + note.dur);

            osc.connect(gain);
            gain.connect(masterGainNode);
            osc.start(now + note.time);
            osc.stop(now + note.time + note.dur + 0.01);
        });

        // === PHASE 2: Discovery Melody (2.5-5.5s) ===
        // Main magical melody emerges - rising arpeggio sequences
        const melodyNotes = [
            // Rising sequence 1
            { freq: 523.25, time: 2.5, dur: 0.3 },     // C5
            { freq: 659.25, time: 2.8, dur: 0.3 },     // E5
            { freq: 783.99, time: 3.1, dur: 0.4 },     // G5
            { freq: 1046.50, time: 3.5, dur: 0.5 },    // C6 - discovery!
            // Rising sequence 2 (higher)
            { freq: 659.25, time: 4.0, dur: 0.3 },     // E5
            { freq: 783.99, time: 4.3, dur: 0.3 },     // G5
            { freq: 987.77, time: 4.6, dur: 0.4 },     // B5
            { freq: 1318.51, time: 5.0, dur: 0.6 },    // E6 - higher discovery!
        ];

        melodyNotes.forEach((note) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(note.freq, now + note.time);

            gain.gain.setValueAtTime(0, now + note.time);
            gain.gain.linearRampToValueAtTime(0.08, now + note.time + 0.015);
            gain.gain.setValueAtTime(0.06, now + note.time + note.dur * 0.5);
            gain.gain.exponentialRampToValueAtTime(0.001, now + note.time + note.dur);

            osc.connect(gain);
            gain.connect(masterGainNode);
            osc.start(now + note.time);
            osc.stop(now + note.time + note.dur + 0.01);
        });

        // Harmony layer for melody (triangle wave for warmth)
        const harmonyNotes = [
            { freq: 783.99, time: 2.5, dur: 0.5 },     // G5
            { freq: 1046.50, time: 3.5, dur: 0.6 },    // C6
            { freq: 987.77, time: 4.0, dur: 0.5 },     // B5
            { freq: 1318.51, time: 5.0, dur: 0.7 },    // E6
        ];

        harmonyNotes.forEach((note) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(note.freq, now + note.time);

            gain.gain.setValueAtTime(0, now + note.time);
            gain.gain.linearRampToValueAtTime(0.04, now + note.time + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.001, now + note.time + note.dur);

            osc.connect(gain);
            gain.connect(masterGainNode);
            osc.start(now + note.time);
            osc.stop(now + note.time + note.dur + 0.01);
        });

        // === PHASE 3: Treasure Reveal (5.5-8s) ===
        // Bright, sustained chord progression with sparkle notes
        const revealChords = [
            // C major chord
            { freq: 523.25, time: 5.5, dur: 1.2 },     // C5
            { freq: 659.25, time: 5.5, dur: 1.2 },     // E5
            { freq: 783.99, time: 5.5, dur: 1.2 },     // G5
            // E major chord
            { freq: 659.25, time: 6.5, dur: 1.0 },     // E5
            { freq: 783.99, time: 6.5, dur: 1.0 },     // G5
            { freq: 987.77, time: 6.5, dur: 1.0 },     // B5
            // Final C major resolution
            { freq: 523.25, time: 7.3, dur: 1.5 },     // C5
            { freq: 659.25, time: 7.3, dur: 1.5 },     // E5
            { freq: 783.99, time: 7.3, dur: 1.5 },     // G5
            { freq: 1046.50, time: 7.3, dur: 1.5 },    // C6 - final treasure note!
        ];

        revealChords.forEach((note) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(note.freq, now + note.time);

            gain.gain.setValueAtTime(0, now + note.time);
            gain.gain.linearRampToValueAtTime(0.05, now + note.time + 0.04);
            gain.gain.setValueAtTime(0.04, now + note.time + note.dur * 0.5);
            gain.gain.exponentialRampToValueAtTime(0.001, now + note.time + note.dur);

            osc.connect(gain);
            gain.connect(masterGainNode);
            osc.start(now + note.time);
            osc.stop(now + note.time + note.dur + 0.01);
        });

        // Sparkle notes - high-frequency twinkling
        const sparkleNotes = [
            { freq: 1567.98, time: 5.8, dur: 0.3 },    // G6
            { freq: 2093.00, time: 6.2, dur: 0.3 },    // C7
            { freq: 1567.98, time: 6.6, dur: 0.25 },   // G6
            { freq: 2093.00, time: 7.0, dur: 0.3 },    // C7
            { freq: 2637.02, time: 7.6, dur: 0.5 },    // E7 - final sparkle!
        ];

        sparkleNotes.forEach((note) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(note.freq, now + note.time);

            gain.gain.setValueAtTime(0, now + note.time);
            gain.gain.linearRampToValueAtTime(0.03, now + note.time + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, now + note.time + note.dur);

            osc.connect(gain);
            gain.connect(masterGainNode);
            osc.start(now + note.time);
            osc.stop(now + note.time + note.dur + 0.01);
        });

        // Deep bass note for foundation
        const bassOsc = audioCtx.createOscillator();
        const bassGain = audioCtx.createGain();
        bassOsc.type = 'sine';
        bassOsc.frequency.setValueAtTime(130.81, now + 5.5); // C3
        bassGain.gain.setValueAtTime(0, now + 5.5);
        bassGain.gain.linearRampToValueAtTime(0.08, now + 5.6);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + 8.0);
        bassOsc.connect(bassGain);
        bassGain.connect(masterGainNode);
        bassOsc.start(now + 5.5);
        bassOsc.stop(now + 8.1);
    }

    /**
     * Start treasure screen music - REMOVED (audio disabled)
     */
    function startTreasureMusic() {
        // All audio removed from treasure screen
        return;
    }

    /**
     * Start proposal screen music - ULTRA grand romantic celebratory wedding march chiptune
     * Features: sweeping melodies, lush harmonies, arpeggiated chords, counter-melodies,
     * sparkling high notes, building crescendos, and epic finale for maximum romantic impact.
     * Loops continuously with increasing grandeur and emotional depth.
     */
    function startProposalMusic() {
        if (!audioCtx || currentStage === 7) return;
        resumeContext();

        // Clean up previous stage's resources (clears intervals and old notes)
        cleanupPreviousStage();
        currentStage = 7;

        // Create new master gain for this stage
        const newMasterGain = audioCtx.createGain();
        newMasterGain.gain.setValueAtTime(0, audioCtx.currentTime);
        newMasterGain.connect(audioCtx.destination);

        // Fade in the new gain node
        newMasterGain.gain.setValueAtTime(0, audioCtx.currentTime);
        newMasterGain.gain.linearRampToValueAtTime(1, audioCtx.currentTime + fadeInDuration);

        // Update current master gain
        currentMasterGain = newMasterGain;

        // === ULTRA GRAND ROMANTIC WEDDING MARCH CHIPTUNE ===
        // Key: C major / A minor (romantic, emotional)
        // Tempo: ~110 BPM (graceful wedding march pace)
        // Structure: 24-beat loop with multiple emotional phases that build to epic climax

        // === MAIN MELODY (square wave) - sweeping romantic wedding march theme ===
        // Inspired by "Here Comes the Bride" and classic wedding march motifs
        const mainMelody = [
            // === Phase 1: "Prelude of Love" - gentle, intimate opening (6 beats) ===
            { freq: 392.00, dur: 200 },  // G4 - soft beginning
            { freq: 440.00, dur: 150 },  // A4
            { freq: 493.88, dur: 150 },  // B4
            { freq: 523.25, dur: 300 },  // C5 - gentle arrival
            { freq: 587.33, dur: 200 },  // D5 - lifting
            { freq: 523.25, dur: 200 },  // C5 - tender return

            // === Phase 2: "Love Theme Ascending" - building hope (6 beats) ===
            { freq: 523.25, dur: 150 },  // C5
            { freq: 659.25, dur: 150 },  // E5
            { freq: 783.99, dur: 200 },  // G5
            { freq: 880.00, dur: 200 },  // A5
            { freq: 783.99, dur: 150 },  // G5
            { freq: 659.25, dur: 200 },  // E5
            { freq: 523.25, dur: 200 },  // C5 - resolution

            // === Phase 3: "Wedding March" - triumphant declaration (6 beats) ===
            { freq: 783.99, dur: 250 },  // G5 - bold start
            { freq: 880.00, dur: 150 },  // A5
            { freq: 1046.50, dur: 300 }, // C6 - TRIUMPHANT!
            { freq: 987.77, dur: 200 },  // B5
            { freq: 880.00, dur: 150 },  // A5
            { freq: 783.99, dur: 200 },  // G5
            { freq: 659.25, dur: 200 },  // E5

            // === Phase 4: "Grand Finale" - epic celebration (6 beats) ===
            { freq: 523.25, dur: 150 },  // C5
            { freq: 659.25, dur: 100 },  // E5
            { freq: 783.99, dur: 100 },  // G5
            { freq: 1046.50, dur: 200 }, // C6 - PEAK!
            { freq: 1174.66, dur: 150 }, // D6
            { freq: 1318.51, dur: 150 }, // E6
            { freq: 1567.98, dur: 300 }, // G6 - GRAND CELEBRATION!
            { freq: 1046.50, dur: 200 }, // C6 - resolve down
            { freq: 1318.51, dur: 400 }, // E6 - FINAL NOTE!
        ];

        // === ROMANTIC COUNTER MELODY (triangle wave) - weaves through main melody ===
        // Creates a conversational, duet-like feel
        const counterMelody = [
            // During Phase 1: gentle fills
            { freq: 523.25, dur: 120, startBeat: 0.5 },  // C5
            { freq: 659.25, dur: 120, startBeat: 1.5 },  // E5
            { freq: 783.99, dur: 120, startBeat: 2.5 },  // G5

            // During Phase 2: more active
            { freq: 698.46, dur: 120, startBeat: 6.5 },  // F5
            { freq: 880.00, dur: 120, startBeat: 7.5 },  // A5
            { freq: 783.99, dur: 120, startBeat: 8.5 },  // G5
            { freq: 659.25, dur: 120, startBeat: 9.5 },  // E5

            // During Phase 3: triumphant response
            { freq: 880.00, dur: 150, startBeat: 12.5 }, // A5
            { freq: 1046.50, dur: 150, startBeat: 13.5 }, // C6
            { freq: 987.77, dur: 120, startBeat: 14.5 }, // B5
            { freq: 880.00, dur: 120, startBeat: 15.5 }, // A5

            // During Phase 4: epic counterpoint
            { freq: 1046.50, dur: 100, startBeat: 18.5 }, // C6
            { freq: 1174.66, dur: 100, startBeat: 19.5 }, // D6
            { freq: 1318.51, dur: 100, startBeat: 20.5 }, // E6
            { freq: 1567.98, dur: 100, startBeat: 21.5 }, // G6
        ];

        // === SECOND COUNTER MELODY (sine wave) - ethereal, dreamy layer ===
        // Adds depth and romantic atmosphere
        const secondCounterMelody = [
            // Soft pads during Phase 1
            { freq: 261.63, dur: 400, startBeat: 0 },   // C4
            { freq: 329.63, dur: 400, startBeat: 0 },   // E4
            { freq: 392.00, dur: 400, startBeat: 0 },   // G4

            // Moving during Phase 2
            { freq: 293.66, dur: 300, startBeat: 6 },   // D4
            { freq: 349.23, dur: 300, startBeat: 6 },   // F4
            { freq: 440.00, dur: 300, startBeat: 6 },   // A4

            // Richer during Phase 3
            { freq: 329.63, dur: 400, startBeat: 12 },  // E4
            { freq: 392.00, dur: 400, startBeat: 12 },  // G4
            { freq: 493.88, dur: 400, startBeat: 12 },  // B4

            // Climactic during Phase 4
            { freq: 392.00, dur: 300, startBeat: 18 },  // G4
            { freq: 493.88, dur: 300, startBeat: 18 },  // B4
            { freq: 523.25, dur: 300, startBeat: 18 },  // C5
            { freq: 659.25, dur: 300, startBeat: 18 },  // E5
        ];

        // === GRAND WALKING BASS (sine wave) - emotional foundation ===
        const grandBass = [
            // Phase 1: Gentle C foundation
            { freq: 65.41, dur: 400 },  // C2
            { freq: 65.41, dur: 200 },  // C2
            { freq: 73.42, dur: 200 },  // D2 - subtle movement
            { freq: 82.41, dur: 300 },  // E2
            { freq: 87.31, dur: 300 },  // F2
            { freq: 65.41, dur: 300 },  // C2 - resolution

            // Phase 2: Journey through relatives
            { freq: 87.31, dur: 300 },  // F2
            { freq: 87.31, dur: 100 },  // F2
            { freq: 98.00, dur: 200 },  // G2
            { freq: 110.00, dur: 200 }, // A2
            { freq: 98.00, dur: 200 },  // G2
            { freq: 87.31, dur: 200 },  // F2
            { freq: 82.41, dur: 200 },  // E2
            { freq: 65.41, dur: 200 },  // C2

            // Phase 3: Dominant build
            { freq: 98.00, dur: 300 },  // G2
            { freq: 98.00, dur: 100 },  // G2
            { freq: 110.00, dur: 200 }, // A2
            { freq: 123.47, dur: 200 }, // B2
            { freq: 130.81, dur: 300 }, // C3
            { freq: 130.81, dur: 200 }, // C3

            // Phase 4: Epic climb and resolution
            { freq: 146.83, dur: 200 }, // D3
            { freq: 164.81, dur: 200 }, // E3
            { freq: 174.61, dur: 200 }, // F3
            { freq: 196.00, dur: 200 }, // G3
            { freq: 220.00, dur: 300 }, // A3 - building!
            { freq: 261.63, dur: 300 }, // C4 - CLIMAX!
            { freq: 130.81, dur: 200 }, // C3 - back to tonic
            { freq: 130.81, dur: 300 }, // C3 - final resolution
        ];

        // === LUSH HARMONY CHORDS (triangle wave) - rich, romantic voicings ===
        // Extended chords with closer voicings for fuller sound
        const harmonyChords = [
            // Phase 1: C major with extensions
            { freqs: [392.00, 523.25, 659.25, 783.99], dur: 300, beatStart: 0 },   // G3-C4-E4-G4
            { freqs: [440.00, 587.33, 739.99, 880.00], dur: 300, beatStart: 1 },   // A3-D4-F#4-A4
            { freqs: [392.00, 523.25, 659.25], dur: 300, beatStart: 2 },   // C major

            // Phase 2: Journey through keys
            { freqs: [349.23, 440.00, 523.25, 659.25], dur: 250, beatStart: 6 },  // F major
            { freqs: [392.00, 493.88, 587.33, 739.99], dur: 250, beatStart: 7 },  // G major
            { freqs: [440.00, 523.25, 659.25, 783.99], dur: 250, beatStart: 8 },  // A minor
            { freqs: [329.63, 440.00, 523.25, 659.25], dur: 250, beatStart: 9 },  // C major

            // Phase 3: Triumphant chords
            { freqs: [392.00, 523.25, 659.25, 783.99], dur: 300, beatStart: 12 }, // G major
            { freqs: [440.00, 587.33, 698.46, 880.00], dur: 250, beatStart: 13 }, // A major
            { freqs: [523.25, 659.25, 783.99, 987.77], dur: 250, beatStart: 14 }, // C major

            // Phase 4: Epic finale chords
            { freqs: [523.25, 659.25, 783.99, 1046.50], dur: 200, beatStart: 18 }, // C major
            { freqs: [587.33, 739.99, 880.00, 1174.66], dur: 200, beatStart: 19 }, // D major
            { freqs: [659.25, 783.99, 987.77, 1318.51], dur: 200, beatStart: 20 }, // E major
            { freqs: [783.99, 987.77, 1174.66, 1567.98], dur: 200, beatStart: 21 }, // G major
            { freqs: [523.25, 659.25, 783.99, 1046.50, 1318.51], dur: 400, beatStart: 22 }, // C major EXTENDED!
            { freqs: [523.25, 659.25, 783.99, 1046.50], dur: 300, beatStart: 23 }, // C major resolution
        ];

        // === GRAND ARPEGGIOS (triangle wave) - sweeping, cascading chords ===
        const arpeggioPatterns = [
            // Phase 1: Gentle sweeps
            { notes: [523.25, 659.25, 783.99, 1046.50], beatStart: 0, speed: 100 },
            // Phase 2: More active arpeggios
            { notes: [698.46, 880.00, 1046.50, 1318.51], beatStart: 6, speed: 90 },
            { notes: [783.99, 987.77, 1174.66, 1567.98], beatStart: 8, speed: 90 },
            // Phase 3: Triumphant sweeps
            { notes: [392.00, 523.25, 783.99, 987.77, 1174.66], beatStart: 12, speed: 70 },
            { notes: [440.00, 587.33, 880.00, 1046.50, 1318.51], beatStart: 14, speed: 70 },
            // Phase 4: Epic cascading finale
            { notes: [523.25, 659.25, 783.99, 1046.50, 1318.51], beatStart: 18, speed: 60 },
            { notes: [587.33, 739.99, 880.00, 1174.66, 1567.98], beatStart: 19, speed: 60 },
            { notes: [659.25, 783.99, 987.77, 1318.51, 1567.98], beatStart: 20, speed: 50 },
            { notes: [783.99, 987.77, 1174.66, 1567.98, 1760.00, 2093.00], beatStart: 21, speed: 45 },
            { notes: [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093.00], beatStart: 22, speed: 35 }, // ULTRA GRAND SWEEP!
        ];

        // === SPARKLE NOTES (square wave) - wedding fireworks and fairy lights ===
        const celebrationSparkles = [
            // Phase 1: Gentle sparkles
            { freq: 1567.98, dur: 100 },  // G6
            { freq: 2093.00, dur: 120 },  // C6 - soft sparkle
            // Phase 2: More sparkles
            { freq: 1318.51, dur: 80 },   // E6
            { freq: 1760.00, dur: 100 },  // A6
            { freq: 2093.00, dur: 120 },  // C6
            { freq: 2637.02, dur: 120 },  // E6
            // Phase 3: Building fireworks
            { freq: 1567.98, dur: 100 },  // G6
            { freq: 1967.98, dur: 100 },  // B6
            { freq: 2093.00, dur: 120 },  // C6
            { freq: 2349.32, dur: 120 },  // D6
            { freq: 2637.02, dur: 150 },  // E6
            // Phase 4: MAJOR FIREWORKS DISPLAY!
            { freq: 2093.00, dur: 150 },  // C7 - FIREWORK!
            { freq: 2637.02, dur: 150 },  // E7 - FIREWORK!
            { freq: 3135.96, dur: 200 },  // G7 - SUPER FIREWORK!
            { freq: 2637.02, dur: 150 },  // E7
            { freq: 2349.32, dur: 120 },  // D7
            { freq: 2093.00, dur: 150 },  // C7
            { freq: 3135.96, dur: 200 },  // G7 - PEAK FIREWORK!
            { freq: 3520.00, dur: 250 },  // A7 - SUPER PEAK!
            { freq: 2637.02, dur: 200 },  // E7
            { freq: 2093.00, dur: 300 },  // C7 - grand resolution
        ];

        // === CELEBRATION CHORD BLASTS (square wave) - full orchestral hits ===
        const chordBlasts = [
            // Phase 3: First triumphant blast
            { freqs: [392.00, 523.25, 783.99], beatStart: 12, dur: 300 },
            // Phase 4: Epic finale blasts
            { freqs: [523.25, 659.25, 783.99, 1046.50], beatStart: 18, dur: 250 },
            { freqs: [587.33, 739.99, 880.00, 1174.66], beatStart: 19, dur: 250 },
            { freqs: [659.25, 783.99, 987.77, 1318.51], beatStart: 20, dur: 250 },
            { freqs: [783.99, 987.77, 1174.66, 1567.98], beatStart: 21, dur: 300 },
            { freqs: [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98], beatStart: 22, dur: 400 }, // FULL ORCHESTRA!
        ];

        // === DYNAMIC VOLUME ENVELOPE ===
        // Music grows dramatically from intimate to epic
        const getVolumeMultiplier = (beat) => {
            // Phase 1: Intimate and tender (beats 0-5)
            if (beat < 6) return 0.6 + (beat / 6) * 0.1;       // 0.6 -> 0.7
            // Phase 2: Building hope (beats 6-11)
            if (beat < 12) return 0.7 + ((beat - 6) / 6) * 0.15; // 0.7 -> 0.85
            // Phase 3: Triumphant (beats 12-17)
            if (beat < 18) return 0.85 + ((beat - 12) / 6) * 0.1; // 0.85 -> 0.95
            // Phase 4: EPIC FINALE (beats 18-23)
            return 0.95 + ((beat - 18) / 5) * 0.05;            // 0.95 -> 1.0 FULL VOLUME!
        };

        let melodyIndex = 0;
        let bassIndex = 0;
        let harmonyIndex = 0;
        let sparkleIndex = 0;
        let arpeggioIndex = 0;
        let currentBeat = 0;
        let loopCount = 0;

        // Schedule the ultra grand wedding march loop
        typingInterval = setInterval(() => {
            const volumeMult = getVolumeMultiplier(currentBeat);

            // === MAIN MELODY (square wave) - bright, soaring wedding march ===
            const m = mainMelody[melodyIndex % mainMelody.length];
            const melodyVolume = 0.09 * volumeMult;
            playNote(m.freq, m.dur * 0.85, 'square', melodyVolume, newMasterGain);

            // === ROMANTIC COUNTER MELODY (triangle wave) - soft, dreamy ===
            const counter = counterMelody[harmonyIndex % counterMelody.length];
            if (counter && counter.startBeat === currentBeat) {
                playNote(counter.freq, counter.dur * 0.7, 'triangle', 0.035 * volumeMult, newMasterGain);
            }

            // === SECOND COUNTER MELODY (sine wave) - ethereal pads ===
            const secondCounter = secondCounterMelody[sparkleIndex % secondCounterMelody.length];
            if (secondCounter && secondCounter.startBeat === currentBeat) {
                playNote(secondCounter.freq, secondCounter.dur * 0.6, 'sine', 0.015 * volumeMult, newMasterGain);
            }

            // === GRAND BASS (sine wave) - warm, deep, walking ===
            const b = grandBass[bassIndex % grandBass.length];
            const bassVolume = 0.07 * volumeMult;
            playNote(b.freq, b.dur * 0.75, 'sine', bassVolume, newMasterGain);

            // === LUSH HARMONY CHORDS (triangle wave) - rich, full ===
            const chord = harmonyChords[harmonyIndex % harmonyChords.length];
            if (chord && chord.startBeat === currentBeat) {
                const chordVolume = 0.018 * volumeMult;
                chord.freqs.forEach(freq => {
                    playNote(freq, chord.dur * 0.6, 'triangle', chordVolume, newMasterGain);
                });
            }

            // === GRAND ARPEGGIOS (triangle wave) - cascading sweeps! ===
            const arp = arpeggioPatterns[arpeggioIndex % arpeggioPatterns.length];
            if (arp && arp.beatStart === currentBeat) {
                const arpVolume = 0.025 * volumeMult;
                arp.notes.forEach((freq, i) => {
                    setTimeout(() => {
                        playNote(freq, arp.speed * 0.5, 'triangle', arpVolume, newMasterGain);
                    }, i * arp.speed);
                });
            }

            // === SPARKLE NOTES (square wave) - wedding fireworks! ===
            const sparkleChance = currentBeat >= 18 ? 0.8 : (currentBeat >= 12 ? 0.5 : (currentBeat >= 6 ? 0.35 : 0.2));
            if (Math.random() < sparkleChance) {
                const s = celebrationSparkles[sparkleIndex % celebrationSparkles.length];
                const sparkleVolume = currentBeat >= 18 ? 0.018 : (currentBeat >= 12 ? 0.014 : 0.01);
                playNote(s.freq, s.dur * 0.5, 'square', sparkleVolume, newMasterGain);
                sparkleIndex++;
            }

            // === CELEBRATION CHORD BLASTS (square wave) - orchestral hits! ===
            const blast = chordBlasts[chordBlasts.length - 1];
            if (blast && blast.beatStart === currentBeat) {
                const blastVolume = currentBeat >= 18 ? 0.025 * volumeMult : 0.02 * volumeMult;
                blast.freqs.forEach(freq => {
                    playNote(freq, blast.dur * 0.5, 'square', blastVolume, newMasterGain);
                });
            }

            // === EPIC FINALE BLASTS (every loop on last beat) ===
            if (currentBeat === 23 && Math.random() < 0.7) {
                // Grand fireworks! Multiple high notes for maximum celebration
                playNote(2637.02, 250, 'square', 0.01, newMasterGain); // E7
                playNote(3135.96, 200, 'square', 0.008, newMasterGain); // G7
                playNote(3520.00, 300, 'square', 0.006, newMasterGain); // A7
                // Low rumble for drama
                setTimeout(() => {
                    playNote(130.81, 400, 'sine', 0.05, newMasterGain); // C2
                }, 100);
            }

            // Advance indices
            melodyIndex++;
            bassIndex++;
            harmonyIndex++;
            arpeggioIndex++;
            currentBeat = (currentBeat + 1) % 24;
            if (currentBeat === 0) loopCount++;
        }, 200); // Schedule every 200ms (~110 BPM wedding march tempo)

        currentMusicNodes.push({ type: 'interval', id: typingInterval });
    }

    /**
     * Start music for a specific stage (public interface)
     */
    function startStageMusic(stage) {
        switch (stage) {
            case 0: // Intro / Title screen
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
            default:
                stopAllMusic();
                break;
        }
    }

    /**
     * Stop all music (public interface)
     */
    function stopAllMusic() {
        cleanupPreviousStage();
        currentStage = -1;
    }

    /**
     * Clean up resources from the previous stage.
     * Clears intervals to stop new note scheduling and stops all active oscillators
     * immediately to prevent audio overlap between stages.
     */
    function cleanupPreviousStage() {
        // Clear intervals FIRST (stops new note scheduling)
        if (introMusicInterval) {
            clearInterval(introMusicInterval);
            introMusicInterval = null;
        }
        if (typingInterval) {
            clearInterval(typingInterval);
            typingInterval = null;
        }
        if (heartbeatInterval) {
            clearTimeout(heartbeatInterval);
            heartbeatInterval = null;
        }
        if (melodyInterval) {
            clearTimeout(melodyInterval);
            melodyInterval = null;
        }
        if (staticUpdateInterval) {
            clearTimeout(staticUpdateInterval);
            staticUpdateInterval = null;
        }

        // Clear all scheduled timeouts (Stage 1 horror stingers, groans, heartbeat)
        scheduledTimeouts.forEach(t => clearTimeout(t));
        scheduledTimeouts = [];

        // STOP all active oscillators immediately to prevent audio overlap
        currentMusicNodes.forEach(node => {
            if (!node) return;
            // Stop single oscillator nodes
            if (node.osc) {
                try { node.osc.stop(); } catch(e) {}
            }
            // Stop second oscillator nodes (used in some stages)
            if (node.osc2) {
                try { node.osc2.stop(); } catch(e) {}
            }
            // Stop buffer source nodes (used for noise)
            if (node.source) {
                try { node.source.stop(); } catch(e) {}
            }
        });

        // Clear all nodes (not just interval references)
        currentMusicNodes = [];
    }

    /**
     * Initialize audio and return a Promise that resolves when the AudioContext is running.
     * This allows callers to await context startup synchronously within user gestures.
     */
    function ensureInitialized() {
        if (!isInitialized) {
            init();
        }
        return resumeWithContext();
    }

    /**
     * Resume the AudioContext and return a Promise that resolves when running.
     * If already running, resolves immediately.
     */
    function resumeWithContext() {
        return new Promise((resolve) => {
            if (!audioCtx) { resolve(); return; }
            if (audioCtx.state === 'running') { resolve(); return; }
            audioCtx.resume().then(() => { resolve(); }).catch(() => { resolve(); });
        });
    }

    /**
     * Public API
     */

    return {
        // Initialization
        init: ensureInitialized,
        resumeContext: resumeContext,

        // Sound effects
        playCorrectAnswer,
        playTreasureFanfare,
        playYesFireworks,
        playCelebrationSong,
        playMagicalTreasureSound,

        // Stage music
        startStageMusic,
        stopAllMusic,

        // Called when any user interaction happens (for autoplay policy)
        ensureInitialized,
    };

    // Expose AudioSystem globally for other scripts
    window.AudioSystem = AudioSystem;
})();
