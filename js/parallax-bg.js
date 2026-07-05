/**
 * Parallax Background Controller
 * Provides hybrid tilt-based + touch-drag parallax for mobile portrait backgrounds.
 * - Tilt (Android/iOS/permission granted): Uses Accelerometer API z-axis for forward/backward tilt
 * - Touch-drag (fallback): Uses touchmove events on the stage element
 * - Both stack additively when both are available
 */
(function () {
    'use strict';

    // === Configuration ===
    const MAX_OFFSET_PERCENT = 15; // Maximum background shift as % of container height
    const DAMPING_FACTOR = 0.12; // Lower = smoother/heavier feel (0.01 - 1.0)
    const TOUCH_SENSITIVITY = 0.6; // How far the background follows finger (1.0 = 1:1)
    const RESET_DELAY = 1500; // ms before auto-reset after touch ends

    // === State ===
    let targetY = 0; // Where we want the background to be (from tilt/touch)
    let currentY = 0; // Where the background currently is (smoothed)
    let touchStartY = 0;
    let touchOffsetY = 0;
    let isTouching = false;
    let sensorActive = false;
    let animationFrameId = null;
    let resetTimer = null;
    let tiltButtonEl = null;

    // === DOM References ===
    let bgBlurEl = null; // .bg-blur element
    let activeStageEl = null; // Currently active .stage element

    // === Initialization ===
    function init() {
        bgBlurEl = document.querySelector('.bg-blur');
        setupTiltSensor();
        setupTouchListeners();
        startAnimationLoop();
    }

    // === Tilt Sensor Setup ===
    function setupTiltSensor() {
        // Check if Accelerometer API is available (modern Android/iOS)
        if (typeof Accelerometer !== 'undefined') {
            setupAccelerometer();
            return;
        }

        // Check if DeviceOrientationEvent.requestPermission exists (iOS 13+/Android Chrome)
        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            createTiltButton();
            return;
        }

        // Fallback: try direct deviceorientation binding (older Android)
        if (typeof DeviceOrientationEvent !== 'undefined') {
            bindOrientationFallback();
            return;
        }

        console.log('[Parallax] No tilt sensor available, using touch-drag + mouse fallback');
        
        // Always bind mouse tilt as universal fallback when no sensor is available
        setupMouseTiltFallback();
    }

    // === Accelerometer API (Primary) ===
    function setupAccelerometer() {
        // Check if permission is already granted
        if (permissionGranted()) {
            bindAccelerometer();
            return;
        }

        // Need permission button
        createTiltButton();
    }

    function permissionGranted() {
        // Check if the sensor is already active
        if (typeof Accelerometer !== 'undefined') {
            // Create a test instance to check if it works
            try {
                const test = new Accelerometer({ frequency: 1 });
                test.stop();
                return true;
            } catch (e) {
                return false;
            }
        }
        return false;
    }

    function requestSensorPermission() {
        if (typeof Accelerometer !== 'undefined') {
            // Try to create an accelerometer - this will trigger permission prompt on some devices
            try {
                bindAccelerometer();
            } catch (e) {
                console.log('[Parallax] Sensor permission denied, using touch-drag');
            }
        } else if (typeof DeviceOrientationEvent !== 'undefined' &&
                   typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(function (permissionState) {
                    if (permissionState === 'granted') {
                        bindAccelerometer();
                    } else {
                        console.log('[Parallax] Permission denied, using touch-drag');
                    }
                })
                .catch(function (err) {
                    console.log('[Parallax] Permission error:', err);
                });
        }
    }

    function bindAccelerometer() {
        if (typeof Accelerometer === 'undefined') return;

        const accelerometer = new Accelerometer({ frequency: 30 });

        accelerometer.addEventListener('reading', function () {
            // z-axis: when phone is flat (screen up), z ≈ 9.8 (gravity pointing into screen)
            // when phone is vertical (screen facing user), z ≈ 0
            // We use -z because we want: flat = 0 offset, vertical = max offset
            const z = -accelerometer.z;

            // Clamp: z ranges from ~0 (vertical) to ~9.8 (flat on table)
            // Only respond when phone is held in hand (z < 8, i.e., tilted up enough)
            if (z < 1 || z > 8) {
                // Phone is flat on table or moving too fast, skip
                return;
            }

            sensorActive = true;

            // Map z to angle: z=1 → ~83°, z=8 → ~46°
            const angle = Math.asin(Math.max(0, Math.min(1, z / 9.8))) * (180 / Math.PI);

            // Map angle to offset percentage
            // When angle ≈ 83° (phone nearly flat): offset = 0% (center)
            // When angle ≈ 46° (phone tilted up): offset = -MAX to +MAX
            const normalizedAngle = (angle - 46) / (83 - 46); // 0 (flat) to 1 (vertical)
            let offsetPercent = normalizedAngle * MAX_OFFSET_PERCENT;

            // Clamp
            offsetPercent = Math.max(-MAX_OFFSET_PERCENT, Math.min(MAX_OFFSET_PERCENT, offsetPercent));

            // When tilting phone forward (top away from you), shift background down
            // When tilting phone back (top toward you), shift background up
            targetY = offsetPercent;
        });

        accelerometer.start();
    }

    // === Orientation Fallback (older Android) ===
    function bindOrientationFallback() {
        const handler = function (e) {
            const beta = e.beta;
            if (beta === null || beta === undefined) return;

            sensorActive = true;

            // Use gamma (left-right tilt) as secondary indicator
            const gamma = e.gamma || 0;

            // Map gamma (-90 to 90) to offset
            let offsetPercent = (gamma / 90) * MAX_OFFSET_PERCENT;
            offsetPercent = Math.max(-MAX_OFFSET_PERCENT, Math.min(MAX_OFFSET_PERCENT, offsetPercent));

            targetY = offsetPercent;
        };

        window.addEventListener('deviceorientation', handler, true);
    }

    // === "Enable Tilt" Permission Button ===
    function createTiltButton() {
        // Check if button already exists
        if (document.getElementById('tilt-enable-btn')) return;

        tiltButtonEl = document.createElement('button');
        tiltButtonEl.id = 'tilt-enable-btn';
        tiltButtonEl.textContent = '🎮 Enable tilt effect';
        tiltButtonEl.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);' +
            'z-index:10000;padding:12px 24px;background:#f5a623;color:#000;border:none;' +
            'border-radius:8px;font-family:sans-serif;font-size:14px;cursor:pointer;' +
            'box-shadow:0 4px 12px rgba(0,0,0,0.3);display:none;';

        tiltButtonEl.addEventListener('click', function () {
            requestSensorPermission();
            tiltButtonEl.style.display = 'none';
        });

        document.body.appendChild(tiltButtonEl);

        // Show button after a delay if no sensor data received
        setTimeout(function () {
            if (!sensorActive) {
                tiltButtonEl.style.display = 'block';
            }
        }, 2000);
    }

    // === Mouse Tilt Fallback (Desktop) ===
    function setupMouseTiltFallback() {
        // Map horizontal mouse position to tilt offset
        // Center (50%) = 0 offset, left = -MAX, right = +MAX
        window.addEventListener('mousemove', function (e) {
            // Only apply when no tilt sensor is active
            if (sensorActive) return;

            const normalizedX = (e.clientX / window.innerWidth) - 0.5;
            targetY = normalizedX * 2 * MAX_OFFSET_PERCENT;
            targetY = Math.max(-MAX_OFFSET_PERCENT, Math.min(MAX_OFFSET_PERCENT, targetY));
        }, { passive: true });
    }

    // === Touch-Drag (on stage element, not bg-blur) ===
    function setupTouchListeners() {
        // Only enable touch on mobile screens
        if (window.innerWidth > 600) return;

        // Attach to the active stage only (bg-blur has pointer-events: none)
        function attachTouchListeners(stageEl) {
            stageEl.addEventListener('touchstart', handleTouchStart, { passive: true });
            stageEl.addEventListener('touchmove', handleTouchMove, { passive: true });
            stageEl.addEventListener('touchend', handleTouchEnd, { passive: true });
        }

        // Attach to currently active stage
        const activeStage = document.querySelector('.stage.active');
        if (activeStage) {
            attachTouchListeners(activeStage);
        }

        // Watch for stages becoming active
        if (typeof MutationObserver !== 'undefined') {
            const observer = new MutationObserver(function (mutations) {
                mutations.forEach(function (mutation) {
                    // When a stage's class changes, re-attach listeners to the new active stage
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        const target = mutation.target;
                        if (target.classList && target.classList.contains('stage')) {
                            // Guard: skip if element is no longer in DOM (parentNode is null)
                            if (!target.parentNode) return;

                            // Remove existing listeners by cloning node
                            const newStage = target.cloneNode(true);
                            target.parentNode.replaceChild(newStage, target);
                            if (newStage.classList.contains('active')) {
                                attachTouchListeners(newStage);
                            }
                        }
                        return;
                    }
                    // When a new stage is added
                    mutation.addedNodes.forEach(function (node) {
                        if (node.nodeType === 1 && node.classList && node.classList.contains('stage')) {
                            if (node.classList.contains('active')) {
                                attachTouchListeners(node);
                            }
                        }
                        if (node.nodeType === 1) {
                            node.querySelectorAll('.stage').forEach(function(s) {
                                if (s.classList.contains('active')) {
                                    attachTouchListeners(s);
                                }
                            });
                        }
                    });
                });
            });
            observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
        }
    }

    function handleTouchStart(e) {
        // Only respond to touches on the stage element itself
        if (e.target.closest('.stage') === null) return;
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