// =============================================
// VA CHẠM GIỮA CÁC ĐƠN VỊ & CÔNG TRÌNH
// =============================================

/**
 * Xử lý va chạm giữa lính/tướng với nhau (giữ đội hình lính)
 */
function handleUnitCollisions() {
    const units = [player, bot, ...minions].filter(u => u && !u.isDead && u.hp > 0);
    const n = units.length;

    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const u1 = units[i];
            const u2 = units[j];

            const bothMinions = (u1 instanceof Minion) && (u2 instanceof Minion);
            const sameTeam    = u1.team === u2.team;

            let dx   = u2.x - u1.x;
            let dy   = u2.y - u1.y;
            let dist = Math.hypot(dx, dy);
            const minDist = u1.radius + u2.radius;

            if (dist < minDist) {
                if (dist === 0) {
                    dx   = (Math.random() - 0.5) * 0.2;
                    dy   = 0.01;
                    dist = Math.hypot(dx, dy);
                }
                const overlap = (minDist - dist) * 0.5;
                const nx = dx / dist;
                const ny = dy / dist;

                if (bothMinions && sameTeam) {
                    // Lính cùng đội: chỉ tách theo trục X để duy trì đội hình hàng dọc trong lane
                    u1.x -= nx * overlap;
                    u2.x += nx * overlap;
                } else {
                    // Đơn vị khác loại / khác đội: đẩy 2 chiều nhẹ nhàng
                    u1.x -= nx * overlap;
                    u1.y -= ny * overlap;
                    u2.x += nx * overlap;
                    u2.y += ny * overlap;
                }
            }
        }
    }

    for (const u of units) {
        if (typeof u.clampPosition === 'function') {
            u.clampPosition();
        } else {
            u.x = Math.max(u.radius, Math.min(GAME_WIDTH - u.radius, u.x));
            u.y = Math.max(LANE_TOP + u.radius, Math.min(LANE_BOTTOM - u.radius, u.y));
            handleBuildingCollisions(u);
        }
    }
}

/**
 * Xử lý va chạm với Trụ và Nhà chính (Trượt mượt quanh viền, không nảy giật)
 */
function handleBuildingCollisions(entity) {
    if (!turrets || !nexuses) return;
    const buildings = [...turrets, ...nexuses];

    for (const b of buildings) {
        if (!b || b.hp <= 0) continue;

        if (b instanceof Turret) {
            const minDist = entity.radius + b.radius + 2;
            let dx        = entity.x - b.x;
            let dy        = entity.y - b.y;
            let dist      = Math.hypot(dx, dy);

            if (dist < minDist) {
                if (dist === 0) { dx = 0.1; dy = 0.1; dist = Math.hypot(dx, dy); }
                const overlap = minDist - dist;
                entity.x += (dx / dist) * overlap;
                entity.y += (dy / dist) * overlap;
            }
        } else if (b instanceof Nexus) {
            // Nhà chính: hình vuông
            const marginX  = b.radius + entity.radius + 2;
            const marginY  = b.radius + entity.radius + 2;
            const dx       = entity.x - b.x;
            const dy       = entity.y - b.y;
            const absX     = Math.abs(dx);
            const absY     = Math.abs(dy);

            if (absX < marginX && absY < marginY) {
                const overlapX = marginX - absX;
                const overlapY = marginY - absY;

                if (overlapX < overlapY) {
                    entity.x += dx > 0 ? overlapX : -overlapX;
                } else {
                    entity.y += dy > 0 ? overlapY : -overlapY;
                }
            }
        }
    }
}
