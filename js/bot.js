// =============================================
// BOT AI — MUA ĐỒ & XỬ LÝ HÀNH VI CHIẾN ĐẤU (DÙNG A* NAV)
// =============================================

let botNavPath    = null;
let botNavVersion = -1;
let botWpIdx      = 0;
let botLastTgtKey = '';

/**
 * Bot tự động mua đồ thông minh dựa vào trạng thái trận đấu
 */
function botSmartBuy() {
    if (!bot || bot.items.length >= MAX_ITEMS) return;

    const hpRatio  = bot.hp / bot.maxHp;
    const killDiff = bot.kills - (player ? player.kills : 0);

    const ownedIds  = new Set(bot.items.map(i => i.id));
    const available = SHOP_ITEMS.filter(i => !ownedIds.has(i.id) && bot.gold >= i.price);

    if (available.length === 0) return;

    let bestItem = null, bestScore = -999;

    for (const item of available) {
        let score = item.price / 100;

        if (hpRatio < 0.55) {
            if (item.stats.maxHp)   score += 4;
            if (item.stats.hpRegen) score += 3;
        }
        if (killDiff < 0) {
            if (item.stats.atkDmg)      score += 3;
            if (item.stats.atkCdReduce) score += 1.5;
        }
        if (killDiff > 1 && item.stats.speed) score += 2;

        if (score > bestScore) {
            bestScore = score;
            bestItem  = item;
        }
    }

    if (bestItem) {
        bot.buyItem(bestItem);
        createParticles(bot.x, bot.y, '#ffcc00', 12);
        floatingTexts.push(new FloatingText(bot.x, bot.y - 40, `Mua ${bestItem.name}`, '#ffcc00'));
    }
}

/**
 * Cập nhật AI chiến đấu của Bot
 */
function updateBotAI(dt) {
    if (!bot || bot.isDead) return;

    // 1. Mua đồ thông minh
    botSmartBuy();

    const distToPlayer    = player && !player.isDead ? Math.hypot(player.x - bot.x, player.y - bot.y) : 9999;
    const blueTurret      = turrets.find(t => t.team === 'blue' && t.hp > 0);
    const distToTurret    = blueTurret ? Math.hypot(blueTurret.x - bot.x, blueTurret.y - bot.y) : 9999;
    const hasLiningMinion = blueTurret
        ? minions.some(m => m.team === 'red' && m.hp > 0 && Math.hypot(blueTurret.x - m.x, blueTurret.y - m.y) <= blueTurret.range)
        : false;

    const botShrine = shrines.find(s => s.team === 'red');
    const hpRatio   = bot.hp / bot.maxHp;

    // --- 2. RÚT LUI VỀ TẾ ĐÀN (Hysteresis: < 25% HP lùi, >= 90% HP tiếp tục chiến đấu) ---
    if (bot.isRetreating === undefined) bot.isRetreating = false;

    if (hpRatio < 0.25) {
        bot.isRetreating = true;
    } else if (hpRatio >= 0.90) {
        bot.isRetreating = false;
    }

    if (bot.isRetreating) {
        // Đã vào gọn trong Tế Đàn Đỏ -> Đứng yên hồi máu dưỡng sức
        const isInsideShrine = botShrine && (
            bot.x >= botShrine.x + 15 &&
            bot.x <= botShrine.x + botShrine.width - 15 &&
            bot.y >= botShrine.y + 15 &&
            bot.y <= botShrine.y + botShrine.height - 15
        );

        if (isInsideShrine) {
            botNavPath = null;
            return;
        }

        // TÍNH ĐƯỜNG A* VỀ TẾ ĐÀN (X=1535, Y=450)
        const shrineTargetX = botShrine ? botShrine.x + 35 : 1535;
        const shrineTargetY = 450;

        if (botNavVersion !== navVersion || !botNavPath || botNavPath.length === 0) {
            botNavPath    = astarPath(bot.x, bot.y, shrineTargetX, shrineTargetY, bot.radius);
            botNavVersion = navVersion;
            botWpIdx      = 0;
        }

        botFollowNavPath();
        bot.clampPosition();
        return;
    }

    // --- 3. NÉ TRỤ AN TOÀN ---
    if (bot.isEvadingTurret === undefined) bot.isEvadingTurret = false;

    if (blueTurret && !hasLiningMinion) {
        if (distToTurret < blueTurret.range + 20) {
            bot.isEvadingTurret = true;
        } else if (distToTurret > blueTurret.range + 70) {
            bot.isEvadingTurret = false;
        }
    } else {
        bot.isEvadingTurret = false;
    }

    if (bot.isEvadingTurret && blueTurret) {
        botNavPath = null;
        const stepAngle = Math.atan2(bot.y - blueTurret.y, bot.x - blueTurret.x);
        bot.x += Math.cos(stepAngle) * bot.speed * 1.1;
        bot.y += Math.sin(stepAngle) * bot.speed * 1.1;
        bot.clampPosition();
        return;
    }

    // --- 4. TẤN CÔNG MỤC TIÊU & CƠ CHẾ KITING / SPACING ---
    let enemyTargets = [...minions.filter(m => m.team === 'blue'), player].filter(e =>
        e && !e.isDead && e.hp > 0
    );
    enemyTargets.sort((a, b) => Math.hypot(a.x - bot.x, a.y - bot.y) - Math.hypot(b.x - bot.x, b.y - bot.y));
    const closestTarget = enemyTargets[0];
    const targetDist    = closestTarget ? Math.hypot(closestTarget.x - bot.x, closestTarget.y - bot.y) : Infinity;

    // Ưu tiên 1: Đánh mục tiêu gần nhất trong tầm & Spacing
    if (closestTarget && targetDist <= bot.atkRange) {
        botNavPath = null;

        // Bắn đòn đánh thường
        if (bot.atkCd <= 0) {
            projectiles.push(new Projectile(bot.x, bot.y, closestTarget, bot.atkDmg, 10, bot.color, 'normal', bot));
            bot.atkCd = bot.maxAtkCd;
        }

        // Skill 1
        if (bot.skill1Cd <= 0 && player && !player.isDead && distToPlayer <= bot.atkRange * 1.4) {
            projectiles.push(new Projectile(bot.x, bot.y, player, bot.atkDmg * 1.8, 11, '#ff3366', 'skill', bot));
            bot.skill1Cd = bot.maxSkill1Cd;
            playSound('skill');
        }

        // --- CƠ CHẾ SPACING & KITING THẢ DIỀU KHI HỒI CHIÊU ---
        const idealDist = bot.atkRange * 0.85; // Tầm đẹp ~185px
        const angle     = Math.atan2(bot.y - closestTarget.y, bot.x - closestTarget.x);

        if (targetDist < idealDist - 25) {
            // Địch đến quá gần -> Lùi lại thả diều (Kiting)
            bot.x += Math.cos(angle) * bot.speed * 0.55;
            bot.y += Math.sin(angle) * bot.speed * 0.55;
        } else if (targetDist > idealDist + 20) {
            // Địch di chuyển ra xa -> Nhích lại gần duy trì khoảng cách
            bot.x -= Math.cos(angle) * bot.speed * 0.4;
            bot.y -= Math.sin(angle) * bot.speed * 0.4;
        } else {
            // Trong khoảng đẹp -> Nhấp nhổm viền giữ nhịp (Strafing)
            const strafeDir = Math.sin(Date.now() * 0.006) > 0 ? 1 : -1;
            bot.x += -Math.sin(angle) * strafeDir * 0.7;
            bot.y +=  Math.cos(angle) * strafeDir * 0.7;
        }

        bot.clampPosition();
        return;
    }

    // Ưu tiên 2: Đánh Trụ Xanh khi có lính tank
    if (blueTurret && distToTurret <= bot.atkRange && hasLiningMinion) {
        botNavPath = null;
        if (bot.atkCd <= 0) {
            projectiles.push(new Projectile(bot.x, bot.y, blueTurret, bot.atkDmg, 10, bot.color, 'normal', bot));
            bot.atkCd = bot.maxAtkCd;
        }
        return;
    }

    // --- 5. DI CHUYỂN BẰNG A* TỚI MỤC TIÊU HOẶC ĐẨY LANE ---
    let targetX = closestTarget ? closestTarget.x : (blueTurret ? blueTurret.x : 200);
    let targetY = closestTarget ? closestTarget.y : 450;

    const tgtKey = `${Math.floor(targetX / 50)},${Math.floor(targetY / 50)}`;
    if (botNavVersion !== navVersion || !botNavPath || botNavPath.length === 0 || botLastTgtKey !== tgtKey) {
        botNavPath    = astarPath(bot.x, bot.y, targetX, targetY, bot.radius);
        botNavVersion = navVersion;
        botWpIdx      = 0;
        botLastTgtKey = tgtKey;
    }

    botFollowNavPath();
    bot.clampPosition();
}

/**
 * Hỗ trợ Bot di chuyển theo mảng Waypoint A* mượt mà
 */
function botFollowNavPath() {
    if (botNavPath && botWpIdx < botNavPath.length) {
        const wp   = botNavPath[botWpIdx];
        let wdx  = wp.x - bot.x;
        let wdy  = wp.y - bot.y;
        let wLen = Math.hypot(wdx, wdy);

        // Bo góc mượt khi tiệm cận waypoint
        if (wLen < 30 && botWpIdx + 1 < botNavPath.length) {
            const nextWp  = botNavPath[botWpIdx + 1];
            const nextDx  = nextWp.x - bot.x;
            const nextDy  = nextWp.y - bot.y;
            const nextLen = Math.hypot(nextDx, nextDy);
            if (nextLen > 0) {
                const blend = (30 - wLen) / 30;
                wdx = (wdx / wLen) * (1 - blend) + (nextDx / nextLen) * blend;
                wdy = (wdy / wLen) * (1 - blend) + (nextDy / nextLen) * blend;
                wLen = Math.hypot(wdx, wdy);
            }
        }

        if (wLen < bot.speed + 3) {
            botWpIdx++;
        } else {
            bot.x += (wdx / wLen) * bot.speed;
            bot.y += (wdy / wLen) * bot.speed;
        }
    } else {
        botNavPath = null;
    }
}
