import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUploader } from "./FileUploader";
import {
  createKnowledgeBaseItem,
  updateKnowledgeBaseItem,
  uploadFiles,
  deleteFile,
  type KnowledgeBaseItem,
} from "@/services/knowledgeBase";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { getFileDownloadUrl } from "@/services/knowledgeBase";

interface TemplateEditorProps {
  propertyId: string;
  item?: KnowledgeBaseItem;
  onClose: () => void;
  onSave: () => void;
}

const TEMPLATE_CATEGORIES = [
  "Proposals",
  "Quotations",
  "Agreements",
  "Brochures",
  "Policies",
  "Forms",
  "Reports",
  "General",
];

export const TemplateEditor = ({
  propertyId,
  item,
  onClose,
  onSave,
}: TemplateEditorProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState(item?.files || []);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setDescription(item.description || "");
      const content = (item.content || {}) as Record<string, unknown>;
      setCategory((content.category as string) || "");
      setExistingFiles(item.files || []);
    } else {
      setTitle("");
      setDescription("");
      setCategory("");
      setExistingFiles([]);
    }
    setNewFiles([]);
  }, [item]);

  const handleRemoveExistingFile = async (fileId: string) => {
    if (!item) return;

    try {
      await deleteFile(item._id, fileId);
      setExistingFiles(existingFiles.filter((f) => f._id !== fileId));
      toast.success("File removed");
    } catch (error) {
      console.error("Failed to remove file:", error);
      toast.error("Failed to remove file");
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Template name is required");
      return;
    }

    if (newFiles.length === 0 && existingFiles.length === 0) {
      toast.error("Please upload at least one file for the template");
      return;
    }

    try {
      setIsSubmitting(true);

      // Build content object
      const content: Record<string, unknown> = {};
      if (category) {
        content.category = category;
      }

      let savedItem: KnowledgeBaseItem;

      if (item) {
        // Update existing item
        savedItem = await updateKnowledgeBaseItem(item._id, {
          title,
          description: description || undefined,
          content: content,
        });

        // Upload new files if any
        if (newFiles.length > 0) {
          savedItem = await uploadFiles(savedItem._id, newFiles);
        }
      } else {
        // Create new item
        savedItem = await createKnowledgeBaseItem({
          type: "TEMPLATE",
          propertyId,
          title,
          description: description || undefined,
          content: content,
        });

        // Upload files if any
        if (newFiles.length > 0) {
          savedItem = await uploadFiles(savedItem._id, newFiles);
        }
      }

      toast.success(
        item ? "Template updated successfully" : "Template created successfully"
      );
      onSave();
    } catch (error) {
      console.error("Failed to save template:", error);
      toast.error(
        item ? "Failed to update template" : "Failed to create template"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-sm">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
            {item ? "Edit Template" : "Create Template"}
          </DialogTitle>
          <DialogDescription>
            {item
              ? "Update the template details"
              : "Fill in the details to create a new template"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Information */}
          <div className="space-y-4 border-b border-slate-200 pb-6">
            <h3 className="text-lg font-semibold">Template Information</h3>
            
            <div className="space-y-2">
              <Label htmlFor="title">Template Name *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Wedding Package Proposal"
                className="rounded-none h-12"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category" className="rounded-none h-12">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Comprehensive wedding package proposal template with venue details, catering options, and decoration packages"
                rows={3}
                className="rounded-none"
              />
            </div>
          </div>

          {/* Files */}
          <div className="space-y-2">
            <Label>Template Files *</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Upload the template file(s). Users will be able to download these files.
            </p>
            <FileUploader
              files={newFiles}
              onFilesChange={setNewFiles}
              maxFiles={10}
              maxSizeMB={50}
            />
          </div>

          {existingFiles.length > 0 && (
            <div className="space-y-2">
              <Label>Existing Files</Label>
              <div className="space-y-2">
                {existingFiles.map((file) => (
                  <div
                    key={file._id}
                    className="flex items-center justify-between p-3 border border-slate-200 rounded-sm bg-slate-50"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-sm font-medium truncate">
                        {file.originalName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const url = getFileDownloadUrl(file._id);
                          window.open(url, "_blank");
                        }}
                        className="rounded-none"
                      >
                        Download
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveExistingFile(file._id)}
                        className="rounded-none text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-none"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                isSubmitting ||
                !title.trim() ||
                (newFiles.length === 0 && existingFiles.length === 0)
              }
              className="rounded-none px-8 py-6"
              style={{ backgroundColor: "#0F172A", color: "white" }}
            >
              {isSubmitting
                ? "Saving..."
                : item
                ? "Update Template"
                : "Create Template"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

