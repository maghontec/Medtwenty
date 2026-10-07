import "server-only";
import { run } from "./db";

export function audit(
  actor: { id: number; email: string } | null,
  action: string,
  entity: string,
  entityId: string | number | null,
  before?: unknown,
  after?: unknown,
) {
  run(
    "INSERT INTO audit_log (actor_id, actor_email, action, entity, entity_id, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
    actor?.id ?? null,
    actor?.email ?? "system",
    action,
    entity,
    entityId == null ? null : String(entityId),
    before === undefined ? null : JSON.stringify(before),
    after === undefined ? null : JSON.stringify(after),
  );
}
