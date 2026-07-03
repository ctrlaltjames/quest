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
            title: "Chapter 2: Dangerously Close",
            clue: "Remember when you got dangerously close? That moment changed everything... it was our",
            answer: ["first kiss", "our first kiss", "the first kiss"],
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
            clue: "You've conquered the zombie lands, survived the dangerous frontier, and proved your love is infinite. The final level requires 2 players... Ready to play forever together?",
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
        buttonYes: "YES! 💍",
        buttonNo: "Are you sure? 🥺",
        afterYes: "She said YES! Forever begins now! 💕",
    },
};

/* ============================================
   GAME STATE (mutable, single instance)
   ============================================ */

const state = {
    currentStage: 0,        // 0=title, 1-4=stages, 5=proposal
    isTransitioning: false,  // Guards against double-submit
    noButtonEvades: 0,       // 0-3
    confettiActive: false,
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

        // Proceed to proposal after delay
        setTimeout(() => {
            state.currentStage = 5;
            showStage(5);
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
        if (typeof window !== 'undefined' && window.__DEV__) {
            console.warn(`showStage(${n}) called while transitioning. Ignoring.`);
        }
        return;
    }

    // Guard: valid range
    if (n < 0 || n > 5) return;

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

    // Update blurred background visibility for stages with images
    updateBgBlurVisibility();

    // Update progress dots
    updateProgressDots(n);

    // Handle stage-specific initialization
    if (n === 5) {
        // Proposal screen init
        startConfetti();
        createHeartBurst();

        // Typewriter for proposal message
        const msgEl = document.getElementById('proposal-message');

        if (msgEl) {
            await typewriter(msgEl, CONFIG.proposal.message, 50);
        }

        // Start confetti
        Confetti.start();

        state.isTransitioning = false;
        return;
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

        // Create twinkling stars for Stage 1
        if (n === 1) {
            createStage1Stars();
        }

        // Focus input when entering the stage
        const input = document.getElementById(`input-${n}`);
        if (input) {
            setTimeout(() => input.focus(), 600);
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

        // Wait for sparkle animation
        await new Promise(resolve => setTimeout(resolve, 500));

        // Advance to next stage (showStage manages isTransitioning)
        state.currentStage = stageId + 1;
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
 * Handle YES button press
 */
async function handleYes() {
    if (state.isTransitioning) return;

    state.isTransitioning = true;

    // Disable both buttons
    const btnYes = document.getElementById('btn-yes');
    const btnNo = document.getElementById('btn-no');
    if (btnYes) btnYes.disabled = true;
    if (btnNo) btnNo.disabled = true;

    // Intensify confetti
    Confetti.intensify();

    // Heart burst
    createHeartBurst();

    // Show after-yes message
    const afterYesEl = document.getElementById('after-yes');
    if (afterYesEl) {
        afterYesEl.style.display = 'block';
        await typewriter(afterYesEl, CONFIG.proposal.afterYes, 60);
    }

    state.isTransitioning = false;
}

/**
 * Handle NO button press
 */
function handleNo() {
    state.noButtonEvades++;

    if (state.noButtonEvades >= 3) {
        // After 3 evades, convert to YES button
        const btnNo = document.getElementById('btn-no');
        if (btnNo) {
            btnNo.textContent = CONFIG.proposal.buttonYes;
            btnNo.className = 'btn-yes';
            btnNo.removeAttribute('id'); // Remove id so handleNo no longer triggers
            btnNo.addEventListener('click', () => handleYes());
        }
    } else {
        repositionNoButton();
    }
}

/**
 * Reposition NO button to a random viewport-bound position
 */
function repositionNoButton() {
    const btn = document.getElementById('btn-no');
    if (!btn) return;

    const btnWidth = btn.offsetWidth + 20; // padding
    const btnHeight = btn.offsetHeight + 20;

    // Clamp to safe viewport area
    const maxX = window.innerWidth - btnWidth;
    const maxY = window.innerHeight - btnHeight;

    // Ensure minimum bounds
    const clampedMaxX = Math.max(60, maxX);
    const clampedMaxY = Math.max(60, maxY);

    const newX = Math.max(10, Math.random() * clampedMaxX);
    const newY = Math.max(10, Math.random() * clampedMaxY);

    btn.style.position = 'fixed';
    btn.style.left = newX + 'px';
    btn.style.top = newY + 'px';
    btn.style.zIndex = '50';

    // Add wiggle animation
    btn.style.animation = 'none';
    btn.offsetHeight; // Force reflow
    btn.style.animation = '';
}

/* ============================================
   CONFETTI MANAGEMENT
   ============================================ */

function startConfetti() {
    Confetti.start();
    state.confettiActive = true;
}

function stopConfetti() {
    Confetti.stop();
    state.confettiActive = false;
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

    // Input Enter key handlers
    for (let i = 1; i <= 4; i++) {
        const input = document.getElementById(`input-${i}`);
        if (input) {
            input.addEventListener('keydown', (e) => {
                handleEnter(e, i);
            });
        }
    }

    // YES button
    const btnYes = document.getElementById('btn-yes');
    if (btnYes) {
        btnYes.addEventListener('click', handleYes);
    }

    // NO button
    const btnNo = document.getElementById('btn-no');
    if (btnNo) {
        btnNo.addEventListener('click', handleNo);
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
 * Create flower elements for proposal screen
 */
function createFlowers() {
    const container = document.querySelector('.flower-container');
    if (!container) return;

    const emojis = ['🌸', '🌺', '🌹', '🌻', '🌼'];

    for (let i = 0; i < 5; i++) {
        const flower = document.createElement('span');
        flower.className = 'flower';
        flower.textContent = emojis[i % emojis.length];
        flower.style.animationDelay = (i * 0.2) + 's';
        container.appendChild(flower);
    }
}

/* ============================================
   PIXEL ART RENDERING (Canvas)
   ============================================ */

/**
 * Render a pixel heart on canvas
 */
function renderHeartCanvas(canvasEl) {
    const ctx = canvasEl.getContext('2d');
    const size = 16;
    canvasEl.width = size;
    canvasEl.height = size;

    // 16x16 heart pixel grid
    const grid = [
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,1,1,0,0,0,0,0,1,1,0,0,0,0,0],
        [0,1,2,1,1,0,0,0,1,1,2,1,0,0,0,0],
        [1,2,1,1,2,1,0,1,2,1,1,2,1,0,0,0],
        [1,1,1,1,1,2,1,2,1,1,1,1,1,0,0,0],
        [0,1,1,1,1,1,2,1,1,1,1,1,0,0,0,0],
        [0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
        [0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0],
        [0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0],
        [0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ];

    const palette = {
        0: null,
        1: '#e63946',
        2: '#8b0000',
    };

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const color = palette[grid[y][x]];
            if (color) {
                ctx.fillStyle = color;
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
}

/**
 * Render a pixel ring on canvas
 */
function renderRingCanvas(canvasEl) {
    const ctx = canvasEl.getContext('2d');
    const size = 12;
    canvasEl.width = size;
    canvasEl.height = size;

    // 12x12 ring pixel grid
    const grid = [
        [0,0,0,1,1,1,1,1,0,0,0,0],
        [0,0,1,2,2,2,2,2,1,0,0,0],
        [0,1,2,3,3,3,3,2,1,0,0,0],
        [1,2,3,3,3,3,3,3,2,1,0,0],
        [1,2,3,3,3,3,3,3,2,1,0,0],
        [1,2,3,3,3,3,3,3,2,1,0,0],
        [1,2,3,3,3,3,3,3,2,1,0,0],
        [1,2,3,3,3,3,3,3,2,1,0,0],
        [0,1,2,3,3,3,3,2,1,0,0,0],
        [0,0,1,2,2,2,2,1,0,0,0,0],
        [0,0,0,1,1,1,1,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0],
    ];

    const palette = {
        0: null,
        1: '#f5a623',
        2: '#ffd700',
        3: '#ffffff',
    };

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const color = palette[grid[y][x]];
            if (color) {
                ctx.fillStyle = color;
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
}

/* ============================================
    INITIALIZATION
    ============================================ */

/**
 * Initialize blurred background fill for all stages with background images.
 * Copies the parent's background-image to the .bg-blur element so the
 * blur layer can use background-size: cover while the parent uses contain.
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
        createFlowers();

        // Render pixel art
        const heartCanvas = document.getElementById('heart-canvas');
        if (heartCanvas) renderHeartCanvas(heartCanvas);

        const ringCanvas = document.getElementById('ring-canvas');
        if (ringCanvas) renderRingCanvas(ringCanvas);

        // Initialize blurred background layers for each stage
        initBgBlurLayers();

        // Show title screen
        showStage(0);

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

// Enable dev mode flag
window.__DEV__ = true;