import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "@/components/Header";
import { ThemeProvider } from "next-themes";
import { Badge } from "@/components/ui/badge";
import { Zap, Shield, Download, Sparkles, Check, Minimize2, FileJson, FileSpreadsheet, Wrench, Bell, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { lazy, Suspense, memo, useState, useEffect } from "react";
import { NotificationModal } from "@/components/NotificationModal";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { DetectiveDBanner } from "@/components/DetectiveDBanner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

// Lazy load converter components for better initial load
const CsvToJsonConverter = lazy(() => import("@/components/CsvToJsonConverter").then(m => ({ default: m.CsvToJsonConverter })));
const JsonToCsvConverter = lazy(() => import("@/components/JsonToCsvConverter").then(m => ({ default: m.JsonToCsvConverter })));
const AutoDetectConverter = lazy(() => import("@/components/AutoDetectConverter").then(m => ({ default: m.AutoDetectConverter })));
const DataToolsPanel = lazy(() => import("@/components/DataToolsPanel").then(m => ({ default: m.DataToolsPanel })));

// Loading spinner for lazy components
const ConverterLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

// Memoize feature card to prevent re-renders
const FeatureCard = memo(({ icon: Icon, title, description }: { icon: React.ComponentType<{ className?: string }>, title: string, description: string }) => (
  <Card className="border-primary/20">
    <CardContent className="pt-6 pb-4">
      <Icon className="h-8 w-8 mx-auto mb-2 text-primary" />
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground">{description}</p>
    </CardContent>
  </Card>
));

FeatureCard.displayName = "FeatureCard";

// Memoize benefit item
const BenefitItem = memo(({ title, description }: { title: string, description: string }) => (
  <div className="flex gap-3">
    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
    <div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  </div>
));

BenefitItem.displayName = "BenefitItem";

const Index = () => {
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(true);

  // Hide button when banner is in view
  useEffect(() => {
    const handleScroll = () => {
      const banner = document.getElementById('detective-d-banner');
      if (banner) {
        const rect = banner.getBoundingClientRect();
        // Show button only if banner is not visible in viewport
        setShowScrollButton(rect.top > window.innerHeight || rect.bottom < 0);
      }
    };

    window.addEventListener('scroll', handleScroll);
    // listen for requests from the banner to open the notification modal
    const openHandler = () => setNotificationModalOpen(true);
    window.addEventListener('openNotificationModal', openHandler as EventListener);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('openNotificationModal', openHandler as EventListener);
    };
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="datumint-theme">
      <div className="min-h-screen bg-background overflow-x-hidden max-w-[100vw] pt-[64px]">
        <Header />
          <NotificationModal open={notificationModalOpen} onOpenChange={setNotificationModalOpen} />

          <DetectiveDBanner />
        
        <main className="container pb-6 sm:pb-8 lg:pb-12 pt-[64px] sm:pt-[64px] lg:pt-[64px] max-w-full overflow-x-hidden">
          <Tabs defaultValue="auto-detect" className="w-full max-w-full">
            <TabsList className="flex flex-wrap justify-center gap-3 mb-8 bg-transparent p-0 h-auto w-full max-w-4xl mx-auto">
              <TabsTrigger 
                value="auto-detect" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:shadow-primary/10 rounded-sm px-6 py-3 transition-all duration-300 hover:shadow-sm hover:scale-[1.02] border border-slate-300 bg-background/50 backdrop-blur-sm"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Auto Detect
              </TabsTrigger>
              
              <TabsTrigger 
                value="csv-to-json" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:shadow-primary/10 rounded-sm px-6 py-3 transition-all duration-300 hover:shadow-sm hover:scale-[1.02] border border-slate-300 bg-background/50 backdrop-blur-sm"
              >
                <FileJson className="h-4 w-4 mr-2" />
                CSV → JSON
              </TabsTrigger>

              <TabsTrigger 
                value="json-to-csv" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:shadow-primary/10 rounded-sm px-6 py-3 transition-all duration-300 hover:shadow-sm hover:scale-[1.02] border border-slate-300 bg-background/50 backdrop-blur-sm"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                JSON → CSV
              </TabsTrigger>

              <TabsTrigger 
                value="json-tools" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:shadow-primary/10 rounded-sm px-6 py-3 transition-all duration-300 hover:shadow-sm hover:scale-[1.02] border border-slate-300 bg-background/50 backdrop-blur-sm"
              >
                <Wrench className="h-4 w-4 mr-2" />
                Tools
              </TabsTrigger>
            </TabsList>

            <TabsContent value="auto-detect" className="space-y-4 sm:space-y-6 px-2 sm:px-5 md:px-7 lg:px-10">
              <Suspense fallback={<ConverterLoader />}>
                <AutoDetectConverter />
              </Suspense>
            </TabsContent>

            <TabsContent value="csv-to-json" className="space-y-4 sm:space-y-6 px-2 sm:px-5 md:px-7 lg:px-10">
              <Suspense fallback={<ConverterLoader />}>
                <CsvToJsonConverter />
              </Suspense>
            </TabsContent>

            <TabsContent value="json-to-csv" className="space-y-4 sm:space-y-6 px-2 sm:px-5 md:px-7 lg:px-10">
              <Suspense fallback={<ConverterLoader />}>
                <JsonToCsvConverter />
              </Suspense>
            </TabsContent>

            <TabsContent value="json-tools" className="space-y-4 sm:space-y-6 px-2 sm:px-5 md:px-7 lg:px-10">
              <Suspense fallback={<ConverterLoader />}>
                <DataToolsPanel />
              </Suspense>
            </TabsContent>
          </Tabs>

          

          {/* Features List */}
          <section className="mt-10 sm:mt-14 lg:mt-20 max-w-4xl mx-auto px-1 sm:px-4">
            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-center mb-6 sm:mb-8 lg:mb-10">Why Choose DatumInt?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 lg:gap-6">
              <BenefitItem 
                title="No Account Required" 
                description="Start converting immediately without signing up" 
              />
              <BenefitItem 
                title="Smart Auto-Detection" 
                description="Automatically detects your data format" 
              />
              <BenefitItem 
                title="1-Click JSON Repair" 
                description="Automatically fix broken JSON with missing commas, quotes, or brackets" 
              />
              <BenefitItem 
                title="Instant JSON Minification" 
                description="Minify JSON output directly in your workflow" 
              />
              <BenefitItem 
                title="Smart Nested JSON to CSV" 
                description="Intelligently flattens complex nested structures into proper CSV rows" 
              />
              <BenefitItem 
                title="Drag & Drop Support" 
                description="Simply drag files to convert them" 
              />
              <BenefitItem 
                title="More Actions - JSON & CSV" 
                description="Format, validate, and manipulate JSON & CSV data instantly" 
              />
              <BenefitItem 
                title="Handles Complex Data" 
                description="Nested objects, arrays, and special characters" 
              />
              <BenefitItem 
                title="100% Private & Secure" 
                description="All processing happens in your browser, no data sent to servers" 
              />
              <BenefitItem 
                title="Works Offline" 
                description="No internet required after initial load" 
              />
            </div>
          </section>

          {/* Scroll-to-banner button removed per request (bottom-right arrow) */}
        </main>

        {/* Sticky Get Notified button removed — moved into the carousel's first slide */}

        <footer className="border-t border-border mt-8 sm:mt-12 lg:mt-16 py-4 sm:py-6">
          <div className="container mx-auto px-2 sm:px-4 text-center">
            <p className="text-xs sm:text-sm text-muted-foreground mb-2">
              Made with ❤️ for fast data conversion
            </p>
            <p className="text-xs text-muted-foreground">
              • Privacy first • No data collection
            </p>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  );
};

export default Index;