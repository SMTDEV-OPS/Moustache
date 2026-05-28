import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, FileText, IndianRupee, Globe, Download, Edit, Trash2, Plus, Building2, BookOpen } from "lucide-react";
import {
  getKnowledgeBaseItems,
  deleteKnowledgeBaseItem,
  getFileDownloadUrl,
  type KnowledgeBaseItem,
} from "@/services/knowledgeBase";
import { toast } from "sonner";
import { ResourceEditor } from "./ResourceEditor";
import { KnowledgeProse, isUrlLike, KnowledgeLink } from "./KnowledgeContentBlocks";

interface ResourcesViewProps {
  propertyId: string;
  searchQuery?: string;
  canManage?: boolean;
}

export const ResourcesView = ({
  propertyId,
  searchQuery = "",
  canManage = false,
}: ResourcesViewProps) => {
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
        type: "RESOURCE",
        search: searchQuery || undefined,
      });
      setItems(data);
    } catch (error) {
      console.error("Failed to load resources:", error);
      toast.error("Failed to load resources");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this resource?")) {
      return;
    }

    try {
      await deleteKnowledgeBaseItem(id);
      toast.success("Resource deleted");
      loadItems();
    } catch (error) {
      console.error("Failed to delete resource:", error);
      toast.error("Failed to delete resource");
    }
  };

  const handleDownload = (fileId: string, filename: string) => {
    const url = getFileDownloadUrl(fileId);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
  };

  const getIcon = (item: KnowledgeBaseItem) => {
    const content = (item.content || {}) as Record<string, unknown>;
    const iconType = content.iconType as string;
    
    const iconMap: Record<string, typeof Users> = {
      Users: Users,
      FileText: FileText,
      IndianRupee: IndianRupee,
      Globe: Globe,
      Building2: Building2,
      BookOpen: BookOpen,
    };
    
    if (iconType && iconMap[iconType]) {
      return iconMap[iconType];
    }
    
    // Fallback to title-based detection
    const lowerTitle = item.title.toLowerCase();
    if (lowerTitle.includes("brand") || lowerTitle.includes("guideline")) {
      return Users;
    }
    if (lowerTitle.includes("policy") || lowerTitle.includes("document")) {
      return FileText;
    }
    if (lowerTitle.includes("rate") || lowerTitle.includes("pricing")) {
      return IndianRupee;
    }
    if (lowerTitle.includes("training") || lowerTitle.includes("education")) {
      return Globe;
    }
    return FileText;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading resources...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
            Resources
          </h2>
          <p className="text-muted-foreground">Additional resources and materials for staff</p>
        </div>
        {canManage && (
          <Button
            onClick={() => setIsCreating(true)}
            className="rounded-none px-8 py-6"
            style={{ backgroundColor: "#0F172A", color: "white" }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Upload Resource
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <Card className="rounded-sm border border-slate-200 p-8">
          <div className="text-center text-muted-foreground">
            <p>No resources found.</p>
            {canManage && (
              <p className="mt-2 text-sm">
                Click "Upload Resource" to add one.
              </p>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {items.map((item) => {
            const Icon = getIcon(item);
            const content = (item.content || {}) as Record<string, unknown>;
            const buttonText = (content.buttonText as string) || "Download";

            return (
              <Card key={item._id} className="rounded-sm border border-slate-200 hover:shadow-md transition-shadow duration-300">
                <CardHeader className="border-b border-slate-100 p-6">
                  <CardTitle className="flex items-center">
                    <Icon className="h-5 w-5 mr-2" style={{ color: "#059669" }} />
                    {item.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-6">
                  {item.description && (
                    <div className="text-sm text-muted-foreground">{item.description}</div>
                  )}
                  <div className="space-y-3">
                    {(
                      [
                        ["Policy documents", "policyDocuments"],
                        ["Training material", "trainingMaterial"],
                        ["Brand guidelines", "brandGuideline"],
                        ["Communication guidelines", "communicationGuidelines"],
                        ["SOPs", "sopByDepartment"],
                      ] as const
                    ).map(([label, key]) => {
                      const val = content[key];
                      if (!val || typeof val !== "string" || !String(val).trim()) return null;
                      const text = String(val);
                      return (
                        <div key={key} className="rounded-md border border-border p-3">
                          <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
                          {isUrlLike(text) ? (
                            <KnowledgeLink href={text} />
                          ) : (
                            <KnowledgeProse text={text} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {item.files.length > 0 ? (
                    <Button
                      variant="outline"
                      onClick={() => handleDownload(item.files[0]._id, item.files[0].originalName)}
                      className="w-full justify-start rounded-none"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {buttonText}
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">No files attached</p>
                  )}
                  {canManage && (
                    <div className="flex gap-2 pt-2 border-t">
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
        <ResourceEditor
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
