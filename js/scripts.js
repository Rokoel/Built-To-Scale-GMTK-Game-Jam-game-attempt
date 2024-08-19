var canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const gravity = 0.8;
const friction = 0.9;
var character;
var characterSprite = new Image(100, 100);
characterSprite.src = "../MainChar.png";
var platforms;
var doorTriggers;
var boxes;
var boxesSprite = new Image(100, 100);
boxesSprite.src = "../Box.png";

const keys = {
    a: false,
    d: false,
    w: false
};

class Character {
    constructor(x, y, width, height, sprite, color="") {
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
        this.sprite = sprite;
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
        if (this.color == "") {
            ctx.drawImage(this.sprite, this.x, this.y, this.width, this.height);
        }
        else {
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
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
        this.entitiesInside = new Set();
        this.triggered = false;
    }

    draw(ctx) {
        ctx.strokeStyle = this.triggered ? 'red' : 'blue';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
    }

    checkTrigger(entities) {
        if (this.triggered) return;

        entities.forEach(entity => {
            const isInside = this.isEntityInside(entity);
            
            if (isInside && !this.entitiesInside.has(entity)) {
                // Entity just entered the trigger area
                this.entitiesInside.add(entity);
                entity.entryPoint = this.getEntryPoint(entity);
            } else if (!isInside && this.entitiesInside.has(entity)) {
                // Entity just left the trigger area
                const exitPoint = this.getExitPoint(entity);
                if (this.isValidTrigger(entity.entryPoint, exitPoint)) {
                    this.triggered = true;
                    this.action(entity);
                }
                this.entitiesInside.delete(entity);
                delete entity.entryPoint;
            }
        });
    }

    isEntityInside(entity) {
        return entity.x < this.x + this.width &&
               entity.x + entity.width > this.x &&
               entity.y < this.y + this.height &&
               entity.y + entity.height > this.y;
    }

    getEntryPoint(entity) {
        if (this.direction === 'horizontal') {
            return entity.x < this.x + this.width / 2 ? 'left' : 'right';
        } else {
            return entity.y < this.y + this.height / 2 ? 'top' : 'bottom';
        }
    }

    getExitPoint(entity) {
        if (this.direction === 'horizontal') {
            return entity.x + entity.width <= this.x ? 'left' : 
                   entity.x >= this.x + this.width ? 'right' : 'middle';
        } else {
            return entity.y + entity.height <= this.y ? 'top' : 
                   entity.y >= this.y + this.height ? 'bottom' : 'middle';
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
    }
}
class Box {
    constructor(x, y, width, height, sprite, color="", pushModifier = 0.9) {
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
        this.scale = 1;
        this.sprite = sprite;
    }

    setScale(newScale) {
        const centerX = this.x + this.width / 2;
        const bottomY = this.y + this.height;
        
        this.width *= newScale / this.scale;
        this.height *= newScale / this.scale;
        
        this.x = centerX - this.width / 2;
        this.y = bottomY - this.height;
        
        this.scale = newScale;
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
        if (this.color == "") {
            ctx.drawImage(this.sprite, this.x, this.y, this.width, this.height);
        }
        else {
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
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
    
    const allEntities = [character, ...boxes];
    doorTriggers.forEach(trigger => {
        trigger.checkTrigger(allEntities);
        trigger.draw(ctx);
    });
    
    character.draw(ctx);
    // character.drawDebug(ctx);

    requestAnimationFrame(gameLoop);
}

function initGame() {
    canvas.width = window.innerWidth * 0.9;
    canvas.height = window.innerHeight * 0.9;
    character = new Character(600, 100, 50, 50, characterSprite);
    platforms = [
        new Platform(0, 0, 100, canvas.height-100, 'grey'),
        new Platform(0, canvas.height-100, canvas.width, 100, 'grey'),
        new Platform(canvas.width-100, 0, 100, canvas.height, 'grey'),
        // new Platform(700, canvas.height-300, 50, 100, 'grey'),
        // new Platform(900, canvas.height-200, 100, 100, 'grey'),
    ];
    let numberOfScales = 1;
    let scaler = new DoorTrigger(800    , canvas.height-200, 200, 100, 'horizontal', (entity) => {
        if (numberOfScales > 0) {
            const newScale = 1.5;
            entity.setScale(newScale);
            entity.velocityX = 0;
            entity.velocityY = 0;
            numberOfScales--;
            scaler.reset();
        }
        console.log(numberOfScales);
    });
    doorTriggers = [
        scaler
    ];
    boxes = [
        new Box(400, canvas.height - 200, 50, 50, boxesSprite, ''),
        new Box(200, canvas.height - 200, 50, 50, boxesSprite, ''),
    ];
}

initGame();
gameLoop();