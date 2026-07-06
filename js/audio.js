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
    function createSquareWave(frequency, volume = 0.12, duration = 0.15, destination = null) {
        if (!audioCtx) return null;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);

        gain.gain.setValueAtTime(volume, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

        osc.connect(gain);
        gain.connect(destination || masterGainNode);

        return { osc, gain };
    }

    /**
     * Create a triangle wave oscillator (warm, soft sound)
     */
    function createTriangleWave(frequency, volume = 0.12, duration = 0.15, destination = null) {
        if (!audioCtx) return null;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);

        gain.gain.setValueAtTime(volume, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

        osc.connect(gain);
        gain.connect(destination || masterGainNode);

        return { osc, gain };
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
     */
    function playNote(frequency, duration, waveType = 'square', volume = 0.12, destination = null) {
        if (!audioCtx) return;

        const createFunc = waveType === 'triangle' ? createTriangleWave : createSquareWave;
        const nodes = createFunc(frequency, volume, duration, destination);
        if (nodes) {
            nodes.osc.start();
            nodes.osc.stop(audioCtx.currentTime + duration);
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
     * Start treasure screen music - faster paced, building tension
     */
    function startTreasureMusic() {
        if (!audioCtx || currentStage === 6) return;
        resumeContext();

        // Clean up previous stage's resources (clears intervals and old notes)
        cleanupPreviousStage();
        currentStage = 6;

        // Create new master gain for this stage
        const newMasterGain = audioCtx.createGain();
        newMasterGain.gain.setValueAtTime(0, audioCtx.currentTime);
        newMasterGain.connect(audioCtx.destination);

        // Fade in the new gain node (no crossfade)
        newMasterGain.gain.setValueAtTime(0, audioCtx.currentTime);
        newMasterGain.gain.linearRampToValueAtTime(1, audioCtx.currentTime + fadeInDuration);

        // Update current master gain (no previous gain tracking needed)
        currentMasterGain = newMasterGain;

        // Ascending chord progression - builds tension toward climax - connect to master gain via playNote chain
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

            // Play chord tones (harmony) - faster arpeggio upward - connect to masterGain for crossfading
            chord.forEach((freq, i) => {
                const delay = i * 40; // 40ms between each note
                setTimeout(() => {
                    playNote(freq, chordDuration * 0.5, 'triangle', 0.04 * volumeMultiplier, newMasterGain);
                }, delay);
            });

            // Bass note - punchier on beat - connect to masterGain for crossfading
            playNote(chord[0] / 4, chordDuration * 0.7, 'triangle', 0.06 * volumeMultiplier, newMasterGain);

            // More frequent high sparkles as we build tension
            if (Math.random() < (0.4 + progress * 0.06)) {
                const sparkle = chord[chord.length - 1] * 1.5;
                playNote(sparkle, 0.2, 'square', 0.015 * volumeMultiplier, newMasterGain);
            }

            // Double sparkle on climax chords
            if (progress >= 8 && Math.random() < 0.5) {
                const sparkle2 = chord[0] * 3;
                playNote(sparkle2, 0.3, 'square', 0.01 * volumeMultiplier, newMasterGain);
            }

            chordIndex++;
        }, chordDuration * 1000);

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

        // Stage music
        startStageMusic,
        stopAllMusic,

        // Called when any user interaction happens (for autoplay policy)
        ensureInitialized,
    };

    // Expose AudioSystem globally for other scripts
    window.AudioSystem = AudioSystem;
})();
