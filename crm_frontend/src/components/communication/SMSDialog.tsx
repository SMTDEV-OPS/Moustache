import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Send, MessageSquare, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface SMSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guestPhone?: string;
  guestName?: string;
}

export const SMSDialog = ({ open, onOpenChange, guestPhone = "", guestName = "" }: SMSDialogProps) => {
  const [message, setMessage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");

  const maxLength = 160; // Standard SMS length

  const messageTemplates = [
    {
      id: "welcome",
      name: "Welcome SMS",
      content: `Welcome to The Postcard Hotels, ${guestName || '[Name]'}! Your booking is confirmed. Check-in: 3PM. Need help? Call +91-XXX-XXXX. We're excited to host you!`
    },
    {
      id: "check-in-reminder",
      name: "Check-in Reminder",
      content: `Hi ${guestName || '[Name]'}! Your check-in is tomorrow at The Postcard Hotels. Time: 3:00 PM. Looking forward to welcoming you!`
    },
    {
      id: "room-ready",
      name: "Room Ready",
      content: `Good news ${guestName || '[Name]'}! Your room is ready for early check-in. Please visit the front desk with your ID. Welcome to The Postcard Hotels!`
    },
    {
      id: "checkout-reminder",
      name: "Checkout Reminder",
      content: `Dear ${guestName || '[Name]'}, checkout time is 11:00 AM today. Need late checkout? Contact front desk. Thank you for staying with us!`
    },
    {
      id: "feedback-request",
      name: "Feedback Request",
      content: `Thank you for staying with The Postcard Hotels, ${guestName || '[Name]'}! Please rate your experience: [link]. Your feedback helps us improve.`
    },
    {
      id: "promotion",
      name: "Special Offer",
      content: `Exclusive for ${guestName || '[Name]'}: 20% off your next stay! Use code STAY20. Book within 30 days. T&C apply. The Postcard Hotels`
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

    if (message.length > maxLength) {
      toast.error(`Message is too long. Please keep it under ${maxLength} characters.`);
      return;
    }

    // In a real implementation, this would send the SMS
    toast.success("SMS sent successfully!");

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

  const isMessageTooLong = message.length > maxLength;
  const charactersRemaining = maxLength - message.length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            <span>Send SMS</span>
          </DialogTitle>
          <DialogDescription>
            Send an SMS to {guestName || "the guest"} ({guestPhone})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* SMS Info */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">SMS Guidelines</span>
            </div>
            <ul className="text-xs text-blue-700 mt-1 ml-6 list-disc">
              <li>Keep messages concise and under {maxLength} characters</li>
              <li>Include hotel name for brand recognition</li>
              <li>Avoid special characters that may not display correctly</li>
            </ul>
          </div>

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
                    <div className="text-xs text-muted-foreground">
                      {template.content.length} chars
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
              placeholder="Type your SMS message here..."
              rows={4}
              className={`resize-none ${isMessageTooLong ? 'border-red-500' : ''}`}
            />
            <div className="flex justify-between items-center">
              <div className={`text-xs ${isMessageTooLong ? 'text-red-600' : charactersRemaining < 20 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                {charactersRemaining >= 0 ? (
                  `${charactersRemaining} characters remaining`
                ) : (
                  `${Math.abs(charactersRemaining)} characters over limit`
                )}
              </div>
              <Badge variant={isMessageTooLong ? "destructive" : "secondary"}>
                {message.length}/{maxLength}
              </Badge>
            </div>
          </div>

          {/* Preview */}
          {message && (
            <div className="space-y-2">
              <Label>SMS Preview</Label>
              <div className={`p-3 border rounded-lg ${isMessageTooLong ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center space-x-2 mb-2">
                  <MessageSquare className={`h-4 w-4 ${isMessageTooLong ? 'text-red-600' : 'text-blue-600'}`} />
                  <span className={`text-sm font-medium ${isMessageTooLong ? 'text-red-800' : 'text-gray-800'}`}>SMS Message</span>
                  {isMessageTooLong && (
                    <Badge variant="destructive" className="text-xs">Too Long</Badge>
                  )}
                </div>
                <div className={`text-sm ${isMessageTooLong ? 'text-red-700' : 'text-gray-700'}`}>
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
            <Button onClick={handleSend} disabled={!message.trim() || isMessageTooLong}>
              <Send className="h-4 w-4 mr-2" />
              Send SMS
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};