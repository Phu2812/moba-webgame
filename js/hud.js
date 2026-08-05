// =============================================
// CẬP NHẬT HUD
// =============================================
function updateHUD() {
    document.getElementById('blue-score').innerText     = player.kills;
    document.getElementById('red-score').innerText      = bot.kills;
    document.getElementById('kda-text').innerText       = `${player.kills}/${player.deaths}/${player.assists}`;
    document.getElementById('hud-gold').innerText       = Math.floor(player.gold);
    document.getElementById('hud-gold-shop').innerText  = Math.floor(player.gold);
    document.getElementById('shop-gold-val').innerText  = Math.floor(player.gold);

    const mins = Math.floor(gameTime / 60).toString().padStart(2, '0');
    const secs = Math.floor(gameTime % 60).toString().padStart(2, '0');
    document.getElementById('game-timer').innerText = `${mins}:${secs}`;

    const cdAtkEl = document.getElementById('cd-attack');
    if (player.atkCd > 0) {
        cdAtkEl.style.display = 'flex';
        cdAtkEl.innerText     = player.atkCd.toFixed(1);
    } else {
        cdAtkEl.style.display = 'none';
    }

    const cdSk1El = document.getElementById('cd-skill1');
    if (player.skill1Cd > 0) {
        cdSk1El.style.display = 'flex';
        cdSk1El.innerText     = player.skill1Cd.toFixed(1);
    } else {
        cdSk1El.style.display = 'none';
    }
}

// =============================================
// CỬA HÀNG
// =============================================
function toggleShop() {
    const shopModal = document.getElementById('shop-modal');
    document.getElementById('scoreboard-modal').style.display = 'none';
    if (shopModal.style.display === 'flex') {
        shopModal.style.display = 'none';
    } else {
        renderShop();
        shopModal.style.display = 'flex';
    }
}

function renderShop() {
    const grid   = document.getElementById('shop-grid');
    grid.innerHTML = '';

    const isFull = player.items.length >= MAX_ITEMS;

    SHOP_ITEMS.forEach(item => {
        const canAfford = player.gold >= item.price && !isFull;
        const card      = document.createElement('div');
        card.className  = 'item-card';
        card.innerHTML  = `
            <div>
                <div class="item-name">${item.name}</div>
                <div class="item-desc">${item.desc}</div>
            </div>
            <div class="item-footer">
                <div class="item-price">${item.price}g</div>
                <button class="btn-buy" ${canAfford ? '' : 'disabled'} onclick="buyItemPlayer('${item.id}')">
                    ${isFull ? 'Đầy đồ (3/3)' : 'Mua'}
                </button>
            </div>
        `;
        grid.appendChild(card);
    });

    const slotsContainer   = document.getElementById('inventory-slots');
    slotsContainer.innerHTML = '';
    for (let i = 0; i < MAX_ITEMS; i++) {
        const slot = document.createElement('div');
        if (player.items[i]) {
            slot.className = 'slot-box filled';
            const refund   = Math.floor(player.items[i].price * SELL_RATIO);
            slot.innerHTML = `
                <span style="font-size:10px">${player.items[i].name}</span>
                <button class="btn-sell" onclick="sellItemPlayer(${i})">Bán (+${refund}g)</button>
            `;
        } else {
            slot.className = 'slot-box';
            slot.innerText = `Ô ${i + 1} (Trống)`;
        }
        slotsContainer.appendChild(slot);
    }
}

function buyItemPlayer(itemId) {
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (item && player.buyItem(item)) {
        playSound('skill');
        renderShop();
    }
}

function sellItemPlayer(index) {
    const refund = player.sellItem(index);
    if (refund !== false) {
        playSound('hit');
        floatingTexts.push(new FloatingText(player.x, player.y - 50, `+${refund}g Bán đồ`, '#ffcc00'));
        renderShop();
    }
}

// =============================================
// BẢNG XẾP HẠNG
// =============================================
function toggleScoreboard() {
    const sbModal = document.getElementById('scoreboard-modal');
    document.getElementById('shop-modal').style.display = 'none';
    if (sbModal.style.display === 'flex') {
        sbModal.style.display = 'none';
    } else {
        renderScoreboard();
        sbModal.style.display = 'flex';
    }
}

function renderScoreboard() {
    const tbody    = document.getElementById('scoreboard-body');
    tbody.innerHTML = '';

    [player, bot].forEach(h => {
        const isPlayer = h === player;
        const row      = document.createElement('tr');
        row.className  = isPlayer ? 'team-blue-row' : 'team-red-row';

        let itemBadgesHtml = '';
        for (let i = 0; i < MAX_ITEMS; i++) {
            if (h.items[i]) {
                itemBadgesHtml += `<span class="item-badge-mini">${h.items[i].name}</span>`;
            } else {
                itemBadgesHtml += `<span class="item-badge-mini item-badge-empty">Ô ${i + 1}</span>`;
            }
        }

        row.innerHTML = `
            <td>
                <div class="player-name-cell">
                    <div class="dot-indicator ${isPlayer ? 'dot-blue' : 'dot-red'}"></div>
                    <span style="color: ${h.color}">${h.name}</span>
                </div>
            </td>
            <td style="font-weight: bold; color: #fff;">
                ${h.kills} / ${h.deaths} / ${h.assists}
            </td>
            <td>
                <div class="stats-badges">
                    <span class="stat-item">⚔️ ST: <b>${Math.floor(h.atkDmg)}</b></span>
                    <span class="stat-item">❤️ HP: <b>${Math.floor(h.hp)}/${Math.floor(h.maxHp)}</b></span>
                    <span class="stat-item">👟 Tốc: <b>${h.speed.toFixed(1)}</b></span>
                </div>
            </td>
            <td style="color: #ffcc00; font-weight: bold;">
                💰 ${Math.floor(h.gold)}g
            </td>
            <td>
                <div class="item-list-mini">${itemBadgesHtml}</div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// =============================================
// KẾT THÚC TRẬN
// =============================================
function endGame(isVictory) {
    gameOver = true;
    const screen = document.getElementById('game-over');
    const title  = document.getElementById('game-over-title');
    const stats  = document.getElementById('game-over-stats');

    screen.style.display = 'flex';
    title.className      = `game-over-title ${isVictory ? 'victory' : 'defeat'}`;
    title.innerText      = isVictory ? 'VICTORY' : 'DEFEAT';
    stats.innerText      = `KDA: ${player.kills}/${player.deaths}/${player.assists} | Thời gian: ${document.getElementById('game-timer').innerText}`;
}
