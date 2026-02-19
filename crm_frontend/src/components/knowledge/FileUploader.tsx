import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, Upload, File } from "lucide-react";
import { toast } from "sonner";

interface FileUploaderProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
}

export const FileUploader = ({
  files,
  onFilesChange,
  maxFiles = 10,
  maxSizeMB = 50,
}: FileUploaderProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    const maxSize = maxSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`File ${file.name} exceeds ${maxSizeMB}MB limit`);
      return false;
    }
    return true;
  };

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;

    const fileArray = Array.from(newFiles);
    const validFiles = fileArray.filter(validateFile);

    if (validFiles.length !== fileArray.length) {
      toast.error("Some files were rejected due to size limits");
    }

    const remainingSlots = maxFiles - files.length;
    if (validFiles.length > remainingSlots) {
      toast.error(`Maximum ${maxFiles} files allowed`);
      validFiles.splice(remainingSlots);
    }

    onFilesChange([...files, ...validFiles]);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    onFilesChange(newFiles);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          border-2 border-dashed rounded-sm p-8 text-center transition-colors
          ${isDragging ? "border-emerald-600 bg-emerald-50" : "border-slate-200"}
        `}
      >
        <Upload className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground mb-2">
          Drag and drop files here, or click to select
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          Maximum {maxFiles} files, {maxSizeMB}MB per file
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-none"
        >
          Select Files
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInput}
          className="hidden"
          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Selected Files ({files.length}/{maxFiles})</p>
          <div className="space-y-2">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border border-slate-200 rounded-sm bg-slate-50"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(index)}
                  className="rounded-none text-red-600 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

