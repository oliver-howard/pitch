import { useState, useRef, useCallback, useEffect } from 'react';
import { PitchDetector } from 'pitchy';

const STRINGS = [
  { note: 'E', octave: 2, freq: 82.41,  string: 6 },
  { note: 'A', octave: 2, freq: 110.00, string: 5 },
  { note: 'D', octave: 3, freq: 146.83, string: 4 },
  { note: 'G', octave: 3, freq: 196.00, string: 3 },
  { note: 'B', octave: 3, freq: 246.94, string: 2 },
  { note: 'E', octave: 4, freq: 329.63, string: 1 },
];

function closestString(freq) {
  let best = null;
  let bestDiff = Infinity;
  for (const s of STRINGS) {
    const cents = 1200 * Math.log2(freq / s.freq);
    if (Math.abs(cents) < bestDiff) {
      bestDiff = Math.abs(cents);
      best = { ...s, cents };
    }
  }
  return best;
}

export function usePitchDetector() {
  const [result, setResult] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState(null);
  const refs = useRef({});
  const analyserRef = useRef(null);

  const stop = useCallback(() => {
    const { raf, stream, ctx } = refs.current;
    if (raf) cancelAnimationFrame(raf);
    if (stream) stream.getTracks().forEach(t => t.stop());
    if (ctx) ctx.close();
    refs.current = {};
    analyserRef.current = null;
    setIsListening(false);
    setResult(null);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      ctx.createMediaStreamSource(stream).connect(analyser);

      const detector = PitchDetector.forFloat32Array(analyser.fftSize);
      const buf = new Float32Array(detector.inputLength);
      analyserRef.current = analyser;
      refs.current = { stream, ctx, analyser, smoothedCents: null, lastString: null, lastValidAt: 0, consecutiveFrames: 0 };

      const ALPHA = 0.25;        // EMA weight on incoming reading (lower = smoother)
      const CLARITY_MIN = 0.95;  // raised from 0.9
      const HOLD_MS = 150;       // keep last reading visible for this long after signal drops
      const RMS_MIN = 0.01;      // ~-40 dBFS silence gate — ignores ambient noise
      const ONSET_FRAMES = 3;    // consecutive valid frames required before showing a result

      function tick() {
        analyser.getFloatTimeDomainData(buf);

        // Silence gate: skip pitch detection entirely when signal is too quiet
        let sumSq = 0;
        for (let i = 0; i < buf.length; i++) sumSq += buf[i] * buf[i];
        const rms = Math.sqrt(sumSq / buf.length);

        const now = performance.now();
        let gotValidReading = false;

        if (rms >= RMS_MIN) {
          const [freq, clarity] = detector.findPitch(buf, ctx.sampleRate);

          if (clarity > CLARITY_MIN && freq >= 70 && freq <= 380) {
            const raw = closestString(freq);

            if (refs.current.lastString !== raw.string) {
              // String changed — reset EMA and onset counter
              refs.current.consecutiveFrames = 1;
              refs.current.smoothedCents = raw.cents;
              refs.current.lastString = raw.string;
            } else {
              refs.current.consecutiveFrames++;
              refs.current.smoothedCents = ALPHA * raw.cents + (1 - ALPHA) * refs.current.smoothedCents;
            }

            if (refs.current.consecutiveFrames >= ONSET_FRAMES) {
              refs.current.lastValidAt = now;
              setResult({ ...raw, cents: refs.current.smoothedCents });
              gotValidReading = true;
            }
          } else {
            // Lost pitch clarity — reset onset counter so it must re-earn display
            refs.current.consecutiveFrames = 0;
            refs.current.lastString = null;
            refs.current.smoothedCents = null;
          }
        } else {
          // Gone silent — reset onset counter
          refs.current.consecutiveFrames = 0;
          refs.current.lastString = null;
          refs.current.smoothedCents = null;
        }

        if (!gotValidReading) {
          if (now - refs.current.lastValidAt >= HOLD_MS) {
            setResult(null);
          }
          // else: hold — don't call setResult, keep last displayed value
        }

        refs.current.raf = requestAnimationFrame(tick);
      }

      refs.current.raf = requestAnimationFrame(tick);
      setIsListening(true);
    } catch (err) {
      const msg =
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Microphone access denied.'
          : 'Could not access microphone.';
      setError(msg);
    }
  }, []);

  useEffect(() => stop, [stop]);

  return { result, isListening, error, start, stop, analyserRef };
}
