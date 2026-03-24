
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, MapPin, Star, Calendar, Phone, Mail, Edit, MessageCircle, StickyNote } from "lucide-react";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";

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

interface GuestProfileProps {
  guest: Guest;
}

const GuestProfile = ({ guest: initialGuest }: GuestProfileProps) => {
  const [guest, setGuest] = useState(initialGuest);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [notes, setNotes] = useState<Array<{ date: string, note: string, agent: string }>>([
    { date: "2024-06-11", note: "Guest prefers early check-in when possible", agent: "Harleen Mehta" },
    { date: "2024-06-10", note: "Requested room with ocean view for anniversary", agent: "Harleen Mehta" }
  ]);

  const { toast } = useToast();

  const noteForm = useForm({
    defaultValues: {
      note: ""
    }
  });

  const emailForm = useForm({
    defaultValues: {
      subject: "",
      message: ""
    }
  });

  const bookingForm = useForm({
    defaultValues: {
      checkIn: "",
      checkOut: "",
      guests: "1",
      roomType: "",
      property: ""
    }
  });

  const editForm = useForm({
    defaultValues: {
      name: guest.name,
      phone: guest.phone,
      email: guest.email,
      property: guest.property,
      preferences: guest.preferences.join(", ")
    }
  });

  const onNoteSubmit = (data: any) => {
    const newNote = {
      date: new Date().toISOString().split('T')[0],
      note: data.note,
      agent: "Harleen Mehta"
    };
    setNotes([newNote, ...notes]);
    setIsNoteDialogOpen(false);
    noteForm.reset();
    toast({
      title: "Note saved",
      description: "Your note has been added to the guest profile."
    });
  };

  const onEmailSubmit = (data: any) => {
    // Add to interaction history
    const newInteraction = {
      date: new Date().toISOString().split('T')[0],
      type: "Email",
      channel: "Email",
      agent: "Harleen Mehta",
      summary: `Sent: "${data.subject}"`
    };

    setGuest(prev => ({
      ...prev,
      interactionHistory: [newInteraction, ...prev.interactionHistory]
    }));

    setIsEmailDialogOpen(false);
    emailForm.reset();
    toast({
      title: "Email sent",
      description: `Email "${data.subject}" has been sent to ${guest.email}.`
    });
  };

  const onBookingSubmit = (data: any) => {
    // Add to interaction history
    const newInteraction = {
      date: new Date().toISOString().split('T')[0],
      type: "Booking",
      channel: "CRM System",
      agent: "Harleen Mehta",
      summary: `New booking created at ${data.property} from ${data.checkIn} to ${data.checkOut}`
    };

    setGuest(prev => ({
      ...prev,
      interactionHistory: [newInteraction, ...prev.interactionHistory]
    }));

    setIsBookingDialogOpen(false);
    bookingForm.reset();
    toast({
      title: "Booking created",
      description: `New booking created for ${guest.name} at ${data.property} from ${data.checkIn} to ${data.checkOut}.`
    });
  };

  const onEditSubmit = (data: any) => {
    const updatedGuest = {
      ...guest,
      name: data.name,
      phone: data.phone,
      email: data.email,
      property: data.property,
      preferences: data.preferences.split(",").map((p: string) => p.trim()).filter((p: string) => p)
    };

    setGuest(updatedGuest);
    setIsEditDialogOpen(false);
    toast({
      title: "Profile updated",
      description: "Guest profile has been successfully updated."
    });
  };

  const handleWhatsApp = () => {
    const phoneNumber = guest.phone.replace(/[^\d]/g, '');
    const message = `Hello ${guest.name}, this is Harleen from Postcard Hotels. How can we assist you today?`;
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');

    // Add to interaction history
    const newInteraction = {
      date: new Date().toISOString().split('T')[0],
      type: "WhatsApp",
      channel: "WhatsApp",
      agent: "Harleen Mehta",
      summary: "WhatsApp conversation initiated"
    };

    setGuest(prev => ({
      ...prev,
      interactionHistory: [newInteraction, ...prev.interactionHistory]
    }));

    toast({
      title: "WhatsApp opened",
      description: `WhatsApp conversation started with ${guest.name}.`
    });
  };

  const handleCall = () => {
    // Add to interaction history
    const newInteraction = {
      date: new Date().toISOString().split('T')[0],
      type: "Call",
      channel: "Phone",
      agent: "Harleen Mehta",
      summary: `Outbound call to ${guest.phone}`
    };

    setGuest(prev => ({
      ...prev,
      interactionHistory: [newInteraction, ...prev.interactionHistory]
    }));

    toast({
      title: "Call initiated",
      description: `Calling ${guest.name} at ${guest.phone}...`
    });
  };

  const simulateEmailInquiry = () => {
    const newInteraction = {
      date: new Date().toISOString().split('T')[0],
      type: "Email",
      channel: "Email",
      agent: "System",
      summary: "Inquiry received: 'Interested in weekend packages for family of 4'"
    };

    setGuest(prev => ({
      ...prev,
      interactionHistory: [newInteraction, ...prev.interactionHistory]
    }));

    toast({
      title: "Email inquiry received",
      description: "New email inquiry has been logged."
    });
  };

  const getChannelIcon = (channel: string) => {
    switch (channel.toLowerCase()) {
      case 'phone': return <Phone className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      case 'whatsapp': return <MessageCircle className="h-4 w-4" />;
      case 'crm system': return <Calendar className="h-4 w-4" />;
      default: return <User className="h-4 w-4" />;
    }
  };

  const getChannelColor = (channel: string) => {
    switch (channel.toLowerCase()) {
      case 'phone': return 'bg-green-500';
      case 'email': return 'bg-blue-500';
      case 'whatsapp': return 'bg-green-400';
      case 'crm system': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const additionalGuests = [
    {
      id: "G002",
      name: "Arjun Patel",
      loyaltyStatus: "Silver",
      totalStays: 5,
      lastStay: "2024-04-22",
      phone: "+91 98765 43210",
      property: "Postcard Goa"
    },
    {
      id: "G003",
      name: "Priya Sharma",
      loyaltyStatus: "Bronze",
      totalStays: 2,
      lastStay: "2024-03-15",
      phone: "+91 87654 32109",
      property: "Postcard Kerala"
    },
    {
      id: "G004",
      name: "Rajesh Kumar",
      loyaltyStatus: "Gold",
      totalStays: 12,
      lastStay: "2024-06-01",
      phone: "+91 76543 21098",
      property: "Postcard Rajasthan"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Featured Guest Profile */}
      <Card className="bg-white shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <User className="h-6 w-6" />
              <span>Guest Profile: {guest.name}</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Badge className="bg-white text-blue-600">
                {guest.property}
              </Badge>
              <Badge className={`${guest.loyaltyStatus === 'Gold' ? 'bg-yellow-500' :
                  guest.loyaltyStatus === 'Silver' ? 'bg-gray-400' : 'bg-orange-500'
                }`}>
                {guest.loyaltyStatus} Member
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Basic Information */}
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Contact Information</p>
                    <div className="space-y-1">
                      <p className="flex items-center space-x-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span>{guest.phone}</span>
                      </p>
                      <p className="flex items-center space-x-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span>{guest.email}</span>
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Stay History</p>
                    <div className="space-y-1">
                      <p className="text-2xl font-bold text-blue-600">{guest.totalStays}</p>
                      <p className="text-sm text-gray-500">Total stays</p>
                      <p className="text-sm">Last stay: {guest.lastStay}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-2">Preferences</p>
                    <div className="space-y-2">
                      {guest.preferences.map((pref, index) => (
                        <Badge key={index} variant="outline" className="bg-blue-50 text-blue-700 mr-2">
                          {pref}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="w-full" variant="outline">
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Profile
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Guest Profile</DialogTitle>
                      </DialogHeader>
                      <Form {...editForm}>
                        <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                          <FormField
                            control={editForm.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Name</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={editForm.control}
                            name="phone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Phone</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={editForm.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={editForm.control}
                            name="property"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Property</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select property" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="Postcard Goa">Postcard Goa</SelectItem>
                                    <SelectItem value="Postcard Kerala">Postcard Kerala</SelectItem>
                                    <SelectItem value="Postcard Rajasthan">Postcard Rajasthan</SelectItem>
                                    <SelectItem value="Postcard Mumbai">Postcard Mumbai</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={editForm.control}
                            name="preferences"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Preferences (comma separated)</FormLabel>
                                <FormControl>
                                  <Input placeholder="Ocean view, Late checkout, Quiet room" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="flex justify-end space-x-2">
                            <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button type="submit">Update Profile</Button>
                          </div>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {/* Notes Section */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Guest Notes</h3>
                <div className="space-y-3 max-h-40 overflow-y-auto">
                  {notes.map((note, index) => (
                    <div key={index} className="p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg">
                      <div className="flex justify-between items-start mb-1">
                        <Badge variant="outline" className="text-xs bg-yellow-100">
                          Note
                        </Badge>
                        <span className="text-xs text-gray-500">{note.date}</span>
                      </div>
                      <p className="text-sm text-gray-700">{note.note}</p>
                      <p className="text-xs text-gray-500 mt-1">By: {note.agent}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Interaction Timeline */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Interaction History</h3>
                  <Button onClick={simulateEmailInquiry} size="sm" variant="outline">
                    Simulate Email Inquiry
                  </Button>
                </div>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {guest.interactionHistory.map((interaction, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${getChannelColor(interaction.channel)}`}>
                        {getChannelIcon(interaction.channel)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="text-xs">
                              {interaction.type}
                            </Badge>
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600">
                              {interaction.channel}
                            </Badge>
                          </div>
                          <span className="text-xs text-gray-500">{interaction.date}</span>
                        </div>
                        <p className="text-sm text-gray-700">{interaction.summary}</p>
                        <p className="text-xs text-gray-500 mt-1">Agent: {interaction.agent}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Quick Actions</h3>
              <div className="space-y-2">
                <Button onClick={handleCall} className="w-full bg-green-600 hover:bg-green-700">
                  <Phone className="h-4 w-4 mr-2" />
                  Call Guest
                </Button>
                <Button onClick={handleWhatsApp} className="w-full bg-green-500 hover:bg-green-600">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  WhatsApp
                </Button>
                <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full" variant="outline">
                      <Mail className="h-4 w-4 mr-2" />
                      Send Email
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Send Email to {guest.name}</DialogTitle>
                    </DialogHeader>
                    <Form {...emailForm}>
                      <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
                        <FormField
                          control={emailForm.control}
                          name="subject"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Subject</FormLabel>
                              <FormControl>
                                <Input placeholder="Email subject" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={emailForm.control}
                          name="message"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Message</FormLabel>
                              <FormControl>
                                <Textarea placeholder="Your message..." {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end space-x-2">
                          <Button type="button" variant="outline" onClick={() => setIsEmailDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit">Send Email</Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
                <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full" variant="outline">
                      <Calendar className="h-4 w-4 mr-2" />
                      New Booking
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Booking for {guest.name}</DialogTitle>
                    </DialogHeader>
                    <Form {...bookingForm}>
                      <form onSubmit={bookingForm.handleSubmit(onBookingSubmit)} className="space-y-4">
                        <FormField
                          control={bookingForm.control}
                          name="property"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Property</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select property" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Postcard Goa">Postcard Goa</SelectItem>
                                  <SelectItem value="Postcard Kerala">Postcard Kerala</SelectItem>
                                  <SelectItem value="Postcard Rajasthan">Postcard Rajasthan</SelectItem>
                                  <SelectItem value="Postcard Mumbai">Postcard Mumbai</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={bookingForm.control}
                            name="checkIn"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Check-in</FormLabel>
                                <FormControl>
                                  <Input type="date" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={bookingForm.control}
                            name="checkOut"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Check-out</FormLabel>
                                <FormControl>
                                  <Input type="date" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={bookingForm.control}
                          name="guests"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Number of Guests</FormLabel>
                              <FormControl>
                                <Input type="number" min="1" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={bookingForm.control}
                          name="roomType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Room Type</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., Ocean View Suite" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end space-x-2">
                          <Button type="button" variant="outline" onClick={() => setIsBookingDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit">Create Booking</Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
                <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full" variant="outline">
                      <StickyNote className="h-4 w-4 mr-2" />
                      Add Note
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Note for {guest.name}</DialogTitle>
                    </DialogHeader>
                    <Form {...noteForm}>
                      <form onSubmit={noteForm.handleSubmit(onNoteSubmit)} className="space-y-4">
                        <FormField
                          control={noteForm.control}
                          name="note"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Note</FormLabel>
                              <FormControl>
                                <Textarea placeholder="Enter your note..." {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end space-x-2">
                          <Button type="button" variant="outline" onClick={() => setIsNoteDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit">Save Note</Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Loyalty Progress */}
              <div className="p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg">
                <h4 className="font-semibold text-yellow-800 mb-2">Loyalty Progress</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Current: {guest.loyaltyStatus}</span>
                    <span>{guest.totalStays}/15 stays</span>
                  </div>
                  <div className="w-full bg-yellow-200 rounded-full h-2">
                    <div
                      className="bg-yellow-500 h-2 rounded-full"
                      style={{ width: `${(guest.totalStays / 15) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-yellow-700">
                    {15 - guest.totalStays} more stays to Platinum
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Other Guest Profiles */}
      <Card className="bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Other Guest Profiles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {additionalGuests.map((additionalGuest, index) => (
              <div key={index} className="p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">{additionalGuest.name}</h4>
                  <Badge variant="outline" className={`${additionalGuest.loyaltyStatus === 'Gold' ? 'bg-yellow-50 text-yellow-700' :
                      additionalGuest.loyaltyStatus === 'Silver' ? 'bg-gray-50 text-gray-700' : 'bg-orange-50 text-orange-700'
                    }`}>
                    {additionalGuest.loyaltyStatus}
                  </Badge>
                </div>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>{additionalGuest.phone}</p>
                  <p>{additionalGuest.totalStays} stays</p>
                  <p>Last: {additionalGuest.lastStay}</p>
                  <p className="font-medium text-blue-600">{additionalGuest.property}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GuestProfile;
