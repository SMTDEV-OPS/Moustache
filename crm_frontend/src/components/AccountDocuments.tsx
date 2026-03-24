import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Download, FileText } from "lucide-react";
import {
  listAccountDocuments,
  uploadAccountDocument,
  deleteAccountDocument,
  downloadAccountDocument,
  type AccountDocument,
  type AccountDocumentType,
} from "@/services/accountDocuments";

const DOC_TYPES: { value: AccountDocumentType; label: string }[] = [
  { value: "CONTRACT", label: "Contract" },
  { value: "CERTIFICATE", label: "Certificate" },
  { value: "AGREEMENT", label: "Agreement" },
  { value: "OTHER", label: "Other" },
];

function formatSize(bytes: number | undefined) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d: string | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return d;
  }
}

interface AccountDocumentsProps {
  accountId: string;
}

export function AccountDocuments({ accountId }: AccountDocumentsProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<AccountDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState<AccountDocumentType>("OTHER");

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const data = await listAccountDocuments(accountId);
      setDocuments(data);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load documents", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [accountId]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadAccountDocument(accountId, file, uploadType);
      toast({ title: "Success", description: "Document uploaded" });
      await loadDocuments();
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (_doc: AccountDocument) => {
    toast({ title: "Not allowed", description: "Document deletion is restricted to system admins.", variant: "destructive" });
  };

  const handleDownload = async (doc: AccountDocument) => {
    try {
      await downloadAccountDocument(doc.id, doc.name);
      toast({ title: "Success", description: "Download started" });
    } catch (err) {
      toast({ title: "Error", description: "Failed to download", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Documents</h3>
          <div className="flex items-center gap-2">
            <Select value={uploadType} onValueChange={(v) => setUploadType(v as AccountDocumentType)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*"
              onChange={handleFileChange}
            />
            <Button onClick={handleUploadClick} disabled={uploading} size="sm">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Upload
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No documents uploaded yet</p>
            <Button variant="outline" className="mt-3" onClick={handleUploadClick}>
              <Plus className="h-4 w-4 mr-2" />
              Upload document
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">{doc.name}</TableCell>
                  <TableCell>{doc.type || "OTHER"}</TableCell>
                  <TableCell>{formatSize(doc.size)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(doc.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Download"
                        onClick={() => handleDownload(doc)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        title="Delete"
                        onClick={() => handleDelete(doc)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
