# 🔍 Unused Code Review — "A Quest For Love"

> Generated on review of `index.html`, `js/game.js`, `js/confetti.js`, `css/style.css`

---

## 1. Dead Functions in `js/game.js` (Never Called)

| Function | Lines | Why It's Dead |
|----------|-------|---------------|
| `startConfetti()` | ~3 lines | Defined but never invoked anywhere. The code uses `Confetti.start()` directly instead. |
| `stopConfetti()` | ~3 lines | Same — defined but never called. Uses `Confetti.stop()` directly elsewhere. |

These two functions are wrappers that set `state.confettiActive = true/false`, but **`state.confettiActive` is also never read** anywhere else in the codebase, making all 4 lines of state logic completely dead.

---

## 2. Dead Function: `createFlowers()` (Never Called)

```javascript
function createFlowers() {
    const container = document.querySelector('.flower-container');
    if (!container) return;
    // ... creates flower emoji elements
}
```

- Never called from anywhere in the codebase.
- The HTML has **no `.flower-container` element**, so even if it were called, it would immediately `return`.

---

## 3. Dead Functions: `renderHeartCanvas()` & `renderRingCanvas()` (No-op)

Both are called during `init()`:

```javascript
const heartCanvas = document.getElementById('heart-canvas');
if (heartCanvas) renderHeartCanvas(heartCanvas);

const ringCanvas = document.getElementById('ring-canvas');
if (ringCanvas) renderRingCanvas(ringCanvas);
```

- The HTML has **no `<canvas id="heart-canvas">`** or **`<canvas id="ring-canvas">`** elements.
- Both functions are guarded by null checks, so they silently do nothing at runtime.
- Together these two functions account for **~80 lines of dead code** (pixel grid arrays + rendering logic).

---

## 4. Dead CSS in `css/style.css`

| Selector | Why Dead |
|----------|---------|
| `.flower-container`, `.flower-container .flower`, `.flower-container.fading-out` | No matching HTML element exists; `createFlowers()` is never called. |
| `@keyframes flowerGrow`, `@keyframes flowersFadeOut` | Only referenced by the dead `.flower-container` rules above. |

---

## 5. Dead State Property

- **`state.confettiActive`** — Set to `true/false` only inside the unused `startConfetti()`/`stopConfetti()`. Never read anywhere else in the codebase.

---

## 📊 Summary

| Category | Items | Estimated Lines |
|----------|-------|-----------------|
| Dead JS functions (never called) | 3 (`startConfetti`, `stopConfetti`, `createFlowers`) | ~15 |
| Dead JS functions (no-op due to missing DOM) | 2 (`renderHeartCanvas`, `renderRingCanvas`) | ~80 |
| Dead CSS selectors + keyframes | 4 selectors, 2 keyframes | ~30 |
| Dead state property | 1 (`confettiActive`) | ~1 |

**Total: ~5 unused functions and ~126 lines of dead code.**

---

## 💡 Notes

These look like remnants from the original architecture plan (which mentioned canvas-rendered pixel art for heart/ring icons, and flower elements on the proposal screen) that were never fully implemented or were replaced with simpler approaches. Safe to remove if desired.