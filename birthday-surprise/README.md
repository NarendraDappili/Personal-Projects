# Nandu ❤️ Chitti – Interactive Birthday Surprise

A standalone, single-page birthday experience built with plain HTML, CSS and JavaScript.
No frameworks, no backend, no build step. This project is fully self-contained.

## Run locally
- Quickest: double-click `index.html`.
- Or serve the folder: `npx serve .` or `python -m http.server 8080`, then open `http://localhost:8080`.

Upload the whole folder to any static host when you're ready.

## Project structure
```
birthday-surprise/
├── index.html        all 7 screens and their text
├── css/style.css     theme, layout, animations
├── js/script.js      navigation, reveals, effects, optional sound
├── assets/           images/, audio/, icons/ (favicon.svg is used)
└── README.md
```

## How the screens work
Each screen is a `<section class="screen">`. Only the Continue button moves the story forward (no scrolling, no skip/share). Every screen has one tiny tap game. They are all easy, and nothing happens on a timer: every step waits for her tap or hold.

| # | Screen | Mini-game / highlights |
|---|--------|-----------|
| 1 | Welcome | Tap the gift 5 times to unbox it, with a funny line at each step (lid lifts, glow builds, burst). Then the gift disables itself and **Let's Begin** unlocks |
| 2 | A Special Name | Catch 5 bouncing hearts; each flies into a heart-shaped love meter that fills to 100% and floods the box, then NANDU and CHITTI appear |
| 3 | Friendship Story | Chat bubbles, plus tapping to answer a phone call and a video call |
| 4 | Things I Like | Tap any tile to pop its balloon (press-squash, confetti, progress bar, pointing finger) and reveal the card |
| 5 | Emotional Moment | Typewriter text, then press and hold the heart to send a virtual hug |
| 6 | The Wish | Tap to take steps until Nandu and Narendra meet on the sunset road |
| 7 | Final Surprise | Blow out the cake candles (they relight, trick candles!), then the letter signed by Narendra. No buttons. |

Mechanics:
- **Sequenced reveal:** elements with `data-seq` appear in order. `data-gap="ms"` sets the pause afterwards, `data-type` types the text out, and `data-game="name"` waits for that mini-game (defined in `Games` in `script.js`).
- **Navigation:** `Navigator.next()` locks while a transition runs, so double taps can't skip a screen. Entrance style comes from `data-enter` (`fade`, `slide`, `scale`, `flip`, `wipe`).
- **Scenery:** each screen has a `data-theme` (colours, hills, stars). Clouds, stars and hills are layered behind it automatically.

## Customising
- **Text:** edit it directly in `index.html`. The curiosity labels are the `.curiosity` paragraphs.
- **Images:** the illustrations are SVG files in `assets/images/` (`nandu.svg`, `narendra.svg`, `cake.svg`, `clouds.svg`, `stars.svg`, `bunting.svg`). Replace them with your own, ideally keeping the same file names. To add a photo, use `<img src="assets/images/your-file.jpg" alt="...">`.
- **Music:** a layered original tune (music box, ukulele-style plucks, pad, bass, light beat, reverb) is synthesised in the browser, so there are no audio files and nothing copyrighted. The traditional Happy Birthday melody plays when the candles relight. To use your own royalty-free track instead, put it in `assets/audio/` and play it from `Sound` in `script.js`. Wrap it in try/catch.
- **Colours and fonts:** change the variables at the top of `css/style.css`. The fonts load from Google Fonts. If they can't load, the page uses system fonts.
- **Pacing:** adjust `data-gap` values in the HTML and `CONFIG.typeSpeedMs` in `script.js`.

## Sound
Nothing plays automatically. Music and sound effects start after the first tap on **Let's Begin**. The 🎵 button at the top right mutes or unmutes it. If the browser has no audio support, the button hides itself.

## Testing checklist
1. Open `index.html` on a phone and on a desktop. There should be no horizontal scrolling.
2. Tap through all seven screens. Each Continue button should appear only after that screen's content has revealed.
3. Double-tap a Continue button. It should advance exactly one screen.
4. Check the gift opening, the NANDU/CHITTI reveal, the typewriter text, the two characters meeting, and the candle flames.
5. Confirm music stays silent until the first tap, and the 🎵 toggle works.
6. Turn on "reduce motion" in your OS. Text should appear without heavy animation.
7. Open DevTools: the console should show no errors and the Network tab no 404s.
8. Screen 7 should stay put, with no extra buttons.

Accessibility: respects `prefers-reduced-motion`, and the buttons are large and keyboard-focusable.
