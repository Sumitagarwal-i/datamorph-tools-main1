import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { WhatBreaksSection } from "@/components/WhatBreaksSection";
import { WhatDatumIntDoesSection } from "@/components/WhatDatumIntDoesSection";
import { FocusScopeSection } from "@/components/FocusScopeSection";
import { WhoIsForSection } from "@/components/WhoIsForSection";
import { FinalCTASection } from "@/components/FinalCTASection";
import { Footer } from "@/components/Footer";
import { ThemeProvider } from "next-themes";

const Index = () => {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="datumint-theme">
      <div className="min-h-screen bg-background overflow-x-hidden max-w-[100vw] flex flex-col">
        <Header />
        <HeroSection />
        <WhatBreaksSection />
        <WhatDatumIntDoesSection />
        <FocusScopeSection />
        <WhoIsForSection />
        <FinalCTASection />
        <Footer />
      </div>
    </ThemeProvider>
  );
};

export default Index;