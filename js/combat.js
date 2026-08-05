// =============================================
// ĐÁNH THƯỜNG (Player)
// =============================================
function triggerAttack() {
    if (player.isDead || player.atkCd > 0) return;

    let target = null;

    // Ưu tiên đánh bot trước
    if (bot && !bot.isDead && bot.hp > 0 && Math.hypot(bot.x - player.x, bot.y - player.y) <= player.atkRange + 60) {
        target = bot;
    } else {
        // Tìm mục tiêu gần nhất trong tầm
        let targets = [...minions, ...turrets, ...nexuses].filter(e =>
            e && !e.isDead && e.hp > 0 && e.team !== 'blue' && Math.hypot(e.x - player.x, e.y - player.y) <= player.atkRange + 60
        );
        if (targets.length > 0) {
            targets.sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y));
            target = targets[0];
        }
    }

    if (target) {
        projectiles.push(new Projectile(player.x, player.y, target, player.atkDmg, 12, '#00d9ff', 'normal', player));
        player.atkCd = player.maxAtkCd;
    }
}

// =============================================
// KỸ NĂNG 1 (Player)
// =============================================
function triggerSkill1() {
    if (player.isDead || player.skill1Cd > 0) return;

    let targetPos = null;

    // Ưu tiên bot
    if (bot && !bot.isDead && bot.hp > 0 && Math.hypot(bot.x - player.x, bot.y - player.y) <= 600) {
        targetPos = { x: bot.x, y: bot.y };
    } else {
        // Tìm lính địch gần nhất
        let enemyMinions = minions.filter(m => m && m.hp > 0 && m.team !== 'blue');
        enemyMinions.sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y));
        if (enemyMinions.length > 0 && Math.hypot(enemyMinions[0].x - player.x, enemyMinions[0].y - player.y) <= 600) {
            targetPos = { x: enemyMinions[0].x, y: enemyMinions[0].y };
        }
    }

    // Fallback: theo hướng chuột hoặc joystick
    if (!targetPos) {
        const distToMouse = Math.hypot(mousePos.x - player.x, mousePos.y - player.y);
        if (distToMouse > 50) {
            targetPos = { x: mousePos.x, y: mousePos.y };
        } else if (joystickDir.x !== 0 || joystickDir.y !== 0) {
            targetPos = { x: player.x + joystickDir.x * 200, y: player.y + joystickDir.y * 200 };
        } else {
            targetPos = { x: player.x + 200, y: player.y };
        }
    }

    projectiles.push(new Projectile(player.x, player.y, targetPos, 220, 15, '#00d9ff', 'skill', player));
    player.skill1Cd = player.maxSkill1Cd;
    playSound('skill');
}
