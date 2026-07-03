# Stage 4 Co-Op Implementation Guide

## Overview

This document provides all the details needed to implement Stage 4's transformation from a text-answer puzzle to a 2-player co-op button-press mechanic. Both players must press their buttons simultaneously to proceed to the proposal screen.

**Theme:** Boy and girl sitting in front of a TV playing co-op video games together.

**Cat Easter Egg:** Removed from this project.

---

## Files to Modify

| File | Change |
|------|--------|
| `js/game.js` | Update CONFIG + add co-op functions |
| `index.html` | Replace Stage 4 input with co-op buttons |
| `css/style.css` | Add co-op button styles |

---

## 1. CONFIG Update (js/game.js)

Replace the current Stage 4 entry (lines 36-41) in the CONFIG object:

### BEFORE:
```javascript
{
    id: 4,
    title: "Chapter 4: The Treasure of Forever",
    clue: "You've conquered the zombie lands, survived the dangerous frontier, and proved your love is infinite. All these quests led to this treasure... What do you say?",
    answer: ["yes", "i do", "yes i do"],
},
```

### AFTER:
```javascript
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
```

---

## 2. Add Co-Op State and Functions (js/game.js)

Add this new state object after the existing `state` object (around line 63):

```javascript
/* ============================================
   CO-OP GAME MECHANIC (Stage 4)
   ============================================ */

const coOpState = {
    player1Tapped: false,
    player2Tapped: false,
    timeoutId: null,
};
```

Add these functions after the `resetCoOp` function (add before the `bindEvents` function around line 524):

```javascript
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
    const btn = document.querySelector(`.coop-btn[data-player="${playerNum}"]`);
    if (btn) btn.classList.add('tapped');

    // Check if both tapped
    if (coOpState.player1Tapped && coOpState.player2Tapped) {
        clearTimeout(coOpState.timeoutId);

        // Success animation
        document.querySelectorAll('.coop-btn').forEach(b => b.classList.add('success'));
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
    document.querySelectorAll('.coop-btn').forEach(b => b.classList.remove('tapped'));
}
```

---

## 3. Update showStage() for Co-Op (js/game.js)

In the `showStage` function, add co-op reset logic when entering Stage 4. Find the existing stage-specific handling and add this after the `if (n >= 1 && n <= 4)` block (around line 284):

```javascript
// Reset co-op state when entering Stage 4
if (n === 4) {
    resetCoOp();
}
```

---

## 4. Update bindEvents() for Co-Op Buttons (js/game.js)

Add co-op button event listeners in the `bindEvents` function (after the existing event binding, around line 566):

```javascript
    // Co-op buttons (Stage 4)
    document.querySelectorAll('.coop-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const playerNum = parseInt(btn.getAttribute('data-player'), 10);
            if (playerNum) {
                handleCoOpTap(playerNum);
            }
        });
    });
```

---

## 5. HTML Update (index.html)

Replace the entire Stage 4 section with the co-op button layout. Find the current `stage-4` section and replace it:

### BEFORE:
```html
<section id="stage-4" class="stage" data-stage="4">
    <div class="dialogue-box">
        <h2 id="stage-4-title" class="stage-title">Chapter 4: The Treasure of Forever</h2>
        <p id="stage-4-clue" class="clue-text"></p>
        <input type="text" id="input-4" class="stage-input" placeholder="Enter your answer..." autocomplete="off">
        <button class="btn-check" data-stage="4">CHECK</button>
    </div>
</section>
```

### AFTER:
```html
<section id="stage-4" class="stage" data-stage="4">
    <div class="dialogue-box">
        <h2 id="stage-4-title" class="stage-title">Chapter 4: Player 2 Joined</h2>
        <p id="stage-4-clue" class="clue-text"></p>

        <!-- Co-op section replaces text input -->
        <div class="coop-section" id="coop-section-4">
            <p class="coop-prompt">Both players tap together!</p>
            <div class="coop-buttons">
                <button class="coop-btn" data-player="1">
                    <span class="coop-label">Player 1</span>
                    <span class="coop-key">A</span>
                </button>
                <button class="coop-btn" data-player="2">
                    <span class="coop-label">Player 2</span>
                    <span class="coop-key">B</span>
                </button>
            </div>
        </div>
    </div>
</section>
```

---

## 6. CSS Styles (css/style.css)

Add these styles at the end of the file:

```css
/* ============================================
   CO-OP BUTTON STYLES (Stage 4)
   ============================================ */

.coop-section {
    margin-top: 24px;
    text-align: center;
}

.coop-prompt {
    font-family: var(--font-pixel);
    font-size: clamp(10px, 3vw, 14px);
    color: var(--color-text);
    margin-bottom: 16px;
    opacity: 0.8;
}

.coop-buttons {
    display: flex;
    gap: 16px;
    justify-content: center;
    margin: 16px 0;
}

.coop-btn {
    position: relative;
    width: 80px;
    height: 80px;
    border: 3px solid var(--color-primary);
    border-radius: 12px;
    background: rgba(0, 0, 0, 0.3);
    color: var(--color-text);
    font-family: var(--font-pixel);
    cursor: pointer;
    transition: all 0.1s ease;
    touch-action: manipulation;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.coop-btn:active {
    transform: scale(0.95);
}

.coop-btn .coop-label {
    display: block;
    font-size: 8px;
    opacity: 0.7;
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.coop-btn .coop-key {
    font-size: 28px;
    font-weight: bold;
}

.coop-btn.tapped {
    border-color: #ffd700;
    background: rgba(255, 215, 0, 0.2);
    animation: coOpPulse 0.5s ease;
    box-shadow: 0 0 15px rgba(255, 215, 0, 0.3);
}

.coop-btn.success {
    border-color: #4ade80;
    background: rgba(74, 222, 128, 0.3);
    animation: coOpSuccess 0.8s ease;
    box-shadow: 0 0 30px rgba(74, 222, 128, 0.5);
}

@keyframes coOpPulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
}

@keyframes coOpSuccess {
    0% { transform: scale(1); box-shadow: 0 0 0 rgba(74, 222, 128, 0); }
    50% { transform: scale(1.2); box-shadow: 0 0 30px rgba(74, 222, 128, 0.5); }
    100% { transform: scale(1); box-shadow: 0 0 0 rgba(74, 222, 128, 0); }
}

/* Mobile adjustments for co-op buttons */
@media (max-width: 428px) {
    .coop-btn {
        width: 70px;
        height: 70px;
    }

    .coop-btn .coop-key {
        font-size: 24px;
    }

    .coop-buttons {
        gap: 12px;
    }
}
```

---

## 7. Pixel Art Asset (Optional)

If you want to create a custom pixel art image for Stage 4:

**File:** `images/clue-art/stage4.png` (replacing the treasure chest theme)

**Scene Description for Artist/AI:**
- Two pixel art characters (boy and girl) sitting side-by-side on a couch or floor
- Each holding a game controller
- TV screen in front of them displaying a co-op video game
- Warm TV glow illuminating their faces
- Cozy room with snacks (popcorn bowl, drinks)
- Character expressions: focused but happy, both with rosy cheeks (blushing)
- Color palette: warm tones with blue/purple TV glow
- Style: 16-bit retro pixel art, 240x240px max

**Fallback:** If no image is provided, the game will show the 💎 emoji as fallback.

---

## Testing Checklist

- [ ] Stage 4 displays the new title "Chapter 4: Player 2 Joined"
- [ ] The clue text updates correctly
- [ ] The input field and CHECK button are replaced with co-op buttons
- [ ] Tapping Player 1 button shows visual feedback (gold border, pulse animation)
- [ ] Tapping Player 2 button shows visual feedback (gold border, pulse animation)
- [ ] Both buttons must be tapped to proceed
- [ ] If both tap: green success animation + screen flash + proceed to proposal
- [ ] If timeout occurs: buttons reset, can try again
- [ ] Co-op state resets when leaving Stage 4
- [ ] Mobile touch targets are at least 44x44px
- [ ] No cat easter egg references remain in code

---

## Notes

- The co-op mechanic works on a **shared device** (both players tap different areas of the same screen)
- The timeout is 5 seconds by default — both players must tap within this window
- If one player taps first and the other doesn't tap within the timeout, the state resets
- The design intentionally makes it feel like a real co-op game moment