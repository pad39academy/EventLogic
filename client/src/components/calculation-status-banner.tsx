import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Clock, CheckCircle } from "lucide-react";

interface CalculationStatus {
  status: 'idle' | 'calculating' | 'error';
  message: string;
  details: {
    pendingCalculations: number;
    processingCalculations: number;
    recentActivity: number;
    totalRemaining: number;
    estimatedCompletionSeconds: number;
    estimatedCompletionMinutes: number;
  };
}

export function CalculationStatusBanner() {
  const { data: status, isLoading } = useQuery<CalculationStatus>({
    queryKey: ["/api/admin/dashboard/calculation-status"],
    queryFn: async () => {
      const response = await fetch("/api/admin/dashboard/calculation-status", {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch calculation status');
      }
      
      return response.json();
    },
    refetchInterval: 10000, // Refresh every 10 seconds for better detection
    staleTime: 8000, // Consider data stale after 8 seconds
  });

  // Don't show anything if loading or if calculations are idle
  if (isLoading || !status || status.status === 'idle') {
    return null;
  }

  // Show error state
  if (status.status === 'error') {
    return (
      <div className="mx-6 mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-900 dark:text-red-100">
              Calculation Status Error
            </p>
            <p className="text-sm text-red-700 dark:text-red-300">
              Unable to check calculation status. Hotel occupancy data may not be current.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show calculation in progress
  return (
    <div 
      className="mx-6 mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg"
      data-testid="calculation-status-banner"
    >
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          <Clock className="h-5 w-5 text-amber-500 animate-pulse" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            Hotel Occupancy Calculations in Progress
          </p>
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {status.message}
          </p>
          {(status.details.totalRemaining > 0 || status.details.recentActivity > 0) && (
            <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              {status.details.totalRemaining > 0 
                ? `Processing ${status.details.totalRemaining} participant${status.details.totalRemaining !== 1 ? 's' : ''}`
                : `Recent activity: ${status.details.recentActivity} calculations`
              }
              {status.details.pendingCalculations > 0 && ` (${status.details.pendingCalculations} pending)`}
              {status.details.processingCalculations > 0 && ` (${status.details.processingCalculations} in progress)`}
            </div>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="text-xs text-amber-600 dark:text-amber-400">
            {status.details.totalRemaining > 0 
              ? `ETA: ${status.details.estimatedCompletionMinutes > 1 
                  ? `~${status.details.estimatedCompletionMinutes} min` 
                  : '<1 min'}`
              : 'Finishing soon'
            }
          </div>
          <div className="text-xs text-amber-500 dark:text-amber-500 mt-1">
            Auto-refreshing (10s)
          </div>
        </div>
      </div>
    </div>
  );
}

// Completion status indicator component (optional - shows when calculations complete)
export function CalculationCompleteBanner({ onDismiss }: { onDismiss?: () => void }) {
  return (
    <div 
      className="mx-6 mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg"
      data-testid="calculation-complete-banner"
    >
      <div className="flex items-center gap-3">
        <CheckCircle className="h-5 w-5 text-green-500" />
        <div className="flex-1">
          <p className="text-sm font-medium text-green-900 dark:text-green-100">
            Hotel Occupancy Calculations Complete
          </p>
          <p className="text-sm text-green-700 dark:text-green-300">
            All hotel balance data is now up to date with recent uploads.
          </p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-green-400 hover:text-green-600 text-xs"
            data-testid="dismiss-complete-banner"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}