/**
 * ============================================
 * CONFIG - Edit these values to customize the game
 * ============================================
 *
 * The proposer edits this CONFIG object to personalize the game.
 * After editing, deploy to GitHub Pages or any static host.
 */

const CONFIG = {
    // Title screen
    title: "A Quest For Love",
    subtitle: "Will you embark on this adventure?",
    startButton: "Begin Adventure",

    // Four puzzle stages
    stages: [
        {
            id: 1,
            title: "Chapter 1: Where It All Began",
            clue: "We both love zombies... remember the movie we saw that night?",
            answer: ["zombieland", "the zombieland", "zombie land", "zombie-land"],
        },
{
            id: 2,
            title: "Chapter 2: Muah!",
            clue: "Remember when you got dangerously close? That moment changed everything… and sealed with a what?",
            answer: ["first kiss", "our first kiss", "the first kiss", "kiss", "a kiss", "kissing"],
        },
        {
            id: 3,
            title: "Chapter 3: The Heart",
            clue: "Our love counter: x 2,458 → x 10,000 → x 1,000,000 ... What comes next?",
            answer: ["infinity", "inf", "infinite", "x infinity", "x inf", "x infinite"],
        },
        {
            id: 4,
            title: "Chapter 4: Player 2 Joined",
            clue: "You've conquered the zombie lands, survived the dangerous frontier, and proved your love is infinite. The final level requires 2 players...",
            // Stage 4 uses a co-op mechanic instead of text input.
            // Both players must press their buttons simultaneously to proceed.
            coOp: {
                player1Label: "Player 1: Press A",
                player2Label: "Player 2: Press B",
                timeout: 5000,
                promptText: "Both players tap together!",
            },
        },
    ],

    // Proposal screen
    proposal: {
        message: "Every quest has led to this moment...",
        question: "Will you marry me?",
        buttonYes: "YES!",
        afterYes: "She said YES! 💕",
    },
};

/* ============================================
   GAME STATE (mutable, single instance)
   ============================================ */

const state = {
    currentStage: 0,        // 0=title, 1-4=stages, 5=proposal, 6=treasure
    isTransitioning: false,  // Guards against double-submit
};

/* ============================================
   CO-OP GAME MECHANIC (Stage 4)
   ============================================ */

const coOpState = {
    player1Tapped: false,
    player2Tapped: false,
    timeoutId: null,
};

/**
 * Handle a co-op button tap for Stage 4
 */
function handleCoOpTap(playerNum) {
    if (state.isTransitioning) return;

    if (playerNum === 1) coOpState.player1Tapped = true;
    else coOpState.player2Tapped = true;

    // Visual feedback
    const btn = document.querySelector(`.arcade-btn[data-player="${playerNum}"]`);
    if (btn) btn.classList.add('tapped');

    // Check if both tapped
    if (coOpState.player1Tapped && coOpState.player2Tapped) {
        clearTimeout(coOpState.timeoutId);

        // Success animation
        document.querySelectorAll('.arcade-btn').forEach(b => b.classList.add('success'));
        screenFlash();

        // Proceed to treasure screen after delay
        setTimeout(() => {
            state.currentStage = 6;
            showStage(6);
        }, 1000);
    }

    // Start timeout if first tap (no timeout yet)
    if (!coOpState.timeoutId) {
        coOpState.timeoutId = setTimeout(() => {
            resetCoOp();
        }, CONFIG.stages[3].coOp.timeout);
    }
}

/**
 * Reset co-op state (called on timeout)
 */
function resetCoOp() {
    coOpState.player1Tapped = false;
    coOpState.player2Tapped = false;
    coOpState.timeoutId = null;
    document.querySelectorAll('.arcade-btn').forEach(b => b.classList.remove('tapped', 'success'));
}

/* ============================================
   UTILITY FUNCTIONS
   ============================================ */

/**
 * Normalize user input for comparison
 */
function normalizeAnswer(s) {
    return s.toLowerCase().trim();
}

/**
 * Validate a user's answer against CONFIG
 */
function validateAnswer(stageId, input) {
    const stage = CONFIG.stages[stageId - 1];
    if (!stage) return false;

    const normalized = normalizeAnswer(input);
    if (normalized === "") return false;

    return stage.answer.some(a => normalizeAnswer(a) === normalized);
}

/**
 * Show a screen flash effect
 */
function screenFlash() {
    const flash = document.createElement('div');
    flash.className = 'screen-flash';
    document.body.appendChild(flash);
    flash.addEventListener('animationend', () => flash.remove());
}

/**
 * Create sparkle effects around an element
 */
function createSparkles(element) {
    const rect = element.getBoundingClientRect();
    const emojis = ['✨', '⭐', '💫', '✦'];

    for (let i = 0; i < 6; i++) {
        const sparkle = document.createElement('div');
        sparkle.className = 'sparkle-effect';
        sparkle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        sparkle.style.left = (rect.left + Math.random() * rect.width) + 'px';
        sparkle.style.top = (rect.top + Math.random() * rect.height) + 'px';
        sparkle.style.animation = `sparkleAnim ${0.5 + Math.random() * 0.5}s ease-out forwards`;
        document.body.appendChild(sparkle);

        sparkle.addEventListener('animationend', () => sparkle.remove());
    }
}

/**
 * Create heart burst effect
 */
function createHeartBurst() {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const emojis = ['❤️', '💕', '💖', '💗'];

    for (let i = 0; i < 8; i++) {
        const angle = (i * 45) * (Math.PI / 180);
        const distance = 80 + Math.random() * 60;
        const heart = document.createElement('div');
        heart.className = 'heart-burst';
        heart.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        heart.style.left = centerX + 'px';
        heart.style.top = centerY + 'px';
        heart.style.animation = `heartBurst ${1 + Math.random() * 0.5}s ease-out forwards`;

        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;
        heart.style.setProperty('--tx', tx + 'px');
        heart.style.setProperty('--ty', ty + 'px');

        document.body.appendChild(heart);
        heart.addEventListener('animationend', () => heart.remove());
    }
}

/**
 * Typewriter effect for text elements
 */
function typewriter(element, text, speed) {
    return new Promise((resolve) => {
        let i = 0;
        element.textContent = '';

        function typeChar() {
            if (i < text.length) {
                element.textContent += text[i];
                i++;
                setTimeout(typeChar, speed);
            } else {
                resolve();
            }
        }

        typeChar();
    });
}

/**
 * Shake an element
 */
function shakeElement(element) {
    element.classList.add('shake-element');
    return new Promise(resolve => {
        element.addEventListener('animationend', () => {
            element.classList.remove('shake-element');
            resolve();
        }, { once: true });
    });
}

/* ============================================
   STAGE MANAGER
   ============================================ */

/**
 * Render a stage from CONFIG into the DOM
 */
function renderStage(n) {
    if (n === 0) return; // Title screen

    if (n >= 1 && n <= 4) {
        const stage = CONFIG.stages[n - 1];
        const titleEl = document.getElementById(`stage-${n}-title`);
        const clueEl = document.getElementById(`stage-${n}-clue`);

        if (titleEl) titleEl.textContent = stage.title;
        if (clueEl) clueEl.textContent = stage.clue;
    }

    if (n === 5) {
        const msgEl = document.getElementById('proposal-message');

        if (msgEl) msgEl.textContent = CONFIG.proposal.message;
    }
}

/**
 * Show a specific stage with animation
 */
async function showStage(n) {
    // Guard: prevent double calls
    if (state.isTransitioning) {
        return;
    }

    // Guard: valid range (0=title, 1-4=stages, 5=proposal, 6=treasure)
    if (n < 0 || n > 6) return;

    state.isTransitioning = true;

    // Hide all stages (preserve background-image styles)
    document.querySelectorAll('.stage').forEach(s => {
        s.classList.remove('active');
    });

    // Determine target element ID
    let targetId;
    if (n === 0) {
        targetId = 'stage-title';
    } else if (n === 5) {
        targetId = 'stage-proposal';
    } else if (n === 6) {
        targetId = 'stage-treasure';
    } else {
        targetId = `stage-${n}`;
    }

    const target = document.getElementById(targetId);
    if (!target) {
        state.isTransitioning = false;
        return;
    }

    // Render stage content
    renderStage(n);

    // Activate stage
    target.classList.add('active');

    // Activate parallax + drift for this stage (background-parallax.js)
    if (typeof activateForStage === 'function') {
        activateForStage(target);
    }

    // Update blurred background visibility for stages with images
    updateBgBlurVisibility();

    // Update progress dots
    updateProgressDots(n);

    // Handle stage-specific initialization
    if (n === 5) {
        // Proposal screen init
        // Show the YES button for user interaction
        const btnYes = document.getElementById('btn-yes');
        if (btnYes) {
            btnYes.style.display = 'block';
        }

        // Heart burst
        createHeartBurst();

        // Stop all music when entering proposal screen
        AudioSystem.stopAllMusic();

        // Typewriter for proposal message
        const msgEl = document.getElementById('proposal-message');

        if (msgEl) {
            await typewriter(msgEl, CONFIG.proposal.message, 50);
        }

        state.isTransitioning = false;
        return;
    }

    // Treasure screen (stage 6)
    if (n === 6) {
        // STOP current stage music before playing treasure sound (like other transitions do)
        AudioSystem.stopAllMusic();

        // Show treasure background with portrait support
        const isMobile = window.innerWidth <= 600;
        const treasureImage = isMobile
            ? 'images/portrait/treasure.jpg'
            : 'images/treasure.jpg';
        target.style.setProperty('background-image', `url('${treasureImage}')`, 'important');
        target.setAttribute('data-portrait', treasureImage);

        // Update blurred background
        updateBgBlurVisibility();

        // Start golden sparkle particles
        spawnTreasureSparkles();
        if (!window.__treasureParticleInterval) {
            window.__treasureParticleInterval = setInterval(() => {
                spawnTreasureSparkles();
            }, 2000);
        }

        // Play magical treasure discovery sound
        AudioSystem.playMagicalTreasureSound();

        // Start countdown
        startTreasureCountdown();

        state.isTransitioning = false;
        return;
    }

    // Create twinkling stars for Stage 1
    if (n === 1) {
        createStage1Stars();
    }

    // Create star sparkles and fading hearts for Stage 2 (before typewriter so they start immediately)
    if (n === 2) {
        createStage2Stars();
        createStage2Hearts();
    }

    // Create floating hearts and number particles for Stage 3 (love counter / infinity theme)
    if (n === 3) {
        createStage3Hearts();
        createStage3NumberParticles();
    }

    if (n >= 1 && n <= 4) {
        // Stage-specific: typewriter clue text
        const clueEl = document.getElementById(`stage-${n}-clue`);
        if (clueEl) {
            const clueText = clueEl.textContent;
            clueEl.textContent = '';

            // Wait for fonts to load before starting typewriter
            await document.fonts.ready.catch(() => {});

            await typewriter(clueEl, clueText, 40);
        }

        // Focus input when entering the stage (desktop only)
        if (window.innerWidth > 768) {
            const input = document.getElementById(`input-${n}`);
            if (input) {
                setTimeout(() => input.focus(), 600);
            }
        }
    }

    // Reset co-op state when entering Stage 4
    if (n === 4) {
        resetCoOp();
    }

    // Wait for animation to complete
    await new Promise(resolve => {
        let settled = false;

        const onAnimationEnd = () => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve();
        };

        const onTimeout = () => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve();
        };

        const cleanup = () => {
            target.removeEventListener('animationend', onAnimationEnd);
            clearTimeout(fallbackTimer);
        };

        // Fallback timeout in case animationend doesn't fire
        const fallbackTimer = setTimeout(onTimeout, 450);

        // Listen for animationend
        target.addEventListener('animationend', onAnimationEnd, { once: true });
    });

    // Unset transitioning after animation completes
    state.isTransitioning = false;
}

/**
 * Update progress dots for stages 1-4
 */
function updateProgressDots(currentStage) {
    const dotsContainer = document.querySelector('.stage.active .progress-dots');
    if (!dotsContainer) return;

    const dots = dotsContainer.querySelectorAll('.dot');
    dots.forEach((dot, i) => {
        if (i < currentStage - 1) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });
}

/* ============================================
   INPUT HANDLER
   ============================================ */

/**
 * Handle CHECK button press for a stage
 */
async function handleCheck(stageId) {
    // Guard: don't process during transition
    if (state.isTransitioning) return;

    const input = document.getElementById(`input-${stageId}`);
    if (!input) return;

    const value = input.value.trim();

    // Guard: empty input → shake
    if (value === "") {
        input.classList.add('wrong');
        shakeElement(input);
        setTimeout(() => {
            input.classList.remove('wrong');
        }, 300);
        return;
    }

    // Validate answer
    const correct = validateAnswer(stageId, value);

    if (correct) {
        // CORRECT ANSWER
        input.classList.add('correct');
        createSparkles(input);
        screenFlash();
        AudioSystem.playCorrectAnswer();

        // Wait 2.5 seconds (current stage's music continues during this delay)
        const nextStage = stageId + 1;
        await new Promise(resolve => setTimeout(resolve, 2500));

        // After the delay: stop old music and start new music
        AudioSystem.stopAllMusic();
        AudioSystem.startStageMusic(nextStage);

        // Advance to next stage (showStage manages isTransitioning)
        state.currentStage = nextStage;
        await showStage(state.currentStage);

        // Reset input after transition completes
        input.classList.remove('correct');
        input.value = '';
    } else {
        // WRONG ANSWER
        input.classList.add('wrong');
        await shakeElement(input);
        input.classList.remove('wrong');
        input.value = '';
        input.focus();
    }
}

/**
 * Handle Enter key press on input
 */
function handleEnter(event, stageId) {
    if (event.key === 'Enter') {
        event.preventDefault();
        handleCheck(stageId);
    }
}

/* ============================================
   PROPOSAL HANDLER
   ============================================ */

/**
 * Run countdown from 8 to 1 on the treasure screen, then transition to proposal
 */
async function startTreasureCountdown() {
    const countdownEl = document.getElementById('countdown');
    if (!countdownEl) return;

    countdownEl.style.display = 'block';

    for (let i = 8; i >= 1; i--) {
        countdownEl.textContent = i;
        // Reset animation
        countdownEl.style.animation = 'none';
        countdownEl.offsetHeight; // Force reflow
        countdownEl.style.animation = 'countdownPulse 1s ease-in-out forwards';

        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Hide countdown
    countdownEl.style.display = 'none';

    // Stop treasure sparkle interval
    if (window.__treasureParticleInterval) {
        clearInterval(window.__treasureParticleInterval);
        window.__treasureParticleInterval = null;
    }

    // Transition to proposal screen
    state.currentStage = 5;
    showStage(5);
}

/**
 * Handle YES button press - start confetti and show celebration
 */
async function handleYes() {
    if (state.isTransitioning) return;

    state.isTransitioning = true;

    // Disable the YES button
    const btnYes = document.getElementById('btn-yes');
    if (btnYes) btnYes.disabled = true;

    // Add fading-out class to buttons to trigger fade animation
    const proposalButtons = document.querySelector('.proposal-buttons');
    if (proposalButtons) {
        proposalButtons.classList.add('fading-out');
    }

    // Start confetti
    Confetti.start();

    // Heart burst
    createHeartBurst();

    // Play celebratory victory song
    AudioSystem.playCelebrationSong();

    // Show after-yes message (do NOT fade it out)
    const afterYesWrapper = document.getElementById('after-yes-wrapper');
    const afterYesEl = document.getElementById('after-yes');
    if (afterYesWrapper && afterYesEl) {
        afterYesWrapper.style.display = 'block';
        await typewriter(afterYesEl, CONFIG.proposal.afterYes, 60);
    }

    // Intensify confetti after message
    setTimeout(() => {
        Confetti.intensify();
    }, 500);

    // Hide ONLY the proposal buttons after fade animation completes
    // The after-yes message stays visible permanently
    setTimeout(() => {
        if (proposalButtons) {
            proposalButtons.style.display = 'none';
        }
    }, 800);

    state.isTransitioning = false;
}

/**
 * Spawn 1-2px golden sparkle particles floating upward from center
 */
function spawnTreasureSparkles() {
    const count = 35;

    for (let i = 0; i < count; i++) {
        const sparkle = document.createElement('div');
        sparkle.className = 'treasure-sparkle';

        // Random size: 1px, 2px, or 3px
        const sizes = [1, 2, 3];
        const size = sizes[Math.floor(Math.random() * sizes.length)];
        sparkle.style.width = size + 'px';
        sparkle.style.height = size + 'px';

        // Spawn position: horizontal center ± 40% of screen width
        const centerX = window.innerWidth / 2;
        const xOffset = (Math.random() - 0.5) * window.innerWidth * 0.8;
        const startX = centerX + xOffset;

        // Vertical spawn: 45%-55% from top (centered vertically)
        const startY = window.innerHeight * (0.45 + Math.random() * 0.1);

        sparkle.style.left = startX + 'px';
        sparkle.style.top = startY + 'px';
        sparkle.style.transform = 'translate(-50%, -50%)';

        // Random gold tint
        const goldTints = [
            'rgba(255, 215, 0, 0.9)',
            'rgba(255, 223, 0, 0.85)',
            'rgba(255, 230, 50, 0.8)',
            'rgba(255, 200, 0, 0.95)',
            'rgba(255, 240, 100, 0.85)',
        ];
        sparkle.style.background = goldTints[Math.floor(Math.random() * goldTints.length)];

        // Random drift direction and upward rise (higher float)
        const drift = (Math.random() - 0.5) * 60; // -30px to +30px horizontal
        const rise = -(60 + Math.random() * 100); // -60px to -160px upward
        sparkle.style.setProperty('--drift', drift + 'px');
        sparkle.style.setProperty('--rise', rise + 'px');

        // Random animation duration and delay
        const duration = 1.5 + Math.random() * 2;
        const delay = Math.random() * 2;
        sparkle.style.animation = `sparkleFloat ${duration}s ease-in-out ${delay}s forwards`;

        document.body.appendChild(sparkle);
    }
}




/* ============================================
   EVENT BINDING
   ============================================ */

function bindEvents() {
    // Begin Adventure button
    const btnStart = document.getElementById('btn-start');
    if (btnStart) {
        btnStart.addEventListener('click', () => {
            if (!state.isTransitioning) {
                // Initialize audio on first user interaction
                AudioSystem.ensureInitialized();
                // Stop intro music and transition to game
                AudioSystem.startStageMusic(1);
                state.currentStage = 1;
                showStage(1);
            }
        });
    }

    // CHECK buttons (event delegation)
    document.querySelectorAll('.btn-check').forEach(btn => {
        btn.addEventListener('click', () => {
            const stageId = parseInt(btn.getAttribute('data-stage'), 10);
            if (stageId && !state.isTransitioning) {
                handleCheck(stageId);
            }
        });
    });

    // Input Enter key handlers and auto-toggle clue visibility
    for (let i = 1; i <= 4; i++) {
        const input = document.getElementById(`input-${i}`);
        if (input) {
            input.addEventListener('keydown', (e) => {
                handleEnter(e, i);
            });
            // Auto-toggle clue visibility based on input content
            input.addEventListener('input', () => {
                // Find clue-wrapper as a sibling within the same dialogue-box
                const dialogueBox = input.closest('.dialogue-box');
                const clueWrapper = dialogueBox ? dialogueBox.querySelector('.clue-wrapper') : null;
                const clueEl = document.getElementById(`stage-${i}-clue`);
                const toggleBtn = document.querySelector(`.clue-toggle[data-clue="stage-${i}-clue"]`);
                const isEmpty = input.value.trim() === '';

                if (isEmpty) {
                    // Show clue when input is empty
                    if (clueEl && clueEl.classList.contains('collapsed')) {
                        clueEl.classList.remove('collapsed');
                        toggleBtn?.setAttribute('aria-expanded', 'true');
                    }
                    if (clueWrapper && clueWrapper.classList.contains('collapsed')) {
                        clueWrapper.classList.remove('collapsed');
                    }
                } else {
                    // Hide clue when input has content
                    if (clueEl && !clueEl.classList.contains('collapsed')) {
                        clueEl.classList.add('collapsed');
                        toggleBtn?.setAttribute('aria-expanded', 'false');
                    }
                    if (clueWrapper && !clueWrapper.classList.contains('collapsed')) {
                        clueWrapper.classList.add('collapsed');
                    }
                }
            });
        }
    }

    // YES button
    const btnYes = document.getElementById('btn-yes');
    if (btnYes) {
        btnYes.addEventListener('click', handleYes);
    }

    // Keyboard detection for mobile input
    if ('visualViewport' in window) {
        window.visualViewport.addEventListener('resize', () => {
            adjustForKeyboard();
        });
    }

    // Co-op arcade buttons (Stage 4)
    document.querySelectorAll('.arcade-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const playerNum = parseInt(btn.getAttribute('data-player'), 10);
            if (playerNum) {
                handleCoOpTap(playerNum);
            }
        });
    });

    // Clue collapse toggle buttons
    document.querySelectorAll('.clue-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const clueId = btn.getAttribute('data-clue');
            const clueEl = document.getElementById(clueId);
            const isExpanded = btn.getAttribute('aria-expanded') === 'true';
            // Find clue-wrapper as a sibling within the same toggle wrapper
            const clueWrapper = btn.parentElement.querySelector('.clue-wrapper');

            if (clueEl) {
                clueEl.classList.toggle('collapsed');
                btn.setAttribute('aria-expanded', !isExpanded);
            }

            // Toggle wrapper visibility to free/hide space
            // When isExpanded is true (currently visible), add collapsed to hide it
            if (clueWrapper) {
                clueWrapper.classList.toggle('collapsed', isExpanded);
            }
        });
    });
}

/**
 * Adjust input position when keyboard is open
 */
function adjustForKeyboard() {
    const activeEl = document.activeElement;
    if (!activeEl || activeEl.className !== 'stage-input') return;

    const viewportHeight = window.visualViewport.height;
    const windowHeight = window.innerHeight;

    // If keyboard is open (viewport shrunk)
    if (viewportHeight < windowHeight - 100) {
        activeEl.scrollIntoView({ block: 'center' });
    }
}

/* ============================================
   AMBIENT EFFECTS
   ============================================ */

/**
 * Create ambient particles for title screen
 */
function createAmbientParticles() {
    const container = document.querySelector('.ambient-particles');
    if (!container) return;

    const count = window.innerWidth < 768 ? 15 : 30;

    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = 'ambient-particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 4 + 's';
        particle.style.animationDuration = (3 + Math.random() * 3) + 's';
        container.appendChild(particle);
    }
}

/**
 * Create twinkling star field
 */
function createStarField() {
    const container = document.createElement('div');
    container.className = 'star-field';
    container.setAttribute('aria-hidden', 'true');

    const count = window.innerWidth < 768 ? 20 : 50;

    for (let i = 0; i < count; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.animationDelay = Math.random() * 3 + 's';
        star.style.animationDuration = (2 + Math.random() * 2) + 's';
        container.appendChild(star);
    }

    document.body.appendChild(container);
}

/**
 * Create subtle twinkling stars for Stage 1 night scene
 */
function createStage1Stars() {
    // Remove existing star field if present
    const existing = document.getElementById('stage1-star-field');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.id = 'stage1-star-field';
    container.className = 'stage1-star-field';
    container.setAttribute('aria-hidden', 'true');

    // ~30 stars in the upper 300px of the screen
    const count = 30;
    const maxHeight = 300; // pixels from top

    for (let i = 0; i < count; i++) {
        const star = document.createElement('div');
        star.className = 'stage1-star';
        // Spread across full width, within top 300px
        star.style.left = Math.random() * 100 + '%';
        star.style.top = (Math.random() * maxHeight) + 'px';
        // Random size variation (1px to 2px)
        const size = 1 + Math.random();
        star.style.width = size + 'px';
        star.style.height = size + 'px';
        // Staggered animation timing
        star.style.animationDelay = (Math.random() * 4) + 's';
        star.style.animationDuration = (3 + Math.random() * 3) + 's';
        container.appendChild(star);
    }

    // Insert as first child of stage-1 so it sits above background but below content
    const stage1 = document.getElementById('stage-1');
    if (stage1) {
        stage1.insertBefore(container, stage1.firstChild);
    }
}

/**
 * Create star sparkles for Stage 2 (upper 20% of screen)
 */
function createStage2Stars() {
    // Remove existing star field if present
    const existing = document.getElementById('stage2-star-field');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.id = 'stage2-star-field';
    container.className = 'stage2-star-field';
    container.setAttribute('aria-hidden', 'true');

    // ~30 sparkles in the upper 20% of screen
    const count = window.innerWidth < 768 ? 20 : 30;

    // Track placed positions to avoid clustering (container uses percentage coords)
    const placedPositions = [];
    const minDistance = 5; // minimum distance in percentage points between stars
    const maxRetries = 50; // max attempts per star before accepting any position

    for (let i = 0; i < count; i++) {
        let x, y, attempts = 0;

        // Generate a random position that is at least minDistance away from all placed stars
        do {
            x = Math.random() * 100;
            y = Math.random() * 100;
            attempts++;
        } while (
            attempts < maxRetries &&
            placedPositions.some(p => {
                const dx = p.x - x;
                const dy = p.y - y;
                return Math.sqrt(dx * dx + dy * dy) < minDistance;
            })
        );

        placedPositions.push({ x, y });

        const star = document.createElement('div');
        star.className = 'stage2-star';
        // Spread across full width, within upper 20vh
        star.style.left = x + '%';
        star.style.top = y + '%';
        // Random size variation (1px to 2.5px)
        const size = 1 + Math.random() * 1.5;
        star.style.width = size + 'px';
        star.style.height = size + 'px';
        // Staggered animation timing for natural sparkle effect
        star.style.animationDelay = (Math.random() * 4) + 's';
        star.style.animationDuration = (2.5 + Math.random() * 2.5) + 's';
        container.appendChild(star);
    }

    // Insert as first child of stage-2 so it sits above background but below content
    const stage2 = document.getElementById('stage-2');
    if (stage2) {
        stage2.insertBefore(container, stage2.firstChild);
    }
}

/**
 * Create fading hearts for Stage 2 (~30% down the screen)
 */
function createStage2Hearts() {
    // Remove existing heart field if present
    const existing = document.getElementById('stage2-heart-field');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.id = 'stage2-heart-field';
    container.className = 'stage2-heart-field';
    container.setAttribute('aria-hidden', 'true');

    // 8-12 hearts spread horizontally across the screen at ~30% height
    const count = window.innerWidth < 768 ? 8 : 12;
    const heartChars = ['♥', '♡'];

    for (let i = 0; i < count; i++) {
        const heart = document.createElement('span');
        heart.className = 'stage2-heart';
        heart.textContent = heartChars[Math.floor(Math.random() * heartChars.length)];
        // Spread horizontally across the screen with even spacing + slight randomness
        heart.style.left = ((i / (count - 1)) * 90 + 5 + (Math.random() * 5 - 2.5)) + '%';
        // Slight vertical variation within the band
        heart.style.top = (30 + Math.random() * 40) + '%';
        // Vary font size slightly for depth (base ~28px, range 24-36)
        const fontSize = 24 + Math.random() * 12;
        heart.style.fontSize = fontSize + 'px';
        // Staggered animation delay for wave-like fade effect
        heart.style.animationDelay = (i * 0.4 + Math.random() * 1) + 's';
        heart.style.animationDuration = (4 + Math.random() * 2) + 's';
        container.appendChild(heart);
    }

    // Insert as first child of stage-2
    const stage2 = document.getElementById('stage-2');
    if (stage2) {
        stage2.insertBefore(container, stage2.firstChild);
    }
}

/**
 * Create floating hearts for Stage 3 (love counter theme)
 */
function createStage3Hearts() {
    // Remove existing heart field if present
    const existing = document.getElementById('stage3-heart-field');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.id = 'stage3-heart-field';
    container.className = 'stage3-heart-field';
    container.setAttribute('aria-hidden', 'true');

    // 10-15 hearts rising from bottom area of screen
    const count = window.innerWidth < 768 ? 10 : 15;
    const heartChars = ['♥', '♡'];

    for (let i = 0; i < count; i++) {
        const heart = document.createElement('span');
        heart.className = 'stage3-heart';
        heart.textContent = heartChars[Math.floor(Math.random() * heartChars.length)];
        // Spread horizontally across the screen
        heart.style.left = (5 + Math.random() * 90) + '%';
        // Start ~20% up from bottom of visible image area
        heart.style.top = (48 + Math.random() * 16) + '%';
        // Vary font size for depth (14-36px)
        const fontSize = 14 + Math.random() * 22;
        heart.style.fontSize = fontSize + 'px';
        // Staggered animation timing for natural floating effect
        heart.style.animationDelay = (Math.random() * 6) + 's';
        heart.style.animationDuration = (5 + Math.random() * 3) + 's';
        container.appendChild(heart);
    }

    // Insert as first child of stage-3
    const stage3 = document.getElementById('stage-3');
    if (stage3) {
        stage3.insertBefore(container, stage3.firstChild);
    }
}

/**
 * Create number particles for Stage 3 (infinity theme - digits float upward)
 */
function createStage3NumberParticles() {
    // Remove existing number field if present
    const existing = document.getElementById('stage3-number-field');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.id = 'stage3-number-field';
    container.className = 'stage3-number-field';
    container.setAttribute('aria-hidden', 'true');

    // 12-18 number particles rising from bottom
    const count = window.innerWidth < 768 ? 12 : 18;
    // Weight ∞ higher so it appears more frequently (~25% of particles)
    const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '∞', '∞', '∞'];

    for (let i = 0; i < count; i++) {
        const num = document.createElement('span');
        num.className = 'stage3-number';
        const digit = digits[Math.floor(Math.random() * digits.length)];
        num.textContent = digit;
        // Spread horizontally across the screen
        num.style.left = (5 + Math.random() * 90) + '%';
        // Start ~20% up from bottom of visible image area
        num.style.top = (50 + Math.random() * 14) + '%';
        // Infinity symbols are always the largest; regular digits vary for depth
        const fontSize = digit === '∞' ? 28 : (10 + Math.random() * 8);
        num.style.fontSize = fontSize + 'px';
        // Staggered animation timing
        num.style.animationDelay = (Math.random() * 7) + 's';
        num.style.animationDuration = (6 + Math.random() * 3) + 's';
        container.appendChild(num);
    }

    // Insert as first child of stage-3
    const stage3 = document.getElementById('stage-3');
    if (stage3) {
        stage3.insertBefore(container, stage3.firstChild);
    }
}

/* ============================================
   INITIALIZATION
   ============================================ */

/**
 * Initialize blurred background fill for all stages with background images.
 * Copies the parent's background-image to the .bg-blur element so the
 * blur layer can use background-size: cover while the parent uses contain.
 * The blur layer is static (no parallax animation).
 */
function initBgBlurLayers() {
    document.querySelectorAll('.stage[style*="background-image"]').forEach(stage => {
        // Get the computed background-image from the stage (inline style)
        const bgImage = window.getComputedStyle(stage, null).getPropertyValue('background-image');

        // Find or create the .bg-blur element as a SIBLING (before the stage)
        // This ensures the blurred background is painted BELOW the stage's background
        let bgBlur = document.querySelector('.bg-blur[data-stage="' + stage.id + '"]');
        if (!bgBlur) {
            bgBlur = document.createElement('div');
            bgBlur.className = 'bg-blur';
            bgBlur.setAttribute('data-stage', stage.id);
            bgBlur.setAttribute('aria-hidden', 'true');
            stage.parentNode.insertBefore(bgBlur, stage);
        }

        // Apply the same background-image to the blur layer
        bgBlur.style.backgroundImage = bgImage;

        // Start hidden - only show when the stage is active
        bgBlur.style.display = 'none';
        // Use static center positioning (no parallax)
        bgBlur.style.backgroundPosition = 'center';
    });
}

/**
 * Get the portrait image URL for a stage element.
 * Returns the data-portrait value if available, otherwise null.
 */
function getPortraitImageUrl(stageEl) {
    const portrait = stageEl.getAttribute('data-portrait');
    if (portrait) {
        return portrait;
    }
    return null;
}

/**
 * Show the blurred background for the currently active stage.
 * Hides all other blurred backgrounds to prevent bleed-over.
 * Uses portrait images on screens ≤600px wide.
 */
function updateBgBlurVisibility() {
    const activeStage = document.querySelector('.stage.active[style*="background-image"]');

    // Hide all blurred backgrounds first
    document.querySelectorAll('.bg-blur').forEach(bgBlur => {
        bgBlur.style.display = 'none';
    });

    // Show the blurred background for the active stage
    if (activeStage) {
        const bgBlur = document.querySelector('.bg-blur[data-stage="' + activeStage.id + '"]');
        if (bgBlur) {
            bgBlur.style.display = 'block';

            // On mobile (≤600px), use portrait image for the blur layer
            if (window.innerWidth <= 600) {
                const portraitUrl = getPortraitImageUrl(activeStage);
                if (portraitUrl) {
                    bgBlur.style.backgroundImage = 'url("' + portraitUrl + '")';
                }
            }
        }
    }
}

function init() {
    try {
        // Bind all events
        bindEvents();

        // Create ambient effects
        createAmbientParticles();
        createStarField();

        // Initialize blurred background layers for each stage
        initBgBlurLayers();

        // Initialize background parallax + ambient drift (background-parallax.js)
        if (typeof initBackgroundParallax === 'function') {
            initBackgroundParallax();
        }

        // Show title screen
        showStage(0);

        // Set up the "tap anywhere to begin" overlay for AudioContext
        initAudioWaitingOverlay();

    } catch (err) {
        console.error('Game initialization error:', err);
        // Show error boundary
        const errorScreen = document.getElementById('error-boundary');
        if (errorScreen) {
            errorScreen.style.display = 'flex';
        }
    }
}

// Start the game when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

/* ============================================
   AUDIO WAITING OVERLAY
   Handles the "tap anywhere to begin" overlay
   ============================================ */

/**
 * Initialize the audio waiting overlay on the title screen.
 * When the user taps/clicks anywhere, it starts the intro music
 * and hides the overlay.
 */
function initAudioWaitingOverlay() {
    const overlay = document.getElementById('audio-waiting');
    if (!overlay) return;

    let audioStarted = false;

    async function startAudio() {
        if (audioStarted) return;
        audioStarted = true;

        // Initialize and resume AudioContext synchronously within the user gesture.
        // This MUST happen inside the user gesture handler so that the browser
        // allows audio playback (autoplay policy). The await ensures we wait for
        // resume() to complete before calling startStageMusic, keeping everything
        // within the same synchronous execution context as the click event.
        await AudioSystem.ensureInitialized();

        // Start intro music (stage 0 = title screen) - now AudioContext is running
        AudioSystem.startStageMusic(0);

        // Hide the overlay
        overlay.classList.add('hidden');
        // Remove event listeners after hiding
        setTimeout(() => {
            overlay.removeEventListener('click', startAudio);
            overlay.removeEventListener('touchstart', startAudio);
            overlay.style.display = 'none';
        }, 500);
    }

    // Use a single 'click' event with { once: true } to avoid race conditions on Android.
    // The 'click' event fires reliably after touch on all browsers (including Android Chrome).
    // { once: true } automatically removes the listener after first fire — no manual removal needed.
    overlay.addEventListener('click', startAudio, { once: true });
}

