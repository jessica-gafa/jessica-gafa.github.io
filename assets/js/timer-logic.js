// assets/js/timer-logic.js

// Pure timer engine using performance.now() to minimise drift.
// Exports: ProTimer, formatMMSS, parseDuration

export class ProTimer {
  constructor(onTick, onFinish){
    this.mode = 'up';           // 'up' | 'down'
    this.durationMs = 0;        // only used in countdown
    this.elapsedMs = 0;
    this.running = false;
    this._raf = null;
    this._startedAt = 0;
    this.onTick = onTick;
    this.onFinish = onFinish;
  }

  setMode(mode){
    const wasRunning = this.running;
    this.stop();
    this.mode = mode;
    this.elapsedMs = 0;
    this._emit();
    if (wasRunning) this.start();
  }

  setDuration(ms){
    this.durationMs = Math.max(0, ms | 0);
    this.elapsedMs = 0;
    this._emit();
  }

  start(){
    if (this.running) return;
    if (this.mode === 'down' && !this.durationMs) return;

    this.running = true;
    this._startedAt = performance.now();

    const tick = () => {
      if (!this.running) return;
      const now = performance.now();
      const delta = now - this._startedAt;
      const t = this.elapsedMs + delta;

      if (this.mode === 'down'){
        const remaining = Math.max(0, this.durationMs - t);
        this.onTick(remaining, this.mode);
        if (remaining <= 0){
          this.stop();
          this.elapsedMs = this.durationMs;
          this.onFinish?.();
          return;
        }
      } else {
        this.onTick(t, this.mode);
      }
      this._raf = requestAnimationFrame(tick);
    };

    this._raf = requestAnimationFrame(tick);
  }

  stop(){
    if (!this.running) return;
    cancelAnimationFrame(this._raf);
    this._raf = null;
    const now = performance.now();
    this.elapsedMs += (now - this._startedAt);
    this.running = false;
  }

  clear(){
    this.stop();
    this.elapsedMs = 0;
    this._emit();
  }

  _emit(){
    if (this.mode === 'down'){
      const remaining = Math.max(0, this.durationMs - this.elapsedMs);
      this.onTick(remaining, this.mode);
    } else {
      this.onTick(this.elapsedMs, this.mode);
    }
  }
}

// Helpers stay pure
export const formatMMSS = (ms) => {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const parseDuration = (raw) => {
  const m = (raw ?? '').trim().match(/^(\d{1,2}):([0-5]\d)$/);
  if (!m) return 0;
  const minutes = parseInt(m[1], 10);
  const seconds = parseInt(m[2], 10);
  return (minutes * 60 + seconds) * 1000;
};
