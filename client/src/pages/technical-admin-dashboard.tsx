import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { logout } from "@/lib/auth";
import { useLocation } from "wouter";
import { 
  AlertTriangle, LogOut, Menu, Database, Zap, Activity, Server
} from "lucide-react";
import ievolveSymbol from "@/assets/logos/ievolve-symbol.jpg";
import FailedBatchesSection from "@/components/failed-batches-section";

export default function TechnicalAdminDashboard() {
  const [activeTab, setActiveTab] = useState("failed-batches");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Get current user
  const { data: authData } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const response = await fetch("/api/auth/me", {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Not authenticated');
      }
      return await response.json();
    }
  });

  const user = authData?.user || null;

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Success", description: "Logged out successfully" });
      setTimeout(() => {
        setLocation("/");
        window.location.reload();
      }, 500);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Logout failed",
        variant: "destructive",
      });
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Redirect if not technical admin
  if (user && user.role !== 'technical_admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-red-800 mb-2">Access Denied</h3>
            <p className="text-red-700">You need technical admin privileges to access this dashboard.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto">
          <div className="relative flex justify-between items-center px-4 py-4 sm:px-6 lg:px-8">
            {/* Logo and Title */}
            <div className="flex items-center">
              <img src={ievolveSymbol} alt="Ievolve Logo" className="h-10 w-10 rounded-md mr-4" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900" data-testid="header-title">
                  Technical Admin Dashboard
                </h1>
                <p className="text-sm text-gray-500" data-testid="header-subtitle">
                  System diagnostics and technical management
                </p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <button 
                  onClick={() => setActiveTab("failed-batches")}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${activeTab === "failed-batches" ? "bg-red-100 text-red-700" : "text-gray-500 hover:text-gray-700"}`} 
                  data-testid="nav-failed-batches"
                >
                  <AlertTriangle className="h-4 w-4 mr-2 inline" />
                  Failed Batches
                </button>
                <button 
                  onClick={() => setActiveTab("db-optimize")}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${activeTab === "db-optimize" ? "bg-blue-100 text-blue-700" : "text-gray-500 hover:text-gray-700"}`}
                  data-testid="nav-db-optimize"
                >
                  <Zap className="h-4 w-4 mr-2 inline" />
                  DB Optimize
                </button>
                <button 
                  onClick={() => setActiveTab("system-health")}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${activeTab === "system-health" ? "bg-green-100 text-green-700" : "text-gray-500 hover:text-gray-700"}`}
                  data-testid="nav-system-health"
                >
                  <Activity className="h-4 w-4 mr-2 inline" />
                  System Health
                </button>
              </div>
            </div>
            
            {/* User Menu */}
            <div className="hidden md:block">
              <div className="ml-4 flex items-center md:ml-6">
                <div className="ml-3 relative">
                  <div className="flex items-center space-x-3">
                    <Badge variant="outline" className="text-blue-600 border-blue-600">
                      Technical Admin
                    </Badge>
                    <span className="text-sm font-medium text-gray-700" data-testid="text-admin-name">
                      {user?.name || "Technical Admin"}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLogout}
                      className="flex items-center space-x-2 text-red-600 border-red-600 hover:bg-red-50"
                      data-testid="button-logout"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Logout</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Mobile menu button */}
            <div className="md:hidden">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="bg-gray-100 inline-flex items-center justify-center p-2 rounded-md text-gray-400" data-testid="button-mobile-menu">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80">
                  <SheetHeader>
                    <SheetTitle>Technical Admin Menu</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 space-y-1">
                    <button
                      onClick={() => { setActiveTab("failed-batches"); setMobileMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                        activeTab === "failed-batches" ? "bg-red-100 text-red-700" : "text-gray-500 hover:text-gray-700"
                      }`}
                      data-testid="nav-failed-batches-mobile"
                    >
                      <AlertTriangle className="h-4 w-4 mr-3 inline" />
                      Failed Batches
                    </button>
                    <button
                      onClick={() => { setActiveTab("db-optimize"); setMobileMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                        activeTab === "db-optimize" ? "bg-blue-100 text-blue-700" : "text-gray-500 hover:text-gray-700"
                      }`}
                      data-testid="nav-db-optimize-mobile"
                    >
                      <Zap className="h-4 w-4 mr-3 inline" />
                      DB Optimize
                    </button>
                    <button
                      onClick={() => { setActiveTab("system-health"); setMobileMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                        activeTab === "system-health" ? "bg-green-100 text-green-700" : "text-gray-500 hover:text-gray-700"
                      }`}
                      data-testid="nav-system-health-mobile"
                    >
                      <Activity className="h-4 w-4 mr-3 inline" />
                      System Health
                    </button>
                  </div>
                  
                  <div className="mt-8 pt-8 border-t">
                    <Button
                      variant="outline"
                      onClick={handleLogout}
                      className="w-full flex items-center space-x-2 text-red-600 border-red-600 hover:bg-red-50"
                      data-testid="button-logout-mobile"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Logout</span>
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {activeTab === "failed-batches" && <FailedBatchesSection />}

        {activeTab === "db-optimize" && <DatabaseOptimizeSection />}

        {activeTab === "system-health" && <SystemHealthSection />}
      </main>
    </div>
  );
}

// Database Optimize Section Component
function DatabaseOptimizeSection() {
  return (
    <>
      {/* Database Optimize Header */}
      <div className="mb-8">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate" data-testid="header-title">
              Database Optimization & Management
            </h2>
            <p className="mt-1 text-sm text-gray-500" data-testid="header-subtitle">
              Advanced tools for database performance optimization, diagnostics, and maintenance
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-blue-800">
            <Database className="h-5 w-5 mr-2" />
            Database Tools
          </CardTitle>
          <CardDescription>
            Maintenance and optimization tools for database management
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">Database optimization tools will be implemented here.</p>
        </CardContent>
      </Card>
    </>
  );
}

// System Health Section Component  
function SystemHealthSection() {
  return (
    <>
      {/* System Health Header */}
      <div className="mb-8">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate" data-testid="header-title">
              System Health & Monitoring
            </h2>
            <p className="mt-1 text-sm text-gray-500" data-testid="header-subtitle">
              Real-time system performance monitoring and diagnostics
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-green-800">
            <Server className="h-5 w-5 mr-2" />
            System Monitoring
          </CardTitle>
          <CardDescription>
            Monitor system performance, memory usage, and application health
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">System health monitoring tools will be implemented here.</p>
        </CardContent>
      </Card>
    </>
  );
}