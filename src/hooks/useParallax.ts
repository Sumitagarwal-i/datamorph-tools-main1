import { useEffect, useRef, useState } from 'react';

export const useParallax = <T extends HTMLElement = HTMLDivElement>(speed: number = 0.3) => {
  const [offset, setOffset] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const ref = useRef<T>(null);

  useEffect(() => {
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleMediaChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleMediaChange);

    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;

    let rafId: number;

    const handleScroll = () => {
      rafId = requestAnimationFrame(() => {
        if (ref.current) {
          const rect = ref.current.getBoundingClientRect();
          const scrolled = window.scrollY;
          const elementTop = rect.top + scrolled;
          const elementBottom = elementTop + rect.height;
          
          // Only apply parallax when element is in viewport
          if (scrolled < elementBottom && scrolled + window.innerHeight > elementTop) {
            setOffset(scrolled * speed);
          }
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial calculation

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [speed, prefersReducedMotion]);

  return { ref, offset: prefersReducedMotion ? 0 : offset };
};
