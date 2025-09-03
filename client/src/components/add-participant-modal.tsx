import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AddParticipantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Define form schemas for each role
const baseParticipantSchema = z.object({
  role: z.enum(["coach", "official", "player"]),
  participantId: z.string().min(1, "Participant ID is required"),
  name: z.string().min(1, "Name is required"),
  mobileNumber: z.string().optional(),
  hotelId: z.string().min(1, "Hotel assignment is required"),
  bookingStartDate: z.string().min(1, "Booking start date is required"),
  bookingEndDate: z.string().min(1, "Booking end date is required"),
  bookingReference: z.string().min(1, "Booking reference is required"),
});

const coachOfficialSchema = baseParticipantSchema.extend({
  discipline: z.string().min(1, "Discipline is required"),
  location: z.string().min(1, "Location is required"), 
  district: z.string().min(1, "District is required"),
  stadium: z.string().optional(),
  notifyTransport: z.string().optional(),
  // Coach-specific POC fields
  travelPocName: z.string().optional(),
  travelPocMobile: z.string().optional(),
  venuePocName: z.string().optional(),
  venuePocMobile: z.string().optional(),
});

const playerSchema = baseParticipantSchema.extend({
  coachId: z.string().min(1, "Coach assignment is required"),
  teamName: z.string().min(1, "Team name is required"),
});

// Dynamic schema based on role
const createSchemaForRole = (role: string) => {
  if (role === "player") return playerSchema;
  return coachOfficialSchema;
};

export function AddParticipantModal({ isOpen, onClose }: AddParticipantModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<string>("");

  const form = useForm({
    resolver: zodResolver(baseParticipantSchema),
    defaultValues: {
      role: "",
      participantId: "",
      name: "",
      mobileNumber: "",
      hotelId: "",
      bookingStartDate: "",
      bookingEndDate: "",
      bookingReference: "",
      // Coach/Official fields
      discipline: "",
      location: "",
      district: "",
      stadium: "",
      notifyTransport: "",
      travelPocName: "",
      travelPocMobile: "",
      venuePocName: "",
      venuePocMobile: "",
      // Player fields
      coachId: "",
      teamName: "",
    },
  });

  // Get available hotels
  const { data: availableHotels = [] } = useQuery({
    queryKey: ["/api/admin/available-hotels"],
    enabled: isOpen,
  });

  // Get coaches for player assignment
  const { data: coaches = [] } = useQuery({
    queryKey: ["/api/admin/coaches"],
    enabled: isOpen && selectedRole === "player",
  });

  // Watch role changes
  const watchedRole = form.watch("role");
  const watchedStartDate = form.watch("bookingStartDate");
  const watchedEndDate = form.watch("bookingEndDate");

  // Update selected role when form role changes
  useEffect(() => {
    if (watchedRole !== selectedRole) {
      setSelectedRole(watchedRole);
      // Reset role-specific fields when role changes
      if (watchedRole === "player") {
        form.setValue("discipline", "");
        form.setValue("location", "");
        form.setValue("district", "");
      } else {
        form.setValue("coachId", "");
        form.setValue("teamName", "");
      }
    }
  }, [watchedRole, selectedRole, form]);

  // Validate date range (3-day minimum)
  useEffect(() => {
    if (watchedStartDate && watchedEndDate) {
      const convertDate = (dateStr: string) => {
        if (!dateStr.includes('/')) return null;
        const [day, month, year] = dateStr.split('/');
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      };

      const startDate = convertDate(watchedStartDate);
      const endDate = convertDate(watchedEndDate);
      
      if (startDate && endDate) {
        const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
        if (daysDiff < 3) {
          form.setError("bookingEndDate", {
            message: "Booking duration must be at least 3 days"
          });
        } else {
          form.clearErrors("bookingEndDate");
        }
      }
    }
  }, [watchedStartDate, watchedEndDate, form]);

  // Update form resolver based on role
  useEffect(() => {
    if (selectedRole) {
      const schema = createSchemaForRole(selectedRole);
      form.clearErrors();
    }
  }, [selectedRole, form]);

  // Generate participant ID based on role
  const generateParticipantId = (role: string) => {
    const prefix = role === "coach" ? "COA" : role === "official" ? "OFC" : "PLA";
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}_${randomNum}`;
  };

  // Auto-generate participant ID when role is selected
  useEffect(() => {
    if (selectedRole && !form.getValues("participantId")) {
      form.setValue("participantId", generateParticipantId(selectedRole));
    }
  }, [selectedRole, form]);

  const addParticipantMutation = useMutation({
    mutationFn: async (data: any) => {
      // Prepare data for API
      const participantData = {
        ...data,
        // Normalize mobile number
        mobileNumber: data.mobileNumber ? (data.mobileNumber.startsWith('+91') ? data.mobileNumber : `+91${data.mobileNumber}`) : null,
      };

      const response = await fetch("/api/admin/participants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(participantData),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to add participant");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Participant added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard/participants"] });
      form.reset();
      setSelectedRole("");
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add participant",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: any) => {
    addParticipantMutation.mutate(data);
  };

  const handleClose = () => {
    form.reset();
    setSelectedRole("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Participant</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            {/* Role Selection */}
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-role">
                        <SelectValue placeholder="Select participant role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="coach">Coach</SelectItem>
                      <SelectItem value="official">Official</SelectItem>
                      <SelectItem value="player">Player</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedRole && (
              <>
                {/* Basic Information */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="participantId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {selectedRole === "coach" ? "Coach ID *" : 
                           selectedRole === "official" ? "Official ID *" : "Player ID *"}
                        </FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-participant-id" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name *</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="mobileNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile Number</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="10-digit number (auto +91)" data-testid="input-mobile" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Player-specific fields */}
                {selectedRole === "player" && (
                  <>
                    <FormField
                      control={form.control}
                      name="coachId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Coach Assignment *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-coach">
                                <SelectValue placeholder="Select coach" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {(coaches as any[]).map((coach: any) => (
                                <SelectItem key={coach.participantId} value={coach.participantId}>
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
                      name="teamName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Team Name *</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-team-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {/* Coach/Official-specific fields */}
                {(selectedRole === "coach" || selectedRole === "official") && (
                  <>
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="discipline"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Discipline *</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-discipline" />
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
                            <FormLabel>Location *</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-location" />
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
                            <FormLabel>District *</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-district" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="stadium"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Stadium</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-stadium" />
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
                            <FormLabel>Notify Transport Contact</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-notify-transport" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* POC fields for coaches */}
                    {selectedRole === "coach" && (
                      <>
                        <div className="border-t pt-4">
                          <h4 className="font-medium mb-3">Point of Contact Details</h4>
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
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* Hotel and Booking Information */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Hotel & Booking Details</h4>
                  
                  <FormField
                    control={form.control}
                    name="hotelId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hotel Assignment *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-hotel">
                              <SelectValue placeholder="Select hotel" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(availableHotels as any[]).map((hotel: any) => (
                              <SelectItem key={`${hotel.hotelId}-${hotel.instanceCode}`} value={hotel.hotelId}>
                                {hotel.hotelName} - {hotel.location} ({hotel.availableRooms} rooms available)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="bookingStartDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Booking Start Date *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="DD/MM/YYYY" data-testid="input-booking-start" />
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
                          <FormLabel>Booking End Date *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="DD/MM/YYYY" data-testid="input-booking-end" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="bookingReference"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Booking Reference *</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-booking-reference" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={addParticipantMutation.isPending}
                    data-testid="button-add-participant"
                  >
                    {addParticipantMutation.isPending ? "Adding..." : "Add Participant"}
                  </Button>
                </div>
              </>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}