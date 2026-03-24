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
} from "@/services/knowledgeBase";
import { toast } from "sonner";
import { X, Trash2, Plus } from "lucide-react";
import { getFileDownloadUrl } from "@/services/knowledgeBase";

interface FactSheetEditorProps {
  propertyId: string;
  item?: KnowledgeBaseItem;
  onClose: () => void;
  onSave: () => void;
}

interface FactSheetDetail {
  key: string;
  value: string;
}

export const FactSheetEditor = ({
  propertyId,
  item,
  onClose,
  onSave,
}: FactSheetEditorProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [details, setDetails] = useState<FactSheetDetail[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState(item?.files || []);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setDescription(item.description || "");
      const content = (item.content || {}) as Record<string, string>;

      // Convert content object to array of key-value pairs
      if (content && Object.keys(content).length > 0) {
        setDetails(
          Object.entries(content).map(([key, value]) => ({
            key,
            value: String(value),
          }))
        );
      } else {
        setDetails([]);
      }

      setExistingFiles(item.files || []);
    } else {
      setTitle("");
      setDescription("");
      setDetails([]);
      setExistingFiles([]);
    }
    setNewFiles([]);
  }, [item]);

  const handleAddDetail = () => {
    setDetails([...details, { key: "", value: "" }]);
  };

  const handleRemoveDetail = (index: number) => {
    setDetails(details.filter((_, i) => i !== index));
  };

  const handleUpdateDetail = (
    index: number,
    field: "key" | "value",
    value: string
  ) => {
    const updated = [...details];
    updated[index] = { ...updated[index], [field]: value };
    setDetails(updated);
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
      toast.error("Fact sheet title is required");
      return;
    }

    // Validate that all details have both key and value
    const invalidDetails = details.filter(
      (detail) => !detail.key.trim() || !detail.value.trim()
    );
    if (invalidDetails.length > 0) {
      toast.error("Please fill in both key and value for all details");
      return;
    }

    try {
      setIsSubmitting(true);

      // Convert details array to object
      const content: Record<string, string> = {};
      details.forEach((detail) => {
        if (detail.key.trim() && detail.value.trim()) {
          content[detail.key.trim()] = detail.value.trim();
        }
      });

      let savedItem: KnowledgeBaseItem;

      if (item) {
        // Update existing item
        savedItem = await updateKnowledgeBaseItem(item._id, {
          title,
          description: description || undefined,
          content: content as Record<string, unknown>,
        });

        // Upload new files if any
        if (newFiles.length > 0) {
          savedItem = await uploadFiles(savedItem._id, newFiles);
        }
      } else {
        // Create new item
        savedItem = await createKnowledgeBaseItem({
          type: "FACTSHEET",
          propertyId,
          title,
          description: description || undefined,
          content: content as Record<string, unknown>,
        });

        // Upload files if any
        if (newFiles.length > 0) {
          savedItem = await uploadFiles(savedItem._id, newFiles);
        }
      }

      toast.success(
        item ? "Fact sheet updated successfully" : "Fact sheet created successfully"
      );
      onSave();
    } catch (error) {
      console.error("Failed to save fact sheet:", error);
      toast.error(
        item ? "Failed to update fact sheet" : "Failed to create fact sheet"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-sm">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
            {item ? "Edit Fact Sheet" : "Create Fact Sheet"}
          </DialogTitle>
          <DialogDescription>
            {item
              ? "Update the fact sheet details"
              : "Fill in the details to create a new fact sheet"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Information */}
          <div className="space-y-4 border-b border-slate-200 pb-6">
            <h3 className="text-lg font-semibold">Basic Information</h3>

            <div className="space-y-2">
              <Label htmlFor="title">Fact Sheet Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., The Postcard Goa - Fact Sheet"
                className="rounded-none h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the fact sheet"
                rows={2}
                className="rounded-none"
              />
            </div>
          </div>

          {/* Fact Sheet Details */}
          <div className="space-y-4 border-b border-slate-200 pb-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Fact Sheet Details</h3>
              <Button
                type="button"
                onClick={handleAddDetail}
                variant="outline"
                size="sm"
                className="rounded-none"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Detail
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              Add key-value pairs that will be displayed in the fact sheet. Examples: "Total Rooms", "Check-in", "Airport Distance", etc.
            </p>

            {details.length === 0 ? (
              <div className="border border-dashed border-slate-300 rounded-sm p-8 text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  No details added yet. Click "Add Detail" to get started.
                </p>
                <Button
                  type="button"
                  onClick={handleAddDetail}
                  variant="outline"
                  className="rounded-none"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Detail
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {details.map((detail, index) => (
                  <div
                    key={index}
                    className="flex gap-3 items-start p-4 border border-slate-200 rounded-sm bg-slate-50"
                  >
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Key / Label
                        </Label>
                        <Input
                          value={detail.key}
                          onChange={(e) =>
                            handleUpdateDetail(index, "key", e.target.value)
                          }
                          placeholder="e.g., Total Rooms"
                          className="rounded-none h-10"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Value
                        </Label>
                        <Input
                          value={detail.value}
                          onChange={(e) =>
                            handleUpdateDetail(index, "value", e.target.value)
                          }
                          placeholder="e.g., 84"
                          className="rounded-none h-10"
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveDetail(index)}
                      className="rounded-none text-red-600 hover:text-red-700 mt-6"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Quick Add Common Fields */}
            {details.length === 0 && (
              <div className="mt-4 p-4 bg-slate-50 rounded-sm border border-slate-200">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Quick Add Common Fields:
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Total Rooms",
                    "Check-in",
                    "Check-out",
                    "Airport Distance",
                    "Railway Station",
                    "Dining Options",
                    "Pool",
                    "Spa",
                    "Meeting Rooms",
                    "Beach Access",
                  ].map((commonKey) => (
                    <Button
                      key={commonKey}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDetails([...details, { key: commonKey, value: "" }]);
                      }}
                      className="rounded-none text-xs"
                    >
                      {commonKey}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Files */}
          <div className="space-y-2">
            <Label>Files (PDF, Images, etc.)</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Upload files that can be downloaded as the complete fact sheet
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
              disabled={isSubmitting || !title.trim()}
              className="rounded-none px-8 py-6"
              style={{ backgroundColor: "#0F172A", color: "white" }}
            >
              {isSubmitting
                ? "Saving..."
                : item
                  ? "Update Fact Sheet"
                  : "Create Fact Sheet"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

