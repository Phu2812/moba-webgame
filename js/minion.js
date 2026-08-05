// =============================================
// QUẢN LÝ LÍNH (MINIONS) — 2 loại: Melee & Ranged
// =============================================

class Minion {
    constructor(x, y, team, type = 'melee') {
        this.x      = x;
        this.y      = y;
        this.team   = team;
        this.type   = type; // 'melee' hoặc 'ranged'
        this.radius = type === 'ranged' ? 12 : 14;

        if (type === 'ranged') {
            this.maxHp    = 280;
            this.hp       = 280;
            this.atkDmg   = 38;
            this.range    = 230; // Tầm bắn xa
            this.speed    = 2.3;
            this.maxAtkCd = 1.2;
        } else {
            this.maxHp    = 420;
            this.hp       = 420;
            this.atkDmg   = 28;
            this.range    = 52;  // Đánh cận chiến
            this.speed    = 2.4;
            this.maxAtkCd = 1.0;
        }

        this.atkCd     = 0;
        this.teamColor = team === 'blue' ? '#00d9ff' : '#ff3366';
        this.isDead    = false;

        // Pathfinding A* state
        this.navPath     = null;
        this.navVersion  = -1;
        this.wpIdx       = 0;
        this.targetLaneY = y;
        this._lastTgtKey = '';
    }

    update(dt) {
        if (this.hp <= 0) return;
        if (this.atkCd > 0) this.atkCd -= dt;

        // --- Tìm mục tiêu kẻ địch gần nhất ---
        let targets = [...minions, player, bot, ...turrets, ...nexuses].filter(e =>
            e && !e.isDead && e.hp > 0 && e.team !== this.team
        );
        targets.sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y));
        const nearest     = targets[0];
        const nearestDist = nearest ? Math.hypot(nearest.x - this.x, nearest.y - this.y) : Infinity;

        if (nearest && nearestDist <= this.range) {
            // --- TRONG TẦM ĐÁNH ---
            if (this.atkCd <= 0) {
                if (this.type === 'ranged') {
                    projectiles.push(new Projectile(this.x, this.y, nearest, this.atkDmg, 7, this.teamColor, 'normal', this));
                } else {
                    nearest.takeDamage ? nearest.takeDamage(this.atkDmg, this) : (nearest.hp -= this.atkDmg);
                    createParticles(nearest.x, nearest.y, this.teamColor, 4);
                }
                this.atkCd = this.maxAtkCd;
            }

            // Lính xa: Spacing nhích lùi nhẹ khi mục tiêu lấn vào quá gần
            if (this.type === 'ranged') {
                const idealRangedDist = 190;
                if (nearestDist < idealRangedDist - 20) {
                    const angle = Math.atan2(this.y - nearest.y, this.x - nearest.x);
                    this.x += Math.cos(angle) * this.speed * 0.35;
                    this.y += Math.sin(angle) * this.speed * 0.35;
                    this.y = Math.max(LANE_TOP + this.radius, Math.min(LANE_BOTTOM - this.radius, this.y));
                    handleBuildingCollisions(this);
                }
                return;
            }
        } else {
            // --- DI CHUYỂN THEO A* VỚI CURVE SMOOTHING ---
            if (this.navVersion !== navVersion || !this.navPath || this.navPath.length === 0) {
                const endX = nearest ? nearest.x : (this.team === 'blue' ? GAME_WIDTH - 60 : 60);
                const endY = nearest ? nearest.y : this.targetLaneY;
                this.navPath    = astarPath(this.x, this.y, endX, endY, this.radius);
                this.navVersion = navVersion;
                this.wpIdx      = 0;
            }

            // Nếu mục tiêu kẻ địch gần di chuyển ô mới, tính lại đường
            if (nearest && (nearest instanceof Minion || nearest instanceof Hero)) {
                const tgtKey = `${Math.floor(nearest.x / 60)},${Math.floor(nearest.y / 60)}`;
                if (this._lastTgtKey !== tgtKey) {
                    this._lastTgtKey = tgtKey;
                    this.navPath    = astarPath(this.x, this.y, nearest.x, nearest.y, this.radius);
                    this.navVersion = navVersion;
                    this.wpIdx      = 0;
                }
            }

            // Tiến đến waypoint hiện tại với bo góc mượt (Curve Smoothing)
            if (this.navPath && this.wpIdx < this.navPath.length) {
                const wp   = this.navPath[this.wpIdx];
                let wdx  = wp.x - this.x;
                let wdy  = wp.y - this.y;
                let wLen = Math.hypot(wdx, wdy);

                // Bo góc mượt khi tiệm cận waypoint (tránh bẻ lái gấp 90 độ)
                if (wLen < 28 && this.wpIdx + 1 < this.navPath.length) {
                    const nextWp = this.navPath[this.wpIdx + 1];
                    const nextDx = nextWp.x - this.x;
                    const nextDy = nextWp.y - this.y;
                    const nextLen = Math.hypot(nextDx, nextDy);
                    if (nextLen > 0) {
                        const blend = (28 - wLen) / 28; // Tỉ lệ hòa trộn hướng
                        wdx = (wdx / wLen) * (1 - blend) + (nextDx / nextLen) * blend;
                        wdy = (wdy / wLen) * (1 - blend) + (nextDy / nextLen) * blend;
                        wLen = Math.hypot(wdx, wdy);
                    }
                }

                if (wLen < this.speed + 2) {
                    this.wpIdx++;
                } else {
                    this.x += (wdx / wLen) * this.speed;
                    this.y += (wdy / wLen) * this.speed;
                }
            } else {
                this.navPath = null;
            }

            this.y = Math.max(LANE_TOP + this.radius, Math.min(LANE_BOTTOM - this.radius, this.y));
            handleBuildingCollisions(this);
        }
    }

    draw() {
        if (this.hp <= 0) return;
        const x = this.x, y = this.y, r = this.radius, c = this.teamColor;

        ctx.save();
        ctx.shadowColor = c;
        ctx.shadowBlur  = 8;

        if (this.type === 'ranged') {
            // Lính xa: Hình thoi phép thuật
            ctx.beginPath();
            ctx.moveTo(x, y - r * 1.3);
            ctx.lineTo(x + r, y);
            ctx.lineTo(x, y + r * 1.3);
            ctx.lineTo(x - r, y);
            ctx.closePath();
            ctx.fillStyle = '#0f172a';
            ctx.fill();
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = c;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fillStyle = c;
            ctx.fill();
        } else {
            // Lính gần: Hình tròn kèm viền giáp bảo vệ
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = '#1e293b';
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = c;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
            ctx.fillStyle = c;
            ctx.fill();
        }

        ctx.restore();

        // Thanh máu
        const bw = this.type === 'melee' ? 28 : 22;
        ctx.fillStyle = '#000';
        ctx.fillRect(x - bw / 2, y - r - 7, bw, 3);
        ctx.fillStyle = c;
        ctx.fillRect(x - bw / 2, y - r - 7, bw * (Math.max(0, this.hp) / this.maxHp), 3);
    }

    takeDamage(amount, attacker) {
        this.hp -= amount;
        if (this.hp <= 0) {
            const gold  = this.type === 'ranged' ? 70 : 50;
            let killer  = attacker ? (attacker instanceof Hero ? attacker : attacker.owner) : null;
            if (killer) {
                killer.gold += gold;
                if (killer === player) player.assists++;
                floatingTexts.push(new FloatingText(this.x, this.y, `+${gold}g`, '#ffcc00'));
            }
        }
    }
}

// =============================================
// SPAWN LÍNH THEO ĐỢT (Mỗi 15 giây)
// Đợt lính: 2 Melee tiên phong, 1 Ranged đi sau cùng
// =============================================
function handleSpawns(timestamp) {
    if (timestamp - lastMinionSpawn > 15000 || lastMinionSpawn === 0) {
        const LANE_Y = 450;
        // Blue nexus right edge = 220 -> spawn x >= 295
        // Red nexus left edge  = 1380 -> spawn x <= 1305

        setTimeout(() => {
            minions.push(new Minion(295,  LANE_Y, 'blue', 'melee'));  // Tiên phong
            minions.push(new Minion(1305, LANE_Y, 'red',  'melee'));
        }, 0);

        setTimeout(() => {
            minions.push(new Minion(268,  LANE_Y, 'blue', 'melee'));  // Giữa
            minions.push(new Minion(1332, LANE_Y, 'red',  'melee'));
        }, 350);

        setTimeout(() => {
            minions.push(new Minion(241,  LANE_Y, 'blue', 'ranged')); // Đi sau cùng
            minions.push(new Minion(1359, LANE_Y, 'red',  'ranged'));
        }, 700);

        lastMinionSpawn = timestamp;
    }
}
