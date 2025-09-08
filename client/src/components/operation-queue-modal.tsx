import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Clock, 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  Loader2, 
  X,
  Upload,
  Database,
  FileText
} from 'lucide-react';
import type { QueueNotification } from '@/hooks/use-websocket';

export interface QueueInfo {
  position: number;
  estimatedWaitTime: number;
  blockedBy?: string;
  operationType: string;
  queueId?: string;
}

interface OperationQueueModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queueInfo?: QueueInfo;
  notifications?: QueueNotification[];
  onCancel?: () => void;
  canCancel?: boolean;
}

const getOperationIcon = (operationType: string) => {
  switch (operationType) {
    case 'hotel_upload':
    case 'hotel_edit':
      return <Database className="h-5 w-5 text-blue-500" />;
    case 'coach_upload':
    case 'official_upload':
    case 'coaches_officials_batch':
      return <Users className="h-5 w-5 text-green-500" />;
    case 'player_upload':
    case 'player_edit':
      return <Users className="h-5 w-5 text-purple-500" />;
    case 'balance_recalculation':
    case 'occupancy_update':
      return <FileText className="h-5 w-5 text-orange-500" />;
    default:
      return <Upload className="h-5 w-5 text-gray-500" />;
  }
};

const getOperationLabel = (operationType: string) => {
  const labels: Record<string, string> = {
    'hotel_upload': 'Hotel Inventory Upload',
    'hotel_edit': 'Hotel Management',
    'coaches_officials_batch': 'Coaches & Officials Upload',
    'coach_upload': 'Coach Data Upload',
    'official_upload': 'Official Data Upload',
    'player_upload': 'Player Data Upload',
    'balance_recalculation': 'Balance Calculation',
    'occupancy_update': 'Occupancy Update',
    'participant_bulk_operations': 'Participant Operations'
  };
  return labels[operationType] || operationType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const getOperationPriority = (operationType: string): { level: number; color: string; label: string } => {
  const priorities: Record<string, { level: number; color: string; label: string }> = {
    'hotel_upload': { level: 1, color: 'destructive', label: 'Critical' },
    'hotel_edit': { level: 1, color: 'destructive', label: 'Critical' },
    'balance_window_creation': { level: 2, color: 'orange', label: 'High' },
    'balance_recalculation': { level: 3, color: 'yellow', label: 'Medium' },
    'coaches_officials_batch': { level: 4, color: 'blue', label: 'Normal' },
    'player_upload': { level: 5, color: 'gray', label: 'Low' }
  };
  return priorities[operationType] || { level: 99, color: 'gray', label: 'Standard' };
};

const formatWaitTime = (seconds: number): string => {
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours > 1 ? 's' : ''}`;
};

export default function OperationQueueModal({
  open,
  onOpenChange,
  queueInfo,
  notifications = [],
  onCancel,
  canCancel = true
}: OperationQueueModalProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every second for live countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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

  const priority = getOperationPriority(displayInfo.operationType);
  const progressValue = Math.max(0, Math.min(100, ((10 - displayInfo.position) / 10) * 100));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
            Operation Queued
          </DialogTitle>
          <DialogDescription>
            Your operation is waiting for other processes to complete
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Operation Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {getOperationIcon(displayInfo.operationType)}
                {getOperationLabel(displayInfo.operationType)}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant={priority.color === 'destructive' ? 'destructive' : 'secondary'}>
                  {priority.label} Priority
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Level {priority.level}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Queue Position</span>
                <Badge variant="outline" className="text-lg font-bold">
                  #{displayInfo.position}
                </Badge>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Estimated Wait Time</span>
                  <span className="text-sm text-muted-foreground">
                    {formatWaitTime(displayInfo.estimatedWaitTime)}
                  </span>
                </div>
                <Progress value={progressValue} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  Progress based on queue position
                </p>
              </div>

              {displayInfo.blockedBy && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Blocked by: <strong>{getOperationLabel(displayInfo.blockedBy)}</strong>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Recent Notifications */}
          {notifications.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Recent Updates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {notifications.slice(-3).reverse().map((notification, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 text-sm p-2 rounded-md bg-muted/50"
                    >
                      {notification.type === 'operation_ready' ? (
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                      ) : notification.type === 'operation_blocked' ? (
                        <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                      ) : (
                        <Clock className="h-4 w-4 text-blue-500 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{notification.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(notification.timestamp || currentTime).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            {canCancel && onCancel && (
              <Button
                variant="outline"
                onClick={onCancel}
                className="flex-1"
                data-testid="button-cancel-queue"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel Operation
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              data-testid="button-minimize-queue"
            >
              <Clock className="h-4 w-4 mr-2" />
              Minimize
            </Button>
          </div>

          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              You'll be notified when your operation is ready to proceed
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}