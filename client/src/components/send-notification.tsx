import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Bell, Send } from "lucide-react";

interface Team {
  teamName: string;
  coachId: string;
}

const defaultMessages = {
  match_lost: {
    subject: "Match Result Update - Checkout Date Revised",
    message: "As your match has concluded, we kindly inform you that your final checkout date at the hotel will be: {checkoutDate}. Please ensure that you vacate your rooms before this time. Please be aware that any stay beyond the scheduled check-out time without prior authorization will be responsible for any additional hotel charges. Thank you for your cooperation."
  },
  early_checkout: {
    subject: "Early Checkout Request",
    message: "Due to schedule changes, please check out by {checkoutDate}. Contact admin if you need assistance."
  },
  general: {
    subject: "Important Update",
    message: "Please check your accommodation details and ensure all information is correct."
  }
};

export function SendNotification() {
  const [selectedTeam, setSelectedTeam] = useState("");
  const [notificationType, setNotificationType] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [checkoutDate, setCheckoutDate] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get teams for dropdown
  const { data: teams = [], isLoading: teamsLoading } = useQuery<Team[]>({
    queryKey: ["/api/admin/teams"],
  });

  // Send notification mutation
  const sendNotificationMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/admin/notifications/send", "POST", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Notification sent successfully",
      });
      // Reset form
      setSelectedTeam("");
      setNotificationType("");
      setSubject("");
      setMessage("");
      setCheckoutDate("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send notification",
        variant: "destructive",
      });
    },
  });

  const handleTypeChange = (type: string) => {
    setNotificationType(type);
    if (type in defaultMessages) {
      const template = defaultMessages[type as keyof typeof defaultMessages];
      setSubject(template.subject);
      setMessage(template.message);
    } else {
      setSubject("");
      setMessage("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTeam || !notificationType || !subject || !message) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const selectedTeamData = teams.find(t => t.coachId === selectedTeam);
    if (!selectedTeamData) {
      toast({
        title: "Error",
        description: "Selected team not found",
        variant: "destructive",
      });
      return;
    }

    // Replace placeholder in message
    let finalMessage = message;
    if (checkoutDate && message.includes('{checkoutDate}')) {
      const formattedDate = new Date(checkoutDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      finalMessage = message.replace('{checkoutDate}', formattedDate);
    }

    sendNotificationMutation.mutate({
      toCoachId: selectedTeam,
      teamName: selectedTeamData.teamName,
      notificationType,
      subject,
      message: finalMessage,
      checkoutDate: checkoutDate || undefined,
    });
  };

  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Send Notifications to Team Leaders
        </CardTitle>
        <CardDescription>
          Send notifications to team coaches about match results, checkout dates, or general updates
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Team Selection */}
          <div className="space-y-2">
            <Label htmlFor="team">Select Team</Label>
            <Select value={selectedTeam} onValueChange={setSelectedTeam} data-testid="select-team">
              <SelectTrigger>
                <SelectValue placeholder="Choose a team..." />
              </SelectTrigger>
              <SelectContent>
                {teamsLoading ? (
                  <SelectItem value="loading" disabled>Loading teams...</SelectItem>
                ) : teams.length === 0 ? (
                  <SelectItem value="no-teams" disabled>No teams available</SelectItem>
                ) : (
                  teams.map((team) => (
                    <SelectItem key={team.coachId} value={team.coachId}>
                      {team.teamName}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Reason/Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason/Type</Label>
            <Select value={notificationType} onValueChange={handleTypeChange} data-testid="select-notification-type">
              <SelectTrigger>
                <SelectValue placeholder="Select notification reason..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="match_lost">Match Lost</SelectItem>
                <SelectItem value="early_checkout">Early Checkout</SelectItem>
                <SelectItem value="general">General Update</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Checkout Date (for relevant notification types) */}
          {(notificationType === "match_lost" || notificationType === "early_checkout") && (
            <div className="space-y-2">
              <Label htmlFor="checkout-date">Check out Message</Label>
              <Input
                id="checkout-date"
                type="datetime-local"
                value={checkoutDate}
                onChange={(e) => setCheckoutDate(e.target.value)}
                data-testid="input-checkout-date"
              />
            </div>
          )}

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter notification subject..."
              data-testid="input-subject"
            />
          </div>

          {/* Custom Message */}
          <div className="space-y-2">
            <Label htmlFor="message">
              {notificationType === "custom" ? "Custom Message" : "Message Preview"}
            </Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter your custom message..."
              rows={6}
              data-testid="textarea-message"
            />
            {(notificationType === "match_lost" || notificationType === "early_checkout") && (
              <p className="text-sm text-muted-foreground">
                Use {"{checkoutDate}"} to insert the checkout date automatically
              </p>
            )}
          </div>

          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full" 
            disabled={sendNotificationMutation.isPending}
            data-testid="button-send-notification"
          >
            {sendNotificationMutation.isPending ? (
              "Sending..."
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Notification
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}