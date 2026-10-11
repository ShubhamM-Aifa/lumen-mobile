/**
 * ThreeJsBodyViewer — Interactive 3D Rotatable Anatomical & Joint Model.
 * Powered by WebGL Three.js inside WebView with full 360° OrbitControls,
 * Raycaster touch hit-detection, and DAS28 Rheumatology joint articulation mapping.
 */
import React, { useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Haptics from 'expo-haptics';
import { RotateCcw, Eye, Compass, Layers } from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

export interface Joint3DNode {
  key: string;
  label: string;
  shortLabel: string;
  category: 'upper' | 'lower' | 'axial';
  // 3D coordinates (x, y, z in Three.js space)
  x: number;
  y: number;
  z: number;
}

export const DAS28_JOINTS: Joint3DNode[] = [
  // Upper Limbs (Bilateral)
  { key: 'l_shoulder',   label: 'Left Shoulder',    shortLabel: 'L. Shoulder', category: 'upper', x: -1.3, y:  2.3, z: 0.0 },
  { key: 'r_shoulder',   label: 'Right Shoulder',   shortLabel: 'R. Shoulder', category: 'upper', x:  1.3, y:  2.3, z: 0.0 },
  { key: 'l_elbow',      label: 'Left Elbow',       shortLabel: 'L. Elbow',    category: 'upper', x: -1.8, y:  0.9, z: 0.0 },
  { key: 'r_elbow',      label: 'Right Elbow',      shortLabel: 'R. Elbow',    category: 'upper', x:  1.8, y:  0.9, z: 0.0 },
  { key: 'l_wrist',      label: 'Left Wrist',       shortLabel: 'L. Wrist',    category: 'upper', x: -2.1, y: -0.4, z: 0.0 },
  { key: 'r_wrist',      label: 'Right Wrist',      shortLabel: 'R. Wrist',    category: 'upper', x:  2.1, y: -0.4, z: 0.0 },
  { key: 'l_mcp',        label: 'Left Knuckles (MCP)', shortLabel: 'L. Knuckles', category: 'upper', x: -2.3, y: -1.0, z: 0.0 },
  { key: 'r_mcp',        label: 'Right Knuckles (MCP)', shortLabel: 'R. Knuckles', category: 'upper', x:  2.3, y: -1.0, z: 0.0 },
  { key: 'l_pip',        label: 'Left Finger PIP',  shortLabel: 'L. Fingers',  category: 'upper', x: -2.4, y: -1.4, z: 0.0 },
  { key: 'r_pip',        label: 'Right Finger PIP', shortLabel: 'R. Fingers', category: 'upper', x:  2.4, y: -1.4, z: 0.0 },

  // Axial & Spine
  { key: 'spine_cervical', label: 'Neck / Cervical Spine', shortLabel: 'C-Spine', category: 'axial', x: 0.0, y: 2.7, z: -0.2 },
  { key: 'spine_thoracic', label: 'Mid-Back / Thoracic',   shortLabel: 'T-Spine', category: 'axial', x: 0.0, y: 1.6, z: -0.3 },
  { key: 'spine_lumbar',   label: 'Lower Back / Lumbar',   shortLabel: 'L-Spine', category: 'axial', x: 0.0, y: 0.4, z: -0.2 },
  { key: 'l_si_joint',     label: 'Left SI Joint (Pelvis)',shortLabel: 'L. SI Joint', category: 'axial', x: -0.6, y: -0.2, z: -0.3 },
  { key: 'r_si_joint',     label: 'Right SI Joint (Pelvis)',shortLabel: 'R. SI Joint', category: 'axial', x: 0.6, y: -0.2, z: -0.3 },
  { key: 'tmj',            label: 'Jaw / TMJ Joint',       shortLabel: 'TMJ / Jaw',category: 'axial', x: 0.0, y: 3.2, z: 0.4 },

  // Lower Limbs (Bilateral)
  { key: 'l_hip',        label: 'Left Hip',         shortLabel: 'L. Hip',      category: 'lower', x: -0.8, y: -0.5, z: 0.0 },
  { key: 'r_hip',        label: 'Right Hip',        shortLabel: 'R. Hip',      category: 'lower', x:  0.8, y: -0.5, z: 0.0 },
  { key: 'l_knee',       label: 'Left Knee',        shortLabel: 'L. Knee',     category: 'lower', x: -0.9, y: -2.1, z: 0.1 },
  { key: 'r_knee',       label: 'Right Knee',       shortLabel: 'R. Knee',     category: 'lower', x:  0.9, y: -2.1, z: 0.1 },
  { key: 'l_ankle',      label: 'Left Ankle',       shortLabel: 'L. Ankle',    category: 'lower', x: -0.9, y: -3.8, z: 0.0 },
  { key: 'r_ankle',      label: 'Right Ankle',      shortLabel: 'R. Ankle',    category: 'lower', x:  0.9, y: -3.8, z: 0.0 },
  { key: 'l_mtp',        label: 'Left Toe / MTP',   shortLabel: 'L. Toes',     category: 'lower', x: -0.9, y: -4.2, z: 0.4 },
  { key: 'r_mtp',        label: 'Right Toe / MTP',  shortLabel: 'R. Toes',     category: 'lower', x:  0.9, y: -4.2, z: 0.4 },
];

export const FULL_BODY_3D_REGIONS = [
  { key: 'head',        label: 'Head & Face',       shortLabel: 'Head',       x:  0.0, y:  3.5, z:  0.0 },
  { key: 'neck',        label: 'Neck',              shortLabel: 'Neck',       x:  0.0, y:  2.8, z:  0.0 },
  { key: 'chest',       label: 'Anterior Chest',    shortLabel: 'Chest',      x:  0.0, y:  2.0, z:  0.5 },
  { key: 'upper_back',  label: 'Upper Back',        shortLabel: 'Upper Back', x:  0.0, y:  2.0, z: -0.5 },
  { key: 'abdomen',     label: 'Abdomen / Stomach', shortLabel: 'Abdomen',    x:  0.0, y:  0.9, z:  0.5 },
  { key: 'lower_back',  label: 'Lower Back',        shortLabel: 'Lower Back', x:  0.0, y:  0.9, z: -0.5 },
  { key: 'pelvis',      label: 'Pelvis / Groin',    shortLabel: 'Pelvis',     x:  0.0, y: -0.2, z:  0.2 },
  { key: 'l_arm',       label: 'Left Arm',          shortLabel: 'L. Arm',     x: -1.7, y:  1.0, z:  0.0 },
  { key: 'r_arm',       label: 'Right Arm',         shortLabel: 'R. Arm',     x:  1.7, y:  1.0, z:  0.0 },
  { key: 'l_thigh',     label: 'Left Thigh',        shortLabel: 'L. Thigh',   x: -0.9, y: -1.3, z:  0.1 },
  { key: 'r_thigh',     label: 'Right Thigh',       shortLabel: 'R. Thigh',   x:  0.9, y: -1.3, z:  0.1 },
  { key: 'l_calf',      label: 'Left Calf / Shin',  shortLabel: 'L. Shin',    x: -0.9, y: -3.0, z:  0.0 },
  { key: 'r_calf',      label: 'Right Calf / Shin', shortLabel: 'R. Shin',    x:  0.9, y: -3.0, z:  0.0 },
];

interface Props {
  mode?: 'joints' | 'body';
  value: string[];
  onChange: (keys: string[]) => void;
}

export function ThreeJsBodyViewer({ mode = 'joints', value = [], onChange }: Props) {
  const { palette, colorScheme } = useTheme();
  const styles = useStyles();
  const webViewRef = useRef<any>(null);
  const isDark = colorScheme === 'dark';

  const nodes = mode === 'joints' ? DAS28_JOINTS : FULL_BODY_3D_REGIONS;

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'NODE_TOGGLE') {
        Haptics.selectionAsync();
        const clickedKey = data.key;
        if (value.includes(clickedKey)) {
          onChange(value.filter(k => k !== clickedKey));
        } else {
          onChange([...value, clickedKey]);
        }
      }
    } catch {}
  };

  const setAngle = (angle: 'front' | 'back' | 'left' | 'right') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    webViewRef.current?.injectJavaScript(`
      if (window.setCameraAngle) { window.setCameraAngle('${angle}'); }
      true;
    `);
  };

  const mirrorBilateral = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newKeys = new Set(value);
    value.forEach(k => {
      if (k.startsWith('l_')) {
        newKeys.add('r_' + k.slice(2));
      } else if (k.startsWith('r_')) {
        newKeys.add('l_' + k.slice(2));
      }
    });
    onChange(Array.from(newKeys));
  };

  const clearAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange([]);
  };

  // Generate WebGL Three.js HTML
  const htmlContent = useMemo(() => {
    const bgColor = isDark ? '#1C1917' : '#FDFBF7';
    const mannequinColor = isDark ? 0x332E27 : 0xE6DFD5;
    const jointDefaultColor = isDark ? 0x5C5446 : 0xB8AEA1;
    const jointActiveColor = 0xFF6B35; // Lumen warm coral

    const nodesJson = JSON.stringify(nodes);
    const selectedJson = JSON.stringify(value);

    return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <style>
    body { margin: 0; overflow: hidden; background: ${bgColor}; touch-action: none; font-family: -apple-system, sans-serif; }
    canvas { width: 100vw; height: 100vh; display: block; }
    #hint { position: absolute; bottom: 8px; left: 0; right: 0; text-align: center; color: ${isDark ? '#888' : '#777'}; font-size: 11px; pointer-events: none; }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
</head>
<body>
  <div id="hint">Drag to rotate 360° • Tap points to select</div>
  <script>
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 10);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enableZoom = true;
    controls.minDistance = 5;
    controls.maxDistance = 15;
    controls.maxPolarAngle = Math.PI * 0.85;
    controls.minPolarAngle = Math.PI * 0.15;

    // Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight1.position.set(5, 10, 7);
    scene.add(dirLight1);
    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    dirLight2.position.set(-5, -5, -7);
    scene.add(dirLight2);

    // Human Anatomical Mannequin Body Mesh
    const bodyGroup = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: ${mannequinColor},
      roughness: 0.6,
      metalness: 0.1,
      transparent: true,
      opacity: 0.85
    });

    // Head
    const headGeo = new THREE.SphereGeometry(0.75, 24, 24);
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.position.y = 3.5;
    head.scale.set(0.9, 1.1, 0.95);
    bodyGroup.add(head);

    // Torso / Chest & Abdomen
    const torsoGeo = new THREE.CylinderGeometry(1.2, 0.9, 2.6, 20);
    const torso = new THREE.Mesh(torsoGeo, bodyMat);
    torso.position.y = 1.6;
    torso.scale.set(1.0, 1.0, 0.65);
    bodyGroup.add(torso);

    // Pelvis
    const pelvisGeo = new THREE.CylinderGeometry(0.9, 1.05, 1.0, 20);
    const pelvis = new THREE.Mesh(pelvisGeo, bodyMat);
    pelvis.position.y = 0.0;
    pelvis.scale.set(1.0, 1.0, 0.7);
    bodyGroup.add(pelvis);

    // Arms
    [-1, 1].forEach(side => {
      // Upper Arm
      const uArmGeo = new THREE.CylinderGeometry(0.28, 0.24, 1.5, 16);
      const uArm = new THREE.Mesh(uArmGeo, bodyMat);
      uArm.position.set(side * 1.55, 1.6, 0);
      bodyGroup.add(uArm);
      // Forearm
      const fArmGeo = new THREE.CylinderGeometry(0.24, 0.2, 1.4, 16);
      const fArm = new THREE.Mesh(fArmGeo, bodyMat);
      fArm.position.set(side * 1.95, 0.25, 0);
      bodyGroup.add(fArm);
      // Hand
      const handGeo = new THREE.BoxGeometry(0.25, 0.5, 0.12);
      const hand = new THREE.Mesh(handGeo, bodyMat);
      hand.position.set(side * 2.2, -0.9, 0);
      bodyGroup.add(hand);
    });

    // Legs
    [-1, 1].forEach(side => {
      // Thigh
      const thighGeo = new THREE.CylinderGeometry(0.42, 0.35, 1.8, 16);
      const thigh = new THREE.Mesh(thighGeo, bodyMat);
      thigh.position.set(side * 0.85, -1.3, 0);
      bodyGroup.add(thigh);
      // Shin
      const shinGeo = new THREE.CylinderGeometry(0.35, 0.28, 1.8, 16);
      const shin = new THREE.Mesh(shinGeo, bodyMat);
      shin.position.set(side * 0.9, -3.0, 0);
      bodyGroup.add(shin);
      // Foot
      const footGeo = new THREE.BoxGeometry(0.4, 0.25, 0.8);
      const foot = new THREE.Mesh(footGeo, bodyMat);
      foot.position.set(side * 0.9, -4.1, 0.25);
      bodyGroup.add(foot);
    });

    scene.add(bodyGroup);

    // Anatomical Node Pins
    const rawNodes = ${nodesJson};
    let selectedSet = new Set(${selectedJson});
    const nodeMeshes = [];

    const defaultPinMat = new THREE.MeshStandardMaterial({
      color: ${jointDefaultColor},
      emissive: 0x111111,
      roughness: 0.3,
      metalness: 0.2
    });

    const activePinMat = new THREE.MeshStandardMaterial({
      color: ${jointActiveColor},
      emissive: 0xFF4500,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.4
    });

    rawNodes.forEach(item => {
      const isSel = selectedSet.has(item.key);
      const pinGeo = new THREE.SphereGeometry(0.35, 18, 18);
      const mesh = new THREE.Mesh(pinGeo, isSel ? activePinMat.clone() : defaultPinMat.clone());
      mesh.position.set(item.x, item.y, item.z);
      mesh.userData = { key: item.key, label: item.label };
      scene.add(mesh);
      nodeMeshes.push(mesh);
    });

    // Window Resize
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Touch Interaction via Raycasting
    const raycaster = new THREE.Raycaster();
    const touch = new THREE.Vector2();
    let touchStartTime = 0;
    let startX = 0, startY = 0;

    window.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        touchStartTime = Date.now();
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      }
    }, { passive: true });

    window.addEventListener('touchend', e => {
      const dt = Date.now() - touchStartTime;
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const dist = Math.hypot(endX - startX, endY - startY);

      // Only register as tap if not a drag gesture (< 10px and < 350ms)
      if (dist < 10 && dt < 350) {
        touch.x = (endX / window.innerWidth) * 2 - 1;
        touch.y = -(endY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(touch, camera);
        const intersects = raycaster.intersectObjects(nodeMeshes);

        if (intersects.length > 0) {
          const hit = intersects[0].object;
          const nodeKey = hit.userData.key;
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'NODE_TOGGLE', key: nodeKey }));
          }
        }
      }
    });

    // Camera Presets
    window.setCameraAngle = function(angle) {
      const radius = 10;
      let targetX = 0, targetZ = radius;
      if (angle === 'front') { targetX = 0; targetZ = radius; }
      else if (angle === 'back') { targetX = 0; targetZ = -radius; }
      else if (angle === 'left') { targetX = -radius; targetZ = 0; }
      else if (angle === 'right') { targetX = radius; targetZ = 0; }

      const startPos = camera.position.clone();
      const endPos = new THREE.Vector3(targetX, 0, targetZ);
      let progress = 0;

      function anim() {
        progress += 0.08;
        if (progress <= 1) {
          camera.position.lerpVectors(startPos, endPos, progress);
          camera.lookAt(0, 0, 0);
          controls.update();
          requestAnimationFrame(anim);
        } else {
          camera.position.copy(endPos);
          camera.lookAt(0, 0, 0);
          controls.update();
        }
      }
      anim();
    };

    // Render loop
    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();
  </script>
</body>
</html>
    `;
  }, [mode, value, isDark]);

  return (
    <View style={styles.container}>
      {/* 3D Angle Toolbar */}
      <View style={styles.angleToolbar}>
        <View style={styles.angleGroup}>
          <TouchableOpacity style={styles.angleBtn} onPress={() => setAngle('front')}>
            <Text style={styles.angleBtnText}>Front</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.angleBtn} onPress={() => setAngle('back')}>
            <Text style={styles.angleBtnText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.angleBtn} onPress={() => setAngle('left')}>
            <Text style={styles.angleBtnText}>Left</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.angleBtn} onPress={() => setAngle('right')}>
            <Text style={styles.angleBtnText}>Right</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionGroup}>
          {value.some(k => k.startsWith('l_') || k.startsWith('r_')) && (
            <TouchableOpacity style={styles.mirrorBtn} onPress={mirrorBilateral}>
              <Text style={styles.mirrorBtnText}>Mirror Bilateral</Text>
            </TouchableOpacity>
          )}
          {value.length > 0 && (
            <TouchableOpacity style={styles.clearBtn} onPress={clearAll}>
              <Text style={styles.clearBtnText}>Clear ({value.length})</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 3D WebGL Canvas */}
      <View style={styles.canvasCard}>
        {React.createElement(WebView as any, {
          ref: webViewRef,
          originWhitelist: ['*'],
          source: { html: htmlContent },
          style: styles.webView,
          onMessage: handleMessage,
          scrollEnabled: false,
          bounces: false,
          javaScriptEnabled: true,
          domStorageEnabled: true,
          androidLayerType: 'hardware',
        })}
      </View>

      {/* Selected Joints Chips Tray */}
      {value.length > 0 && (
        <View style={styles.chipsContainer}>
          <Text style={styles.chipsTitle}>
            {mode === 'joints' ? 'Marked Arthritic / Tender Joints:' : 'Marked Pain Sites:'}
          </Text>
          <View style={styles.chipsRow}>
            {value.map((k) => {
              const node = nodes.find(n => n.key === k);
              const label = node?.label || k;
              return (
                <TouchableOpacity
                  key={k}
                  style={[styles.chip, { borderColor: palette.primary, backgroundColor: palette.primary + '18' }]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    onChange(value.filter(item => item !== k));
                  }}
                >
                  <Text style={[styles.chipText, { color: palette.primary }]}>
                    {label} ✕
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const useStyles = createThemedStyles((palette) => ({
  container: {
    marginVertical: 8,
  },
  angleToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  angleGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  angleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.border,
  },
  angleBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.text,
  },
  actionGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  mirrorBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: palette.primary + '18',
    borderWidth: 1,
    borderColor: palette.primary + '44',
  },
  mirrorBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.primary,
  },
  clearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: palette.surfaceAlt,
  },
  clearBtnText: {
    fontSize: 11,
    color: palette.primary,
    fontWeight: '600',
  },
  canvasCard: {
    height: 320,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  chipsContainer: {
    marginTop: 10,
    gap: 6,
  },
  chipsTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
}));
