var canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const gravity = 0.8;
const friction = 0.9;
var character;
var platforms;
var doorTriggers;
var boxes;

const keys = {
    a: false,
    d: false,
    w: false
};

class Character {
    constructor(x, y, width, height, color) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.velocityX = 0;
        this.velocityY = 0;
        this.accelerationY = gravity;
        this.onGround = false;
        this.scale = 1;
        this.speed = 5;
        this.jumpPower = 15;
    }

    setScale(newScale) {
        const centerX = this.x + this.width / 2;
        const bottomY = this.y + this.height;
        
        this.width *= newScale / this.scale;
        this.height *= newScale / this.scale;
        
        this.x = centerX - this.width / 2;
        this.y = bottomY - this.height;
        
        this.scale = newScale;
        this.speed *= Math.sqrt(newScale / this.scale);
        this.jumpPower *= Math.sqrt(newScale / this.scale);
    }

    update(platforms, boxes) {
        this.velocityX *= friction;
        this.velocityY += this.accelerationY;

        this.x += this.velocityX;
        this.y += this.velocityY;

        this.resolveCollisions(platforms.concat(boxes));

        if (this.x < 0) this.x = 0;
        if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;

        this.onGround = this.checkOnGround(platforms.concat(boxes));
    }

    resolveCollisions(objects) {
        for (let object of objects) {
            const overlap = this.getOverlap(object);
            if (overlap.width > 0 && overlap.height > 0) {
                if (overlap.width < overlap.height) {
                    // Resolve horizontal collision
                    if (this.x < object.x) {
                        this.x -= overlap.width;
                    } else {
                        this.x += overlap.width;
                    }
                    this.velocityX = 0;
                } else {
                    // Resolve vertical collision
                    if (this.y < object.y) {
                        this.y -= overlap.height;
                        this.onGround = true;
                    } else {
                        this.y += overlap.height;
                    }
                    this.velocityY = 0;
                }

                if (object.canBePushed) {
                    // Push the object
                    if (overlap.width < overlap.height) {
                        object.velocityX += (this.x < object.x) ? overlap.width : -overlap.width;
                    } else {
                        object.velocityY += (this.y < object.y) ? overlap.height : -overlap.height;
                    }
                }
            }
        }
    }

    getOverlap(object) {
        const overlapX = Math.min(this.x + this.width, object.x + object.width) - Math.max(this.x, object.x);
        const overlapY = Math.min(this.y + this.height, object.y + object.height) - Math.max(this.y, object.y);
        return { width: Math.max(0, overlapX), height: Math.max(0, overlapY) };
    }

    checkOnGround(objects) {
        const feetY = this.y + this.height + 1;
        return objects.some(object => 
            this.x < object.x + object.width &&
            this.x + this.width > object.x &&
            feetY >= object.y &&
            feetY <= object.y + object.height
        );
    }

    moveLeft() {
        this.velocityX = -this.speed;
    }
    
    moveRight() {
        this.velocityX = this.speed;
    }

    jump() {
        if (this.onGround) {
            this.velocityY = -this.jumpPower;
            this.onGround = false;
        }
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    drawDebug(ctx) {
        // Draw bounding box
        ctx.strokeStyle = 'red';
        ctx.strokeRect(this.x, this.y, this.width, this.height);

        // Draw velocity vector
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2, this.y + this.height / 2);
        ctx.lineTo(
            this.x + this.width / 2 + this.velocityX * 10,
            this.y + this.height / 2 + this.velocityY * 10
        );
        ctx.strokeStyle = 'blue';
        ctx.stroke();
    }
}
class Platform {
    constructor(x, y, width, height, color) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.canBePushed = false;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}
class DoorTrigger {
    constructor(x, y, width, height, direction, action) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.direction = direction; // 'horizontal' or 'vertical'
        this.action = action;
        this.wasInside = false;
        this.triggered = false;
        this.entryPoint = null;
    }

    draw(ctx) {
        ctx.strokeStyle = this.triggered ? 'red' : 'blue';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
    }

    checkTrigger(character) {
        if (this.triggered) return;

        const isInside = this.isCharacterInside(character);

        if (!this.wasInside && isInside) {
            // Character just entered the trigger area
            this.entryPoint = this.getEntryPoint(character);
        } else if (this.wasInside && !isInside) {
            // Character just left the trigger area
            const exitPoint = this.getExitPoint(character);
            if (this.isValidTrigger(this.entryPoint, exitPoint)) {
                this.triggered = true;
                this.action();
            }
        }

        this.wasInside = isInside;
    }

    isCharacterInside(character) {
        return character.x < this.x + this.width &&
               character.x + character.width > this.x &&
               character.y < this.y + this.height &&
               character.y + character.height > this.y;
    }

    getEntryPoint(character) {
        if (this.direction === 'horizontal') {
            return character.x < this.x + this.width / 2 ? 'left' : 'right';
        } else {
            return character.y < this.y + this.height / 2 ? 'top' : 'bottom';
        }
    }

    getExitPoint(character) {
        if (this.direction === 'horizontal') {
            return character.x + character.width <= this.x ? 'left' : 
                   character.x >= this.x + this.width ? 'right' : 'middle';
        } else {
            return character.y + character.height <= this.y ? 'top' : 
                   character.y >= this.y + this.height ? 'bottom' : 'middle';
        }
    }

    isValidTrigger(entryPoint, exitPoint) {
        if (this.direction === 'horizontal') {
            return (entryPoint === 'left' && exitPoint === 'right') ||
                   (entryPoint === 'right' && exitPoint === 'left');
        } else {
            return (entryPoint === 'top' && exitPoint === 'bottom') ||
                   (entryPoint === 'bottom' && exitPoint === 'top');
        }
    }

    reset() {
        this.triggered = false;
        this.wasInside = false;
        this.entryPoint = null;
    }
}
class Box {
    constructor(x, y, width, height, color, pushModifier = 0.9) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.velocityX = 0;
        this.velocityY = 0;
        this.accelerationY = gravity;
        this.onGround = false;
        this.canBePushed = true;
        this.pushModifier = pushModifier;
    }

    update(platforms, boxes) {
        this.velocityX *= friction;
        this.velocityY += this.accelerationY;

        this.x += this.velocityX;
        this.y += this.velocityY;

        this.resolveCollisions(platforms.concat(boxes.filter(box => box !== this)));

        if (this.x < 0) this.x = 0;
        if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;

        this.onGround = this.checkOnGround(platforms.concat(boxes.filter(box => box !== this)));
    }

    resolveCollisions(objects) {
        for (let object of objects) {
            const overlap = this.getOverlap(object);
            if (overlap.width > 0 && overlap.height > 0) {
                if (overlap.width < overlap.height) {
                    // Resolve horizontal collision
                    if (this.x < object.x) {
                        this.x -= overlap.width;
                    } else {
                        this.x += overlap.width;
                    }
                    if (object.canBePushed) {
                        object.velocityX += this.velocityX * this.pushModifier;
                    } else {
                        this.velocityX = 0;
                    }
                } else {
                    // Resolve vertical collision
                    if (this.y < object.y) {
                        this.y -= overlap.height;
                        this.onGround = true;
                    } else {
                        this.y += overlap.height;
                    }
                    if (object.canBePushed) {
                        object.velocityY += this.velocityY * this.pushModifier;
                    } else {
                        this.velocityY = 0;
                    }
                }
            }
        }
    }

    getOverlap(object) {
        const overlapX = Math.min(this.x + this.width, object.x + object.width) - Math.max(this.x, object.x);
        const overlapY = Math.min(this.y + this.height, object.y + object.height) - Math.max(this.y, object.y);
        return { width: Math.max(0, overlapX), height: Math.max(0, overlapY) };
    }

    checkOnGround(objects) {
        const feetY = this.y + this.height + 1;
        return objects.some(object => 
            this.x < object.x + object.width &&
            this.x + this.width > object.x &&
            feetY >= object.y &&
            feetY <= object.y + object.height
        );
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'a') keys.a = true;
    if (e.key === 'd') keys.d = true;
    if (e.key === 'w') keys.w = true;
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'a') keys.a = false;
    if (e.key === 'd') keys.d = false;
    if (e.key === 'w') keys.w = false;
});

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (keys.a) character.moveLeft();
    if (keys.d) character.moveRight();
    if (keys.w) character.jump();

    boxes.forEach(box => box.update(platforms, boxes));
    character.update(platforms, boxes);

    platforms.forEach(platform => platform.draw(ctx));
    boxes.forEach(box => box.draw(ctx));
    doorTriggers.forEach(trigger => {
        trigger.checkTrigger(character);
        trigger.draw(ctx);
    });
    character.draw(ctx);
    character.drawDebug(ctx);

    requestAnimationFrame(gameLoop);
}

function initGame() {
    canvas.width = window.innerWidth * 0.9;
    canvas.height = window.innerHeight * 0.9;
    character = new Character(canvas.width/2 - 0.05*canvas.width/2, 100, 0.05*canvas.width, 0.05*canvas.width, 'black');
    platforms = [
        new Platform(0, 0, 100, canvas.height-100, 'grey'),
        new Platform(0, canvas.height-100, canvas.width, 100, 'grey'),
        new Platform(canvas.width-100, 0, 100, canvas.height, 'grey'),
        new Platform(700, canvas.height-300, 50, 100, 'grey'),
        new Platform(900, canvas.height-200, 100, 100, 'grey'),
    ];
    let scaler = new DoorTrigger(700, canvas.height-200, 50, 100, 'horizontal', () => {
        const newScale = 1.5;
        character.setScale(newScale);
        character.velocityX = 0;
        character.velocityY = 0;
    });
    doorTriggers = [
        scaler
    ];
    boxes = [
        new Box(600, canvas.height - 200, 50, 50, 'brown'),
        new Box(300, canvas.height - 200, 50, 50, 'brown'),
    ];
}

initGame();
gameLoop();