import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "@/components/Header";
import { ThemeProvider } from "next-themes";
import { Badge } from "@/components/ui/badge";
import { Zap, Shield, Download, Sparkles, Check, Minimize2, FileJson, FileSpreadsheet, Wrench, Bell, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { lazy, Suspense, memo, useState } from "react";
import { NotificationModal } from "@/components/NotificationModal";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <div className="min-h-screen bg-background overflow-x-hidden max-w-[100vw]">
        <Header />
        <NotificationModal open={notificationModalOpen} onOpenChange={setNotificationModalOpen} />
        
        {/* Update Notification Banner */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-b border-primary/20">
          <div className="container py-2.5 sm:py-3">
            <div className="flex items-center gap-2 text-[11px] sm:text-xs md:text-sm">
              <span className="text-sm sm:text-base flex-shrink-0">✨</span>
              <p className="line-clamp-2 sm:line-clamp-1">
                <span className="font-semibold">New: More Actions Tab</span> <span className="hidden sm:inline">— Auto-detect JSON/CSV + Beautify, Minify, Validate & Repair both formats instantly. Try demo data with one click!</span>
              </p>
            </div>
          </div>
        </div>
        
        <main className="container pb-6 sm:pb-8 lg:pb-12 pt-6 sm:pt-10 lg:pt-14 max-w-full overflow-x-hidden">
          {/* Detective D Announcement Banner */}
          <div className="max-w-6xl mx-auto mb-6 sm:mb-7 px-2 sm:px-4">
            <Card className="relative overflow-hidden bg-gradient-to-br from-[#0c0b10] via-[#0f0e14] to-[#13121a] dark:from-[#0c0b10] dark:via-[#0f0e14] dark:to-[#13121a] bg-gradient-to-br light:from-slate-50 light:via-slate-100 light:to-slate-200 border-slate-700/60 dark:border-slate-700/60 light:border-slate-300 shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black/30 dark:to-black/30 light:to-black/10"></div>
              <CardContent className="relative p-3 sm:p-4 md:p-5 lg:p-6">
                {/* Coming Soon badge at top of banner */}
                <div className="absolute left-3 top-3 sm:left-4 sm:top-4 md:left-6 md:top-4 lg:left-8 lg:top-6 z-20">
                  <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2 py-1 rounded-full bg-primary/10 border border-primary/20">
                    <Bell className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary animate-pulse" />
                    <span className="text-[10px] sm:text-xs font-medium text-primary">Coming Soon</span>
                  </div>
                </div>
                <div className="relative">
                  {/* Right Image - Absolute positioned to overflow consistently */}
                  <div className="hidden sm:block absolute inset-0 left-1/2 pointer-events-none overflow-hidden">
                    <img 
                      src="/image.png" 
                      alt="Detective D - AI Agent" 
                      className="absolute right-[-8%] top-[-140%] md:top-[-135%] lg:top-[-130%] w-[600px] h-[600px] md:w-[760px] md:h-[760px] lg:w-[920px] lg:h-[920px] object-contain drop-shadow-2xl animate-float" 
                    />
                  </div>

                  {/* Left Content */}
                  <div className="relative z-10 py-4 sm:py-6 md:py-8 lg:py-10 min-h-[200px] sm:min-h-[240px] md:min-h-[280px] lg:min-h-[300px] flex flex-col justify-end max-w-[90%] sm:max-w-[55%] lg:max-w-[50%]">
                    <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white dark:text-white light:text-slate-900 mb-2 flex flex-wrap items-baseline text-center sm:text-left justify-center sm:justify-start gap-1 sm:gap-0.5">
                      <span className="inline-flex items-baseline gap-1">Detective <span className="text-primary text-xl sm:text-xl md:text-2xl lg:text-4xl leading-none mr-1 sm:mr-2">D</span></span> <span className="whitespace-nowrap">on the Road,  Arriving Soon</span>
                    </h2>
                    <p className="text-slate-300 dark:text-slate-300 light:text-slate-600 text-xs sm:text-xs md:text-sm lg:text-base mb-3 sm:mb-4 text-center sm:text-left">
                      Your AI agent for deep error detection and smart data repair.
                    </p>
                    <div className="flex justify-center sm:justify-start">
                      <Button 
                        className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 gap-2 group text-xs sm:text-sm"
                        size="sm"
                        onClick={() => setNotificationModalOpen(true)}
                      >
                        Get Notified
                        <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="auto-detect" className="w-full max-w-full">
            <TabsList className="flex flex-wrap justify-center gap-3 mb-8 bg-transparent p-0 h-auto w-full max-w-4xl mx-auto">
              <TabsTrigger 
                value="auto-detect" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:shadow-primary/10 rounded-full px-6 py-3 transition-all duration-300 hover:shadow-sm hover:scale-[1.02] border border-border/50 bg-background/50 backdrop-blur-sm"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Auto Detect
              </TabsTrigger>
              
              <TabsTrigger 
                value="csv-to-json" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:shadow-primary/10 rounded-full px-6 py-3 transition-all duration-300 hover:shadow-sm hover:scale-[1.02] border border-border/50 bg-background/50 backdrop-blur-sm"
              >
                <FileJson className="h-4 w-4 mr-2" />
                CSV → JSON
              </TabsTrigger>

              <TabsTrigger 
                value="json-to-csv" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:shadow-primary/10 rounded-full px-6 py-3 transition-all duration-300 hover:shadow-sm hover:scale-[1.02] border border-border/50 bg-background/50 backdrop-blur-sm"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                JSON → CSV
              </TabsTrigger>

              <TabsTrigger 
                value="json-tools" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:shadow-primary/10 rounded-full px-6 py-3 transition-all duration-300 hover:shadow-sm hover:scale-[1.02] border border-border/50 bg-background/50 backdrop-blur-sm"
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
        </main>

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