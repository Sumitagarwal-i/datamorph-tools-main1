import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, AlertCircle } from "lucide-react";

interface PasscodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PasscodeModal = ({ open, onOpenChange }: PasscodeModalProps) => {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  const CORRECT_PASSCODE = "nobody7178";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passcode === CORRECT_PASSCODE) {
      // Store authentication in sessionStorage
      sessionStorage.setItem("detective_d_auth", "true");
      onOpenChange(false);
      navigate("/detective-d");
      setPasscode("");
      setError(false);
    } else {
      setError(true);
      setPasscode("");
    }
  };

  const handleClose = () => {
    setPasscode("");
    setError(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Developer Access Required</DialogTitle>
              <DialogDescription className="text-xs mt-1">
                Detective D is currently in development
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="passcode">Enter Access Code</Label>
              <Input
                id="passcode"
                type="password"
                placeholder="Enter developer passcode"
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  setError(false);
                }}
                className={error ? "border-red-500" : ""}
                autoFocus
              />
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-500">
                  <AlertCircle className="h-4 w-4" />
                  <span>Incorrect passcode. Please try again.</span>
                </div>
              )}
            </div>
            
            <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
              <p className="font-medium mb-1">Note:</p>
              <p className="text-xs">
                This page is under active development. Features may be incomplete or unstable.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit">
              Access Detective D
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
