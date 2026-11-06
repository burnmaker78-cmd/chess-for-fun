# Chess

A free, no-locked-content chess app in plain HTML/CSS/JS — no build step, no server, no dependencies. Everything runs in the browser.

## Features

- **Full rules engine** — legal move validation, pins, castling, en passant, promotion, check/checkmate/stalemate detection
- **9 bots**, original personas rated roughly 400–2800 "ELO" (difficulty via search depth + blunder chance, not a real rating — and not chess.com's actual bots, since those are their content)
- **Play a friend** — create a lobby (get a 4-digit PIN) or join one, then play pass-and-play or across two devices on the same network
- **Settings dashboard** — premove toggle, "show best move" hint arrow, auto-flip board, board theme
- **Chaos Mode** — an openly-labeled house-rule variant, unlocked with the code `3105`: move any piece anywhere, ignore check, promote pawns to king, and capture the opposing king outright to win instantly. It's shown as a banner in-game for whichever side(s) have it on, so both players always know the house rules before they start.

## A note on the lobby PIN

This is a static site with no backend, so the PIN system isn't live internet matchmaking — it's a bit of lobby flavor around local/pass-and-play. Two devices on the same browser (same localStorage) can share a lobby config; across genuinely separate devices/networks, you and your friend just need to agree on the same mode before you start. If you want real cross-device sync later, that needs a small relay server or a WebRTC/peer-to-peer layer — happy to build that as a follow-up.

## Running locally

Open `index.html` in a browser. Nothing to install.

## Deploying to GitHub Pages

1. Create a repo and add all the files below to the root.
2. Push to GitHub.
3. In the repo: **Settings → Pages** → Source → your branch, `/ (root)` → Save.
4. Your game is live at `https://<username>.github.io/<repo-name>/`.

## Customizing the look

- **Board squares / UI colors**: CSS variables at the top of `style.css` (`:root { ... }`), plus theme overrides further down for the built-in board themes.
- **Pieces**: Unicode glyphs defined in `rules.js` (`PIECE_GLYPHS`). Swap the `span.textContent = ...` line in `app.js`'s `render()` for an `<img>` tag to use your own piece art.
- **Bot roster**: edit the `BOT_ROSTER` array in `bot.js` to rename bots, change ELO labels, or retune difficulty (`depth`, `blunder`, `noise`).

## File structure

```
index.html   - all screens: dashboard, bot select, lobby, settings, game board
style.css    - all styling, theme variables
rules.js     - pure chess rules engine (standard + Chaos Mode variant)
bot.js       - minimax engine + bot roster
app.js       - navigation, settings, lobby, premove/hints, game loop
```
