// =============================================
// SPAWN MINION
// =============================================
function handleSpawns(timestamp) {
    if (timestamp - lastMinionSpawn > 15000 || lastMinionSpawn === 0) {
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                minions.push(new Minion(180,  430 + i * 20, 'blue'));
                minions.push(new Minion(1420, 430 + i * 20, 'red'));
            }, i * 600);
        }
        lastMinionSpawn = timestamp;
    }
}

// =============================================
// BOT: MUA ĐỒ THÔNG MINH
// =============================================
function botSmartBuy() {
    if (bot.items.length >= MAX_ITEMS) return;

    const hpRatio  = bot.hp / bot.maxHp;
    const killDiff = bot.kills - player.kills;

    // Lấy danh sách item chưa mua và đủ tiền
    const ownedIds    = new Set(bot.items.map(i => i.id));
    const affordable  = SHOP_ITEMS.filter(i => bot.gold >= i.price && !ownedIds.has(i.id));
    if (affordable.length === 0) return;

    let bestItem  = null;
    let bestScore = -Infinity;

    for (const item of affordable) {
        let score = item.price * 0.001; // Cơ bản: ưu tiên đồ đắt hơn

        // Máu thấp → ưu tiên đồ máu / hồi máu
        if (hpRatio < 0.55) {
            if (item.stats.maxHp)   score += 4;
            if (item.stats.hpRegen) score += 3;
        }
        // Đang thua điểm → ưu tiên sát thương
        if (killDiff < 0) {
            if (item.stats.atkDmg)      score += 3;
            if (item.stats.atkCdReduce) score += 1.5;
        }
        // Đang thắng → ưu tiên tốc độ để dồn ép
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

// =============================================
// BOT AI CHIẾN ĐẤU
// =============================================
function updateBotAI(dt) {
    if (bot.isDead) return;

    // --- Mua đồ ---
    botSmartBuy();

    const distToPlayer    = Math.hypot(player.x - bot.x, player.y - bot.y);
    const blueTurret      = turrets.find(t => t.team === 'blue' && t.hp > 0);
    const distToTurret    = blueTurret ? Math.hypot(blueTurret.x - bot.x, blueTurret.y - bot.y) : 9999;
    const hasLiningMinion = blueTurret
        ? minions.some(m => m.team === 'red' && m.hp > 0 && Math.hypot(blueTurret.x - m.x, blueTurret.y - m.y) <= blueTurret.range)
        : false;

    // Vị trí Tế Đàn của bot (đỏ)
    const botShrine = shrines.find(s => s.team === 'red');

    // --- Rút lui: máu thấp → về Tế Đàn hồi ---
    const hpRatio = bot.hp / bot.maxHp;
    if (hpRatio < 0.3 || (blueTurret && distToTurret < blueTurret.range + 30 && !hasLiningMinion)) {
        const retreatX = botShrine ? botShrine.x : 1450;
        const retreatY = botShrine ? botShrine.y : 450;
        const angle    = Math.atan2(retreatY - bot.y, retreatX - bot.x);
        bot.x += Math.cos(angle) * bot.speed * 1.1;
        bot.y += Math.sin(angle) * bot.speed * 1.1;
        bot.clampPosition();
        return;
    }

    // --- Tấn công player khi đủ gần ---
    if (!player.isDead && distToPlayer < 500) {

        // Dùng skill: chỉ khi hướng về phía player và không bị trụ đe doạ
        if (bot.skill1Cd <= 0 && distToPlayer <= 480) {
            // Dự đoán vị trí player dựa vào joystickDir
            const predictX = player.x + joystickDir.x * 50;
            const predictY = player.y + joystickDir.y * 50;
            projectiles.push(new Projectile(bot.x, bot.y, { x: predictX, y: predictY }, 200, 15, '#ff3366', 'skill', bot));
            bot.skill1Cd = bot.maxSkill1Cd;
            playSound('skill');
        }

        // Đánh thường
        if (bot.atkCd <= 0 && distToPlayer <= bot.atkRange) {
            projectiles.push(new Projectile(bot.x, bot.y, player, bot.atkDmg, 10, '#ff3366', 'normal', bot));
            bot.atkCd = bot.maxAtkCd;
        }

        // Di chuyển chiến thuật: kite – giữ khoảng cách tối ưu
        if (distToPlayer < bot.atkRange * 0.6) {
            // Lùi ra giữ khoảng cách
            const angle = Math.atan2(bot.y - player.y, bot.x - player.x);
            bot.x += Math.cos(angle) * bot.speed;
            bot.y += Math.sin(angle) * bot.speed;
        } else if (distToPlayer > bot.atkRange) {
            // Tiến vào
            const angle = Math.atan2(player.y - bot.y, player.x - bot.x);
            bot.x += Math.cos(angle) * bot.speed;
            bot.y += Math.sin(angle) * bot.speed;
        } else {
            // Trong tầm đánh: di chuyển ngang để tránh đòn
            const perpX = -(player.y - bot.y) / distToPlayer;
            const perpY =  (player.x - bot.x) / distToPlayer;
            const dir   = Math.sin(gameTime * 3) > 0 ? 1 : -1;
            bot.x += perpX * dir * bot.speed * 0.7;
            bot.y += perpY * dir * bot.speed * 0.7;
        }

    } else {
        // --- Đánh lính khi không có player gần ---
        const enemyMinions = minions.filter(m => m.team === 'blue' && m.hp > 0);

        if (enemyMinions.length > 0) {
            // Ưu tiên lính máu thấp nhất (last-hit)
            enemyMinions.sort((a, b) => a.hp - b.hp);
            const target       = enemyMinions[0];
            const distToMinion = Math.hypot(target.x - bot.x, target.y - bot.y);

            if (distToMinion > bot.atkRange) {
                const angle = Math.atan2(target.y - bot.y, target.x - bot.x);
                bot.x += Math.cos(angle) * bot.speed;
                bot.y += Math.sin(angle) * bot.speed;
            } else if (bot.atkCd <= 0) {
                projectiles.push(new Projectile(bot.x, bot.y, target, bot.atkDmg, 10, '#ff3366', 'normal', bot));
                bot.atkCd = bot.maxAtkCd;
            }
        } else {
            // Đẩy lane: tiến về phía trụ xanh khi đã an toàn
            const targetX = blueTurret ? blueTurret.x + 80 : 200;
            const angle   = Math.atan2(450 - bot.y, targetX - bot.x);
            bot.x += Math.cos(angle) * (bot.speed * 0.65);
            bot.y += Math.sin(angle) * (bot.speed * 0.65);
        }
    }

    bot.clampPosition();
}
