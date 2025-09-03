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
  bookingStartDate: z.string().min(1, "Start date is required"),
  bookingEndDate: z.string().min(1, "End date is required"),
  bookingReference: z.string().min(1, "Booking reference is required"),
  changeReason: z.string().optional(),
}).refine((data) => {
  const startDate = new Date(data.bookingStartDate);
  const endDate = new Date(data.bookingEndDate);
  const diffTime = endDate.getTime() - startDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays >= 3;
}, {
  message: "Booking must be at least 3 days",
  path: ["bookingEndDate"],
}).refine((data) => {
  const startDate = new Date(data.bookingStartDate);
  const endDate = new Date(data.bookingEndDate);
  return endDate > startDate;
}, {
  message: "End date must be after start date",
  path: ["bookingEndDate"],
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
  bookingStartDate: string;
  bookingEndDate: string;
  bookingReference: string;
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
  suggestedDates?: {
    start: Date;
    end: Date;
  };
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
  const [hotelSuggestion, setHotelSuggestion] = useState<string | null>(null);
  const [dateSuggestion, setDateSuggestion] = useState<{ start: Date; end: Date } | null>(null);

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
        defaultValues.bookingStartDate = participant.bookingStartDate ? new Date(participant.bookingStartDate).toISOString().split('T')[0] : "";
        defaultValues.bookingEndDate = participant.bookingEndDate ? new Date(participant.bookingEndDate).toISOString().split('T')[0] : "";
        defaultValues.bookingReference = participant.bookingReference || "";
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

  // Watch form values for smart hotel/date logic
  const watchedStartDate = form.watch("bookingStartDate");
  const watchedEndDate = form.watch("bookingEndDate");
  const watchedHotelId = form.watch("hotelId");

  // Show reason field when hotel changes
  useEffect(() => {
    if (participant && watchedHotelId && watchedHotelId !== participant.hotelId) {
      setShowReasonField(true);
    } else {
      setShowReasonField(false);
      form.setValue("changeReason", "");
    }
  }, [watchedHotelId, participant, form]);

  // Smart logic: Check for date/hotel conflicts and suggestions
  useEffect(() => {
    if (!participant || participant.role !== "player" || !watchedStartDate || !watchedEndDate) {
      setHotelSuggestion(null);
      setDateSuggestion(null);
      return;
    }

    // Check if current hotel is available for selected dates
    const currentHotel = availableHotels.find((hotel: any) => hotel.id === watchedHotelId);
    
    if (currentHotel && currentHotel.availableRooms === 0 && currentHotel.suggestedDates) {
      // Hotel not available for selected dates, suggest alternative dates
      setDateSuggestion(currentHotel.suggestedDates);
      setHotelSuggestion(null);
    } else if (watchedHotelId && !availableHotels.find((hotel: any) => hotel.id === watchedHotelId)) {
      // Selected hotel not available at all for these dates
      const alternativeHotel = availableHotels.find((hotel: any) => hotel.availableRooms > 0);
      if (alternativeHotel) {
        setHotelSuggestion(`Consider ${alternativeHotel.hotelName} - ${alternativeHotel.location} (${alternativeHotel.availableRooms} rooms available)`);
      }
      setDateSuggestion(null);
    } else {
      setHotelSuggestion(null);
      setDateSuggestion(null);
    }
  }, [availableHotels, watchedHotelId, watchedStartDate, watchedEndDate, participant]);

  // Auto-suggest when dates are changed and hotel becomes unavailable
  useEffect(() => {
    if (!participant || participant.role !== "player" || !watchedStartDate || !watchedEndDate) return;
    
    // If current hotel is not available for new dates, clear hotel selection
    if (watchedHotelId && !availableHotels.find((hotel: any) => hotel.id === watchedHotelId && hotel.availableRooms > 0)) {
      form.setValue("hotelId", "");
    }
  }, [watchedStartDate, watchedEndDate, availableHotels, watchedHotelId, form, participant]);

  // Get available hotels based on selected dates
  const { data: availableHotels = [], refetch: refetchHotels } = useQuery({
    queryKey: ["/api/admin/available-hotels", watchedStartDate, watchedEndDate, participant?.id],
    queryFn: async () => {
      if (!watchedStartDate || !watchedEndDate) {
        // No dates selected, get general available hotels
        const response = await fetch("/api/admin/available-hotels", {
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to fetch hotels');
        return response.json();
      }
      
      // Get hotels available for specific dates
      const params = new URLSearchParams({
        startDate: watchedStartDate,
        endDate: watchedEndDate,
        ...(participant?.id && { excludeParticipantId: participant.id })
      });
      
      const response = await fetch(`/api/admin/available-hotels?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch hotels');
      return response.json();
    },
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

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="bookingStartDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Booking Start Date</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="date" 
                            data-testid="input-booking-start-date" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bookingEndDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Booking End Date</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="date" 
                            data-testid="input-booking-end-date" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="bookingReference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Booking Reference</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-booking-reference" />
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
                        <SelectValue placeholder={participant.role === "player" && (!watchedStartDate || !watchedEndDate) ? "Select dates first" : "Select hotel"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {/* Current hotel option (only if available for dates) */}
                      {participant.hotelId && availableHotels.find((hotel: any) => hotel.id === participant.hotelId && hotel.availableRooms > 0) && (
                        <SelectItem key={participant.hotelId} value={participant.hotelId}>
                          {participant.hotelName} (Current)
                        </SelectItem>
                      )}
                      
                      {/* Available hotels */}
                      {availableHotels
                        .filter((hotel: any) => hotel.availableRooms > 0 && hotel.id !== participant.hotelId)
                        .map((hotel: any) => (
                          <SelectItem key={hotel.id} value={hotel.id}>
                            {hotel.hotelName} - {hotel.location} ({hotel.availableRooms} rooms available)
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                  
                  {/* Show suggestions */}
                  {hotelSuggestion && (
                    <div className="text-sm text-blue-600 mt-1">
                      💡 {hotelSuggestion}
                    </div>
                  )}
                  
                  {dateSuggestion && (
                    <div className="text-sm text-orange-600 mt-1">
                      💡 Hotel available from {new Date(dateSuggestion.start).toLocaleDateString()} to {new Date(dateSuggestion.end).toLocaleDateString()}
                      <Button 
                        type="button" 
                        variant="link" 
                        size="sm"
                        className="p-0 h-auto ml-2 text-orange-600"
                        onClick={() => {
                          form.setValue("bookingStartDate", new Date(dateSuggestion.start).toISOString().split('T')[0]);
                          form.setValue("bookingEndDate", new Date(dateSuggestion.end).toISOString().split('T')[0]);
                        }}
                      >
                        Use these dates
                      </Button>
                    </div>
                  )}
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