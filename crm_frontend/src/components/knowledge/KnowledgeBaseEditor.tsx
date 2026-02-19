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
import { FileUploader } from "./FileUploader";
import {
  createKnowledgeBaseItem,
  updateKnowledgeBaseItem,
  uploadFiles,
  deleteFile,
  type KnowledgeBaseItem,
  type KnowledgeBaseType,
} from "@/services/knowledgeBase";
import { toast } from "sonner";
import { X, Trash2 } from "lucide-react";
import { getFileDownloadUrl } from "@/services/knowledgeBase";

interface KnowledgeBaseEditorProps {
  propertyId: string;
  type: KnowledgeBaseType;
  item?: KnowledgeBaseItem;
  onClose: () => void;
  onSave: () => void;
}

export const KnowledgeBaseEditor = ({
  propertyId,
  type,
  item,
  onClose,
  onSave,
}: KnowledgeBaseEditorProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState<Record<string, unknown>>({});
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState(item?.files || []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contentJson, setContentJson] = useState("");

  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setDescription(item.description || "");
      setContent(item.content || {});
      setContentJson(JSON.stringify(item.content || {}, null, 2));
      setExistingFiles(item.files || []);
    } else {
      setTitle("");
      setDescription("");
      setContent({});
      setContentJson("{}");
      setExistingFiles([]);
    }
    setNewFiles([]);
  }, [item]);

  const handleContentJsonChange = (value: string) => {
    setContentJson(value);
    try {
      const parsed = JSON.parse(value);
      setContent(parsed);
    } catch {
      // Invalid JSON, ignore for now
    }
  };

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
      toast.error("Title is required");
      return;
    }

    try {
      setIsSubmitting(true);

      // Parse content JSON
      let parsedContent: Record<string, unknown> = {};
      try {
        parsedContent = JSON.parse(contentJson);
      } catch {
        toast.error("Invalid JSON in content field");
        return;
      }

      let savedItem: KnowledgeBaseItem;

      if (item) {
        // Update existing item
        savedItem = await updateKnowledgeBaseItem(item._id, {
          title,
          description: description || undefined,
          content: parsedContent,
        });

        // Upload new files if any
        if (newFiles.length > 0) {
          savedItem = await uploadFiles(savedItem._id, newFiles);
        }
      } else {
        // Create new item
        savedItem = await createKnowledgeBaseItem({
          type,
          propertyId,
          title,
          description: description || undefined,
          content: parsedContent,
        });

        // Upload files if any
        if (newFiles.length > 0) {
          savedItem = await uploadFiles(savedItem._id, newFiles);
        }
      }

      toast.success(item ? "Item updated successfully" : "Item created successfully");
      onSave();
    } catch (error) {
      console.error("Failed to save item:", error);
      toast.error(
        item ? "Failed to update item" : "Failed to create item"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const typeLabels = {
    PROPERTY: "Property Card",
    FACTSHEET: "Fact Sheet",
    TEMPLATE: "Template",
    RESOURCE: "Resource",
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-sm">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
            {item ? `Edit ${typeLabels[type]}` : `Create ${typeLabels[type]}`}
          </DialogTitle>
          <DialogDescription>
            {item
              ? "Update the knowledge base item details"
              : "Fill in the details to create a new knowledge base item"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter title"
              className="rounded-none h-12"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description"
              rows={3}
              className="rounded-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Content (JSON)</Label>
            <Textarea
              id="content"
              value={contentJson}
              onChange={(e) => handleContentJsonChange(e.target.value)}
              placeholder='{"key": "value"}'
              rows={8}
              className="rounded-none font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Enter structured content as JSON. This can include details like amenities, rates, contact info, etc.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Files</Label>
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
              disabled={isSubmitting || !title.trim()}
              className="rounded-none px-8 py-6"
              style={{ backgroundColor: "#0F172A", color: "white" }}
            >
              {isSubmitting
                ? "Saving..."
                : item
                ? "Update"
                : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

