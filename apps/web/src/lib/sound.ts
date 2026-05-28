let audioCtx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMute(): boolean {
  muted = !muted;
  return muted;
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.15,
  delay = 0,
) {
  if (muted) return;
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime + delay);
  gain.gain.setValueAtTime(volume, ctx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + duration);
}

/** 轻点音效 — 清脆的点击 */
export function playClick() {
  playTone(800, 0.08, "sine", 0.1);
  playTone(1200, 0.06, "sine", 0.06, 0.03);
}

/** 种植音效 — 低沉的泥土声 */
export function playPlant() {
  playTone(200, 0.3, "triangle", 0.15);
  playTone(150, 0.4, "triangle", 0.1, 0.15);
  playTone(250, 0.2, "sine", 0.08, 0.35);
}

/** 完成音效 — 温暖的上升和弦 */
export function playComplete() {
  playTone(523, 0.4, "sine", 0.12);
  playTone(659, 0.4, "sine", 0.12, 0.15);
  playTone(784, 0.5, "sine", 0.12, 0.3);
}

/** 点赞音效 — 短促心跳 */
export function playLike() {
  playTone(400, 0.1, "sine", 0.15);
  playTone(500, 0.15, "sine", 0.12, 0.12);
}

/** 通知音效 — 叮咚 */
export function playNotify() {
  playTone(880, 0.15, "sine", 0.1);
  playTone(1100, 0.2, "sine", 0.08, 0.1);
}

/** 背景音乐 — 循环播放的轻柔旋律 */
let bgOscillators: OscillatorNode[] = [];
let bgPlaying = false;

export function isBgPlaying(): boolean {
  return bgPlaying;
}

export function startBgMusic() {
  if (muted || bgPlaying) return;
  const ctx = getCtx();

  const notes = [261, 293, 329, 349, 392, 349, 329, 293];
  const duration = 0.6;
  const totalLoop = notes.length * duration;

  function playLoop() {
    if (!bgPlaying) return;
    notes.forEach((freq, i) => {
      if (!bgPlaying) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * duration);
      gain.gain.setValueAtTime(0.03, ctx.currentTime + i * duration);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * duration + duration * 0.9);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * duration);
      osc.stop(ctx.currentTime + i * duration + duration);
      bgOscillators.push(osc);
    });
    setTimeout(playLoop, totalLoop * 1000);
  }

  bgPlaying = true;
  playLoop();
}

export function stopBgMusic() {
  bgPlaying = false;
  bgOscillators.forEach((osc) => {
    try {
      osc.stop();
    } catch {
      // already stopped
    }
  });
  bgOscillators = [];
}
