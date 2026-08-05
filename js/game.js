// =============================================
// STATE TOÀN CỤC
// =============================================
const keys = {};
let mousePos       = { x: 800, y: 450 };
let joystickDir    = { x: 0, y: 0 };
let joystickTouchId = null;

let gameTime       = 0;
let gameOver       = false;
let lastMinionSpawn = 0;
let lastTime       = 0;

let player, bot;
let turrets      = [];
let nexuses      = [];
let minions      = [];
let projectiles  = [];
let particles    = [];
let floatingTexts = [];
let shrines      = [];

// =============================================
// VẼ MAP
// =============================================
function drawMap() {
    // Nền ngoài lane
    ctx.fillStyle = '#03050a';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Nền lane
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, LANE_TOP, GAME_WIDTH, LANE_BOTTOM - LANE_TOP);

    // Viền lane
    ctx.lineWidth   = 6;
    ctx.strokeStyle = 'rgba(255, 51, 102, 0.4)';
    ctx.beginPath();
    ctx.moveTo(0,          LANE_TOP);
    ctx.lineTo(GAME_WIDTH, LANE_TOP);
    ctx.moveTo(0,          LANE_BOTTOM);
    ctx.lineTo(GAME_WIDTH, LANE_BOTTOM);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth   = 2;
    ctx.strokeRect(0, LANE_TOP + 20, GAME_WIDTH, (LANE_BOTTOM - LANE_TOP) - 40);

    // Đường giữa
    ctx.strokeStyle = 'rgba(0, 217, 255, 0.15)';
    ctx.lineWidth   = 6;
    ctx.beginPath();
    ctx.moveTo(800, LANE_TOP);
    ctx.lineTo(800, LANE_BOTTOM);
    ctx.stroke();
}

// =============================================
// VÒNG LẶP GAME
// =============================================
function gameLoop(timestamp) {
    let dt = (timestamp - lastTime) / 1000;
    if (isNaN(dt) || dt > 0.1) dt = 0.016;
    lastTime = timestamp;

    if (!gameOver) {
        gameTime += dt;
        handleSpawns(timestamp);

        // Di chuyển player
        if (!player.isDead) {
            let dx = joystickDir.x;
            let dy = joystickDir.y;

            if (keys['KeyW'] || keys['ArrowUp'])    dy -= 1;
            if (keys['KeyS'] || keys['ArrowDown'])  dy += 1;
            if (keys['KeyA'] || keys['ArrowLeft'])  dx -= 1;
            if (keys['KeyD'] || keys['ArrowRight']) dx += 1;

            if (dx !== 0 || dy !== 0) {
                const len = Math.hypot(dx, dy);
                if (len > 1) { dx /= len; dy /= len; }
                player.x += dx * player.speed;
                player.y += dy * player.speed;
            }
        }

        // Update entities
        player.update(dt);
        bot.update(dt);
        updateBotAI(dt);

        shrines.forEach(s  => s.update(dt));
        turrets.forEach(t  => t.update(dt));
        minions.forEach(m  => m.update(dt));
        projectiles.forEach(p  => p.update(dt));
        particles.forEach(p  => p.update());
        floatingTexts.forEach(ft => ft.update(dt));

        // Va chạm giữa các đơn vị (không cho đi đè lên nhau)
        handleUnitCollisions();

        // Dọn dẹp đối tượng chết/hết hiệu lực
        minions       = minions.filter(m  => m.hp > 0);
        projectiles   = projectiles.filter(p  => p.active);
        particles     = particles.filter(p  => p.alpha > 0);
        floatingTexts = floatingTexts.filter(ft => ft.alpha > 0);

        // Kiểm tra thắng thua
        if (nexuses[1].hp <= 0) endGame(true);
        else if (nexuses[0].hp <= 0) endGame(false);

        updateHUD();
    }

    // Render
    drawMap();
    shrines.forEach(s  => s.draw());   // Vẽ trước entity để hiện nẻn
    nexuses.forEach(n  => n.draw());
    turrets.forEach(t  => t.draw());
    minions.forEach(m  => m.draw());
    player.draw();
    bot.draw();
    projectiles.forEach(p  => p.draw());
    particles.forEach(p  => p.draw());
    floatingTexts.forEach(ft => ft.draw());

    requestAnimationFrame(gameLoop);
}

// =============================================
// KHỞI TẠO GAME
// =============================================
function initGame() {
    gameOver        = false;
    gameTime        = 0;
    lastMinionSpawn = 0;

    player = new Hero(65,   450, 'blue', 'Valhein (Bạn)', '#00d9ff');
    bot    = new Hero(1535, 450, 'red',  'Yorn (Bot)',     '#ff3366');

    turrets = [
        new Turret(480,  450, 'blue'),
        new Turret(1120, 450, 'red')
    ];

    nexuses = [
        new Nexus(180,  450, 'blue'),
        new Nexus(1420, 450, 'red')
    ];

    minions       = [];
    projectiles   = [];
    particles     = [];
    floatingTexts = [];

    // Tế Đàn: Hình chữ nhật nằm phía sau Nhà Chính của mỗi đội
    shrines = [
        new Shrine(15,   340, 95, 220, 'blue'),
        new Shrine(1490, 340, 95, 220, 'red')
    ];

    document.getElementById('game-over').style.display         = 'none';
    document.getElementById('shop-modal').style.display        = 'none';
    document.getElementById('scoreboard-modal').style.display  = 'none';
}

function resetGame() {
    initGame();
}

// =============================================
// KHỞI ĐỘNG
// =============================================
initGame();
requestAnimationFrame(gameLoop);
