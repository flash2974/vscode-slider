# Inline Number Slider & Scrubber 🎚️

> Interactive mini-slider popup on hover and instant keyboard scrubber (`Alt + ←` / `Alt + →`) for numbers and dimensions in **Typst, CSS, HTML, JavaScript, Python**, and more.

Similar to how the native VS Code color picker pops up when hovering `#rgb()` colors, **Inline Number Slider** gives you an instant mini-controller right under your mouse cursor to tweak dimensions, percentages, and numeric values in real time.

---

## ✨ Features

- 🎯 **Directly under the cursor:** Hover over any number to show a compact, clickable mini-slider popup right where your mouse is.
- 🎛️ **Clickable visual track presets:** Instantly jump to common values (`0%`, `25%`, `50%`, `75%`, `100%`, etc.) with a single click.
- ⚡ **Precision step buttons:** Fine-tune values right in the popup (`-50`, `-10`, `-1`, `+1`, `+10`, `+50`).
- ⌨️ **Keyboard scrubbing (After Effects / Blender style):**
  - Press `Alt + →` / `Alt + ←` to increment/decrement numbers in real time.
  - Hold `Shift` (`Alt + Shift + →` / `Alt + Shift + ←`) to adjust by **10×**.
  - Non-destructive: if your cursor is not on a number, standard VS Code history navigation (`Alt + Left/Right`) and line moves (`Alt + Up/Down`) continue to work seamlessly.
- 🌐 **Universal unit support:**
  - **Typst:** `pt`, `em`, `%`, `mm`, `cm`, `in`, `deg`, `rad`
  - **CSS / Web:** `px`, `rem`, `em`, `%`, `vh`, `vw`, `vmin`, `vmax`, `ch`, `s`, `ms`, `fr`, `deg`, `turn`
  - **Code:** integers and floating-point numbers in JS/TS, Python, Rust, Go, etc.

---

## 📸 Preview

Hovering over `height: 80%` or `width: 320px`:

```
┌─────────────────────────────────────────────────────────────┐
│ 🎚️ Number Slider   80%                                     │
│                                                             │
│ Réglette : [ 0% ]  [ 25% ]  [ 50% ]  [ 75% ]  [ ● 80% ] ... │
│                                                             │
│ Ajuster  : [ ◀◀ -50 ] [ ◀ -10 ] [ ‹ -1 ]  80%  [ +1 › ] ... │
│ ─────────────────────────────────────────────────────────── │
│ Ajuster au clavier : Alt + ← / Alt + →  |  (Shift : x10)    │
└─────────────────────────────────────────────────────────────┘
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action | Description |
|---|---|---|
| `Alt + →` | Increment (+1) | Increments integer by 1 (or by 0.1 for floats / `rem` / `em`) |
| `Alt + ←` | Decrement (-1) | Decrements integer by 1 (or by 0.1 for floats / `rem` / `em`) |
| `Alt + Shift + →` | Large Increment (+10) | Increments by 10 (or by 1 for floats) |
| `Alt + Shift + ←` | Large Decrement (-10) | Decrements by 10 (or by 1 for floats) |
| `Alt + ↑` / `Alt + ↓` | Increment / Decrement | Vertical arrow alternative |

---

## 📦 Installation & Packaging

### Local Installation
```bash
# Package into a VSIX file
npx @vscode/vsce package

# Install into VS Code / Antigravity
code --install-extension inline-number-slider-1.0.0.vsix
```

### Publishing to VS Code Marketplace
1. Get a Personal Access Token (PAT) from [Azure DevOps](https://dev.azure.com).
2. Create a publisher account at [marketplace.visualstudio.com](https://marketplace.visualstudio.com).
3. Publish using `vsce`:
   ```bash
   npx @vscode/vsce publish
   ```

---

## 📄 License

MIT © [Nathan](LICENSE)
