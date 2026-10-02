import { useEffect, useRef } from 'react';

export function AuthParticles() {
  const canvasRef =
    useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    type Particle = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      hue: number;
    };

    const particles: Particle[] = [];

    let frame = 0;

    const mouse = {
      x: -1000,
      y: -1000,
    };

    const resize = () => {
      const dpr = Math.min(
        window.devicePixelRatio || 1,
        2
      );

      canvas.width =
        window.innerWidth * dpr;

      canvas.height =
        window.innerHeight * dpr;

      canvas.style.width =
        `${window.innerWidth}px`;

      canvas.style.height =
        `${window.innerHeight}px`;

      ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
      );
    };

    resize();

    for (let i = 0; i < 110; i += 1) {
      particles.push({
        x:
          Math.random() *
          window.innerWidth,

        y:
          Math.random() *
          window.innerHeight,

        vx:
          (Math.random() - 0.5) *
          0.35,

        vy:
          (Math.random() - 0.5) *
          0.35,

        size:
          Math.random() * 1.7 +
          0.7,

        hue:
          Math.random() > 0.5
            ? 185
            : 300,
      });
    }

    const animate = () => {
      ctx.clearRect(
        0,
        0,
        window.innerWidth,
        window.innerHeight
      );

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (
          p.x < -10 ||
          p.x >
            window.innerWidth + 10
        ) {
          p.vx *= -1;
        }

        if (
          p.y < -10 ||
          p.y >
            window.innerHeight + 10
        ) {
          p.vy *= -1;
        }

        const dx =
          mouse.x - p.x;

        const dy =
          mouse.y - p.y;

        const dist = Math.hypot(
          dx,
          dy
        );

        if (dist < 120) {
          p.vx +=
            (dx /
              Math.max(dist, 1)) *
            0.002;

          p.vy +=
            (dy /
              Math.max(dist, 1)) *
            0.002;
        }

        const color =
          `hsl(${p.hue} 100% 55%)`;

        ctx.beginPath();

        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;

        ctx.arc(
          p.x,
          p.y,
          p.size,
          0,
          Math.PI * 2
        );

        ctx.fill();
      }

      frame =
        requestAnimationFrame(
          animate
        );
    };

    animate();

    const onMove = (
      e: MouseEvent
    ) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const onLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    window.addEventListener(
      'resize',
      resize
    );

    window.addEventListener(
      'mousemove',
      onMove
    );

    window.addEventListener(
      'mouseleave',
      onLeave
    );

    return () => {
      cancelAnimationFrame(frame);

      window.removeEventListener(
        'resize',
        resize
      );

      window.removeEventListener(
        'mousemove',
        onMove
      );

      window.removeEventListener(
        'mouseleave',
        onLeave
      );
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="nexus-auth-particles"
      aria-hidden="true"
    />
  );
}
