import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "@/components/Header";
import { ThemeProvider } from "next-themes";
import { Badge } from "@/components/ui/badge";
import { Zap, Shield, Download, Sparkles, Check, Minimize2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { lazy, Suspense, memo } from "react";
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
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <div className="min-h-screen bg-background">
        <Header />
        
        {/* Update Notification Banner */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-b border-primary/20">
          <div className="container mx-auto px-4 py-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-lg">✨</span>
              <p>
                <span className="font-semibold">New: More Actions Tab</span> — Auto-detect JSON/CSV + Beautify, Minify, Validate & Repair both formats instantly. Try demo data with one click!
              </p>
            </div>
          </div>
        </div>
        
        <main className="container mx-auto px-4 pb-8 pt-16">
          <Tabs defaultValue="auto-detect" className="w-full">
            <TabsList className="grid w-full max-w-3xl mx-auto grid-cols-4 mb-8 bg-muted/60 dark:bg-muted/30 backdrop-blur-md border border-border/50">
              <TabsTrigger value="auto-detect" className="gap-2">
                <Sparkles className="h-4 w-4" />
                Auto-Detect
              </TabsTrigger>
              <TabsTrigger value="csv-to-json">CSV → JSON</TabsTrigger>
              <TabsTrigger value="json-to-csv">JSON → CSV</TabsTrigger>
              <TabsTrigger value="json-tools">More Actions</TabsTrigger>
            </TabsList>

            <TabsContent value="auto-detect" className="space-y-4">
              <Suspense fallback={<ConverterLoader />}>
                <AutoDetectConverter />
              </Suspense>
            </TabsContent>

            <TabsContent value="csv-to-json" className="space-y-4">
              <Suspense fallback={<ConverterLoader />}>
                <CsvToJsonConverter />
              </Suspense>
            </TabsContent>

            <TabsContent value="json-to-csv" className="space-y-4">
              <Suspense fallback={<ConverterLoader />}>
                <JsonToCsvConverter />
              </Suspense>
            </TabsContent>

            <TabsContent value="json-tools" className="space-y-4">
              <Suspense fallback={<ConverterLoader />}>
                <DataToolsPanel />
              </Suspense>
            </TabsContent>
          </Tabs>

          {/* Features List */}
          <section className="mt-16 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8">Why Choose DatumInt?</h2>
            <div className="grid md:grid-cols-2 gap-6">
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

        <footer className="border-t border-border mt-16 py-6">
          <div className="container mx-auto px-4 text-center">
            <p className="text-sm text-muted-foreground mb-2">
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