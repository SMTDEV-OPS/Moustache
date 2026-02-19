import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Mail, MessageCircle, Send, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { sendEmailFromLead, sendSMSFromLead, sendWhatsAppFromLead } from "@/services/communications";

interface CommunicationPanelProps {
  leadId: string;
  guestPhone?: string;
  guestEmail?: string;
  guestName?: string;
  onSent?: () => void;
}

export const CommunicationPanel = ({
  leadId,
  guestPhone,
  guestEmail,
  guestName,
  onSent,
}: CommunicationPanelProps) => {
  const { toast } = useToast();
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const [isSMSOpen, setIsSMSOpen] = useState(false);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Email form state
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  // SMS form state
  const [smsMessage, setSmsMessage] = useState("");

  // WhatsApp form state
  const [whatsappMessage, setWhatsappMessage] = useState("");

  const handleSendEmail = async () => {
    if (!guestEmail) {
      toast({
        title: "Error",
        description: "Guest email is required",
        variant: "destructive",
      });
      return;
    }

    if (!emailSubject.trim() || !emailBody.trim()) {
      toast({
        title: "Error",
        description: "Subject and message are required",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      await sendEmailFromLead(leadId, {
        to: [{ email: guestEmail, name: guestName }],
        subject: emailSubject,
        bodyText: emailBody,
      });

      toast({
        title: "Email sent",
        description: `Email sent to ${guestEmail}`,
      });

      setEmailSubject("");
      setEmailBody("");
      setIsEmailOpen(false);
      if (onSent) onSent();
    } catch (error) {
      toast({
        title: "Failed to send email",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendSMS = async () => {
    if (!guestPhone) {
      toast({
        title: "Error",
        description: "Guest phone number is required",
        variant: "destructive",
      });
      return;
    }

    if (!smsMessage.trim()) {
      toast({
        title: "Error",
        description: "Message is required",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      await sendSMSFromLead(leadId, {
        phone: guestPhone,
        message: smsMessage,
      });

      toast({
        title: "SMS sent",
        description: `SMS sent to ${guestPhone}`,
      });

      setSmsMessage("");
      setIsSMSOpen(false);
      if (onSent) onSent();
    } catch (error) {
      toast({
        title: "Failed to send SMS",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!guestPhone) {
      toast({
        title: "Error",
        description: "Guest phone number is required",
        variant: "destructive",
      });
      return;
    }

    if (!whatsappMessage.trim()) {
      toast({
        title: "Error",
        description: "Message is required",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      await sendWhatsAppFromLead(leadId, {
        phone: guestPhone,
        message: whatsappMessage,
      });

      toast({
        title: "WhatsApp message sent",
        description: `WhatsApp message sent to ${guestPhone}`,
      });

      setWhatsappMessage("");
      setIsWhatsAppOpen(false);
      if (onSent) onSent();
    } catch (error) {
      toast({
        title: "Failed to send WhatsApp message",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Communication</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <Dialog open={isEmailOpen} onOpenChange={setIsEmailOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={!guestEmail}
                className="flex items-center space-x-2"
              >
                <Mail className="h-4 w-4 text-blue-600" />
                <span>Send Email</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send Email to {guestName || "Guest"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email-subject">Subject</Label>
                  <Input
                    id="email-subject"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Email subject"
                  />
                </div>
                <div>
                  <Label htmlFor="email-body">Message</Label>
                  <Textarea
                    id="email-body"
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    placeholder="Your message"
                    rows={6}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsEmailOpen(false)}
                    disabled={isSending}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSendEmail} disabled={isSending}>
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Send Email
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isSMSOpen} onOpenChange={setIsSMSOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={!guestPhone}
                className="flex items-center space-x-2"
              >
                <Send className="h-4 w-4 text-orange-600" />
                <span>Send SMS</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send SMS to {guestName || "Guest"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="sms-message">Message</Label>
                  <Textarea
                    id="sms-message"
                    value={smsMessage}
                    onChange={(e) => setSmsMessage(e.target.value)}
                    placeholder="Your SMS message (max 160 characters)"
                    rows={4}
                    maxLength={160}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {smsMessage.length}/160 characters
                  </p>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsSMSOpen(false)}
                    disabled={isSending}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSendSMS} disabled={isSending}>
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Send SMS
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isWhatsAppOpen} onOpenChange={setIsWhatsAppOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={!guestPhone}
                className="flex items-center space-x-2"
              >
                <MessageCircle className="h-4 w-4 text-emerald-600" />
                <span>Send WhatsApp</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send WhatsApp to {guestName || "Guest"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="whatsapp-message">Message</Label>
                  <Textarea
                    id="whatsapp-message"
                    value={whatsappMessage}
                    onChange={(e) => setWhatsappMessage(e.target.value)}
                    placeholder="Your WhatsApp message"
                    rows={6}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsWhatsAppOpen(false)}
                    disabled={isSending}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSendWhatsApp} disabled={isSending}>
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Send WhatsApp
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
};

