import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Create schemas based on participant role
const playerUpdateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  mobileNumber: z.string().optional(),
  teamName: z.string().optional(),
  coachId: z.string().optional(),
  hotelId: z.string().min(1, "Hotel assignment is required"),
  stadium: z.string().optional(),
  changeReason: z.string().optional(),
});

const coachUpdateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  mobileNumber: z.string().optional(),
  discipline: z.string().min(1, "Discipline is required"),
  district: z.string().min(1, "District is required"),
  location: z.string().min(1, "Location is required"),
  hotelId: z.string().min(1, "Hotel assignment is required"),
  travelPocName: z.string().optional(),
  travelPocMobile: z.string().optional(),
  venuePocName: z.string().optional(),
  venuePocMobile: z.string().optional(),
  notifyTransport: z.string().optional(),
  changeReason: z.string().optional(),
});

const officialUpdateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  mobileNumber: z.string().optional(),
  discipline: z.string().min(1, "Discipline is required"),
  district: z.string().min(1, "District is required"),
  location: z.string().min(1, "Location is required"),
  hotelId: z.string().min(1, "Hotel assignment is required"),
  notifyTransport: z.string().optional(),
  changeReason: z.string().optional(),
});

type PlayerFormData = z.infer<typeof playerUpdateSchema>;
type CoachFormData = z.infer<typeof coachUpdateSchema>;
type OfficialFormData = z.infer<typeof officialUpdateSchema>;

interface Participant {
  id: string;
  participantId: string;
  name: string;
  mobileNumber: string | null;
  role: "player" | "coach" | "official";
  discipline: string | null;
  district: string | null;
  location: string | null;
  teamName: string | null;
  coachId: string | null;
  hotelId: string;
  hotelName: string | null;
  stadium: string | null;
  travelPocName: string | null;
  travelPocMobile: string | null;
  venuePocName: string | null;
  venuePocMobile: string | null;
  notifyTransport: string | null;
}

interface Hotel {
  id: string;
  hotelName: string;
  location: string;
  district: string;
  availableRooms: number;
}

interface Coach {
  coachId: string;
  name: string;
  discipline: string;
}

interface EditParticipantModalProps {
  participant: Participant | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EditParticipantModal({ participant, isOpen, onClose }: EditParticipantModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showReasonField, setShowReasonField] = useState(false);

  // Get schema based on role
  const getSchema = () => {
    if (!participant) return playerUpdateSchema;
    switch (participant.role) {
      case "coach": return coachUpdateSchema;
      case "official": return officialUpdateSchema;
      default: return playerUpdateSchema;
    }
  };

  const form = useForm<PlayerFormData | CoachFormData | OfficialFormData>({
    resolver: zodResolver(getSchema()),
    defaultValues: {},
  });

  // Reset form when participant changes
  useEffect(() => {
    if (participant) {
      const defaultValues: any = {
        name: participant.name || "",
        mobileNumber: participant.mobileNumber || "",
        hotelId: participant.hotelId || "",
        changeReason: "",
      };

      if (participant.role === "player") {
        defaultValues.teamName = participant.teamName || "";
        defaultValues.coachId = participant.coachId || "";
        defaultValues.stadium = participant.stadium || "";
      } else if (participant.role === "coach") {
        defaultValues.discipline = participant.discipline || "";
        defaultValues.district = participant.district || "";
        defaultValues.location = participant.location || "";
        defaultValues.travelPocName = participant.travelPocName || "";
        defaultValues.travelPocMobile = participant.travelPocMobile || "";
        defaultValues.venuePocName = participant.venuePocName || "";
        defaultValues.venuePocMobile = participant.venuePocMobile || "";
        defaultValues.notifyTransport = participant.notifyTransport || "";
      } else if (participant.role === "official") {
        defaultValues.discipline = participant.discipline || "";
        defaultValues.district = participant.district || "";
        defaultValues.location = participant.location || "";
        defaultValues.notifyTransport = participant.notifyTransport || "";
      }

      form.reset(defaultValues);
      setShowReasonField(false);
    }
  }, [participant, form]);

  // Watch hotel ID changes to show reason field
  const watchedHotelId = form.watch("hotelId");
  useEffect(() => {
    if (participant && watchedHotelId && watchedHotelId !== participant.hotelId) {
      setShowReasonField(true);
    } else {
      setShowReasonField(false);
      form.setValue("changeReason", "");
    }
  }, [watchedHotelId, participant, form]);

  // Get available hotels
  const { data: availableHotels = [] } = useQuery({
    queryKey: ["/api/admin/available-hotels"],
    enabled: isOpen,
  });

  // Get coaches for player role
  const { data: coaches = [] } = useQuery({
    queryKey: ["/api/admin/dashboard/participants", { role: "coach" }],
    queryFn: async () => {
      const response = await fetch("/api/admin/dashboard/participants?role=coach", {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch coaches');
      const data = await response.json();
      return data.data || [];
    },
    enabled: isOpen && participant?.role === "player",
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: PlayerFormData | CoachFormData | OfficialFormData) => {
      if (!participant) throw new Error("No participant selected");
      
      // Validate change reason if hotel changed
      if (showReasonField && (!data.changeReason || !data.changeReason.trim())) {
        throw new Error("Change reason is required when updating hotel assignment");
      }

      const response = await fetch(`/api/admin/participants/${participant.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update participant');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Participant updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard/participants"] });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update participant",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PlayerFormData | CoachFormData | OfficialFormData) => {
    updateMutation.mutate(data);
  };

  if (!participant) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-participant">
        <DialogHeader>
          <DialogTitle>
            Edit {participant.role.charAt(0).toUpperCase() + participant.role.slice(1)} - {participant.participantId}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Common fields for all roles */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="mobileNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mobile Number</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-mobile" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Role-specific fields */}
            {participant.role === "player" && (
              <>
                <FormField
                  control={form.control}
                  name="teamName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Team Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-team-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="coachId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Coach</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-coach">
                            <SelectValue placeholder="Select coach" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {coaches.map((coach: Coach) => (
                            <SelectItem key={coach.coachId} value={coach.coachId}>
                              {coach.name} ({coach.discipline})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="stadium"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stadium/Venue</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-stadium" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {(participant.role === "coach" || participant.role === "official") && (
              <>
                <FormField
                  control={form.control}
                  name="discipline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discipline</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-discipline" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="district"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>District</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-district" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-location" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notifyTransport"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transport Contact</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-transport" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {participant.role === "coach" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="travelPocName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Travel POC Name</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-travel-poc-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="travelPocMobile"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Travel POC Mobile</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-travel-poc-mobile" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="venuePocName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Venue POC Name</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-venue-poc-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="venuePocMobile"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Venue POC Mobile</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-venue-poc-mobile" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}

            {/* Hotel assignment */}
            <FormField
              control={form.control}
              name="hotelId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hotel Assignment</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-hotel">
                        <SelectValue placeholder="Select hotel" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {/* Current hotel option */}
                      {participant.hotelId && (
                        <SelectItem key={participant.hotelId} value={participant.hotelId}>
                          {participant.hotelName} (Current)
                        </SelectItem>
                      )}
                      
                      {/* Available hotels */}
                      {availableHotels
                        .filter((hotel: any) => hotel.id !== participant.hotelId)
                        .map((hotel: any) => (
                          <SelectItem key={hotel.id} value={hotel.id}>
                            {hotel.hotelName} - {hotel.location} ({hotel.availableRooms} rooms available)
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Change reason field - only shown when hotel is changed */}
            {showReasonField && (
              <FormField
                control={form.control}
                name="changeReason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason for Hotel Change *</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Please provide a reason for the hotel change..."
                        data-testid="textarea-change-reason"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateMutation.isPending}
                data-testid="button-save"
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}