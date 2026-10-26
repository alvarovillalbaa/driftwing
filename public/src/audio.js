export function createFlightAudio() {
  let context, noise, windGain, master;
  let enabled = false;
  let active = false;
  async function setEnabled(next) {
    enabled = Boolean(next);
    if (!enabled) { update(0, 0, false); return true; }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) throw new Error('Audio is unavailable.');
      if (!context) {
        context = new AudioContext();
        master = context.createGain(); master.gain.value = 0.24; master.connect(context.destination);
        windGain = context.createGain(); windGain.gain.value = 0; windGain.connect(master);
        const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 540; filter.connect(windGain);
        const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
        const data = buffer.getChannelData(0);
        let last = 0;
        for (let i = 0; i < data.length; i++) { last = (last + Math.random() * 0.08 - 0.04) / 1.02; data[i] = last * 3; }
        noise = context.createBufferSource(); noise.buffer = buffer; noise.loop = true; noise.connect(filter); noise.start();
      }
      await context.resume();
      return true;
    } catch {
      enabled = false; update(0, 0, false); return false;
    }
  }
  function update(airspeed, wind, flying) {
    active = Boolean(flying);
    if (!context || !windGain) return;
    const target = enabled && active ? Math.min(0.18, 0.035 + Math.max(0, airspeed) / 650 + Math.max(0, wind) / 400) : 0;
    windGain.gain.setTargetAtTime(target, context.currentTime, 0.15);
  }
  function chime(type) {
    if (!enabled || !active || !context || context.state !== 'running') return;
    const now = context.currentTime;
    const notes = type === 'finish' ? [523, 659, 784] : [660, 880];
    notes.forEach((frequency, i) => {
      const tone = context.createOscillator(); const gain = context.createGain();
      tone.type = 'sine'; tone.frequency.value = frequency;
      gain.gain.setValueAtTime(0, now + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.12, now + i * 0.08 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.45);
      tone.connect(gain); gain.connect(master); tone.start(now + i * 0.08); tone.stop(now + i * 0.08 + 0.5);
      tone.onended = () => { tone.disconnect(); gain.disconnect(); };
    });
  }
  function destroy() { try { noise?.stop(); void context?.close(); } catch { /* Already closed. */ } }
  return { setEnabled, update, chime, destroy };
}
