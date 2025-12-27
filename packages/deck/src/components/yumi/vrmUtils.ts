import * as THREE from 'three';
import { VRMExpressionPresetName, VRMHumanBoneName, VRM } from '@pixiv/three-vrm';

export function getHeadNode(vrm: VRM): THREE.Object3D | null {
  return (
    vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.Head) ||
    vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.Neck) ||
    null
  );
}

export function setExpression(
  vrm: VRM,
  key: VRMExpressionPresetName | string,
  value: number
) {
  try {
    vrm.expressionManager?.setValue(key as any, value);
  } catch {}
}
