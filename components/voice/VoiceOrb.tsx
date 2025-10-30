'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export type VoiceOrbMode = 'idle' | 'listening' | 'thinking' | 'speaking';

const vertexShader = /* glsl */ `
  varying vec3 vNormalWorld;
  varying vec3 vPosition;
  uniform float uAmplitude;
  uniform float uTime;
  uniform float uPulse;

  float triNoise(vec3 p) {
    return sin(p.x * 3.3 + uTime * 1.3) * sin(p.y * 3.7 + uTime * 1.1) * sin(p.z * 3.1 + uTime * 1.5);
  }

  void main() {
    float flow = triNoise(position * 1.6);
    float displacement = flow * 0.08 * (0.3 + uAmplitude * 1.4);
    float ripple = sin(uTime * 1.2 + length(position.xy) * 5.0) * 0.03;
    float swell = 1.0 + uPulse * 0.08;
    vec3 displaced = position * swell + normal * (displacement + ripple);
    vNormalWorld = normalize(normalMatrix * normal);
    vPosition = displaced;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
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
  uniform float uPulse;

  void main() {
    vec3 normal = normalize(vNormalWorld);
    float fresnel = pow(1.0 - dot(normal, vec3(0.0, 0.0, 1.0)), 3.0);
    float axial = sin(uTime * 0.5 + vPosition.y * 4.0 + uModeMix * 2.4);
    float swirl = sin(uTime * 0.8 + vPosition.x * 6.0) * cos(vPosition.z * 2.5);
    float band = clamp((swirl + axial) * 0.25 + 0.5 + uCentroid * 0.1, 0.0, 1.0);

    vec3 baseLow = vec3(0.09, 0.2, 0.58);
    vec3 baseMid = vec3(0.2, 0.42, 0.96);
    vec3 baseHigh = vec3(0.65, 0.35 + uModeMix * 0.25, 1.0);

    vec3 gradient = mix(baseLow, baseMid, band);
    gradient = mix(gradient, baseHigh, smoothstep(0.4, 1.0, band + uAmplitude * 0.2));

    float pulseHalo = smoothstep(0.4, 0.95, length(vPosition.xy)) * (0.25 + uPulse * 0.35);
    vec3 haloColor = vec3(0.6, 0.85, 1.2) * pulseHalo;
    vec3 rim = vec3(0.92, 0.98, 1.25) * fresnel * (0.3 + uAmplitude * 0.6);

    vec3 color = gradient + haloColor + rim;
    float alpha = 0.75 + uAmplitude * 0.15;
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
        uModeMix: { value: 0 },
        uPulse: { value: 0 }
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
      materialRef.current.uniforms.uTime.value = time * 0.0012;
      materialRef.current.uniforms.uPulse.value = 0.5 + 0.5 * Math.sin(time * 0.001);
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
        const pulse = 0.55 + 0.45 * Math.sin(t * 0.8);
        const gradient = ctx.createRadialGradient(0, 0, radius * 0.15, 0, 0, radius);
        gradient.addColorStop(0, 'rgba(160, 210, 255, 0.85)');
        gradient.addColorStop(0.45, 'rgba(74, 132, 255, 0.65)');
        gradient.addColorStop(1, 'rgba(18, 26, 68, 0.2)');

        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        const ripple = radius * (0.92 + Math.sin(t * 1.4) * 0.05 * (1 + amplitude * 1.5));
        ctx.strokeStyle = 'rgba(120, 180, 255, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, ripple, 0, Math.PI * 2);
        ctx.stroke();

        const sweepCount = 5;
        for (let i = 0; i < sweepCount; i += 1) {
          const angle = t * 0.9 + (i / sweepCount) * Math.PI * 2;
          const inner = radius * 0.3;
          const outer = radius * (0.6 + 0.25 * pulse);
          ctx.strokeStyle = `rgba(130, 200, 255, ${0.08 + pulse * 0.1})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
          ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
          ctx.stroke();
        }
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
