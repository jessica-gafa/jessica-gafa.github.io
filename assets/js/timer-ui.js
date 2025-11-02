
// Robust UI controller for the timer.
// - Wires up only after DOM is ready
// - Blocks non-digit typing (hard prevent)
// - Prevents form submit from killing clicks
// - Auto-colon, countdown/up, white flash, audio alarm
// assets/js/timer-ui.js
// HH:MM:SS up to 99:59:59; only validates on Start click.

import { ProTimer, formatHHMMSS, parseDuration } from './timer-logic.js';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init() {
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

  el.timeField.setAttribute('type', 'text');

  function showPopup(message) {
    const old = document.querySelector('.timer-popup');
    if (old) old.remove();
    const popup = document.createElement('div');
    popup.className = 'timer-popup';
    popup.textContent = message;
    document.body.appendChild(popup);
    setTimeout(() => {
      popup.style.opacity = '0';
      setTimeout(() => popup.remove(), 800);
    }, 2500);
  }

  const missing = [
    ['#timeField', el.timeField],
    ['#startBtn', el.start],
    ['#stopBtn', el.stop],
    ['#clearBtn', el.clear],
    ['#modeSwitch', el.modeSwitch],
  ].filter(([, node]) => !node);
  if (missing.length) {
    console.error('Missing:', missing.map(([id]) => id).join(', '));
    return;
  }

  const form = el.timeField.closest('form');
  if (form) form.addEventListener('submit', (e) => e.preventDefault());

  el.timeField.setAttribute('inputmode', 'numeric');
  el.timeField.setAttribute('maxlength', '8');
  el.timeField.setAttribute('pattern', '^\\d{0,2}:?\\d{0,2}:?\\d{0,2}$');

  el.timeField.addEventListener('beforeinput', (e) => {
    if (e.inputType === 'insertText') {
      const data = e.data ?? '';
      if (!/^\d$/.test(data)) e.preventDefault();
    }
  });

  const alarm = el.alarmEl || new Audio('/audio/alarm.mp3');
  try { alarm.preload = 'auto'; } catch {}

  function playAlarm() {
    try { alarm.currentTime = 0; } catch {}
    const p = alarm.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }

  function flashOnce() {
    const n = el.shell || document.body;
    n.classList.remove('is-finished');
    void n.offsetWidth;
    n.classList.add('is-finished');
    setTimeout(() => n.classList.remove('is-finished'), 950);
  }

  function triggerFinishEffects(whichMode) {
    flashOnce();
    playAlarm();
    if (whichMode === 'down') {
      el.timeField.readOnly = false;
      el.timeField.focus();
      el.timeField.select();
    }
  }

  let targetMs = 0;
  let mode = 'up';
  let upStopTimer = null;

  function formatForDisplay(ms, isCountdown) {
    const total = Math.max(0, (isCountdown ? Math.ceil(ms / 1000) : Math.floor(ms / 1000)));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return (
      String(Math.min(h, 99)).padStart(2, '0') + ':' +
      String(m).padStart(2, '0') + ':' +
      String(s).padStart(2, '0')
    );
  }

  const timer = new ProTimer(
    (valueMs) => {
      el.timeField.value = formatForDisplay(valueMs, mode === 'down');
    },
    () => triggerFinishEffects('down')
  );

  function toHHMMSSLenient(raw) {
    const digits = (raw.match(/\d+/g) || []).join('').slice(-6).padStart(6, '0');
    return digits.slice(0, 2) + ':' + digits.slice(2, 4) + ':' + digits.slice(4, 6);
  }

  function isValidHHMMSS(value) {
    const m = /^(\d{2}):(\d{2}):(\d{2})$/.exec(value);
    if (!m) return false;
    const h = +m[1], mi = +m[2], s = +m[3];
    return h <= 99 && mi <= 59 && s <= 59;
  }

  function getEnteredMs() {
    return parseDuration(el.timeField.value);
  }

  function clearUpStopTimer() {
    if (upStopTimer) {
      clearTimeout(upStopTimer);
      upStopTimer = null;
    }
  }

  function applyModeFromSwitch() {
    mode = el.modeSwitch.checked ? 'down' : 'up';
    if (typeof timer.setMode === 'function') timer.setMode(mode);
    el.timeField.readOnly = false;
    el.stop.disabled = true;
  }

  el.modeSwitch.addEventListener('change', applyModeFromSwitch);

  // lenient: only reformat, no validation/disable logic
  el.timeField.addEventListener('input', () => {
    el.timeField.value = toHHMMSSLenient(el.timeField.value);
  });

  el.timeField.addEventListener('keydown', (e) => {
    const allowed =
      e.key === 'Backspace' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
      e.key === 'Delete' || e.key === 'Tab' || e.ctrlKey || e.metaKey;
    if (allowed) return;

    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
      return;
    }

    let digits = el.timeField.value.replace(/:/g, '');
    digits = (digits + e.key).slice(-6);
    el.timeField.value = toHHMMSSLenient(digits);
    e.preventDefault();
  });

  el.start.addEventListener('click', (e) => {
    e.preventDefault();
    clearUpStopTimer();

    const value = el.timeField.value.trim();
    const valid = isValidHHMMSS(value);

    if (!valid) {
      showPopup('Invalid time. Use HH:MM:SS up to 99:59:59.');
      el.timeField.select();
      return;
    }

    const ms = getEnteredMs();

    if (mode === 'down') {
      if (!ms) {
        showPopup('Enter a duration for countdown.');
        el.timeField.focus();
        return;
      }
      timer.setDuration(ms);
      targetMs = 0;
    } else {
      targetMs = ms > 0 ? ms : 0;
      if (targetMs > 0) {
        upStopTimer = setTimeout(() => {
          timer.stop();
          el.start.disabled = false;
          el.stop.disabled = true;
          el.timeField.readOnly = false;
          triggerFinishEffects('up');
        }, targetMs);
      }
    }

    el.timeField.readOnly = true;
    timer.start();
    el.start.disabled = true;
    el.stop.disabled = false;
  });

  el.stop.addEventListener('click', (e) => {
    e.preventDefault();
    timer.stop();
    clearUpStopTimer();
    el.timeField.readOnly = false;
    el.start.disabled = false;
    el.stop.disabled = true;
  });

  el.clear.addEventListener('click', (e) => {
    e.preventDefault();
    timer.clear();
    clearUpStopTimer();
    el.timeField.value = '00:00:00';
    el.timeField.readOnly = false;
    el.start.disabled = false;
    el.stop.disabled = true;
  });

  el.timeField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (el.stop.disabled) el.start.click();
      else el.stop.click();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      el.clear.click();
    }
  });

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

  el.modeSwitch.checked = false;
  el.timeField.value = '00:00:00';
  applyModeFromSwitch();
  el.stop.disabled = true;
}
