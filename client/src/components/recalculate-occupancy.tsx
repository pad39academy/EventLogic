import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Calculator } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function RecalculateOccupancy() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const recalculateMutation = useMutation({
    mutationFn: () => apiRequest('/api/admin/recalculate-occupancy', 'POST'),
    onSuccess: () => {
      // Invalidate and refetch hotel data
      queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard/hotels'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard/stats'] });
      
      toast({
        title: "Success",
        description: "Hotel occupancy rates have been recalculated based on current participant assignments.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to recalculate occupancy",
        variant: "destructive",
      });
    },
  });

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Dynamic Occupancy
        </CardTitle>
        <CardDescription>
          Recalculate hotel occupancy rates based on current participant assignments and room sharing rules.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            <p><strong>Room Sharing Rules:</strong></p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>3 players per room</li>
              <li>2 coaches per room</li>
              <li>1 official per room</li>
            </ul>
          </div>
          
          <Button
            onClick={() => recalculateMutation.mutate()}
            disabled={recalculateMutation.isPending}
            className="w-full"
            data-testid="recalculate-occupancy-button"
          >
            {recalculateMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Recalculating...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Recalculate Occupancy
              </>
            )}
          </Button>
          
          <div className="text-xs text-gray-500">
            <p>
              This will update occupancy rates for all hotels based on assigned participants. 
              Occupancy is calculated automatically when participants are uploaded or modified.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}