// =============================================
// A* PATHFINDING SYSTEM — Map-agnostic, đọc obstacles động
// navVersion tăng khi công trình bị phá → các đơn vị tự tính lại đường
// =============================================
let navVersion = 0; // Tăng khi có công trình bị phá

const NAV_CELL = 24; // Kích thước ô lưới navigation (px)

/**
 * Thuật toán A* tìm đường ngắn nhất vòng qua các công trình
 */
function astarPath(sx, sy, ex, ey, unitRadius) {
    const C    = NAV_CELL;
    const cols = Math.ceil(GAME_WIDTH / C);
    const rows = Math.ceil((LANE_BOTTOM - LANE_TOP) / C);
    const N    = cols * rows;

    const wc = (wx) => Math.max(0, Math.min(cols - 1, Math.floor(wx / C)));
    const wr = (wy) => Math.max(0, Math.min(rows - 1, Math.floor((wy - LANE_TOP) / C)));
    const cw = (c)  => c * C + C / 2;
    const rw = (r)  => LANE_TOP + r * C + C / 2;
    const id = (c, r) => r * cols + c;

    // --- Lấy tất cả công trình còn sống để làm vật cản ---
    const obs = [...(turrets || []), ...(nexuses || [])].filter(b => b && b.hp > 0);
    const blocked = new Uint8Array(N);

    // Padding rộng rãi để đơn vị né tròn trịa từ xa (tránh góc vuông zigzag)
    const pad = unitRadius + 26;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const wx = cw(c), wy = rw(r);
            for (const b of obs) {
                const sr = (b instanceof Nexus ? b.radius * 1.25 : b.radius) + pad;
                if (Math.hypot(wx - b.x, wy - b.y) < sr) {
                    blocked[id(c, r)] = 1;
                    break;
                }
            }
        }
    }

    const sc = wc(sx), sr2 = wr(sy);
    const ec = wc(ex), er  = wr(ey);
    const sk = id(sc, sr2), ek = id(ec, er);
    if (sk === ek) return [{ x: ex, y: ey }];

    // --- A* ---
    const g    = new Float32Array(N).fill(1e9);
    const prev = new Int32Array(N).fill(-1);
    const open = new Uint8Array(N);
    const done = new Uint8Array(N);
    g[sk] = 0;
    open[sk] = 1;

    const heap = [sk];
    const hf   = new Float32Array(N);
    hf[sk]     = Math.hypot(ec - sc, er - sr2);

    const pop = () => {
        let bi = 0;
        for (let i = 1; i < heap.length; i++) if (hf[heap[i]] < hf[heap[bi]]) bi = i;
        const v = heap[bi];
        heap.splice(bi, 1);
        return v;
    };

    const DIRS = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];

    while (heap.length) {
        const cur = pop();
        if (cur === ek) break;
        if (done[cur]) continue;
        done[cur] = 1;
        const cr = Math.floor(cur / cols), cc = cur % cols;

        for (const [dc, dr, cost] of DIRS) {
            const nc = cc + dc, nr = cr + dr;
            if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
            const nk = id(nc, nr);
            if (done[nk] || blocked[nk]) continue;
            const ng = g[cur] + cost;
            if (ng < g[nk]) {
                g[nk] = ng;
                prev[nk] = cur;
                hf[nk] = ng + Math.hypot(ec - nc, er - nr);
                if (!open[nk]) { open[nk] = 1; heap.push(nk); }
            }
        }
    }

    if (prev[ek] === -1 && sk !== ek) return [{ x: ex, y: ey }];

    // --- Tái tạo đường thô ---
    const raw = [];
    let cur = ek;
    while (cur !== -1) {
        raw.unshift({ x: cw(cur % cols), y: rw(Math.floor(cur / cols)) });
        cur = prev[cur];
    }
    raw[raw.length - 1] = { x: ex, y: ey };

    // --- String-pulling (Làm mượt đường): Bỏ các waypoint thừa nếu có Line of Sight ---
    const smooth = [raw[0]];
    let from = 0;
    while (from < raw.length - 1) {
        let far = from + 1;
        for (let to = raw.length - 1; to > from + 1; to--) {
            if (losCheck(raw[from], raw[to], obs, unitRadius)) {
                far = to;
                break;
            }
        }
        smooth.push(raw[far]);
        from = far;
    }
    return smooth.slice(1);
}

/**
 * Kiểm tra Line of Sight: Đoạn thẳng a -> b có bị cản bởi công trình nào không
 */
function losCheck(a, b, obs, unitRadius) {
    for (const ob of obs) {
        const safeR = (ob instanceof Nexus ? ob.radius * 1.3 : ob.radius) + unitRadius + 24;
        const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
        if (l2 === 0) continue;
        let t = ((ob.x - a.x) * (b.x - a.x) + (ob.y - a.y) * (b.y - a.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        const projX = a.x + t * (b.x - a.x);
        const projY = a.y + t * (b.y - a.y);
        const dist  = Math.hypot(ob.x - projX, ob.y - projY);
        if (dist < safeR) return false;
    }
    return true;
}

/**
 * Hàm hỗ trợ né vật cản phản xạ (dành cho Bot né nhanh góc hẹp)
 */
function getAvoidanceVector(unit, targetX, targetY) {
    let dx = targetX - unit.x, dy = targetY - unit.y;
    let dist = Math.hypot(dx, dy);
    if (dist < 0.5) return { x: 0, y: 0 };
    let dirX = dx / dist, dirY = dy / dist;

    const obs = [...(turrets || []), ...(nexuses || [])].filter(b => b && b.hp > 0);
    let blocking = null, closestProj = Infinity;

    for (const b of obs) {
        const safeR = (b instanceof Nexus ? b.radius * 1.3 : b.radius) + unit.radius + 16;
        const vx = b.x - unit.x, vy = b.y - unit.y;
        const proj = vx * dirX + vy * dirY;

        if (proj > -safeR && proj < dist + safeR) {
            const perp = Math.abs(vx * (-dirY) + vy * dirX);
            if (perp < safeR && proj < closestProj) {
                closestProj = proj;
                blocking = { b, safeR };
            }
        }
    }

    if (!blocking) return { x: dirX, y: dirY };
    const { b, safeR } = blocking;

    if (Math.abs(unit.y - b.y) >= safeR - 4) return { x: dirX, y: dirY };

    const laneMinY = LANE_TOP + unit.radius + 6;
    const laneMaxY = LANE_BOTTOM - unit.radius - 6;
    const topY = Math.max(laneMinY, b.y - safeR);
    const botY = Math.min(laneMaxY, b.y + safeR);

    const waypointX = targetX > unit.x ? Math.min(b.x, targetX) : Math.max(b.x, targetX);
    const dTop = Math.hypot(waypointX - unit.x, topY - unit.y) + Math.hypot(targetX - waypointX, targetY - topY);
    const dBot = Math.hypot(waypointX - unit.x, botY - unit.y) + Math.hypot(targetX - waypointX, targetY - botY);
    const chosenY = Math.abs(dTop - dBot) < 10 ? (unit.y <= b.y ? topY : botY) : (dTop < dBot ? topY : botY);

    let wdx = waypointX - unit.x, wdy = chosenY - unit.y;
    const wl = Math.hypot(wdx, wdy);
    if (wl < 2) return { x: dirX, y: 0 };
    return { x: wdx / wl, y: wdy / wl };
}
