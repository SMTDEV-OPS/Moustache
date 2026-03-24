import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronsUpDown,
  Check,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Building2,
  FileText,
  Download,
  Globe,
  Search,
  ArrowLeft,
} from "lucide-react";
import { API_BASE_URL, withAuthHeaders } from "@/services/api";
import { PropertiesView } from "./PropertiesView";
import { FactSheetsView } from "./FactSheetsView";
import { TemplatesView } from "./TemplatesView";
import { ResourcesView } from "./ResourcesView";
import { KnowledgeBaseType } from "@/services/knowledgeBase";

interface Property {
  _id: string;
  name: string;
  code: string;
  status: "ACTIVE" | "INACTIVE";
}

interface KnowledgeBaseMainProps {
  isAdmin?: boolean;
  permissions?: string[];
}

export const KnowledgeBaseMain = ({
  isAdmin,
  permissions,
}: KnowledgeBaseMainProps) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [selectedCategory, setSelectedCategory] =
    useState<KnowledgeBaseType | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [propertySearchOpen, setPropertySearchOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const canManage = isAdmin || permissions?.includes("knowledgebase.manage");

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/properties`, {
          headers: withAuthHeaders(),
        });
        if (response.ok) {
          const data = await response.json();
          setProperties(
            Array.isArray(data)
              ? data.filter((p: Property) => p.status === "ACTIVE")
              : []
          );
        }
      } catch (error) {
        console.error("Failed to fetch properties:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProperties();
  }, []);

  const handleCategorySelect = (category: KnowledgeBaseType) => {
    setSelectedCategory(category);
  };

  const handleBackToCategories = () => {
    setSelectedCategory(null);
    setSearchQuery("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading properties...</p>
      </div>
    );
  }

  // Show category selection if property is selected but no category
  if (selectedPropertyId && !selectedCategory) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
              Knowledge Base
            </h1>
            <p className="text-muted-foreground mt-2">
              Select a category to view content for{" "}
              {properties.find((p) => p._id === selectedPropertyId)?.name}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setSelectedPropertyId("");
              setSelectedCategory(null);
            }}
            className="rounded-none"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Change Hotel
          </Button>
        </div>

        {/* Search Bar */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search knowledge base..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-none h-12"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setSearchQuery("")}
            className="rounded-none px-8 py-6"
          >
            Clear
          </Button>
        </div>

        {/* Category Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow duration-300 rounded-sm border border-slate-200"
            onClick={() => handleCategorySelect("PROPERTY")}
          >
            <CardHeader className="border-b border-slate-100 p-6">
              <CardTitle className="flex items-center text-xl">
                <Building2 className="h-6 w-6 mr-3 text-emerald-600" />
                Properties
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                View property details, amenities, and information
              </p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-shadow duration-300 rounded-sm border border-slate-200"
            onClick={() => handleCategorySelect("FACTSHEET")}
          >
            <CardHeader className="border-b border-slate-100 p-6">
              <CardTitle className="flex items-center text-xl">
                <FileText className="h-6 w-6 mr-3 text-emerald-600" />
                Fact Sheets
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                Detailed property specifications and facts
              </p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-shadow duration-300 rounded-sm border border-slate-200"
            onClick={() => handleCategorySelect("TEMPLATE")}
          >
            <CardHeader className="border-b border-slate-100 p-6">
              <CardTitle className="flex items-center text-xl">
                <Download className="h-6 w-6 mr-3 text-emerald-600" />
                Templates
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                Download standardized templates and documents
              </p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-shadow duration-300 rounded-sm border border-slate-200"
            onClick={() => handleCategorySelect("RESOURCE")}
          >
            <CardHeader className="border-b border-slate-100 p-6">
              <CardTitle className="flex items-center text-xl">
                <Globe className="h-6 w-6 mr-3 text-emerald-600" />
                Resources
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                Additional resources and materials
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show category view if category is selected
  if (selectedPropertyId && selectedCategory) {
    const categoryViews = {
      PROPERTY: (
        <PropertiesView
          propertyId={selectedPropertyId}
          searchQuery={searchQuery}
          canManage={canManage}
        />
      ),
      FACTSHEET: (
        <FactSheetsView
          propertyId={selectedPropertyId}
          searchQuery={searchQuery}
          canManage={canManage}
        />
      ),
      TEMPLATE: (
        <TemplatesView
          propertyId={selectedPropertyId}
          searchQuery={searchQuery}
          canManage={canManage}
        />
      ),
      RESOURCE: (
        <ResourcesView
          propertyId={selectedPropertyId}
          searchQuery={searchQuery}
          canManage={canManage}
        />
      ),
    };

    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <Button
              variant="ghost"
              onClick={handleBackToCategories}
              className="mb-2 rounded-none"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Categories
            </Button>
            <h2 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
              {selectedCategory === "PROPERTY" && "Properties"}
              {selectedCategory === "FACTSHEET" && "Fact Sheets"}
              {selectedCategory === "TEMPLATE" && "Templates"}
              {selectedCategory === "RESOURCE" && "Resources"}
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              {properties.find((p) => p._id === selectedPropertyId)?.name}
            </p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search in this category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-none h-12"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setSearchQuery("")}
            className="rounded-none px-8 py-6"
          >
            Clear
          </Button>
        </div>
        {categoryViews[selectedCategory]}
      </div>
    );
  }

  // Show hotel selection if no property selected
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
          Knowledge Base
        </h1>
        <p className="text-muted-foreground mt-2">
          Select a hotel to view its knowledge base content
        </p>
      </div>

      <Card className="rounded-sm border border-slate-200 p-6">
        <div className="space-y-4">
          <label className="text-sm font-medium text-foreground">
            Select Hotel
          </label>
          <Popover open={propertySearchOpen} onOpenChange={setPropertySearchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={propertySearchOpen}
                className="w-full justify-between rounded-none h-12 font-normal"
              >
                {selectedPropertyId
                  ? properties.find((property) => property._id === selectedPropertyId)?.name
                  : "Choose a hotel..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-none">
              <Command>
                <CommandInput placeholder="Search hotel..." />
                <CommandList>
                  <CommandEmpty>No hotel found.</CommandEmpty>
                  <CommandGroup>
                    {properties.map((property) => (
                      <CommandItem
                        key={property._id}
                        value={property.name}
                        keywords={[property.code]}
                        onSelect={() => {
                          setSelectedPropertyId(property._id);
                          setPropertySearchOpen(false);
                        }}
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${
                            selectedPropertyId === property._id ? "opacity-100" : "opacity-0"
                          }`}
                        />
                        {property.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </Card>
    </div>
  );
};

