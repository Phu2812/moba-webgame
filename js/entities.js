// =============================================
// FLOATING TEXT
// =============================================
class FloatingText {
    constructor(x, y, text, color = '#ffcc00') {
        this.x     = x;
        this.y     = y;
        this.text  = text;
        this.color = color;
        this.alpha = 1.0;
    }
    update(dt) {
        this.y    -= 25 * dt;
        this.alpha -= 0.7 * dt;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.alpha);
        ctx.fillStyle   = this.color;
        ctx.font        = 'bold 16px sans-serif';
        ctx.textAlign   = 'center';
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

// =============================================
// PARTICLE
// =============================================
class Particle {
    constructor(x, y, color) {
        this.x      = x;
        this.y      = y;
        this.color  = color;
        this.radius = Math.random() * 3 + 2;
        this.vx     = (Math.random() - 0.5) * 6;
        this.vy     = (Math.random() - 0.5) * 6;
        this.alpha  = 1;
    }
    update() {
        this.x     += this.vx;
        this.y     += this.vy;
        this.alpha -= 0.04;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.alpha);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }
}

function createParticles(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

// =============================================
// PROJECTILE
// =============================================
class Projectile {
    constructor(x, y, target, damage, speed, color, type = 'normal', owner = null) {
        this.x      = x;
        this.y      = y;
        this.target = target;
        this.damage = damage;
        this.speed  = speed;
        this.color  = color;
        this.type   = type;
        this.owner  = owner;
        this.team   = owner ? owner.team : 'neutral';
        this.radius = type === 'skill' ? 14 : 7;
        this.active = true;
        this.life   = 2.5;

        const spawnOffset = owner ? owner.radius + 12 : 0;

        if (type === 'skill') {
            const angle = Math.atan2(target.y - y, target.x - x);
            this.x  += Math.cos(angle) * spawnOffset;
            this.y  += Math.sin(angle) * spawnOffset;
            this.vx  = Math.cos(angle) * speed;
            this.vy  = Math.sin(angle) * speed;
        } else if (target && target.x !== undefined && target.y !== undefined) {
            const angle = Math.atan2(target.y - y, target.x - x);
            this.x += Math.cos(angle) * spawnOffset;
            this.y += Math.sin(angle) * spawnOffset;
        }
    }

    update(dt) {
        if (!this.active) return;

        this.life -= dt;
        if (this.life <= 0 || this.x < -100 || this.x > GAME_WIDTH + 100 || this.y < -100 || this.y > GAME_HEIGHT + 100) {
            this.active = false;
            return;
        }

        if (this.type === 'skill') {
            this.x += this.vx;
            this.y += this.vy;

            const enemies = [...minions, player, bot, ...turrets, ...nexuses].filter(e =>
                e && !e.isDead && e.hp > 0 && e.team !== this.team && e !== this.owner
            );
            for (let e of enemies) {
                if (Math.hypot(e.x - this.x, e.y - this.y) < e.radius + this.radius) {
                    if (typeof e.takeDamage === 'function') {
                        e.takeDamage(this.damage, this.owner);
                    } else {
                        e.hp -= this.damage;
                    }
                    createParticles(this.x, this.y, this.color, 12);
                    this.active = false;
                    break;
                }
            }
        } else {
            if (!this.target || (this.target.hp !== undefined && this.target.hp <= 0) || this.target.isDead) {
                this.active = false;
                return;
            }

            const dist  = Math.hypot(this.target.x - this.x, this.target.y - this.y);
            const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);

            if (dist <= this.speed || dist < 15) {
                if (typeof this.target.takeDamage === 'function') {
                    this.target.takeDamage(this.damage, this.owner);
                } else {
                    this.target.hp -= this.damage;
                }
                createParticles(this.x, this.y, this.color, 5);
                this.active = false;
            } else {
                this.x += Math.cos(angle) * this.speed;
                this.y += Math.sin(angle) * this.speed;
            }
        }
    }

    draw() {
        if (!this.active) return;
        ctx.save();
        ctx.shadowColor = this.color;
        ctx.shadowBlur  = 10;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }
}

// =============================================
// HERO
// =============================================
class Hero {
    constructor(x, y, team, name, color) {
        this.x    = x;
        this.y    = y;
        this.radius = 28;
        this.team = team;
        this.name = name;
        this.color = color;

        this.speed    = 5;
        this.maxHp    = 1000;
        this.hp       = 1000;
        this.hpRegen  = 6;
        this.atkDmg   = 65;
        this.atkRange = 220;
        this.atkCd    = 0;
        this.maxAtkCd = 0.8;
        this.skill1Cd    = 0;
        this.maxSkill1Cd = 4.5;

        this.gold  = 300;
        this.items = []; // Tối đa MAX_ITEMS (3 món)

        this.kills   = 0;
        this.deaths  = 0;
        this.assists = 0;

        this.respawnTimer = 0;
        this.isDead       = false;
    }

    update(dt) {
        if (this.isDead) {
            this.respawnTimer -= dt;
            if (this.respawnTimer <= 0) {
                this.isDead = false;
                this.hp     = this.maxHp;
                this.x      = this.team === 'blue' ? 150 : 1450;
                this.y      = 450;
            }
            return;
        }

        // Tăng 8 Vàng / giây
        this.gold += 8 * dt;

        if (this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.hpRegen * dt);
        if (this.atkCd    > 0) this.atkCd    -= dt;
        if (this.skill1Cd > 0) this.skill1Cd -= dt;

        this.clampPosition();
    }

    clampPosition() {
        this.x = Math.max(this.radius, Math.min(GAME_WIDTH  - this.radius, this.x));
        this.y = Math.max(LANE_TOP + this.radius, Math.min(LANE_BOTTOM - this.radius, this.y));
    }

    buyItem(item) {
        if (this.gold >= item.price && this.items.length < MAX_ITEMS) {
            this.gold -= item.price;
            this.items.push(item);
            if (item.stats.atkDmg)      this.atkDmg  += item.stats.atkDmg;
            if (item.stats.maxHp)       { this.maxHp += item.stats.maxHp; this.hp += item.stats.maxHp; }
            if (item.stats.speed)       this.speed    += item.stats.speed;
            if (item.stats.hpRegen)     this.hpRegen  += item.stats.hpRegen;
            if (item.stats.atkCdReduce) this.maxAtkCd  = Math.max(0.3, this.maxAtkCd - item.stats.atkCdReduce);
            return true;
        }
        return false;
    }

    // Bán trang bị (hoàn trả 60% giá và xóa bỏ chỉ số)
    sellItem(index) {
        if (index < 0 || index >= this.items.length) return false;
        const item   = this.items[index];
        const refund = Math.floor(item.price * SELL_RATIO);
        this.gold   += refund;
        this.items.splice(index, 1);
        // Tính lại chỉ số từ đầu để tránh sai số dồn
        this.atkDmg   = 65;
        this.maxHp    = 1000;
        this.speed    = 5;
        this.hpRegen  = 6;
        this.maxAtkCd = 0.8;
        for (const i of this.items) {
            if (i.stats.atkDmg)      this.atkDmg  += i.stats.atkDmg;
            if (i.stats.maxHp)       this.maxHp   += i.stats.maxHp;
            if (i.stats.speed)       this.speed    += i.stats.speed;
            if (i.stats.hpRegen)     this.hpRegen  += i.stats.hpRegen;
            if (i.stats.atkCdReduce) this.maxAtkCd  = Math.max(0.3, this.maxAtkCd - i.stats.atkCdReduce);
        }
        this.hp = Math.min(this.hp, this.maxHp);
        return refund;
    }

    draw() {
        if (this.isDead) return;

        ctx.save();
        ctx.shadowColor = this.color;
        ctx.shadowBlur  = 15;

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle   = this.color;
        ctx.fill();
        ctx.lineWidth   = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.restore();
        this.drawHealthBar();
    }

    drawHealthBar() {
        const barW = 60, barH = 8;
        const bx   = this.x - barW / 2;
        const by   = this.y - this.radius - 18;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);

        const pct = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = this.team === 'blue' ? '#00d9ff' : '#ff3366';
        ctx.fillRect(bx, by, barW * pct, barH);

        ctx.fillStyle  = '#ffffff';
        ctx.font       = '11px sans-serif';
        ctx.textAlign  = 'center';
        ctx.fillText(this.name, this.x, by - 4);
    }

    takeDamage(amount, attacker) {
        if (this.isDead) return;
        this.hp -= amount;
        createParticles(this.x, this.y, this.color, 6);
        playSound('hit');

        if (this.hp <= 0) {
            this.hp           = 0;
            this.isDead       = true;
            this.deaths++;
            this.respawnTimer = 6;

            let killer = attacker ? (attacker instanceof Hero ? attacker : attacker.owner) : null;
            if (killer && killer.kills !== undefined) {
                killer.kills++;
                killer.gold += 250;
                floatingTexts.push(new FloatingText(this.x, this.y, '+250g HẠ GỤC!', '#ffcc00'));
            }
        }
    }
}

// =============================================
// TURRET
// =============================================
class Turret {
    constructor(x, y, team) {
        this.x        = x;
        this.y        = y;
        this.radius   = 35;
        this.team     = team;
        this.maxHp    = 2500;
        this.hp       = 2500;
        this.range    = 280;
        this.atkDmg   = 130;
        this.atkCd    = 0;
        this.maxAtkCd = 1.0;
        this.color    = team === 'blue' ? '#00d9ff' : '#ff3366';
    }

    update(dt) {
        if (this.hp <= 0) return;
        if (this.atkCd > 0) this.atkCd -= dt;

        if (this.atkCd <= 0) {
            let targets = [...minions, player, bot].filter(e =>
                e && !e.isDead && e.hp > 0 && e.team !== this.team && Math.hypot(e.x - this.x, e.y - this.y) <= this.range
            );

            targets.sort((a, b) => {
                const isMinionA = a instanceof Minion ? 0 : 1;
                const isMinionB = b instanceof Minion ? 0 : 1;
                if (isMinionA !== isMinionB) return isMinionA - isMinionB;
                return Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y);
            });

            if (targets.length > 0) {
                const target = targets[0];
                projectiles.push(new Projectile(this.x, this.y, target, this.atkDmg, 12, this.color, 'turret', this));
                this.atkCd = this.maxAtkCd;
            }
        }
    }

    takeDamage(amount, attacker) {
        if (this.hp <= 0) return;
        this.hp -= amount;
        if (this.hp <= 0) {
            let killer       = attacker ? (attacker instanceof Hero ? attacker : attacker.owner) : null;
            let rewardedHero = killer || (this.team === 'red' ? player : bot);
            if (rewardedHero) {
                rewardedHero.gold += 350;
                floatingTexts.push(new FloatingText(this.x, this.y, '+350g PHÁ TRỤ!', '#ffcc00'));
            }
        }
    }

    draw() {
        if (this.hp <= 0) return;
        ctx.save();
        ctx.shadowColor = this.color;
        ctx.shadowBlur  = 10;

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle   = '#1a202c';
        ctx.fill();
        ctx.lineWidth   = 5;
        ctx.strokeStyle = this.color;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(this.x, this.y, 12, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();

        ctx.restore();

        const barW = 70, barH = 8;
        ctx.fillStyle = '#000';
        ctx.fillRect(this.x - barW / 2, this.y - this.radius - 15, barW, barH);
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - barW / 2, this.y - this.radius - 15, barW * (Math.max(0, this.hp) / this.maxHp), barH);
    }
}

// =============================================
// NEXUS
// =============================================
class Nexus {
    constructor(x, y, team) {
        this.x      = x;
        this.y      = y;
        this.radius = 50;
        this.team   = team;
        this.maxHp  = 4000;
        this.hp     = 4000;
        this.color  = team === 'blue' ? '#00d9ff' : '#ff3366';
    }

    draw() {
        ctx.save();
        ctx.shadowColor = this.color;
        ctx.shadowBlur  = 20;

        ctx.beginPath();
        ctx.rect(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
        ctx.fillStyle   = '#0d1117';
        ctx.fill();
        ctx.lineWidth   = 4;
        ctx.strokeStyle = this.color;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(this.x, this.y, 20, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();

        ctx.restore();

        const barW = 90, barH = 10;
        ctx.fillStyle = '#000';
        ctx.fillRect(this.x - barW / 2, this.y - this.radius - 18, barW, barH);
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - barW / 2, this.y - this.radius - 18, barW * (Math.max(0, this.hp) / this.maxHp), barH);
    }
}

// =============================================
// MINION
// =============================================
class Minion {
    constructor(x, y, team) {
        this.x      = x;
        this.y      = y;
        this.team   = team;
        this.radius = 14;
        this.hp     = 350;
        this.maxHp  = 350;
        this.speed  = 2.2;
        this.atkDmg = 25;
        this.range  = 80;
        this.atkCd  = 0;
        this.color  = team === 'blue' ? '#48bb78' : '#ed8936';
    }

    update(dt) {
        if (this.hp <= 0) return;
        if (this.atkCd > 0) this.atkCd -= dt;

        let targets = [...minions, player, bot, ...turrets, ...nexuses].filter(e =>
            e && !e.isDead && e.hp > 0 && e.team !== this.team
        );

        targets.sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y));

        if (targets.length > 0 && Math.hypot(targets[0].x - this.x, targets[0].y - this.y) <= this.range) {
            if (this.atkCd <= 0) {
                targets[0].takeDamage ? targets[0].takeDamage(this.atkDmg, this) : (targets[0].hp -= this.atkDmg);
                this.atkCd = 1.2;
                createParticles(targets[0].x, targets[0].y, '#fff', 3);
            }
        } else {
            const targetX = this.team === 'blue' ? GAME_WIDTH - 100 : 100;
            const angle   = Math.atan2(450 - this.y, targetX - this.x);
            this.x += Math.cos(angle) * this.speed;
            this.y += Math.sin(angle) * this.speed;
            this.y  = Math.max(LANE_TOP + this.radius, Math.min(LANE_BOTTOM - this.radius, this.y));
        }
    }

    draw() {
        if (this.hp <= 0) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();

        ctx.fillStyle = '#000';
        ctx.fillRect(this.x - 12, this.y - 20, 24, 4);
        ctx.fillStyle = '#48bb78';
        ctx.fillRect(this.x - 12, this.y - 20, 24 * (Math.max(0, this.hp) / this.maxHp), 4);
    }

    takeDamage(amount, attacker) {
        this.hp -= amount;
        if (this.hp <= 0) {
            let killer = attacker ? (attacker instanceof Hero ? attacker : attacker.owner) : null;
            if (killer) {
                killer.gold += 55;
                if (killer === player) player.assists++;
                floatingTexts.push(new FloatingText(this.x, this.y, '+55g', '#ffcc00'));
            }
        }
    }
}

// =============================================
// TẾ ĐÀN (Khu vực hồi máu tại căn cứ)
// =============================================
class Shrine {
    constructor(x, y, team) {
        this.x      = x;
        this.y      = y;
        this.radius = 48;
        this.team   = team;
        this.color  = team === 'blue' ? '#00d9ff' : '#ff3366';
        this.pulseT = 0;
    }

    update(dt) {
        this.pulseT += dt;
        const heroes = [player, bot];
        for (const h of heroes) {
            if (h.team === this.team && !h.isDead && Math.hypot(h.x - this.x, h.y - this.y) <= this.radius) {
                if (h.hp < h.maxHp) {
                    h.hp = Math.min(h.maxHp, h.hp + SHRINE_HEAL_RATE * dt);
                }
            }
        }
    }

    draw() {
        const pulse = 0.12 + 0.06 * Math.sin(this.pulseT * 2.5);
        const ring  = 0.55 + 0.2  * Math.sin(this.pulseT * 2.5);

        // Nền sáng nhấp nháy
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.shadowColor = this.color;
        ctx.shadowBlur  = 30;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();

        // Viền ngoài
        ctx.save();
        ctx.globalAlpha  = ring;
        ctx.shadowColor  = this.color;
        ctx.shadowBlur   = 15;
        ctx.strokeStyle  = this.color;
        ctx.lineWidth    = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Biểu tượng và chự đề
        ctx.save();
        ctx.globalAlpha   = 0.9;
        ctx.font          = '20px sans-serif';
        ctx.textAlign     = 'center';
        ctx.textBaseline  = 'middle';
        ctx.fillText('⛩️', this.x, this.y - 8);
        ctx.font          = 'bold 10px sans-serif';
        ctx.fillStyle     = this.color;
        ctx.textBaseline  = 'top';
        ctx.shadowColor   = this.color;
        ctx.shadowBlur    = 6;
        ctx.fillText('TẾ ĐÀN', this.x, this.y + 14);
        ctx.restore();
    }
}
