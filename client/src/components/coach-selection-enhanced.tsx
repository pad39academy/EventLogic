import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Search, User, Users, ChevronDown, ChevronRight, UserCheck, Phone, MapPin } from "lucide-react";

interface Coach {
  coachId: string;
  name: string;
  teamName: string;
  discipline: string;
  mobileNumber?: string;
  hotelName?: string;
}

interface TeamMember {
  participantId: string;
  name: string;
  role: 'player' | 'official';
  mobileNumber?: string;
  hotelName?: string;
}

interface TeamData {
  coach: {
    coachId: string;
    name: string;
    teamName: string;
    discipline: string;
  };
  teamMembers: TeamMember[];
  totalMembers: number;
}

interface CoachSelectionEnhancedProps {
  selectedCoaches: string[];
  onCoachesChange: (coachIds: string[]) => void;
  includeTeamMembers: boolean;
  onIncludeTeamMembersChange: (include: boolean) => void;
}

export function CoachSelectionEnhanced({ 
  selectedCoaches, 
  onCoachesChange, 
  includeTeamMembers, 
  onIncludeTeamMembersChange 
}: CoachSelectionEnhancedProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [teamData, setTeamData] = useState<Record<string, TeamData>>({});

  // Search coaches
  const { data: coaches = [], isLoading: coachesLoading } = useQuery<Coach[]>({
    queryKey: ["/api/admin/coaches/search", searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery.trim()) {
        params.append('query', searchQuery.trim());
      }
      const response = await fetch(`/api/admin/coaches/search?${params}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to search coaches');
      return response.json();
    },
  });

  // Load team members for selected coaches
  useEffect(() => {
    const loadTeamMembers = async () => {
      for (const coachId of selectedCoaches) {
        if (!teamData[coachId] && includeTeamMembers) {
          try {
            const response = await fetch(`/api/admin/coaches/${coachId}/team-members`, {
              credentials: 'include'
            });
            if (response.ok) {
              const data = await response.json();
              setTeamData(prev => ({ ...prev, [coachId]: data }));
            }
          } catch (error) {
            console.error(`Failed to load team members for coach ${coachId}:`, error);
          }
        }
      }
    };

    if (selectedCoaches.length > 0 && includeTeamMembers) {
      loadTeamMembers();
    }
  }, [selectedCoaches, includeTeamMembers, teamData]);

  const handleCoachSelect = (coachId: string, selected: boolean) => {
    if (selected) {
      onCoachesChange([...selectedCoaches, coachId]);
    } else {
      onCoachesChange(selectedCoaches.filter(id => id !== coachId));
      // Remove from expanded teams and team data
      setExpandedTeams(prev => {
        const newSet = new Set(prev);
        newSet.delete(coachId);
        return newSet;
      });
      setTeamData(prev => {
        const newData = { ...prev };
        delete newData[coachId];
        return newData;
      });
    }
  };

  const handleSelectAll = () => {
    if (selectedCoaches.length === coaches.length) {
      onCoachesChange([]);
      setExpandedTeams(new Set());
      setTeamData({});
    } else {
      onCoachesChange(coaches.map(coach => coach.coachId));
    }
  };

  const toggleTeamExpansion = (coachId: string) => {
    setExpandedTeams(prev => {
      const newSet = new Set(prev);
      if (newSet.has(coachId)) {
        newSet.delete(coachId);
      } else {
        newSet.add(coachId);
      }
      return newSet;
    });
  };

  const getTotalRecipients = () => {
    let total = selectedCoaches.length; // Coaches
    if (includeTeamMembers) {
      total += Object.values(teamData).reduce((sum, data) => sum + data.totalMembers, 0);
    }
    return total;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="h-5 w-5" />
          Select Coaches
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search by coach name, ID, team, or discipline..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="coach-search-input"
          />
        </div>

        {/* Include Team Members Option */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="include-team-members"
            checked={includeTeamMembers}
            onCheckedChange={onIncludeTeamMembersChange}
            data-testid="include-team-members-checkbox"
          />
          <Label htmlFor="include-team-members" className="text-sm">
            Include team members in notification
          </Label>
        </div>

        {/* Recipients Summary */}
        {selectedCoaches.length > 0 && (
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Selected:</strong> {selectedCoaches.length} coach{selectedCoaches.length !== 1 ? 'es' : ''}
              {includeTeamMembers && Object.keys(teamData).length > 0 && (
                <span> + {Object.values(teamData).reduce((sum, data) => sum + data.totalMembers, 0)} team members</span>
              )}
              <span> = <strong>{getTotalRecipients()} total recipients</strong></span>
            </p>
          </div>
        )}

        {/* Select All Button */}
        {coaches.length > 0 && (
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              data-testid="select-all-coaches-button"
            >
              {selectedCoaches.length === coaches.length ? 'Deselect All' : 'Select All'}
            </Button>
            <span className="text-sm text-gray-500">
              {coaches.length} coach{coaches.length !== 1 ? 'es' : ''} found
            </span>
          </div>
        )}

        {/* Coaches List */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {coachesLoading ? (
            <div className="text-center py-4 text-gray-500">Searching coaches...</div>
          ) : coaches.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              {searchQuery ? 'No coaches found matching your search' : 'No coaches available'}
            </div>
          ) : (
            coaches.map((coach) => (
              <Card key={coach.coachId} className="border border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      checked={selectedCoaches.includes(coach.coachId)}
                      onCheckedChange={(checked) => handleCoachSelect(coach.coachId, checked as boolean)}
                      data-testid={`coach-checkbox-${coach.coachId}`}
                    />
                    
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{coach.name}</h4>
                          <p className="text-sm text-gray-600">ID: {coach.coachId}</p>
                        </div>
                        
                        {includeTeamMembers && selectedCoaches.includes(coach.coachId) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleTeamExpansion(coach.coachId)}
                            className="p-1"
                            data-testid={`expand-team-${coach.coachId}`}
                          >
                            {expandedTeams.has(coach.coachId) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="outline">{coach.discipline}</Badge>
                        <Badge variant="secondary">{coach.teamName}</Badge>
                        {coach.mobileNumber && (
                          <Badge variant="outline" className="text-green-600">
                            <Phone className="h-3 w-3 mr-1" />
                            SMS
                          </Badge>
                        )}
                        {coach.hotelName && (
                          <Badge variant="outline" className="text-blue-600">
                            <MapPin className="h-3 w-3 mr-1" />
                            {coach.hotelName}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Team Members Expansion */}
                  {includeTeamMembers && 
                   selectedCoaches.includes(coach.coachId) && 
                   expandedTeams.has(coach.coachId) && 
                   teamData[coach.coachId] && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <h5 className="font-medium text-sm mb-2 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Team Members ({teamData[coach.coachId].totalMembers})
                      </h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {teamData[coach.coachId].teamMembers.map((member) => (
                          <div key={member.participantId} className="bg-gray-50 p-2 rounded text-sm">
                            <div className="font-medium">{member.name}</div>
                            <div className="text-gray-600">
                              {member.role} • {member.participantId}
                            </div>
                            {member.mobileNumber && (
                              <div className="text-green-600 text-xs">
                                <Phone className="h-3 w-3 inline mr-1" />
                                SMS enabled
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}