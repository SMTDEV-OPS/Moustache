import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Edit, Search, Building2, MapPin, Globe } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listProperties,
  createProperty,
  updateProperty,
  deleteProperty,
  type Property,
  type CreatePropertyInput,
  type UpdatePropertyInput,
} from "@/services/properties";

export const PropertyManagement = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState<CreatePropertyInput>({
    name: "",
    code: "",
    location: {
      city: "",
      state: "",
      country: "",
    },
    timeZone: "",
    status: "ACTIVE",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const propertiesData = await listProperties();
      setProperties(propertiesData || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load properties";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (property?: Property) => {
    if (property) {
      setEditingProperty(property);
      setFormData({
        name: property.name || "",
        code: property.code || "",
        location: {
          city: property.location?.city || "",
          state: property.location?.state || "",
          country: property.location?.country || "",
        },
        timeZone: property.timeZone || "",
        status: property.status || "ACTIVE",
      });
    } else {
      setEditingProperty(null);
      setFormData({
        name: "",
        code: "",
        location: {
          city: "",
          state: "",
          country: "",
        },
        timeZone: "",
        status: "ACTIVE",
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingProperty(null);
    setFormData({
      name: "",
      code: "",
      location: {
        city: "",
        state: "",
        country: "",
      },
      timeZone: "",
      status: "ACTIVE",
    });
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Property name is required");
      return;
    }

    if (!formData.code.trim()) {
      toast.error("Property code is required");
      return;
    }

    try {
      setIsSubmitting(true);

      const propertyPayload: CreatePropertyInput | UpdatePropertyInput = {
        name: formData.name.trim(),
        code: formData.code.trim(),
        location: {
          city: formData.location?.city?.trim() || undefined,
          state: formData.location?.state?.trim() || undefined,
          country: formData.location?.country?.trim() || undefined,
        },
        timeZone: formData.timeZone?.trim() || undefined,
        status: formData.status,
      };

      // Remove empty location object if all fields are empty
      if (
        !propertyPayload.location?.city &&
        !propertyPayload.location?.state &&
        !propertyPayload.location?.country
      ) {
        delete propertyPayload.location;
      }

      if (editingProperty) {
        await updateProperty(editingProperty._id, propertyPayload);
        toast.success("Property updated successfully");
      } else {
        await createProperty(propertyPayload);
        toast.success("Property created successfully");
      }
      handleCloseDialog();
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save property";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (propertyId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this property? This action cannot be undone."
      )
    )
      return;
    try {
      await deleteProperty(propertyId);
      toast.success("Property deleted successfully");
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete property";
      toast.error(message);
    }
  };

  // Filter properties
  const filteredProperties = properties.filter((property) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = property.name.toLowerCase().includes(query);
      const matchesCode = property.code.toLowerCase().includes(query);
      const matchesCity = property.location?.city?.toLowerCase().includes(query);
      const matchesState = property.location?.state?.toLowerCase().includes(query);
      const matchesCountry = property.location?.country?.toLowerCase().includes(query);
      if (!matchesName && !matchesCode && !matchesCity && !matchesState && !matchesCountry) {
        return false;
      }
    }
    if (statusFilter !== "ALL" && property.status !== statusFilter) {
      return false;
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p>Loading properties...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <Card className="max-w-md rounded-sm border border-slate-200">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Properties</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={loadData} variant="outline" className="rounded-none">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
            Property Management
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage hotel properties and their details
          </p>
        </div>
        <Button
          onClick={() => handleOpenDialog()}
          className="rounded-none px-8 py-6"
          style={{ backgroundColor: "#0F172A", color: "white" }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Property
        </Button>
      </div>

      {/* Filters */}
      <Card className="rounded-sm border border-slate-200 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, code, city..."
                className="pl-10 h-12 border-slate-200 rounded-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] h-12 border-slate-200 rounded-none">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Properties List */}
      {filteredProperties.length === 0 ? (
        <Card className="rounded-sm border border-slate-200 p-8">
          <div className="text-center text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-lg font-medium mb-2">
              {searchQuery || statusFilter !== "ALL"
                ? "No properties found"
                : "No properties yet"}
            </p>
            <p className="text-sm">
              {searchQuery || statusFilter !== "ALL"
                ? "Try adjusting your filters"
                : "Click 'New Property' to add your first property"}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredProperties.map((property) => (
            <Card
              key={property._id}
              className="rounded-sm border border-slate-200 hover:shadow-md transition-shadow duration-300"
            >
              <CardHeader className="border-b border-slate-100 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl mb-2" style={{ color: "#059669" }}>
                      {property.name}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={property.status === "ACTIVE" ? "default" : "secondary"}
                        className="rounded-full px-3 py-1 text-xs font-bold tracking-wider uppercase border"
                      >
                        {property.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">
                        {property.code}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDialog(property)}
                      className="rounded-none"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(property._id)}
                      className="rounded-none text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-3">
                {property.location && (
                  <div className="space-y-2">
                    {(property.location.city ||
                      property.location.state ||
                      property.location.country) && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div className="text-sm">
                          {[
                            property.location.city,
                            property.location.state,
                            property.location.country,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {property.timeZone && (
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{property.timeZone}</span>
                  </div>
                )}
                {property.createdAt && (
                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    Created: {new Date(property.createdAt).toLocaleDateString()}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-sm">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
              {editingProperty ? "Edit Property" : "Create New Property"}
            </DialogTitle>
            <DialogDescription>
              {editingProperty
                ? "Update the property details"
                : "Fill in the details to create a new property"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Property Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., The Postcard Goa"
                  className="rounded-none h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="code">Property Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toUpperCase() })
                  }
                  placeholder="e.g., POSTCARD-GOA"
                  className="rounded-none h-12 font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Unique code for the property (uppercase)
                </p>
              </div>
            </div>

            <div className="space-y-4 border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold">Location</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.location?.city || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        location: {
                          ...formData.location,
                          city: e.target.value,
                        },
                      })
                    }
                    placeholder="e.g., Goa"
                    className="rounded-none h-12"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.location?.state || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        location: {
                          ...formData.location,
                          state: e.target.value,
                        },
                      })
                    }
                    placeholder="e.g., Goa"
                    className="rounded-none h-12"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.location?.country || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        location: {
                          ...formData.location,
                          country: e.target.value,
                        },
                      })
                    }
                    placeholder="e.g., India"
                    className="rounded-none h-12"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="timeZone">Time Zone</Label>
                <Input
                  id="timeZone"
                  value={formData.timeZone || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, timeZone: e.target.value })
                  }
                  placeholder="e.g., Asia/Kolkata"
                  className="rounded-none h-12"
                />
                <p className="text-xs text-muted-foreground">
                  IANA timezone identifier
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: "ACTIVE" | "INACTIVE") =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger id="status" className="rounded-none h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleCloseDialog}
                disabled={isSubmitting}
                className="rounded-none"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !formData.name.trim() || !formData.code.trim()}
                className="rounded-none px-8 py-6"
                style={{ backgroundColor: "#0F172A", color: "white" }}
              >
                {isSubmitting
                  ? "Saving..."
                  : editingProperty
                  ? "Update Property"
                  : "Create Property"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

