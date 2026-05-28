import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Calendar, Edit, Trash2, Plus } from "lucide-react";
import {
  getKnowledgeBaseItems,
  deleteKnowledgeBaseItem,
  getFileDownloadUrl,
  type KnowledgeBaseItem,
} from "@/services/knowledgeBase";
import { toast } from "sonner";
import { TemplateEditor } from "./TemplateEditor";
import { KnowledgeDriveCard, KnowledgeLink, isUrlLike } from "./KnowledgeContentBlocks";

interface TemplatesViewProps {
  propertyId: string;
  searchQuery?: string;
  canManage?: boolean;
}

export const TemplatesView = ({
  propertyId,
  searchQuery = "",
  canManage = false,
}: TemplatesViewProps) => {
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
        type: "TEMPLATE",
        search: searchQuery || undefined,
      });
      setItems(data);
    } catch (error) {
      console.error("Failed to load templates:", error);
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) {
      return;
    }

    try {
      await deleteKnowledgeBaseItem(id);
      toast.success("Template deleted");
      loadItems();
    } catch (error) {
      console.error("Failed to delete template:", error);
      toast.error("Failed to delete template");
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
        <p className="text-muted-foreground">Loading templates...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
            Templates
          </h2>
          <p className="text-muted-foreground">Download standardized templates and documents</p>
        </div>
        {canManage && (
          <Button
            onClick={() => setIsCreating(true)}
            className="rounded-none px-8 py-6"
            style={{ backgroundColor: "#0F172A", color: "white" }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Upload Template
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <Card className="rounded-sm border border-slate-200 p-8">
          <div className="text-center text-muted-foreground">
            <p>No templates found.</p>
            {canManage && (
              <p className="mt-2 text-sm">
                Click "Upload Template" to add one.
              </p>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {items.map((item) => {
            const content = item.content as Record<string, unknown> | undefined;
            const category = (content?.category as string) || "General";
            const lastUpdated = item.updatedAt
              ? new Date(item.updatedAt).toLocaleDateString()
              : "";

            return (
              <Card key={item._id} className="rounded-sm border border-slate-200 hover:shadow-md transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                        <Badge
                          variant={
                            category === "Proposals"
                              ? "default"
                              : category === "Quotations"
                              ? "secondary"
                              : "outline"
                          }
                          className="rounded-full px-3 py-1 text-xs font-bold tracking-wider uppercase border"
                        >
                          {category}
                        </Badge>
                      </div>
                      {item.description && (
                        <p className="text-muted-foreground text-sm mb-3">{item.description}</p>
                      )}
                      {content?.driveLink &&
                        typeof content.driveLink === "string" &&
                        isUrlLike(content.driveLink) && (
                          <div className="mb-4">
                            <KnowledgeDriveCard url={String(content.driveLink)} />
                          </div>
                        )}
                      <div className="grid gap-2 sm:grid-cols-2 mb-3">
                        {(["brochure", "salesDeck", "factSheet", "cancellationPolicy"] as const).map(
                          (key) => {
                            const val = content?.[key];
                            if (!val || typeof val !== "string") return null;
                            const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
                            return (
                              <div key={key} className="rounded-md border border-border px-3 py-2 text-sm">
                                <span className="text-muted-foreground">{label}: </span>
                                {isUrlLike(val) ? (
                                  <KnowledgeLink href={val} />
                                ) : (
                                  <span>{val}</span>
                                )}
                              </div>
                            );
                          }
                        )}
                      </div>
                      {lastUpdated && (
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3 mr-1" />
                          Last updated: {lastUpdated}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {item.files.length > 0 && (
                        <Button
                          size="sm"
                          onClick={() => handleDownload(item.files[0]._id, item.files[0].originalName)}
                          className="rounded-none"
                          style={{ backgroundColor: "#059669", color: "white" }}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      )}
                      {canManage && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingItem(item)}
                            className="rounded-none"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(item._id)}
                            className="rounded-none text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {(isCreating || editingItem) && (
        <TemplateEditor
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
