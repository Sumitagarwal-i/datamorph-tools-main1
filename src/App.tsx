import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense, useMemo, memo } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";

// Lazy load pages for code splitting with eager loading
const Index = lazy(() => import("./pages/Index"));
const Tools = lazy(() => import("./pages/Tools"));
const DetectiveD = lazy(() => import("./pages/DetectiveD"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const Admin = lazy(() => import("./pages/admin/Admin"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Loading fallback - memoized to prevent re-renders
const PageLoader = memo(() => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
));

PageLoader.displayName = "PageLoader";

// Error fallback - memoized to prevent re-renders
const ErrorFallback = memo(({ error }: { error: Error }) => (
  <div className="flex items-center justify-center min-h-screen p-4">
    <div className="text-center">
      <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
      <p className="text-muted-foreground mb-4">{error.message}</p>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
      >
        Reload Page
      </button>
    </div>
  </div>
));

ErrorFallback.displayName = "ErrorFallback";

const App = () => {
  // Memoize QueryClient to prevent recreating on every render
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 10, // 10 minutes
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
    []
  );

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/tools" element={<Tools />} />
                <Route path="/inspect" element={<DetectiveD />} />
                <Route path="/detective-d" element={<Navigate to="/inspect" replace />} />
                <Route path="/blog" element={<Blog />} />
                <Route path="/blog/:slug" element={<BlogPost />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          <SpeedInsights />
          <Analytics />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
