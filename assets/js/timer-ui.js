// assets/js/timer-ui.js
// Robust UI controller for the timer.
// - Wires up only after DOM is ready
// - Blocks non-digit typing (hard prevent)
// - Prevents form submit from killing clicks
// - Auto-colon, countdown/up, white flash, audio alarm

import { ProTimer, formatMMSS, parseDuration } from './timer-logic.js';

/* ---------------------- Boot: wait for DOM, then init ---------------------- */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init() {
  /* -------------------------- Element references -------------------------- */
  const el = {
    timeField: document.getElementById('timeField'),
    start: document.getElementById('startBtn'),
    stop: document.getElementById('stopBtn'),
    clear: document.getElementById('clearBtn'),
    modeSwitch: document.getElementById('modeSwitch'),
    shell:
      document.getElementById('timer') ||
      document.querySelector('.timer') ||
      document.body,
    alarmEl: document.getElementById('alarmAudio'),
  };

  // On-page error helper (makes failures obvious, not silent)
  function showFatal(msg) {
    console.error('[timer-ui]', msg);
    const n = document.createElement('div');
    n.textContent = msg;
    n.style.cssText =
      'margin:.5rem 0;padding:.5rem;border:2px solid #c00;color:#c00;background:#fee;font:600 14px system-ui;';
    (el.shell || document.body).prepend(n);
  }

  // Verify required elements exist
  const missing = [
    ['#timeField', el.timeField],
    ['#startBtn', el.start],
    ['#stopBtn', el.stop],
    ['#clearBtn', el.clear],
    ['#modeSwitch', el.modeSwitch],
  ].filter(([_, node]) => !node);

  if (missing.length) {
    showFatal(
      `Missing required element(s): ${missing.map(([id]) => id).join(', ')}`
    );
    return;
  }

  /* ------------------------ Form submit interference ----------------------- */
  // If your buttons are inside a <form>, clicks might submit and reload.
  // Stop that at the form level.
  const form = el.timeField.closest('form');
  if (form) {
    form.addEventListener('submit', (e) => e.preventDefault());
  }

  /* -------------------------- Input configuration -------------------------- */
  // Mobile keypad hint + domain validation hint
  el.timeField.setAttribute('inputmode', 'numeric');
  // 5 chars: "MM:SS"
  el.timeField.setAttribute('maxlength', '5');
  // Pattern allows 0-2 digits, optional colon, 0-2 digits (we still enforce via JS)
  el.timeField.setAttribute('pattern', '^\\d{0,2}:?\\d{0,2}$');

  // Hard block any non-digit edits (except control/navigation) at the source.
  el.timeField.addEventListener('beforeinput', (e) => {
    // Allow deletions, history ops, and inserts that are digits or colon.
    const t = e.inputType || '';
    if (
      t.startsWith('delete') ||
      t === 'historyUndo' ||
      t === 'historyRedo'
    ) {
      return; // allow
    }
    const data = e.data ?? '';
    // Permit only digits; we will insert the colon ourselves in normalize().
    if (!/^\d*$/.test(data)) {
      e.preventDefault();
    }
  });

  // Secondary guard: block non-control non-digit keys
  el.timeField.addEventListener('keydown', (e) => {
    const k = e.key;
    const ctrlLike =
      e.ctrlKey || e.metaKey || e.altKey || k === 'Tab' || k === 'Enter';
    const navLike =
      k === 'ArrowLeft' ||
      k === 'ArrowRight' ||
      k === 'Home' ||
      k === 'End' ||
      k === 'Backspace' ||
      k === 'Delete';
    if (ctrlLike || navLike) return;
    // Only digits otherwise
    if (!/^\d$/.test(k)) e.preventDefault();
  });

  /* ------------------------- Audio + finish effects ------------------------ */
  const alarm = el.alarmEl || new Audio('/audio/alarm.mp3');
  try {
    alarm.preload = 'auto';
  } catch {}

  function playAlarm() {
    try {
      alarm.currentTime = 0;
    } catch {}
    const p = alarm.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }

  // Reliable flash retrigger
  function flashOnce() {
    const n = el.shell || document.body;
    n.classList.remove('is-finished');
    void n.offsetWidth; // reflow to restart animation
    n.classList.add('is-finished');
    setTimeout(() => n.classList.remove('is-finished'), 950);
  }

  function triggerFinishEffects(mode) {
    flashOnce();
    playAlarm();
    if (mode === 'down') {
      el.timeField.readOnly = false;
      el.timeField.focus();
      el.timeField.select();
    }
  }

  /* ------------------------------ Timer engine ------------------------------ */
  let targetMs = 0;

  const timer = new ProTimer(
    (valueMs) => {
      el.timeField.value = formatMMSS(valueMs);
      if (timer.mode === 'up' && targetMs > 0 && valueMs >= targetMs) {
        timer.stop();
        el.start.disabled = false;
        el.stop.disabled = true;
        el.timeField.readOnly = false;
        triggerFinishEffects('up');
      }
    },
    () => {
      triggerFinishEffects('down');
    }
  );

  /* ---------------------------- Typing / parsing ---------------------------- */
  function toMMSS(raw) {
    const digits = (raw.match(/\d+/g) || []).join('').slice(0, 4);
    const padded = digits.padStart(4, '0');
    return `${padded.slice(0, 2)}:${padded.slice(2)}`;
  }

  function getEnteredMs() {
    return parseDuration(el.timeField.value);
  }

  function normalizeField() {
    el.timeField.value = toMMSS(el.timeField.value);
    const end = el.timeField.value.length;
    try {
      el.timeField.setSelectionRange(end, end);
    } catch {}
  }

  function refreshStartDisabled() {
    const needDur = timer.mode === 'down';
    el.start.disabled = needDur && !getEnteredMs();
  }

  /* --------------------------------- Mode ---------------------------------- */
  function applyModeFromSwitch() {
    const mode = el.modeSwitch.checked ? 'down' : 'up';
    timer.setMode(mode);

    if (mode === 'down') {
      el.timeField.readOnly = false;
      if (!getEnteredMs()) el.timeField.value = '00:00';
      const ms = getEnteredMs();
      if (ms) timer.setDuration(ms);
    } else {
      el.timeField.readOnly = false;
      el.timeField.value = '00:00';
      targetMs = 0;
    }

    refreshStartDisabled();
    el.stop.disabled = true;
  }

  el.modeSwitch.addEventListener('change', applyModeFromSwitch);

  /* -------------------------------- Input ---------------------------------- */
    // Microwave-style entry: typing replaces digits smoothly (no highlighting needed)
    el.timeField.addEventListener('keydown', (e) => {
    // Allow control keys (backspace, arrows, etc.)
    const allowed =
        e.key === 'Backspace' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight' ||
        e.key === 'Delete' ||
        e.key === 'Tab' ||
        e.ctrlKey ||
        e.metaKey;

    if (allowed) return; // let normal controls work

    // Only handle digits
    if (!/^\d$/.test(e.key)) {
        e.preventDefault();
        return;
    }

    // Read current digits, ignore colon
    let digits = el.timeField.value.replace(/:/g, '');

    // Push new digit to the right, drop the oldest (keep 4 max)
    digits = (digits + e.key).slice(-4);

    // Rebuild in MM:SS format
    const formatted = `${digits.slice(0, 2)}:${digits.slice(2)}`;
    el.timeField.value = formatted;

    const ms = parseDuration(formatted);
    if (timer.mode === 'down') timer.setDuration(ms);
    else targetMs = ms;
    refreshStartDisabled();

    // Prevent browser from inserting the raw key
    e.preventDefault();
    });



  el.timeField.addEventListener('keydown', (e) => {
    const k = e.key;

    if (k === 'Enter') {
      if (!el.start.disabled) el.start.click();
      e.preventDefault();
      return;
    }

    if (k === 'ArrowUp' || k === 'ArrowDown') {
      const delta = k === 'ArrowUp' ? 1000 : -1000;
      let ms = Math.max(0, getEnteredMs() + delta);
      el.timeField.value = formatMMSS(ms);
      if (timer.mode === 'down') timer.setDuration(ms);
      else targetMs = ms;
      const end = el.timeField.value.length;
      try {
        el.timeField.setSelectionRange(end, end);
      } catch {}
      e.preventDefault();
    }
  });

  /* ------------------------------- Controls -------------------------------- */
  // Prevent default on clicks in case buttons are <button type="submit">
  el.start.addEventListener('click', (e) => {
    e.preventDefault();

    if (timer.mode === 'down') {
      const ms = getEnteredMs();
      if (!ms) return;
      timer.setDuration(ms);
      el.timeField.readOnly = true;
    } else {
      targetMs = getEnteredMs();
      el.timeField.readOnly = true;
    }

    timer.start();
    el.start.disabled = true;
    el.stop.disabled = false;
  });

  el.stop.addEventListener('click', (e) => {
    e.preventDefault();
    timer.stop();
    el.timeField.readOnly = false;
    el.start.disabled = false;
    el.stop.disabled = true;
  });

  el.clear.addEventListener('click', (e) => {
    e.preventDefault();
    timer.clear();
    el.timeField.value = '00:00';
    el.timeField.readOnly = false;
    targetMs = 0;
    refreshStartDisabled();
    el.stop.disabled = true;
  });

  /* --------------------------- Global shortcuts ---------------------------- */
  document.addEventListener('keydown', (e) => {
    const activeIsTime = document.activeElement === el.timeField;

    if (e.key === ' ') {
      if (!activeIsTime) {
        e.preventDefault();
        if (el.stop.disabled) el.start.click();
        else el.stop.click();
      }
    } else if (e.key === 'Escape') {
      el.clear.click();
    }
  });

  /* ------------------------------ Initial state ---------------------------- */
  el.modeSwitch.checked = false;
  el.timeField.value = '00:00';
  applyModeFromSwitch();
  refreshStartDisabled();
  el.stop.disabled = true;
}
