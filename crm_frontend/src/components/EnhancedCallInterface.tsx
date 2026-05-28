import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Phone, PhoneOff, User, Clock, Mail, MapPin, Star, Save, Calendar as CalendarIcon, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { EmailDialog } from "@/components/communication/EmailDialog";

interface Guest {
  id: string;
  name: string;
  phone: string;
  email: string;
  loyaltyStatus: string;
  totalStays: number;
  lastStay: string;
  preferences: string[];
  property: string;
  interactionHistory: Array<{
    date: string;
    type: string;
    channel: string;
    agent: string;
    summary: string;
  }>;
}

interface EnhancedCallInterfaceProps {
  guest: Guest;
  incomingCall: boolean;
  onCallEnd: () => void;
  agentName: string;
  onOpenLeadForm?: () => void;
}

export const EnhancedCallInterface = ({
  guest,
  incomingCall,
  onCallEnd,
  agentName,
  onOpenLeadForm,
}: EnhancedCallInterfaceProps) => {
  const [callActive, setCallActive] = useState(incomingCall);
  const [callDuration, setCallDuration] = useState(0);
  const [notes, setNotes] = useState("");
  const [interactions, setInteractions] = useState(guest.interactionHistory);
  const [showDispositionDialog, setShowDispositionDialog] = useState(false);
  const [showLeadFormDialog, setShowLeadFormDialog] = useState(false);
  const [selectedDisposition, setSelectedDisposition] = useState("");
  const [selectedQueryType, setSelectedQueryType] = useState("");
  const [followUpDate, setFollowUpDate] = useState<Date | undefined>(undefined);
  const [followUpTime, setFollowUpTime] = useState("");

  // Communication dialog states
  const [showEmailDialog, setShowEmailDialog] = useState(false);

  // New Lead Form State
  const [newLeadForm, setNewLeadForm] = useState({
    name: "",
    phone: "",
    email: "",
    property: "",
    checkIn: "",
    checkOut: "",
    guests: 1,
    roomType: "",
    budget: "",
    source: "",
    priority: "medium"
  });

  const dispositionOptions = [
    "New Query",
    "Call back",
    "Property Request",
    "Property Escalations",
    "Refund Query",
    "Amendment Query",
    "Cancellation Query"
  ];

  const queryTypeOptions = [
    "Direct Customer",
    "Referral",
    "Corporate",
    "Others"
  ];

  const propertyOptions = [
    "Postcard Goa",
    "Postcard Udaipur",
    "Postcard Munnar",
    "Postcard Coonoor"
  ];

  const roomTypeOptions = [
    "Deluxe Room",
    "Premium Suite",
    "Ocean View Villa",
    "Garden Villa",
    "Presidential Suite"
  ];

  useState(() => {
    let interval: NodeJS.Timeout;
    if (callActive) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  });

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerCall = () => {
    setCallActive(true);
    setCallDuration(0);
    toast.success("Call connected");
  };

  const handleEndCall = () => {
    setCallActive(false);
    onCallEnd();
    toast.success("Call ended");
  };

  const handleSaveNotes = () => {
    if (!notes.trim()) {
      toast.error("Please add notes before saving");
      return;
    }
    setShowDispositionDialog(true);
  };

  const handleDispositionSubmit = () => {
    if (!selectedDisposition || !selectedQueryType) {
      toast.error("Please select both disposition and query type");
      return;
    }

    if (selectedDisposition === "New Query") {
      if (onOpenLeadForm) {
        setShowDispositionDialog(false);
        onOpenLeadForm();
      } else {
        setShowLeadFormDialog(true);
      }
      return;
    }

    // Save the interaction
    const newInteraction = {
      date: new Date().toISOString().split('T')[0],
      type: "Call",
      channel: "Phone",
      agent: agentName,
      summary: notes
    };

    setInteractions(prev => [newInteraction, ...prev]);
    setNotes("");
    setShowDispositionDialog(false);
    setSelectedDisposition("");
    setSelectedQueryType("");
    setFollowUpDate(undefined);
    setFollowUpTime("");

    toast.success("Notes saved successfully with disposition");
  };

  const handleLeadFormSubmit = () => {
    // Validate required fields
    if (!newLeadForm.name || !newLeadForm.phone || !newLeadForm.property) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Save both the lead and the interaction
    const newInteraction = {
      date: new Date().toISOString().split('T')[0],
      type: "Call",
      channel: "Phone",
      agent: agentName,
      summary: `${notes} - New lead created: ${newLeadForm.name}`
    };

    setInteractions(prev => [newInteraction, ...prev]);
    setNotes("");
    setShowLeadFormDialog(false);
    setShowDispositionDialog(false);
    setSelectedDisposition("");
    setSelectedQueryType("");

    // Reset lead form
    setNewLeadForm({
      name: "",
      phone: "",
      email: "",
      property: "",
      checkIn: "",
      checkOut: "",
      guests: 1,
      roomType: "",
      budget: "",
      source: "",
      priority: "medium"
    });

    toast.success("Lead created and notes saved successfully");
  };

  return (
    <div className="space-y-6">
      {/* Call Status Header */}
      <Card className={`border-l-4 ${callActive ? 'border-l-green-500 bg-green-50' : incomingCall ? 'border-l-red-500 bg-red-50' : 'border-l-gray-300'}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={`p-3 rounded-full ${callActive ? 'bg-green-500' : incomingCall ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`}>
                <Phone className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">
                  {incomingCall && !callActive ? 'Incoming Call' : callActive ? 'Call Active' : 'Call Center'}
                </CardTitle>
                <CardDescription>
                  {callActive ? `Duration: ${formatDuration(callDuration)}` : 'Ready to receive calls'}
                </CardDescription>
              </div>
            </div>

            <div className="flex space-x-2">
              {incomingCall && !callActive && (
                <Button onClick={handleAnswerCall} className="bg-green-600 hover:bg-green-700">
                  <Phone className="h-4 w-4 mr-2" />
                  Answer
                </Button>
              )}
              {callActive && (
                <Button onClick={handleEndCall} variant="destructive">
                  <PhoneOff className="h-4 w-4 mr-2" />
                  End Call
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Guest Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Caller Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start space-x-4">
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="text-xl font-semibold">{guest.name}</h3>
                  <p className="text-muted-foreground">{guest.phone}</p>
                  <p className="text-muted-foreground">{guest.email}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Loyalty Status:</span>
                    <Badge className="ml-2">{guest.loyaltyStatus}</Badge>
                  </div>
                  <div>
                    <span className="font-medium">Total Stays:</span>
                    <span className="ml-2">{guest.totalStays}</span>
                  </div>
                  <div>
                    <span className="font-medium">Last Stay:</span>
                    <span className="ml-2">{guest.lastStay}</span>
                  </div>
                  <div>
                    <span className="font-medium">Property:</span>
                    <span className="ml-2">{guest.property}</span>
                  </div>
                </div>

                <div>
                  <span className="font-medium text-sm">Preferences:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {guest.preferences.map((pref, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {pref}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Call Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Call Notes & Communication</CardTitle>
            <CardDescription>Add notes and communicate with the guest</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Communication Buttons */}
            <div className="flex space-x-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEmailDialog(true)}
                className="flex items-center"
              >
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
            </div>

            <Textarea
              placeholder="Enter call notes, customer queries, or important information..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
            />
            <Button onClick={handleSaveNotes} className="w-full" disabled={!notes.trim()}>
              <Save className="h-4 w-4 mr-2" />
              Save Notes & Set Disposition
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Interactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Interactions</CardTitle>
          <CardDescription>Previous conversations and touchpoints</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {interactions.map((interaction, index) => (
              <div key={index} className="flex items-start space-x-4 p-4 border rounded-lg">
                <div className="flex-shrink-0">
                  <div className="p-2 bg-blue-100 rounded-full">
                    <Phone className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">{interaction.type} - {interaction.channel}</h4>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">{interaction.date}</p>
                      <p className="text-xs text-muted-foreground">by {interaction.agent}</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{interaction.summary}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Disposition Dialog */}
      <Dialog open={showDispositionDialog} onOpenChange={setShowDispositionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set Disposition</DialogTitle>
            <DialogDescription>
              Categorize this interaction and schedule follow-up if needed
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="disposition">Disposition</Label>
              <Select value={selectedDisposition} onValueChange={setSelectedDisposition}>
                <SelectTrigger>
                  <SelectValue placeholder="Select disposition" />
                </SelectTrigger>
                <SelectContent>
                  {dispositionOptions.map(option => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="querytype">Type of Query</Label>
              <Select value={selectedQueryType} onValueChange={setSelectedQueryType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select query type" />
                </SelectTrigger>
                <SelectContent>
                  {queryTypeOptions.map(option => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedDisposition === "Call back" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Schedule Follow-up</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !followUpDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {followUpDate ? format(followUpDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={followUpDate}
                        onSelect={setFollowUpDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="followuptime">Time</Label>
                  <Input
                    type="time"
                    value={followUpTime}
                    onChange={(e) => setFollowUpTime(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="flex space-x-2">
              <Button onClick={handleDispositionSubmit} className="flex-1">
                Save Disposition
              </Button>
              <Button variant="outline" onClick={() => setShowDispositionDialog(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lead Form Dialog */}
      <Dialog open={showLeadFormDialog} onOpenChange={setShowLeadFormDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Lead</DialogTitle>
            <DialogDescription>
              Fill in the lead information to create a new inquiry
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="leadname">Name *</Label>
                <Input
                  value={newLeadForm.name}
                  onChange={(e) => setNewLeadForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Guest name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="leadphone">Phone *</Label>
                <Input
                  value={newLeadForm.phone}
                  onChange={(e) => setNewLeadForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="leademail">Email</Label>
                <Input
                  type="email"
                  value={newLeadForm.email}
                  onChange={(e) => setNewLeadForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="guest@email.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="leadproperty">Property *</Label>
                <Select value={newLeadForm.property} onValueChange={(value) => setNewLeadForm(prev => ({ ...prev, property: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                  <SelectContent>
                    {propertyOptions.map(option => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="checkin">Check-in Date</Label>
                <Input
                  type="date"
                  value={newLeadForm.checkIn}
                  onChange={(e) => setNewLeadForm(prev => ({ ...prev, checkIn: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="checkout">Check-out Date</Label>
                <Input
                  type="date"
                  value={newLeadForm.checkOut}
                  onChange={(e) => setNewLeadForm(prev => ({ ...prev, checkOut: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="guests">Number of Guests</Label>
                <Input
                  type="number"
                  min="1"
                  value={newLeadForm.guests}
                  onChange={(e) => setNewLeadForm(prev => ({ ...prev, guests: parseInt(e.target.value) }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="roomtype">Room Type</Label>
                <Select value={newLeadForm.roomType} onValueChange={(value) => setNewLeadForm(prev => ({ ...prev, roomType: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select room type" />
                  </SelectTrigger>
                  <SelectContent>
                    {roomTypeOptions.map(option => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="budget">Budget Range</Label>
                <Input
                  value={newLeadForm.budget}
                  onChange={(e) => setNewLeadForm(prev => ({ ...prev, budget: e.target.value }))}
                  placeholder="₹10,000 - ₹15,000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="source">Lead Source</Label>
                <Select value={newLeadForm.source} onValueChange={(value) => setNewLeadForm(prev => ({ ...prev, source: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">Phone Call</SelectItem>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="social">Social Media</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="walkin">Walk-in</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={newLeadForm.priority} onValueChange={(value) => setNewLeadForm(prev => ({ ...prev, priority: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex space-x-2">
              <Button onClick={handleLeadFormSubmit} className="flex-1">
                <Plus className="h-4 w-4 mr-2" />
                Create Lead & Save Notes
              </Button>
              <Button variant="outline" onClick={() => setShowLeadFormDialog(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Communication Dialogs */}
      <EmailDialog
        open={showEmailDialog}
        onOpenChange={setShowEmailDialog}
        guestEmail={guest.email}
        guestName={guest.name}
      />

    </div>
  );
};