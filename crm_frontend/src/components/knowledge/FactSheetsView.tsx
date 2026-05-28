import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Edit, Trash2, Plus } from "lucide-react";
import {
  getKnowledgeBaseItems,
  deleteKnowledgeBaseItem,
  getFileDownloadUrl,
  type KnowledgeBaseItem,
} from "@/services/knowledgeBase";
import { toast } from "sonner";
import { FactSheetEditor } from "./FactSheetEditor";
import { KnowledgeProse, KnowledgeLink, isUrlLike } from "./KnowledgeContentBlocks";

interface FactSheetsViewProps {
  propertyId: string;
  searchQuery?: string;
  canManage?: boolean;
}

export const FactSheetsView = ({
  propertyId,
  searchQuery = "",
  canManage = false,
}: FactSheetsViewProps) => {
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
        type: "FACTSHEET",
        search: searchQuery || undefined,
      });
      setItems(data);
    } catch (error) {
      console.error("Failed to load fact sheets:", error);
      toast.error("Failed to load fact sheets");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this fact sheet?")) {
      return;
    }

    try {
      await deleteKnowledgeBaseItem(id);
      toast.success("Fact sheet deleted");
      loadItems();
    } catch (error) {
      console.error("Failed to delete fact sheet:", error);
      toast.error("Failed to delete fact sheet");
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
        <p className="text-muted-foreground">Loading fact sheets...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
            Fact Sheets
          </h2>
          <p className="text-muted-foreground">Detailed property information and specifications</p>
        </div>
        {canManage && (
          <Button
            onClick={() => setIsCreating(true)}
            className="rounded-none px-8 py-6"
            style={{ backgroundColor: "#0F172A", color: "white" }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Upload Fact Sheet
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <Card className="rounded-sm border border-slate-200 p-8">
          <div className="text-center text-muted-foreground">
            <p>No fact sheets found.</p>
            {canManage && (
              <p className="mt-2 text-sm">
                Click "Upload Fact Sheet" to add one.
              </p>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid gap-6">
          {items.map((item) => {
            const details = item.content as Record<string, string> | undefined;

            return (
              <Card key={item._id} className="rounded-sm border border-slate-200 hover:shadow-md transition-shadow duration-300">
                <CardHeader className="border-b border-slate-100 p-6">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl" style={{ color: "#059669" }}>
                      {item.title}
                    </CardTitle>
                    {canManage && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingItem(item)}
                          className="rounded-none"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(item._id)}
                          className="rounded-none text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-sm text-muted-foreground mt-2">{item.description}</p>
                  )}
                </CardHeader>
                <CardContent className="p-6">
                  {details && Object.keys(details).filter((k) => k !== "rawRows").length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {Object.entries(details)
                        .filter(([key]) => key !== "rawRows")
                        .map(([key, value]) => {
                          const text = String(value ?? "");
                          return (
                            <div key={key} className="rounded-md border border-border px-4 py-3">
                              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                {key}
                              </div>
                              <div className="mt-1">
                                {isUrlLike(text) ? (
                                  <KnowledgeLink href={text} />
                                ) : (
                                  <KnowledgeProse text={text} />
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No details available</p>
                  )}

                  {item.files.length > 0 && (
                    <div className="mt-6 pt-4 border-t">
                      <h4 className="font-medium text-foreground mb-3">Attachments</h4>
                      <div className="space-y-2">
                        {item.files.map((file) => (
                          <Button
                            key={file._id}
                            variant="outline"
                            onClick={() => handleDownload(file._id, file.originalName)}
                            className="w-full justify-start rounded-none"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            {file.originalName}
                            <span className="ml-auto text-xs text-muted-foreground">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {(isCreating || editingItem) && (
        <FactSheetEditor
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
