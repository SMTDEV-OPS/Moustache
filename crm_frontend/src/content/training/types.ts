export type TrainingTrack =
  | "getting-started"
  | "leads"
  | "sales"
  | "followups"
  | "email"
  | "knowledge"
  | "reports"
  | "admin"
  | "integrations";

export type TrainingAudience = "all" | "agent" | "supervisor" | "admin";

export interface TrainingSection {
  heading?: string;
  body?: string;
  steps?: string[];
  tips?: string[];
  callout?: string;
}

export interface TrainingKbLink {
  label: string;
  view: string;
}

export interface TrainingArticle {
  id: string;
  title: string;
  summary: string;
  track: TrainingTrack;
  audience: TrainingAudience[];
  relatedView?: string;
  sections: TrainingSection[];
  kbLinks?: TrainingKbLink[];
}

export interface TrainingTrackMeta {
  id: TrainingTrack;
  label: string;
  description: string;
}
