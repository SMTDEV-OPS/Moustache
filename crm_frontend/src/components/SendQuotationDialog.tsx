import { useState, useEffect, useRef } from "react";
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
  SendVia,
  CreateQuotationPayload,
} from "@/services/quotations";
import { Lead, LeadDetail } from "@/services/leads";
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
  ChevronDown,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { getKBForQuotation, type KBForQuotationResponse } from "@/services/knowledgeBase";
import { getPropertyEzeeRates, type EzeeRateSuggestion } from "@/services/properties";
import { KBQuickDrawer } from "@/components/knowledge/directory/KBQuickDrawer";
import { extractLeadPropertyId } from "@/lib/leadPropertyId";

const DEFAULT_INCLUSIONS = "Breakfast included\nWi-Fi\nPool access";

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
  const [inclusions, setInclusions] = useState<string>(DEFAULT_INCLUSIONS);
  const [specialPackages, setSpecialPackages] = useState<string>("");
  const [recipientName, setRecipientName] = useState<string>(guestName || "");
  const [recipientEmail, setRecipientEmail] = useState<string>(guestEmail || "");
  const [recipientPhone, setRecipientPhone] = useState<string>(guestPhone || "");

  const [kbData, setKbData] = useState<KBForQuotationResponse | null>(null);
  const [kbLoading, setKbLoading] = useState(false);
  const [ezeeRates, setEzeeRates] = useState<EzeeRateSuggestion[]>([]);
  const [ezeeLoading, setEzeeLoading] = useState(false);
  const [showAllKbRules, setShowAllKbRules] = useState(false);
  const kbInclusionsAppliedRef = useRef(false);
  const [kbDirectoryDrawerOpen, setKbDirectoryDrawerOpen] = useState(false);

  // Update recipient fields when props change
  useEffect(() => {
    if (guestName) setRecipientName(guestName);
    if (guestEmail) setRecipientEmail(guestEmail);
    if (guestPhone) setRecipientPhone(guestPhone);
    if (lead?.roomsRequested) setRooms(lead.roomsRequested.toString());
  }, [guestName, guestEmail, guestPhone, lead]);

  const toYmd = (d: string | undefined) => {
    if (!d) return null;
    const x = new Date(d);
    if (Number.isNaN(x.getTime())) return null;
    return x.toISOString().slice(0, 10);
  };

  const getLeadPropertyId = (): string | null =>
    extractLeadPropertyId(lead, leadDetail?.lead);

  const getLeadDates = (): { checkIn: string | null; checkOut: string | null } => {
    const checkInRaw =
      lead?.checkInDate ??
      (lead as any)?.itineraries?.[0]?.checkInDate ??
      (leadDetail as any)?.lead?.checkInDate;
    const checkOutRaw =
      lead?.checkOutDate ??
      (lead as any)?.itineraries?.[0]?.checkOutDate ??
      (leadDetail as any)?.lead?.checkOutDate;
    return { checkIn: toYmd(checkInRaw), checkOut: toYmd(checkOutRaw) };
  };

  const effectivePropertyId = getLeadPropertyId();
  const { checkIn: effectiveCheckIn, checkOut: effectiveCheckOut } = getLeadDates();

  // Load quotation history, email accounts, KB, and Ezee rate suggestions when dialog opens
  useEffect(() => {
    if (!open) {
      setKbData(null);
      setEzeeRates([]);
      kbInclusionsAppliedRef.current = false;
      setShowAllKbRules(false);
      setKbDirectoryDrawerOpen(false);
      return;
    }
    if (open && lead?.id) {
      loadQuotationHistory();
      loadEmailAccounts();
    }
  }, [open, lead?.id]);

  useEffect(() => {
    if (!open || !lead?.id || !effectivePropertyId) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setKbLoading(true);
        const data = await getKBForQuotation(effectivePropertyId);
        if (cancelled) return;
        setKbData(data);

        if (!kbInclusionsAppliedRef.current && data.factsheet) {
          const lines: string[] = [];
          if (data.factsheet.generalInfo?.length) {
            lines.push(...data.factsheet.generalInfo);
          }
          if (data.factsheet.hotelAmenities?.length) {
            lines.push(...data.factsheet.hotelAmenities);
          }
          if (lines.length > 0) {
            setInclusions(lines.join("\n"));
            kbInclusionsAppliedRef.current = true;
          }
        }
      } catch (err) {
        console.error("Failed to load KB for quotation:", err);
      } finally {
        if (!cancelled) setKbLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, lead?.id, effectivePropertyId]);

  useEffect(() => {
    if (!open || !effectivePropertyId || !effectiveCheckIn || !effectiveCheckOut) {
      setEzeeRates([]);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setEzeeLoading(true);
        const res = await getPropertyEzeeRates(
          effectivePropertyId,
          effectiveCheckIn,
          effectiveCheckOut
        );
        if (cancelled) return;
        setEzeeRates(res.available ? res.rates : []);
      } catch {
        if (!cancelled) setEzeeRates([]);
      } finally {
        if (!cancelled) setEzeeLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, effectivePropertyId, effectiveCheckIn, effectiveCheckOut]);

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
    if (!lead?.checkInDate || !lead?.checkOutDate) return 1;
    const checkIn = new Date(lead.checkInDate);
    const checkOut = new Date(lead.checkOutDate);
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

    try {
      setIsSending(true);

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
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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

          <TabsContent value="create" className="space-y-4 mt-4">
            {/* Lead Summary */}
            {lead && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h4 className="font-medium text-sm">Lead Details</h4>
                {effectivePropertyId ? (
                  <div className="flex flex-wrap items-center gap-2 pb-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-sm text-xs h-8"
                      onClick={() => setKbDirectoryDrawerOpen(true)}
                    >
                      View hotel directory
                    </Button>
                    <span className="text-[11px] text-muted-foreground">
                      Property KB (rooms, amenities, contacts)
                    </span>
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {propertyName && (
                    <div className="flex items-center gap-2">
                      <Hotel className="h-4 w-4 text-muted-foreground" />
                      <span>{propertyName}</span>
                    </div>
                  )}
                  {lead.checkInDate && lead.checkOutDate && (
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {new Date(lead.checkInDate).toLocaleDateString()} -{" "}
                        {new Date(lead.checkOutDate).toLocaleDateString()}
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

              {ezeeLoading && (
                <p className="text-xs text-muted-foreground">Loading rate suggestions from PMS…</p>
              )}
              {!ezeeLoading && ezeeRates.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Rate suggestions (click to apply)</Label>
                  <div className="max-h-56 overflow-y-auto rounded-md border border-border/50 bg-muted/10 p-2">
                    <div className="grid gap-2">
                    {ezeeRates.map((r, i) => (
                      <Button
                        key={`${r.roomType}-${i}`}
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-auto w-full justify-start whitespace-normal break-words py-1.5 text-left text-xs font-normal"
                        onClick={() => setRate(String(Math.round(r.rate)))}
                      >
                        Click to use: {formatCurrency(r.rate)} — {r.roomType}
                      </Button>
                    ))}
                    </div>
                  </div>
                </div>
              )}

              {kbLoading && !kbData && lead?.propertyId && (
                <p className="text-xs text-muted-foreground">Loading property knowledge…</p>
              )}

              {kbData && (
                <Collapsible
                  className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
                  defaultOpen={false}
                >
                  <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 py-1 text-left text-sm font-medium [&[data-state=open]>svg]:rotate-180">
                    <span>Property knowledge base</span>
                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-2 text-sm">
                    {!kbData.factsheet ? (
                      <p className="text-muted-foreground text-xs">
                        No fact sheet content yet. Add details in Knowledge Base → Fact sheets.
                      </p>
                    ) : (
                      <>
                        {kbData.factsheet.roomCategories && kbData.factsheet.roomCategories.length > 0 && (
                          <div>
                            <span className="font-medium text-foreground">Room categories</span>
                            <ul className="mt-1 list-inside list-disc text-muted-foreground">
                              {kbData.factsheet.roomCategories.map((rc, idx) => (
                                <li key={idx}>
                                  {rc.name}
                                  {rc.capacity != null ? ` · up to ${rc.capacity} guests` : ""}
                                  {rc.sizesqft != null ? ` · ${rc.sizesqft} sq ft` : ""}
                                  {rc.isAC ? " · AC" : ""}
                                  {rc.isDorm ? " · Dorm" : ""}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {kbData.factsheet.inHouseRules && kbData.factsheet.inHouseRules.length > 0 && (
                          <div>
                            <span className="font-medium text-foreground">In-house rules</span>
                            <ul className="mt-1 list-inside list-disc text-muted-foreground">
                              {(showAllKbRules
                                ? kbData.factsheet.inHouseRules
                                : kbData.factsheet.inHouseRules.slice(0, 5)
                              ).map((rule, idx) => (
                                <li key={idx}>{rule}</li>
                              ))}
                            </ul>
                            {kbData.factsheet.inHouseRules.length > 5 && (
                              <button
                                type="button"
                                className="mt-1 text-xs text-primary underline"
                                onClick={() => setShowAllKbRules(!showAllKbRules)}
                              >
                                {showAllKbRules ? "Show less" : "Show more"}
                              </button>
                            )}
                          </div>
                        )}
                        {kbData.factsheet.additionalCharges &&
                          kbData.factsheet.additionalCharges.length > 0 && (
                            <div>
                              <span className="font-medium text-foreground">Additional charges</span>
                              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                                {kbData.factsheet.additionalCharges.map((ac, idx) => (
                                  <li key={idx}>
                                    {ac.item}
                                    {ac.amount ? ` — ${ac.amount}` : ""}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        {kbData.factsheet.nearbyAttractions &&
                          kbData.factsheet.nearbyAttractions.length > 0 && (
                            <div>
                              <span className="font-medium text-foreground">Nearby attractions</span>
                              <ul className="mt-1 list-inside list-disc text-muted-foreground">
                                {kbData.factsheet.nearbyAttractions.slice(0, 3).map((a, idx) => (
                                  <li key={idx}>{a}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        {kbData.factsheet.pocDetails &&
                          (kbData.factsheet.pocDetails.frontDeskPhone ||
                            kbData.factsheet.pocDetails.frontDeskEmail ||
                            kbData.factsheet.pocDetails.gmName ||
                            kbData.factsheet.pocDetails.gmPhone) && (
                            <div>
                              <span className="font-medium text-foreground">POC</span>
                              <div className="mt-1 space-y-0.5 text-muted-foreground text-xs">
                                {kbData.factsheet.pocDetails.frontDeskPhone && (
                                  <div>Front desk: {kbData.factsheet.pocDetails.frontDeskPhone}</div>
                                )}
                                {kbData.factsheet.pocDetails.frontDeskEmail && (
                                  <div>{kbData.factsheet.pocDetails.frontDeskEmail}</div>
                                )}
                                {kbData.factsheet.pocDetails.gmName && (
                                  <div>GM: {kbData.factsheet.pocDetails.gmName}</div>
                                )}
                                {kbData.factsheet.pocDetails.gmPhone && (
                                  <div>GM phone: {kbData.factsheet.pocDetails.gmPhone}</div>
                                )}
                              </div>
                            </div>
                          )}
                      </>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              )}
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
    {effectivePropertyId ? (
      <KBQuickDrawer
        key={effectivePropertyId}
        propertyId={effectivePropertyId}
        isOpen={kbDirectoryDrawerOpen}
        onClose={() => setKbDirectoryDrawerOpen(false)}
        defaultTab="rooms"
      />
    ) : null}
    </>
  );
};

