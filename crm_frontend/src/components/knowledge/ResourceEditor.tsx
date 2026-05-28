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
import { Trash2, Users, FileText, IndianRupee, Globe, Building2, BookOpen, Download } from "lucide-react";
import { getFileDownloadUrl } from "@/services/knowledgeBase";

interface ResourceEditorProps {
  propertyId: string;
  item?: KnowledgeBaseItem;
  onClose: () => void;
  onSave: () => void;
}

const RESOURCE_ICONS = [
  { value: "Users", label: "Users/Brand", icon: Users },
  { value: "FileText", label: "Document/Policy", icon: FileText },
  { value: "IndianRupee", label: "Rate/Pricing", icon: IndianRupee },
  { value: "Globe", label: "Training/Global", icon: Globe },
  { value: "Building2", label: "Property/Building", icon: Building2 },
  { value: "BookOpen", label: "Book/Guide", icon: BookOpen },
];

export const ResourceEditor = ({
  propertyId,
  item,
  onClose,
  onSave,
}: ResourceEditorProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [iconType, setIconType] = useState("FileText");
  const [buttonText, setButtonText] = useState("");
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState(item?.files || []);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setDescription(item.description || "");
      const content = (item.content || {}) as Record<string, unknown>;
      setIconType((content.iconType as string) || "FileText");
      setButtonText((content.buttonText as string) || "");
      setExistingFiles(item.files || []);
    } else {
      setTitle("");
      setDescription("");
      setIconType("FileText");
      setButtonText("");
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
      toast.error("Resource title is required");
      return;
    }

    if (newFiles.length === 0 && existingFiles.length === 0) {
      toast.error("Please upload at least one file for the resource");
      return;
    }

    try {
      setIsSubmitting(true);

      // Build content object
      const content: Record<string, unknown> = {
        iconType: iconType,
      };
      if (buttonText.trim()) {
        content.buttonText = buttonText.trim();
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
          type: "RESOURCE",
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
        item ? "Resource updated successfully" : "Resource created successfully"
      );
      onSave();
    } catch (error) {
      console.error("Failed to save resource:", error);
      toast.error(
        item ? "Failed to update resource" : "Failed to create resource"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedIcon = RESOURCE_ICONS.find((icon) => icon.value === iconType);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-sm">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
            {item ? "Edit Resource" : "Create Resource"}
          </DialogTitle>
          <DialogDescription>
            {item
              ? "Update the resource details"
              : "Fill in the details to create a new resource"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Information */}
          <div className="space-y-4 border-b border-slate-200 pb-6">
            <h3 className="text-lg font-semibold">Resource Information</h3>
            
            <div className="space-y-2">
              <Label htmlFor="title">Resource Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Brand Guidelines"
                className="rounded-none h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Official brand guidelines, logos, and marketing materials for consistent brand representation."
                rows={3}
                className="rounded-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="iconType">Icon Type</Label>
                <Select value={iconType} onValueChange={setIconType}>
                  <SelectTrigger id="iconType" className="rounded-none h-12">
                    <SelectValue placeholder="Select icon" />
                  </SelectTrigger>
                  <SelectContent>
                    {RESOURCE_ICONS.map((icon) => {
                      const IconComponent = icon.icon;
                      return (
                        <SelectItem key={icon.value} value={icon.value}>
                          <div className="flex items-center gap-2">
                            <IconComponent className="h-4 w-4" style={{ color: "#059669" }} />
                            <span>{icon.label}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="buttonText">Button Text (Optional)</Label>
                <Input
                  id="buttonText"
                  value={buttonText}
                  onChange={(e) => setButtonText(e.target.value)}
                  placeholder="e.g., Download Brand Kit"
                  className="rounded-none h-12"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to use default "Download" text
                </p>
              </div>
            </div>

            {/* Icon Preview */}
            {selectedIcon && (
              <div className="p-4 border border-slate-200 rounded-sm bg-slate-50">
                <p className="text-xs font-medium text-muted-foreground mb-2">Icon Preview:</p>
                <div className="flex items-center gap-3">
                  {(() => {
                    const IconComponent = selectedIcon.icon;
                    return <IconComponent className="h-6 w-6" style={{ color: "#059669" }} />;
                  })()}
                  <span className="text-sm font-medium">{title || "Resource Title"}</span>
                </div>
              </div>
            )}
          </div>

          {/* Files */}
          <div className="space-y-2">
            <Label>Resource Files *</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Upload the resource file(s). Users will be able to download these files.
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
                ? "Update Resource"
                : "Create Resource"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

