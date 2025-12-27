import { VRMExpressionPresetName, VRM } from '@pixiv/three-vrm';

export function applyViseme(vrm: VRM, viseme: any, prevRef: any) {
  if (!viseme || !vrm.expressionManager) return;

  if (!prevRef.current) prevRef.current = viseme;

  const smooth =
    prevRef.current.value * 0.7 + viseme.value * 0.3;

  const set = (k: any, v: number) => {
    try {
      vrm.expressionManager!.setValue(k, v);
      return true;
    } catch {
      return false;
    }
  };

  switch (viseme.name) {
    case 'open':
      set(VRMExpressionPresetName.Oh, Math.min(0.6, smooth * 0.5)) ||
        set(VRMExpressionPresetName.Aa, smooth * 0.5);
      break;
    case 'smile':
      set(VRMExpressionPresetName.Happy, smooth * 0.8);
      break;
    case 'narrow':
      set(VRMExpressionPresetName.Ih, smooth);
      break;
    case 'closed':
      set(VRMExpressionPresetName.Aa, smooth * 0.2);
      break;
    default:
      set(VRMExpressionPresetName.Neutral, 0);
  }

  prevRef.current = { ...viseme, value: smooth };
}
