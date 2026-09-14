"use client";

import { useEffect } from "react";

export function HomeAnimations() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    let revert: (() => void) | null = null;
    let cleanupParallax: (() => void) | null = null;

    const motionPointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (motionPointer.matches) {
      const root = document.querySelector<HTMLElement>("[data-home-parallax-root]");
      const phone = document.querySelector<HTMLElement>("[data-home-parallax-phone]");
      let frameId: number | null = null;
      let nextX = 0;
      let nextY = 0;

      const setParallax = () => {
        frameId = null;
        root?.style.setProperty("--hero-bg-left-x", `${(nextX * -6.4).toFixed(2)}px`);
        root?.style.setProperty("--hero-bg-left-y", `${(nextY * 4.8).toFixed(2)}px`);
        root?.style.setProperty("--hero-bg-left-rotate", `${(nextY * -0.55).toFixed(3)}deg`);
        root?.style.setProperty("--hero-bg-right-x", `${(nextX * 5.2).toFixed(2)}px`);
        root?.style.setProperty("--hero-bg-right-y", `${(nextY * -6.8).toFixed(2)}px`);
        root?.style.setProperty("--hero-bg-right-rotate", `${(nextX * 0.62).toFixed(3)}deg`);
        root?.style.setProperty("--hero-phone-parallax-x", `${(nextX * -2.4).toFixed(2)}px`);
        root?.style.setProperty("--hero-phone-parallax-y", `${(nextY * 2.8).toFixed(2)}px`);
        root?.style.setProperty("--hero-phone-rotate", `${((nextY - nextX) * 0.1).toFixed(3)}deg`);
      };

      const queueParallax = (x: number, y: number) => {
        nextX = x;
        nextY = y;
        if (frameId == null) {
          frameId = window.requestAnimationFrame(setParallax);
        }
      };

      const handlePointerMove = (event: PointerEvent) => {
        const x = (event.clientX / window.innerWidth - 0.5) * 2;
        const y = (event.clientY / window.innerHeight - 0.5) * 2;
        queueParallax(Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y)));
      };

      const resetParallax = () => queueParallax(0, 0);

      if (root && phone) {
        window.addEventListener("pointermove", handlePointerMove, { passive: true });
        window.addEventListener("pointerleave", resetParallax);
        cleanupParallax = () => {
          window.removeEventListener("pointermove", handlePointerMove);
          window.removeEventListener("pointerleave", resetParallax);
          if (frameId != null) {
            window.cancelAnimationFrame(frameId);
          }
        };
      }
    }

    void (async () => {
      const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);

      if (cancelled) return;

      gsap.registerPlugin(ScrollTrigger);

      const ctx = gsap.context(() => {
        // Hero on mount — каскадом
        const heroTargets = gsap.utils.toArray<HTMLElement>("[data-animate-hero]");
        if (heroTargets.length > 0) {
          gsap.from(heroTargets, {
            y: 28,
            duration: 0.85,
            ease: "power3.out",
            stagger: 0.09,
            clearProps: "transform",
          });
        }

        // Секции по скроллу
        gsap.utils.toArray<HTMLElement>("[data-animate-section]").forEach((section) => {
          gsap.from(section, {
            y: 48,
            duration: 0.85,
            ease: "power3.out",
            clearProps: "transform",
            scrollTrigger: {
              trigger: section,
              start: "top 85%",
              toggleActions: "play none none reverse",
            },
          });

          // Внутренние карточки, если помечены
          const items = section.querySelectorAll<HTMLElement>("[data-animate-item]");
          if (items.length > 0) {
            gsap.from(items, {
              y: 28,
              duration: 0.7,
              ease: "power3.out",
              stagger: 0.08,
              clearProps: "transform",
              scrollTrigger: {
                trigger: section,
                start: "top 80%",
                toggleActions: "play none none reverse",
              },
            });
          }
        });
      });

      revert = () => ctx.revert();
    })();

    return () => {
      cancelled = true;
      if (cleanupParallax) cleanupParallax();
      if (revert) revert();
    };
  }, []);

  return null;
}
