import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ThemeProvider } from "next-themes";
import { Sparkles, FileJson, FileSpreadsheet, Wrench } from "lucide-react";
import { lazy, Suspense } from "react";

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

const Tools = () => {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="datumint-theme">
      <div className="min-h-screen bg-background overflow-x-hidden max-w-[100vw] flex flex-col">
        <Header />
        
        <main className="container pb-6 sm:pb-8 lg:pb-12 pt-8 max-w-full overflow-x-hidden flex-grow">
          {/* Page Title */}
          <div className="max-w-4xl mx-auto mb-8">
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-3">Data Tools</h1>
            <p className="text-lg text-muted-foreground">
              Convert, transform, and validate your JSON and CSV files instantly.
            </p>
          </div>

          {/* Tools Tabs */}
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
        </main>

        <Footer />
      </div>
    </ThemeProvider>
  );
};

export default Tools;
