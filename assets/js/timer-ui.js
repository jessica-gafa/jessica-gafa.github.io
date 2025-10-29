import { ProTimer, formatMMSS, parseDuration } from './timer-logic.js';

const el = {
  timeField: document.getElementById('timeField'),
  start: document.getElementById('startBtn'),
  stop: document.getElementById('stopBtn'),
  clear: document.getElementById('clearBtn'),
  modeSwitch: document.getElementById('modeSwitch'), // toggle: off=up, on=down
  shell: document.getElementById('timer'),
  alarm: document.getElementById('alarmSound'), // 🔔 new
};

let targetMs = 0; // for stopping count up at a set time

// Function to play alarm sound
function playAlarm() {
  el.alarm.currentTime = 0;
  el.alarm.play().catch(err => console.warn('Alarm sound could not play:', err));
}

const timer = new ProTimer(
  (valueMs) => {
    el.timeField.value = formatMMSS(valueMs);

    // Stop automatically in Count Up if target set
    if (timer.mode === 'up' && targetMs > 0 && valueMs >= targetMs) {
      timer.stop();
      el.start.disabled = false;
      el.stop.disabled = true;
      el.timeField.readOnly = false;
      playAlarm(); // 🔔 play alarm when target reached
    }
  },
  () => {
    el.shell.classList.add('is-finished');
    setTimeout(() => el.shell.classList.remove('is-finished'), 950);

    // Play alarm on countdown finish
    playAlarm();

    if (timer.mode === 'down') {
      el.timeField.readOnly = false;
      el.timeField.focus();
      el.timeField.select();
    }
  }
);

function getEnteredMs() {
  return parseDuration(el.timeField.value);
}

function refreshStartDisabled() {
  const needDur = timer.mode === 'down';
  el.start.disabled = needDur && !getEnteredMs();
}

function applyModeFromSwitch() {
  const mode = el.modeSwitch.checked ? 'down' : 'up';
  timer.setMode(mode);

  if (mode === 'down') {
    el.timeField.readOnly = false;
    if (!getEnteredMs()) el.timeField.value = '00:00';
  } else {
    el.timeField.readOnly = false;
    el.timeField.value = '00:00';
  }

  refreshStartDisabled();
  el.stop.disabled = true;
}

// Toggle mode
el.modeSwitch.addEventListener('change', applyModeFromSwitch);

// Typing in time field
el.timeField.addEventListener('input', () => {
  const ms = getEnteredMs();
  if (timer.mode === 'down') {
    timer.setDuration(ms);
  } else {
    targetMs = ms; // record target stop time for count up
  }
  refreshStartDisabled();
});

// Start
el.start.addEventListener('click', () => {
  if (timer.mode === 'down') {
    const ms = getEnteredMs();
    if (!ms) return;
    timer.setDuration(ms);
  } else {
    targetMs = getEnteredMs();
  }

  el.timeField.readOnly = true;
  timer.start();
  el.start.disabled = true;
  el.stop.disabled = false;
});

// Stop
el.stop.addEventListener('click', () => {
  timer.stop();
  el.timeField.readOnly = false;
  el.start.disabled = false;
  el.stop.disabled = true;
});

// Clear
el.clear.addEventListener('click', () => {
  timer.clear();
  el.timeField.value = '00:00';
  el.timeField.readOnly = false;
  targetMs = 0;
  refreshStartDisabled();
  el.stop.disabled = true;
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === ' ') {
    e.preventDefault();
    if (el.stop.disabled) el.start.click();
    else el.stop.click();
  } else if (e.key === 'Escape') {
    el.clear.click();
  }
});

// Initial state
el.modeSwitch.checked = false;
applyModeFromSwitch();
