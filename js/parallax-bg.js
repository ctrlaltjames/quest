/**
 * Parallax Background Controller
 * Provides hybrid tilt-based + touch-drag parallax for mobile portrait backgrounds.
 * - Tilt (Android/iOS/permission granted): Uses Accelerometer API z-axis for forward/backward tilt
 * - Touch-drag (fallback): Uses touchmove events on the stage element
 * - Both stack additively when both are available
 */
(function () {
    'use strict';

    // === VISIBLE DIAGNOSTIC MARKER ===
    var _diagMarker = document.createElement('div');
    _diagMarker.id = 'parallax-script-marker';
    _diagMarker.style.cssText = 'position:fixed;bottom:10px;left:10px;z-index:999999;background:#f00;color:#fff;padding:8px 12px;border-radius:4px;font:bold 14px monospace;';
    _diagMarker.textContent = 'PARALLAX LOADED';
    document.body.appendChild(_diagMarker);
    console.log('[Parallax] Script loaded successfully');

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

        // Create diagnostic overlay on mobile
        if (window.innerWidth <= 600) {
            createDiagnosticOverlay();
        } else {
            // Always create overlay for debugging on desktop too
            createDiagnosticOverlay();
        }
    }

    // === Tilt Sensor Setup ===
    function setupTiltSensor() {
        // DIAGNOSTIC: Log sensor availability
        console.log('[Parallax-Diag] === Tilt Sensor Diagnosis ===');
        console.log('[Parallax-Diag] typeof Accelerometer:', typeof Accelerometer);
        console.log('[Parallax-Diag] typeof DeviceOrientationEvent:', typeof DeviceOrientationEvent);
        console.log('[Parallax-Diag] DeviceOrientationEvent.requestPermission exists:',
            typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function');
        console.log('[Parallax-Diag] isSecureContext:', isSecureContext);
        console.log('[Parallax-Diag] window.innerWidth:', window.innerWidth);
        console.log('[Parallax-Diag] ==================================');

        // Check if Accelerometer API is available (modern Android/iOS)
        if (typeof Accelerometer !== 'undefined') {
            console.log('[Parallax-Diag] Using Accelerometer API (Tier 1)');
            setupAccelerometer();
            return;
        }

        // Check if DeviceOrientationEvent.requestPermission exists (iOS 13+/Android Chrome)
        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            console.log('[Parallax-Diag] Using iOS 13+ permission flow (Tier 2)');
            createTiltButton();
            return;
        }

        // Fallback: try direct deviceorientation binding (older Android)
        if (typeof DeviceOrientationEvent !== 'undefined') {
            console.log('[Parallax-Diag] Using direct orientation binding (Tier 3)');
            bindOrientationFallback();
            return;
        }

        console.log('[Parallax] No tilt sensor available, using touch-drag + mouse fallback');
        console.log('[Parallax-Diag] Using mouse tilt fallback (no sensor)');

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

        console.log('[Parallax-Diag] Creating tilt permission button');
        console.log('[Parallax-Diag] sensorActive at button creation:', sensorActive);

        tiltButtonEl = document.createElement('button');
        tiltButtonEl.id = 'tilt-enable-btn';
        tiltButtonEl.textContent = '🎮 Enable tilt effect';
        tiltButtonEl.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);' +
            'z-index:10000;padding:12px 24px;background:#f5a623;color:#000;border:none;' +
            'border-radius:8px;font-family:sans-serif;font-size:14px;cursor:pointer;' +
            'box-shadow:0 4px 12px rgba(0,0,0,0.3);display:none;';

        tiltButtonEl.addEventListener('click', function () {
            console.log('[Parallax-Diag] Tilt button clicked!');
            requestSensorPermission();
            tiltButtonEl.style.display = 'none';
        });

        document.body.appendChild(tiltButtonEl);
        console.log('[Parallax-Diag] Tilt button appended to body, initial display:', tiltButtonEl.style.display);

        // Show button after a delay if no sensor data received
        setTimeout(function () {
            console.log('[Parallax-Diag] Timeout fired - sensorActive:', sensorActive, 'button display:', tiltButtonEl.style.display);
            if (!sensorActive) {
                tiltButtonEl.style.display = 'block';
                console.log('[Parallax-Diag] Button now visible (display:block)');
            } else {
                console.log('[Parallax-Diag] NOT showing button - sensor already active');
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
        console.log('[Parallax-Diag] setupTouchListeners called, window.innerWidth:', window.innerWidth);
        if (window.innerWidth > 600) {
            console.log('[Parallax-Diag] Touch listeners DISABLED - screen width > 600px');
            return;
        }
        console.log('[Parallax-Diag] Touch listeners ENABLED - mobile screen detected');

        // Attach to the active stage only (bg-blur has pointer-events: none)
        function attachTouchListeners(stageEl) {
            console.log('[Parallax-Diag] attachTouchListeners called on:', stageEl.id, 'element:', stageEl);
            stageEl.addEventListener('touchstart', handleTouchStart, { passive: true });
            stageEl.addEventListener('touchmove', handleTouchMove, { passive: true });
            stageEl.addEventListener('touchend', handleTouchEnd, { passive: true });
            console.log('[Parallax-Diag] Touch listeners attached to:', stageEl.id);
        }

        // Attach to currently active stage
        const activeStage = document.querySelector('.stage.active');
        console.log('[Parallax-Diag] Found active stage:', activeStage ? activeStage.id : 'null');
        if (activeStage) {
            attachTouchListeners(activeStage);
        }

        // Watch for stages becoming active
        if (typeof MutationObserver !== 'undefined') {
            console.log('[Parallax-Diag] MutationObserver initialized');
            const observer = new MutationObserver(function (mutations) {
                mutations.forEach(function (mutation) {
                    // When a stage's class changes, re-attach listeners to the new active stage
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        const target = mutation.target;
                        console.log('[Parallax-Diag] MutationObserver: class change on', target.id, 'classList:', target.className);
                        if (target.classList && target.classList.contains('stage')) {
                            // Guard: skip if element is no longer in DOM (parentNode is null)
                            if (!target.parentNode) {
                                console.log('[Parallax-Diag] MutationObserver: target has no parentNode, skipping');
                                return;
                            }

                            // DIAGNOSTIC: Log the clone operation
                            console.log('[Parallax-Diag] CLONE OPERATION: Replacing', target.id, 'with new element');
                            console.log('[Parallax-Diag] CLONE: Old element has children:', target.children.length);

                            // Remove existing listeners by cloning node
                            const newStage = target.cloneNode(true);
                            console.log('[Parallax-Diag] CLONE: New element id:', newStage.id, 'classList:', newStage.className);
                            target.parentNode.replaceChild(newStage, target);
                            console.log('[Parallax-Diag] CLONE: Replace complete. New active:', newStage.classList.contains('active'));
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
        // DIAGNOSTIC: Log touch start
        console.log('[Parallax-Diag] handleTouchStart called! e.target:', e.target, 'tagName:', e.target.tagName);
        console.log('[Parallax-Diag] closest(.stage):', e.target.closest('.stage'));

        // Only respond to touches on the stage element itself
        if (e.target.closest('.stage') === null) {
            console.log('[Parallax-Diag] Touch NOT on stage, ignoring');
            return;
        }
        touchStartY = e.touches[0].clientY;
        touchOffsetY = 0;
        isTouching = true;
        console.log('[Parallax-Diag] isTouching = true, touchStartY:', touchStartY);
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
        console.log('[Parallax-Diag] handleTouchMove - deltaY:', deltaY, 'touchOffsetY:', touchOffsetY);
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
        console.log('[Parallax-Diag] Animation loop started');
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
        if (!bgBlurEl) {
            console.log('[Parallax-Diag] updateBackgroundPosition FAILED - bgBlurEl is null');
            return;
        }

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

        // Update diagnostic overlay
        updateDiagnosticOverlay();
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

    // === Diagnostic Overlay ===
    let diagOverlayEl = null;
    let diagVisible = false;

    function createDiagnosticOverlay() {
        if (diagOverlayEl) return;

        diagOverlayEl = document.createElement('div');
        diagOverlayEl.id = 'parallax-diag-overlay';
        diagOverlayEl.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;' +
            'background:rgba(0,0,0,0.85);color:#0f0;font:11px/1.4 monospace;' +
            'padding:10px;border-radius:6px;max-width:280px;pointer-events:auto;' +
            'cursor:move;user-select:none;box-shadow:0 4px 12px rgba(0,0,0,0.5);display:block;';

        diagOverlayEl.innerHTML = `
            <div style="text-align:center;margin-bottom:6px;">
                <span style="color:#ff0;font-weight:bold;">⚙ Parallax Debug</span>
                <span id="diag-toggle" style="margin-left:8px;cursor:pointer;color:#0ff;">[HIDE]</span>
            </div>
            <div id="diag-content"></div>
            <div style="text-align:center;margin-top:8px;padding-top:6px;border-top:1px solid #333;">
                <button id="diag-force-tilt-btn" style="background:#f5a623;color:#000;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px;">Force Show Tilt Button</button>
            </div>
        `;

        // Toggle visibility
        document.getElementById('diag-toggle').addEventListener('click', function () {
            diagVisible = !diagVisible;
            this.textContent = diagVisible ? '[HIDE]' : '[SHOW]';
            diagOverlayEl.style.display = diagVisible ? 'block' : 'none';
        });

        // Make draggable
        makeDraggable(diagOverlayEl);

        // Force show tilt button (for testing)
        document.getElementById('diag-force-tilt-btn').addEventListener('click', function () {
            console.log('[Parallax-Diag] Force showing tilt button');
            if (tiltButtonEl) {
                tiltButtonEl.style.display = 'block';
                console.log('[Parallax-Diag] Tilt button now visible');
            } else {
                console.log('[Parallax-Diag] tiltButtonEl is null, creating new button');
                createTiltButton();
                setTimeout(function () {
                    if (tiltButtonEl) {
                        tiltButtonEl.style.display = 'block';
                    }
                }, 100);
            }
        });

        document.body.appendChild(diagOverlayEl);
        diagVisible = true;
    }

    function updateDiagnosticOverlay() {
        if (!diagOverlayEl || !diagVisible) return;

        const content = document.getElementById('diag-content');
        if (!content) return;

        const isMobile = window.innerWidth <= 600;
        const isSecure = isSecureContext;

        // Sensor state
        let sensorStatus = '❌ None';
        if (typeof Accelerometer !== 'undefined') {
            sensorStatus = '🔵 Accelerometer API';
        }
        if (typeof DeviceOrientationEvent !== 'undefined') {
            sensorStatus += '\n🔵 DeviceOrientation';
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                sensorStatus += '\n🔴 iOS permission required';
            }
        }

        const lines = [
            ['Device', isMobile ? '📱 Mobile' : '🖥 Desktop'],
            ['Secure', isSecure ? '✅ Yes' : '❌ No'],
            ['Width', window.innerWidth + 'px'],
            ['Sensor', sensorStatus.replace(/\n/g, '<br>')],
            ['Tilt Active', sensorActive ? '✅ Yes' : '❌ No'],
            ['targetY', targetY.toFixed(2) + '%'],
            ['currentY', currentY.toFixed(2) + '%'],
            ['Touching', isTouching ? '✅ Yes' : '❌ No'],
            ['touchOffset', touchOffsetY.toFixed(2) + '%'],
            ['touchStart', touchStartY],
            ['Active Stage', document.querySelector('.stage.active')?.id || 'none'],
            ['tiltBtn visible', document.getElementById('tilt-enable-btn')?.style.display === 'block' ? '✅ Yes' : '❌ No'],
        ];

        content.innerHTML = lines.map(function (l) {
            return '<div style="margin:2px 0;"><span style="color:#888">' + l[0] + ': </span>' + l[1] + '</div>';
        }).join('');
    }

    function makeDraggable(el) {
        let isDragging = false;
        let startX, startY, origX, origY;

        el.addEventListener('touchstart', function (e) {
            if (e.target.id === 'diag-toggle') return;
            isDragging = true;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            origX = el.offsetLeft;
            origY = el.offsetTop;
            e.preventDefault();
        }, { passive: false });

        el.addEventListener('touchmove', function (e) {
            if (!isDragging) return;
            el.style.left = (origX + e.touches[0].clientX - startX) + 'px';
            el.style.top = (origY + e.touches[0].clientY - startY) + 'px';
            el.style.right = 'auto';
            e.preventDefault();
        }, { passive: false });

        el.addEventListener('touchend', function () {
            isDragging = false;
        });
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