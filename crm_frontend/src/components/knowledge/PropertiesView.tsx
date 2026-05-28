import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Bed, Phone, Mail, Globe, Download, Edit, Trash2, Plus } from "lucide-react";
import {
  getKnowledgeBaseItems,
  deleteKnowledgeBaseItem,
  getFileDownloadUrl,
  type KnowledgeBaseItem,
} from "@/services/knowledgeBase";
import { toast } from "sonner";
import { PropertyCardEditor } from "./PropertyCardEditor";

interface PropertiesViewProps {
  propertyId: string;
  searchQuery?: string;
  canManage?: boolean;
}

export const PropertiesView = ({
  propertyId,
  searchQuery = "",
  canManage = false,
}: PropertiesViewProps) => {
  const [items, setItems] = useState<KnowledgeBaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<KnowledgeBaseItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadItems();
  }, [propertyId, searchQuery]);

  const loadItems = async () => {
    try {
      setLoading(true);
      const data = await getKnowledgeBaseItems({
        propertyId,
        type: "PROPERTY",
        search: searchQuery || undefined,
      });
      setItems(data);
    } catch (error) {
      console.error("Failed to load properties:", error);
      toast.error("Failed to load properties");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this property card?")) {
      return;
    }

    try {
      await deleteKnowledgeBaseItem(id);
      toast.success("Property card deleted");
      loadItems();
    } catch (error) {
      console.error("Failed to delete property:", error);
      toast.error("Failed to delete property card");
    }
  };

  const handleDownload = (fileId: string, filename: string) => {
    const url = getFileDownloadUrl(fileId);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading properties...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
            Properties
          </h2>
          <p className="text-muted-foreground">Comprehensive information about hotel properties</p>
        </div>
        {canManage && (
          <Button
            onClick={() => setIsCreating(true)}
            className="rounded-none px-8 py-6"
            style={{ backgroundColor: "#0F172A", color: "white" }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Property Card
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <Card className="rounded-sm border border-slate-200 p-8">
          <div className="text-center text-muted-foreground">
            <p>No property cards found.</p>
            {canManage && (
              <p className="mt-2 text-sm">
                Click "Create Property Card" to add one.
              </p>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid gap-6">
          {items.map((item) => {
            const content = item.content as Record<string, unknown> | undefined;
            const location = content?.location as string | undefined;
            const type = content?.type as string | undefined;
            const rooms = content?.rooms as number | undefined;
            const rating = content?.rating as number | undefined;
            const description = item.description || (content?.description as string | undefined);
            const amenities = (content?.amenities as string[]) || [];
            const rates = (content?.rates as Record<string, string>) || {};
            const contact = (content?.contact as Record<string, string>) || {};

            return (
              <Card key={item._id} className="overflow-hidden rounded-sm border border-slate-200 hover:shadow-md transition-shadow duration-300">
                <CardHeader className="pb-4 border-b border-slate-100 p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl" style={{ color: "#059669" }}>
                        {item.title}
                      </CardTitle>
                      {location && (
                        <div className="flex items-center text-muted-foreground mt-1">
                          <MapPin className="h-4 w-4 mr-1" />
                          <span className="text-sm">{location}</span>
                        </div>
                      )}
                    </div>
                    {type && <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-bold tracking-wider uppercase border">{type}</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-6">
                  {description && (
                    <p className="text-muted-foreground text-sm">{description}</p>
                  )}

                  {(rooms || rating) && (
                    <div className="grid grid-cols-2 gap-4">
                      {rooms && (
                        <div className="flex items-center">
                          <Bed className="h-4 w-4 text-muted-foreground mr-2" />
                          <span className="text-sm">{rooms} Rooms</span>
                        </div>
                      )}
                      {rating && (
                        <div className="flex items-center">
                          <span className="text-yellow-500 mr-1">★</span>
                          <span className="text-sm">{rating} Rating</span>
                        </div>
                      )}
                    </div>
                  )}

                  {amenities.length > 0 && (
                    <div>
                      <h4 className="font-medium text-foreground mb-2">Amenities</h4>
                      <div className="flex flex-wrap gap-2">
                        {amenities.map((amenity, index) => (
                          <Badge key={index} variant="outline" className="text-xs rounded-full px-3 py-1">
                            {amenity}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {Object.keys(rates).length > 0 && (
                    <div>
                      <h4 className="font-medium text-foreground mb-2">Room Rates (per night)</h4>
                      <div className="space-y-1 text-sm">
                        {Object.entries(rates).map(([type, rate]) => (
                          <div key={type} className="flex justify-between">
                            <span className="capitalize text-muted-foreground">{type}:</span>
                            <span className="font-medium">{rate}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(contact.phone || contact.email || contact.website) && (
                    <div className="border-t pt-3">
                      <h4 className="font-medium text-foreground mb-2">Contact Information</h4>
                      <div className="space-y-1 text-sm">
                        {contact.phone && (
                          <div className="flex items-center">
                            <Phone className="h-3 w-3 mr-2 text-muted-foreground" />
                            <span>{contact.phone}</span>
                          </div>
                        )}
                        {contact.email && (
                          <div className="flex items-center">
                            <Mail className="h-3 w-3 mr-2 text-muted-foreground" />
                            <span>{contact.email}</span>
                          </div>
                        )}
                        {contact.website && (
                          <div className="flex items-center">
                            <Globe className="h-3 w-3 mr-2 text-muted-foreground" />
                            <span>{contact.website}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {item.files.length > 0 && (
                    <div className="border-t pt-3">
                      <h4 className="font-medium text-foreground mb-2">Attachments</h4>
                      <div className="space-y-2">
                        {item.files.map((file) => (
                          <Button
                            key={file._id}
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(file._id, file.originalName)}
                            className="w-full justify-start rounded-none"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            {file.originalName}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {canManage && (
                    <div className="border-t pt-3 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingItem(item)}
                        className="flex-1 rounded-none"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(item._id)}
                        className="flex-1 rounded-none text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {(isCreating || editingItem) && (
        <PropertyCardEditor
          propertyId={propertyId}
          item={editingItem || undefined}
          onClose={() => {
            setIsCreating(false);
            setEditingItem(null);
          }}
          onSave={() => {
            setIsCreating(false);
            setEditingItem(null);
            loadItems();
          }}
        />
      )}
    </div>
  );
};
