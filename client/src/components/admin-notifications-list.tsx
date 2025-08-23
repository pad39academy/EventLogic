import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, Clock, CheckCircle, AlertTriangle, Users, UserCheck, Award } from "lucide-react";
import { format } from "date-fns";

interface AdminNotification {
  id: string;
  fromUserId: string;
  subject: string;
  message: string;
  notificationType: "match_lost" | "early_checkout" | "custom" | "general";
  audienceType: "coaches_only" | "all_participants" | "discipline_specific";
  targetDisciplines: string[];
  checkoutDate?: string;
  sentAt: string;
  recipientCount: number;
  readCount: number;
  unreadCount: number;
  recipients: string[];
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "match_lost":
      return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    case "early_checkout":
      return <Clock className="h-4 w-4 text-blue-500" />;
    case "general":
      return <Bell className="h-4 w-4 text-gray-500" />;
    case "custom":
      return <Bell className="h-4 w-4 text-purple-500" />;
    default:
      return <Bell className="h-4 w-4 text-gray-500" />;
  }
};

const getAudienceIcon = (type: string) => {
  switch (type) {
    case "coaches_only":
      return <UserCheck className="h-4 w-4 text-blue-500" />;
    case "all_participants":
      return <Users className="h-4 w-4 text-green-500" />;
    case "discipline_specific":
      return <Award className="h-4 w-4 text-purple-500" />;
    default:
      return <Users className="h-4 w-4 text-gray-500" />;
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
      return "Custom Message";
    default:
      return "Notification";
  }
};

const getAudienceLabel = (type: string) => {
  switch (type) {
    case "coaches_only":
      return "Coaches Only";
    case "all_participants":
      return "All Participants";
    case "discipline_specific":
      return "By Discipline";
    default:
      return "Unknown";
  }
};

export function AdminNotificationsList() {
  // Get all sent notifications for admin
  const { data: notifications = [], isLoading, error } = useQuery<AdminNotification[]>({
    queryKey: ["/api/admin/notifications"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Sent Notifications
          </CardTitle>
          <CardDescription>
            View all notifications sent to coaches and participants
          </CardDescription>
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
            Sent Notifications
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

  if (notifications.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Sent Notifications
          </CardTitle>
          <CardDescription>
            View all notifications sent to coaches and participants
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No notifications sent yet</p>
            <p className="text-sm text-gray-500 mt-1">
              Notifications you send will appear here with delivery status
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Sent Notifications
        </CardTitle>
        <CardDescription>
          View all notifications sent to coaches and participants ({notifications.length} total)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {notifications.map((notification) => (
            <Card key={notification.id} className="border-l-4 border-l-blue-500" data-testid={`admin-notification-${notification.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    {getNotificationIcon(notification.notificationType)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {getNotificationTypeLabel(notification.notificationType)}
                        </Badge>
                        <div className="flex items-center gap-1">
                          {getAudienceIcon(notification.audienceType)}
                          <Badge variant="secondary" className="text-xs">
                            {getAudienceLabel(notification.audienceType)}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(notification.sentAt), "MMM d, yyyy 'at' h:mm a")}
                        </span>
                      </div>
                      
                      <h4 className="font-medium text-sm mb-2">{notification.subject}</h4>
                      
                      <div className="bg-gray-50 dark:bg-gray-900/20 border rounded-lg p-3 mb-3">
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {notification.message}
                        </p>
                        {notification.checkoutDate && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 font-medium">
                            Checkout Date: {format(new Date(notification.checkoutDate), "MMM d, yyyy")}
                          </p>
                        )}
                        {notification.targetDisciplines && notification.targetDisciplines.length > 0 && (
                          <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                            Disciplines: {notification.targetDisciplines.join(", ")}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-blue-500" />
                          <span className="font-medium">{notification.recipientCount}</span>
                          <span className="text-muted-foreground">recipients</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="font-medium">{notification.readCount}</span>
                          <span className="text-muted-foreground">read</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-orange-500" />
                          <span className="font-medium">{notification.unreadCount}</span>
                          <span className="text-muted-foreground">unread</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}