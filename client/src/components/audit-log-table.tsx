import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, User, Building, FileText, Clock } from "lucide-react";

interface AuditLog {
  id: string;
  actionType: string;
  targetEntity: string;
  targetId: string;
  details: any;
  timestamp: string;
  userName: string;
  userEmail: string;
}

export default function AuditLogTable() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Fetch audit logs
  const { data: auditLogs = [], isLoading } = useQuery({
    queryKey: ["/api/admin/audit-logs"],
    queryFn: async (): Promise<AuditLog[]> => {
      const response = await fetch("/api/admin/audit-logs", {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch audit logs');
      }
      return await response.json();
    },
  });

  // Handle search button click
  const handleSearch = () => {
    setSearchTerm(searchInput);
  };

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Filter audit logs based on search term
  const filteredLogs = auditLogs.filter(log => 
    log.actionType.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.targetEntity.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.details && JSON.stringify(log.details).toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getActionBadgeColor = (actionType: string) => {
    switch (actionType.toLowerCase()) {
      case 'login': return 'bg-green-100 text-green-800';
      case 'logout': return 'bg-gray-100 text-gray-800';
      case 'edit': return 'bg-blue-100 text-blue-800';
      case 'upload': return 'bg-purple-100 text-purple-800';
      case 'delete': return 'bg-red-100 text-red-800';
      case 'checkin': return 'bg-emerald-100 text-emerald-800';
      case 'checkout': return 'bg-orange-100 text-orange-800';
      case 'reassign': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEntityIcon = (entity: string) => {
    switch (entity.toLowerCase()) {
      case 'user': return <User className="h-4 w-4" />;
      case 'hotel': return <Building className="h-4 w-4" />;
      case 'participant': return <User className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const formatDetails = (details: any) => {
    if (!details) return null;
    
    if (details.changes) {
      const changes = Object.entries(details.changes).map(([field, change]: [string, any]) => {
        return `${field}: "${change.from}" → "${change.to}"`;
      }).join(', ');
      return changes;
    }
    
    if (details.method) {
      return `Method: ${details.method}`;
    }
    
    return JSON.stringify(details);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search audit logs..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10"
                data-testid="input-audit-search"
              />
            </div>
            <Button onClick={handleSearch} data-testid="button-search-audit">
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log List */}
      <Card>
        <CardContent className="p-0">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? "No audit logs found matching your search" : "No audit logs available"}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredLogs.map((log) => (
                <div key={log.id} className="p-6 hover:bg-gray-50" data-testid={`audit-log-${log.id}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <div className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-full">
                          {getEntityIcon(log.targetEntity)}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3 mb-1">
                          <Badge className={getActionBadgeColor(log.actionType)} data-testid={`badge-action-${log.actionType}`}>
                            {log.actionType.toUpperCase()}
                          </Badge>
                          <span className="text-sm font-medium text-gray-900" data-testid="text-entity-type">
                            {log.targetEntity.charAt(0).toUpperCase() + log.targetEntity.slice(1)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-1" data-testid="text-user-info">
                          <span className="font-medium">{log.userName}</span> ({log.userEmail})
                        </p>
                        {formatDetails(log.details) && (
                          <p className="text-sm text-gray-500 mt-2" data-testid="text-change-details">
                            {formatDetails(log.details)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <Clock className="h-4 w-4 mr-1" />
                      <span data-testid="text-timestamp">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}