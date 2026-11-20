// Engine sound: an ignition bark when you step up to a car, a low idle while you
// look, and a real throttle recording while you hold the rev control.
// `rpm` (0..1) drives the tach, the camera shudder and the tail lights.

const KEY = 'kestrel-sound';
const read = () => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } };
const save = on => { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* private mode */ } };

export function createEngine() {
  let ctx = null, master = null, idleGain = null, revGain = null, idleSrc = null, revSrc = null, loading = null;
  const bufs = {};
  const st = { rpm: 0, running: false, holding: false, kick: 0, on: read(), t: 0 };

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return Promise.resolve(false);
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = st.on ? 1 : 0;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -12; comp.knee.value = 12; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.2;
      master.connect(comp).connect(ctx.destination);
      idleGain = ctx.createGain(); idleGain.gain.value = 0; idleGain.connect(master);
      revGain = ctx.createGain(); revGain.gain.value = 0; revGain.connect(master);
    }
    if (ctx.state === 'suspended') ctx.resume();
    if (!loading) {
      loading = Promise.all([['start', 'mp3'], ['rev', 'mp3'], ['idle', 'wav']].map(([k, ext]) =>
        fetch(`assets/sfx/${k}.${ext}`).then(r => r.arrayBuffer()).then(a => ctx.decodeAudioData(a)).then(b => { bufs[k] = b; })
      )).then(() => true).catch(() => false);
    }
    return loading;
  }

  const ramp = (p, v, dur) => { const t = ctx.currentTime; p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(v, t + dur); };

  function startIdle() {
    if (!ctx || !bufs.idle || idleSrc) return;
    idleSrc = ctx.createBufferSource(); idleSrc.buffer = bufs.idle; idleSrc.loop = true; idleSrc.connect(idleGain); idleSrc.start();
    ramp(idleGain.gain, 0.3, 0.9);
  }

  return {
    get rpm() { return st.rpm; },
    get running() { return st.running; },
    get holding() { return st.holding; },
    get on() { return st.on; },
    /** Unlock audio on the first gesture and start fetching the sounds. */
    prime() { ensure(); },
    /** The car wakes: a bark, a flare of revs, then it settles to idle. */
    async ignite() {
      if (st.running) return;
      st.running = true; st.kick = 1;
      const ok = await ensure();
      if (!ok || !st.running || !bufs.start) return;
      const s = ctx.createBufferSource(), g = ctx.createGain();
      s.buffer = bufs.start; g.gain.value = 0.95; s.connect(g).connect(master); s.start();
      setTimeout(() => { if (st.running) startIdle(); }, 1500);
    },
    /** Engine off: let the idle die away. */
    stop() {
      st.running = false; st.holding = false;
      if (!ctx) return;
      ramp(idleGain.gain, 0, 0.9); ramp(revGain.gain, 0, 0.4);
      const a = idleSrc, b = revSrc; idleSrc = revSrc = null;
      setTimeout(() => { try { a && a.stop(); b && b.stop(); } catch { /* already stopped */ } }, 1000);
    },
    async revDown() {
      if (st.holding) return;
      st.holding = true;
      if (!st.running) { st.running = true; }
      const ok = await ensure();
      if (!ok || !st.holding || !bufs.rev) return;
      if (revSrc) { try { revSrc.stop(); } catch { /* fine */ } }
      revSrc = ctx.createBufferSource(); revSrc.buffer = bufs.rev; revSrc.connect(revGain); revSrc.start();
      revGain.gain.cancelScheduledValues(ctx.currentTime); revGain.gain.setValueAtTime(1, ctx.currentTime);
      ramp(idleGain.gain, 0.06, 0.15);
      startIdle();
    },
    revUp() {
      if (!st.holding) return;
      st.holding = false;
      if (!ctx) return;
      ramp(revGain.gain, 0, 0.45);
      const s = revSrc; revSrc = null;
      setTimeout(() => { try { s && s.stop(); } catch { /* fine */ } }, 500);
      ramp(idleGain.gain, 0.3, 0.6);
    },
    setOn(on) {
      st.on = on; save(on);
      if (on) ensure();
      if (master) ramp(master.gain, on ? 1 : 0, 0.25);
    },
    /** Call once a frame. */
    update(dt) {
      st.t += dt;
      let target = 0;
      if (st.holding) target = 0.82 + 0.13 * Math.sin(st.t * 5.3) * Math.sin(st.t * 2.1);
      else if (st.running) target = 0.1;
      if (st.kick > 0) { target = Math.max(target, 0.1 + 0.5 * st.kick); st.kick = Math.max(0, st.kick - dt * 0.75); }
      const k = target > st.rpm ? 5.5 : 2.2;
      st.rpm += (target - st.rpm) * (1 - Math.exp(-dt * k));
    },
  };
}
