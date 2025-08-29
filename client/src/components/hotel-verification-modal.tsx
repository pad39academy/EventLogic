import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface HotelVerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerificationSuccess: () => void;
}

export default function HotelVerificationModal({ 
  open, 
  onOpenChange, 
  onVerificationSuccess 
}: HotelVerificationModalProps) {
  const [hotelCode, setHotelCode] = useState("");
  const [error, setError] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const verifyHotelMutation = useMutation({
    mutationFn: async (hotelCode: string) => {
      const response = await fetch("/api/auth/coach/verify-hotel", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotelCode }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Hotel verification failed');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      // Invalidate auth queries to refresh user state
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      
      toast({
        title: "Hotel Verified Successfully",
        description: "You can now proceed with check-in operations",
      });
      
      // Reset form and close modal
      setHotelCode("");
      setError("");
      onOpenChange(false);
      onVerificationSuccess();
    },
    onError: (error: any) => {
      setError(error.message || "Hotel verification failed");
      toast({
        title: "Verification Failed",
        description: error.message || "Please check your hotel ID and try again",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hotelCode.trim()) {
      setError("Please enter your hotel ID");
      return;
    }
    
    setError("");
    verifyHotelMutation.mutate(hotelCode.trim());
  };

  const handleCancel = () => {
    setHotelCode("");
    setError("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Building className="h-5 w-5 text-primary" />
            <span>Hotel Verification Required</span>
          </DialogTitle>
          <DialogDescription>
            To proceed with check-in operations, please verify your hotel ID. 
            You can get this from your hotel reception.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hotelCode">Hotel ID</Label>
            <Input
              id="hotelCode"
              placeholder="Enter your hotel ID (e.g., HOTEL-001)"
              value={hotelCode}
              onChange={(e) => {
                setHotelCode(e.target.value);
                if (error) setError(""); // Clear error when user types
              }}
              disabled={verifyHotelMutation.isPending}
              className={error ? "border-red-500" : ""}
              data-testid="input-hotel-code"
            />
            {error && (
              <div className="flex items-center space-x-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Need help finding your Hotel ID?</p>
                <p className="mt-1">Contact your hotel reception or check your booking confirmation.</p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={verifyHotelMutation.isPending}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!hotelCode.trim() || verifyHotelMutation.isPending}
              data-testid="button-verify"
            >
              {verifyHotelMutation.isPending ? "Verifying..." : "Verify Hotel"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}