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
import { Badge } from "@/components/ui/badge";
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

interface PropertyCardEditorProps {
  propertyId: string;
  item?: KnowledgeBaseItem;
  onClose: () => void;
  onSave: () => void;
}

interface PropertyContent {
  location?: string;
  type?: string;
  rooms?: number;
  rating?: number;
  amenities?: string[];
  rates?: Record<string, string>;
  contact?: {
    phone?: string;
    email?: string;
    website?: string;
  };
}

export const PropertyCardEditor = ({
  propertyId,
  item,
  onClose,
  onSave,
}: PropertyCardEditorProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState("");
  const [rooms, setRooms] = useState<number | "">("");
  const [rating, setRating] = useState<number | "">("");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [newAmenity, setNewAmenity] = useState("");
  const [rates, setRates] = useState<Array<{ type: string; price: string }>>([]);
  const [contact, setContact] = useState({
    phone: "",
    email: "",
    website: "",
  });
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState(item?.files || []);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setDescription(item.description || "");
      const content = (item.content || {}) as PropertyContent;
      setLocation(content.location || "");
      setType(content.type || "");
      setRooms(content.rooms || "");
      setRating(content.rating || "");
      setAmenities(content.amenities || []);

      // Convert rates object to array
      if (content.rates) {
        setRates(
          Object.entries(content.rates).map(([type, price]) => ({
            type,
            price,
          }))
        );
      } else {
        setRates([]);
      }

      setContact({
        phone: content.contact?.phone || "",
        email: content.contact?.email || "",
        website: content.contact?.website || ""
      });
      setExistingFiles(item.files || []);
    } else {
      setTitle("");
      setDescription("");
      setLocation("");
      setType("");
      setRooms("");
      setRating("");
      setAmenities([]);
      setRates([]);
      setContact({ phone: "", email: "", website: "" });
      setExistingFiles([]);
    }
    setNewFiles([]);
  }, [item]);

  const handleAddAmenity = () => {
    if (newAmenity.trim() && !amenities.includes(newAmenity.trim())) {
      setAmenities([...amenities, newAmenity.trim()]);
      setNewAmenity("");
    }
  };

  const handleRemoveAmenity = (index: number) => {
    setAmenities(amenities.filter((_, i) => i !== index));
  };

  const handleAddRate = () => {
    setRates([...rates, { type: "", price: "" }]);
  };

  const handleRemoveRate = (index: number) => {
    setRates(rates.filter((_, i) => i !== index));
  };

  const handleUpdateRate = (index: number, field: "type" | "price", value: string) => {
    const updated = [...rates];
    updated[index] = { ...updated[index], [field]: value };
    setRates(updated);
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
      toast.error("Hotel name is required");
      return;
    }

    try {
      setIsSubmitting(true);

      // Build content object
      const content: PropertyContent = {};

      if (location) content.location = location;
      if (type) content.type = type;
      if (rooms) content.rooms = Number(rooms);
      if (rating) content.rating = Number(rating);
      if (amenities.length > 0) content.amenities = amenities;

      // Convert rates array to object
      const ratesObj: Record<string, string> = {};
      rates.forEach((rate) => {
        if (rate.type && rate.price) {
          ratesObj[rate.type.toLowerCase()] = rate.price;
        }
      });
      if (Object.keys(ratesObj).length > 0) {
        content.rates = ratesObj;
      }

      // Add contact if any field is filled
      if (contact.phone || contact.email || contact.website) {
        content.contact = {};
        if (contact.phone) content.contact.phone = contact.phone;
        if (contact.email) content.contact.email = contact.email;
        if (contact.website) content.contact.website = contact.website;
      }

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
          type: "PROPERTY",
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

      toast.success(item ? "Property card updated successfully" : "Property card created successfully");
      onSave();
    } catch (error) {
      console.error("Failed to save property card:", error);
      toast.error(
        item ? "Failed to update property card" : "Failed to create property card"
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
            {item ? "Edit Property Card" : "Create Property Card"}
          </DialogTitle>
          <DialogDescription>
            {item
              ? "Update the property card details"
              : "Fill in the details to create a new property card"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Information */}
          <div className="space-y-4 border-b border-slate-200 pb-6">
            <h3 className="text-lg font-semibold">Basic Information</h3>

            <div className="space-y-2">
              <Label htmlFor="title">Hotel Name *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., The Postcard Goa"
                className="rounded-none h-12"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Betalbatim, Goa"
                  className="rounded-none h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Property Type</Label>
                <Input
                  id="type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  placeholder="e.g., Beach Resort"
                  className="rounded-none h-12"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A stunning beachfront resort offering luxurious accommodations..."
                rows={3}
                className="rounded-none"
              />
            </div>
          </div>

          {/* Key Statistics */}
          <div className="space-y-4 border-b border-slate-200 pb-6">
            <h3 className="text-lg font-semibold">Key Statistics</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rooms">Number of Rooms</Label>
                <Input
                  id="rooms"
                  type="number"
                  value={rooms}
                  onChange={(e) => setRooms(e.target.value ? Number(e.target.value) : "")}
                  placeholder="e.g., 84"
                  className="rounded-none h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rating">Rating</Label>
                <Input
                  id="rating"
                  type="number"
                  step="0.1"
                  value={rating}
                  onChange={(e) => setRating(e.target.value ? Number(e.target.value) : "")}
                  placeholder="e.g., 4.8"
                  className="rounded-none h-12"
                />
              </div>
            </div>
          </div>

          {/* Amenities */}
          <div className="space-y-4 border-b border-slate-200 pb-6">
            <h3 className="text-lg font-semibold">Amenities</h3>

            <div className="flex gap-2">
              <Input
                value={newAmenity}
                onChange={(e) => setNewAmenity(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddAmenity();
                  }
                }}
                placeholder="Add amenity (e.g., Private Beach)"
                className="rounded-none h-12"
              />
              <Button
                type="button"
                onClick={handleAddAmenity}
                variant="outline"
                className="rounded-none"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {amenities.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {amenities.map((amenity, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="rounded-full px-3 py-1 text-xs flex items-center gap-2"
                  >
                    {amenity}
                    <button
                      type="button"
                      onClick={() => handleRemoveAmenity(index)}
                      className="hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Room Rates */}
          <div className="space-y-4 border-b border-slate-200 pb-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Room Rates (per night)</h3>
              <Button
                type="button"
                onClick={handleAddRate}
                variant="outline"
                size="sm"
                className="rounded-none"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Rate
              </Button>
            </div>

            {rates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No rates added yet</p>
            ) : (
              <div className="space-y-2">
                {rates.map((rate, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      value={rate.type}
                      onChange={(e) => handleUpdateRate(index, "type", e.target.value)}
                      placeholder="Room type (e.g., Deluxe)"
                      className="rounded-none h-12 flex-1"
                    />
                    <Input
                      value={rate.price}
                      onChange={(e) => handleUpdateRate(index, "price", e.target.value)}
                      placeholder="Price range (e.g., ₹12,000 - ₹18,000)"
                      className="rounded-none h-12 flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveRate(index)}
                      className="rounded-none text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Contact Information */}
          <div className="space-y-4 border-b border-slate-200 pb-6">
            <h3 className="text-lg font-semibold">Contact Information</h3>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={contact.phone}
                onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                placeholder="e.g., +91 832 287 1234"
                className="rounded-none h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={contact.email}
                onChange={(e) => setContact({ ...contact, email: e.target.value })}
                placeholder="e.g., goa@thePostcardhotel.com"
                className="rounded-none h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={contact.website}
                onChange={(e) => setContact({ ...contact, website: e.target.value })}
                placeholder="e.g., www.thePostcardhotel.com"
                className="rounded-none h-12"
              />
            </div>
          </div>

          {/* Files */}
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
                  ? "Update Property Card"
                  : "Create Property Card"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

