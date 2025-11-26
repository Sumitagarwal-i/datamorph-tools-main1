// Web Vitals monitoring for performance tracking
interface Metric {
  name: string;
  value: number;
  id: string;
  rating: 'good' | 'needs-improvement' | 'poor';
}

export const reportWebVitals = (onPerfEntry?: (metric: Metric) => void) => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    import('web-vitals').then(({ onCLS, onFID, onFCP, onLCP, onTTFB }) => {
      onCLS(onPerfEntry);
      onFID(onPerfEntry);
      onFCP(onPerfEntry);
      onLCP(onPerfEntry);
      onTTFB(onPerfEntry);
    });
  }
};

// Log performance metrics in development
if (import.meta.env.DEV) {
  reportWebVitals((metric) => {
    console.log(`${metric.name}: ${metric.value}`);
  });
}
