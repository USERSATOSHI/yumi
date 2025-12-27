import { useRef } from 'react';

export function useBlink(auto: any) {
  const state = useRef({
    next: 0,
    blinking: false,
    start: 0,
    duration: 0,
  });

  return (now: number, manualValue: number) => {
    if (!auto.enableAutoBlink) return manualValue;

    const s = state.current;

    if (s.next === 0) {
      s.next =
        now +
        Math.random() * (auto.maxInterval - auto.minInterval) +
        auto.minInterval;
    }

    if (!s.blinking && now >= s.next) {
      s.blinking = true;
      s.start = now;
      s.duration = auto.duration * (0.8 + Math.random() * 0.4);
    }

    if (s.blinking) {
      const p = Math.min(1, (now - s.start) / s.duration);
      const v = Math.sin(p * Math.PI) * auto.intensity;

      if (p >= 1) {
        s.blinking = false;
        s.next =
          now +
          Math.random() * (auto.maxInterval - auto.minInterval) +
          auto.minInterval;
      }

      return v;
    }

    return manualValue;
  };
}
