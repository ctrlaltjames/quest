# Puzzle Proposal Game — Implementation Plan

---

## 1. PRODUCT SUMMARY

### What is being built
A mobile-first browser-based puzzle/escape room game with a retro 16-bit pixel aesthetic. The game has 4 sequential puzzle stages leading to a marriage proposal screen. All game content is configurable via a single JavaScript config object — no code changes needed for customization.

### Core user value
A personalized, shareable, no-install puzzle experience that culminates in a marriage proposal. The proposer customizes clues, answers, and messaging; the proposee plays through a narrative leading to the question.

### Target user
- **Primary:** Someone planning a creative marriage proposal who wants a tech-forward, personalized experience
- **Secondary:** The person being proposed to (the player)
- **Tertiary:** Friends/family who may help with clues or witness the proposal

---

## 2. MVP SCOPE (CORE FEATURES)

### F1 — Title Screen
| Property | Value |
|----------|-------|
| **Description** | Landing screen with game title, subtitle, animated pixel heart/ring, and a "Begin Adventure" button. Background has starfield with twinkling stars and gradient sky. |
| **User value** | Sets the romantic retro tone and invites the player to start. |
| **Complexity** | Low |

### F2 — Puzzle Stages (4 Stages)
| Property | Value |
|----------|-------|
| **Description** | Four sequential puzzle screens. Each shows: stage title, pixel art (with emoji fallback), a clue text area (typewriter effect), a text input field, and a "CHECK" button. Correct answer advances to the next stage; wrong answer shows a shake animation and stays on the same stage. |
| **User value** | Core game loop. Creates a progressive narrative leading to the proposal. |
| **Complexity** | High (core engine, multiple states, animations, validation) |

### F3 — Answer Validation System
| Property | Value |
|----------|-------|
| **Description** | Case-insensitive answer matching against an array of valid answers per stage. Trims whitespace. Supports multiple correct phrasings. |
| **User value** | Forgiving input — the player doesn't need to guess the exact phrasing. |
| **Complexity** | Low |

### F4 — Proposal Screen
| Property | Value |
|----------|-------|
| **Description** | Final screen after all 4 puzzles are solved. Shows a romantic message, the proposal question ("Will you marry me?"), a "YES" button that triggers a celebratory sequence, and a "NO" button that evades cursor/touch and eventually accepts as "yes". Pixel confetti, heart burst, ring sparkle, and typewriter text effects. |
| **User value** | The emotional payoff. The proposal reveal with celebratory animations. |
| **Complexity** | Medium |

### F5 — Config-Driven Content (CONFIG Object)
| Property | Value |
|----------|-------|
| **Description** | A single `CONFIG` JavaScript object in `js/game.js` containing: title screen text, all 4 stage clues/answers/pixel art references, proposal message/text, and optional audio file paths. |
| **User value** | The proposer customizes everything without touching code. |
| **Complexity** | Low |

### F6 — Mobile-First Responsive Layout
| Property | Value |
|----------|-------|
| **Description** | Fluid layout from 320px (iPhone SE) to 1024px+ (large desktop). Portrait primary, with landscape adjustments. Touch targets ≥44x44px. Input fields use 16px font minimum to prevent iOS zoom. Safe area padding for notched devices. |
| **User value** | Works perfectly on the device where the proposal happens — likely a phone. |
| **Complexity** | Medium |

### F7 — Retro 16-Bit Aesthetic & Animations
| Property | Value |
|----------|-------|
| **Description** | Pixel font (Press Start 2P), SNES-inspired palette, pixel-bordered dialogue boxes, typewriter text effect, screen shake on wrong answer, sparkle on correct answer, pixel confetti on proposal screen. |
| **User value** | Emotional, nostalgic atmosphere that makes the experience feel special. |
| **Complexity** | Medium |

---

## 3. OUT OF SCOPE (FOR NOW)

### Explicit Exclusions
- **Haptic feedback** — No vibration API integration (confirmed)
- **PWA / Service Worker** — Offline caching, add-to-home-screen, standalone mode. Game works online only for MVP.
- **Audio/music** — Optional 8-bit sound effects and background music deferred. No audio files or Web Audio API generation.
- **Custom pixel art images** — MVP uses emoji fallback only. Custom PNG art can be added later by dropping files into `images/clue-art/`.
- **Progress saving (localStorage)** — No state persistence. Game resets on page reload.
- **Swipe navigation / pull-to-restart gestures** — Mouse/touch tap navigation only.
- **Orientation lock via manifest** — No PWA manifest means no orientation enforcement.
- **Screen reader / ARIA** — Basic semantic HTML, but no dedicated accessibility pass.
- **Keyboard navigation** — Basic support (Enter to submit), but no full Tab/Arrow key flow.
- **Performance tier detection** — No `navigator.hardwareConcurrency` checks. Single particle count for all devices.
- **Canvas-based confetti** — Use CSS-based particle effects instead (simpler, no canvas dependency). If performance is insufficient, can upgrade to canvas later.

---

## 4. USER JOURNEYS

### New User Flow (First Visit)

1. **Land on page** → Title screen appears with animated pixel heart, starfield background
2. **Tap "Begin Adventure"** → Stage 1 loads with pixel art, clue text, input field
3. **Read clue** → Clue text appears with typewriter effect
4. **Enter answer** → Types into the input field
5. **Tap "CHECK"** (or press Enter) → System validates answer:
   - **Correct:** Screen flash → sparkle animation → auto-advance to next stage
   - **Wrong:** Screen shake → input border turns red → stays on same stage
6. **Repeat steps 3-5** for Stages 2, 3, and 4
7. **Stage 4 solved** → Proposal screen appears with confetti, heart burst, typewriter text
8. **Read proposal** → Message and question appear letter-by-letter
9. **Tap "YES! 💍"** → Celebratory sequence (confetti, fireworks, "She said YES!" message)
10. Alternative: **Tap "Are you sure? 🥺"** → Button evades cursor → after 3 attempts, auto-accepts as yes

### Returning User Flow
- **Not supported in MVP.** Every visit starts fresh from the title screen. No progress persistence.

### Key Flow: Stage Interaction (Step-by-Step)
1. `showStage(n)` called — hides all stage sections, shows `#stage-n`
2. Pixel art loads (img src from CONFIG) with emoji fallback on error
3. Clue text begins typewriter animation (50ms per character)
4. Input field is focused (auto-focus except on mobile to prevent keyboard pop)
5. User types answer and taps "CHECK" (or presses Enter)
6. `validateAnswer(stageId, userAnswer)` runs:
   - Convert to lowercase, trim whitespace
   - Compare against CONFIG.stages[n].answer array
   - Return match/no match
7. On match: trigger correct animation → 800ms delay → `nextStage()`
8. On no match: trigger shake animation → clear input → focus input

### Key Flow: Proposal Interaction (Step-by-Step)
1. `showStage('proposal')` called after stage 4 solved
2. Confetti particles begin falling (CSS animation)
3. Proposal text appears with typewriter effect: message → question → buttons
4. Heart burst animation triggers on reveal
5. "YES" button tap: trigger final celebration (intensified confetti, ring sparkle, fireworks)
6. "NO" button: begins evade behavior — on tap/hover, repositions to random location within viewport
7. After 3 evade attempts, "NO" button text changes to "YES! 💍" and accepts
8. Final celebration ends with congratulations message

---

## 5. INFORMATION ARCHITECTURE

### Pages/Screens

The application is a single HTML page with 6 screen sections, only one visible at a time:

| Screen | ID | Visibility |
|--------|----|------------|
| Title Screen | `#stage-title` | Visible on load, hidden on "Begin Adventure" |
| Stage 1 | `#stage-1` | Hidden by default, shown by game progression |
| Stage 2 | `#stage-2` | Hidden by default, shown by game progression |
| Stage 3 | `#stage-3` | Hidden by default, shown by game progression |
| Stage 4 | `#stage-4` | Hidden by default, shown by game progression |
| Proposal | `#stage-proposal` | Hidden by default, shown after stage 4 solved |

### Navigation
- **Title → Stage 1:** Single button tap
- **Stage N → Stage N+1:** Automatic after correct answer animation completes
- **No back navigation** — Player cannot return to a previous stage (enforces linear progression)
- **No skip** — All stages must be completed in order
- **No restart** — Hard refresh to restart (deferred from MVP)

### Page/Screen Responsibilities

**Title Screen**
- Display game title and subtitle from CONFIG
- Render animated pixel heart icon
- Show "Begin Adventure" CTA button
- Render background starfield with twinkling effect

**Stage Screen (reusable pattern for all 4 stages)**
- Display stage title from CONFIG
- Render pixel art image (with emoji fallback on load error)
- Render clue text (typewriter animation on show)
- Render text input field (auto-focused where appropriate)
- Render "CHECK" submit button
- Show progress dots (4 dots indicating current stage)

**Proposal Screen**
- Render proposal message and question from CONFIG
- Show "YES" button
- Show "NO" button (with evade behavior)
- Trigger confetti particle effect on reveal
- Trigger heart burst animation on reveal
- Show ring sparkle animation
- Show fireworks on "YES" confirmation
- Display final congratulations message

---

## 6. DATA MODEL (CONCEPTUAL)

### Entity: GameConfig
The entire data model lives in a single `CONFIG` object. No database, no API.

```
GameConfig
├── title: string                      // Title screen heading
├── subtitle: string                   // Title screen sub-text
├── startButton: string                // CTA button label
├── stages: Stage[]                    // Array of 4 puzzle stages
├── proposal: ProposalConfig           // Proposal screen content
└── sounds: SoundConfig (optional)     // Audio file paths (deferred)

Stage
├── id: number                         // Stage number (1-4)
├── title: string                      // Stage heading text
├── clue: string                       // Clue text shown to player
├── answer: string[]                   // Array of accepted answers (case-insensitive)
└── pixelArt: string                   // Image filename in images/clue-art/

ProposalConfig
├── message: string                    // Pre-question message
├── question: string                   // "Will you marry me?"
├── buttonYes: string                  // YES button label
├── buttonNo: string                   // NO button label
├── afterYes: string                   // Post-acceptance message
└── partnerName: string                // Partner's name/title

SoundConfig (deferred)
├── correct: string                    // Correct answer sound path
├── wrong: string                      // Wrong answer sound path
└── proposal: string                   // Proposal screen sound path
```

### Entity: GameState (Runtime, not persisted)
```
GameState
├── currentStage: number               // 0 = title, 1-4 = stages, 5 = proposal
├── solveCount: number                 // Stages solved (0-4)
└── noButtonEvades: number             // How many times NO button evaded
```

### Relationships
- **GameConfig** has exactly **4 Stages** (1-to-many, fixed cardinality)
- **GameConfig** has exactly **1 ProposalConfig** (1-to-1)
- **GameState** references **Stage** by `currentStage` index
- Stages are sequential and ordered by array position — no branching

---

## 7. SYSTEM BEHAVIOR

### Business Rules

| Rule ID | Rule | Rationale |
|---------|------|-----------|
| BR1 | Game always starts at the title screen on page load | No persisted state; clean start each visit |
| BR2 | Stages must be completed in order (1 → 2 → 3 → 4) | Narrative dependency |
| BR3 | Player cannot return to a previous stage | Prevents answer fishing; maintains narrative tension |
| BR4 | An answer matches if it equals any string in `answer[]` after lowercasing and trimming | Forgiveness; multiple valid phrasings |
| BR5 | A wrong answer does not advance the stage or reset progress | Non-punitive; player tries again |
| BR6 | The "NO" button on the proposal screen evades interaction attempts | Playful mechanic ensuring "YES" outcome |
| BR7 | After 3 evade attempts, "NO" button auto-converts to "YES" | Guarantees the proposal cannot be refused by the UI |
| BR8 | All displayed text strings come from the CONFIG object | No hardcoded content; full customizability |

### Logic Rules

| Rule ID | Rule |
|---------|------|
| LR1 | On `showStage(n)`, set `currentStage = n`, hide all other stage sections |
| LR2 | On correct answer, trigger success animation, wait 800ms, call `nextStage()` |
| LR3 | `nextStage()` increments `currentStage`, calls `showStage(currentStage + 1)` |
| LR4 | On wrong answer, shake input for 300ms, clear input field, re-focus input |
| LR5 | On proposal "YES" tap, disable both buttons, trigger celebration sequence |
| LR6 | On proposal "NO" tap, increment `noButtonEvades`, reposition button randomly |
| LR7 | If `noButtonEvades >= 3`, change "NO" button text to "YES" and accept on next tap |

### State Transitions

```
[Page Load] 
    ↓
[Title Screen]  ──(tap "Begin Adventure")──→ [Stage 1]
    ↑                                              ↓ (correct answer)
    │                                        [Stage 2]
    │                                              ↓ (correct answer)
    │                                        [Stage 3]
    │                                              ↓ (correct answer)
    │                                        [Stage 4]
    │                                              ↓ (correct answer)
    │                                        [Proposal Screen]
    │                                              ↓ (tap "YES")
    │                                        [Celebration / End]
    └───────────────────────────────────────────── (page refresh)
```

**State invariants:**
- Exactly one stage section is visible at any time
- `currentStage` is always in range [0, 5]
- Stage N cannot be shown unless Stage N-1 has been solved
- Proposal screen is terminal — no further game progression

---

## 8. API SURFACE (HIGH LEVEL)

### Static Asset Endpoints Only

The game has **no backend API**. All data is embedded in the CONFIG object at build time. The only network requests are for static assets:

| Endpoint | Purpose | Method |
|----------|---------|--------|
| `/` | Serve index.html | GET |
| `/css/style.css` | Stylesheet | GET |
| `/js/game.js` | Game engine + CONFIG | GET |
| `/js/confetti.js` | Particle effects | GET |
| `/images/clue-art/stage{n}.png` | Pixel art for stage N (n=1-4) | GET |
| `/images/heart.png` | Heart icon art | GET |
| `/images/ring.png` | Ring icon art | GET |

### Why No API?
- All game logic is client-side
- Content is compiled into the CONFIG object at customization time
- Answers are stored in plain text (client-side validation only — no security concern for a proposal game)
- No user accounts, no leaderboards, no multiplayer

---

## 9. EDGE CASES & RISKS

### Missing Assumptions
- **Image load failures** — Player has no internet or images are missing. Handled by emoji fallback per stage.
- **Empty input submission** — Player taps "CHECK" with empty field. Should show a gentle prompt, not count as wrong answer.
- **Extremely long text** — Clue text or custom messages could overflow the dialogue box. Need max-height with scroll.
- **Browser font not loaded** — Press Start 2P is large. Use `font-display: swap` and a readable fallback (monospace).
- **Custom answer with special characters** — The `answer[]` array supports any string, but Unicode normalization (e.g., é vs e + combining accent) could cause unexpected mismatches.

### UX Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| Player closes tab before reaching proposal | High — entire experience lost | No recovery in MVP. Acceptable for a single-use proposal. |
| Virtual keyboard on mobile pushes content off-screen | Medium — input not visible | Use `visualViewport` API to detect keyboard and scroll input into view. |
| "NO" button evade on mobile is frustrating | Medium — could feel buggy instead of playful | Make evade behavior gentle: slow movement, visible. Add a subtle wiggle animation to signal it's intentional. |
| Stage transition animations feel slow | Medium — player loses patience | Keep transitions under 500ms (faster than the doc's 800ms). |
| Player solves a stage but the animation hasn't finished | Low — they might tap again | Disable input during transition animations. |

### Technical Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| Font file is too large (1.5MB+ for Press Start 2P with full charset) | Medium — slow page load | Use woff2 format, subset to Latin characters only, or use VT323 as lighter alternative. |
| CSS animations stutter on low-end mobile devices | Medium — janky experience | Use `transform` and `opacity` only (GPU-composited). Reduce particle count. |
| iOS Safari viewport height quirks (URL bar collapses) | Medium — layout shifts | Use `dvh` units with `vh` fallback. Test on iOS Safari. |
| In-app browsers (WhatsApp, Instagram) strip or modify content | Medium — broken experience | Test in common in-app browsers. Keep fallback paths simple. |
| Touch event 300ms delay on older mobile browsers | Low — delayed tap response | CSS `touch-action: manipulation` on all interactive elements. |

---

## 10. IMPLEMENTATION TASK BREAKDOWN

### Frontend Tasks

| ID | Task | Dependencies | Effort |
|----|------|-------------|--------|
| FE-01 | Create `index.html` — semantic structure with all 6 stage sections, viewport meta, font preload, script/style links | None | Small |
| FE-02 | Create `css/style.css` — mobile-first base styles (320px+), pixel aesthetic, dialogue boxes, input fields, buttons | FE-01 | Medium |
| FE-03 | Create responsive breakpoints in CSS (429px tablet, 768px desktop grid layout, 1024px large desktop) | FE-02 | Medium |
| FE-04 | Create CSS animations — typewriter effect, screen shake, pulse glow, sparkle, confetti particles, heart beat | FE-02 | Medium |
| FE-05 | Create `js/game.js` — CONFIG object definition with all default values | None | Small |
| FE-06 | Implement Stage Manager — `showStage()`, stage visibility toggling, state tracking | FE-01, FE-05 | Small |
| FE-07 | Implement Answer Validation — case-insensitive matching, trim, array comparison | FE-05 | Small |
| FE-08 | Implement Stage progression — correct answer → animation → next stage flow, wrong answer → shake → retry flow | FE-06, FE-07 | Medium |
| FE-09 | Implement Typewriter text effect — character-by-character clue text reveal (50ms/char) | FE-06 | Small |
| FE-10 | Implement Proposal Screen — "YES" button handler, "NO" button evade logic (3 attempts then convert), celebration trigger | FE-06, FE-05 | Medium |
| FE-11 | Implement Pixel art image loading with emoji fallback on error | FE-06 | Small |
| FE-12 | Implement Mobile keyboard handling — `visualViewport` listener to scroll input into view when keyboard opens | FE-06 | Small |
| FE-13 | Implement Progress dots indicator (4 dots, highlight current stage) | FE-06 | Small |
| FE-14 | Create `js/confetti.js` — CSS-based pixel confetti particle system (init, burst, cleanup) | None | Small |
| FE-15 | Integrate confetti with proposal screen reveal | FE-10, FE-14 | Small |
| FE-16 | Prevent default touch behaviors (zoom, scroll, pull-to-refresh) on game containers | FE-01 | Small |
| FE-17 | Add empty input validation — gentle prompt on blank submission | FE-08 | Small |

### Backend Tasks

| ID | Task | Dependencies | Effort |
|----|------|-------------|--------|
| BE-01 | **No backend required** — The game is fully client-side. All "backend" work is static file hosting. | None | None |

### Infrastructure Tasks

| ID | Task | Dependencies | Effort |
|----|------|-------------|--------|
| IN-01 | Create project directory structure per the spec (`css/`, `js/`, `images/clue-art/`, `images/bg/`) | None | Small |
| IN-02 | Host on GitHub Pages — push to main branch, enable Pages from root | All FE tasks | Small |
| IN-03 | Add `docs/` folder with customization checklist (from config section of FEATURE_IDEA.md) | FE-05 | Small |

### Task Dependency Order

```
FE-01 ──── FE-02 ──── FE-03 ──── FE-04
   │                                    │
   └──── FE-05 ──── FE-06 ─────────────┤
                     │                  │
                     ├── FE-07 ────────┤
                     ├── FE-08 ────────┤
                     ├── FE-09 ────────┤
                     ├── FE-10 ────────┤
                     ├── FE-11 ────────┤
                     ├── FE-12 ────────┤
                     ├── FE-13 ────────┤
                     │                  │
FE-14 ──── FE-15 ──────────────────────┤
                                       │
                              FE-16, FE-17
                                       │
                              IN-01, IN-02, IN-03
```

---

## APPENDIX: CONFIG OBJECT REFERENCE

For convenience, the final config object structure that the implementation must support:

```javascript
const CONFIG = {
    title: "A Quest For Love",
    subtitle: "Will you embark on this adventure?",
    startButton: "Begin Adventure",

    stages: [
        {
            id: 1,
            title: "Chapter 1: Where It All Began",
            clue: "Your clue text here...",
            answer: ["accepted", "answers", "here"],
            pixelArt: "stage1.png",        // in images/clue-art/
            emojiFallback: "🎬",           // shown if image fails
        },
        // ... stages 2, 3, 4 with same shape
    ],

    proposal: {
        message: "Every quest has led to this moment...",
        question: "Will you marry me?",
        buttonYes: "YES! 💍",
        buttonNo: "Are you sure? 🥺",
        afterYes: "She said YES! Forever begins now!",
        partnerName: "My Dearest",
    },
};
```

> **Note:** I've added an `emojiFallback` field per stage to the CONFIG object. The original doc had a separate mapping table, but embedding it in each stage object is cleaner for configurability. This is a minor schema addition for implementation clarity.