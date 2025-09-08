import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Clock, 
  Loader2, 
  ChevronDown, 
  ChevronUp,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QueueInfo } from './operation-queue-modal';
import type { QueueNotification } from '@/hooks/use-websocket';

interface QueueStatusIndicatorProps {
  queueInfo?: QueueInfo;
  notifications?: QueueNotification[];
  onExpand?: () => void;
  className?: string;
  compact?: boolean;
}

const getOperationLabel = (operationType: string) => {
  const labels: Record<string, string> = {
    'hotel_upload': 'Hotel Upload',
    'hotel_edit': 'Hotel Edit',
    'coaches_officials_batch': 'Coaches & Officials',
    'coach_upload': 'Coach Upload',
    'official_upload': 'Official Upload',
    'player_upload': 'Player Upload',
    'balance_recalculation': 'Balance Calculation',
    'occupancy_update': 'Occupancy Update'
  };
  return labels[operationType] || operationType.replace(/_/g, ' ');
};

const formatWaitTime = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.ceil(minutes / 60);
  return `${hours}h`;
};

export default function QueueStatusIndicator({
  queueInfo,
  notifications = [],
  onExpand,
  className,
  compact = false
}: QueueStatusIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!queueInfo && notifications.length === 0) {
    return null;
  }

  const latestNotification = notifications[notifications.length - 1];
  const displayInfo = queueInfo || {
    position: latestNotification?.position || 0,
    estimatedWaitTime: latestNotification?.estimatedWaitTime || 0,
    blockedBy: latestNotification?.blockedBy,
    operationType: latestNotification?.operationType || 'unknown'
  };

  // Check if the latest notification indicates operation is ready
  const isReady = latestNotification?.type === 'operation_ready';
  const hasError = latestNotification?.type === 'operation_blocked';

  const handleToggleExpand = () => {
    if (onExpand) {
      onExpand();
    } else {
      setIsExpanded(!isExpanded);
    }
  };

  if (compact) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleToggleExpand}
        className={cn(
          "h-8 px-3 gap-2",
          isReady && "border-green-500 text-green-700 bg-green-50",
          hasError && "border-red-500 text-red-700 bg-red-50",
          !isReady && !hasError && "border-orange-500 text-orange-700 bg-orange-50",
          className
        )}
        data-testid="button-queue-status-compact"
      >
        {isReady ? (
          <CheckCircle className="h-3 w-3" />
        ) : hasError ? (
          <AlertTriangle className="h-3 w-3" />
        ) : (
          <Loader2 className="h-3 w-3 animate-spin" />
        )}
        <span className="text-xs font-medium">
          {isReady ? 'Ready' : hasError ? 'Error' : `#${displayInfo.position}`}
        </span>
        {!isReady && !hasError && (
          <span className="text-xs text-muted-foreground">
            {formatWaitTime(displayInfo.estimatedWaitTime)}
          </span>
        )}
      </Button>
    );
  }

  return (
    <Card className={cn(
      "border-l-4 transition-colors",
      isReady && "border-l-green-500 bg-green-50/50",
      hasError && "border-l-red-500 bg-red-50/50", 
      !isReady && !hasError && "border-l-orange-500 bg-orange-50/50",
      className
    )}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {isReady ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : hasError ? (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
              )}
              <span className="font-medium text-sm">
                {getOperationLabel(displayInfo.operationType)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {isReady ? (
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Ready to Proceed
                </Badge>
              ) : hasError ? (
                <Badge variant="destructive">
                  Operation Error
                </Badge>
              ) : (
                <>
                  <Badge variant="outline">
                    Position #{displayInfo.position}
                  </Badge>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatWaitTime(displayInfo.estimatedWaitTime)} remaining
                  </div>
                </>
              )}
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleExpand}
            className="h-8 w-8 p-0"
            data-testid="button-queue-status-expand"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>

        {isExpanded && (
          <div className="mt-3 pt-3 border-t space-y-2">
            {displayInfo.blockedBy && (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">Blocked by:</span> {getOperationLabel(displayInfo.blockedBy)}
              </div>
            )}
            
            {notifications.length > 0 && (
              <div className="text-sm">
                <div className="font-medium mb-1">Recent Updates:</div>
                <div className="space-y-1">
                  {notifications.slice(-2).reverse().map((notification, index) => (
                    <div
                      key={index}
                      className="text-xs text-muted-foreground p-2 rounded bg-muted/50"
                    >
                      {notification.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onExpand?.()}
                data-testid="button-view-queue-details"
              >
                View Details
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}