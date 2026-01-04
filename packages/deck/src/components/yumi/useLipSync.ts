import { useCallback, useEffect, useRef, useState } from 'react';

type VisemeName = 'rest' | 'open' | 'smile' | 'closed' | 'narrow';

export type Viseme = {
  name: VisemeName;
  value: number;
};
/* ----------------------------- helpers ----------------------------- */

function mapTextToViseme(text: string): Viseme {
  if (!text) return { name: 'rest', value: 0 };

  const t = text.toLowerCase();

  if (/[aiou]/.test(t)) return { name: 'open', value: 1 };
  if (/[e]/.test(t)) return { name: 'smile', value: 0.6 };
  if (/[bmpftv]/.test(t)) return { name: 'closed', value: 0.05 };
  if (/[sz]/.test(t)) return { name: 'narrow', value: 0.3 };

  return { name: 'rest', value: 0.05 };
}

function estimatePitch(buffer: Float32Array, sampleRate: number): number | null {
  let rms = 0;
  for (let i = 0; i < buffer.length; i++) rms += buffer[i] ** 2;
  rms = Math.sqrt(rms / buffer.length);

  if (rms < 0.01) return null;

  let bestOffset = -1;
  let bestCorrelation = 0;

  for (let offset = 20; offset < 1000; offset++) {
    let corr = 0;
    for (let i = 0; i < buffer.length - offset; i++) {
      corr += buffer[i] * buffer[i + offset];
    }
    if (corr > bestCorrelation) {
      bestCorrelation = corr;
      bestOffset = offset;
    }
  }

  return bestOffset > 0 ? sampleRate / bestOffset : null;
}

// Minimal SpeechRecognition type declaration
type SpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognition() {
  return (
    // @ts-ignore
    window.SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    null
  );
}

/* ----------------------------- hook ----------------------------- */

export function useLipSync() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const recogRef = useRef<SpeechRecognition | null>(null);

  const [viseme, setViseme] = useState<Viseme>({ name: 'rest', value: 0 });
  const [amplitude, setAmplitude] = useState(0);
  const [pitch, setPitch] = useState<number | null>(null);

  /* -------------------- speech recognition -------------------- */

  const startSpeechRecognition = useCallback(
    (audioEl?: HTMLMediaElement) => {
      const SpeechRecognition = getSpeechRecognition();
      if (!SpeechRecognition) return false;

      const recog = new SpeechRecognition();
      recog.continuous = true;
      recog.interimResults = true;
      recog.lang = 'en-US';

      recog.onresult = (ev: any) => {
        const last = ev.results[ev.results.length - 1];
        const transcript = last?.[0]?.transcript?.trim();
        if (transcript) setViseme(mapTextToViseme(transcript));
      };

      recog.onend = () => {
        if (audioEl && !audioEl.paused) {
          try {
            recog.start();
          } catch {}
        }
      };

      try {
        recog.start();
        recogRef.current = recog;
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  const stopSpeechRecognition = useCallback(() => {
    recogRef.current?.stop();
    recogRef.current = null;
  }, []);

  /* ------------------------ audio analysis ------------------------ */

  const connectAudioElement = useCallback(
    (audioEl: HTMLMediaElement) => {
      if (!audioEl) return;

      // If already connected to this element, just ensure context is running
      if (sourceRef.current && audioCtxRef.current) {
        if (audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume();
        }
        return;
      }

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }

      const audioCtx = audioCtxRef.current;

      // Resume audio context if suspended (browser autoplay policy)
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      sourceRef.current?.disconnect();
      analyserRef.current?.disconnect();

      const source = audioCtx.createMediaElementSource(audioEl);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;

      source.connect(analyser);
      analyser.connect(audioCtx.destination);

      sourceRef.current = source;
      analyserRef.current = analyser;

      const buffer = new Float32Array(analyser.fftSize);

      const tick = () => {
        // Check if audio is paused or ended - reset to rest face
        if (audioEl.paused || audioEl.ended) {
          setViseme({ name: 'rest', value: 0 });
          setAmplitude(0);
          setPitch(null);
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        analyser.getFloatTimeDomainData(buffer);

        let sum = 0;
        for (let i = 0; i < buffer.length; i++) sum += buffer[i] ** 2;

        const rms = Math.sqrt(sum / buffer.length);
        setAmplitude(rms);

        const openness = Math.min(1, rms * 30);
        setViseme(
          openness > 0.02
            ? { name: 'open', value: openness }
            : { name: 'rest', value: 0 }
        );

        setPitch(estimatePitch(buffer, audioCtx.sampleRate));
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
      startSpeechRecognition(audioEl);
    },
    [startSpeechRecognition]
  );

  /* -------------------------- cleanup -------------------------- */

  const disconnect = useCallback(() => {
    stopSpeechRecognition();

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    sourceRef.current?.disconnect();
    analyserRef.current?.disconnect();

    sourceRef.current = null;
    analyserRef.current = null;

    audioCtxRef.current?.close();
    audioCtxRef.current = null;

    setViseme({ name: 'rest', value: 0 });
    setAmplitude(0);
    setPitch(null);
  }, [stopSpeechRecognition]);

  const resumeAudioContext = useCallback(() => {
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  }, []);

  useEffect(() => disconnect, [disconnect]);

  return {
    viseme,
    amplitude,
    pitch,
    connectAudioElement,
    disconnect,
    startSpeechRecognition,
    stopSpeechRecognition,
    resumeAudioContext,
  };
}

export default useLipSync;
