/**
 * API response shape for GET /api/health (Express).
 * Add more `*.model.ts` files here as your API grows (e.g. player.model.ts).
 */
export interface HealthResponse {
  status: string;
  database: string;
}
