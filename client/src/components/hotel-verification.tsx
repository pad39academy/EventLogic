import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Hotel, Shield, AlertTriangle, Lock } from "lucide-react";

interface HotelVerificationProps {
  onVerificationSuccess: () => void;
  coachName: string;
}

export default function HotelVerification({ onVerificationSuccess, coachName }: HotelVerificationProps) {
  const [hotelCode, setHotelCode] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const { toast } = useToast();

  const verifyHotelMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await fetch("/api/auth/coach/verify-hotel", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotelCode: code }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Hotel verification failed');
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Hotel Verified Successfully!",
        description: `Welcome to ${data.hotelName}. You can now access check-in/check-out features.`,
      });
      onVerificationSuccess();
    },
    onError: (error: any) => {
      const newFailedAttempts = failedAttempts + 1;
      setFailedAttempts(newFailedAttempts);
      
      if (newFailedAttempts >= 10) {
        toast({
          title: "Too Many Failed Attempts",
          description: "You have exceeded the maximum number of attempts (10). You will be logged out. Please contact the hotel reception and try again.",
          variant: "destructive",
        });
        
        // Auto logout after 3 seconds
        setTimeout(() => {
          fetch("/api/auth/logout", { method: 'POST', credentials: 'include' })
            .then(() => window.location.reload());
        }, 3000);
      } else {
        toast({
          title: "Invalid Hotel Code",
          description: `${error.message}. Attempts remaining: ${10 - newFailedAttempts}`,
          variant: "destructive",
        });
      }
      
      setHotelCode("");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hotelCode.trim() && failedAttempts < 10) {
      verifyHotelMutation.mutate(hotelCode.trim().toUpperCase());
    }
  };

  const isLocked = failedAttempts >= 10;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto h-16 w-16 bg-primary rounded-full flex items-center justify-center mb-4">
            {isLocked ? <Lock className="h-8 w-8 text-white" /> : <Hotel className="h-8 w-8 text-white" />}
          </div>
          <CardTitle className="text-2xl font-bold">
            {isLocked ? "Account Locked" : "Hotel Verification Required"}
          </CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            {isLocked 
              ? "Too many failed attempts. You will be logged out shortly."
              : `Welcome ${coachName}! Please enter the hotel verification code provided by hotel reception.`
            }
          </p>
        </CardHeader>
        
        <CardContent>
          {!isLocked ? (
            <>
              {/* Security Notice */}
              <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <Shield className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Security Verification</p>
                    <p>This code is provided by hotel reception upon your arrival. It ensures you are physically present at the hotel.</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="hotelCode">Hotel Verification Code</Label>
                  <Input
                    id="hotelCode"
                    type="text"
                    value={hotelCode}
                    onChange={(e) => setHotelCode(e.target.value.toUpperCase())}
                    placeholder="Enter hotel code"
                    className="mt-1 text-center font-mono text-lg tracking-wider"
                    maxLength={10}
                    disabled={verifyHotelMutation.isPending}
                    data-testid="input-hotel-code"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter the code exactly as provided by hotel reception
                  </p>
                </div>

                {failedAttempts > 0 && (
                  <div className="flex items-center space-x-2 text-amber-600 bg-amber-50 p-3 rounded-lg">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">
                      {failedAttempts} failed attempt{failedAttempts !== 1 ? 's' : ''}. 
                      {10 - failedAttempts} remaining.
                    </span>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={!hotelCode.trim() || verifyHotelMutation.isPending}
                  data-testid="button-verify-hotel"
                >
                  {verifyHotelMutation.isPending ? "Verifying..." : "Verify Hotel Code"}
                </Button>
              </form>

              <div className="mt-6 text-center text-sm text-gray-500">
                <p>Need help? Contact hotel reception or event support.</p>
              </div>
            </>
          ) : (
            <div className="text-center">
              <div className="text-red-600 mb-4">
                <Lock className="h-12 w-12 mx-auto mb-2" />
                <p className="text-sm">Account temporarily locked due to multiple failed attempts.</p>
              </div>
              <p className="text-sm text-gray-600">
                Please contact hotel reception for assistance and try logging in again.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}