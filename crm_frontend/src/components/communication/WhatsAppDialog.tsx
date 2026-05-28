import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Send, MessageCircle, FileImage, FileText, Paperclip } from "lucide-react";
import { toast } from "sonner";

interface WhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guestPhone?: string;
  guestName?: string;
}

export const WhatsAppDialog = ({ open, onOpenChange, guestPhone = "", guestName = "" }: WhatsAppDialogProps) => {
  const [message, setMessage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");

  const messageTemplates = [
    {
      id: "welcome",
      name: "Welcome Message",
      content: `Hello ${guestName || '[Guest Name]'}! Welcome to The Postcard Hotels. We're excited to have you stay with us. If you have any questions or need assistance, please don't hesitate to reach out. Have a wonderful day! 🏨✨`
    },
    {
      id: "booking-confirmation",
      name: "Booking Confirmation",
      content: `Dear ${guestName || '[Guest Name]'}, your booking has been confirmed! Here are your details:\n\n📅 Check-in: [Date]\n📅 Check-out: [Date]\n🏨 Property: [Property Name]\n🛏️ Room: [Room Type]\n\nWe look forward to welcoming you! 🌟`
    },
    {
      id: "check-in-reminder",
      name: "Check-in Reminder",
      content: `Hi ${guestName || '[Guest Name]'}! Just a friendly reminder that your check-in is tomorrow. Check-in time is 3:00 PM. We can't wait to welcome you to The Postcard Hotels! 🎉`
    },
    {
      id: "feedback-request",
      name: "Feedback Request",
      content: `Dear ${guestName || '[Guest Name]'}, thank you for staying with us! We hope you had a wonderful experience. We'd love to hear your feedback to help us improve. Please take a moment to share your thoughts. 💭⭐`
    },
    {
      id: "special-offer",
      name: "Special Offer",
      content: `🌟 Exclusive Offer for ${guestName || '[Guest Name]'}! \n\nEnjoy 20% off your next stay with us. Use code: WELCOME20\n\nValid for bookings made within 30 days. Terms and conditions apply.\n\nBook now and create more memories with The Postcard Hotels! 🏖️`
    }
  ];

  const handleTemplateSelect = (template: typeof messageTemplates[0]) => {
    setSelectedTemplate(template.id);
    setMessage(template.content);
  };

  const handleSend = () => {
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    // In a real implementation, this would send the WhatsApp message
    toast.success("WhatsApp message sent successfully!");

    // Reset form
    setMessage("");
    setSelectedTemplate("");
    onOpenChange(false);
  };

  const handleClose = () => {
    setMessage("");
    setSelectedTemplate("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            <span>Send WhatsApp Message</span>
          </DialogTitle>
          <DialogDescription>
            Send a WhatsApp message to {guestName || "the guest"} ({guestPhone})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Message Templates */}
          <div className="space-y-2">
            <Label>Quick Templates</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {messageTemplates.map((template) => (
                <Button
                  key={template.id}
                  variant={selectedTemplate === template.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleTemplateSelect(template)}
                  className="justify-start h-auto p-2 text-left"
                >
                  <div>
                    <div className="font-medium text-sm">{template.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {template.content.substring(0, 50)}...
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          {/* Message Field */}
          <div className="space-y-2">
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your WhatsApp message here..."
              rows={6}
              className="resize-none"
            />
            <div className="text-xs text-muted-foreground">
              Character count: {message.length}/1000
            </div>
          </div>

          {/* Media Options */}
          <div className="space-y-2">
            <Label>Media (Optional)</Label>
            <div className="flex space-x-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => toast.info("Image attachment feature coming soon")}
              >
                <FileImage className="h-4 w-4 mr-2" />
                Add Image
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => toast.info("Document attachment feature coming soon")}
              >
                <FileText className="h-4 w-4 mr-2" />
                Add Document
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => toast.info("File attachment feature coming soon")}
              >
                <Paperclip className="h-4 w-4 mr-2" />
                Add File
              </Button>
            </div>
          </div>

          {/* Preview */}
          {message && (
            <div className="space-y-2">
              <Label>Message Preview</Label>
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <MessageCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">WhatsApp Message</span>
                </div>
                <div className="text-sm text-green-700 whitespace-pre-wrap">
                  {message}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={!message.trim()}>
              <Send className="h-4 w-4 mr-2" />
              Send WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};