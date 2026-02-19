import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, User, Calendar, Mail, MessageCircle, Clock, Search, Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { searchGuestByPhone } from "@/services/calls";
import { createLead, type CreateLeadPayload } from "@/services/leads";
import { API_BASE_URL, withAuthHeaders } from "@/services/api";
import type { GuestSearchResult } from "@/services/calls";

interface CallPageProps {
  incomingPhoneNumber?: string;
  onLeadCreated?: (leadId: string) => void;
}

const CallPage = ({ incomingPhoneNumber, onLeadCreated }: CallPageProps) => {
  const [phoneNumber, setPhoneNumber] = useState(incomingPhoneNumber || "");
  const [searchResult, setSearchResult] = useState<GuestSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [isCreatingLead, setIsCreatingLead] = useState(false);
  
  // Lead form state
  const [leadFormData, setLeadFormData] = useState<Partial<CreateLeadPayload & { callStatus?: string }>>({
    guestContact: {
      name: "",
      phone: "",
      email: "",
    },
    source: "DIRECT_CALL",
    leadType: "STAY",
    heatLevel: "WARM",
    checkInDate: "",
    checkOutDate: "",
    roomsRequested: 1,
    guests: {
      adults: 2,
      children: 0,
    },
    occasion: "",
    isFirstTimeGuest: false,
    callStatus: undefined,
  });

  const { toast } = useToast();

  // Auto-search if phone number is provided
  useEffect(() => {
    if (incomingPhoneNumber && incomingPhoneNumber !== phoneNumber) {
      setPhoneNumber(incomingPhoneNumber);
      handleSearch(incomingPhoneNumber);
    }
  }, [incomingPhoneNumber]);

  const handleSearch = async (phone: string) => {
    if (!phone.trim()) {
      toast({
        title: "Error",
        description: "Please enter a phone number",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    setSearchResult(null);
    setShowLeadForm(false);

    try {
      const result = await searchGuestByPhone(phone);
      setSearchResult(result);
      
      if (!result.guest) {
        // Guest not found, show lead form
        setShowLeadForm(true);
        setLeadFormData((prev) => ({
          ...prev,
          guestContact: {
            name: "",
            phone: phone,
            email: "",
          },
        }));
      } else {
        // Guest found, populate form with guest data
        setLeadFormData((prev) => ({
          ...prev,
          guestId: result.guest?._id,
          guestContact: {
            name: result.guest?.name || "",
            phone: result.guest?.phone || phone,
            email: result.guest?.email || "",
          },
        }));
      }
    } catch (error) {
      toast({
        title: "Search failed",
        description: error instanceof Error ? error.message : "Failed to search guest",
        variant: "destructive",
      });
      // Show lead form even on error
      setShowLeadForm(true);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCreateLead = async () => {
    if (!leadFormData.guestContact?.name) {
      toast({
        title: "Validation error",
        description: "Guest name is required",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingLead(true);
    try {
      const payload: CreateLeadPayload = {
        guestContact: {
          name: leadFormData.guestContact.name,
          phone: leadFormData.guestContact.phone || phoneNumber,
          email: leadFormData.guestContact.email,
        },
        source: leadFormData.source || "DIRECT_CALL",
        leadType: leadFormData.leadType || "STAY",
        heatLevel: leadFormData.heatLevel || "WARM",
        checkInDate: leadFormData.checkInDate || undefined,
        checkOutDate: leadFormData.checkOutDate || undefined,
        roomsRequested: leadFormData.roomsRequested,
        guests: leadFormData.guests,
        occasion: leadFormData.occasion,
        isFirstTimeGuest: leadFormData.isFirstTimeGuest || false,
        assignmentMode: "auto",
      };

      const lead = await createLead(payload);
      
      // Update call status if provided (separate call since it's not in create payload)
      if (leadFormData.callStatus) {
        try {
          await fetch(`${API_BASE_URL}/leads/${lead.id}/call-status`, {
            method: "PATCH",
            headers: withAuthHeaders({
              "Content-Type": "application/json",
            }),
            body: JSON.stringify({ callStatus: leadFormData.callStatus }),
          });
        } catch (error) {
          // Log but don't fail
          console.error("Failed to update call status:", error);
        }
      }
      
      toast({
        title: "Lead created",
        description: `Lead ${lead.leadNumber} created successfully`,
      });

      if (onLeadCreated) {
        onLeadCreated(lead.id);
      }

      // Reset form
      setShowLeadForm(false);
      setSearchResult(null);
      setPhoneNumber("");
    } catch (error) {
      toast({
        title: "Failed to create lead",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsCreatingLead(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6 p-6">
      {/* Phone Number Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Phone className="h-5 w-5" />
            <span>Call Agent Interface</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-2">
            <div className="flex-1">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="Enter phone number (e.g., +91 98765 43210)"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    handleSearch(phoneNumber);
                  }
                }}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => handleSearch(phoneNumber)}
                disabled={isSearching || !phoneNumber.trim()}
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Search Guest
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Guest Found - Show History */}
      {searchResult?.guest && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Guest Information</span>
              <Badge className="ml-auto">
                {searchResult.source === "both" ? "Local & External" : searchResult.source === "external" ? "External" : "Local"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-gray-600">Name</Label>
                <p className="text-lg font-semibold">{searchResult.guest.name}</p>
              </div>
              <div>
                <Label className="text-sm text-gray-600">Phone</Label>
                <p className="text-sm">{searchResult.guest.phone || "N/A"}</p>
              </div>
              <div>
                <Label className="text-sm text-gray-600">Email</Label>
                <p className="text-sm">{searchResult.guest.email || "N/A"}</p>
              </div>
              <div>
                <Label className="text-sm text-gray-600">Total Leads</Label>
                <p className="text-sm">{searchResult.guest.totalLeadsCount || 0}</p>
              </div>
            </div>

            {/* Previous Leads */}
            {searchResult.previousLeads && searchResult.previousLeads.length > 0 && (
              <div>
                <Label className="text-sm font-medium mb-2 block">Previous Leads</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {searchResult.previousLeads.map((lead: any) => (
                    <div key={lead._id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">Lead #{lead.leadNumber}</p>
                          <p className="text-sm text-gray-600">
                            {lead.status} • {lead.heatLevel}
                          </p>
                          {lead.checkInDate && (
                            <p className="text-xs text-gray-500">
                              Check-in: {formatDate(lead.checkInDate)}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline">{lead.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Communication History */}
            {searchResult.communicationHistory && searchResult.communicationHistory.length > 0 && (
              <div>
                <Label className="text-sm font-medium mb-2 block">Communication History</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {searchResult.communicationHistory.map((comm: any) => (
                    <div key={comm._id} className="p-2 bg-gray-50 rounded text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">{comm.channel}</span>
                        <span className="text-gray-500">{formatDate(comm.createdAt)}</span>
                      </div>
                      {comm.summary && (
                        <p className="text-gray-600 mt-1">{comm.summary}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={() => setShowLeadForm(true)}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Lead for This Guest
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Lead Creation Form */}
      {showLeadForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create Lead - Direct Guest</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="guestName">Guest Name *</Label>
                <Input
                  id="guestName"
                  value={leadFormData.guestContact?.name || ""}
                  onChange={(e) =>
                    setLeadFormData({
                      ...leadFormData,
                      guestContact: {
                        ...leadFormData.guestContact,
                        name: e.target.value,
                      },
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="guestPhone">Phone</Label>
                <Input
                  id="guestPhone"
                  value={leadFormData.guestContact?.phone || phoneNumber}
                  onChange={(e) =>
                    setLeadFormData({
                      ...leadFormData,
                      guestContact: {
                        ...leadFormData.guestContact,
                        phone: e.target.value,
                      },
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="guestEmail">Email</Label>
                <Input
                  id="guestEmail"
                  type="email"
                  value={leadFormData.guestContact?.email || ""}
                  onChange={(e) =>
                    setLeadFormData({
                      ...leadFormData,
                      guestContact: {
                        ...leadFormData.guestContact,
                        email: e.target.value,
                      },
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="heatLevel">Heat Level</Label>
                <Select
                  value={leadFormData.heatLevel || "WARM"}
                  onValueChange={(value) =>
                    setLeadFormData({ ...leadFormData, heatLevel: value as any })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HOT">Hot</SelectItem>
                    <SelectItem value="WARM">Warm</SelectItem>
                    <SelectItem value="COLD">Cold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="callStatus">Call Status</Label>
                <Select
                  value={leadFormData.callStatus || ""}
                  onValueChange={(value) =>
                    setLeadFormData({ ...leadFormData, callStatus: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="QUOTATION_SHARED">Quotation Shared</SelectItem>
                    <SelectItem value="PAYMENT_PENDING">Payment Pending</SelectItem>
                    <SelectItem value="NOT_INTERESTED">Not Interested</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="isFirstTime">Guest Type</Label>
                <Select
                  value={leadFormData.isFirstTimeGuest ? "false" : "true"}
                  onValueChange={(value) =>
                    setLeadFormData({ ...leadFormData, isFirstTimeGuest: value === "false" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">First Time Guest</SelectItem>
                    <SelectItem value="false">Repeat Guest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="checkInDate">Check-in Date</Label>
                <Input
                  id="checkInDate"
                  type="date"
                  value={leadFormData.checkInDate || ""}
                  onChange={(e) =>
                    setLeadFormData({ ...leadFormData, checkInDate: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="checkOutDate">Check-out Date</Label>
                <Input
                  id="checkOutDate"
                  type="date"
                  value={leadFormData.checkOutDate || ""}
                  onChange={(e) =>
                    setLeadFormData({ ...leadFormData, checkOutDate: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="roomsRequested">Rooms</Label>
                <Input
                  id="roomsRequested"
                  type="number"
                  min="1"
                  value={leadFormData.roomsRequested || 1}
                  onChange={(e) =>
                    setLeadFormData({
                      ...leadFormData,
                      roomsRequested: parseInt(e.target.value) || 1,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="occasion">Occasion</Label>
                <Input
                  id="occasion"
                  value={leadFormData.occasion || ""}
                  onChange={(e) =>
                    setLeadFormData({ ...leadFormData, occasion: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="adults">Adults</Label>
                <Input
                  id="adults"
                  type="number"
                  min="1"
                  value={leadFormData.guests?.adults || 2}
                  onChange={(e) =>
                    setLeadFormData({
                      ...leadFormData,
                      guests: {
                        ...leadFormData.guests,
                        adults: parseInt(e.target.value) || 2,
                      },
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="children">Children</Label>
                <Input
                  id="children"
                  type="number"
                  min="0"
                  value={leadFormData.guests?.children || 0}
                  onChange={(e) =>
                    setLeadFormData({
                      ...leadFormData,
                      guests: {
                        ...leadFormData.guests,
                        children: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                />
              </div>
            </div>

            <div className="flex space-x-2">
              <Button
                onClick={handleCreateLead}
                disabled={isCreatingLead || !leadFormData.guestContact?.name}
                className="flex-1"
              >
                {isCreatingLead ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Create Lead
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowLeadForm(false);
                  setLeadFormData({
                    guestContact: { name: "", phone: "", email: "" },
                    source: "DIRECT_CALL",
                    leadType: "STAY",
                    heatLevel: "WARM",
                  });
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CallPage;

