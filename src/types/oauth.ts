// A connected MCP app as shown in the API-settings dialog. Shared by
// /api/user/oauth-grants and the client component, so it lives outside the
// (server-only) models.
export interface ConnectedApp {
  id: string;
  clientName: string;
  redirectHost: string;
  createdAt: string;
  lastUsedAt: string | null;
}
