import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function HeroThreeBackdrop() {
    const mountRef = useRef(null);

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return undefined;

        const scene = new THREE.Scene();
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
        renderer.setClearColor(0x000000, 0);
        renderer.setSize(mount.clientWidth, mount.clientHeight);
        mount.appendChild(renderer.domElement);

        const camera = new THREE.PerspectiveCamera(38, mount.clientWidth / mount.clientHeight, 0.1, 100);
        camera.position.set(0, 0, 6.4);

        const group = new THREE.Group();
        scene.add(group);

        const pointsCount = 260;
        const positionBuffer = new Float32Array(pointsCount * 3);
        for (let i = 0; i < pointsCount; i += 1) {
            const i3 = i * 3;
            positionBuffer[i3] = (Math.random() - 0.5) * 9.4;
            positionBuffer[i3 + 1] = (Math.random() - 0.5) * 5.4;
            positionBuffer[i3 + 2] = (Math.random() - 0.5) * 3.8;
        }

        const pointsGeometry = new THREE.BufferGeometry();
        pointsGeometry.setAttribute('position', new THREE.BufferAttribute(positionBuffer, 3));
        const pointsMaterial = new THREE.PointsMaterial({
            color: 0x60a5fa,
            size: 0.055,
            transparent: true,
            opacity: 0.62,
        });
        const points = new THREE.Points(pointsGeometry, pointsMaterial);
        group.add(points);

        const ringGeometry = new THREE.TorusGeometry(1.18, 0.02, 24, 110);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0x3b82f6,
            wireframe: true,
            transparent: true,
            opacity: 0.32,
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.set(1.45, -0.25, -0.6);
        group.add(ring);

        const ringTwoGeometry = new THREE.TorusGeometry(0.86, 0.018, 18, 90);
        const ringTwoMaterial = new THREE.MeshBasicMaterial({
            color: 0x93c5fd,
            wireframe: true,
            transparent: true,
            opacity: 0.24,
        });
        const ringTwo = new THREE.Mesh(ringTwoGeometry, ringTwoMaterial);
        ringTwo.position.set(-1.68, 0.55, -0.8);
        group.add(ringTwo);

        const clock = new THREE.Clock();
        let frameId = null;
        let active = true;

        const tick = () => {
            if (!active) return;
            const elapsed = clock.getElapsedTime();
            points.rotation.y = elapsed * 0.046;
            points.rotation.x = Math.sin(elapsed * 0.22) * 0.08;
            ring.rotation.x = elapsed * 0.18;
            ring.rotation.y = elapsed * 0.23;
            ringTwo.rotation.x = elapsed * -0.22;
            ringTwo.rotation.y = elapsed * 0.17;
            renderer.render(scene, camera);
            frameId = window.requestAnimationFrame(tick);
        };
        tick();

        const handleResize = () => {
            if (!mount) return;
            const width = mount.clientWidth;
            const height = mount.clientHeight;
            renderer.setSize(width, height);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        };
        window.addEventListener('resize', handleResize);

        return () => {
            active = false;
            if (frameId) window.cancelAnimationFrame(frameId);
            window.removeEventListener('resize', handleResize);
            ringGeometry.dispose();
            ringMaterial.dispose();
            ringTwoGeometry.dispose();
            ringTwoMaterial.dispose();
            pointsGeometry.dispose();
            pointsMaterial.dispose();
            renderer.dispose();
            if (mount.contains(renderer.domElement)) {
                mount.removeChild(renderer.domElement);
            }
        };
    }, []);

    return (
        <div
            ref={mountRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-85"
        />
    );
}

