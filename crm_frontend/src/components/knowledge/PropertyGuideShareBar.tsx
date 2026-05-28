import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Copy,
  Download,
  Mail,
  MessageCircle,
  Pencil,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CRM_PATHS } from "@/navigation/crmPaths";
import { getPublicGuideUrl, shareGuideEmail } from "@/services/knowledgeBase";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PropertyGuideShareBarProps {
  guideId?: string;
  propertyName: string;
  shareToken?: string;
  shareEnabled: boolean;
  printRootRef: React.RefObject<HTMLElement | null>;
  canManage?: boolean;
  className?: string;
  hideOnPrint?: boolean;
}

export function PropertyGuideShareBar({
  guideId,
  propertyName,
  shareToken,
  shareEnabled,
  printRootRef,
  canManage,
  className,
}: PropertyGuideShareBarProps) {
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  const publicUrl =
    shareEnabled && shareToken ? getPublicGuideUrl(shareToken) : "";

  const copyLink = async () => {
    if (!publicUrl) {
      toast.error("Public sharing is disabled for this guide");
      return;
    }
    await navigator.clipboard.writeText(publicUrl);
    toast.success("Link copied");
  };

  const downloadPdf = async () => {
    const el = printRootRef.current;
    if (!el) return;
    try {
      setPdfLoading(true);
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
        ignoreElements: (node) => node.classList?.contains("no-print") === true,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(`${propertyName.replace(/\s+/g, "-")}-guide.pdf`);
      toast.success("PDF downloaded");
    } catch {
      toast.error("Could not generate PDF");
    } finally {
      setPdfLoading(false);
    }
  };

  const openWhatsApp = () => {
    if (!publicUrl) {
      toast.error("Enable public sharing to share via WhatsApp");
      return;
    }
    const text = `${propertyName} — Property Guide\n${publicUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const sendEmail = async () => {
    if (!guideId || !emailTo.trim()) return;
    try {
      const res = await shareGuideEmail(guideId, {
        to: emailTo.trim(),
        publicUrl: publicUrl || window.location.href,
        propertyName,
      });
      window.location.href = res.mailtoUrl;
      setEmailOpen(false);
    } catch {
      toast.error("Could not open email");
    }
  };

  return (
    <>
      <div
        className={cn(
          "no-print sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-surface/80",
          className
        )}
      >
        <Button variant="outline" size="sm" onClick={() => void downloadPdf()} disabled={pdfLoading}>
          <Download className="h-4 w-4 mr-1.5" />
          {pdfLoading ? "PDF…" : "PDF"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setEmailOpen(true)} disabled={!guideId}>
          <Mail className="h-4 w-4 mr-1.5" />
          Email
        </Button>
        <Button variant="outline" size="sm" onClick={openWhatsApp}>
          <MessageCircle className="h-4 w-4 mr-1.5" />
          WhatsApp
        </Button>
        <Button variant="outline" size="sm" onClick={() => void copyLink()} disabled={!publicUrl}>
          <Link2 className="h-4 w-4 mr-1.5" />
          Copy link
        </Button>
        {canManage && (
          <Button variant="ghost" size="sm" asChild>
            <Link to={CRM_PATHS.setupPropertyGuide}>
              <Pencil className="h-4 w-4 mr-1.5" />
              Edit
            </Link>
          </Button>
        )}
      </div>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email property guide</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="share-email-to">Recipient</Label>
            <Input
              id="share-email-to"
              type="email"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="name@company.com"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void sendEmail()}>
              <Copy className="h-4 w-4 mr-1.5" />
              Open in mail app
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
