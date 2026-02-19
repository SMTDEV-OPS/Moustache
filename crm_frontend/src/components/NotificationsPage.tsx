import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Bell,
  Users,
  Clock,
  AlertTriangle,
  Mail,
  CheckCircle2,
  CheckCheck,
  ArrowRight,
  Loader2,
} from "lucide-react";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  Notification,
  NotificationType,
} from "@/services/notifications";

interface NotificationsPageProps {
  onViewLead?: (leadId: string) => void;
}

const NotificationsPage = ({ onViewLead }: NotificationsPageProps = { onViewLead: undefined }) => {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [markingAllAsRead, setMarkingAllAsRead] = useState(false);

  useEffect(() => {
    void loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await getNotifications({ limit: 100 });
      setNotifications(response.notifications);
      setUnreadCount(response.notifications.filter((n) => !n.isRead).length);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load notifications",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markAsRead(notificationId);
      await loadNotifications();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to mark notification as read",
        variant: "destructive",
      });
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setMarkingAllAsRead(true);
      await markAllAsRead();
      toast({
        title: "Success",
        description: "All notifications marked as read",
      });
      await loadNotifications();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to mark all notifications as read",
        variant: "destructive",
      });
    } finally {
      setMarkingAllAsRead(false);
    }
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case NotificationType.LEAD_ASSIGNED:
      case NotificationType.LEAD_REASSIGNED:
        return Users;
      case NotificationType.TASK_ASSIGNED:
      case NotificationType.WORKFLOW_REMINDER:
        return Clock;
      case NotificationType.LEAD_STATUS_CHANGED:
        return AlertTriangle;
      case NotificationType.WORKFLOW_AUTO_SENT:
        return Mail;
      case NotificationType.GENERAL:
        return CheckCircle2;
      default:
        return Bell;
    }
  };

  const getNotificationColor = (type: NotificationType) => {
    switch (type) {
      case NotificationType.LEAD_ASSIGNED:
      case NotificationType.LEAD_REASSIGNED:
        return "bg-blue-50 text-blue-600 border-blue-200";
      case NotificationType.TASK_ASSIGNED:
      case NotificationType.WORKFLOW_REMINDER:
        return "bg-amber-50 text-amber-600 border-amber-200";
      case NotificationType.LEAD_STATUS_CHANGED:
        return "bg-orange-50 text-orange-600 border-orange-200";
      case NotificationType.WORKFLOW_AUTO_SENT:
        return "bg-purple-50 text-purple-600 border-purple-200";
      case NotificationType.GENERAL:
        return "bg-emerald-50 text-emerald-600 border-emerald-200";
      default:
        return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await handleMarkAsRead(notification.id);
    }
    // Navigate to lead if metadata contains leadId
    if (notification.metadata?.leadId && onViewLead) {
      onViewLead(notification.metadata.leadId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Notifications</h1>
          <p className="text-slate-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notifications` : "All caught up!"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            onClick={handleMarkAllAsRead}
            disabled={markingAllAsRead}
            className="border-slate-200"
          >
            {markingAllAsRead ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Marking...
              </>
            ) : (
              <>
                <CheckCheck className="h-4 w-4 mr-2" />
                Mark All as Read
              </>
            )}
          </Button>
        )}
      </div>

      {/* Notifications List */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400 mb-4" />
              <p className="text-sm text-slate-500">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Bell className="h-12 w-12 text-slate-300 mb-4" />
              <p className="text-slate-500 font-medium">No notifications yet</p>
              <p className="text-sm text-slate-400 mt-1">You're all caught up!</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((notification) => {
                const Icon = getNotificationIcon(notification.type);
                const colorClass = getNotificationColor(notification.type);

                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors ${
                      !notification.isRead ? "bg-blue-50/30" : ""
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 border ${colorClass}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4
                            className={`font-medium ${
                              !notification.isRead ? "text-slate-900" : "text-slate-600"
                            }`}
                          >
                            {notification.title}
                          </h4>
                          {!notification.isRead && (
                            <Badge className="bg-emerald-500 text-white text-xs px-1.5 py-0">
                              New
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-600">{notification.message}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {new Date(notification.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {notification.metadata?.leadId && (
                        <ArrowRight className="h-4 w-4 text-slate-400 flex-shrink-0 mt-1" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationsPage;

