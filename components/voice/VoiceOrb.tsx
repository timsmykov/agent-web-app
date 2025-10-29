'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export type VoiceOrbMode = 'idle' | 'listening' | 'thinking' | 'speaking';

const vertexShader = /* glsl */ `
  varying vec3 vNormalWorld;
  varying vec3 vPosition;
  uniform float uAmplitude;

  void main() {
    float scale = 1.0 + uAmplitude * 0.08;
    vec3 scaled = position * scale;
    vNormalWorld = normalize(normalMatrix * normal);
    vPosition = scaled;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(scaled, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec3 vNormalWorld;
  varying vec3 vPosition;
  uniform float uAmplitude;
  uniform float uCentroid;
  uniform float uTime;
  uniform float uModeMix;

  void main() {
    vec3 normal = normalize(vNormalWorld);
    float vertical = clamp(vPosition.y * 0.5 + 0.5, 0.0, 1.0);
    float swirl = sin(uTime * (0.9 + uAmplitude * 1.3) + vPosition.x * 3.8 + vPosition.y * 4.2 + vPosition.z * 2.4);
    float wave = cos(uTime * 0.45 + vPosition.y * 5.5);
    float blend = clamp(0.5 + swirl * 0.25 + uAmplitude * 0.35, 0.0, 1.0);
    float crest = clamp(vertical + wave * 0.2, 0.0, 1.0);

    vec3 sky = vec3(0.94, 0.98, 1.0);
    vec3 oceanLow = mix(vec3(0.04, 0.32, 0.9), vec3(0.09, 0.42, 0.95), clamp(uCentroid + 0.15, 0.0, 1.0));
    vec3 oceanHigh = mix(vec3(0.18, 0.6, 1.0), vec3(0.4, 0.75, 1.0), clamp(uModeMix, 0.0, 1.0));

    vec3 base = mix(oceanLow, oceanHigh, blend);
    vec3 sheen = mix(base, sky, smoothstep(0.25, 0.9, crest + uAmplitude * 0.25));

    float rim = pow(1.0 - dot(normal, vec3(0.0, 0.0, 1.0)), 2.2);
    vec3 rimColor = vec3(0.6, 0.8, 1.2) * rim * (0.2 + uAmplitude * 0.4);

    vec3 color = sheen + rimColor;
    float alpha = 0.85 + uAmplitude * 0.08;
    gl_FragColor = vec4(color, alpha);
  }
`;

export interface VoiceOrbProps {
  mode: VoiceOrbMode;
  amplitude: number;
  centroid: number;
}

export function VoiceOrb({ mode, amplitude, centroid }: VoiceOrbProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fallbackRef = useRef<HTMLCanvasElement | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const frameRef = useRef<number>();
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 3.1);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setClearColor(0x000000, 0);

    if (!renderer.capabilities.isWebGL2 && !renderer.getContext()) {
      setFallback(true);
      return () => undefined;
    }

    containerRef.current.appendChild(renderer.domElement);

    const geometry = new THREE.IcosahedronGeometry(1, 6);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uAmplitude: { value: 0 },
        uCentroid: { value: 0 },
        uModeMix: { value: 0 }
      },
      transparent: true,
      vertexShader,
      fragmentShader
    });

    materialRef.current = material;

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const resize = () => {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      renderer.setSize(clientWidth, clientHeight);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
    };

    resize();

    window.addEventListener('resize', resize);

    const animate = (time: number) => {
      if (!materialRef.current) return;
      materialRef.current.uniforms.uTime.value = time * 0.0015;
      renderer.render(scene, camera);
      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resize);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    if (fallback) {
      const canvas = fallbackRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const draw = () => {
        if (!ctx || !canvas) return;
        const { width, height } = canvas;
        ctx.clearRect(0, 0, width, height);
        const radius = Math.min(width, height) / 2 - 4;
        const t = Date.now() * 0.002;
        const offset = Math.sin(t) * amplitude * radius * 1.4;
        const gradient = ctx.createLinearGradient(0, -radius + offset, 0, radius - offset);
        gradient.addColorStop(0, '#f1f7ff');
        gradient.addColorStop(1, '#1f7bff');

        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        const ripple = radius + Math.sin(t * 1.1) * amplitude * 24;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, ripple, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        requestAnimationFrame(draw);
      };
      draw();
      return () => undefined;
    }
    return () => undefined;
  }, [fallback, amplitude]);

  useEffect(() => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uAmplitude.value = THREE.MathUtils.clamp(amplitude * 1.2, 0, 1.2);
    materialRef.current.uniforms.uCentroid.value = THREE.MathUtils.clamp(centroid, 0, 1);
    let modeMix = 0.18;
    if (mode === 'listening') modeMix = 0.45;
    if (mode === 'thinking') modeMix = 0.3;
    if (mode === 'speaking') modeMix = 0.65;
    materialRef.current.uniforms.uModeMix.value = modeMix;
  }, [amplitude, centroid, mode]);

  if (fallback) {
    return <canvas ref={fallbackRef} className="h-full w-full" />;
  }

  return <div ref={containerRef} className="h-full w-full" />;
}
