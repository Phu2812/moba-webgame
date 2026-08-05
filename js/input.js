// =============================================
// BÀN PHÍM
// =============================================
window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'KeyQ')  triggerSkill1();
    if (e.code === 'Space') triggerAttack();
    if (e.code === 'KeyB')  toggleShop();
    if (e.code === 'Tab') {
        e.preventDefault();
        toggleScoreboard();
    }
});

window.addEventListener('keyup', e => {
    keys[e.code] = false;
});

// =============================================
// CHUỘT
// =============================================
function updateMousePos(e) {
    const rect   = canvas.getBoundingClientRect();
    const scaleX = GAME_WIDTH  / rect.width;
    const scaleY = GAME_HEIGHT / rect.height;
    mousePos.x = (e.clientX - rect.left) * scaleX;
    mousePos.y = (e.clientY - rect.top)  * scaleY;
}

canvas.addEventListener('mousemove', updateMousePos);
canvas.addEventListener('mousedown', (e) => {
    if (
        document.getElementById('shop-modal').style.display       === 'flex' ||
        document.getElementById('scoreboard-modal').style.display === 'flex'
    ) return;
    updateMousePos(e);
    triggerAttack();
});

// =============================================
// JOYSTICK CẢM ỨNG
// =============================================
const joystick     = document.getElementById('joystick');
const joystickKnob = document.getElementById('joystick-knob');

function handleJoystickTouch(e) {
    e.preventDefault();
    const rect    = joystick.getBoundingClientRect();
    const centerX = rect.left + rect.width  / 2;
    const centerY = rect.top  + rect.height / 2;
    const maxRadius = rect.width / 2;

    let activeTouch = null;
    for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        if (joystickTouchId === null) {
            if (Math.hypot(t.clientX - centerX, t.clientY - centerY) <= maxRadius * 2) {
                joystickTouchId = t.identifier;
                activeTouch     = t;
                break;
            }
        } else if (t.identifier === joystickTouchId) {
            activeTouch = t;
            break;
        }
    }

    if (activeTouch) {
        let dx   = activeTouch.clientX - centerX;
        let dy   = activeTouch.clientY - centerY;
        let dist = Math.hypot(dx, dy);

        if (dist > maxRadius) {
            dx = (dx / dist) * maxRadius;
            dy = (dy / dist) * maxRadius;
        }

        joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
        joystickDir.x = dx / maxRadius;
        joystickDir.y = dy / maxRadius;
    }
}

function resetJoystick(e) {
    if (e) e.preventDefault();
    if (joystickTouchId !== null && e && e.changedTouches) {
        let ended = false;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === joystickTouchId) {
                ended = true;
                break;
            }
        }
        if (!ended) return;
    }
    joystickKnob.style.transform = 'translate(0px, 0px)';
    joystickDir      = { x: 0, y: 0 };
    joystickTouchId  = null;
}

joystick.addEventListener('touchstart',  handleJoystickTouch, { passive: false });
joystick.addEventListener('touchmove',   handleJoystickTouch, { passive: false });
joystick.addEventListener('touchend',    resetJoystick,        { passive: false });
joystick.addEventListener('touchcancel', resetJoystick,        { passive: false });

// =============================================
// NÚT HÀNH ĐỘNG CẢM ỨNG
// =============================================
function attachButtonTouchHandler(btnEl, actionFn) {
    btnEl.addEventListener('touchstart', (e) => {
        e.preventDefault();
        btnEl.classList.add('active');
        actionFn();
    }, { passive: false });

    btnEl.addEventListener('touchend', (e) => {
        e.preventDefault();
        btnEl.classList.remove('active');
    }, { passive: false });

    btnEl.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        btnEl.classList.remove('active');
    }, { passive: false });
}

attachButtonTouchHandler(document.getElementById('btn-attack'), triggerAttack);
attachButtonTouchHandler(document.getElementById('btn-skill1'), triggerSkill1);
