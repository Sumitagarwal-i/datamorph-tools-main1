import { useEffect, useState } from "react";
import { Shield, Search, Lock, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface DetectiveEntryAnimationProps {
  onComplete: () => void;
}

export function DetectiveEntryAnimation({ onComplete }: DetectiveEntryAnimationProps) {
  const [stage, setStage] = useState<"initial" | "scanning" | "unlocked" | "exit">("initial");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Sequence of animations
    const initialTimer = setTimeout(() => {
      setStage("scanning");
    }, 500);

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 5; // Fill up over ~1s
      });
    }, 50);

    const unlockTimer = setTimeout(() => {
      setStage("unlocked");
    }, 1500);

    const exitTimer = setTimeout(() => {
      setStage("exit");
      setTimeout(onComplete, 800); // Wait for exit animation to finish
    }, 2200);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(progressInterval);
      clearTimeout(unlockTimer);
      clearTimeout(exitTimer);
    };
  }, [onComplete]);

  if (stage === "exit") {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0A0A0A] animate-out fade-out duration-700 pointer-events-none">
        {/* Optional: leave something behind or just fade out entirely */}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0A0A0A] text-white">
      <div className="relative flex flex-col items-center">
        
        {/* Icon Container with Rings */}
        <div className="relative mb-8">
          {/* Outer Ring */}
          <div className={cn(
            "absolute inset-[-20px] rounded-full border border-blue-500/20",
            stage === "scanning" && "animate-ping opacity-20"
          )} />
          
          {/* Rotating Ring */}
          <div className={cn(
            "absolute inset-[-10px] rounded-full border border-blue-500/30 border-t-blue-500",
            stage === "scanning" && "animate-spin duration-[3s]"
          )} />

          {/* Main Icon */}
          <div className="relative bg-[#1A1A1A] p-6 rounded-2xl border border-white/10 shadow-2xl">
            {stage === "unlocked" ? (
              <Zap className="w-12 h-12 text-blue-400 animate-in zoom-in duration-300" />
            ) : (
              <Search className="w-12 h-12 text-blue-500/80" />
            )}
          </div>
        </div>

        {/* Text */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 animate-in fade-in slide-in-from-bottom-4 duration-700">
            INSPECT
          </h2>
          <p className="text-sm text-gray-400 tracking-widest uppercase text-[10px] h-4">
            {stage === "initial" && "Initializing..."}
            {stage === "scanning" && "Analyzing Environment..."}
            {stage === "unlocked" && "Access Granted"}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-48 h-1 bg-white/5 rounded-full mt-8 overflow-hidden">
          <div 
            className="h-full bg-blue-500 transition-all duration-100 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

      </div>
    </div>
  );
}
