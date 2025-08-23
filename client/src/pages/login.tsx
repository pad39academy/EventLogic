import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Phone, Mail, Lock, Shield, ArrowRight, RefreshCw } from "lucide-react";

// Login form schemas
const adminLoginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const coachLoginSchema = z.object({
  mobileNumber: z.string().min(10, "Please enter a valid mobile number").transform((val) => {
    // If user enters number without +91, add it
    if (val && !val.startsWith('+91')) {
      return `+91${val}`;
    }
    return val;
  }),
});

const otpSchema = z.object({
  otp: z.string().length(6, "OTP must be 6 digits"),
});

type AdminLoginForm = z.infer<typeof adminLoginSchema>;
type CoachLoginForm = z.infer<typeof coachLoginSchema>;
type OtpForm = z.infer<typeof otpSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedRole, setSelectedRole] = useState<"admin" | "coach" | "">("");
  const [step, setStep] = useState<"role" | "credentials" | "otp">("role");
  const [mobileForOTP, setMobileForOTP] = useState("");
  const [countdown, setCountdown] = useState(0);

  // Admin form
  const adminForm = useForm<AdminLoginForm>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Coach form
  const coachForm = useForm<CoachLoginForm>({
    resolver: zodResolver(coachLoginSchema),
    defaultValues: {
      mobileNumber: "",
    },
  });

  // OTP form
  const otpForm = useForm<OtpForm>({
    resolver: zodResolver(otpSchema),
    defaultValues: {
      otp: "",
    },
  });

  // Admin login step 1 mutation
  const adminLoginMutation = useMutation({
    mutationFn: async (data: AdminLoginForm) => {
      const response = await apiRequest("POST", "/api/auth/admin/login", data);
      return await response.json();
    },
    onSuccess: (response) => {
      if (response.requiresOTP) {
        setMobileForOTP(response.mobileNumber);
        setStep("otp");
        startCountdown();
        toast({
          title: "OTP Sent",
          description: "Please check your mobile for the verification code",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    },
  });

  // Admin OTP verification mutation
  const adminOtpMutation = useMutation({
    mutationFn: async (data: OtpForm) => {
      const response = await apiRequest("POST", "/api/auth/admin/verify-otp", {
        mobileNumber: mobileForOTP,
        otp: data.otp,
        purpose: "admin_login",
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "Login Successful",
        description: "Welcome to Ievolve Event Management",
      });
      setLocation("/admin");
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid OTP",
        variant: "destructive",
      });
    },
  });

  // Coach login mutation
  const coachLoginMutation = useMutation({
    mutationFn: async (data: CoachLoginForm) => {
      const response = await apiRequest("POST", "/api/auth/coach/login", data);
      return await response.json();
    },
    onSuccess: (response, variables) => {
      if (response.requiresOTP) {
        setMobileForOTP(variables.mobileNumber);
        setStep("otp");
        startCountdown();
        toast({
          title: "OTP Sent",
          description: "Please check your mobile for the verification code",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Login Failed",
        description: error.message || "Coach not found",
        variant: "destructive",
      });
    },
  });

  // Coach OTP verification mutation
  const coachOtpMutation = useMutation({
    mutationFn: async (data: OtpForm) => {
      const response = await apiRequest("POST", "/api/auth/coach/verify-otp", {
        mobileNumber: mobileForOTP,
        otp: data.otp,
        purpose: "coach_login",
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "Login Successful",
        description: "Welcome Coach!",
      });
      setLocation("/coach");
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid OTP",
        variant: "destructive",
      });
    },
  });

  // Resend OTP mutation
  const resendOtpMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/resend-otp", {
        mobileNumber: mobileForOTP,
        purpose: selectedRole === "admin" ? "admin_login" : "coach_login",
      });
      return await response.json();
    },
    onSuccess: () => {
      startCountdown();
      toast({
        title: "OTP Resent",
        description: "Please check your mobile for the new verification code",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Resend",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    },
  });

  const startCountdown = () => {
    setCountdown(180); // 3 minutes
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const onAdminSubmit = (data: AdminLoginForm) => {
    adminLoginMutation.mutate(data);
  };

  const onCoachSubmit = (data: CoachLoginForm) => {
    coachLoginMutation.mutate(data);
  };

  const onOtpSubmit = (data: OtpForm) => {
    if (selectedRole === "admin") {
      adminOtpMutation.mutate(data);
    } else {
      coachOtpMutation.mutate(data);
    }
  };

  const resetToRole = () => {
    setStep("role");
    setSelectedRole("");
    setMobileForOTP("");
    setCountdown(0);
    adminForm.reset();
    coachForm.reset();
    otpForm.reset();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Sports Event Management System</h1>
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-lg font-semibold py-2 px-4 rounded-lg">
            CHIEF MINISTER TROPHY
          </div>
          <div className="text-indigo-700 font-medium mt-1">Tamil Nadu</div>
        </div>

        <Card className="shadow-xl border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-semibold text-center text-gray-800">
              {step === "role" && "Select Role"}
              {step === "credentials" && selectedRole === "admin" && "Admin Login"}
              {step === "credentials" && selectedRole === "coach" && "Team Coach Login"}
              {step === "otp" && "OTP Verification"}
            </CardTitle>
            <CardDescription className="text-center text-gray-600">
              {step === "role" && "Choose your login role to continue"}
              {step === "credentials" && selectedRole === "admin" && "Enter your email and password"}
              {step === "credentials" && selectedRole === "coach" && "Enter your registered mobile number"}
              {step === "otp" && `Enter 6-digit OTP sent to ${mobileForOTP.replace(/(\+\d{2})(\d{4})(\d{4})/, '$1****$3')}`}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Role Selection */}
            {step === "role" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  <Button
                    variant="outline"
                    className="h-16 flex items-center justify-between p-4 hover:bg-blue-50 border-2 hover:border-blue-300 transition-colors"
                    onClick={() => {
                      setSelectedRole("admin");
                      setStep("credentials");
                    }}
                    data-testid="select-admin-role"
                  >
                    <div className="flex items-center space-x-3">
                      <Shield className="h-6 w-6 text-blue-600" />
                      <div className="text-left">
                        <div className="font-semibold text-gray-900">Admin</div>
                        <div className="text-sm text-gray-500">Two-factor authentication required</div>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-gray-400" />
                  </Button>

                  <Button
                    variant="outline"
                    className="h-16 flex items-center justify-between p-4 hover:bg-green-50 border-2 hover:border-green-300 transition-colors"
                    onClick={() => {
                      setSelectedRole("coach");
                      setStep("credentials");
                    }}
                    data-testid="select-coach-role"
                  >
                    <div className="flex items-center space-x-3">
                      <Phone className="h-6 w-6 text-green-600" />
                      <div className="text-left">
                        <div className="font-semibold text-gray-900">Team Coach</div>
                        <div className="text-sm text-gray-500">OTP verification only</div>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-gray-400" />
                  </Button>
                </div>
              </div>
            )}

            {/* Admin Credentials */}
            {step === "credentials" && selectedRole === "admin" && (
              <Form {...adminForm}>
                <form onSubmit={adminForm.handleSubmit(onAdminSubmit)} className="space-y-4">
                  <FormField
                    control={adminForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center space-x-2">
                          <Mail className="h-4 w-4" />
                          <span>Email Address</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter your email"
                            {...field}
                            data-testid="input-admin-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={adminForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center space-x-2">
                          <Lock className="h-4 w-4" />
                          <span>Password</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Enter your password"
                            {...field}
                            data-testid="input-admin-password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-3">
                    <Button
                      type="submit"
                      className="w-full h-12 bg-blue-600 hover:bg-blue-700"
                      disabled={adminLoginMutation.isPending}
                      data-testid="button-admin-login"
                    >
                      {adminLoginMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Continue to OTP
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={resetToRole}
                      data-testid="button-back-to-role"
                    >
                      Back to Role Selection
                    </Button>
                  </div>

                  <div className="text-xs text-blue-600 bg-blue-50 p-3 rounded-lg">
                    <Shield className="h-4 w-4 inline mr-1" />
                    Note: Admin login requires two-factor authentication via SMS OTP
                  </div>
                </form>
              </Form>
            )}

            {/* Coach Credentials */}
            {step === "credentials" && selectedRole === "coach" && (
              <Form {...coachForm}>
                <form onSubmit={coachForm.handleSubmit(onCoachSubmit)} className="space-y-4">
                  <FormField
                    control={coachForm.control}
                    name="mobileNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center space-x-2">
                          <Phone className="h-4 w-4" />
                          <span>Mobile Number</span>
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600 font-medium">
                              +91
                            </span>
                            <Input
                              placeholder="Enter your mobile number"
                              {...field}
                              className="pl-12"
                              maxLength={10}
                              onChange={(e) => {
                                // Only allow digits and limit to 10 digits
                                const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                                field.onChange(value);
                              }}
                              data-testid="input-coach-mobile"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-3">
                    <Button
                      type="submit"
                      className="w-full h-12 bg-green-600 hover:bg-green-700"
                      disabled={coachLoginMutation.isPending}
                      data-testid="button-coach-login"
                    >
                      {coachLoginMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Send OTP
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={resetToRole}
                      data-testid="button-back-to-role"
                    >
                      Back to Role Selection
                    </Button>
                  </div>

                  <div className="text-xs text-green-600 bg-green-50 p-3 rounded-lg">
                    <Phone className="h-4 w-4 inline mr-1" />
                    Note: Enter your 10-digit mobile number. Country code (+91) will be added automatically
                  </div>
                </form>
              </Form>
            )}

            {/* OTP Verification */}
            {step === "otp" && (
              <Form {...otpForm}>
                <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-4">
                  <FormField
                    control={otpForm.control}
                    name="otp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-center block">
                          Enter 6-digit OTP
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="000000"
                            className="text-center text-2xl tracking-widest font-mono"
                            maxLength={6}
                            {...field}
                            data-testid="input-otp"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-3">
                    <Button
                      type="submit"
                      className="w-full h-12 bg-indigo-600 hover:bg-indigo-700"
                      disabled={
                        (selectedRole === "admin" ? adminOtpMutation.isPending : coachOtpMutation.isPending) ||
                        otpForm.watch("otp").length !== 6
                      }
                      data-testid="button-verify-otp"
                    >
                      {(selectedRole === "admin" ? adminOtpMutation.isPending : coachOtpMutation.isPending) ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Verify
                    </Button>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">
                        Didn't receive OTP?
                      </span>
                      {countdown > 0 ? (
                        <span className="text-indigo-600 font-mono">
                          Resend in {formatTime(countdown)}
                        </span>
                      ) : (
                        <Button
                          type="button"
                          variant="link"
                          className="p-0 h-auto text-indigo-600"
                          onClick={() => resendOtpMutation.mutate()}
                          disabled={resendOtpMutation.isPending}
                          data-testid="button-resend-otp"
                        >
                          {resendOtpMutation.isPending ? (
                            <RefreshCw className="h-4 w-4 animate-spin mr-1" />
                          ) : null}
                          Resend OTP
                        </Button>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={resetToRole}
                      data-testid="button-back-to-role-from-otp"
                    >
                      Back to Role Selection
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>

        <div className="text-center mt-6 text-sm text-gray-600">
          Having trouble? Contact support for assistance.
        </div>
      </div>
    </div>
  );
}