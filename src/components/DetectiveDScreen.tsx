import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DetectiveDScreenProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DetectiveDScreen = ({ isOpen, onClose }: DetectiveDScreenProps) => {
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Sliding Screen */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[90%] md:w-[80%] lg:w-[70%] xl:w-[60%] bg-background border-l border-border shadow-2xl z-50 transition-transform duration-500 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-primary text-lg font-bold">D</span>
            </div>
            <h2 className="text-lg font-semibold">Detective D</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content Area */}
        <div className="p-6 h-[calc(100%-65px)] overflow-y-auto">
          {/* Privacy Notice */}
          <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-primary text-xs">🔒</span>
              </div>
              <div className="flex-1 text-sm">
                <p className="font-medium text-foreground mb-1">Privacy Notice</p>
                <p className="text-muted-foreground leading-relaxed">
                  Your file will be sent to our AI service for analysis. <strong>No data is stored</strong> unless you explicitly opt-in. 
                  We only process your content temporarily to detect errors and immediately discard it after analysis.
                </p>
                <p className="text-muted-foreground text-xs mt-2">
                  Learn more about our <a href="#" className="text-primary hover:underline">privacy policy</a> and <a href="#" className="text-primary hover:underline">data handling</a>.
                </p>
              </div>
            </div>
          </div>

          {/* Main content placeholder */}
          <div className="flex flex-col items-center justify-center h-[calc(100%-120px)]">
            <div className="text-base font-semibold text-foreground mb-1">No file uploaded</div>
            <div className="text-sm text-muted-foreground mb-0.5" style={{ lineHeight: 1.7, maxWidth: 320, textAlign: 'center' }}>
              Upload or paste a file to run<br />
              structure validation and analysis.
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
