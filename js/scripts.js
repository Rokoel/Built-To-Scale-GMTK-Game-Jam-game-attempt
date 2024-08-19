var canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const gravity = 0.8;
const friction = 0.9;
var character;
var platforms;
var doorTriggers;

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
        this.accelerationX = 0;
        this.accelerationY = gravity;
        this.onGround = false;
        this.wasJustScaled = false;
        this.speed = 5;
        this.jumpPower = 15;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    update(platforms) {
        this.velocityX *= friction;
        this.velocityY += this.accelerationY;
        if (this.wasJustScaled) {

        }
    
        // Apply horizontal movement
        this.x += this.velocityX;
        this.handleHorizontalCollisions(platforms);
    
        // Apply vertical movement
        this.y += this.velocityY;
        this.handleVerticalCollisions(platforms);
    
        // Ensure character stays within the canvas horizontally
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;
    
        // Check if the character is on the ground
        this.onGround = this.checkOnGround(platforms);
    }

    isCollidingWith(platform) {
        return (
            this.x < platform.x + platform.width &&
            this.x + this.width > platform.x &&
            this.y < platform.y + platform.height &&
            this.y + this.height > platform.y
        );
    }

    handleHorizontalCollisions(platforms) {
        platforms.forEach(platform => {
            if (this.isCollidingWith(platform)) {
                if (this.velocityX > 0) {
                    this.x = platform.x - this.width;
                } else if (this.velocityX < 0) {
                    this.x = platform.x + platform.width;
                }
                this.velocityX = 0;
            }
        });
    }
    
    handleVerticalCollisions(platforms) {
        platforms.forEach(platform => {
            if (this.isCollidingWith(platform)) {
                if (this.velocityY > 0) {
                    this.y = platform.y - this.height;
                    this.onGround = true;
                } else if (this.velocityY < 0) {
                    this.y = platform.y + platform.height;
                }
                this.velocityY = 0;
            }
        });
    }
    
    checkOnGround(platforms) {
        const feetY = this.y + this.height + 1;
        return platforms.some(platform => 
            this.x < platform.x + platform.width &&
            this.x + this.width > platform.x &&
            feetY >= platform.y &&
            feetY <= platform.y + platform.height
        );
    }

    moveLeft() {
        this.velocityX = Math.max(this.velocityX - 0.5, -this.speed);
    }
    
    moveRight() {
        this.velocityX = Math.min(this.velocityX + 0.5, this.speed);
    }

    jump() {
        if (this.onGround) {
            this.velocityY = -this.jumpPower;
            this.onGround = false;
        }
    }
}
class Platform {
    constructor(x, y, width, height, color) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
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

    platforms.forEach(platform => {
        platform.draw();
    });

    doorTriggers.forEach(trigger => {
        trigger.checkTrigger(character);
        trigger.draw(ctx);
    });

    character.update(platforms);
    character.draw();

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
        character.y = character.y - character.height * 0.5;
        character.width = character.width * 1.5;
        character.height = character.height * 1.5;
        character.jumpPower *= 1.1  ;
        if (scaler.entryPoint == "left") {
            character.x = scaler.x + scaler.width;
        }
        else {
            character.x = scaler.x - character.width;
        }
    })
    doorTriggers = [
        scaler
    ];  
}

initGame();
gameLoop();