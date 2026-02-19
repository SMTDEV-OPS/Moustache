import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  Template,
  TemplateMedium,
  TEMPLATE_PLACEHOLDERS,
} from "@/services/templates";
import { Plus, Pencil, Trash2, Mail, MessageSquare, Eye, Copy } from "lucide-react";

export const MessageTemplates = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "EMAIL" | "WHATSAPP">("all");

  // Form state
  const [formName, setFormName] = useState("");
  const [formMedium, setFormMedium] = useState<TemplateMedium>("EMAIL");
  const [formSubject, setFormSubject] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);

  // Preview state
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  useEffect(() => {
    void loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setIsLoading(true);
      const list = await listTemplates();
      setTemplates(list);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load templates",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingTemplate(null);
    setFormName("");
    setFormMedium("EMAIL");
    setFormSubject("");
    setFormBody("");
    setFormIsActive(true);
    setIsDialogOpen(true);
  };

  const openEditDialog = (template: Template) => {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormMedium(template.medium);
    setFormSubject(template.subject || "");
    setFormBody(template.body);
    setFormIsActive(template.isActive);
    setIsDialogOpen(true);
  };

  const openPreview = (template: Template) => {
    setPreviewTemplate(template);
    setIsPreviewOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast({ title: "Error", description: "Template name is required", variant: "destructive" });
      return;
    }
    if (!formBody.trim()) {
      toast({ title: "Error", description: "Template body is required", variant: "destructive" });
      return;
    }
    if (formMedium === "EMAIL" && !formSubject.trim()) {
      toast({ title: "Error", description: "Email subject is required", variant: "destructive" });
      return;
    }

    try {
      const payload = {
        name: formName,
        medium: formMedium,
        subject: formMedium === "EMAIL" ? formSubject : undefined,
        body: formBody,
        isActive: formIsActive,
      };

      if (editingTemplate) {
        await updateTemplate(editingTemplate.id, payload);
        toast({ title: "Success", description: "Template updated successfully" });
      } else {
        await createTemplate(payload);
        toast({ title: "Success", description: "Template created successfully" });
      }

      setIsDialogOpen(false);
      void loadTemplates();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save template",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (template: Template) => {
    if (!confirm(`Are you sure you want to delete "${template.name}"?`)) return;

    try {
      await deleteTemplate(template.id);
      toast({ title: "Success", description: "Template deleted successfully" });
      void loadTemplates();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete template",
        variant: "destructive",
      });
    }
  };

  const insertPlaceholder = (placeholder: string) => {
    setFormBody((prev) => prev + placeholder);
  };

  const renderPreviewContent = (template: Template) => {
    // Replace placeholders with sample data
    let content = template.body;
    content = content.replace(/\{\{guestName\}\}/g, "Priya Sharma");
    content = content.replace(/\{\{propertyName\}\}/g, "Postcard Goa");
    content = content.replace(/\{\{checkInDate\}\}/g, "15 Jan 2025");
    content = content.replace(/\{\{checkOutDate\}\}/g, "18 Jan 2025");
    content = content.replace(/\{\{leadNumber\}\}/g, "L-20250112-0042");

    let subject = template.subject || "";
    subject = subject.replace(/\{\{guestName\}\}/g, "Priya Sharma");
    subject = subject.replace(/\{\{propertyName\}\}/g, "Postcard Goa");

    return { subject, content };
  };

  const filteredTemplates =
    activeTab === "all"
      ? templates
      : templates.filter((t) => t.medium === activeTab);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Message Templates</h2>
          <p className="text-muted-foreground">
            Create reusable templates for automated follow-up messages
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="all">All Templates</TabsTrigger>
          <TabsTrigger value="EMAIL" className="flex items-center gap-1">
            <Mail className="h-4 w-4" /> Email
          </TabsTrigger>
          <TabsTrigger value="WHATSAPP" className="flex items-center gap-1">
            <MessageSquare className="h-4 w-4" /> WhatsApp
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading templates...</div>
          ) : filteredTemplates.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">
                  {activeTab === "all"
                    ? "No templates created yet"
                    : `No ${activeTab.toLowerCase()} templates created yet`}
                </p>
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Template
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredTemplates.map((template) => (
                <Card key={template.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {template.medium === "EMAIL" ? (
                          <Mail className="h-5 w-5 text-blue-500" />
                        ) : (
                          <MessageSquare className="h-5 w-5 text-green-500" />
                        )}
                        <CardTitle className="text-base">{template.name}</CardTitle>
                      </div>
                      <Badge variant={template.isActive ? "default" : "secondary"}>
                        {template.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {template.subject && (
                      <p className="text-sm font-medium mb-1">Subject: {template.subject}</p>
                    )}
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                      {template.body}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => openPreview(template)}>
                        <Eye className="h-4 w-4 mr-1" />
                        Preview
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(template)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(template)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Template" : "Create Template"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Template Name *</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Welcome Email"
              />
            </div>

            <div>
              <Label>Medium *</Label>
              <Select
                value={formMedium}
                onValueChange={(v) => setFormMedium(v as TemplateMedium)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMAIL">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" /> Email
                    </div>
                  </SelectItem>
                  <SelectItem value="WHATSAPP">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" /> WhatsApp
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formMedium === "EMAIL" && (
              <div>
                <Label htmlFor="subject">Email Subject *</Label>
                <Input
                  id="subject"
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  placeholder="e.g., Your stay at {{propertyName}}"
                />
              </div>
            )}

            <div>
              <Label htmlFor="body">Message Body *</Label>
              <Textarea
                id="body"
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                placeholder="Write your message here..."
                rows={6}
              />
            </div>

            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">
                Available Placeholders (click to insert)
              </Label>
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_PLACEHOLDERS.map((p) => (
                  <Button
                    key={p.key}
                    variant="outline"
                    size="sm"
                    onClick={() => insertPlaceholder(p.key)}
                    title={p.description}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    {p.key}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formIsActive}
                onCheckedChange={setFormIsActive}
              />
              <Label htmlFor="isActive">Template is active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingTemplate ? "Update Template" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Template Preview</DialogTitle>
          </DialogHeader>

          {previewTemplate && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                {previewTemplate.medium === "EMAIL" ? (
                  <Mail className="h-5 w-5 text-blue-500" />
                ) : (
                  <MessageSquare className="h-5 w-5 text-green-500" />
                )}
                <span className="font-medium">{previewTemplate.name}</span>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <p className="text-sm text-muted-foreground">Preview with sample data:</p>
                </CardHeader>
                <CardContent>
                  {previewTemplate.medium === "EMAIL" && (
                    <div className="mb-3 pb-3 border-b">
                      <p className="text-sm text-muted-foreground">Subject:</p>
                      <p className="font-medium">
                        {renderPreviewContent(previewTemplate).subject}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Message:</p>
                    <div className="whitespace-pre-wrap bg-muted/50 p-4 rounded-lg">
                      {renderPreviewContent(previewTemplate).content}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="text-xs text-muted-foreground">
                Sample data used: Guest Name = "Priya Sharma", Property = "Postcard Goa",
                Check-in = "15 Jan 2025"
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

