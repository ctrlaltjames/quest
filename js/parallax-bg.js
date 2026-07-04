/**
 * Parallax Background Controller
 * Provides hybrid tilt-based + touch-drag parallax for mobile portrait backgrounds.
 * - Tilt (Android/permission granted): Uses DeviceOrientation API beta value
 * - Touch-drag (iOS/fallback): Uses touchmove events on the background layer
 * - Both stack additively when both are available
 */
(function () {
    'use strict';

    // === Configuration ===
    const MAX_OFFSET_PERCENT = 15; // Maximum background shift as % of container height
    const DAMPING_FACTOR = 0.12; // Lower = smoother/heavier feel (0.01 - 1.0)
    const TILT_SENSITIVITY = 6; // Beta range multiplier (lower = more sensitive)
    const TILT_DEADZONE = 1; // Ignore small beta values near center
    const TOUCH_SENSITIVITY = 0.6; // How far the background follows finger (1.0 = 1:1)
    const RESET_DELAY = 1500; // ms before auto-reset after touch ends

    // === State ===
    let targetY = 0; // Where we want the background to be (from tilt/touch)
    let currentY = 0; // Where the background currently is (smoothed)
    let touchStartY = 0;
    let touchOffsetY = 0;
    let isTouching = false;
    let iosPermissionGranted = false;
    let orientationSensorAvailable = false;
    let animationFrameId = null;
    let resetTimer = null;

    // === DOM References ===
    let bgBlurEl = null; // .bg-blur element
    let activeStageEl = null; // Currently active .stage element

    // === Initialization ===
    function init() {
        bgBlurEl = document.querySelector('.bg-blur');
        setupOrientation();
        setupTouchListeners();
        startAnimationLoop();
    }

    // === Device Orientation (Tilt) ===
    function setupOrientation() {
        // Check if DeviceOrientationEvent exists
        if (typeof DeviceOrientationEvent === 'undefined') {
            console.log('[Parallax] DeviceOrientation not supported');
            return;
        }

        // iOS 13+ requires permission
        if (isIOS13Plus()) {
            requestIOSPermission();
            return;
        }

        // Android/non-iOS: bind directly
        bindOrientation();
    }

    function isIOS13Plus() {
        const ua = navigator.userAgent;
        return /iPhone|iPad|iPod/.test(ua) && ua.includes('MacIntel') && /OS [1-9]_|OS 1[3-9]_/.test(ua);
    }

    function requestIOSPermission() {
        const event = DeviceOrientationEvent;
        if (typeof event.requestPermission === 'function') {
            // Only request on user gesture
            const grant = function grantPermission(e) {
                e.preventDefault();
                event.requestPermission()
                    .then(function (permissionState) {
                        if (permissionState === 'granted') {
                            iosPermissionGranted = true;
                            bindOrientation();
                        } else {
                            console.log('[Parallax] iOS permission denied');
                        }
                    })
                    .catch(function (err) {
                        console.log('[Parallax] iOS permission error:', err);
                    })
                    .finally(function () {
                        // Remove the listener after it fires once
                        document.removeEventListener('touchstart', grant, { capture: true });
                        document.removeEventListener('click', grant, { capture: true });
                    });
            };
            // Listen for first touch/click to request permission
            document.addEventListener('touchstart', grant, { capture: true, once: false });
            document.addEventListener('click', grant, { capture: true, once: false });
        }
    }

    function bindOrientation() {
        const handler = function (e) {
            const beta = e.beta; // Front-to-back tilt: -180 to 180
            if (beta === null || beta === undefined) return;

            orientationSensorAvailable = true;

            // Apply deadzone
            let adjustedBeta = beta;
            if (adjustedBeta > -TILT_DEADZONE && adjustedBeta < TILT_DEADZONE) {
                adjustedBeta = 0;
            }

            // Map beta (-30 to 30 degrees) to offset percentage (-MAX to +MAX)
            // Beta: positive = tilted forward (top toward you), negative = tilted back
            let offsetPercent = (adjustedBeta / TILT_SENSITIVITY) * MAX_OFFSET_PERCENT;

            // Clamp to max
            offsetPercent = Math.max(-MAX_OFFSET_PERCENT, Math.min(MAX_OFFSET_PERCENT, offsetPercent));

            // When tilting forward (positive beta), shift background down (positive Y)
            // When tilting back (negative beta), shift background up (negative Y)
            targetY = offsetPercent;
        };

        window.addEventListener('deviceorientation', handler, true);
    }

    // === Touch-Drag ===
    function setupTouchListeners() {
        // Only enable touch on mobile screens
        if (window.innerWidth > 600) return;

        // We attach to the bg-blur element so touches on it move the background
        if (bgBlurEl) {
            bgBlurEl.addEventListener('touchstart', handleTouchStart, { passive: true });
            bgBlurEl.addEventListener('touchmove', handleTouchMove, { passive: false });
            bgBlurEl.addEventListener('touchend', handleTouchEnd, { passive: true });
        }
    }

    function handleTouchStart(e) {
        touchStartY = e.touches[0].clientY;
        touchOffsetY = 0;
        isTouching = true;
        clearResetTimer();
    }

    function handleTouchMove(e) {
        if (!isTouching) return;

        const deltaY = e.touches[0].clientY - touchStartY;
        // Convert pixel delta to percentage of container height
        const containerHeight = window.innerHeight || document.documentElement.clientHeight;
        touchOffsetY = (deltaY / containerHeight) * 100 * TOUCH_SENSITIVITY;

        // Clamp
        touchOffsetY = Math.max(-MAX_OFFSET_PERCENT, Math.min(MAX_OFFSET_PERCENT, touchOffsetY));

        // Only prevent default on horizontal-ish drags (not vertical scroll)
        const deltaX = e.touches[0].clientX - (e.touches.length > 1 ? 0 : 0);
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 5) {
            e.preventDefault();
        }
    }

    function handleTouchEnd() {
        if (!isTouching) return;
        isTouching = false;

        // Auto-reset after delay
        clearResetTimer();
        resetTimer = setTimeout(function () {
            startReset();
        }, RESET_DELAY);
    }

    function startReset() {
        // Smoothly animate back to center
        const startY = touchOffsetY;
        const startTime = performance.now();
        const duration = 400; // ms

        function animateReset(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);

            touchOffsetY = startY * (1 - eased);

            if (progress < 1) {
                requestAnimationFrame(animateReset);
            } else {
                touchOffsetY = 0;
            }
        }

        requestAnimationFrame(animateReset);
    }

    function clearResetTimer() {
        if (resetTimer) {
            clearTimeout(resetTimer);
            resetTimer = null;
        }
    }

    // === Animation Loop ===
    function startAnimationLoop() {
        function animate() {
            // Combine tilt offset + touch offset
            let finalOffset = targetY;
            if (isTouching) {
                finalOffset = targetY + touchOffsetY;
            } else if (touchOffsetY !== 0) {
                finalOffset = targetY + touchOffsetY;
            }

            // Apply damping (lerp)
            currentY += (finalOffset - currentY) * DAMPING_FACTOR;

            // Only update if there's meaningful change
            if (Math.abs(currentY) > 0.01) {
                updateBackgroundPosition(currentY);
            }

            animationFrameId = requestAnimationFrame(animate);
        }

        animationFrameId = requestAnimationFrame(animate);
    }

    function updateBackgroundPosition(offsetY) {
        if (!bgBlurEl) return;

        // Calculate the actual background position
        // Center is 50% 50%, we offset the Y component
        const baseY = 50;
        const adjustedY = baseY + offsetY;

        const bgPos = 'center ' + adjustedY.toFixed(2) + '%';

        // Update the bg-blur background position
        bgBlurEl.style.backgroundPosition = bgPos;

        // Update the active stage background position (if available)
        if (activeStageEl) {
            activeStageEl.style.backgroundPosition = bgPos;
        }
    }

    // === Public API ===
    function setActiveStage(stageEl) {
        activeStageEl = stageEl;
    }

    function reset() {
        targetY = 0;
        currentY = 0;
        touchOffsetY = 0;
        isTouching = false;
        clearResetTimer();
    }

    // Expose to global
    window.ParallaxBG = {
        init: init,
        setActiveStage: setActiveStage,
        reset: reset
    };

    // Auto-init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();