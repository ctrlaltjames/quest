# Puzzle Proposal Game - Deployment Guide

## Project Structure

```
thething/
├── index.html              # Main HTML file (all 6 screens)
├── css/
│   └── style.css           # All styles and animations
├── js/
│   ├── game.js             # CONFIG, state, game engine
│   └── confetti.js         # CSS particle confetti system
├── images/
│   ├── clue-art/           # Optional custom pixel art (stage1-4.png)
│   ├── bg/                 # Optional background images
│   └── README.md           # Asset instructions
├── docs/
│   ├── architecture.md     # System architecture document
│   ├── FEATURE_IDEA.md     # Feature specifications
│   ├── plan.md             # Implementation plan
│   └── DEPLOYMENT.md       # This file
└── .gitignore              # Git ignore rules
```

## Quick Setup

### 1. Customize the Game

Edit `js/game.js` to customize the CONFIG object:

```javascript
const CONFIG = {
    title: "A Quest For Love",           // Game title
    subtitle: "Will you embark on this adventure?",  // Subtitle
    startButton: "Begin Adventure",       // Start button text

    stages: [
        {
            id: 1,
            title: "Chapter 1: Where It All Began",
            clue: "Your clue text here...",
            answer: ["answer1", "answer2"],  // Accept multiple answers
            pixelArt: "stage1.png",          // Optional: set to null for emoji
        },
        // ... more stages
    ],

    proposal: {
        message: "Every quest has led to this moment...",
        question: "Will you marry me?",
        buttonYes: "YES! 💍",
        buttonNo: "Are you sure? 🥺",
        afterYes: "She said YES! Forever begins now! 💕",
    },
};
```

**Key customization fields:**
- `clue` — The puzzle text shown to the player
- `answer` — Array of acceptable answers (case-insensitive)
- `pixelArt` — Set to `null` to use emoji fallback, or a filename like `"stage1.png"` for custom art

### 2. (Optional) Add Custom Pixel Art

Place 4 PNG images in `images/clue-art/`:
- `stage1.png` — Movie Night theme
- `stage2.png` — First Kiss theme
- `stage3.png` — Infinity Counter theme
- `stage4.png` — Treasure Chest theme

If images are missing, emoji fallbacks are used automatically.

### 3. Test Locally

Open `index.html` directly in a browser:

```bash
# macOS
open index.html

# Windows
start index.html

# Linux
xdg-open index.html
```

Or serve via a local server:

```bash
# Python 3
python -m http.server 8080

# Node.js (npx)
npx serve . 8080

# PHP
php -S localhost:8080
```

Then visit `http://localhost:8080`.

## Deploying to GitHub Pages

### Step 1: Create a GitHub Repository

```bash
# From the project directory
cd "thething - test"
git init
git add .
git commit -m "Initial commit: Puzzle Proposal Game"
```

On GitHub, create a new repository (e.g., `proposal-game`), then:

```bash
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/proposal-game.git
git push -u origin main
```

### Step 2: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages**
3. Under **Source**, select **Deploy from a branch**
4. Select branch: **main** and folder: **/ (root)**
5. Click **Save**

### Step 3: Wait for Deployment

GitHub Pages will build your site. After ~1-2 minutes, your game will be live at:
```
https://YOUR_USERNAME.github.io/proposal-game/
```

## Deploying to Other Static Hosts

### Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy from project root
netlify deploy --prod --dir=.
```

Or connect your GitHub repo at app.netlify.com for auto-deploy.

### Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy from project root
vercel
```

### Custom Static Host

Upload these files to your web server:
- `index.html`
- `css/style.css`
- `js/game.js`
- `js/confetti.js`
- `images/` directory (if using custom art)

## Customization Checklist

- [ ] Edit `CONFIG.title` — Game title
- [ ] Edit `CONFIG.subtitle` — Title screen subtitle
- [ ] Edit `CONFIG.startButton` — Start button text
- [ ] Edit all `CONFIG.stages[].title` — Chapter titles
- [ ] Edit all `CONFIG.stages[].clue` — Puzzle clues
- [ ] Edit all `CONFIG.stages[].answer` — Acceptable answers
- [ ] Set `CONFIG.stages[].pixelArt` — `null` for emoji, or `"stageN.png"` for custom art
- [ ] Edit `CONFIG.proposal.message` — Pre-proposal message
- [ ] Edit `CONFIG.proposal.question` — The proposal question
- [ ] Edit `CONFIG.proposal.buttonYes` — YES button text
- [ ] Edit `CONFIG.proposal.buttonNo` — NO button text
- [ ] Edit `CONFIG.proposal.afterYes` — Message after YES is pressed
- [ ] (Optional) Add custom pixel art images
- [ ] Test locally
- [ ] Deploy to GitHub Pages

## Configuration Notes

### Answer Matching
- All answers are **case-insensitive**
- Input is **trimmed** (leading/trailing whitespace removed)
- Multiple acceptable answers are stored as an array
- Common variations increase the chance of matching

### Pixel Art Fallback
- If `pixelArt` is `null` or the file doesn't exist, emoji fallbacks display automatically
- Stage 1: 🎬, Stage 2: 💋, Stage 3: ♾️, Stage 4: 💎
- No broken image icons will ever appear

### Mobile Support
- Keyboard detection via `visualViewport` API
- `touch-action: manipulation` on all buttons (no 300ms tap delay)
- Landscape mode support with adapted layout
- `prefers-reduced-motion` support (animations disabled)

## Browser Support

- ✅ iOS Safari 13+
- ✅ Android Chrome 80+
- ✅ Desktop Chrome/Firefox/Safari/Edge
- ⚠️ In-app browsers (WhatsApp, Instagram, Telegram) — may have limited viewport API support

## Troubleshooting

### Game doesn't load
- Check browser console for errors
- Verify all paths in `index.html` are correct
- Ensure fonts can load from Google Fonts CDN

### Images not showing
- Verify image filenames match `pixelArt` config values exactly
- Check that images are in `images/clue-art/` directory
- If images are missing, emoji fallbacks should display automatically

### No custom sound
- Audio is out of scope for MVP
- Add sound files and audio elements if desired

### Confetti not appearing on proposal screen
- Check browser console for errors
- Verify `js/confetti.js` is loaded (check network tab)

## Technical Details

### File Sizes
- `index.html`: ~3KB
- `css/style.css`: ~8KB
- `js/game.js`: ~10KB
- `js/confetti.js`: ~3KB
- **Total: ~24KB** (excluding font)

### First Load (with font): ~54KB
### Cached (no font): ~24KB

### No Dependencies
- Zero npm packages
- Zero build step
- Zero backend
- Google Font (Press Start 2P) is the only external dependency

### No Data Collection
- No analytics
- No tracking
- No cookies
- Fully offline-capable once loaded