import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Bell, Send, Users, UserCheck, Award, Loader2 } from "lucide-react";
import { formatToIndianDate } from "@/../../shared/dateUtils";
import { CoachSelectionEnhanced } from "@/components/coach-selection-enhanced";

interface Team {
  teamName: string;
  coachId: string;
  discipline: string;
}

interface Discipline {
  discipline: string;
  count: number;
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
  },
  custom: {
    subject: "",
    message: ""
  }
};

export function SendNotificationEnhanced() {
  const [audienceType, setAudienceType] = useState<string>("");
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const [notificationType, setNotificationType] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [checkoutDate, setCheckoutDate] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("");
  
  // Enhanced coach selection states
  const [selectedCoaches, setSelectedCoaches] = useState<string[]>([]);
  const [includeTeamMembers, setIncludeTeamMembers] = useState(false);
  const [teamMembersCount, setTeamMembersCount] = useState<Record<string, number>>({});
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get teams for dropdown (for team-specific notifications)
  const { data: teams = [], isLoading: teamsLoading } = useQuery<Team[]>({
    queryKey: ["/api/admin/teams"],
  });

  // Get disciplines for selection
  const { data: disciplines = [], isLoading: disciplinesLoading } = useQuery<Discipline[]>({
    queryKey: ["/api/admin/disciplines"],
  });

  // Send notification mutation (general)
  const sendNotificationMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/admin/notifications/send-enhanced", data);
      return response.json();
    },
    onSuccess: (response: any) => {
      toast({
        title: "Success",
        description: `Notification sent to ${response.recipientCount || 'selected'} participants`,
      });
      // Reset form
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send notification",
        variant: "destructive",
      });
    },
  });

  // Send notification to selected coaches mutation
  const sendCoachNotificationMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/admin/notifications/send-to-coaches", data);
      return response.json();
    },
    onSuccess: (response: any) => {
      toast({
        title: "Success",
        description: `Notification sent to ${response.recipientCount} recipients`,
      });
      // Reset form
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send notification",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setAudienceType("");
    setSelectedDisciplines([]);
    setNotificationType("");
    setSubject("");
    setMessage("");
    setCheckoutDate("");
    setSelectedTeam("");
    setSelectedCoaches([]);
    setIncludeTeamMembers(false);
    setTeamMembersCount({});
  };

  const handleTypeChange = (type: string) => {
    setNotificationType(type);
    if (type && defaultMessages[type as keyof typeof defaultMessages]) {
      const template = defaultMessages[type as keyof typeof defaultMessages];
      setSubject(template.subject);
      setMessage(template.message);
    } else if (type === "custom") {
      // Clear the fields for custom messages so user can enter their own
      setSubject("");
      setMessage("");
    }
  };

  const handleAudienceChange = (audience: string) => {
    setAudienceType(audience);
    // Reset related fields when audience changes
    setSelectedDisciplines([]);
    setSelectedTeam("");
    setSelectedCoaches([]);
    setIncludeTeamMembers(false);
    setTeamMembersCount({});
  };

  const handleDisciplineToggle = (discipline: string) => {
    setSelectedDisciplines(prev => 
      prev.includes(discipline) 
        ? prev.filter(d => d !== discipline)
        : [...prev, discipline]
    );
  };

  const handleSendNotification = () => {
    if (!audienceType || !notificationType || !subject || !message) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (audienceType === "discipline_specific" && selectedDisciplines.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one discipline",
        variant: "destructive",
      });
      return;
    }

    // Validate coach selection for enhanced coach notifications
    if (audienceType === "coaches_only" && selectedCoaches.length > 0) {
      // Use enhanced coach selection
      const notificationData = {
        selectedCoaches,
        includeTeamMembers,
        notificationType,
        subject,
        message,
        checkoutDate: checkoutDate || null,
      };

      sendCoachNotificationMutation.mutate(notificationData);
      return;
    }

    // Use general notification system
    const notificationData = {
      audienceType,
      notificationType,
      subject,
      message,
      checkoutDate: checkoutDate || null,
      targetDisciplines: audienceType === "discipline_specific" ? selectedDisciplines : [],
      teamName: selectedTeam || null,
    };

    sendNotificationMutation.mutate(notificationData);
  };

  const getAudienceDescription = () => {
    switch (audienceType) {
      case "coaches_only":
        if (selectedCoaches.length > 0) {
          return `Message will be sent to ${selectedCoaches.length} selected coach${selectedCoaches.length !== 1 ? 'es' : ''}${includeTeamMembers ? ' and their team members' : ''}`;
        }
        return "Message will be sent to all team coaches only";
      case "all_participants":
        return "Message will be sent to all participants (coaches, officials, and players)";
      case "discipline_specific":
        return "Message will be sent to all participants in selected disciplines";
      default:
        return "Select an audience to see who will receive the message";
    }
  };

  const getRecipientCount = () => {
    if (!audienceType) return 0;
    
    switch (audienceType) {
      case "coaches_only":
        // If specific coaches are selected using enhanced selection
        if (selectedCoaches.length > 0) {
          let total = selectedCoaches.length; // Count selected coaches
          if (includeTeamMembers) {
            // Add team members count for each selected coach
            total += Object.values(teamMembersCount).reduce((sum, count) => sum + count, 0);
          }
          return total;
        }
        // Otherwise, show total available coaches
        return teams.length;
      case "all_participants":
        return disciplines.reduce((sum, d) => sum + d.count, 0);
      case "discipline_specific":
        return disciplines
          .filter(d => selectedDisciplines.includes(d.discipline))
          .reduce((sum, d) => sum + d.count, 0);
      default:
        return 0;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Send Notification
        </CardTitle>
        <CardDescription>
          Send notifications to coaches, players, or specific disciplines about match results, checkout dates, or general updates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Audience Selection */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Select Audience *</Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card 
              className={`cursor-pointer transition-all ${
                audienceType === "coaches_only" 
                  ? "ring-2 ring-primary bg-primary/5" 
                  : "hover:bg-gray-50"
              }`}
              onClick={() => handleAudienceChange("coaches_only")}
              data-testid="audience-coaches-only"
            >
              <CardContent className="p-4 text-center">
                <UserCheck className="h-8 w-8 mx-auto mb-2 text-primary" />
                <h3 className="font-medium">Coaches Only</h3>
                <p className="text-sm text-gray-500 mt-1">Team coaches</p>
                <p className="text-xs text-primary mt-2">{teams.length} recipients</p>
              </CardContent>
            </Card>

            <Card 
              className={`cursor-pointer transition-all ${
                audienceType === "all_participants" 
                  ? "ring-2 ring-primary bg-primary/5" 
                  : "hover:bg-gray-50"
              }`}
              onClick={() => handleAudienceChange("all_participants")}
              data-testid="audience-all-participants"
            >
              <CardContent className="p-4 text-center">
                <Users className="h-8 w-8 mx-auto mb-2 text-primary" />
                <h3 className="font-medium">All Participants</h3>
                <p className="text-sm text-gray-500 mt-1">Everyone</p>
                <p className="text-xs text-primary mt-2">
                  {disciplines.reduce((sum, d) => sum + d.count, 0)} recipients
                </p>
              </CardContent>
            </Card>

            <Card 
              className={`cursor-pointer transition-all ${
                audienceType === "discipline_specific" 
                  ? "ring-2 ring-primary bg-primary/5" 
                  : "hover:bg-gray-50"
              }`}
              onClick={() => handleAudienceChange("discipline_specific")}
              data-testid="audience-discipline-specific"
            >
              <CardContent className="p-4 text-center">
                <Award className="h-8 w-8 mx-auto mb-2 text-primary" />
                <h3 className="font-medium">By Discipline</h3>
                <p className="text-sm text-gray-500 mt-1">Select sports</p>
                <p className="text-xs text-primary mt-2">Custom selection</p>
              </CardContent>
            </Card>
          </div>
          
          <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
            {getAudienceDescription()}
            {audienceType && (
              <span className="font-medium ml-1">
                ({getRecipientCount()} recipients)
              </span>
            )}
          </div>
        </div>

        {/* Discipline Selection (when discipline_specific is selected) */}
        {audienceType === "discipline_specific" && (
          <div className="space-y-3">
            <Label className="text-base font-medium">Select Disciplines *</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {disciplines.map((discipline) => (
                <div
                  key={discipline.discipline}
                  className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50"
                >
                  <Checkbox
                    id={`discipline-${discipline.discipline}`}
                    checked={selectedDisciplines.includes(discipline.discipline)}
                    onCheckedChange={() => handleDisciplineToggle(discipline.discipline)}
                    data-testid={`checkbox-discipline-${discipline.discipline}`}
                  />
                  <Label 
                    htmlFor={`discipline-${discipline.discipline}`}
                    className="text-sm cursor-pointer flex-1"
                  >
                    {discipline.discipline}
                    <span className="text-gray-500 ml-1">({discipline.count})</span>
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Enhanced Coach Selection (when coaches_only is selected) */}
        {audienceType === "coaches_only" && (
          <CoachSelectionEnhanced
            selectedCoaches={selectedCoaches}
            onCoachesChange={setSelectedCoaches}
            includeTeamMembers={includeTeamMembers}
            onIncludeTeamMembersChange={setIncludeTeamMembers}
            onTeamMembersCountChange={setTeamMembersCount}
          />
        )}

        {/* Message Type Selection */}
        {audienceType && (
          <div className="space-y-3">
            <Label htmlFor="notification-type" className="text-base font-medium">
              Message Type *
            </Label>
            <Select value={notificationType} onValueChange={handleTypeChange}>
              <SelectTrigger data-testid="select-notification-type">
                <SelectValue placeholder="Select message type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General Update</SelectItem>
                <SelectItem value="match_lost">Match Result - Early Checkout</SelectItem>
                <SelectItem value="early_checkout">Early Checkout Request</SelectItem>
                <SelectItem value="custom">Custom Message</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Message Content */}
        {notificationType && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="subject" className="text-base font-medium">Subject *</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter notification subject"
                className="mt-1"
                data-testid="input-subject"
              />
            </div>

            <div>
              <Label htmlFor="message" className="text-base font-medium">Message *</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter your message"
                rows={4}
                className="mt-1"
                data-testid="textarea-message"
              />
            </div>

            {(notificationType === "match_lost" || notificationType === "early_checkout") && (
              <div>
                <Label htmlFor="checkout-date" className="text-base font-medium">
                  Checkout Date {notificationType === "match_lost" ? "*" : "(Optional)"}
                </Label>
                <Input
                  id="checkout-date"
                  type="date"
                  value={checkoutDate}
                  onChange={(e) => setCheckoutDate(e.target.value)}
                  className="mt-1"
                  data-testid="input-checkout-date"
                />
                {checkoutDate && (
                  <p className="text-sm text-gray-500 mt-1">
                    Checkout date will be formatted as: {formatToIndianDate(checkoutDate)}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Send Button */}
        {notificationType && subject && message && audienceType && (
          <div className="pt-4 border-t">
            <Button
              onClick={handleSendNotification}
              disabled={sendNotificationMutation.isPending}
              className="w-full"
              size="lg"
              data-testid="button-send-notification"
            >
              {sendNotificationMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send to {getRecipientCount()} Recipients
                </>
              )}
            </Button>
          </div>
        )}


      </CardContent>
    </Card>
  );
}