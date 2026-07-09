/**
 * ============================================
 * Hybrid Background Parallax + Ambient Drift
 * ============================================
 *
 * Two layered, passive effects that reveal cropped regions of
 * background images on mobile without requiring user gestures:
 *
 *   1. Ambient Drift — slow Lissajous figure-8 animation (~40s cycle)
 *   2. Device Orientation Parallax — phone tilt shifts background position
 *
 * Both compose additively. Drift runs continuously; parallax layers on top
 * when gyroscope data is available. Feature only activates at ≤600px.
 */

/* ============================================
   CONFIGURATION
   ============================================ */

const PARALLAX_CONFIG = {
    // Mobile breakpoint — feature disabled above this width
    mobileBreakpoint: 600,

    // Ambient drift
    driftCycleDuration: 40,       // seconds for one full Lissajous cycle
    driftAmplitudeXPercent: 8,    // max horizontal offset as % of viewport
    driftAmplitudeYPercent: 5,    // max vertical offset as % of viewport

    // Parallax
    parallaxMaxOffsetX: 10,       // max tilt-driven X offset in %
    parallaxMaxOffsetY: 5,        // max tilt-driven Y offset in %
    smoothingAlpha: 0.15,         // EMA smoothing factor (lower = smoother)
    neutralZoneDegrees: 3,        // small tilts ignored

    // Stage transition pause before resuming drift (ms)
    transitionPauseMs: 300,
};

/* ============================================
   INTERNAL STATE
   ============================================ */

const _parallaxState = {
    isActive: false,
    rafId: null,

    // Drift
    driftStartTime: 0,
    driftPaused: false,
    driftPauseStart: 0,

    // Parallax (raw + smoothed)
    rawBeta: 0,
    rawGamma: 0,
    smoothBeta: 0,
    smoothGamma: 0,
    parallaxAvailable: false,
    iosPermissionRequested: false,

    // Current target stage element
    activeStage: null,
};

/* ============================================
   AMBIENT DRIFT ENGINE
   ============================================ */

/**
 * Calculate Lissajous curve offset at current time.
 * Returns { x, y } as percentage offsets from center (50%).
 */
function getDriftOffset(elapsedMs) {
    const t = elapsedMs / 1000; // seconds
    const cycle = PARALLAX_CONFIG.driftCycleDuration;

    // Frequency ratio 1:2 creates figure-8 pattern
    const aX = (2 * Math.PI) / cycle;
    const aY = (4 * Math.PI) / cycle;

    // Phase offset so Y starts at zero crossing for smoother entry
    const phaseY = Math.PI / 2;

    const ampX = PARALLAX_CONFIG.driftAmplitudeXPercent;
    const ampY = PARALLAX_CONFIG.driftAmplitudeYPercent;

    return {
        x: ampX * Math.sin(aX * t),
        y: ampY * Math.sin(aY * t + phaseY),
    };
}

/* ============================================
   DEVICE ORIENTATION PARALLAX
   ============================================ */

/**
 * Clamp value to [-1, 1] range with deadzone.
 */
function normalizeTilt(value, maxDegrees) {
    if (Math.abs(value) < PARALLAX_CONFIG.neutralZoneDegrees) {
        return 0;
    }
    const clamped = Math.max(-maxDegrees, Math.min(maxDegrees, value));
    return clamped / maxDegrees; // [-1, 1]
}

/**
 * Exponential moving average smoothing.
 */
function emaSmooth(current, previous, alpha) {
    return alpha * current + (1 - alpha) * previous;
}

/**
 * Handle device orientation event.
 */
function onDeviceOrientation(event) {
    if (!_parallaxState.isActive) return;

    // beta: front-back tilt (-180 to 180), gamma: left-right tilt (-90 to 90)
    const rawBeta = event.beta || 0;
    const rawGamma = event.gamma || 0;

    _parallaxState.rawBeta = normalizeTilt(rawBeta, 30);   // ±30° for beta
    _parallaxState.rawGamma = normalizeTilt(rawGamma, 90); // ±90° for gamma
    _parallaxState.parallaxAvailable = true;
}

/**
 * Request iOS 13+ DeviceOrientation permission.
 */
async function requestIOSMotionPermission() {
    if (_parallaxState.iosPermissionRequested) return;
    _parallaxState.iosPermissionRequested = true;

    // Check if this is iOS with permission API
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
            const response = await DeviceOrientationEvent.requestPermission();
            if (response === 'granted') {
                window.addEventListener('deviceorientation', onDeviceOrientation);
            }
        } catch (err) {
            // Permission denied or error — parallax silently disabled, drift continues
            console.debug('[Parallax] iOS motion permission not granted');
        }
    } else if (typeof DeviceOrientationEvent !== 'undefined') {
        // Non-iOS device with the API available
        window.addEventListener('deviceorientation', onDeviceOrientation);
    }
}

/* ============================================
   COMPOSITOR & APPLIER
   ============================================ */

/**
 * Combine drift and parallax offsets, apply to active stage background-position.
 */
function composeAndApply() {
    if (!_parallaxState.isActive) return;

    const stage = _parallaxState.activeStage;
    if (!stage || !stage.classList.contains('active')) return;

    // Check mobile breakpoint each frame (handles rotation)
    if (window.innerWidth > PARALLAX_CONFIG.mobileBreakpoint) {
        return;
    }

    // Calculate drift offset
    let driftX = 0, driftY = 0;
    if (!_parallaxState.driftPaused) {
        const elapsed = performance.now() - _parallaxState.driftStartTime;
        const drift = getDriftOffset(elapsed);
        driftX = drift.x;
        driftY = drift.y;
    }

    // Smooth parallax values with EMA
    const alpha = PARALLAX_CONFIG.smoothingAlpha;
    _parallaxState.smoothGamma = emaSmooth(
        _parallaxState.rawGamma, _parallaxState.smoothGamma, alpha
    );
    _parallaxState.smoothBeta = emaSmooth(
        _parallaxState.rawBeta, _parallaxState.smoothBeta, alpha
    );

    // Parallax offsets — opposite direction mapping for "window" illusion
    const parallaxX = -_parallaxState.smoothGamma * PARALLAX_CONFIG.parallaxMaxOffsetX;
    const parallaxY = -_parallaxState.smoothBeta * PARALLAX_CONFIG.parallaxMaxOffsetY;

    // Compose: 50% center baseline + drift + parallax
    const finalX = 50 + driftX + parallaxX;
    const finalY = 50 + driftY + parallaxY;

    // Apply via CSS custom properties so the !important CSS rules can consume them.
    // Direct inline style.backgroundPosition is overridden by !important in media queries,
    // but custom properties set on the element cascade INTO those !important declarations.
    stage.style.setProperty('--parallax-bg-x', finalX + '%');
    stage.style.setProperty('--parallax-bg-y', finalY + '%');
}

/**
 * Main animation loop — single rAF handles both drift and parallax.
 */
function animationLoop() {
    composeAndApply();
    _parallaxState.rafId = requestAnimationFrame(animationLoop);
}

/* ============================================
   PUBLIC API
   ============================================ */

/**
 * Initialize the background parallax + drift system.
 * Called from game.js init().
 */
function initBackgroundParallax() {
    // Start the animation loop immediately — it self-checks isActive each frame
    _parallaxState.isActive = true;
    _parallaxState.driftStartTime = performance.now();
    _parallaxState.rafId = requestAnimationFrame(animationLoop);

    // Request iOS motion permission on first user gesture (audio overlay tap)
    const audioOverlay = document.getElementById('audio-waiting');
    if (audioOverlay) {
        const grantPermission = () => {
            requestIOSMotionPermission();
            audioOverlay.removeEventListener('click', grantPermission);
        };
        audioOverlay.addEventListener('click', grantPermission, { once: true });
    }

    // Fallback: also try non-iOS listener immediately
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'undefined') {
        window.addEventListener('deviceorientation', onDeviceOrientation);
    }
}

/**
 * Activate parallax + drift for a specific stage element.
 * Called from showStage() after the stage becomes active.
 */
function activateForStage(stageElement) {
    // Only apply to stages with background images (stages 1-4, treasure)
    const hasBgImage = window.getComputedStyle(stageElement, null)
        .getPropertyValue('background-image') !== 'none';

    if (!hasBgImage) {
        _parallaxState.activeStage = null;
        return;
    }

    // Skip title screen (stage 0) and proposal screen — they have different treatments
    const stageId = stageElement.id;
    if (stageId === 'stage-title' || stageId === 'stage-proposal') {
        _parallaxState.activeStage = null;
        return;
    }

    // Reset drift phase to start fresh for this stage
    _parallaxState.driftStartTime = performance.now();

    // Brief pause during transition to avoid jarring position jumps
    _parallaxState.driftPaused = true;
    _parallaxState.driftPauseStart = performance.now();

    // Reset parallax smoothing and raw values for clean entry
    _parallaxState.smoothBeta = 0;
    _parallaxState.smoothGamma = 0;
    _parallaxState.rawBeta = 0;
    _parallaxState.rawGamma = 0;

    // Set initial custom properties to center (drift will update these each frame)
    stageElement.style.setProperty('--parallax-bg-x', '50%');
    stageElement.style.setProperty('--parallax-bg-y', '50%');

    // Store reference and resume after transition pause
    _parallaxState.activeStage = stageElement;

    setTimeout(() => {
        _parallaxState.driftPaused = false;
    }, PARALLAX_CONFIG.transitionPauseMs);
}

/**
 * Reset parallax state (called externally if needed).
 */
function resetParallax() {
    _parallaxState.smoothBeta = 0;
    _parallaxState.smoothGamma = 0;
    _parallaxState.rawBeta = 0;
    _parallaxState.rawGamma = 0;
}
