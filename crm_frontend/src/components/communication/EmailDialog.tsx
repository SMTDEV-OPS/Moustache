import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Paperclip, Send, X, Plus } from "lucide-react";
import { toast } from "sonner";

interface EmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guestEmail?: string;
  guestName?: string;
}

export const EmailDialog = ({ open, onOpenChange, guestEmail = "", guestName = "" }: EmailDialogProps) => {
  const [formData, setFormData] = useState({
    to: guestEmail,
    cc: "",
    bcc: "",
    subject: "",
    body: ""
  });
  const [attachments, setAttachments] = useState<File[]>([]);
  const [ccRecipients, setCcRecipients] = useState<string[]>([]);
  const [bccRecipients, setBccRecipients] = useState<string[]>([]);

  const handleAddCC = () => {
    if (formData.cc.trim()) {
      setCcRecipients(prev => [...prev, formData.cc.trim()]);
      setFormData(prev => ({ ...prev, cc: "" }));
    }
  };

  const handleAddBCC = () => {
    if (formData.bcc.trim()) {
      setBccRecipients(prev => [...prev, formData.bcc.trim()]);
      setFormData(prev => ({ ...prev, bcc: "" }));
    }
  };

  const handleRemoveCC = (email: string) => {
    setCcRecipients(prev => prev.filter(e => e !== email));
  };

  const handleRemoveBCC = (email: string) => {
    setBccRecipients(prev => prev.filter(e => e !== email));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const files = Array.from(event.target.files);
      setAttachments(prev => [...prev, ...files]);
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = () => {
    if (!formData.to.trim() || !formData.subject.trim() || !formData.body.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    // In a real implementation, this would send the email
    toast.success("Email sent successfully!");
    
    // Reset form
    setFormData({
      to: guestEmail,
      cc: "",
      bcc: "",
      subject: "",
      body: ""
    });
    setAttachments([]);
    setCcRecipients([]);
    setBccRecipients([]);
    onOpenChange(false);
  };

  const handleClose = () => {
    // Reset form when closing
    setFormData({
      to: guestEmail,
      cc: "",
      bcc: "",
      subject: "",
      body: ""
    });
    setAttachments([]);
    setCcRecipients([]);
    setBccRecipients([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compose Email</DialogTitle>
          <DialogDescription>
            Send an email to {guestName || "the guest"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* To Field */}
          <div className="space-y-2">
            <Label htmlFor="to">To *</Label>
            <Input
              id="to"
              type="email"
              value={formData.to}
              onChange={(e) => setFormData(prev => ({ ...prev, to: e.target.value }))}
              placeholder="recipient@email.com"
            />
          </div>

          {/* CC Field */}
          <div className="space-y-2">
            <Label htmlFor="cc">CC</Label>
            <div className="flex space-x-2">
              <Input
                id="cc"
                type="email"
                value={formData.cc}
                onChange={(e) => setFormData(prev => ({ ...prev, cc: e.target.value }))}
                placeholder="cc@email.com"
                onKeyPress={(e) => e.key === 'Enter' && handleAddCC()}
              />
              <Button type="button" onClick={handleAddCC} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {ccRecipients.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {ccRecipients.map((email, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    {email}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => handleRemoveCC(email)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* BCC Field */}
          <div className="space-y-2">
            <Label htmlFor="bcc">BCC</Label>
            <div className="flex space-x-2">
              <Input
                id="bcc"
                type="email"
                value={formData.bcc}
                onChange={(e) => setFormData(prev => ({ ...prev, bcc: e.target.value }))}
                placeholder="bcc@email.com"
                onKeyPress={(e) => e.key === 'Enter' && handleAddBCC()}
              />
              <Button type="button" onClick={handleAddBCC} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {bccRecipients.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {bccRecipients.map((email, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    {email}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => handleRemoveBCC(email)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Subject Field */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
              placeholder="Email subject"
            />
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <Label>Attachments</Label>
            <div className="flex items-center space-x-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <Paperclip className="h-4 w-4 mr-2" />
                Add Attachment
              </Button>
              <input
                id="file-upload"
                type="file"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
            {attachments.length > 0 && (
              <div className="space-y-2">
                {attachments.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center space-x-2">
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{file.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({Math.round(file.size / 1024)} KB)
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveAttachment(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Body Field */}
          <div className="space-y-2">
            <Label htmlFor="body">Message *</Label>
            <Textarea
              id="body"
              value={formData.body}
              onChange={(e) => setFormData(prev => ({ ...prev, body: e.target.value }))}
              placeholder="Type your message here..."
              rows={8}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSend}>
              <Send className="h-4 w-4 mr-2" />
              Send Email
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};