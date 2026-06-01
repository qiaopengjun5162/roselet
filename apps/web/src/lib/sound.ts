import * as Tone from "tone";

let started = false;
let muted = false;

async function ensureStarted() {
  if (!started) {
    await Tone.start();
    started = true;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMute(): boolean {
  muted = !muted;
  Tone.getDestination().mute = muted;
  return muted;
}

/** 轻点音效 — 清脆的钢琴音 */
export async function playClick() {
  if (muted) return;
  await ensureStarted();
  const synth = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 },
  }).toDestination();
  synth.volume.value = -12;
  synth.triggerAttackRelease("C5", "16n");
  setTimeout(() => synth.dispose(), 500);
}

/** 种植音效 — 温暖的和弦 */
export async function playPlant() {
  if (muted) return;
  await ensureStarted();
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.05, decay: 0.3, sustain: 0.1, release: 0.5 },
  }).toDestination();
  synth.volume.value = -15;
  synth.triggerAttackRelease(["C4", "E4", "G4"], "4n");
  setTimeout(() => synth.dispose(), 1000);
}

/** 完成音效 — 上升琶音 */
export async function playComplete() {
  if (muted) return;
  await ensureStarted();
  const synth = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.02, decay: 0.2, sustain: 0.1, release: 0.4 },
  }).toDestination();
  synth.volume.value = -10;
  const notes = ["C5", "E5", "G5", "C6"];
  const now = Tone.now();
  notes.forEach((note, i) => {
    synth.triggerAttackRelease(note, "8n", now + i * 0.15);
  });
  setTimeout(() => synth.dispose(), 1500);
}

/** 点赞音效 — 心跳声 */
export async function playLike() {
  if (muted) return;
  await ensureStarted();
  const synth = new Tone.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 4,
    oscillator: { type: "sine" },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.2 },
  }).toDestination();
  synth.volume.value = -8;
  synth.triggerAttackRelease("C3", "16n");
  setTimeout(() => {
    synth.triggerAttackRelease("E3", "16n");
  }, 120);
  setTimeout(() => synth.dispose(), 600);
}

/** 通知音效 — 叮咚 */
export async function playNotify() {
  if (muted) return;
  await ensureStarted();
  const synth = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.3 },
  }).toDestination();
  synth.volume.value = -10;
  const now = Tone.now();
  synth.triggerAttackRelease("E5", "8n", now);
  synth.triggerAttackRelease("B5", "8n", now + 0.12);
  setTimeout(() => synth.dispose(), 800);
}

/** 背景音乐 — 轻柔钢琴循环 */
let bgLoop: Tone.Loop | null = null;
let bgSynth: Tone.PolySynth | null = null;
let bgPlaying = false;

export function isBgPlaying(): boolean {
  return bgPlaying;
}

export async function startBgMusic() {
  if (muted || bgPlaying) return;
  await ensureStarted();

  bgSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sine" },
    envelope: { attack: 0.3, decay: 0.5, sustain: 0.3, release: 1 },
  }).toDestination();
  bgSynth.volume.value = -22;

  const melody = [
    { note: "C4", dur: "2n" },
    { note: "E4", dur: "2n" },
    { note: "G4", dur: "2n" },
    { note: "A4", dur: "2n" },
    { note: "G4", dur: "2n" },
    { note: "E4", dur: "2n" },
    { note: "D4", dur: "2n" },
    { note: "C4", dur: "2n" },
  ];

  let index = 0;
  bgLoop = new Tone.Loop((time) => {
    const { note, dur } = melody[index % melody.length];
    bgSynth?.triggerAttackRelease(note, dur, time);
    index++;
  }, "2n");

  Tone.getTransport().start();
  bgLoop.start(0);
  bgPlaying = true;
}

export function stopBgMusic() {
  bgPlaying = false;
  bgLoop?.stop();
  bgLoop?.dispose();
  bgLoop = null;
  bgSynth?.dispose();
  bgSynth = null;
  Tone.getTransport().stop();
}
