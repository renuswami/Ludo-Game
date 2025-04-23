//  clasic or timer type game and non safe path token code  .................................................................................
// console.log("First --> ",window.location.href.substring(0, window.location.href.length - 7));
// let socket = io(window.location.href.substring(0, window.location.href.length - 7));

let socket = io("http://localhost:3000/ludo");

// let room_code = window.location.href.substring(window.location.href.length - 6);
let room_code = "67a2035ab8e46a3f546d3074";
const USERNAMES = ['Green Warrior', 'Red Fire', 'Blue Fox', 'Yellow Rhino'];
const PIECES = [];
const colors = ["green", "red", "blue", "yellow"];
let MYROOM = [];
let myid = -1;
let chance = Number(-1);
var PLAYERS = {};
let timerInterval;


var canvas = document.getElementById('theCanvas');
var ctx = canvas.getContext('2d');
canvas.height = 750;
canvas.width = 750;
let myTableData ;

let allPiecesePos = {
    0: [{ x: 50, y: 125 }, { x: 125, y: 50 }, { x: 200, y: 125 }, { x: 125, y: 200 }],
    1: [{ x: 500, y: 125 }, { x: 575, y: 50 }, { x: 650, y: 125 }, { x: 575, y: 200 }],
    2: [{ x: 500, y: 575 }, { x: 575, y: 500 }, { x: 650, y: 575 }, { x: 575, y: 650 }],
    3: [{ x: 50, y: 575 }, { x: 125, y: 500 }, { x: 200, y: 575 }, { x: 125, y: 650 }]
}

let homeTilePos = {
    0: { 0: { x: 50, y: 300 }, 1: { x: 300, y: 100 } },
    1: { 0: { x: 400, y: 50 }, 1: { x: 600, y: 300 } },
    2: { 0: { x: 650, y: 400 }, 1: { x: 400, y: 600 } },
    3: { 0: { x: 300, y: 650 }, 1: { x: 100, y: 400 } }
}

// Add these constants at the top with other constants
let TURN_TIME_LIMIT ; // seconds
let turnTimer = null;
let turnTimeLeft = TURN_TIME_LIMIT;
let turnTimedOut = false;
let tableType = null;

// Add these variables at the top with other global variables
let gameStartTimer = null;
let gameStartDelay; // seconds

let gameStarted = false;
const MIN_PLAYERS = 2; // Minimum players needed to start

const MAX_SKIPPED_TURNS = 3;
const playerSkippedTurns = {};

// Move DICE_FACES to global scope
const DICE_FACES = {
    1: '⚀',
    2: '⚁',
    3: '⚂',
    4: '⚃',
    5: '⚄',
    6: '⚅'
};

let currentTableType = null;

socket.on('connect', function () {
    console.log('connect function called !!!!!!!!!!socket.io called 1...')

    console.log('You are connected to the server!!');

    socket.emit('fetch', room_code, function (data, id) {
        console.log(`fatch emilt line execute id ${id} is this................. `,  data)
        console.log('fetch function called !!!!!!! data: ',data, 'id: ',id,'socket.io called 1...')

        MYROOM = data.sort(function (a, b) { return a - b });
        for (let i = 0; i < MYROOM.length; i++) { MYROOM[i] = +MYROOM[i] }
        myid = id;
        console.log('19/6/21 fetched:', MYROOM, myid, chance);
        StartTheGame();
    });

    let data ={userId:"67d28342491259d5d7f948c8",
        tableId:"67a2035ab8e46a3f546d3074"
    };
    socket.emit("updated_chips", data);

    socket.on('game-started', (data) => {
        currentTableType = data.tableType;
        console.log('Game started with table type:', currentTableType);

        if (currentTableType === 'timer' && data.endTime) {
            createGameTimer();
            updateGameTimer(data.endTime);
        }

        gameStarted = true;
        if (MYROOM.indexOf(Number(myid)) === 0) {
            styleButton(1);
            chance = Number(myid);
            startTurnTimer();
        }
    });
    

    socket.emit('get-table-data', room_code, function (data, id) {
        console.log(`Fetched emit line executed, id ${id}:`, data);
        TURN_TIME_LIMIT = data;
    });
    
    socket.emit('table-type', room_code, function (data, id) {
        console.log(`table-type emit line executed, id ${id}:`, data);
        tableType = data;
        console.log(`table-type --->`, tableType);
         
    });

    socket.on('imposter', () => { window.location.replace("/error-imposter"); });

    socket.on('is-it-your-chance', function (data) {
        console.log("is-it-your-chance function called !!!!!!! data:", data);
        console.warn("is-it-your-chance ", data);
        if (data === myid) {
            styleButton(1);
            outputMessage({ Name: 'your', id: data }, 4);
        } else { 
            outputMessage({ Name: USERNAMES[data] + "'s", id: data }, 4);
        }
        chance = Number(data);
        window.localStorage.setItem('chance', chance.toString());
        updateScoreboard();
        
        // Start the turn timer for the new player
        startTurnTimer();
    });

    socket.on('new-user-joined', function (data) {
        console.log("new-user-joined function called !!!!!!! data:", data);
        MYROOM.push(data.id);
        MYROOM = [...(new Set(MYROOM))];
        MYROOM.sort(function (a, b) { return a - b });
        for (let i = 0; i < MYROOM.length; i++) { MYROOM[i] = +MYROOM[i] }
        loadNewPiece(data.id);
        outputMessage({ Name: USERNAMES[data.id], id: data.id }, 0);
        
        // Check if we have minimum required players
        if (MYROOM.length >= MIN_PLAYERS) {
            // Start the countdown
            startGameCountdown();
        } else {
            // Show waiting message
            outputMessage({ 
                msg: `Waiting for at least one more player to join...`, 
                id: myid 
            }, 5);
        }

        //stop timer,and hide modal.
        document.getElementById("myModal-2").style.display = "none";
        let butt = document.getElementById('WAIT');
        butt.disabled = false;
        butt.style.opacity = 1;
        butt.style.cursor = "pointer"
        clearInterval(window.timer);
    });

    socket.on('user-disconnected', function (data) {
        console.log("user-disconnected function called !!!!!!! data:", data);
        outputMessage({ Name: USERNAMES[data], id: data }, 6);
        resumeHandler(data);
    })

    socket.on('resume', function (data) {
        console.log("resume function called !!!!!!! data:", data);
        resume(data.id);
        data.id == data.click ? outputMessage({ id: data.id, msg: `Resumed th
            e game without ${USERNAMES[data.id]}` }, 5) : outputMessage({ id: data.click, msg: `${USERNAMES[data.click]} has resumed the game without ${USERNAMES[data.id]}` }, 5)
    });

    socket.on('wait', function (data) {
        console.log("wait function called !!!!!!! data:", data);
        wait();
        outputMessage({ id: data.click, msg: `${USERNAMES[data.click]} has decided to wait` }, 5)
    });

    socket.on('rolled-dice', function (data) {
        console.log("rolled-dice function called !!!!!!! data:", data);
        const dice = document.querySelector('#dice');
        if (!dice) return;

        // Animate the dice roll
        dice.style.transform = 'rotate(360deg)';
        
        // Show the final dice face after animation
        setTimeout(() => {
            dice.innerHTML = DICE_FACES[data.num];
            dice.style.transform = 'rotate(0deg)';
            
            // Update message display
            Number(data.id) != myid ? 
                outputMessage({ Name: USERNAMES[data.id], Num: data.num, id: data.id }, 1) : 
                outputMessage({ Name: 'you', Num: data.num, id: data.id }, 1);
        }, 500);
    });

    socket.on('Thrown-dice', async function (data) {
        console.log("Thrown-dice function called !!!!!!! data:", data);
    
        // Update the player's piece position
        await PLAYERS[data.id].myPieces[data.pid].update(data.num);
    
        // Check if the player killed another piece
        if (iKill(data.id, data.pid)) {
            outputMessage({ msg: 'Oops got killed', id: data.id }, 5);
            console.log('line number 289 Oops got killed', data.id);
            allPlayerHandler();
    
            // Reset consecutive sixes on kill
            PLAYERS[data.id].consecutiveSixes = 0;
            
            // Player gets an extra turn for killing a piece
            console.log(`Player ${data.id} gets an extra chance for killing a piece.`);
            socket.emit('chance', { room: data.room, nxt_id: data.id });
            console.log("chance function called !!!!!!! room:", data.room, "id:", data.id, "socket.io called 2...");

        } else {
            // Move to the next player's turn
            allPlayerHandler();
            socket.emit('chance', { room: data.room, nxt_id: chanceRotation(data.id, data.num) });
            console.log("chance function called !!!!!!! room:", data.room, "id:", data.id, "socket.io called 2...");
        }
    
        // Check if the player has won
        if (PLAYERS[data.id].didIwin()) {
            socket.emit('WON', {
                room: data.room,
                id: data.id,
                player: myid
            });
            console.log("WON function called !!!!!!! room:", data.room, "id:", data.id, "player:", myid, "socket.io called 3...");

        }
    });

    socket.on('winner', function (data) {
        console.log("winner function called !!!!!!! data:", data);
        showModal(data);
        console.log('winner function called !!!!!!! data: ',data,'socket.io called 4...')
    })

});

class Player {
    constructor(id) {
        this.id = String(id);
        this.myPieces = new Object();
        console.log("tableType is ", tableType);
        if(tableType == 'timer'){
            for (let i = 0; i < 4; i++) {
                this.myPieces[i] = new Piece(String(i), String(id));
                // Place piece at starting position immediately
                this.myPieces[i].pos = 0;
                this.myPieces[i].x = homeTilePos[id][0].x;
                this.myPieces[i].y = homeTilePos[id][0].y;
            }
        }else{
             console.log("Starting Classic Game - All pieces in home box");
            for (let i = 0; i < 4; i++) {
                this.myPieces[i] = new Piece(String(i), String(id));
                // Classic game: All pieces start in home box
                this.myPieces[i].pos = -1;
                this.myPieces[i].x = allPiecesePos[id][i].x;
                this.myPieces[i].y = allPiecesePos[id][i].y;
            }
        }
        this.won = parseInt(0);
        this.tokensAtHome = 0;
        this.points = 0;
        this.consecutiveSixes = 0;
    }
    draw() {
        for (let i = 0; i < 4; i++) {
            this.myPieces[i].draw();
        }
    }

    didIwin() {
        if (this.won == 4) {
            return 1;
        } else {
             return 0; 
            }
    }

    canMove(num) {
        // Check if any piece can move with the given dice number
        for (let i = 0; i < 4; i++) {
            let piece = this.myPieces[i];
            if (piece.pos > -1 && piece.pos + num <= 56) {
                return true;
            }
            if (num === 6 && piece.pos === -1) {
                return true;
            }
        }
        return false;
    }

    addPoints(amount) {
        this.points += amount;
        console.log(`Player ${this.id} earned ${amount} points. Total points: ${this.points}`);
        updateScoreboard();
    }
    
}

class Piece {
    constructor(i, id) {
        console.log(`constuructor called is ${id} is this................. `)
        this.path = [];
        this.color_id = String(id);
        console.log(this.color_id, typeof (this.color_id));
        this.Pid = String(i);
        this.pos = 0;
        this.x = homeTilePos[this.color_id][0].x;
        this.y = homeTilePos[this.color_id][0].y;
        this.image = PIECES[this.color_id];
        switch (id) {
            case '0':
                console.log('switch is working');
                for (let i = 0; i < 4; i++) { this.path.push(this.oneStepToRight) }
                this.path.push(this.oneStepTowards45);
                for (let i = 0; i < 5; i++) { this.path.push(this.oneStepToTop) }
                for (let i = 0; i < 2; i++) { this.path.push(this.oneStepToRight) }
                for (let i = 0; i < 5; i++) { this.path.push(this.oneStepToBottom) }
                this.path.push(this.oneStepTowards315)
                for (let i = 0; i < 5; i++) { this.path.push(this.oneStepToRight) }
                for (let i = 0; i < 2; i++) { this.path.push(this.oneStepToBottom) }
                for (let i = 0; i < 5; i++) { this.path.push(this.oneStepToLeft) }
                this.path.push(this.oneStepTowards225)
                for (let i = 0; i < 5; i++) { this.path.push(this.oneStepToBottom) }
                for (let i = 0; i < 2; i++) { this.path.push(this.oneStepToLeft) }
                for (let i = 0; i < 5; i++) { this.path.push(this.oneStepToTop) }
                this.path.push(this.oneStepTowards135)
                for (let i = 0; i < 5; i++) { this.path.push(this.oneStepToLeft) }
                this.path.push(this.oneStepToTop)
                for (let i = 0; i < 6; i++) { this.path.push(this.oneStepToRight) }
                break;
            case '1':
                for (let i = 0; i < 4; i++) { this.path.push(this.oneStepToBottom) }
                this.path.push(this.oneStepTowards315)
                for (let i = 0; i < 5; i++) { this.path.push(this.oneStepToRight) }
                for (let i = 0; i < 2; i++) { this.path.push(this.oneStepToBottom) }
                for (let i = 0; i < 5; i++) { this.path.push(this.oneStepToLeft) }
                this.path.push(this.oneStepTowards225)
                for (let i = 0; i < 5; i++) { this.path.push(this.oneStepToBottom) }
                for (let i = 0; i < 2; i++) { this.path.push(this.oneStepToLeft) }
                for (let i = 0; i < 5; i++) { this.path.push(this.oneStepToTop) }
                this.path.push(this.oneStepTowards135)
                for (let i = 0; i < 5; i++) { this.path.push(this.oneStepToLeft) }
                for (let i = 0; i < 2; i++) { this.path.push(this.oneStepToTop) }
                for (let i = 0; i < 5; i++) { this.path.push(this.oneStepToRight) }
                this.path.push(this.oneStepTowards45);
                for (let i = 0; i < 5; i++) { this.path.push(this.oneStepToTop) }
                this.path.push(this.oneStepToRight)
                for (let i = 0; i < 6; i++) { this.path.push(this.oneStepToBottom) }
                break;
            case '2':
                for (let i = 0; i < 4; i++) { this.path.push(this.oneStepToLeft) }
                this.path.push(this.oneStepTowards225)
                for (let i = 0; i < 5; i++) { this.path.push(this.oneStepToBottom) }
                for (let i = 0; i < 2; i++) { this.path.push(this.oneStepToLeft) }
                for (let i = 0; i < 5; i++) { this.path.push(this.oneStepToTop) }
                this.path.push(this.oneStepTowards135)
                for (let i = 0; i < 5; i++) { this.path.push(this.oneStepToLeft) }
                for (let i = 0; i < 2; i++) { this.path.push(this.oneStepToTop) }
                for (let i = 0; i < 5; i++) { this.path.push(this.oneStepToRight) }
                this.path.push(this.oneStepTowards45);
                for (let i = 0; i < 5; i++) { this.path.push(this.oneStepToTop) }
                for (let i = 0; i < 2; i++) { this.path.push(this.oneStepToRight) }
                for (let i = 0; i < 5; i++) { this.path.push(this.oneStepToBottom) }
                this.path.push(this.oneStepTowards315)
                for (let i = 0; i < 5; i++) { this.path.push(this.oneStepToRight) }
                this.path.push(this.oneStepToBottom)
                for (let i = 0; i < 6; i++) { this.path.push(this.oneStepToLeft) }
                break;
            case '3':
                for (let i = 0; i < 4; i++) { this.path.push(this.oneStepToTop) }
                this.path.push(this.oneStepTowards135)
                for (let i = 0; i < 5; i++) { this.path.push(this.oneStepToLeft) }
                for (let i = 0; i < 2; i++) { this.path.push(this.oneStepToTop) }
                for (let i = 0; i < 5; i++) { this.path.push(this.oneStepToRight) }
                this.path.push(this.oneStepTowards45);
                for (let i = 0; i < 5; i++) { this.path.push(this.oneStepToTop) }
                for (let i = 0; i < 2; i++) { this.path.push(this.oneStepToRight) }
                for (let i = 0; i < 5; i++) { this.path.push(this.oneStepToBottom) }
                this.path.push(this.oneStepTowards315)
                for (let i = 0; i < 5; i++) { this.path.push(this.oneStepToRight) }
                for (let i = 0; i < 2; i++)this.path.push(this.oneStepToBottom)
                for (let i = 0; i < 5; i++) { this.path.push(this.oneStepToLeft) }
                this.path.push(this.oneStepTowards225)
                for (let i = 0; i < 5; i++) { this.path.push(this.oneStepToBottom) }
                this.path.push(this.oneStepToLeft)
                for (let i = 0; i < 6; i++) { this.path.push(this.oneStepToTop) }
                break;
        }
    }

    draw() {
        ctx.drawImage(this.image, this.x, this.y, 50, 50);
    }

    update(num) {
        if(tableType == 'timer'){
        if (this.pos + num <= 56) {
            for (let i = this.pos; i < this.pos + num; i++) {
                this.path[i](this.color_id, this.Pid);
                window.PLAYERS[this.color_id].addPoints(1);
                console.log(`Token of Player ${this.color_id} moved one step, +1 point`);
            }
            this.pos += num;
            if (this.pos == 56) {
                window.PLAYERS[this.color_id].won += 1;
                window.PLAYERS[this.color_id].tokensAtHome += 1;
                window.PLAYERS[this.color_id].addPoints(56);
                console.log(`Token of Player ${this.color_id} reached home......`);
                window.PLAYERS[this.color_id].extraTurn = true;
                console.log(`Player ${this.color_id} gets an extra turn!`);
            }
        }
        }else{
             if (this.pos === -1) {
                if (num === 6) {
                    // Bring piece out of home
                    this.pos = 0;
                    this.x = homeTilePos[this.color_id][0].x;
                    this.y = homeTilePos[this.color_id][0].y;
                    window.PLAYERS[this.color_id].tokensAtHome--;
                    window.PLAYERS[this.color_id].extraTurn = true; // Extra turn for rolling 6
                }
            } else if (this.pos + num <= 56) {
                // Normal movement for pieces on board
                for (let i = this.pos; i < this.pos + num; i++) {
                    this.path[i](this.color_id, this.Pid);
                    window.PLAYERS[this.color_id].addPoints(1);
                }
                this.pos += num;
                if (this.pos == 56) {
                    window.PLAYERS[this.color_id].won += 1;
                    window.PLAYERS[this.color_id].addPoints(56);
                    window.PLAYERS[this.color_id].extraTurn = true;
                }
            }
        }
    }

    oneStepToRight(id, pid) {
        window.PLAYERS[id].myPieces[pid].x += 50;
        console.log('to r', this.x, this.y, typeof (this.x), typeof (this.y));
    }

    oneStepToLeft(id, pid) {
        window.PLAYERS[id].myPieces[pid].x -= 50;
        console.log('to l', this.x, this.y, typeof (this.x), typeof (this.y));
    }

    oneStepToTop(id, pid) {
        window.PLAYERS[id].myPieces[pid].y -= 50;
        console.log('to t', this.x, this.y, typeof (this.x), typeof (this.y));
    }

    oneStepToBottom(id, pid) {
        window.PLAYERS[id].myPieces[pid].y += 50;
        console.log('to b', this.x, this.y, typeof (this.x), typeof (this.y));
    }

    oneStepTowards45(id, pid) {
        window.PLAYERS[id].myPieces[pid].x += 50;
        window.PLAYERS[id].myPieces[pid].y -= 50;
        console.log('to 45', this.x, this.y, typeof (this.x), typeof (this.y));
    }

    oneStepTowards135(id, pid) {
        window.PLAYERS[id].myPieces[pid].x -= 50;
        window.PLAYERS[id].myPieces[pid].y -= 50;
        console.log('to 135', this.x, this.y, typeof (this.x), typeof (this.y));
    }

    oneStepTowards225(id, pid) {
        window.PLAYERS[id].myPieces[pid].x -= 50;
        window.PLAYERS[id].myPieces[pid].y += 50;
        console.log('to 225', this.x, this.y, typeof (this.x), typeof (this.y));
    }

    oneStepTowards315(id, pid) {
        window.PLAYERS[id].myPieces[pid].x += 50;
        window.PLAYERS[id].myPieces[pid].y += 50;
        console.log('to 315', this.x, this.y, typeof (this.x), typeof (this.y));
    }

    kill() {
        if (this.pos > 0) {
            window.PLAYERS[this.color_id].addPoints(-this.pos);
            console.log(`Player ${this.color_id} lost ${this.pos} points for token being killed`);
        }
        if(tableType === 'timer') {
            // Timer game: Return to position 0
            this.pos = 0;
            this.x = homeTilePos[this.color_id][0].x;
            this.y = homeTilePos[this.color_id][0].y;
        } else {
            // Classic game: Return to home box
            this.pos = -1;
            this.x = allPiecesePos[this.color_id][Number(this.Pid)].x;
            this.y = allPiecesePos[this.color_id][Number(this.Pid)].y;
            window.PLAYERS[this.color_id].tokensAtHome++;
        }
    }
}



//To know if the client has disconnected with the server
socket.on('disconnect', function () {
    console.log('You are disconnected to the server');
    console.log('disconnect function called !!!!!!! socket.io called 5...')
})

//Output the message through DOM manipulation
function outputMessage(anObject, k) {
    let msgBoard = document.querySelector('.msgBoard');

    if (k === 1 && !(anObject.Name.includes('<') || anObject.Name.includes('>') || anObject.Name.includes('/'))) {
        const div = document.createElement('div');
        div.classList.add('message')
        div.innerHTML = `<p><strong>&#9733;  <span id="color-message-span1"style="text-shadow: 0 0 4px ${colors[anObject.id]};">${anObject.Name}</span></strong><span id="color-message-span2"> got a ${anObject.Num}</span></p>`;
        msgBoard.appendChild(div);
    }
    else if (k === 0 && !(anObject.Name.includes('<') || anObject.Name.includes('>') || anObject.Name.includes('/'))) {
        const div = document.createElement('div');
        div.classList.add('messageFromServer');
        div.innerHTML = `<p>&#8605;  <span id="color-message-span1"style="text-shadow: 0 0 4px ${colors[anObject.id]};">${anObject.Name}</span><span id="color-message-span2"> entered the game</span></p>`;
        msgBoard.appendChild(div);
    }
    else if (k === 3) {
        const div = document.createElement('div');
        div.classList.add('messageFromServer');
        div.innerHTML = `<span id="color-message-span2" style="text-shadow: 0 0 4px ${colors[myid]};">${anObject}!!</span>`
        msgBoard.appendChild(div);
    }
    else if (k === 4) {
        const div = document.createElement('div');
        div.classList.add('messageFromServer');
        div.innerHTML = `<p><span id="color-message-span2">Its </span><span id="color-message-span1"style="text-shadow: 0 0 4px ${colors[anObject.id]};">${anObject.Name}</span><span id="color-message-span2"> chance!!</span></p>`
        msgBoard.appendChild(div);
    }

    else if (k === 5) {
        const div = document.createElement('div');
        div.classList.add('messageFromServer');
        div.innerHTML = `<span id="color-message-span2" style="text-shadow: 0 0 4px ${colors[anObject.id]};">${anObject.msg}!!</span>`
        msgBoard.appendChild(div);
    }

    else if (k === 6) {
        const div = document.createElement('div');
        div.classList.add('messageFromServer');
        div.innerHTML = `<p>&#8605;  <span id="color-message-span1"style="text-shadow: 0 0 4px ${colors[anObject.id]};">${anObject.Name}</span><span id="color-message-span2"> just left the game</span></p>`;
        msgBoard.appendChild(div);
    }
    msgBoard.scrollTop = msgBoard.scrollHeight - msgBoard.clientHeight;
};

//button disabling-enabling
function styleButton(k) {
    if (k === 0) {
        disableDice();
    } else if (k === 1) {
        enableDice();
    }
}

function shouldAutoMove(playerId, diceNum) {
    let validMoves = [];
    // Check each piece of the player
    for (let i = 0; i < 4; i++) {
        let piece = PLAYERS[playerId].myPieces[i];
        // Case 1: Regular move
        if (piece.pos > -1 && piece.pos + diceNum <= 56) {
            validMoves.push(i);
        }
        // Case 2: Moving out of home with a 6
        else if (diceNum === 6 && piece.pos === -1) {
            validMoves.push(i);
        }
    }
    // If exactly one valid move exists, return that piece's index
    if (validMoves.length === 1) {
        return validMoves[0];
    }
    return -1; // No auto-move possible
}

// Modify diceAction function to properly handle timeout during token selection
function diceAction() {
    socket.emit('roll-dice', { room: room_code, id: myid }, function (num) {
        console.log('Dice rolled, got', num);
        console.log("roll-dice function called !!!!!!! room:", room_code, "id:", myid,"socket.io called 5...");

        if (turnTimedOut) {
            console.log('Turn already timed out - ignoring dice roll');
            return;
        }

        if (num === 6) {
            PLAYERS[myid].consecutiveSixes++;
            if (PLAYERS[myid].consecutiveSixes === 3) {
                PLAYERS[myid].consecutiveSixes = 0;
                socket.emit('chance', { room: room_code, nxt_id: chanceRotation(myid, 0) });
                console.log("chance function called !!!!!!! room:", room_code, "nxt_id:", nxt_id,"socket.io called 6...");
                outputMessage({ msg: 'Three consecutive sixes - turn skipped!', id: myid }, 5);
                return;
            }
        } else {
            PLAYERS[myid].consecutiveSixes = 0;
        }

        if (!PLAYERS[myid].canMove(num)) {
            clearInterval(turnTimer);
            document.getElementById('timer-display').style.display = 'none';
            socket.emit('chance', { room: room_code, nxt_id: chanceRotation(myid, 0) });
            console.log("chance function called !!!!!!! room:", room_code, "nxt_id:socket.io called 7...");
            return;
        }

        const autoMovePiece = shouldAutoMove(myid, num);
        if (autoMovePiece !== -1) {
            let playerObj = { room: room_code, id: myid, num: num, pid: autoMovePiece };
            socket.emit('random', playerObj, function (data) {
                console.log("random function called !!!!!!! room:", room_code, "id:", myid, "num:", num, "pid:", autoMovePiece, "socket.io called 8...");
                clearInterval(turnTimer);
                document.getElementById('timer-display').style.display = 'none';
                styleButton(0);
            });
            return;
        }

        let spirit = [];
        for (let i = 0; i < 4; i++) {
            if (PLAYERS[myid].myPieces[i].pos > -1 && PLAYERS[myid].myPieces[i].pos + num <= 56) {
                spirit.push(i);
            }
        }

        if (spirit.length !== 0 || num === 6) {
            outputMessage('Click on a piece', 3);
            
            // Store the click handler function so we can remove it later
            const clickHandler = function(e) {
                // Immediately check if turn has timed out
                if (turnTimeLeft <= 0 || turnTimedOut) {
                    console.log('Turn timed out - removing click handler and ignoring click');
                    canvas.removeEventListener('click', clickHandler);
                    return;
                }

                let Xp = e.clientX - e.target.getBoundingClientRect().left;
                let Yp = e.clientY - e.target.getBoundingClientRect().top;
                let playerObj = { room: room_code, id: myid, num: num };
                let alert1 = true;

                for (let i = 0; i < 4; i++) {
                    if (Xp - PLAYERS[myid].myPieces[i].x < 45 && Xp - PLAYERS[myid].myPieces[i].x > 0 && 
                        Yp - PLAYERS[myid].myPieces[i].y < 45 && Yp - PLAYERS[myid].myPieces[i].y > 0) {
                        if ((spirit.includes(i) || num === 6) && PLAYERS[myid].myPieces[i].pos + num <= 56) {
                            // Double check timer hasn't expired
                            if (turnTimeLeft <= 0 || turnTimedOut) {
                                console.log('Turn timed out during token selection - move cancelled');
                                canvas.removeEventListener('click', clickHandler);
                                return;
                            }
                            
                            playerObj['pid'] = i;
                            socket.emit('random', playerObj, function (data) {
                                console.log("random function called !!!!!!! room:", playerObj,"socket.io called 9...");
                                clearInterval(turnTimer);
                                document.getElementById('timer-display').style.display = 'none';
                                styleButton(0);
                            });
                            canvas.removeEventListener('click', clickHandler);
                            return;
                        } else {
                            alert('Please click on a valid Piece.');
                            alert1 = false;
                            break;
                        }
                    }
                }
                if (alert1) { alert('You need to click on a piece of your color'); }
            };

            canvas.addEventListener('click', clickHandler);
            
            // Add a cleanup function to the timer that removes the click handler
            const originalTimer = turnTimer; // Store reference to current timer
            const timerCleanup = setInterval(() => {
                if (turnTimeLeft <= 0 || turnTimedOut || turnTimer !== originalTimer) {
                    console.log('Cleaning up click handler due to timeout or turn end');
                    canvas.removeEventListener('click', clickHandler);
                    clearInterval(timerCleanup);
                }
            }, 100); // Check frequently for timeout
            
        } else {
            clearInterval(turnTimer);
            document.getElementById('timer-display').style.display = 'none';
            socket.emit('chance', { room: room_code, nxt_id: chanceRotation(myid, num) });
            console.log("chance function called !!!!!!! room:", room_code, "nxt_id:", nxt_id,"socket.io called 10...");
        }
    });
}

//Initialise the game with the one who created the room.
function StartTheGame() {
    MYROOM.forEach(function (numb) {
        numb == myid ? outputMessage({ Name: 'You', id: numb }, 0) : outputMessage({ Name: USERNAMES[numb], id: numb }, 0)
    });
    document.getElementById('my-name').innerHTML += USERNAMES[myid]; console.log(myid); //my-name
    let copyText = `\n\nMy room:\n${window.location.href} \nor join the room via\nMy room code:${room_code}`
    document.getElementById('copy').innerHTML += copyText;
    createTimerDisplay();
    createDice();
    
    // Show initial waiting message if not enough players
    if (MYROOM.length < MIN_PLAYERS) {
        outputMessage({ 
            msg: `Waiting for at least one more player to join...`, 
            id: myid 
        }, 5);
    } else {
        // Start countdown if we already have enough players
        startGameCountdown();
    }
    
    loadAllPieces();
    createScoreboard();
}

//Load all the images of the pieces
function loadAllPieces() {
    let cnt = 0;
    for (let i = 0; i < colors.length; i++) {
        let img = new Image();
        img.src = "../images/pieces/" + colors[i] + ".png";
        img.onload = () => {
            ++cnt;
            if (cnt >= colors.length) {
                //all images are loaded
                for (let j = 0; j < MYROOM.length; j++) {
                    PLAYERS[MYROOM[j]] = new Player(MYROOM[j]);
                }
                if (window.localStorage.getItem('room') == room_code) {
                    console.log('19/6/21 yes my localStorage is for this room');
                    if (window.localStorage.getItem('started') == 'true') {
                        console.log('19/6/21 yes i from this room');
                        chance = Number(window.localStorage.getItem('chance'));
                        let positions = JSON.parse(window.localStorage.getItem('positions'));
                        let win = JSON.parse(window.localStorage.getItem('win'));
                        for (let i = 0; i < MYROOM.length; i++) {
                            PLAYERS[MYROOM[i]].win = Number(MYROOM[i]);
                            for (let j = 0; j < 4; j++) {
                                console.log('19/6/21 yes room==room_code && started==true:i,j:', i, j);
                                PLAYERS[MYROOM[i]].myPieces[j].x = Number(positions[MYROOM[i]][j].x);
                                PLAYERS[MYROOM[i]].myPieces[j].y = Number(positions[MYROOM[i]][j].y);
                                PLAYERS[MYROOM[i]].myPieces[j].pos = Number(positions[MYROOM[i]][j].pos);
                            }
                        }
                        allPlayerHandler();
                    } else { allPlayerHandler(); }
                } else {
                    window.localStorage.clear();
                    window.localStorage.setItem('room', room_code);
                    allPlayerHandler();
                }
            }
        }
        PIECES.push(img);
    }
}

//rotate chance, required for the game
function chanceRotation(id, num) {
    // First check for extra turn from killing or reaching home
    if (window.PLAYERS[id] && window.PLAYERS[id].extraTurn) {
        window.PLAYERS[id].extraTurn = false;
        console.log(`Player ${id} is using their extra turn.`);
        return id;
    }

    // Then check for rolling a 6 with valid moves
    // Only give another turn if it's not the third consecutive six
    if (num === 6 && window.PLAYERS[id].consecutiveSixes < 3 && window.PLAYERS[id].canMove(6)) {
        console.log('Player gets another turn for rolling 6:', id);
        return id;
    }

    // Find the current player's index in MYROOM
    let currentIndex = MYROOM.indexOf(Number(id));
    if (currentIndex === -1) {
        console.error('Current player not found in MYROOM:', id);
        return MYROOM[0]; // Fallback to first player
    }

    // Calculate next player's index
    let nextIndex = (currentIndex + 1) % MYROOM.length;
    let nextPlayer = MYROOM[nextIndex];

    console.log('Turn rotation:', {
        currentPlayer: id,
        currentIndex: currentIndex,
        nextIndex: nextIndex,
        nextPlayer: nextPlayer,
        MYROOM: MYROOM
    });

    return nextPlayer;
}

//draws 4 x 4 = 16 pieces per call
function allPlayerHandler() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < Object.keys(PLAYERS).length; i++) {
        PLAYERS[MYROOM[i]].draw();
    }
    //Store chance, all 16 pos
    //a boolean, for if this function has been called atleast once
    let positions = {}
    let win = {}
    for (let i = 0; i < MYROOM.length; i++) {
        positions[MYROOM[i]] = {}
        win[MYROOM[i]] = PLAYERS[MYROOM[i]].win
        for (let j = 0; j < 4; j++) {
            positions[MYROOM[i]][j] = {
                x: PLAYERS[MYROOM[i]].myPieces[j].x,
                y: PLAYERS[MYROOM[i]].myPieces[j].y,
                pos: PLAYERS[MYROOM[i]].myPieces[j].pos
            };
        }
    }
    window.localStorage.setItem('started', 'true');
    window.localStorage.setItem('chance', chance.toString());
    window.localStorage.setItem('positions', JSON.stringify(positions));
    window.localStorage.setItem('win', JSON.stringify(win));
    updateScoreboard();
}

//Load a new Player instance
function loadNewPiece(id) {
    PLAYERS[id] = new Player(id);
    if (window.localStorage.getItem('room') == room_code) {
        console.log('19/6/21 yes I\'m from our room');
        if (window.localStorage.getItem('started')) {
            //chance = Number(window.localStorage.getItem('chance'));
            console.log('19/6/21 yes i have already started the game');
            let positions = JSON.parse(window.localStorage.getItem('positions'));
            let win = JSON.parse(window.localStorage.getItem('win'));
            if (positions[id]) {
                console.log(`yes I have some data for user of id: ${id} in my local storage\nIt is ${positions[id]}`);
                PLAYERS[id].win = Number(win[id]);
                for (let j = 0; j < 4; j++) {
                    console.log(`19/6/21 for ${id},${j}\nx:${Number(positions[id][j].x)}\ny:${Number(positions[id][j].y)}\npos:${Number(positions[id][j].pos)}`);
                    PLAYERS[id].myPieces[j].x = Number(positions[id][j].x);
                    PLAYERS[id].myPieces[j].y = Number(positions[id][j].y);
                    PLAYERS[id].myPieces[j].pos = Number(positions[id][j].pos);
                }
            }
        }
    }
    allPlayerHandler();
}

function iKill(id, pid) {
    let boss = PLAYERS[id].myPieces[pid];
    console.log('ikill() function called');
    
    // Check if boss piece is in a safe tile
    if (inAhomeTile(id, pid)) {
        console.log('Piece is in a safe tile - cannot kill');
        return 0;
    }

    if (tableType === 'timer') {
        // Timer game mode: Multiple tokens can be killed
        let killCount = 0;
        
        // For each player
        for (let i = 0; i < MYROOM.length; i++) {
            if (MYROOM[i] == id) continue; // Skip self
            
            // Check all pieces of the target player
            for (let j = 0; j < 4; j++) {
                let targetPiece = PLAYERS[MYROOM[i]].myPieces[j];
                if (boss.x == targetPiece.x && boss.y == targetPiece.y) {
                    // Kill the piece
                    targetPiece.kill();
                    killCount++;
                    console.log(`Killed piece ${j} of player ${MYROOM[i]}`);
                }
            }
        }
        
        return killCount > 0 ? 1 : 0;
        
    } else {
        // Classic game mode: Blockade rules apply
        // For each player
        for (let i = 0; i < MYROOM.length; i++) {
            if (MYROOM[i] == id) continue; // Skip self
            
            // Count how many pieces the target player has at this position
            let targetPiecesCount = 0;
            let piecesToKill = [];
            
            // Check all pieces of the target player
            for (let j = 0; j < 4; j++) {
                let targetPiece = PLAYERS[MYROOM[i]].myPieces[j];
                if (boss.x == targetPiece.x && boss.y == targetPiece.y) {
                    targetPiecesCount++;
                    piecesToKill.push(j);
                }
            }

            // If pieces found at this position
            if (targetPiecesCount > 0) {
                if (targetPiecesCount === 1) {
                    // Only one piece - it can be killed
                    let killedPiece = PLAYERS[MYROOM[i]].myPieces[piecesToKill[0]];                
                    killedPiece.kill();
                    console.log(`Killed single piece ${piecesToKill[0]} of player ${MYROOM[i]}`);
                    return 1;
                } else {
                    // Multiple pieces form a blockade - cannot be killed
                    console.log(`Found ${targetPiecesCount} pieces forming a blockade - cannot kill`);
                    return 0;
                }
            }
        }
    }
    
    console.log('No pieces to kill found');
    return 0;
}

function inAhomeTile(id, pid) {
    for (let i = 0; i < 4; i++) {
        if ((PLAYERS[id].myPieces[pid].x == homeTilePos[i][0].x && 
             PLAYERS[id].myPieces[pid].y == homeTilePos[i][0].y) || 
            (PLAYERS[id].myPieces[pid].x == homeTilePos[i][1].x && 
             PLAYERS[id].myPieces[pid].y == homeTilePos[i][1].y)) {
            return true;
        }
    }
    return false;
}

function showModal(id) {
    window.localStorage.clear();
    document.getElementById("myModal-1").style.display = "block";
    let rankings = getPlayerRankings();
    
    // Determine if this is a timeout win or regular win
    let winnerText = '';
    if (tableType === 'timer') {
        winnerText = `Game Over!\n\n${USERNAMES[id]} wins!\n\nFinal Scores:\n`;
    } else {
        winnerText = `The winner is ${USERNAMES[id]}\n\nFinal Scores:\n`;
    }
    
    rankings.forEach((player, index) => {
        winnerText += `${index + 1}. ${player.name}: ${player.points} points\n`;
    });
    document.getElementById("win-win").innerHTML = winnerText;
}

function showWinner(id) {
    window.localStorage.clear();
    document.getElementById("myModal-1").style.display = "block";
    // Determine if this is a timeout win or regular win
    let winnerText = '';
    if (tableType === 'timer') {
        winnerText = `Game Over!\n\n${USERNAMES[id]} wins!\n\n`;
    } else {
        winnerText = `${USERNAMES[removedPlayer]} has been removed for inactivity.\n\n${USERNAMES[winnerId]} wins!\n`;
    }
    document.getElementById("win-win").innerHTML = winnerText;
}

async function copyhandler() {
    var copyText = document.getElementById("copy").innerHTML;
    await navigator.clipboard.writeText(copyText);

    var tooltip = document.getElementById("myTooltip");
    tooltip.innerHTML = "Copied!!";
}

// These functions appear to be unused and can be commented out
function outFunc() {
    var tooltip = document.getElementById("myTooltip");
    tooltip.innerHTML = "Copy to clipboard";
}

async function copyhandlerLink() {
    var copyText = window.location.href;
    await navigator.clipboard.writeText(copyText);

    var tooltip = document.getElementById("myTooltipLink");
    tooltip.innerHTML = "Copied!!";
}

function outFuncLink() {
    var tooltip = document.getElementById("myTooltipLink");
    tooltip.innerHTML = "Copy room link to clipboard";
}

function resumeHandler(id) {
    document.getElementById("myModal-2").style.display = "block";
    //who left+timer!
    let theOneWhoLeft = document.getElementById('theOneWhoLeft');
    let seconds = document.getElementById('seconds');
    let i = 10
    theOneWhoLeft.innerHTML = USERNAMES[id]
    theOneWhoLeft.style.textShadow = `0 0 4px ${colors[id]}`;
    document.getElementById('RESUME').onclick = function () {
        resume(id);
        socket.emit('resume', {
            room: room_code,
            id: id,
            click: myid
        }, function () {
            console.log("resume function called !!!!!!! room:", room_code, "id:", id, "click:", myid, "socket.io called 11...");
            outputMessage({ id: myid, msg: `You have resumed the game without ${USERNAMES[id]}` }, 5);
            if (chance == id) {
                socket.emit('chance', { room: room_code, nxt_id: chanceRotation(id, 0) });
                console.log('chance function called !!!!!!! { room: room_code, nxt_id: chanceRotation(id, 0) }socket.io called 11...')
            }
        });

    };
    document.getElementById('WAIT').onclick = function () {
        wait();
        socket.emit('wait', {
            room: room_code,
            click: myid
        }, function () {
            console.log("wait function called !!!!!!! room:", room_code, "click:", myid, "socket.io called 12...");
            outputMessage({ id: myid, msg: `You have decided to wait` }, 5)
        });

    };

    
    window.timer = setInterval(function () {
        i -= 1;
        seconds.innerHTML = ` in ${i}`;
        if (i == 0) {
            resume(id);
            socket.emit('resume', {
                room: room_code,
                id: id,
                click: id
            }, function () {
                console.log("resume function called !!!!!!! room:", room_code, "id:", id, "click:", id, "socket.io called 13...");
                outputMessage({ id: id, msg: `Resumed the game without ${USERNAMES[id]}` }, 5);
                if (chance == id) {
                    socket.emit('chance', { room: room_code, nxt_id: chanceRotation(id, 0) });
                    console.log("chance function called !!!!!!! room:", room_code, "nxt_id:", nxt_id, "socket.io called 14...");
                }
            });

        }
    }, 1000)
}

function resume(id) {
    document.getElementById("myModal-2").style.display = "none";
    clearInterval(timer);
    MYROOM.splice(id, 1);
    delete PLAYERS[id];
    delete playerSkippedTurns[id]; // Clean up skipped turns counter
    allPlayerHandler();
}

function wait() {
    clearInterval(timer);
    document.getElementById('seconds').innerHTML = '';
    let butt = document.getElementById('WAIT');
    butt.disabled = true;
    butt.style.opacity = 0.6;
    butt.style.cursor = "not-allowed"
}

function getPlayerRankings() {
    let rankings = Object.values(PLAYERS)
        .map(player => ({
            id: player.id,
            points: player.points,
            name: USERNAMES[player.id]
        }))
        .sort((a, b) => b.points - a.points);
    
    console.log("Current Rankings:");
    rankings.forEach((player, index) => {
        console.log(`${index + 1}. ${player.name}: ${player.points} points`);
    });
    
    return rankings;
}

// Add after canvas initialization
function createScoreboard() {
    const scoreboard = document.createElement('div');
    scoreboard.id = 'scoreboard';
    scoreboard.style.cssText = `
        position: fixed;
        top: 260px;  /* Moved below turn timer (140px + 100px height + 20px gap) */
        left: 20px;  /* Aligned with turn timer on the left */
        background: rgba(255, 255, 255, 0.95);
        color: #000;
        padding: 15px;
        border-radius: 8px;
        font-family: Arial, sans-serif;
        font-size: 16px;
        z-index: 999;
        width: 200px;
        height: 100px;
        text-align: center;
        border: 1px solid #e1e1e1;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        overflow-y: auto;
    `;
    document.body.appendChild(scoreboard);
    updateScoreboard();
}

function updateScoreboard() {
    const scoreboard = document.getElementById('scoreboard');
    if (!scoreboard) return;

    let rankings = getPlayerRankings();
    let scoreHTML = `
        <div style="font-size: 14px; color: #666; margin-bottom: 5px;">Current Scores</div>
    `;
    
    rankings.forEach((player, index) => {
        scoreHTML += `
            <div style="
                color: ${colors[player.id]}; 
                margin: 2px 0;
                font-size: 14px;
                font-weight: ${chance === Number(player.id) ? 'bold' : 'normal'};
                text-shadow: 1px 1px 1px rgba(0,0,0,0.1);
            ">
                ${player.name}: ${player.points}
                ${chance === Number(player.id) ? ' ←' : ''}
            </div>
        `;
    });
    
    scoreboard.innerHTML = scoreHTML;
}

// Add function to create and update the timer display
function createTimerDisplay() {
    // First check if timer display already exists
    if (document.getElementById('timer-display')) {
        return;
    }

    const timerDisplay = document.createElement('div');
    timerDisplay.id = 'timer-display';
    timerDisplay.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        background: rgba(255, 255, 255, 0.95);
        color: #000;
        padding: 15px;
        border-radius: 8px;
        font-family: Arial, sans-serif;
        font-size: 16px;
        z-index: 999;
        width: 200px;
        height: 100px;
        text-align: center;
        border: 1px solid #e1e1e1;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    `;
    document.body.appendChild(timerDisplay);
}

// Add function to start/reset timer
function startTurnTimer() {
    if (turnTimer) {
        clearInterval(turnTimer);
    }
    
    turnTimeLeft = TURN_TIME_LIMIT;
    turnTimedOut = false;
    const timerDisplay = document.getElementById('timer-display');
    timerDisplay.style.display = 'block';
    
    if (!(chance in playerSkippedTurns)) {
        playerSkippedTurns[chance] = 0;
    }
    
    function updateTimerDisplay() {
        const timerDisplay = document.getElementById('timer-display');
        if (!timerDisplay) return;

        const currentPlayer = USERNAMES[chance];
        const remainingTurns = MAX_SKIPPED_TURNS - playerSkippedTurns[chance];
        
        timerDisplay.innerHTML = `
            <div style="font-size: 14px; color: #666;">Current Turn</div>
            <div style="color: ${colors[chance]}; font-weight: bold; margin: 4px 0; text-shadow: 1px 1px 1px rgba(0,0,0,0.1);">
                ${currentPlayer}
            </div>
            <div style="font-size: 28px; font-weight: bold; color: #000; margin: 2px 0;">
                ${turnTimeLeft}s
            </div>
            <div style="font-size: 12px; color: #666; margin-top: 4px;">
                ${remainingTurns === 1 
                    ? '<span style="color: #ff4444; font-weight: bold;">Last Turn!</span>'
                    : `Turns before removal: ${remainingTurns}`
                }
            </div>
        `;

        // Add warning styles when time is running low
        if (turnTimeLeft <= 5) {
            timerDisplay.style.background = 'rgba(255, 220, 220, 0.95)';
            timerDisplay.style.borderColor = '#ff4444';
        } else {
            timerDisplay.style.background = 'rgba(255, 255, 255, 0.95)';
            timerDisplay.style.borderColor = '#e1e1e1';
        }
    }
    
    updateTimerDisplay();
    
    turnTimer = setInterval(() => {
        turnTimeLeft--;
        updateTimerDisplay();
        
        if (turnTimeLeft <= 0) {
            clearInterval(turnTimer);
            turnTimedOut = true;
            
            if (chance === myid) {
                styleButton(0);
                
                playerSkippedTurns[chance]++;
                const remainingTurns = MAX_SKIPPED_TURNS - playerSkippedTurns[chance];
                
                if (playerSkippedTurns[chance] >= MAX_SKIPPED_TURNS && tableType === 'timer') {
                    // For timer mode, handle player removal after 3 skips
                    const activePlayers = Object.keys(PLAYERS).length;
                    if (activePlayers === 2) {
                        // Find the other player who will win by default
                        const winnerId = Object.keys(PLAYERS).find(id => Number(id) !== chance);
                        // Emit timeout winner event to all players
                        socket.emit('timeoutWinner', {
                            room: room_code,
                            winnerId: winnerId,
                            removedPlayer: chance,
                            reason: 'skipped_turns'
                        });
                    } else if (activePlayers > 2) {
                        socket.emit('resume', {
                            room: room_code,
                            id: chance,
                            click: chance
                        });
                        
                        outputMessage({ 
                            msg: `${USERNAMES[chance]} has been removed for reaching ${MAX_SKIPPED_TURNS} skipped turns`, 
                            id: chance 
                        }, 5);
                        
                        const nextPlayer = chanceRotation(chance, 0);
                        socket.emit('chance', { 
                            room: room_code, 
                            nxt_id: nextPlayer 
                        });
                    }
                } else {
                    // Normal turn skip handling
                    const nextPlayer = chanceRotation(chance, 0);
                    socket.emit('chance', { 
                        room: room_code, 
                        nxt_id: nextPlayer
                    });
                    outputMessage({ 
                        msg: `${USERNAMES[chance]}'s turn was skipped (${remainingTurns} ${remainingTurns === 1 ? 'turn' : 'turns'} remaining)`, 
                        id: chance 
                    }, 5);
                }
            }
        }
    }, 1000);
}

// Update the socket listener for timeoutWinner
socket.on('timeoutWinner', (data) => {
    const { winnerId, removedPlayer, reason } = data;
    
    // First emit WON event to trigger all winning logic
    socket.emit('WON', {
        room: room_code,
        id: winnerId,
        player: removedPlayer,
        reason: reason
    });
    clearInterval(timerInterval);
    gameTimer = document.getElementById('game-timer');
    gameTimer.remove();
    
    showWinner(winnerId);
    
    // Display appropriate message based on reason
    // const message = reason === 'skipped_turns' 
    //     ? `${USERNAMES[removedPlayer]} has been removed for skipping ${MAX_SKIPPED_TURNS} turns. ${USERNAMES[winnerId]} wins!`
    //     : `${USERNAMES[removedPlayer]} has been removed for inactivity. ${USERNAMES[winnerId]} wins!`;
    
    // outputMessage({ 
    //     msg: message, 
    //     id: removedPlayer 
    // }, 5);
    
    // Remove the inactive player
    socket.emit('resume', {
        room: room_code,
        id: removedPlayer,
        click: removedPlayer
    });
});

// Add new function to handle game start countdown
function startGameCountdown() {
    // Don't start another countdown if one is already running
    if (gameStartTimer || gameStarted) {
        return;
    }

    // Create game start countdown display
    const startTimerDisplay = document.createElement('div');
    startTimerDisplay.id = 'start-timer-display';
    startTimerDisplay.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 20px 40px;
        border-radius: 10px;
        font-size: 24px;
        font-weight: bold;
        text-align: center;
        z-index: 1000;
    `;
    document.body.appendChild(startTimerDisplay);

    // Start the countdown
    gameStartDelay = 5;
    styleButton(0); // Disable controls during countdown

    function updateStartTimer() {
        startTimerDisplay.innerHTML = `
            <div>Game starting in</div>
            <div style="font-size: 36px; margin: 10px 0;">${gameStartDelay}</div>
            <div>seconds</div>
            <div style="font-size: 16px; margin-top: 10px;">${MYROOM.length} players joined</div>
        `;
    }

    updateStartTimer();
    
    gameStartTimer = setInterval(() => {
        gameStartDelay--;
        updateStartTimer();
        
        if (gameStartDelay <= 0) {
            clearInterval(gameStartTimer);
            document.body.removeChild(startTimerDisplay);
            
            // Emit start-game event when countdown ends
            if (MYROOM.indexOf(Number(myid)) === 0) {
                socket.emit('start-game', { room: room_code });
            }
        }
    }, 1000);
}

// Add these new functions for dice handling
function createDice() {
    // Remove existing button and dice if they exist
    const oldButton = document.querySelector('#randomButt');
    if (oldButton) oldButton.remove();
    
    const oldDice = document.querySelector('#dice');
    if (oldDice) oldDice.remove();

    const dice = document.createElement('div');
    dice.id = 'dice';
    dice.innerHTML = '⚅'; // Default dice face (6)
    dice.style.cssText = `
        width: 80px;
        height: 80px;
        background: white;
        border: 2px solid #333;
        border-radius: 10px;
        position: fixed;
        bottom: 20px;
        left: 20px;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 50px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        z-index: 9999;
    `;

    // Add click event listener directly to dice
    dice.addEventListener('click', function(event) {
        event.preventDefault();
        if (this.classList.contains('disabled')) {
            console.log('Dice is disabled - ignoring click');
            return;
        }
        if (chance !== myid) {
            console.log('Not your turn - ignoring click');
            return;
        }
        console.log('Dice clicked - executing diceAction');
        disableDice();
        diceAction();
    });

    document.body.appendChild(dice);
    console.log('Dice created and added to body with click handler');

    disableDice();
}

function enableDice() {
    const dice = document.querySelector('#dice');
    if (!dice) return;
    dice.classList.remove('disabled');
    dice.style.opacity = '1';
    dice.style.cursor = 'pointer';
    dice.style.backgroundColor = 'white';
    dice.style.transform = 'scale(1.05)'; // Slight scale up to indicate it's active
    dice.style.boxShadow = '0 6px 12px rgba(0,0,0,0.3)'; // Enhanced shadow when active
}

function disableDice() {
    const dice = document.querySelector('#dice');
    if (!dice) return;
    dice.classList.add('disabled');
    dice.style.opacity = '0.5';
    dice.style.cursor = 'not-allowed';
    dice.style.backgroundColor = '#f0f0f0';
    dice.style.transform = 'scale(1)'; // Return to normal scale
    dice.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)'; // Normal shadow when disabled
}

// Add these functions to handle game timer display

function createGameTimer() {
    if (tableType !== 'timer') {
        console.log('Skipping timer creation for classic mode');
        return null;
    }
    
    if (document.getElementById('game-timer')) {
        console.log('Timer already exists');
        return null;
    }

    const gameTimer = document.createElement('div');
    gameTimer.id = 'game-timer';
    gameTimer.style.cssText = `
        position: fixed;
        top: 140px;
        left: 20px;
        background: rgba(255, 255, 255, 0.95);
        color: #000;
        padding: 15px;
        border-radius: 8px;
        font-family: Arial, sans-serif;
        font-size: 16px;
        z-index: 999;
        width: 200px;
        height: 100px;
        text-align: center;
        border: 1px solid #e1e1e1;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    `;
    document.body.appendChild(gameTimer);
}

function updateGameTimer(endTime) {
    if (tableType !== 'timer') {
        console.log('Skipping timer update for classic mode');
        return;
    }

    const gameTimer = document.getElementById('game-timer');
    if (!gameTimer) {
        console.log('No timer element found');
        return;
    }

     timerInterval = setInterval(() => {
        const now = Date.now();
        const timeLeft = endTime - now;

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            gameTimer.innerHTML = `
                <div style="font-size: 14px; color: #666;">Game Time</div>
                <div style="font-size: 28px; font-weight: bold; color: #ff4444; margin: 10px 0;">
                    Time's Up!
                </div>
            `;
            gameTimer.style.background = 'rgba(255, 220, 220, 0.95)';
            gameTimer.style.borderColor = '#ff4444';

            // Disable all game controls
            styleButton(0);
            if (turnTimer) {
                clearInterval(turnTimer);
                document.getElementById('timer-display').style.display = 'none';
            }
            return;
        }

        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        
        gameTimer.innerHTML = `
            <div style="font-size: 14px; color: #666;">Game Time</div>
            <div style="font-size: 28px; font-weight: bold; color: #000; margin: 10px 0;">
                ${minutes}:${seconds.toString().padStart(2, '0')}
            </div>
            <div style="font-size: 12px; color: #666;">
                Time Remaining
            </div>
        `;

        // Add warning styles when time is running low (last 30 seconds)
        if (timeLeft <= 30000) {
            gameTimer.style.background = 'rgba(255, 220, 220, 0.95)';
            gameTimer.style.borderColor = '#ff4444';
        }
    }, 1000);
}

// Add socket listener for game-ended event
socket.on('game-ended', (data) => {
    const { winnerId, reason } = data;
    console.log('Game ended:', { winnerId, reason });

    // Clear any active timers
    if (turnTimer) {
        clearInterval(turnTimer);
        document.getElementById('timer-display').style.display = 'none';
    }

    // Disable controls
    styleButton(0);

    // Show winner modal with final scores
    if (reason === 'timeout') {
        let rankings = getPlayerRankings();
        let winnerText = `Game Over - Time's Up!\n\n${USERNAMES[winnerId]} wins!\n\nFinal Scores:\n`;
        rankings.forEach((player, index) => {
            winnerText += `${index + 1}. ${player.name}: ${player.points} points\n`;
        });

        // Show the modal with winner information
        const modal = document.getElementById("myModal-1");
        modal.style.display = "block";
        document.getElementById("win-win").innerHTML = winnerText;

        // Clear local storage
        window.localStorage.clear();
    }

    // Remove game timer display if it exists
    const gameTimer = document.getElementById('game-timer');
    if (gameTimer) {
        gameTimer.remove();
    }
});

