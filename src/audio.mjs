const BPM = 116;
const BEAT = 60 / BPM;
const LOOP_LENGTH = 32 * BEAT;
const melody = [
  [76, 72, 69, 71, 72, 76, 74, 71],
  [69, 72, 76, 79, 76, 74, 72, 0],
  [77, 76, 72, 69, 72, 74, 76, 72],
  [71, 74, 76, 80, 76, 74, 71, 0],
  [81, 76, 79, 76, 72, 74, 76, 0],
  [77, 74, 72, 69, 72, 76, 74, 72],
  [74, 77, 81, 79, 77, 76, 74, 71],
  [76, 74, 71, 68, 69, 72, 71, 69],
];
const chords = [
  [45, 48, 52],
  [48, 52, 55],
  [41, 45, 48],
  [40, 44, 47],
  [45, 48, 52],
  [41, 45, 48],
  [38, 41, 45],
  [40, 44, 47],
];
const frequency = (note) => 440 * 2 ** ((note - 69) / 12);

function note(context, output, midi, start, duration, volume, type = 'triangle', pan = 0) {
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  const position = context.createStereoPanner();
  oscillator.type = type;
  oscillator.frequency.value = frequency(midi);
  position.pan.value = pan;
  envelope.gain.setValueAtTime(0, start);
  envelope.gain.linearRampToValueAtTime(volume, start + 0.009);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(envelope).connect(position).connect(output);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.008);
}

export async function renderSoundtrack() {
  const OfflineContext = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  if (!OfflineContext) return null;
  const context = new OfflineContext(2, Math.ceil(LOOP_LENGTH * 44100), 44100);
  const mix = context.createGain();
  mix.gain.value = 0.65;
  mix.connect(context.destination);
  const noise = context.createBuffer(1, 2205, 44100);
  const noiseData = noise.getChannelData(0);
  let seed = 2048;
  for (let i = 0; i < noiseData.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    noiseData[i] = seed / 2147483648 - 1;
  }
  for (let bar = 0; bar < 8; bar++) {
    const chord = chords[bar];
    for (let step = 0; step < 8; step++) {
      const time = (bar * 4 + step / 2) * BEAT;
      const pitch = melody[bar][step];
      if (pitch) {
        note(context, mix, pitch, time, BEAT * 0.43, 0.21);
        note(context, mix, pitch + 12, time, BEAT * 0.28, 0.035, 'sine', 0.14);
      }
      note(context, mix, chord[[0, 1, 2, 1, 0, 2, 1, 2][step]] + 24, time, BEAT * 0.31, 0.055, 'sine', step % 2 ? 0.35 : -0.35);
      if (step % 2 === 0) note(context, mix, chord[step === 4 ? 2 : 0] - 12, time, BEAT * 0.7, 0.23);
      if (step % 4 === 0) {
        const kick = context.createOscillator();
        const envelope = context.createGain();
        kick.frequency.setValueAtTime(105, time);
        kick.frequency.exponentialRampToValueAtTime(42, time + 0.1);
        envelope.gain.setValueAtTime(0, time);
        envelope.gain.linearRampToValueAtTime(0.13, time + 0.003);
        envelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.15);
        kick.connect(envelope).connect(mix);
        kick.start(time);
        kick.stop(time + 0.16);
      }
      const hat = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const envelope = context.createGain();
      hat.buffer = noise;
      filter.type = 'highpass';
      filter.frequency.value = 6500;
      envelope.gain.setValueAtTime(step % 2 ? 0.045 : 0.025, time);
      envelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);
      hat.connect(filter).connect(envelope).connect(mix);
      hat.start(time);
      hat.stop(time + 0.04);
    }
  }
  return context.startRendering();
}

export class MergefallAudio {
  constructor() {
    this.enabled = false;
    this.playing = false;
    this.chill = true;
    this.context = null;
    this.master = null;
    this.music = null;
    this.source = null;
    this.musicGain = null;
    this.offset = 0;
    this.startedAt = 0;
    this.rate = 1;
    this.pending = false;
  }

  unlock() {
    try {
      if (!this.context) {
        const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AudioContext) return null;
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.enabled ? 1 : 0;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
      return this.context;
    } catch {
      return null;
    }
  }

  sync({ enabled, playing, chill }) {
    this.enabled = enabled;
    this.playing = playing;
    this.chill = chill;
    if (this.context) this.master.gain.setTargetAtTime(enabled ? 1 : 0, this.context.currentTime, 0.008);
    if (!enabled || !playing) {
      this.stopMusic();
      return;
    }
    if (!this.unlock()) return;
    const rate = chill ? 1 : 1.16;
    if (this.source && this.rate !== rate) {
      const now = this.context.currentTime;
      this.offset = (this.offset + (now - this.startedAt) * this.rate) % this.source.buffer.duration;
      this.startedAt = now;
      this.rate = rate;
      this.source.playbackRate.setValueAtTime(rate, now);
    }
    void this.startMusic();
  }

  async startMusic() {
    if (this.source || this.pending) return;
    this.pending = true;
    try {
      this.music ??= renderSoundtrack();
      const buffer = await this.music;
      if (!buffer || !this.enabled || !this.playing) return;
      const context = this.context;
      const source = context.createBufferSource();
      const gain = context.createGain();
      this.rate = this.chill ? 1 : 1.16;
      source.buffer = buffer;
      source.loop = true;
      source.playbackRate.value = this.rate;
      gain.gain.setValueAtTime(0, context.currentTime);
      gain.gain.linearRampToValueAtTime(0.48, context.currentTime + 0.08);
      source.connect(gain).connect(this.master);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
      };
      this.source = source;
      this.musicGain = gain;
      this.startedAt = context.currentTime;
      source.start(this.startedAt, this.offset % buffer.duration);
    } catch {
      this.music = null;
    } finally {
      this.pending = false;
    }
  }

  stopMusic() {
    if (!this.source) return;
    const now = this.context.currentTime;
    this.offset = (this.offset + (now - this.startedAt) * this.rate) % this.source.buffer.duration;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
    this.musicGain.gain.linearRampToValueAtTime(0, now + 0.025);
    this.source.stop(now + 0.03);
    this.source = null;
    this.musicGain = null;
  }

  reset() {
    this.stopMusic();
    this.offset = 0;
  }

  tone(frequency = 330, duration = 0.08) {
    if (!this.enabled) return;
    const context = this.unlock();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(0.075, context.currentTime + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  }
}
