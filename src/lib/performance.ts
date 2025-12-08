// Web Vitals monitoring for performance tracking
interface Metric {
  name: string;
  value: number;
  id: string;
  rating: 'good' | 'needs-improvement' | 'poor';
}

export const reportWebVitals = (onPerfEntry?: (metric: Metric) => void) => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    import('web-vitals').then(({ onCLS, onFCP, onLCP, onTTFB, onINP }) => {
      onCLS(onPerfEntry);
      onFCP(onPerfEntry);
      onLCP(onPerfEntry);
      onTTFB(onPerfEntry);
      onINP?.(onPerfEntry); // INP replaced FID in newer web-vitals
    }).catch(() => {
      // Silently fail if web-vitals not available
    });
  }
};

// Log performance metrics in development
if (import.meta.env.DEV) {
  reportWebVitals((metric) => {
    console.log(`${metric.name}: ${metric.value}`);
  });
}
