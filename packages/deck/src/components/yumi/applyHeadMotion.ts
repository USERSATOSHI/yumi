import * as THREE from 'three';
import { VRM } from '@pixiv/three-vrm';
import { getHeadNode } from './vrmUtils';

export function applyHeadMotion(
  vrm: VRM,
  group: THREE.Group,
  lipSync: any,
  state: any,
  params: any,
  baseY: number
) {
  const amp = lipSync.amplitude ?? 0;
  const pitch = lipSync.pitch;

  let normPitch =
    typeof pitch === 'number'
      ? THREE.MathUtils.clamp((pitch - 300) / 800, -1, 1)
      : (lipSync.viseme?.value ?? 0) * 2 - 1;

  const s = params.smoothing;
  state.smPitch = state.smPitch * s + normPitch * (1 - s);
  state.smAmp = state.smAmp * s + amp * (1 - s);

  const tilt = THREE.MathUtils.degToRad(
    state.smPitch * params.pitchToTiltDeg
  );
  const yaw = THREE.MathUtils.degToRad(
    state.smPitch * params.pitchToYawDeg * 0.6
  );

  const head = getHeadNode(vrm);

  if (head) {
    const targetQ = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(tilt, yaw, 0, 'YXZ')
    );
    head.quaternion.slerp(targetQ, 1 - s);
    vrm.humanoid.update();
  } else {
    group.rotation.x = group.rotation.x * s + tilt * (1 - s);
    group.rotation.y = group.rotation.y * s + yaw * (1 - s);
  }

  group.position.y =
    baseY * s +
    (baseY + state.smAmp * params.amplitudeBobbing) * (1 - s);
}
