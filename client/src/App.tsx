import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { getCurrentUser } from "./lib/auth";
import Login from "@/pages/login";
import AdminDashboard from "@/pages/admin-dashboard";
import CoachDashboard from "@/pages/coach-dashboard";
import NotFound from "@/pages/not-found";

function AuthWrapper() {
  const { data: authData, isLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: getCurrentUser,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  const user = authData?.user;

  if (!user) {
    return <Login />;
  }

  // Hotel verification will happen when coaches try to check-in
  // No longer blocking access to coach dashboard

  return (
    <Switch>
      <Route path="/" component={() => 
        user.role === 'admin' ? <AdminDashboard /> : <CoachDashboard />
      } />
      <Route path="/admin" component={() => 
        user.role === 'admin' ? <AdminDashboard /> : <NotFound />
      } />
      <Route path="/admin-dashboard" component={() => 
        user.role === 'admin' ? <AdminDashboard /> : <NotFound />
      } />
      <Route path="/coach" component={() => 
        user.role === 'coach' ? <CoachDashboard /> : <NotFound />
      } />
      <Route path="/coach-dashboard" component={() => 
        user.role === 'coach' ? <CoachDashboard /> : <NotFound />
      } />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AuthWrapper />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
