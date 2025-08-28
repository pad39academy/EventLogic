import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Bell, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { formatToIndianDate } from "@/../../shared/dateUtils";

interface Notification {
  id: string;
  fromUserId: string;
  toCoachId: string;
  teamName: string;
  notificationType: "match_lost" | "early_checkout" | "custom" | "general";
  subject: string;
  message: string;
  checkoutDate?: string;
  status: "unread" | "read";
  sentAt: string;
  readAt?: string;
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "match_lost":
      return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    case "early_checkout":
      return <Clock className="h-4 w-4 text-blue-500" />;
    case "general":
      return <Bell className="h-4 w-4 text-gray-500" />;
    default:
      return <Bell className="h-4 w-4 text-gray-500" />;
  }
};

const getNotificationTypeLabel = (type: string) => {
  switch (type) {
    case "match_lost":
      return "Match Result";
    case "early_checkout":
      return "Early Checkout";
    case "general":
      return "General Update";
    case "custom":
      return "Custom";
    default:
      return "Notification";
  }
};

export function NotificationsList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get notifications for current coach
  const { data: notifications = [], isLoading, error } = useQuery<Notification[]>({
    queryKey: ["/api/coach/notifications"],
  });

  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest("POST", `/api/coach/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coach/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coach/notifications/unread-count"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark notification as read",
        variant: "destructive",
      });
    },
  });

  const handleMarkAsRead = (notificationId: string) => {
    markAsReadMutation.mutate(notificationId);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Messages from Admin
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading notifications...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Messages from Admin
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600">Failed to load notifications</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const unreadNotifications = notifications.filter(n => n.status === "unread");
  const readNotifications = notifications.filter(n => n.status === "read");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Messages from Admin
            {unreadNotifications.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadNotifications.length} new
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Important updates and notifications about your accommodation and team
          </CardDescription>
        </CardHeader>
      </Card>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No notifications yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              You'll receive important updates from the admin here
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Unread Notifications */}
          {unreadNotifications.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-red-600">Unread Messages</h3>
              {unreadNotifications.map((notification) => (
                <Card key={notification.id} className="border-red-200 bg-red-50 dark:bg-red-950/10" data-testid={`notification-unread-${notification.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        {getNotificationIcon(notification.notificationType)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">
                              {getNotificationTypeLabel(notification.notificationType)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatToIndianDate(notification.sentAt)} at {new Date(notification.sentAt).toLocaleTimeString('en-IN')}
                            </span>
                          </div>
                          <h4 className="font-medium text-sm mb-2">{notification.subject}</h4>
                          <div className="bg-orange-100 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                            <p className="text-sm text-orange-800 dark:text-orange-200 whitespace-pre-wrap">
                              {notification.message}
                            </p>
                            {notification.checkoutDate && (
                              <p className="text-xs text-orange-600 dark:text-orange-300 mt-2 font-medium">
                                Checkout Date: {formatToIndianDate(notification.checkoutDate)} at {new Date(notification.checkoutDate).toLocaleTimeString('en-IN')}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleMarkAsRead(notification.id)}
                        disabled={markAsReadMutation.isPending}
                        data-testid={`button-mark-read-${notification.id}`}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Mark as Read
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Read Notifications */}
          {readNotifications.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-muted-foreground">Previous Messages</h3>
              {readNotifications.map((notification) => (
                <Card key={notification.id} className="opacity-75" data-testid={`notification-read-${notification.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      {getNotificationIcon(notification.notificationType)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="secondary" className="text-xs">
                            {getNotificationTypeLabel(notification.notificationType)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatToIndianDate(notification.sentAt)} at {new Date(notification.sentAt).toLocaleTimeString('en-IN')}
                          </span>
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          <span className="text-xs text-green-600">Read</span>
                        </div>
                        <h4 className="font-medium text-sm mb-2">{notification.subject}</h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {notification.message}
                        </p>
                        {notification.checkoutDate && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Checkout Date: {formatToIndianDate(notification.checkoutDate)} at {new Date(notification.checkoutDate).toLocaleTimeString('en-IN')}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}