/**
 * Confetti.js - CSS-based pixel particle confetti system
 * Creates, animates, and cleans up blocky particle elements
 */

const Confetti = (() => {
    let particles = [];
    let animationId = null;
    let intervalId = null;
    let isActive = false;

    // Max particle count based on device
    const MAX_PARTICLES = (window.innerWidth < 768) ? 30 : 60;
    const SPAWN_RATE = 100; // ms between spawns

    const COLORS = [
        '#e63946', // pixel red
        '#f5a623', // gold
        '#ffffff', // white
        '#4ade80', // green
        '#ffd700', // bright gold
        '#ff69b4', // pink
    ];

    /**
     * Create a single confetti particle DOM element
     */
    function createParticle() {
        if (particles.length >= MAX_PARTICLES) return;

        const particle = document.createElement('div');
        particle.className = 'confetti-particle';
        const color = COLORS[Math.floor(Math.random() * COLORS.length)];
        const size = 4 + Math.floor(Math.random() * 5); // 4-8px
        const startX = Math.random() * 100;
        const duration = 2 + Math.random() * 2; // 2-4s
        const swayAmount = 20 + Math.random() * 30;

        particle.style.width = size + 'px';
        particle.style.height = size + 'px';
        particle.style.backgroundColor = color;
        particle.style.left = startX + '%';
        particle.style.top = '-10px';
        particle.style.opacity = 0.8 + Math.random() * 0.2;

        // Apply fall animation
        const sway = Math.random() > 0.5 ? 1 : -1;
        particle.style.animation = `confettiFall ${duration}s linear forwards, confettiSway ${0.5 + Math.random() * 0.5}s ease-in-out infinite`;
        particle.style.setProperty('--sway', (swayAmount * sway) + 'px');

        // Remove element when animation ends
        particle.addEventListener('animationend', () => {
            if (particle.parentNode) {
                particle.parentNode.removeChild(particle);
            }
            const index = particles.indexOf(particle);
            if (index > -1) {
                particles.splice(index, 1);
            }
        });

        return particle;
    }

    /**
     * Spawn a batch of particles
     */
    function spawnParticles() {
        if (!isActive) return;

        const count = Math.min(3, MAX_PARTICLES - particles.length);
        for (let i = 0; i < count; i++) {
            const particle = createParticle();
            if (particle) {
                const container = document.querySelector('.confetti-container');
                if (container) {
                    container.appendChild(particle);
                    particles.push(particle);
                }
            }
        }
    }

    /**
     * Intensify confetti (triggered on YES button)
     */
    function intensify() {
        if (!isActive) return;

        // Burst of particles
        const burstCount = 15;
        for (let i = 0; i < burstCount; i++) {
            setTimeout(() => {
                const particle = createParticle();
                if (particle) {
                    const container = document.querySelector('.confetti-container');
                    if (container) {
                        container.appendChild(particle);
                        particles.push(particle);
                    }
                }
            }, i * 50);
        }
    }

    /**
     * Start the confetti system
     */
    function start() {
        if (isActive) {
            // Clean up existing first (prevent DOM leaks)
            stop();
        }

        isActive = true;
        intervalId = setInterval(spawnParticles, SPAWN_RATE);
    }

    /**
     * Stop the confetti system and clean up all particles
     */
    function stop() {
        isActive = false;

        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }

        // Remove all particles from DOM
        particles.forEach(p => {
            if (p.parentNode) {
                p.parentNode.removeChild(p);
            }
        });
        particles = [];

        // Clear container
        const container = document.querySelector('.confetti-container');
        if (container) {
            container.innerHTML = '';
        }
    }

    return {
        start,
        stop,
        intensify,
        isActive: () => isActive
    };
})();

// Inject confetti keyframe animations
(function injectConfettiAnimations() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes confettiFall {
            0% { transform: translateY(-10px) rotate(0deg); }
            100% { transform: translateY(100vh) rotate(360deg); }
        }
        @keyframes confettiSway {
            0%, 100% { margin-left: 0; }
            50% { margin-left: var(--sway); }
        }
    `;
    document.head.appendChild(style);
})();