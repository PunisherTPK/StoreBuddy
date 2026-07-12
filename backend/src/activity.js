import { logActivity } from "./storeProvider.js";

export async function recordActivity(
    req,
    action,
    entity,
    entityId,
    description
) {
    await logActivity({
        userId: req.auth?.userId ?? null,
        action,
        entity,
        entityId,
        description,
        createdAt: new Date()
    });
}
