
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, PhoneOff, User, MapPin, Star, Clock, Mic, MicOff, MessageCircle, Mail, Edit, StickyNote, Send } from "lucide-react";
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

interface CallInterfaceProps {
  guest: Guest;
  incomingCall: boolean;
  onCallEnd: () => void;
}

const CallInterface = ({ guest: initialGuest, incomingCall, onCallEnd }: CallInterfaceProps) => {
  const [guest, setGuest] = useState(initialGuest);
  const [callActive, setCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [callNotes, setCallNotes] = useState("");
  const [showGuestInfo, setShowGuestInfo] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [isSMSDialogOpen, setIsSMSDialogOpen] = useState(false);

  const { toast } = useToast();

  const emailForm = useForm({
    defaultValues: {
      subject: "",
      message: ""
    }
  });

  const noteForm = useForm({
    defaultValues: {
      note: ""
    }
  });

  const smsForm = useForm({
    defaultValues: {
      message: ""
    }
  });

  useEffect(() => {
    if (incomingCall) {
      setShowGuestInfo(true);
    }
  }, [incomingCall]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callActive) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callActive]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerCall = () => {
    setCallActive(true);
    setCallDuration(0);
  };

  const handleEndCall = () => {
    setCallActive(false);
    setCallDuration(0);
    onCallEnd();
    setShowGuestInfo(false);
  };

  const handleWhatsApp = () => {
    const phoneNumber = guest.phone.replace(/[^\d]/g, '');
    const message = `Hello ${guest.name}, this is from Postcard Hotels. How can we assist you today?`;
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');

    // Add to interaction history
    const newInteraction = {
      date: new Date().toISOString().split('T')[0],
      type: "WhatsApp",
      channel: "WhatsApp",
      agent: "Call Center Agent",
      summary: "WhatsApp conversation initiated from call interface"
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

  const onEmailSubmit = (data: any) => {
    // Add to interaction history
    const newInteraction = {
      date: new Date().toISOString().split('T')[0],
      type: "Email",
      channel: "Email",
      agent: "Call Center Agent",
      summary: `Email sent: "${data.subject}"`
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

  const onSMSSubmit = (data: any) => {
    // Add to interaction history
    const newInteraction = {
      date: new Date().toISOString().split('T')[0],
      type: "SMS",
      channel: "SMS",
      agent: "Call Center Agent",
      summary: `SMS sent: "${data.message.substring(0, 50)}..."`
    };

    setGuest(prev => ({
      ...prev,
      interactionHistory: [newInteraction, ...prev.interactionHistory]
    }));

    setIsSMSDialogOpen(false);
    smsForm.reset();
    toast({
      title: "SMS sent",
      description: `SMS has been sent to ${guest.phone}.`
    });
  };

  const onNoteSubmit = (data: any) => {
    // Add to interaction history
    const newInteraction = {
      date: new Date().toISOString().split('T')[0],
      type: "Note",
      channel: "CRM System",
      agent: "Call Center Agent",
      summary: `Note added: "${data.note.substring(0, 50)}..."`
    };

    setGuest(prev => ({
      ...prev,
      interactionHistory: [newInteraction, ...prev.interactionHistory]
    }));

    setIsNoteDialogOpen(false);
    noteForm.reset();
    toast({
      title: "Note saved",
      description: "Your note has been added to the guest profile."
    });
  };

  const getChannelIcon = (channel: string) => {
    switch (channel.toLowerCase()) {
      case 'phone': return <Phone className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      case 'whatsapp': return <MessageCircle className="h-4 w-4" />;
      case 'sms': return <Send className="h-4 w-4" />;
      case 'crm system': return <StickyNote className="h-4 w-4" />;
      default: return <User className="h-4 w-4" />;
    }
  };

  const getChannelColor = (channel: string) => {
    switch (channel.toLowerCase()) {
      case 'phone': return 'bg-green-500';
      case 'email': return 'bg-blue-500';
      case 'whatsapp': return 'bg-green-400';
      case 'sms': return 'bg-orange-500';
      case 'crm system': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Incoming Call Alert */}
      {incomingCall && !callActive && (
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg animate-pulse">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                  <Phone className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Incoming Call</h3>
                  <p className="text-blue-100">{guest.phone}</p>
                  <p className="text-blue-100">Identified: {guest.name}</p>
                </div>
              </div>
              <div className="flex space-x-3">
                <Button onClick={handleAnswerCall} className="bg-green-600 hover:bg-green-700">
                  <Phone className="h-4 w-4 mr-2" />
                  Answer
                </Button>
                <Button onClick={handleEndCall} variant="outline" className="border-white text-white hover:bg-white hover:text-blue-600">
                  <PhoneOff className="h-4 w-4 mr-2" />
                  Decline
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Call Interface */}
      {callActive && (
        <Card className="bg-green-50 border-green-200 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 bg-green-600 rounded-full flex items-center justify-center">
                  <Phone className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-green-900">Call Active</h3>
                  <p className="text-green-700">{guest.name} • {guest.phone}</p>
                  <p className="text-green-600 flex items-center space-x-1">
                    <Clock className="h-4 w-4" />
                    <span>{formatDuration(callDuration)}</span>
                  </p>
                </div>
              </div>
              <div className="flex space-x-3">
                <Button
                  onClick={() => setMuted(!muted)}
                  variant="outline"
                  className={muted ? "bg-red-100 border-red-300" : ""}
                >
                  {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                <Button onClick={handleEndCall} className="bg-red-600 hover:bg-red-700">
                  <PhoneOff className="h-4 w-4 mr-2" />
                  End Call
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Guest Information Panel */}
      {showGuestInfo && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Guest Profile */}
          <Card className="lg:col-span-2 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5 text-blue-600" />
                <span>Guest Profile</span>
                <Badge className={`ml-auto ${guest.loyaltyStatus === 'Gold' ? 'bg-yellow-500' :
                    guest.loyaltyStatus === 'Silver' ? 'bg-gray-400' : 'bg-blue-500'
                  }`}>
                  {guest.loyaltyStatus}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">Name</p>
                  <p className="text-lg font-semibold">{guest.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Stays</p>
                  <p className="text-lg font-semibold">{guest.totalStays}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Email</p>
                  <p className="text-sm">{guest.email}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Last Stay</p>
                  <p className="text-sm">{guest.lastStay}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">Preferences</p>
                <div className="flex flex-wrap gap-2">
                  {guest.preferences.map((pref, index) => (
                    <Badge key={index} variant="outline" className="bg-blue-50 text-blue-700">
                      {pref}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">Recent Interactions</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {guest.interactionHistory.map((interaction, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${getChannelColor(interaction.channel)}`}>
                        {getChannelIcon(interaction.channel)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <Badge variant="outline" className="text-xs">
                            {interaction.type}
                          </Badge>
                          <span className="text-xs text-gray-500">{interaction.date}</span>
                        </div>
                        <p className="text-sm text-gray-700">{interaction.summary}</p>
                        <p className="text-xs text-gray-500 mt-1">Agent: {interaction.agent}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div>
                <p className="text-sm font-medium text-gray-600 mb-3">Quick Actions</p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  <Button
                    onClick={handleWhatsApp}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    WhatsApp
                  </Button>

                  <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                        <Mail className="h-4 w-4 mr-2" />
                        Email
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
                                  <Input placeholder="Email subject..." {...field} />
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
                                  <Textarea placeholder="Your message..." rows={4} {...field} />
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

                  <Dialog open={isSMSDialogOpen} onOpenChange={setIsSMSDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white">
                        <Send className="h-4 w-4 mr-2" />
                        SMS
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Send SMS to {guest.name}</DialogTitle>
                      </DialogHeader>
                      <Form {...smsForm}>
                        <form onSubmit={smsForm.handleSubmit(onSMSSubmit)} className="space-y-4">
                          <FormField
                            control={smsForm.control}
                            name="message"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Message</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="Your SMS message..."
                                    rows={3}
                                    maxLength={160}
                                    {...field}
                                  />
                                </FormControl>
                                <p className="text-xs text-gray-500">{field.value?.length || 0}/160 characters</p>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="flex justify-end space-x-2">
                            <Button type="button" variant="outline" onClick={() => setIsSMSDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button type="submit">Send SMS</Button>
                          </div>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
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
                                  <Textarea placeholder="Add your note..." rows={4} {...field} />
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
              </div>
            </CardContent>
          </Card>

          {/* Call Notes */}
          <Card className="bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Call Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Enter call notes here..."
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                className="min-h-[300px] resize-none"
              />
              <Button className="w-full mt-4" disabled={!callNotes.trim()}>
                Save Notes
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Demo Instructions */}
      {!incomingCall && !callActive && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-6 text-center">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">Call Center Demo</h3>
            <p className="text-blue-700 mb-4">
              Click "Simulate Call" in the header to see how agents receive calls with complete guest context.
            </p>
            <div className="text-sm text-blue-600 space-y-1">
              <p>• Automatic caller identification</p>
              <p>• Complete interaction history</p>
              <p>• Guest preferences and loyalty status</p>
              <p>• Real-time call logging</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CallInterface;
