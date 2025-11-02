// assets/js/timer-logic.js
// UI-compatible timer engine + helpers (HH:MM:SS up to 99:59:59)

export class ProTimer {
  // onTick(ms), onFinish?()
  constructor(onTick, onFinish) {
    this.mode = 'up';        // 'up' | 'down'
    this.durationMs = 0;     // only used for countdown
    this.elapsedMs = 0;
    this.running = false;
    this._raf = null;
    this._startedAt = 0;
    this.onTick = typeof onTick === 'function' ? onTick : () => {};
    this.onFinish = typeof onFinish === 'function' ? onFinish : null;
  }

  setMode(mode) {
    const wasRunning = this.running;
    this.stop();
    this.mode = mode === 'down' ? 'down' : 'up';
    this.elapsedMs = 0;
    this._emit();
    if (wasRunning) this.start();
  }

  setDuration(ms) {
    this.durationMs = Math.max(0, ms | 0);
    this.elapsedMs = 0;
    this._emit();
  }

  start() {
    if (this.running) return;
    if (this.mode === 'down' && !this.durationMs) return;

    this.running = true;
    this._startedAt = performance.now();

    const tick = () => {
      if (!this.running) return;
      const now = performance.now();
      const delta = now - this._startedAt;
      const t = this.elapsedMs + delta;

      if (this.mode === 'down') {
        const remaining = Math.max(0, this.durationMs - t);
        this.onTick(remaining);
        if (remaining <= 0) {
          this.stop();
          this.elapsedMs = this.durationMs;
          if (this.onFinish) this.onFinish();
          return;
        }
      } else {
        this.onTick(t);
      }
      this._raf = requestAnimationFrame(tick);
    };

    this._raf = requestAnimationFrame(tick);
  }

  stop() {
    if (!this.running) return;
    cancelAnimationFrame(this._raf);
    this._raf = null;
    const now = performance.now();
    this.elapsedMs += (now - this._startedAt);
    this.running = false;
  }

  clear() {
    this.stop();
    this.elapsedMs = 0;
    this._emit();
  }

  _emit() {
    if (this.mode === 'down') {
      const remaining = Math.max(0, this.durationMs - this.elapsedMs);
      this.onTick(remaining);
    } else {
      this.onTick(this.elapsedMs);
    }
  }
}

/* -------------------------- Helpers (HH:MM:SS) --------------------------- */

// Keep the name `formatMMSS` because the UI imports that identifier.
// Implement it to format **HH:MM:SS** (hours 00–99).
export function formatMMSS(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return (
    String(Math.min(h, 99)).padStart(2, '0') + ':' +
    String(m).padStart(2, '0') + ':' +
    String(s).padStart(2, '0')
  );
}

// Parse "HH:MM:SS" → milliseconds (rejects >99 hours or >59 mins/secs)
export function parseDuration(str) {
  const m = /^(\d{2}):(\d{2}):(\d{2})$/.exec(String(str) || '');
  if (!m) return 0;
  const h = +m[1], mi = +m[2], s = +m[3];
  if (h > 99 || mi > 59 || s > 59) return 0;
  return ((h * 3600) + (mi * 60) + s) * 1000;
}

/* Optional aliases if other code uses these names elsewhere */
export const formatHHMMSS = formatMMSS;
export const parseDurationHHMMSS = parseDuration;
