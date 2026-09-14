export const GUEST_DEPLOY_LIMIT = 10;

export type ProjectStatus = "draft" | "published" | "archived";

export type ProjectSummary = {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: ProjectStatus;
  currentVersion: string | null;
  publishedVersion: string | null;
  runtimeId: string;
  executionCount: number;
  fetchCount: number;
  errorCount: number;
  obfuscate: boolean;
  createdAt: string;
  updatedAt: string;
};

export type VersionSummary = {
  id: string;
  version: string;
  changelog: string;
  isPublished: boolean;
  archived: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  byteSize: number;
};

export type VersionSource = VersionSummary & {
  sourceCode: string;
};

export type AuditEntry = {
  id: string;
  action: string;
  projectId: string | null;
  metadata: string;
  createdAt: string;
};

export type WebhookKind = "generic" | "discord" | "slack";
export type WebhookPayloadMode = "full" | "compact" | "custom";

export type WebhookRecord = {
  id: string;
  name: string;
  endpoint: string;
  secretSuffix: string;
  events: string[];
  enabled: boolean;
  lastStatus: number | null;
  lastFiredAt: string | null;
  createdAt: string;
  kind: WebhookKind;
  payloadMode: WebhookPayloadMode;
  discordUsername: string | null;
  contentTemplate: string | null;
};

export type WebhookDraft = {
  name: string;
  endpoint: string;
  events: string[];
  kind: WebhookKind | "auto";
  payloadMode: WebhookPayloadMode;
  discordUsername: string;
  contentTemplate: string;
};

export type AnalyticsPoint = {
  day: string;
  executions: number;
  errors: number;
};

export type AnalyticsPayload = {
  total: number;
  fetches: number;
  fetchesMonth: number;
  today: number;
  week: number;
  month: number;
  errorRate: number;
  currentVersion: string | null;
  runtimeId: string;
  series: AnalyticsPoint[];
  statuses: { status: number; count: number }[];
  versions: { version: string; count: number }[];
  regions: { region: string; count: number }[];
  recent: {
    id: string;
    eventType: string;
    statusCode: number;
    region: string | null;
    createdAt: string;
  }[];
  logs: {
    id: string;
    kind: string;
    message: string | null;
    statusCode: number;
    createdAt: string;
  }[];
};

export type MePayload = {
  userId: string;
  kind: "registered" | "guest";
  email: string | null;
  displayName: string;
  handle: string | null;
  bio: string;
  avatarHue: number;
  emailRegistered: boolean;
  isGuest: boolean;
  publishedCount: number;
  projectCount: number;
  remainingDeploys: number | null;
  guestLimit: number;
};

export const WEBHOOK_EVENT_OPTIONS = [
  { id: "published", label: "Project published" },
  { id: "updated", label: "Project updated" },
  { id: "execution", label: "Runtime execution" },
  { id: "error", label: "Error event" },
  { id: "version_published", label: "Version published" },
  { id: "client_event", label: "Luau proxy event" },
] as const;

export type WebhookEventId = (typeof WEBHOOK_EVENT_OPTIONS)[number]["id"];

export function emptyWebhookDraft(): WebhookDraft {
  return {
    name: "",
    endpoint: "",
    events: ["published", "error"],
    kind: "auto",
    payloadMode: "full",
    discordUsername: "",
    contentTemplate: "{{event}} on {{slug}} (v{{version}})",
  };
}
