/* =========================================================
   Nandu ❤️ Chitti – Birthday Surprise
   Modules (one file, no dependencies):
     1. Config & helpers
     2. Sound    – optional music + sound effects, synthesised in the browser
     3. Effects  – scenery, floating hearts, bursts, comic "POW!" text
     4. Games    – one tiny mini-game per screen (each always completable)
     5. Reveal   – sequenced reveal + typewriter for each screen
     6. Navigator – screen-to-screen transitions
   ========================================================= */
(() => {
  'use strict';

  /* ---------- 1. Config & helpers ---------- */
  const CONFIG = {
    leaveMs: 550,            // matches .is-leaving in CSS
    enterMs: 800,            // matches the longest .is-entering animation in CSS
    defaultGapMs: 800,       // pause after a revealed element when no data-gap is set
    typeSpeedMs: 32,
    readSeconds: 15,         // reading time before the hug prompt appears         // typewriter speed per character
    floaterEmojis: ['❤️', '💖', '✨', '⭐', '💗', '🌸', '💫'],
    confettiColors: ['#ff6fa5', '#8d6bd6', '#ffd37a', '#9bd8ff', '#ffb3cf', '#b9f0d0'],
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (min, max) => min + Math.random() * (max - min);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isSmallScreen = window.matchMedia('(max-width: 600px)').matches;
  const centerOf = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };

  /* Moves the screen's own scroll only when needed. Modes:
       'follow' – plain text/buttons: scroll just enough to bring the element's bottom into view
       'top'    – big game blocks: leave the view alone unless the block starts below the fold
       'fit'    – after a tap: bring the whole element into view */
  function focusOn(el, mode = 'follow') {
    const screen = el.closest('.screen');
    if (!screen) return;
    const header = $('#siteHeader');
    const top = (header ? header.getBoundingClientRect().bottom : 0) + 8;
    const bottom = window.innerHeight - 24;
    const r = el.getBoundingClientRect();
    let delta = 0;
    if (mode === 'top') {
      if (r.top > bottom - 100) delta = r.top - top - 16;
    } else if (mode === 'fit') {
      if (r.height > bottom - top || r.top < top) delta = r.top - top;
      else if (r.bottom > bottom) delta = r.bottom - bottom;
    } else if (r.bottom > bottom) {
      delta = Math.min(r.bottom - bottom, Math.max(0, r.top - top));
    }
    if (Math.abs(delta) > 2) screen.scrollBy({ top: delta, behavior: reducedMotion ? 'auto' : 'smooth' });
  }

  /* ---------- 2. Sound (optional, never autoplays) ----------
     A small original tune (C – G – Am – F loop) played by a music-box lead,
     ukulele-style plucks, a soft pad, bass and a light shaker, all through a
     gentle reverb. No audio files, so nothing can 404 and nothing is copyrighted. */
  const Sound = (() => {
    const BPM = 104;
    const EIGHTH = 60 / BPM / 2;
    const CHORDS = [[60, 64, 67], [59, 62, 67], [57, 60, 64], [57, 60, 65], [60, 64, 67], [59, 62, 67], [57, 60, 65], [59, 62, 67]];
    const BASS = [36, 43, 45, 41, 36, 43, 41, 43];
    const MELODY = [   // one entry per eighth note, 0 = rest
      [76, 0, 79, 0, 76, 79, 84, 0], [74, 0, 79, 0, 83, 79, 74, 0],
      [72, 0, 76, 0, 81, 76, 72, 0], [72, 0, 77, 0, 81, 77, 72, 76],
      [76, 0, 79, 0, 84, 0, 79, 76], [74, 0, 79, 0, 83, 0, 79, 74],
      [72, 76, 77, 0, 81, 77, 76, 72], [74, 0, 71, 0, 74, 79, 0, 0],
    ];
    // "Happy Birthday" (traditional, public domain) as [midi, beats], 3/4 time
    const BIRTHDAY = [
      [67, .75], [67, .25], [69, 1], [67, 1], [72, 1], [71, 2],
      [67, .75], [67, .25], [69, 1], [67, 1], [74, 1], [72, 2],
      [67, .75], [67, .25], [79, 1], [76, 1], [72, 1], [71, 1], [69, 1],
      [77, .75], [77, .25], [76, 1], [72, 1], [74, 1], [72, 2],
    ];
    const BIRTHDAY_CHORDS = [[60, 64, 67], [55, 59, 62], [60, 64, 67], [53, 57, 60]];

    const toggleBtn = $('#musicToggle');
    let ctx = null, master, reverb, noiseBuf;
    let enabled = false, timer = null, nextTime = 0, stepIdx = 0, holdUntil = 0;

    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

    function init() {
      if (ctx) return true;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        ctx = AC ? new AC() : null;
      } catch (e) { ctx = null; }
      if (!ctx) { toggleBtn.hidden = true; if ($('#musicNote')) $('#musicNote').hidden = true; return false; }   // unsupported → hide control, stay silent

      master = ctx.createGain();
      master.gain.value = 0.0001;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp).connect(ctx.destination);

      // Generated reverb impulse (2s of decaying stereo noise)
      const len = ctx.sampleRate * 2;
      const impulse = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = impulse.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
      }
      reverb = ctx.createConvolver();
      reverb.buffer = impulse;
      const wetOut = ctx.createGain();
      wetOut.gain.value = 0.6;
      reverb.connect(wetOut).connect(master);

      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const nd = noiseBuf.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      return true;
    }

    // Connect a node to the dry output and (optionally) the reverb
    function route(node, wet = 0.3) {
      node.connect(master);
      if (wet) { const send = ctx.createGain(); send.gain.value = wet; node.connect(send).connect(reverb); }
    }

    function env(t, peak, attack, release) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
      return g;
    }

    function osc(type, freq, t, stopAt, dest) {
      const o = ctx.createOscillator();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      o.connect(dest); o.start(t); o.stop(stopAt);
      return o;
    }

    // Music-box bell: sine + a bright upper partial
    function bell(midi, t, vol = 0.07, dur = 1.6) {
      const g = env(t, vol, 0.006, dur);
      osc('sine', hz(midi), t, t + dur + 0.1, g);
      const g2 = env(t, vol * 0.25, 0.004, dur * 0.4);
      osc('sine', hz(midi) * 3.01, t, t + dur, g2);
      route(g, 0.45); route(g2, 0.45);
    }
    // Ukulele-ish pluck
    function pluck(midi, t, vol = 0.04) {
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200;
      const g = env(t, vol, 0.004, 0.32);
      osc('triangle', hz(midi), t, t + 0.4, f); f.connect(g); route(g, 0.2);
    }
    function pad(midis, t, dur, vol = 0.016) {
      midis.forEach((m, i) => {
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.4);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        const o = osc('sine', hz(m - 12), t, t + dur + 0.1, g);
        o.detune.value = (i - 1) * 6;
        route(g, 0.5);
      });
    }
    function bass(midi, t, vol = 0.09) {
      const g = env(t, vol, 0.01, 0.45);
      osc('sine', hz(midi), t, t + 0.55, g); route(g, 0);
    }
    function kick(t) {
      const g = env(t, 0.13, 0.004, 0.14);
      const o = osc('sine', 120, t, t + 0.2, g);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.12); route(g, 0);
    }
    function noise(t, dur, vol, type, freq, endFreq) {
      const src = ctx.createBufferSource(); src.buffer = noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t);
      if (endFreq) f.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
      const g = env(t, vol, 0.01, dur);
      src.connect(f).connect(g); src.start(t); src.stop(t + dur + 0.1); route(g, 0.15);
    }

    // One eighth-note step of the background loop
    function scheduleStep(i, t) {
      const bar = Math.floor(i / 8) % 8;
      const s = i % 8;
      if (s === 0) { pad(CHORDS[bar], t, EIGHTH * 8); }
      if (s === 0 || s === 4) kick(t);
      if (s === 0) bass(BASS[bar], t);
      if (s === 4) bass(BASS[bar] + 7, t, 0.06);
      if (s % 2 === 1) CHORDS[bar].forEach((m, k) => pluck(m, t + k * 0.012, s === 3 || s === 7 ? 0.04 : 0.028));
      if (s % 2 === 1) noise(t, 0.05, 0.012, 'highpass', 7000);
      const note = MELODY[bar][s];
      if (note) bell(note, t, 0.065);
    }

    function tick() {
      if (!enabled) return;
      if (birthdayForever) {   // endless Happy Birthday replaces the background loop
        if (songNextStart < ctx.currentTime) songNextStart = ctx.currentTime + 0.1;
        if (songNextStart < ctx.currentTime + 1) songNextStart = scheduleBirthday(songNextStart, true) + 1.5;
        return;
      }
      if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;   // catch up after a throttled tab
      if (nextTime < holdUntil) nextTime = holdUntil;                      // loop pauses while the birthday song plays
      while (nextTime < ctx.currentTime + 0.35) {
        scheduleStep(stepIdx++, nextTime);
        nextTime += EIGHTH;
      }
    }

    function setEnabled(on) {
      if (on && !init()) return;
      if (!ctx) return;
      enabled = on;
      if (note) note.hidden = true;
      toggleBtn.setAttribute('aria-pressed', String(on));
      toggleBtn.setAttribute('aria-label', on ? 'Turn music off' : 'Turn music on');
      clearInterval(timer);
      if (on) {
        ctx.resume();
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setTargetAtTime(0.85, ctx.currentTime, 0.3);
        nextTime = ctx.currentTime + 0.1;
        timer = setInterval(tick, 100);
      } else {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.08);
      }
    }

    // Sound effects (silent unless audio is on)
    function sfx(kind) {
      if (!enabled || !ctx) return;
      const t = ctx.currentTime + 0.01;
      switch (kind) {
        case 'pop':
          noise(t, 0.08, 0.2, 'bandpass', 1500);
          { const g = env(t, 0.15, 0.003, 0.1); const o = osc('sine', 700, t, t + 0.15, g); o.frequency.exponentialRampToValueAtTime(180, t + 0.1); route(g, 0.1); }
          break;
        case 'ding': bell(88, t, 0.1, 1.2); bell(95, t + 0.1, 0.07, 1.2); break;
        case 'boing':
          { const g = env(t, 0.12, 0.01, 0.35); const o = osc('sine', 220, t, t + 0.4, g);
            o.frequency.exponentialRampToValueAtTime(520, t + 0.12); o.frequency.exponentialRampToValueAtTime(260, t + 0.32); route(g, 0.15); }
          break;
        case 'step': pluck(pick([72, 74, 76, 79]), t, 0.08); break;
        case 'page': noise(t, 0.35, 0.1, 'lowpass', 400, 3500); break;
        case 'blow': noise(t, 0.7, 0.18, 'lowpass', 1800, 300); break;
        case 'sparkle': [84, 88, 91, 96, 100].forEach((n, i) => bell(n, t + i * 0.07, 0.06, 0.9)); break;
        case 'gift': noise(t, 0.4, 0.1, 'lowpass', 400, 3500); [72, 76, 79, 84, 88, 91].forEach((n, i) => bell(n, t + 0.1 + i * 0.07, 0.07, 1)); break;
        case 'fanfare': [72, 76, 79, 84].forEach((n, i) => bell(n, t + i * 0.1, 0.08, 1.4)); bell(88, t + 0.5, 0.09, 1.8); break;
        default: break;
      }
    }

    // The Happy Birthday tune on the music box, with soft chords; the loop waits for it
    const BIRTHDAY_BASS = [36, 43, 36, 41];
    // Schedules one pass of the tune starting at `start`; returns the time it ends.
    // "rich" adds a soft strum and bass so the endless version feels like a little band.
    function scheduleBirthday(start, rich) {
      const beat = 0.5;
      let t = start;
      BIRTHDAY.forEach(([m, beats]) => { bell(m, t, 0.1, 1.5); t += beats * beat; });
      BIRTHDAY_CHORDS.forEach((c, i) => {
        pad(c, start + i * 6 * beat, 6 * beat + 0.3, 0.02);
        if (!rich) return;
        for (let b = 0; b < 6; b++) {
          const bt = start + (i * 6 + b) * beat;
          c.forEach((m, k) => pluck(m, bt + k * 0.012, b % 3 === 0 ? 0.028 : 0.018));
          if (b % 3 === 0) bass(BIRTHDAY_BASS[i], bt, 0.07);
          if (b % 3 === 0) kick(bt);
        }
      });
      return t;
    }
    function birthday() {
      if (!enabled || !ctx) return;
      holdUntil = scheduleBirthday(ctx.currentTime + 0.25, false) + 0.6;
    }
    // Final screen: Happy Birthday keeps repeating until the page is closed (still respects the mute toggle)
    let birthdayForever = false, songNextStart = 0;
    function startBirthdayLoop() {
      birthdayForever = true;
      if (ctx) songNextStart = Math.max(ctx.currentTime + 0.3, holdUntil);
    }

    const note = $('#musicNote');
    let decided = false;   // true once music was started or the toggle was used
    const FIRST_EVENTS = ['pointerup', 'touchend', 'click', 'keydown'];
    function onFirstInteraction(e) {
      if (decided) return;
      decided = true;
      FIRST_EVENTS.forEach((t) => document.removeEventListener(t, onFirstInteraction, true));
      if (e && e.target && e.target.closest && e.target.closest('#musicToggle')) return;   // the toggle handles itself
      setEnabled(true);
    }
    // Browsers only allow sound after a gesture, so the very first tap anywhere starts the music
    FIRST_EVENTS.forEach((t) => document.addEventListener(t, onFirstInteraction, true));

    toggleBtn.addEventListener('click', () => { decided = true; setEnabled(!enabled); });
    document.addEventListener('visibilitychange', () => {
      if (!ctx || !enabled) return;
      if (document.hidden) ctx.suspend(); else ctx.resume();
    });

    return {
      // Called after the first real user interaction (the "Let's Begin" tap)
      startAfterInteraction() { onFirstInteraction(); },
      sfx,
      birthday,
      birthdayForever: startBirthdayLoop,
    };
  })();

  /* ---------- 3. Effects ---------- */
  const Effects = (() => {
    const layer = document.createElement('div');
    layer.className = 'burst-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);

    const SCENERY_HTML = `
      <div class="scenery" aria-hidden="true">
        <div class="blob b1"></div>
        <div class="blob b2"></div>
        <div class="rays"></div>
        <div class="stars"></div>
        <div class="bokeh"></div>
        <div class="clouds c1"></div>
        <div class="clouds c2"></div>
        <svg class="hills" viewBox="0 0 400 120" preserveAspectRatio="none">
          <path class="h2" d="M0 50C60 20 120 20 200 50S340 80 400 40V120H0z"/>
          <path class="h1" d="M0 80C70 50 140 60 220 85S350 100 400 70V120H0z"/>
        </svg>
      </div>`;

    // Layered pastel world behind every screen (clouds, stars, hills)
    function addScenery(screen) { screen.insertAdjacentHTML('afterbegin', SCENERY_HTML); }

    // Gentle looping hearts / sparkles (created once per screen)
    function addFloaters(screen, count = isSmallScreen ? 9 : 14) {
      const box = $('.floaters', screen);
      if (!box || box.childElementCount) return;
      const frag = document.createDocumentFragment();
      for (let i = 0; i < count; i++) {
        const el = document.createElement('span');
        el.className = 'floater';
        el.textContent = CONFIG.floaterEmojis[i % CONFIG.floaterEmojis.length];
        el.style.setProperty('--x', rand(0, 95).toFixed(1) + '%');
        el.style.setProperty('--s', rand(0.9, 1.9).toFixed(2) + 'rem');
        el.style.setProperty('--t', rand(9, 16).toFixed(1) + 's');
        el.style.setProperty('--dl', (-rand(0, 14)).toFixed(1) + 's');
        el.style.setProperty('--dx', rand(-40, 40).toFixed(0) + 'px');
        el.style.setProperty('--r', rand(-40, 40).toFixed(0) + 'deg');
        frag.appendChild(el);
      }
      box.appendChild(frag);
    }

    // One-shot burst of hearts + confetti from a point (self-cleaning)
    function burst(x, y, { hearts = 14, confetti = 22, spread = 160, colors = CONFIG.confettiColors } = {}) {
      if (reducedMotion) return;
      const frag = document.createDocumentFragment();
      const make = (isConfetti) => {
        const p = document.createElement('span');
        p.className = 'particle' + (isConfetti ? ' confetti' : '');
        if (isConfetti) p.style.setProperty('--c', pick(colors));
        else p.textContent = pick(CONFIG.floaterEmojis.slice(0, 3));
        const angle = rand(0, Math.PI * 2);
        const dist = rand(spread * 0.4, spread * (isConfetti ? 1.5 : 1.2));
        p.style.setProperty('--x', x + 'px');
        p.style.setProperty('--y', y + 'px');
        p.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
        p.style.setProperty('--dy', Math.sin(angle) * dist + (isConfetti ? 90 : 0) + 'px');
        p.style.setProperty('--r', rand(-540, 540).toFixed(0) + 'deg');
        p.style.setProperty('--t', rand(1.1, 2).toFixed(2) + 's');
        p.style.setProperty('--s', rand(1.1, 2).toFixed(2) + 'rem');
        p.addEventListener('animationend', () => p.remove(), { once: true });
        frag.appendChild(p);
      };
      for (let i = 0; i < hearts; i++) make(false);
      for (let i = 0; i < confetti; i++) make(true);
      layer.appendChild(frag);
    }

    // Comic "POW!" text that pops up where she tapped
    function say(text, x, y, small = false) {
      if (reducedMotion) return;
      const el = document.createElement('span');
      el.className = 'reaction' + (small ? ' small' : '');
      el.textContent = text;
      el.style.left = Math.min(Math.max(x, 60), window.innerWidth - 60) + 'px';
      el.style.top = y + 'px';
      el.addEventListener('animationend', () => el.remove(), { once: true });
      document.body.appendChild(el);
    }

    const burstAtElement = (el, opts) => burst(...centerOf(el), opts);

    // Staggered confetti explosions (final celebration)
    async function celebrate() {
      const w = window.innerWidth, h = window.innerHeight;
      for (const [fx, fy] of [[.5, .3], [.2, .4], [.8, .4], [.5, .2], [.3, .25], [.7, .25]]) {
        burst(w * fx, h * fy, { hearts: 8, confetti: 26, spread: Math.min(w, 420) * 0.6 });
        await sleep(300);
      }
    }

    return { addScenery, addFloaters, burst, burstAtElement, say, celebrate };
  })();

  /* ---------- 4. Games ----------
     Each game takes its container element and returns a promise that resolves when
     the game is finished. Games only advance on her own taps/holds; nothing runs on a timer. */
  const Games = (() => {
    // Screen 2 – catch the bouncing hearts; each one flies into the heart-shaped love meter and fills it
    function hearts(el) {
      return new Promise((resolve) => {
        const field = $('.game-field', el);
        const layer = $('.field-hearts', el);
        const meter = $('.love-meter', el);
        const meterBody = $('.meter-body', el);
        const liquid = $('.liquid', el);
        const pct = $('.meter-pct', el);
        const pips = $$('.pip', el);
        const hint = $('.game-hint', el);
        const scoreNow = $('.score-now', el);
        const scoreBox = $('.game-score', el);
        const total = Number(el.dataset.count) || 5;
        const SIZE = 56;
        const shouts = ['GOT IT!', 'AWW!', 'YAY!', 'CUTE!', 'WOW!'];
        const items = [];
        let caught = 0, filled = 0, finished = false, rafId = 0, lastT = 0;
        // The last heart is shy: it dodges 3 attempts, then gives up with a funny message
        let attempts = 0, surrendered = false, teaseBusy = false;
        const msgEl = $('.field-msg', el);
        const teaseMsgs = ['Too slow! 😜💨', 'Haha, missed me! 🤭', 'Last chance... almost! 😏'];
        const showMsg = (text) => { msgEl.hidden = false; msgEl.textContent = text; msgEl.style.animation = 'none'; void msgEl.offsetWidth; msgEl.style.animation = ''; };
        const place = (it) => { it.el.style.transform = 'translate3d(' + it.x.toFixed(1) + 'px,' + it.y.toFixed(1) + 'px,0)'; };
        const lastHeart = () => (caught === total - 1 && items.length === 1 ? items[0] : null);

        const makeLast = (it) => {
          it.el.classList.add('last');
          const a = rand(0, Math.PI * 2);
          it.vx = Math.cos(a) * 150; it.vy = Math.sin(a) * 150;
          showMsg('Last one! It is feeling shy 🙈');
        };
        const dodge = (it) => {
          const w2 = field.clientWidth - SIZE, h2 = field.clientHeight - SIZE;
          let nx, ny, tries = 0;
          do { nx = rand(0, w2); ny = rand(0, h2); tries++; } while (Math.hypot(nx - it.x, ny - it.y) < Math.max(w2, h2) * 0.45 && tries < 12);
          it.x = nx; it.y = ny;
          const a = rand(0, Math.PI * 2), sp = 160 + attempts * 30;
          it.vx = Math.cos(a) * sp; it.vy = Math.sin(a) * sp;
          place(it);
        };
        const surrender = (it) => {
          surrendered = true; teaseBusy = false;
          it.vx *= 0.12; it.vy *= 0.12;
          it.el.classList.add('surrender');
          showMsg('Okay okay, you win! 😂 Tap me to complete ❤️');
          Sound.sfx('sparkle');
        };
        // One attempt on the shy heart (a hit or a miss both count)
        const tease = (it, hit) => {
          if (teaseBusy || surrendered) return;
          attempts++;
          showMsg(teaseMsgs[attempts - 1]);
          Sound.sfx('boing');
          const [tx, ty] = centerOf(it.el);
          Effects.say(hit ? 'NOPE!' : 'SWISH!', tx, ty, true);
          if (hit) dodge(it);
          if (attempts >= 3) { teaseBusy = true; setTimeout(() => surrender(it), 1000); }
        };

        // Create the hearts with random positions and velocities
        const w = field.clientWidth, h = field.clientHeight;
        for (let i = 0; i < total; i++) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'catch-heart';
          btn.setAttribute('aria-label', 'Catch the heart');
          const face = document.createElement('span');
          face.className = 'hf';
          face.textContent = pick(['💗', '💖', '💘', '💝']);
          btn.appendChild(face);
          const speed = rand(60, 105);
          const angle = rand(0, Math.PI * 2);
          const item = { el: btn, face: face.textContent, x: rand(0, w - SIZE), y: rand(0, h - SIZE), vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed || speed };
          btn.style.transform = 'translate3d(' + item.x + 'px,' + item.y + 'px,0)';
          btn._item = item;
          items.push(item);
          layer.appendChild(btn);
        }

        // Light physics loop: hearts bounce off the walls (runs only while the game is active)
        const frame = (t) => {
          const dt = Math.min(0.05, (t - lastT) / 1000 || 0);
          lastT = t;
          const maxX = field.clientWidth - SIZE, maxY = field.clientHeight - SIZE;
          for (const it of items) {
            it.x += it.vx * dt; it.y += it.vy * dt;
            if (it.x < 0) { it.x = 0; it.vx = Math.abs(it.vx); } else if (it.x > maxX) { it.x = maxX; it.vx = -Math.abs(it.vx); }
            if (it.y < 0) { it.y = 0; it.vy = Math.abs(it.vy); } else if (it.y > maxY) { it.y = maxY; it.vy = -Math.abs(it.vy); }
            it.el.style.transform = 'translate3d(' + it.x.toFixed(1) + 'px,' + it.y.toFixed(1) + 'px,0)';
          }
          if (!finished) rafId = requestAnimationFrame(frame);
        };
        if (!reducedMotion) { lastT = performance.now(); rafId = requestAnimationFrame(frame); }

        // A caught heart flies in an arc to the meter
        const fly = (x, y, emoji) => {
          const f = document.createElement('span');
          f.className = 'fly-heart';
          f.textContent = emoji;
          f.style.left = x + 'px'; f.style.top = y + 'px';
          document.body.appendChild(f);
          const [mx, my] = centerOf(meter);
          const dx = mx - x, dy = my - y;
          if (reducedMotion || !f.animate) { f.remove(); return Promise.resolve(); }
          const anim = f.animate([
            { transform: 'translate(-50%,-50%) scale(1.3)', opacity: 1 },
            { transform: 'translate(calc(-50% + ' + dx * 0.45 + 'px), calc(-50% + ' + (dy * 0.45 - 50) + 'px)) scale(1.6)', opacity: 1, offset: 0.45 },
            { transform: 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) scale(.4)', opacity: 0.9 },
          ], { duration: 650, easing: 'ease-in-out' });
          return anim.finished.then(() => f.remove(), () => f.remove());
        };

        const fillMeter = () => {
          filled++;
          const level = Math.round((filled / total) * 100);
          liquid.style.setProperty('--y', (96 - 104 * (level / 100)).toFixed(1));   // 96 = empty, -8 = full
          pct.textContent = level + '%';
          meterBody.classList.remove('splash'); void meterBody.getBoundingClientRect(); meterBody.classList.add('splash');
          Sound.sfx('ding');
          if (filled >= total) complete();
        };

        const complete = () => {
          finished = true;
          cancelAnimationFrame(rafId);
          field.classList.add('full');
          meter.classList.add('full');
          hint.textContent = 'Love meter FULL! 💖 Her names are unlocked 🔓';
          Sound.sfx('fanfare');
          Effects.burstAtElement(field, { hearts: 18, confetti: 26, spread: 150 });
          setTimeout(resolve, 1700);
        };

        const catchHeart = (btn) => {
          const it = btn && btn._item;
          if (!it || it.caught) return;
          if (lastHeart() === it && !surrendered) { tease(it, true); return; }   // the shy heart dodges
          it.caught = true;
          items.splice(items.indexOf(it), 1);
          const [x, y] = centerOf(btn);
          btn.remove();
          Effects.burst(x, y, { hearts: 3, confetti: 8, spread: 70, colors: ['#ff6fa5', '#ffb3cf', '#fff'] });
          Effects.say(shouts[caught % shouts.length], x, y);
          Sound.sfx('pop');
          if (navigator.vibrate) navigator.vibrate(15);
          pips[caught] && pips[caught].classList.add('on');
          scoreNow.textContent = ++caught;
          scoreBox.classList.remove('bump'); void scoreBox.offsetWidth; scoreBox.classList.add('bump');
          fly(x, y, it.face).then(fillMeter);
          if (items.length === 1) makeLast(items[0]);
          if (items.length === 0) msgEl.hidden = true;
        };

        // pointerdown = instant response, which feels much better than waiting for a click
        layer.addEventListener('pointerdown', (e) => {
          const b = e.target.closest('.catch-heart');
          if (b) { e.preventDefault(); catchHeart(b); }
          else if (lastHeart() && !surrendered) tease(lastHeart(), false);   // tapping empty space also counts as an attempt
        });
        layer.addEventListener('click', (e) => { if (e.detail === 0) catchHeart(e.target.closest('.catch-heart')); });   // keyboard users only

      });
    }

    // Screen 3 – answer the call
    function prepareGate(el) {
      $('.gate-icon', el).textContent = el.dataset.icon;
      $('.gate-label', el).textContent = el.dataset.label;
    }
    function answer(el) {
      return new Promise((resolve) => {
        const btn = $('.answer-btn', el);
        let done = false;
        const connect = () => {
          if (done) return;
          done = true;
          el.classList.add('answered');
          $('.gate-label', el).textContent = el.dataset.done;
          Sound.sfx('ding');
          Effects.burstAtElement(btn, { hearts: 5, confetti: 10, spread: 90 });
          setTimeout(resolve, 1100);
        };
        btn.addEventListener('click', connect, { once: true });
      });
    }

    // Screen 4 – tap any tile to pop its balloon and reveal the card
    function balloons(el) {
      return new Promise((resolve) => {
        const cells = $$('.cell', el);
        const fill = $('.pop-fill', el);
        const text = $('.pop-text', el);
        const shouts = ['POP!', 'BANG!', 'BOOM!', 'POW!', 'YAY!', 'AWW!'];
        let popped = 0;

        const markHint = () => {
          cells.forEach((c) => c.classList.remove('hint'));
          const nextCell = cells.find((c) => !c.classList.contains('popped'));
          if (nextCell) {
            nextCell.classList.add('hint');   // bouncing finger points at the next balloon
            if (popped > 0) focusOn(nextCell, 'fit');   // focus follows her action
          }
        };

        const pop = (cell) => {
          if (!cell || cell.classList.contains('popped')) return;
          const balloon = $('.balloon', cell);
          const [x, y] = centerOf(balloon);
          const color = getComputedStyle(cell).getPropertyValue('--c').trim() || '#ff9ec4';
          Effects.burst(x, y, { hearts: 3, confetti: 14, spread: 100, colors: [color, '#fff', color] });
          Effects.say(shouts[popped % shouts.length], x, y);
          Sound.sfx('pop');
          if (navigator.vibrate) navigator.vibrate(20);
          cell.classList.add('popped');
          cell.removeAttribute('role');
          cell.tabIndex = -1;
          popped++;
          fill.style.width = (popped / cells.length) * 100 + '%';
          text.textContent = popped >= cells.length ? 'All 6 popped! 💖' : popped + ' / ' + cells.length + ' popped';
          markHint();
          if (popped >= cells.length) { Sound.sfx('sparkle'); setTimeout(resolve, 1100); }
        };

        cells.forEach((cell) => {
          cell.addEventListener('click', () => pop(cell));
          cell.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pop(cell); } });
        });
        markHint();
      });
    }

    // Screen 5 – press & hold the heart to send a hug
    function hug(el) {
      return new Promise((resolve) => {
        const btn = $('.hug-heart', el);
        const text = $('.hug-text', el);
        const teaser = $('.hug-teaser', el);
        const body = $('.hug-body', el);
        let fill = 0, holding = false, finished = false;

        // 15 seconds to read first; then the prompt appears and the focus moves to it
        const note = $('.read-note', el);
        note.classList.add('run');
        sleep(CONFIG.readSeconds * 1000).then(() => {
          note.hidden = true;
          teaser.hidden = false;
          teaser.classList.add('pop');
          Sound.sfx('ding');
          focusOn(teaser, 'fit');
        });

        // The heart stays hidden until she taps the prompt
        teaser.addEventListener('click', () => {
          teaser.hidden = true;
          body.hidden = false;
          body.classList.add('reveal');
          Sound.sfx('sparkle');
          Effects.burstAtElement(body, { hearts: 8, confetti: 12, spread: 110 });
          focusOn(body, 'fit');
        }, { once: true });

        const complete = () => {
          finished = true;
          clearInterval(timer);
          btn.classList.remove('holding');
          btn.classList.add('done');
          btn.style.setProperty('--fill', 100);
          text.innerHTML = 'Hug delivered! 🤗💕<br><small>Narendra says: "squeezing very tightly"</small>';
          Sound.sfx('fanfare');
          Effects.burstAtElement(btn, { hearts: 18, confetti: 20, spread: 170 });
          if (navigator.vibrate) navigator.vibrate(60);
          setTimeout(resolve, 1500);
        };
        const timer = setInterval(() => {
          fill = Math.max(0, Math.min(100, fill + (holding ? 2.4 : -1.5)));
          btn.style.setProperty('--fill', fill);
          if (fill >= 100 && !finished) complete();
        }, 50);

        const start = () => { holding = true; btn.classList.add('holding'); };
        const stop = () => { holding = false; btn.classList.remove('holding'); };
        btn.addEventListener('pointerdown', (e) => { e.preventDefault(); start(); });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => btn.addEventListener(t, stop));
        btn.addEventListener('contextmenu', (e) => e.preventDefault());
        btn.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); start(); } });
        btn.addEventListener('keyup', stop);
        btn.addEventListener('click', () => { fill = Math.min(100, fill + 12); });   // quick taps help too
      });
    }

    // Screen 6 – tap to take steps until the two friends meet
    function walk(el) {
      return new Promise((resolve) => {
        const scene = $('.road-scene', el);
        const btn = $('.step-btn', el);
        const caption = $('.walk-caption', el);
        const total = 6;
        const lines = [
          'Step 1: Chitti, hurry up! 🏃‍♀️',
          'Oops, I tripped over my own feet 😂',
          'GPS says: "You are getting closer" 📍',
          'Almost there... snack break? 🍿',
          'My heart is racing! 💓 (or is it the stairs?)',
          'We finally meet!!! 🤗',
        ];
        const shouts = ['STEP!', 'OOPS!', 'HOP!', 'ZOOM!', 'THUMP!', 'HUG!'];
        let steps = 0;

        function step() {
          if (steps >= total) return;
          steps++;
          scene.style.setProperty('--p', (steps / total).toFixed(3));
          scene.classList.remove('stepping'); void scene.offsetWidth; scene.classList.add('stepping');
          caption.textContent = lines[steps - 1];
          const [x, y] = centerOf(btn);
          Effects.say(shouts[steps - 1], x, y - 20);
          Sound.sfx(steps === 2 ? 'boing' : 'step');
          if (steps === total) meet();
        }
        async function meet() {
          btn.hidden = true;
          await sleep(1000);
          scene.classList.add('met');
          Effects.burstAtElement($('.meet-heart', el), { hearts: 16, confetti: 24, spread: 150 });
          Sound.sfx('fanfare');
          await sleep(1700);
          resolve();
        }
        btn.addEventListener('click', step);
      });
    }

    // Screen 7 – blow out the candles (they relight – trick candles!)
    function candles(el) {
      return new Promise((resolve) => {
        const cake = $('.cake', el);
        const hint = $('.cake-hint', el);
        let used = false;

        async function blow() {
          if (used) return;
          used = true;
          const [x, y] = centerOf(cake);
          cake.classList.add('out');
          Sound.sfx('blow');
          Effects.say('FWOOSH!', x, y - 40);
          hint.textContent = 'Make a wish... 🤫✨';
          await sleep(2300);
          cake.classList.remove('out');
          hint.textContent = 'Trick candles! 😂 They refuse to stop celebrating you!';
          Sound.sfx('fanfare');
          Sound.birthday();
          Effects.say('SURPRISE!', x, y - 40);
          Effects.celebrate();
          await sleep(1800);
          resolve();
        }
        cake.addEventListener('click', blow);
      });
    }

    function init() { $$('.gate').forEach(prepareGate); }

    return { init, run: { hearts, answer, balloons, hug, walk, candles } };
  })();

  /* ---------- 5. Reveal: sequenced elements + games + typewriter ---------- */
  const Reveal = (() => {
    let runId = 0;   // incremented to cancel an in-flight sequence when leaving a screen

    // Types text without layout shift: typed characters are visible, the rest is rendered invisibly.
    async function typewrite(el, id) {
      const text = el.dataset.fullText || (el.dataset.fullText = el.textContent.trim());
      if (reducedMotion) { el.textContent = text; return; }
      const done = document.createElement('span');
      const rest = document.createElement('span');
      done.className = 't-done';
      rest.className = 't-rest';
      rest.textContent = text;
      el.textContent = '';
      el.append(done, rest);
      el.classList.add('typing');
      for (let i = 1; i <= text.length; i++) {
        if (id !== runId) return;
        done.textContent = text.slice(0, i);
        rest.textContent = text.slice(i);
        await sleep(CONFIG.typeSpeedMs);
      }
      el.classList.remove('typing');
    }

    async function play(screen) {
      const id = ++runId;
      for (const el of $$('[data-seq]', screen)) {
        if (id !== runId) return;
        el.classList.add('show');
        const focusMode = el.dataset.focus || (el.dataset.game ? 'top' : 'follow');   // landing keeps the top in focus; the view only follows as needed
        if (focusMode !== 'none') focusOn(el, focusMode);
        const game = el.dataset.game;
        if (game && Games.run[game]) await Games.run[game](el);   // wait here until the mini-game is done
        if (id !== runId) return;
        if (el.hasAttribute('data-type')) await typewrite(el, id);
        await sleep(reducedMotion ? 80 : Number(el.dataset.gap) || CONFIG.defaultGapMs);
      }
      // Final screen: once the message is fully revealed, Happy Birthday plays on repeat
      if (id === runId && screen.hasAttribute('data-final')) Sound.birthdayForever();
    }

    const cancel = () => { runId++; };
    return { play, cancel };
  })();

  /* ---------- 6. Navigator ---------- */
  const Navigator = (() => {
    const screens = $$('.screen');
    const flash = document.createElement('div');
    flash.className = 'page-flash';
    document.body.appendChild(flash);

    let index = 0;
    let busy = false;   // blocks accidental double-clicks while a transition runs

    // Screen 1: unbox the gift in 3 taps. Only then does the gift disable itself and "Let's Begin" unlock.
    function setupGift() {
      const gift = $('#gift');
      const hint = $('#giftHint');
      const startBtn = $('#startBtn');
      const dots = $$('#giftSteps i');
      const lines = [
        'Hey! Careful, it is fragile 😂',
        'Patience, Chitti! 😜',
        'No peeking... 🙈',
        'Almost there... one more tap! 😍',
      ];
      const doneLine = 'Okay okay, press the button below ✨';
      const shouts = ['WOBBLE!', 'CRACK!', 'WHOA!', 'SHAKE!', 'TA-DA!'];
      const TOTAL = 5;
      let taps = 0, opening = false;

      async function unbox() {
        opening = true;
        gift.classList.remove('shake');
        gift.dataset.stage = '';
        gift.classList.add('open');
        Sound.sfx('gift');
        Effects.burstAtElement(gift, { hearts: 18, confetti: 32, spread: 200 });
        const [x, y] = centerOf(gift);
        Effects.say('TA-DA!', x, y - 50);
        await sleep(reducedMotion ? 100 : 1200);
        gift.disabled = true;                       // the gift is done: no more tapping
        gift.classList.add('opened');
        gift.setAttribute('aria-label', 'The gift box is open');
        hint.textContent = doneLine;
        startBtn.disabled = false;                  // now the button unlocks
        $('.btn-label', startBtn).textContent = "Let's Begin ✨";
        startBtn.style.setProperty('--d', '0s');
        Sound.sfx('sparkle');
      }

      gift.addEventListener('click', () => {
        if (opening || gift.disabled) return;
        Sound.startAfterInteraction();              // first tap = first interaction → music may start
        taps++;
        dots.slice(0, taps).forEach((d) => d.classList.add('on'));
        const [x, y] = centerOf(gift);
        Effects.say(shouts[taps - 1], x, y - 30);
        if (taps >= TOTAL) { unbox(); return; }
        gift.dataset.stage = String(taps);
        gift.classList.remove('shake'); void gift.offsetWidth; gift.classList.add('shake');
        hint.textContent = lines[taps - 1];
        Sound.sfx('boing');
        Effects.burst(x, y, { hearts: 3, confetti: 6, spread: 80 });
      });
    }

    const beforeLeave = {};   // optional per-screen hooks that run before leaving a screen

    function setHeader(i) {
      const label = $('#chapterLabel');
      const fill = $('#progressFill');
      if (label) label.textContent = 'Chapter ' + (i + 1) + ' of ' + screens.length + ' · ' + (screens[i].dataset.title || '');
      if (fill) fill.style.width = ((i + 1) / screens.length) * 100 + '%';
    }

    function enterScreen(screen, i) {
      setHeader(i);
      Effects.addFloaters(screen, i === 6 ? 20 : undefined);
      $$('.seq', screen).forEach((el) => el.classList.remove('show'));
      screen.scrollTop = 0;   // every screen lands with its top in focus
      Reveal.play(screen);
    }

    async function next(button) {
      if (busy || index >= screens.length - 1) return;
      busy = true;
      button.classList.add('clicked');
      button.disabled = true;
      Reveal.cancel();

      if (beforeLeave[index]) await beforeLeave[index]();
      else Sound.sfx('page');

      const current = screens[index];
      const upcoming = screens[index + 1];

      flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');   // comic page-turn flash
      current.classList.remove('is-active');
      current.classList.add('is-leaving');
      upcoming.classList.add('is-entering');
      enterScreen(upcoming, index + 1);

      await sleep(reducedMotion ? 50 : CONFIG.enterMs);
      current.classList.remove('is-leaving');
      upcoming.classList.remove('is-entering');
      upcoming.classList.add('is-active');

      index++;
      busy = false;
    }

    function init() {
      screens.forEach(Effects.addScenery);
      Games.init();
      setupGift();
      setHeader(0);
      // Event delegation: one listener handles every Continue button
      document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-continue]');
        if (!btn || btn.disabled) return;
        if (index === 0) Sound.startAfterInteraction();   // music only after the first tap
        next(btn);
      });
      Effects.addFloaters(screens[0]);
    }

    return { init };
  })();

  Navigator.init();
})();
