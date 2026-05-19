import { useRef, useEffect } from 'react';
import { usePitchDetector } from './hooks/usePitchDetector';
import './App.css';

const GUITAR_STRINGS = [
  { note: 'E', string: 6 },
  { note: 'A', string: 5 },
  { note: 'D', string: 4 },
  { note: 'G', string: 3 },
  { note: 'B', string: 2 },
  { note: 'E', string: 1 },
];

const RADIUS = 88;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function App() {
  const { result, isListening, error, start, stop, analyserRef } = usePitchDetector();
  const canvasRef = useRef(null);
  const inTuneRef = useRef(false);

  const inTune = result && Math.abs(result.cents) <= 5;
  inTuneRef.current = !!inTune;

  const cents = result ? Math.max(-50, Math.min(50, result.cents)) : 0;
  const needlePos = (cents + 50) / 100;
  // Reaches 1.0 at the in-tune threshold (±2.5 cents), fades to 0 at ±50 cents
  const accuracy = result ? Math.min(1, Math.max(0, 1 - (Math.abs(cents) - 2.5) / 47.5)) : 0;
  const dashOffset = CIRCUMFERENCE * (1 - accuracy);

  // Waveform draw loop
  useEffect(() => {
    if (!isListening || !analyserRef.current || !canvasRef.current) return;

    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const SIZE = 192;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);

    const buf = new Uint8Array(analyser.fftSize);
    let raf;

    function draw() {
      analyser.getByteTimeDomainData(buf);
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.beginPath();

      const sliceW = SIZE / buf.length;
      for (let i = 0; i < buf.length; i++) {
        const y = SIZE / 2 + (buf[i] / 128 - 1) * SIZE * 0.28;
        if (i === 0) ctx.moveTo(0, y);
        else ctx.lineTo(i * sliceW, y);
      }

      ctx.strokeStyle = inTuneRef.current
        ? 'rgba(52, 199, 89, 0.25)'
        : 'rgba(28, 28, 30, 0.1)';
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.stroke();

      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [isListening, analyserRef]);

  return (
    <div className="app">
      <p className="app-name">PITCH</p>

      <div className={`note-circle ${result ? (inTune ? 'in-tune' : 'active') : ''}`}>
        <canvas ref={canvasRef} className="waveform-canvas" />

        <svg className="ring-svg" viewBox="0 0 192 192" aria-hidden="true">
          <circle className="ring-track" cx="96" cy="96" r={RADIUS} />
          <circle
            className={`ring-progress ${inTune ? 'in-tune' : result ? 'active' : ''}`}
            cx="96" cy="96" r={RADIUS}
            transform="rotate(-90 96 96)"
            style={{ strokeDasharray: CIRCUMFERENCE, strokeDashoffset: dashOffset }}
          />
        </svg>

        <span className="note-letter">{result ? result.note : '–'}</span>
        {result && <span className="note-octave">{result.octave}</span>}
      </div>

      <div className="meter-wrapper">
        <div className="meter-bar">
          <div className="meter-center-tick" />
          <div
            className={`meter-dot ${inTune ? 'in-tune' : result ? 'active' : ''}`}
            style={{ left: `${needlePos * 100}%` }}
          />
        </div>
        <div className="meter-labels">
          <span>♭</span>
          <span>♯</span>
        </div>
      </div>

      {error && <p className="error-msg">{error}</p>}

      <button
        className={`btn ${isListening ? 'btn-stop' : 'btn-start'}`}
        onClick={isListening ? stop : start}
      >
        {isListening ? 'Stop' : 'Tune'}
      </button>

      <div className="strings-row">
        {GUITAR_STRINGS.map((s) => (
          <div
            key={s.string}
            className={`string-pill ${result?.string === s.string ? (inTune ? 'in-tune' : 'active') : ''
              }`}
          >
            {s.note}
          </div>
        ))}
      </div>
    </div>
  );
}
