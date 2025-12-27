import  { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useControls } from 'leva';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';
import {
	VRM,
	VRMExpressionPresetName,
	VRMHumanBoneName,
	VRMLoaderPlugin,
	VRMUtils,
} from '@pixiv/three-vrm';
import useLipSync from './useLipSync';
import type { GLTFParser } from 'three/examples/jsm/Addons.js';

/* ============================================================
   Helpers
============================================================ */

const toRad = THREE.MathUtils.degToRad;

function getNorm(vrm: VRM, bone: VRMHumanBoneName): THREE.Object3D | null {
	try {
		return vrm.humanoid.getNormalizedBoneNode(bone);
	} catch {
		return null;
	}
}

function safeSetExpr(vrm: VRM, key: VRMExpressionPresetName | string, value: number) {
	try {
		vrm.expressionManager?.setValue(key as any, value);
	} catch {}
}

function getHeadNode(vrm: VRM): THREE.Object3D | null {
	return getNorm(vrm, VRMHumanBoneName.Head) || getNorm(vrm, VRMHumanBoneName.Neck);
}

/* ============================================================
   Component
============================================================ */

export default function Yumi({ position = [0, -6.5, 2] }: any) {
	const group = useRef<THREE.Group>(null!);
	const breathingNodesRef = useRef<THREE.Object3D[]>([]);
	const originalNodeY = useRef<Map<string, number>>(new Map());

	const [vrm, setVrm] = useState<VRM | null>(null);

	const lipSync = useLipSync();

	/* ---------------- state refs ---------------- */

	const prevViseme = useRef<any>(null);

	const blinkState = useRef({
		next: 0,
		blinking: false,
		start: 0,
		duration: 0,
	});

	const headState = useRef({
		smPitch: 0,
		smAmp: 0,
	});

	/* ============================================================
     Leva controls
  ============================================================ */

	const controls = useControls('Yumi Model', {
		visible: true,
		scale: { value: 5, min: 0.2, max: 5 },
		rotationY: { value: 0, min: -180, max: 180 },
		posX: position[0],
		posY: position[1],
		posZ: position[2],
		blink: { value: 0, min: 0, max: 1 },
	});

	const armParams = useControls('Arms Pose', {
		autoApply: true,
		upperXDeg: { value: 0, min: -180, max: 180 },
		upperZDeg: { value: 75, min: -90, max: 90 },
		lowerXDeg: { value: 0, min: -180, max: 180 },
		handXDeg: { value: 0, min: -180, max: 180 },
	});

	const blinkAuto = useControls('Auto Blink', {
		enableAutoBlink: true,
		minInterval: 2.5,
		maxInterval: 10,
		duration: 0.12,
		intensity: 1,
	});

	const headMotion = useControls('Head Motion', {
		enableHeadMotion: true,
		pitchToTiltDeg: 0.5,
		pitchToYawDeg: 1.5,
		amplitudeBobbing: 0.15,
		smoothing: 0.85,
	});

	/* ============================================================
     VRM loader (arms-down FIXED)
  ============================================================ */

	useEffect(() => {
		let mounted = true;
		const loader = new GLTFLoader();
		loader.register((p: GLTFParser) => new VRMLoaderPlugin(p));

		loader.load(
			'/models/yumi1.vrm',
			(gltf) => {
				if (!mounted) return;

				const _vrm: VRM | null = gltf.userData?.vrm ?? null;
				if (!_vrm) return;

				VRMUtils.rotateVRM0(_vrm);
				_vrm.scene.scale.setScalar(1);

				/* ---------- INITIAL ARMS DOWN (REST POSE) ---------- */
				const humanoid = _vrm.humanoid;

				const setNorm = (bone: VRMHumanBoneName, x: number, y: number, z: number) => {
					const n = getNorm(_vrm, bone);
					if (n) n.rotation.set(x, y, z);
				};

				// Upper arms down along body
				setNorm(VRMHumanBoneName.LeftUpperArm, -Math.PI * 0.6, 0, -0.15);
				setNorm(VRMHumanBoneName.RightUpperArm, -Math.PI * 0.6, 0, 0.15);

				// Small elbow bend
				setNorm(VRMHumanBoneName.LeftLowerArm, -Math.PI * 0.15, 0, 0);
				setNorm(VRMHumanBoneName.RightLowerArm, -Math.PI * 0.15, 0, 0);

				// Neutral hands
				setNorm(VRMHumanBoneName.LeftHand, 0, 0, 0);
				setNorm(VRMHumanBoneName.RightHand, 0, 0, 0);

				// Collect breathing bones
				const candidates = [
					VRMHumanBoneName.Chest,
					VRMHumanBoneName.UpperChest,
					VRMHumanBoneName.Neck,
					VRMHumanBoneName.Hips,
				];

				const nodes: THREE.Object3D[] = [];
				for (const b of candidates) {
					const n = getNorm(_vrm, b);
					if (n) {
						nodes.push(n);
						originalNodeY.current.set(n.uuid, n.position.y);
					}
				}

				breathingNodesRef.current = nodes;

				humanoid.update();
				_vrm.update(0);

				setVrm(_vrm);
				group.current.add(_vrm.scene);

				const audioEl = document.getElementById('yumi-audio') as HTMLMediaElement | null;

				if (audioEl) lipSync.connectAudioElement(audioEl);
			},
			undefined,
			(err: any) => console.error('VRM load error', err),
		);

		return () => {
			mounted = false;
			if (vrm?.scene) VRMUtils.deepDispose(vrm.scene);
		};
	}, []);

	/* ============================================================
     Frame loop
  ============================================================ */

	useFrame(() => {
		if (!vrm || !group.current) return;

		const now = performance.now() / 1000;

		/* ---------- transforms ---------- */
		group.current.visible = controls.visible;
		group.current.position.set(controls.posX, controls.posY, controls.posZ);
		group.current.rotation.y = toRad(controls.rotationY);
		group.current.scale.setScalar(controls.scale);

		/* ---------- blink ---------- */
		let blinkValue = controls.blink;
		if (blinkAuto.enableAutoBlink) {
			const s = blinkState.current;
			if (s.next === 0)
				s.next =
					now +
					Math.random() * (blinkAuto.maxInterval - blinkAuto.minInterval) +
					blinkAuto.minInterval;

			if (!s.blinking && now >= s.next) {
				s.blinking = true;
				s.start = now;
				s.duration = blinkAuto.duration * (0.8 + Math.random() * 0.4);
			}

			if (s.blinking) {
				const p = Math.min(1, (now - s.start) / s.duration);
				blinkValue = Math.sin(p * Math.PI) * blinkAuto.intensity;
				if (p >= 1) {
					s.blinking = false;
					s.next =
						now +
						Math.random() * (blinkAuto.maxInterval - blinkAuto.minInterval) +
						blinkAuto.minInterval;
				}
			}
		}

		safeSetExpr(vrm, VRMExpressionPresetName.Blink, blinkValue);

		/* ---------- head motion (RESTORED) ---------- */
		if (headMotion.enableHeadMotion) {
			const amp = lipSync.amplitude ?? 0;
			const pitch = lipSync.pitch;

			let normPitch = 0;
			if (typeof pitch === 'number') {
				normPitch = THREE.MathUtils.clamp((pitch - 300) / 800, -1, 1);
			} else if (lipSync.viseme) {
				normPitch = lipSync.viseme.value * 2 - 1;
			}

			const s = headMotion.smoothing;
			headState.current.smPitch = headState.current.smPitch * s + normPitch * (1 - s);
			headState.current.smAmp = headState.current.smAmp * s + amp * (1 - s);

			const tilt = toRad(headState.current.smPitch * headMotion.pitchToTiltDeg);
			const yaw = toRad(headState.current.smPitch * headMotion.pitchToYawDeg * 0.6);

			const head = getHeadNode(vrm);

			if (head) {
				const targetQ = new THREE.Quaternion().setFromEuler(
					new THREE.Euler(tilt, yaw, 0, 'YXZ'),
				);
				head.quaternion.slerp(targetQ, 1 - s);
				vrm.humanoid.update();
			}

			group.current.position.y =
				controls.posY * s +
				(controls.posY + headState.current.smAmp * headMotion.amplitudeBobbing) * (1 - s);
		}

		/* ---------- arms (LIVE, FIXED) ---------- */
		if (armParams.autoApply) {
			const h = vrm.humanoid;

			const set = (b: VRMHumanBoneName, x: number, y: number, z: number) => {
				const n = getNorm(vrm, b);
				if (n) n.rotation.set(x, y, z);
			};

			set(
				VRMHumanBoneName.LeftUpperArm,
				toRad(armParams.upperXDeg),
				0,
				-toRad(armParams.upperZDeg),
			);
			set(
				VRMHumanBoneName.RightUpperArm,
				toRad(armParams.upperXDeg),
				0,
				toRad(armParams.upperZDeg),
			);
			set(VRMHumanBoneName.LeftLowerArm, toRad(armParams.lowerXDeg), 0, 0);
			set(VRMHumanBoneName.RightLowerArm, toRad(armParams.lowerXDeg), 0, 0);
			set(VRMHumanBoneName.LeftHand, toRad(armParams.handXDeg), 0, 0);
			set(VRMHumanBoneName.RightHand, toRad(armParams.handXDeg), 0, 0);

			h.update();
			vrm.update(0);
		}

		/* ---------- breathing (RESTORED) ---------- */
		const t = performance.now() / 1000;
		const inhale = (Math.sin(t * Math.PI * 2 * 0.3) + 1) / 2; // slow
		const offset = inhale * 0.01;

		const nodes = breathingNodesRef.current;
		if (nodes.length > 0) {
			for (const n of nodes) {
				const origY = originalNodeY.current.get(n.uuid) ?? n.position.y;
				n.position.y = origY + offset * 0.2;
			}
			vrm.humanoid.update();
			vrm.update(0);
		}

		/* ---------- lipsync ---------- */
		const v = lipSync.viseme;
		if (v && vrm.expressionManager) {
			if (!prevViseme.current) prevViseme.current = v;
			const smooth = prevViseme.current.value * 0.7 + v.value * 0.3;

			if (v.name === 'open')
				safeSetExpr(vrm, VRMExpressionPresetName.Oh, Math.min(0.6, smooth * 0.5));
			else if (v.name === 'smile')
				safeSetExpr(vrm, VRMExpressionPresetName.Happy, smooth * 0.8);
			else if (v.name === 'narrow') safeSetExpr(vrm, VRMExpressionPresetName.Ih, smooth);
			else if (v.name === 'closed')
				safeSetExpr(vrm, VRMExpressionPresetName.Aa, smooth * 0.2);
			else safeSetExpr(vrm, VRMExpressionPresetName.Neutral, 0);

			prevViseme.current = { ...v, value: smooth };
		}
	});

	return <group ref={group} />;
}
