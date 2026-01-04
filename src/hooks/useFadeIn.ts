import { useEffect, useRef, useState } from 'react';

export const useFadeIn = <T extends HTMLElement = HTMLDivElement>(threshold: number = 0.1) => {
  const [isVisible, setIsVisible] = useState(false);
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
    const currentRef = ref.current;
    if (!currentRef) return;

    // If reduced motion, show immediately
    if (prefersReducedMotion) {
      setIsVisible(true);
      return;
    }

    // If IntersectionObserver isn't supported (or fails), show immediately.
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    try {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        },
        { threshold }
      );

      observer.observe(currentRef);

      return () => {
        if (currentRef) {
          observer.unobserve(currentRef);
        }
      };
    } catch {
      setIsVisible(true);
      return;
    }
  }, [threshold, prefersReducedMotion]);

  return { ref, isVisible: prefersReducedMotion ? true : isVisible };
};
