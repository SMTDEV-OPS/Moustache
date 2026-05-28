import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  createQuotation,
  listQuotations,
  Quotation,
  QuotationBookingDetails,
  SendVia,
  CreateQuotationPayload,
} from "@/services/quotations";
import { Lead, LeadDetail, getLeadContactInfo } from "@/services/leads";
import { listEmailAccounts, EmailAccount } from "@/services/email";
import { useToast } from "@/hooks/use-toast";
import {
  Mail,
  MessageCircle,
  FileText,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  IndianRupee,
  Hotel,
  CalendarDays,
  Users,
  AlertTriangle,
  Plus,
  Trash2,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface SendQuotationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  leadDetail?: LeadDetail | null;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  propertyName?: string;
  onQuotationSent?: () => void;
}

type QuotationRoomForm = {
  roomCategory: string;
  roomPreference: string;
  numberOfGuests: string;
};

type QuotationHotelForm = {
  hotelName: string;
  checkInDate: string;
  checkOutDate: string;
  rooms: QuotationRoomForm[];
};

export const SendQuotationDialog = ({
  open,
  onOpenChange,
  lead,
  leadDetail,
  guestName,
  guestEmail,
  guestPhone,
  propertyName,
  onQuotationSent,
}: SendQuotationDialogProps) => {
  const primaryItinerary = lead?.itineraries?.[0];
  const checkInDate = primaryItinerary?.checkInDate;
  const checkOutDate = primaryItinerary?.checkOutDate;
  const roomDetails = primaryItinerary?.rooms || [];
  const deriveRoomCount = () => {
    if (roomDetails.length > 0) return String(roomDetails.length);
    const firstRoomGuests = roomDetails[0]?.numberOfGuests;
    if (firstRoomGuests && !Number.isNaN(Number(firstRoomGuests))) {
      return String(Math.max(1, Number(firstRoomGuests)));
    }
    return "1";
  };

  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"create" | "history">("create");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [quotationHistory, setQuotationHistory] = useState<Quotation[]>([]);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);

  // Form state
  const [sendVia, setSendVia] = useState<SendVia>("EMAIL");
  const [rooms, setRooms] = useState<string>(
    lead?.roomsRequested?.toString() || "1"
  );
  const [rate, setRate] = useState<string>("");
  const [taxes, setTaxes] = useState<string>("");
  const [inclusions, setInclusions] = useState<string>(
    "Breakfast included\nWi-Fi\nPool access"
  );
  const [specialPackages, setSpecialPackages] = useState<string>("");
  const [recipientName, setRecipientName] = useState<string>(guestName || "");
  const [recipientEmail, setRecipientEmail] = useState<string>(guestEmail || "");
  const [recipientPhone, setRecipientPhone] = useState<string>(guestPhone || "");
  const [bookingHotels, setBookingHotels] = useState<QuotationHotelForm[]>([
    { hotelName: propertyName || "", checkInDate: "", checkOutDate: "", rooms: [{ roomCategory: "", roomPreference: "", numberOfGuests: "" }] },
  ]);

  // Update recipient fields when props change
  useEffect(() => {
    const leadContact = lead ? getLeadContactInfo(lead) : { name: "", email: "", phone: "" };

    setRecipientName(guestName || leadContact.name || "");
    setRecipientEmail(guestEmail || leadContact.email || "");
    setRecipientPhone(guestPhone || leadContact.phone || "");
    setRooms(deriveRoomCount());
    if (lead?.itineraries?.length) {
      setBookingHotels(
        lead.itineraries.map((it) => ({
          hotelName: it.hotelName || propertyName || "",
          checkInDate: it.checkInDate ? String(it.checkInDate).slice(0, 10) : "",
          checkOutDate: it.checkOutDate ? String(it.checkOutDate).slice(0, 10) : "",
          rooms:
            it.rooms && it.rooms.length > 0
              ? it.rooms.map((r) => ({
                  roomCategory: r.roomCategory || "",
                  roomPreference: r.roomPreference || "",
                  numberOfGuests: r.numberOfGuests || "",
                }))
              : [{ roomCategory: "", roomPreference: "", numberOfGuests: "" }],
        }))
      );
    }

    if (!specialPackages?.trim()) {
      const suggested: string[] = [];
      if (lead?.specialRequests) suggested.push(`Special requests: ${lead.specialRequests}`);
      if (lead?.occasion) suggested.push(`Occasion: ${lead.occasion}`);
      if (lead?.isCorporateBooking) {
        suggested.push(
          `Corporate booking${lead.companyName ? ` (${lead.companyName})` : ""}`
        );
      }
      setSpecialPackages(suggested.join("\n"));
    }
  }, [guestName, guestEmail, guestPhone, lead]);

  // Load quotation history and email accounts when dialog opens
  useEffect(() => {
    if (open && lead?.id) {
      loadQuotationHistory();
      loadEmailAccounts();
    }
  }, [open, lead?.id]);

  const loadEmailAccounts = async () => {
    try {
      setIsLoadingAccounts(true);
      const accounts = await listEmailAccounts();
      setEmailAccounts(accounts);
    } catch (err) {
      console.error("Failed to load email accounts:", err);
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  const hasEmailAccount = emailAccounts.length > 0;
  const primaryEmailAccount = emailAccounts.find(acc => acc.isPrimary) || emailAccounts[0];

  const loadQuotationHistory = async () => {
    if (!lead?.id) return;
    try {
      setIsLoadingHistory(true);
      const history = await listQuotations(lead.id);
      setQuotationHistory(history);
    } catch (err) {
      console.error("Failed to load quotation history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const calculateTotal = () => {
    const rateNum = parseFloat(rate) || 0;
    const taxesNum = parseFloat(taxes) || 0;
    const roomsNum = parseInt(rooms) || 1;
    const nights = calculateNights();
    return (rateNum * roomsNum * nights) + taxesNum;
  };

  const calculateNights = () => {
    if (!checkInDate || !checkOutDate) return 1;
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    const diff = Math.ceil(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
    );
    return diff > 0 ? diff : 1;
  };

  const handleSendQuotation = async () => {
    if (!lead?.id) return;

    // Validate based on send method
    if (sendVia === "EMAIL" && !recipientEmail) {
      toast({
        title: "Email Required",
        description: "Please enter an email address to send the quotation",
        variant: "destructive",
      });
      return;
    }

    if (sendVia === "WHATSAPP" && !recipientPhone) {
      toast({
        title: "Phone Required",
        description: "Please enter a phone number to send the quotation via WhatsApp",
        variant: "destructive",
      });
      return;
    }

    if (!rate) {
      toast({
        title: "Rate Required",
        description: "Please enter the room rate",
        variant: "destructive",
      });
      return;
    }

    if (
      bookingHotels.some(
        (h) => !h.hotelName.trim() || !h.checkInDate || !h.checkOutDate
      )
    ) {
      toast({
        title: "Booking Details Required",
        description: "Please fill hotel name, check-in, and check-out for each hotel section",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSending(true);
      const bookingDetails: QuotationBookingDetails = {
        checkInDate: bookingHotels[0]?.checkInDate || checkInDate,
        checkOutDate: bookingHotels[0]?.checkOutDate || checkOutDate,
        nights: calculateNights(),
        adults: lead?.guests?.adults || 0,
        children: lead?.guests?.children || 0,
        occasion: lead?.occasion,
        specialRequests: lead?.specialRequests,
        bookingSource: lead?.bookingSource,
        roomDetails: bookingHotels[0]?.rooms?.map((room) => ({
          roomCategory: room.roomCategory,
          roomPreference: room.roomPreference,
          numberOfGuests: room.numberOfGuests,
        })),
        hotels: bookingHotels.map((hotel) => ({
          hotelName: hotel.hotelName,
          checkInDate: hotel.checkInDate,
          checkOutDate: hotel.checkOutDate,
          rooms: hotel.rooms.map((room) => ({
            roomCategory: room.roomCategory,
            roomPreference: room.roomPreference,
            numberOfGuests: room.numberOfGuests,
          })),
        })),
      };

      const payload: CreateQuotationPayload = {
        rooms: parseInt(rooms) || 1,
        rate: parseFloat(rate) || 0,
        taxes: parseFloat(taxes) || 0,
        inclusions,
        specialPackages,
        sentVia: sendVia,
        sentTo: {
          name: recipientName,
          email: recipientEmail,
          phone: recipientPhone,
        },
        bookingDetails,
      };

      await createQuotation(lead.id, payload);

      toast({
        title: "Quotation Sent",
        description: `Quotation sent successfully via ${sendVia === "EMAIL" ? "Email" : "WhatsApp"}`,
      });

      // Reload history
      await loadQuotationHistory();

      // Switch to history tab to show the sent quotation
      setActiveTab("history");

      // Notify parent
      onQuotationSent?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send quotation";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "SENT":
        return <Clock className="h-4 w-4 text-blue-500" />;
      case "ACCEPTED":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "REJECTED":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "REVISED":
        return <RefreshCw className="h-4 w-4 text-orange-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "SENT":
        return "bg-blue-100 text-blue-800";
      case "ACCEPTED":
        return "bg-green-100 text-green-800";
      case "REJECTED":
        return "bg-red-100 text-red-800";
      case "REVISED":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Send Quotation
            {lead && (
              <Badge variant="outline" className="ml-2">
                Lead #{lead.leadNumber}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "create" | "history")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">
              <Send className="h-4 w-4 mr-2" />
              Create Quotation
            </TabsTrigger>
            <TabsTrigger value="history">
              <Clock className="h-4 w-4 mr-2" />
              History ({quotationHistory.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto pr-2">
            {/* Lead Summary */}
            {lead && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h4 className="font-medium text-sm">Lead Details</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {propertyName && (
                    <div className="flex items-center gap-2">
                      <Hotel className="h-4 w-4 text-muted-foreground" />
                      <span>{propertyName}</span>
                    </div>
                  )}
                  {checkInDate && checkOutDate && (
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {new Date(checkInDate).toLocaleDateString()} -{" "}
                        {new Date(checkOutDate).toLocaleDateString()}
                        <span className="text-muted-foreground ml-1">
                          ({calculateNights()} nights)
                        </span>
                      </span>
                    </div>
                  )}
                  {lead.guests && (
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {lead.guests.adults || 0} Adults
                        {lead.guests.children ? `, ${lead.guests.children} Children` : ""}
                      </span>
                    </div>
                  )}
                  {lead.budget && (
                    <div className="flex items-center gap-2">
                      <IndianRupee className="h-4 w-4 text-muted-foreground" />
                      <span>Budget: {new Intl.NumberFormat("en-IN").format(lead.budget)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Email Account Warning */}
            {sendVia === "EMAIL" && !hasEmailAccount && !isLoadingAccounts && (
              <Alert variant="destructive" className="border-amber-500 bg-amber-50 text-amber-900">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>No Email Account Connected</AlertTitle>
                <AlertDescription>
                  To send quotations via email, please connect your email account in{" "}
                  <a href="/email-settings" className="underline font-medium">
                    Email Settings
                  </a>
                  . The quotation will be saved but won't be delivered via email.
                </AlertDescription>
              </Alert>
            )}

            {/* Email Account Info */}
            {sendVia === "EMAIL" && hasEmailAccount && primaryEmailAccount && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-green-800">
                  Email will be sent from: <strong>{primaryEmailAccount.email}</strong>
                </span>
              </div>
            )}

            {/* Send Method */}
            <div className="space-y-3">
              <Label>Send Via</Label>
              <RadioGroup
                value={sendVia}
                onValueChange={(v) => setSendVia(v as SendVia)}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="EMAIL" id="email" />
                  <Label htmlFor="email" className="flex items-center gap-2 cursor-pointer">
                    <Mail className="h-4 w-4 text-blue-600" />
                    Email
                    {hasEmailAccount && (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    )}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="WHATSAPP" id="whatsapp" />
                  <Label htmlFor="whatsapp" className="flex items-center gap-2 cursor-pointer">
                    <MessageCircle className="h-4 w-4 text-green-600" />
                    WhatsApp
                    <span className="text-xs text-muted-foreground">(Coming soon)</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Recipient Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="recipientName">Recipient Name</Label>
                <Input
                  id="recipientName"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Guest name"
                />
              </div>
              {sendVia === "EMAIL" ? (
                <div className="space-y-2">
                  <Label htmlFor="recipientEmail">Email Address *</Label>
                  <Input
                    id="recipientEmail"
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="email@example.com"
                    required
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="recipientPhone">Phone Number *</Label>
                  <Input
                    id="recipientPhone"
                    type="tel"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    required
                  />
                </div>
              )}
            </div>

            <Separator />

            {/* Pricing Details */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Pricing Details</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rooms">Number of Rooms</Label>
                  <Input
                    id="rooms"
                    type="number"
                    min="1"
                    value={rooms}
                    onChange={(e) => setRooms(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rate">Rate per Room/Night (₹) *</Label>
                  <Input
                    id="rate"
                    type="number"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    placeholder="5000"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxes">Taxes & Fees (₹)</Label>
                  <Input
                    id="taxes"
                    type="number"
                    value={taxes}
                    onChange={(e) => setTaxes(e.target.value)}
                    placeholder="900"
                  />
                </div>
              </div>

              {/* Total Calculation */}
              <div className="bg-primary/5 rounded-lg p-4 flex items-center justify-between">
                <span className="font-medium">Estimated Total</span>
                <span className="text-xl font-bold flex items-center">
                  <IndianRupee className="h-5 w-5" />
                  {calculateTotal().toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            <Separator />

            {/* Booking Details */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Hotel Details</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setBookingHotels((prev) => [
                      ...prev,
                      {
                        hotelName: propertyName || "",
                        checkInDate: "",
                        checkOutDate: "",
                        rooms: [{ roomCategory: "", roomPreference: "", numberOfGuests: "" }],
                      },
                    ])
                  }
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Hotel
                </Button>
              </div>

              {bookingHotels.map((hotel, hotelIdx) => (
                <div key={hotelIdx} className="border rounded-md p-3 space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm font-medium">Hotel #{hotelIdx + 1}</Label>
                    {bookingHotels.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setBookingHotels((prev) => prev.filter((_, i) => i !== hotelIdx))
                        }
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>Hotel Name *</Label>
                      <Input
                        value={hotel.hotelName}
                        onChange={(e) =>
                          setBookingHotels((prev) =>
                            prev.map((h, i) =>
                              i === hotelIdx ? { ...h, hotelName: e.target.value } : h
                            )
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Check-in *</Label>
                      <Input
                        type="date"
                        value={hotel.checkInDate}
                        onChange={(e) =>
                          setBookingHotels((prev) =>
                            prev.map((h, i) => {
                              if (i !== hotelIdx) return h;
                              const next = { ...h, checkInDate: e.target.value };
                              if (
                                next.checkOutDate &&
                                e.target.value &&
                                next.checkOutDate < e.target.value
                              ) {
                                next.checkOutDate = "";
                              }
                              return next;
                            })
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Check-out *</Label>
                      <Input
                        type="date"
                        min={hotel.checkInDate || undefined}
                        value={hotel.checkOutDate}
                        onChange={(e) =>
                          setBookingHotels((prev) =>
                            prev.map((h, i) =>
                              i === hotelIdx ? { ...h, checkOutDate: e.target.value } : h
                            )
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Rooms</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setBookingHotels((prev) =>
                            prev.map((h, i) =>
                              i === hotelIdx
                                ? {
                                    ...h,
                                    rooms: [
                                      ...h.rooms,
                                      { roomCategory: "", roomPreference: "", numberOfGuests: "" },
                                    ],
                                  }
                                : h
                            )
                          )
                        }
                      >
                        <Plus className="h-4 w-4 mr-1" /> Add Room
                      </Button>
                    </div>

                    {hotel.rooms.map((room, roomIdx) => (
                      <div key={roomIdx} className="grid grid-cols-1 md:grid-cols-3 gap-3 border rounded p-2">
                        <div className="space-y-1">
                          <Label>Room Category</Label>
                          <Input
                            value={room.roomCategory}
                            onChange={(e) =>
                              setBookingHotels((prev) =>
                                prev.map((h, i) =>
                                  i === hotelIdx
                                    ? {
                                        ...h,
                                        rooms: h.rooms.map((r, ri) =>
                                          ri === roomIdx ? { ...r, roomCategory: e.target.value } : r
                                        ),
                                      }
                                    : h
                                )
                              )
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Room Preference</Label>
                          <Input
                            value={room.roomPreference}
                            onChange={(e) =>
                              setBookingHotels((prev) =>
                                prev.map((h, i) =>
                                  i === hotelIdx
                                    ? {
                                        ...h,
                                        rooms: h.rooms.map((r, ri) =>
                                          ri === roomIdx ? { ...r, roomPreference: e.target.value } : r
                                        ),
                                      }
                                    : h
                                )
                              )
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>No. of Guests</Label>
                          <Input
                            value={room.numberOfGuests}
                            onChange={(e) =>
                              setBookingHotels((prev) =>
                                prev.map((h, i) =>
                                  i === hotelIdx
                                    ? {
                                        ...h,
                                        rooms: h.rooms.map((r, ri) =>
                                          ri === roomIdx ? { ...r, numberOfGuests: e.target.value } : r
                                        ),
                                      }
                                    : h
                                )
                              )
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Occasion</Label>
                  <Input value={lead?.occasion || ""} readOnly />
                </div>
                <div className="space-y-2">
                  <Label>Booking Source</Label>
                  <Input value={lead?.bookingSource || ""} readOnly />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Special Requests</Label>
                <Textarea value={lead?.specialRequests || ""} rows={2} readOnly />
              </div>
            </div>

            <Separator />

            {/* Inclusions & Packages */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="inclusions">Inclusions</Label>
                <Textarea
                  id="inclusions"
                  value={inclusions}
                  onChange={(e) => setInclusions(e.target.value)}
                  placeholder="Breakfast, Wi-Fi, Pool access..."
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="specialPackages">Special Packages</Label>
                <Textarea
                  id="specialPackages"
                  value={specialPackages}
                  onChange={(e) => setSpecialPackages(e.target.value)}
                  placeholder="Honeymoon package, Spa credits..."
                  rows={4}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <ScrollArea className="h-[400px]">
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <span className="text-sm text-muted-foreground">Loading quotation history...</span>
                </div>
              ) : quotationHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">No quotations sent yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create and send your first quotation to this lead
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {quotationHistory.map((quote) => (
                    <div
                      key={quote.id}
                      className="border rounded-lg p-4 space-y-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(quote.status)}
                          <span className="font-medium">Version {quote.versionNumber}</span>
                          <Badge className={getStatusColor(quote.status)}>
                            {quote.status}
                          </Badge>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          {quote.sentAt && (
                            <div className="flex items-center gap-1">
                              {quote.sentVia === "EMAIL" ? (
                                <Mail className="h-3 w-3" />
                              ) : (
                                <MessageCircle className="h-3 w-3" />
                              )}
                              {new Date(quote.sentAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Rooms:</span>{" "}
                          <span className="font-medium">{quote.rooms || 1}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Rate:</span>{" "}
                          <span className="font-medium">
                            {quote.rate ? formatCurrency(quote.rate) : "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Taxes:</span>{" "}
                          <span className="font-medium">
                            {quote.taxes ? formatCurrency(quote.taxes) : "-"}
                          </span>
                        </div>
                      </div>

                      {quote.sentTo && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Sent to:</span>{" "}
                          <span>
                            {quote.sentTo.name}
                            {quote.sentTo.email && ` (${quote.sentTo.email})`}
                            {quote.sentTo.phone && ` - ${quote.sentTo.phone}`}
                          </span>
                        </div>
                      )}

                      {quote.inclusions && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Inclusions:</span>{" "}
                          <span className="whitespace-pre-line">{quote.inclusions}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {activeTab === "create" && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendQuotation} disabled={isSending}>
              {isSending ? (
                "Sending..."
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send {sendVia === "EMAIL" ? "Email" : "WhatsApp"}
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

