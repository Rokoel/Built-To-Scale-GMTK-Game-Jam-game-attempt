const mainMenu = document.getElementById('main-menu');
const settingsMenu = document.getElementById('settings');
var canvas = document.getElementById('game-canvas');
const beginGameButton = document.getElementById('begin-game');
const settingsButton = document.getElementById('settings-button');
const backToMainMenuButton = document.getElementById('back-to-main-menu');
const musicVolumeSlider = document.getElementById('music-volume');
const soundsVolumeSlider = document.getElementById('sounds-volume');

var ctx;
const gravity = 0.8;
const friction = 0.9;
var INITIAL_CANVAS_SIZE;

var scaleUpSound = new Audio('scale-sound.mp3');
var scaleDownSound = new Audio('scale-down.mp3');
var clickSound = new Audio('click.mp3');
var character;
var characterSprite = new Image(100, 100);
characterSprite.src = "../MainChar2.png";
var platforms;
var platformSprite = new Image(100, 100);
platformSprite.src = "../Platform.png";
var doorTriggers;
var boxes;
var boxesSprite = new Image(100, 100);
boxesSprite.src = "../Box2.png";

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
        
        this.speed *= Math.sqrt(newScale / this.scale);
        this.jumpPower *= newScale / this.scale;
        this.scale = newScale;
    }

    update(platforms, boxes) {
        if (keys.a) this.moveLeft();
        if (keys.d) this.moveRight();
        if (keys.w) this.jump();
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
    constructor(x, y, width, height, sprite, color="") {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.sprite = sprite;
        this.canBePushed = false;
    }

    draw() {
        if (this.color == "") {
            ctx.drawImage(this.sprite, this.x, this.y, this.width, this.height);
        }
        else {
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
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
class ScalerTrigger extends DoorTrigger {
    constructor(x, y, width, height, direction, numberOfUses, scaleModifier) {
        super(x, y, width, height, direction, (entity) => {
            if (this.numberOfUses >= 1) {
                entity.setScale(entity.scale * this.scaleModifier);
                entity.velocityX = 0;
                entity.velocityY = 0;
                if (this.scaleModifier >= 1) {
                    scaleUpSound.play();
                }
                else {
                    scaleDownSound.play();
                }
                this.numberOfUses--;
                this.reset();
                if (this.numberOfUses === 0) {
                    this.triggered = true;
                }
            }
        });
        this.numberOfUses = numberOfUses;
        this.scaleModifier = scaleModifier;
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
class TextLine {
    constructor(x, y, contents, color, size, align='left') {
        this.x = x;
        this.y = y;
        this.contents = contents;
        this.color = color;
        this.fontSize = size;
        this.align = align;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.font = this.fontSize + 'px builtToScale';
        ctx.textAlign = this.align;
        ctx.fillText(this.contents, this.x, this.y);
    }
}
class Level {
    constructor(width, height, blockSize) {
        this.width = width;
        this.height = height;
        this.blockSize = blockSize;
        this.character = null;
        this.platforms = [];
        this.boxes = [];
        this.doorTriggers = [];
        this.scaleTriggers = [];
        this.texts = [];
    }

    static fromASCII(asciiMap, blockSize) {
        const rows = asciiMap.trim().split('\n');
        const height = rows.length;
        const width = rows[0].length;
        const level = new Level(width, height, blockSize);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const char = rows[y][x];
                const [canvasX, canvasY] = level.gridToCanvas(x, y);

                switch (char) {
                    case '#':
                        level.platforms.push(new Platform(canvasX, canvasY, blockSize, blockSize, platformSprite));
                        break;
                    case 'B':
                        level.boxes.push(new Box(canvasX, canvasY, blockSize, blockSize, boxesSprite));
                        break;
                    case 'C':
                        level.character = new Character(canvasX, canvasY, blockSize, blockSize, characterSprite);
                        break;
                    case 'T':
                        level.doorTriggers.push(new DoorTrigger(canvasX, canvasY, blockSize, blockSize, 'horizontal', () => {}));
                        break;
                    case 'S':
                        level.scaleTriggers.push(new ScalerTrigger(canvasX, canvasY, blockSize, blockSize, 'horizontal', 1, 1.5));
                        break;
                }
            }
        }

        return level;
    }

    gridToCanvas(gridX, gridY) {
        return [gridX * this.blockSize, gridY * this.blockSize];
    }

    canvasToGrid(canvasX, canvasY) {
        return [Math.floor(canvasX / this.blockSize), Math.floor(canvasY / this.blockSize)];
    }

    reset() {
        //
    }

    start(canv) {
        canv.width = this.width * this.blockSize;
        canv.height = this.height * this.blockSize;
    }

    update() {
        this.boxes.forEach(box => box.update(this.platforms, this.boxes));
        this.character.update(this.platforms, this.boxes);
        const allEntities = [this.character, ...this.boxes];
        this.doorTriggers.forEach(trigger => {
            trigger.checkTrigger(allEntities);
        });
        this.scaleTriggers.forEach(trigger => {
            trigger.checkTrigger(allEntities);
        });
    }

    draw(ctx) {
        // Draw all objects in the level
        this.platforms.forEach(platform => platform.draw(ctx));
        this.texts.forEach(text => text.draw(ctx));
        this.boxes.forEach(box => box.draw(ctx));
        this.character.draw(ctx);
        this.doorTriggers.forEach(trigger => trigger.draw(ctx));
        this.scaleTriggers.forEach(trigger => trigger.draw(ctx));
    }

    addObject(type, gridX, gridY, ...params) {
        if (gridX < 0 || gridX >= this.width || gridY < 0 || gridY >= this.height) {
            console.error(`Grid coordinates (${gridX}, ${gridY}) out of bounds`);
            return;
        }
    
        const [canvasX, canvasY] = this.gridToCanvas(gridX, gridY);
        let newObject = null;
    
        switch (type.toLowerCase()) {
            case 'platform':
                newObject = new Platform(canvasX, canvasY, this.blockSize, this.blockSize, params[0] || 'grey');
                this.platforms.push(newObject);
                break;
            case 'box':
                newObject = new Box(canvasX, canvasY, this.blockSize, this.blockSize, params[0] || boxesSprite, params[1] || '');
                this.boxes.push(newObject);
                break;
            case 'character':
                if (this.character) {
                    console.warn("Character already exists. Removing old character.");
                    const oldPos = this.canvasToGrid(this.character.x, this.character.y);
                }
                newObject = new Character(canvasX, canvasY, this.blockSize, this.blockSize, params[0] || characterSprite);
                this.character = newObject;
                break;
            case 'doortrigger':
                newObject = new DoorTrigger(canvasX, canvasY, this.blockSize, this.blockSize, params[0] || 'horizontal', params[1] || (() => {}));
                this.doorTriggers.push(newObject);
                break;
            case 'scaletrigger':
                newObject = new ScalerTrigger(canvasX, canvasY, this.blockSize, this.blockSize, params[0] || 'horizontal', params[1] || 1, params[2] || 1.5);
                this.scaleTriggers.push(newObject);
                break;
            case 'text':
                newObject = new TextLine(canvasX, canvasY, params[0] || '', params[1] || '#293241', params[2] || canvas.width / 20, params[3] || 'left');
                this.texts.push(newObject);
                break;
            default:
                console.error(`Unknown object type: ${type}`);
                return;
        }
    }
}

let backgroundMusic = new Audio('../LoopBgSong.mp3');

let musicVolume = 0.5;
let soundsVolume = 0.5;

function showMainMenu() {
    playGameSound(clickSound);
    mainMenu.style.display = 'flex';
    settingsMenu.style.display = 'none';
    canvas.style.display = 'none';
}

function showSettings() {
    playGameSound(clickSound);
    mainMenu.style.display = 'none';
    settingsMenu.style.display = 'flex';
    canvas.style.display = 'none';
}

function updateMusicVolume() {
    musicVolume = musicVolumeSlider.value / 100;
    backgroundMusic.volume = musicVolume;
}

let isPlayingSampleSound = false;
let sampleSoundInterval = null;
function updateSoundsVolume() {
    soundsVolume = soundsVolumeSlider.value / 100;
    if (!isPlayingSampleSound) {
        isPlayingSampleSound = true;
        playGameSound(scaleUpSound);
        sampleSoundInterval = setInterval(playGameSound, 500, scaleUpSound);
    }
}

function stopSampleSound() {
    isPlayingSampleSound = false;
    if (sampleSoundInterval) {
        clearInterval(sampleSoundInterval);
        sampleSoundInterval = null;
    }
}

function playGameSound(sound) {
    sound.volume = soundsVolume;
    sound.currentTime = 0;
    sound.play();
}

backToMainMenuButton.addEventListener('click', handleGoBack);
beginGameButton.addEventListener('click', startGame);
settingsButton.addEventListener('click', showSettings);

musicVolumeSlider.addEventListener('input', updateMusicVolume);
soundsVolumeSlider.addEventListener('input', updateSoundsVolume);
soundsVolumeSlider.addEventListener('mouseup', stopSampleSound);
soundsVolumeSlider.addEventListener('touchend', stopSampleSound);

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
document.addEventListener('click', startBackgroundMusic, { once: true });
document.addEventListener('keydown', handleEscapeKey);
document.addEventListener('keydown', handleBackspace);

musicVolumeSlider.value = musicVolume * 100;
soundsVolumeSlider.value = soundsVolume * 100;

let musicStarted = false;
function startBackgroundMusic() {
    if (!musicStarted) {
        backgroundMusic.loop = true;
        backgroundMusic.play().catch(error => {
            console.log("Audio play failed:", error);
        });
        musicStarted = true;
    }
}

function handleGoBack() {
    if (isInGame) {
        settingsMenu.style.display = 'none';
        canvas.style.display = 'block';
    } else {
        showMainMenu();
    }
}

function handleEscapeKey(event) {
    if (event.key === 'Escape') {
        if (isInGame && canvas.style.display !== 'none') {
            showSettings();
        } else if (isInGame && settingsMenu.style.display !== 'none') {
            handleGoBack();
        }
    }
}

function fadeInOut(duration, callback) {
    const halfDuration = duration / 2;

    fadeOverlay.style.transition = `opacity ${halfDuration}ms ease`;
    fadeOverlay.style.opacity = '1';

    setTimeout(() => {
        callback();
        fadeOverlay.style.opacity = '0';
        setTimeout(() => {}, halfDuration);
    }, halfDuration);
}

function handleBackspace(event) {
    if (event.key === 'Backspace') {
        levels = generateAndReturnLevels();
    }
}

var currentLevel = 0;
var levels;

function generateAndReturnLevels() {
    const level1 = Level.fromASCII(`
######################
#                  ###
#                  ###
#     C               
######################
            `, INITIAL_CANVAS_SIZE.width / 15);
        
    level1.addObject('text', 2, 2, "A, W AND D TO MOVE", "#293241", INITIAL_CANVAS_SIZE.width / 20, "left");
    level1.addObject('text', 2, 2.5, "ESC TO ACCESS MENU", "#293241", INITIAL_CANVAS_SIZE.width / 30, "left");
    level1.addObject('doortrigger', 19, 3, 'horizontal', () => {
        fadeInOut(1000, () => {
            currentLevel++;
            levels[currentLevel].start(canvas);
            levels[currentLevel].draw(ctx);
        });
    });

    const level2 = Level.fromASCII(`
######################
#         #        ###
#         #           
#     C               
######################
            `, INITIAL_CANVAS_SIZE.width / 15);

    var biggerExit = new DoorTrigger(19*INITIAL_CANVAS_SIZE.width / 15, 2*INITIAL_CANVAS_SIZE.width / 15, INITIAL_CANVAS_SIZE.width / 15, INITIAL_CANVAS_SIZE.width / 15*2, 'horizontal', () => {
        fadeInOut(1000, () => {
            currentLevel++;
            levels[currentLevel].start(canvas);
            levels[currentLevel].draw(ctx);
        });
    });
    level2.doorTriggers.push(biggerExit);
    level2.addObject('text', 1.2, 2, "THIS IS A SCALE-GATE", "#293241", canvas.width / 20, "left");
    level2.addObject('text', 1.2, 2.5, "IT SCALES. EVERYTHING.", "#293241", canvas.width / 30, "left");
    level2.addObject('scaletrigger', 10, 3, 'horizontal', 1, 1.5);

    const level3 = Level.fromASCII(`
######################
#       #          ###
#   C              ###
# #######          ###
#         # # # # ####
#                  ###
#     #               
#     #               
######################
            `, INITIAL_CANVAS_SIZE.width / 15);

    var biggerExit = new DoorTrigger(19*INITIAL_CANVAS_SIZE.width / 15, 6*INITIAL_CANVAS_SIZE.width / 15, INITIAL_CANVAS_SIZE.width / 15, INITIAL_CANVAS_SIZE.width / 15*2, 'horizontal', () => {
        fadeInOut(1000, () => {
            currentLevel++;
            levels[currentLevel].start(canvas);
            levels[currentLevel].draw(ctx);
        });
    });
    level3.doorTriggers.push(biggerExit);
    level3.addObject('text', 8.5, 2.5, "1.5", "red", INITIAL_CANVAS_SIZE.width / 30, "center");
    level3.addObject('text', 1.5, 3.5, "1.5", "red", INITIAL_CANVAS_SIZE.width / 30, "center");
    level3.addObject('text', 10, 2, "SCALE-FACTOR OF A GATE", "#293241", INITIAL_CANVAS_SIZE.width / 30, "left");
    level3.addObject('text', 10, 2.5, "WILL USUALLY BE SEEN IN IT", "#293241", INITIAL_CANVAS_SIZE.width / 30, "left");
    level3.addObject('text', 10, 6, "TO RESET THE LVL,", "#293241", INITIAL_CANVAS_SIZE.width / 30, "left");
    level3.addObject('text', 10, 7, "PRESS BACKSPACE", "#293241", INITIAL_CANVAS_SIZE.width / 30, "left");
    level3.addObject('scaletrigger', 8, 2, 'horizontal', 1, 1.5);
    level3.addObject('scaletrigger', 1, 3, 'vertical', 1, 1.5);

    const level4 = Level.fromASCII(`
#########################
#                       #
#           C           #
#                       #
######  ########## ######
#      # #              #
#     #  #       #      #
#        #              #
### ######      ### #####
#              #      ###
#              #      ###
#              #         
#########################
            `, INITIAL_CANVAS_SIZE.width / 15);

    var biggerExit = new DoorTrigger(22*INITIAL_CANVAS_SIZE.width / 15, 11*INITIAL_CANVAS_SIZE.width / 15, INITIAL_CANVAS_SIZE.width / 15, INITIAL_CANVAS_SIZE.width / 15, 'horizontal', () => {
        fadeInOut(1000, () => {
            currentLevel++;
            levels[currentLevel].start(canvas);
            levels[currentLevel].draw(ctx);
        });
    });
    level4.doorTriggers.push(biggerExit);
    level4.addObject('text', 10, 2, "A SIMPLE TASK", "#293241", INITIAL_CANVAS_SIZE.width / 20, "left");
    level4.addObject('text', 6.5, 4.5, "0.9", "red", INITIAL_CANVAS_SIZE.width / 30, "center");
    level4.addObject('text', 18.5, 4.5, "1.1", "red", INITIAL_CANVAS_SIZE.width / 30, "center");
    level4.addObject('scaletrigger', 6, 4, 'vertical', 1, 0.7);
    level4.addObject('scaletrigger', 18, 4, 'vertical', 1, 1.4);

    const level5 = Level.fromASCII(`
########################
#                      #
#                    # #
#                    # #
#                    # #
#######   ############ #
#                    # #
#      ###           # #
# C                  # #
###################### #
            `, INITIAL_CANVAS_SIZE.width / 20);
    level5.addObject('text', 7.5, 5.75, "2", "red", INITIAL_CANVAS_SIZE.width / 30, "center");
    level5.addObject('text', 9.5, 5.75, "0.5", "red", INITIAL_CANVAS_SIZE.width / 30, "center");
    level5.addObject('scaletrigger', 7, 5, 'vertical', 1, 2);
    level5.addObject('scaletrigger', 9, 5, 'vertical', 1, 0.5);
    level5.addObject('doortrigger', 22, 7, 'vertical', () => {
        fadeInOut(1000, () => {
            currentLevel++;
            levels[currentLevel].start(canvas);
            levels[currentLevel].draw(ctx);
        });
    });

    const level6 = Level.fromASCII(`
########################
#                      #
#                      #
#                      #
#                      #
#                    # #
#                    # #
#                    # #
# C          B       # #
###################### #
            `, INITIAL_CANVAS_SIZE.width / 20);
    level6.addObject('text', 7.5, 5.75, "THIS IS A BOX", "#293241", INITIAL_CANVAS_SIZE.width / 20, "center");
    level6.addObject('doortrigger', 22, 7, 'vertical', () => {
        fadeInOut(1000, () => {
            currentLevel++;
            levels[currentLevel].start(canvas);
            levels[currentLevel].draw(ctx);
        });
    });
    const level7 = Level.fromASCII(`
########################
#                    # #
#                    # #
#                      #
#                    # #
#                    # #
#                    # #
#                    # #
# C          B       # #
###################### #
            `, INITIAL_CANVAS_SIZE.width / 20);
    level7.addObject('text', 7.5, 8.75, "2", "red", INITIAL_CANVAS_SIZE.width / 30, "center");
    level7.addObject('scaletrigger', 7, 8, 'horizontal', 1, 2);
    level7.addObject('doortrigger', 22, 7, 'vertical', () => {
        fadeInOut(1000, () => {
            currentLevel++;
            levels[currentLevel].start(canvas);
            levels[currentLevel].draw(ctx);
        });
    });

    const level8 = Level.fromASCII(`
##########################
#                      # #
#                      # #
#                        #
#      B                 #
#  #########           # #
#                      # #
#               #      # #
# C  B  #              # #
######################## #
            `, INITIAL_CANVAS_SIZE.width / 20);
    level8.addObject('text', 5.5, 4.75, "2", "red", INITIAL_CANVAS_SIZE.width / 30, "center");
    level8.addObject('text', 9.5, 4.75, "0.5", "red", INITIAL_CANVAS_SIZE.width / 30, "center");
    level8.addObject('scaletrigger', 5, 4, 'horizontal', 1, 2);
    level8.addObject('scaletrigger', 9, 4, 'horizontal', 1, 0.5);
    level8.addObject('doortrigger', 24, 7, 'vertical', () => {
        fadeInOut(1000, () => {
            currentLevel++;
            levels[currentLevel].start(canvas);
            levels[currentLevel].draw(ctx);
        });
    });
    const level9 = Level.fromASCII(`
#####################
#                 
#                 
#                 
#                ####
#                #
#                #
#                #
#                #
#                #
#                #
#                #
#                #
#    B           #
#   #####        #
#                #
#                #
# C  B           #
##################
            `, INITIAL_CANVAS_SIZE.width / 20);
    level9.addObject('text', 7.5, 13.75, "0.5", "red", INITIAL_CANVAS_SIZE.width / 30, "center");
    level9.addObject('text', 7.5, 17.75, "2", "red", INITIAL_CANVAS_SIZE.width / 30, "center");
    level9.addObject('scaletrigger', 7, 13, 'horizontal', 1, 0.5);
    level9.addObject('scaletrigger', 7, 17, 'horizontal', 1, 2);
    var biggerExit = new DoorTrigger(17*INITIAL_CANVAS_SIZE.width / 20, INITIAL_CANVAS_SIZE.width / 20, INITIAL_CANVAS_SIZE.width / 20, 3*INITIAL_CANVAS_SIZE.width / 20, 'horizontal', () => {
        fadeInOut(1000, () => {
            loadEndingScreen();
        });
    });
    level9.doorTriggers.push(biggerExit);
    return [level1, level2, level3, level4, level5, level6, level7, level8, level9];
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    levels[currentLevel].update();
    levels[currentLevel].draw(ctx);

    requestAnimationFrame(gameLoop);
}

let isInGame = false;
function startGame() {
    playGameSound(clickSound);
    ctx = canvas.getContext('2d');

    var mainFont = new FontFace('builtToScale', 'url(../BUILTTOSCALE.ttf)');
    mainFont.load().then(function(font){
        document.fonts.add(font);
        console.log('Font loaded');
        ctx.font = canvas.width / 20 + 'px builtToScale';
        ctx.textAlign = 'left';
    });
    mainMenu.style.display = 'none';
    settingsMenu.style.display = 'none';
    canvas.style.display = 'block';
    isInGame = true;
    INITIAL_CANVAS_SIZE = {width: canvas.width, height: canvas.height};
    levels = generateAndReturnLevels();
    levels[currentLevel].start(canvas);
    gameLoop();
}

function showEndGameSplash() {
    document.getElementById("ending-splash").style.display = "flex";
}

function loadEndingScreen() {
    currentLevel = 0;
    levels = generateAndReturnLevels();
    showMainMenu();
    showEndGameSplash();
};

showMainMenu();