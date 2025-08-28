import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Clock, Save, RotateCcw, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TimeWindowSetting {
  key: string;
  value: string;
  description: string;
  updatedBy: string;
  updatedAt: string;
}

export default function TimeWindowSettings() {
  const [timeWindowHours, setTimeWindowHours] = useState("4");
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["/api/admin/settings/checkin-time-window"],
    queryFn: async (): Promise<TimeWindowSetting> => {
      const response = await fetch("/api/admin/settings/checkin-time-window", {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }
      return await response.json();
    },
  });

  // Set initial value when settings load
  useEffect(() => {
    if (settings) {
      setTimeWindowHours(settings.value || "4");
    }
  }, [settings]);

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (newValue: string) => {
      const response = await fetch("/api/admin/settings/checkin-time-window", {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: newValue }),
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update settings');
      }
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings/checkin-time-window"] });
      setHasChanges(false);
      toast({
        title: "Settings Updated",
        description: `Access window changed to ${data.value} hours before check-in time`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
    },
  });

  const handleValueChange = (value: string) => {
    // Only allow positive numbers
    if (/^\d*$/.test(value) && Number(value) >= 0 && Number(value) <= 72) {
      setTimeWindowHours(value);
      setHasChanges(value !== (settings?.value || "4"));
    }
  };

  const handleSave = () => {
    if (hasChanges) {
      updateSettingsMutation.mutate(timeWindowHours);
    }
  };

  const handleReset = () => {
    setTimeWindowHours(settings?.value || "4");
    setHasChanges(false);
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-32 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Setting Display */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Clock className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">Current Access Window</p>
                <p className="text-sm text-blue-700">
                  Coaches can check-in/out starting <strong>{settings?.value || "4"} hours</strong> before their booking start time
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              Active
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Settings Form */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="time-window" className="text-sm font-medium text-gray-700">
            Access Window (Hours)
          </Label>
          <div className="mt-1 flex items-center space-x-3">
            <div className="relative">
              <Input
                id="time-window"
                type="text"
                value={timeWindowHours}
                onChange={(e) => handleValueChange(e.target.value)}
                className="w-20 text-center font-mono text-lg"
                placeholder="4"
                data-testid="input-time-window"
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500">
                hrs
              </span>
            </div>
            <div className="text-sm text-gray-600">
              hours before check-in time
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Enter a value between 0-72 hours. Coaches will be able to access check-in features this many hours before their hotel booking starts.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3 pt-4">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateSettingsMutation.isPending}
            className="flex items-center space-x-2"
            data-testid="button-save-settings"
          >
            <Save className="h-4 w-4" />
            <span>
              {updateSettingsMutation.isPending ? "Saving..." : "Save Changes"}
            </span>
          </Button>
          
          {hasChanges && (
            <Button
              variant="outline"
              onClick={handleReset}
              className="flex items-center space-x-2"
              data-testid="button-reset-settings"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reset</span>
            </Button>
          )}
        </div>

        {hasChanges && (
          <div className="flex items-center space-x-2 text-amber-600 bg-amber-50 p-3 rounded-lg">
            <Info className="h-4 w-4" />
            <span className="text-sm">
              You have unsaved changes. Click "Save Changes" to apply them.
            </span>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">How Access Control Works</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Coaches must complete hotel verification before accessing check-in features</li>
          <li>• Check-in becomes available {settings?.value || "4"} hours before their booking start date</li>
          <li>• Check-out is available anytime after check-in until booking end date</li>
          <li>• Access is automatically controlled based on current date and time</li>
        </ul>
        
        {settings?.updatedAt && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Last updated: {new Date(settings.updatedAt).toLocaleString()} by {settings.updatedBy}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}