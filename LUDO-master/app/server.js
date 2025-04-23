const { join } = require('path');
const express = require('express');
const { createServer } = require('http');
const socketIO = require('socket.io');
const Table = require('./models/ludo_table');
const User = require("./models/user_table");

require('dotenv').config({ path: '../.env' });
const { PORT } = require('./config/config');
const connectDB = require('./config/dbConfig');

const rootRouter = require('./routes/rootRouter');
const ludoRouter = require('./routes/ludoRouter');

let { rooms, NumberOfMembers, win } = require('./models/model');
const { table } = require('console');

const GAME_DURATION = 3 * 60 * 1000;
let gameTimers = {};
const tables = {};

const app = express(); 
const server = createServer(app);
const io = socketIO(server, {
    cors: {
        origin: '*'
    }
});

app.use(express.static(join(__dirname, 'public/')));
app.use(express.urlencoded({ extended: true }));
app.enable('trust proxy');
connectDB();

// app.get('/', (req, res) => {
//     res.send('MongoDB Connection Test: Server is running!');
// });
async function turnTimeTimer() {
    try {
        const turnTimer = await Table.findOne({ _id: '67a2035ab8e46a3f546d3074' });
        console.log("Fetched Tables:", turnTimer);
        return turnTimer;
    } catch (error) {
        console.error("Error fetching data:", error);
        return null;
    }
}

async function fetchTables(timerId) {
    console.log('table type id', timerId);
    try {
        const tableType = await Table.findOne({ _id: timerId });
        console.log("Fetched tableType:", tableType.table_type);
        return tableType.table_type;
    } catch (error) {
        console.error("Error fetching data:", error);
        return null;
    }
}

//
///sockets
//
let nsp = io.of('/ludo');

nsp.on('connection', (socket) => {
    console.log('A User has connected to the game');
    socket.on('fetch', (data, cb) => {
        console.log('fetch function called !!!!!!!!!!', data, 'socket.io called 1...')
        try {
            console.log('room_code 1 -->',data);
            // data = "67a2035ab8e46a3f546d3074";
            let member_id = generate_member_id(socket.id, data);
            console.log('room_code 2 -->',data);
            socket.join(data);
            if (member_id !== -1) {
                cb(Object.keys(rooms[data]), member_id);
                socket.to(data).emit('new-user-joined', { id: member_id });
                console.log('fetch function called new-user-joined --> sent', { id: member_id }, 'socket.io called 1...')
                console.log('new one is join', { id: member_id });
            } else {
                console.log('There is someone with m_id = -1');
            }
        }
        catch (err) {
            if (err.name === 'TypeError') {
                socket.emit('imposter');
            }
            console.log("ERROR TO CONNECT A USER TO THE GAME! ", err, rooms);
        }
    });

    socket.on('roll-dice', (data, cb) => {
        console.log('roll-dice function called !!!!!!!!!!', data, ' socket.io called 2...')
        console.log('roll-dice function called !!!!!!!!!! cb --> ', cb)
        if (rooms[data.room] && rooms[data.room][data.id]) {
            rooms[data.room][data.id]['num'] = Math.floor((Math.random() * 6) + 1);
            data['num'] = rooms[data.room][data.id]['num']
            console.log('Generated random number between 1 to 6:', rooms[data.room][data.id]['num']);
            console.log("data sent in roll-dice --> ", data, ' socket.io called 2...');
            nsp.to(data.room).emit('rolled-dice', data);
            cb(rooms[data.room][data.id]['num']);
            console.log('room id:', data.room, 'user id:', data.id)
        }
    })

    socket.on('start-game', async (data) => {
        let room = data.room;
        console.log(`Game started in room: ${room}`);

        // First fetch the table type
        const tableType = await fetchTables(timerId);
        console.log("Table type for game:", tableType);

        // Only set up timer if table type is 'timer'
        if (tableType == 'timer') {
            let startTime = Date.now();
            let endTime = startTime + GAME_DURATION;

            // Store game start time for synchronization
            gameTimers[room] = { timer: null, endTime: endTime };

            // Start the game timer
            console.log("inside Condition --> ")
            gameTimers[room].timer = setTimeout(async () => {
                let data = await endGame(room);
                console.log('game-ended function called !!!!!!!!!! -->', data)
                nsp.to(room).emit('game-ended', {
                    winnerId: data?.winnerId,
                    reason: 'timeout'
                });

                // Trigger winner logic
                nsp.to(room).emit('winner', data?.winnerId);

            }, GAME_DURATION);
            console.log("outside Condition --> ")

            // Notify players about the start time and table type
            nsp.to(room).emit('game-started', { endTime, tableType });
        } else {
            // For classic mode, just emit game started without timer
            console.log("inside else Condition --> ")
            nsp.to(room).emit('game-started', { tableType });
        }
    });

    socket.on('get-table-data', async (data, cb) => {
        let turnTimer = await turnTimeTimer();
        let turn = turnTimer.turn_timer;
        console.log("Data for get-table-data: ", turnTimer);
        if (cb) {
            cb(turn, socket.id);
        }
    });

    socket.on("updated_chips", (data) => {
        console.log("Received data:", data);
        joinTable(socket, io, data); 
    });

    const timerId = '67a2035ab8e46a3f546d3074';
    const timerId2 = '67a20021b8e46a3f546d3073';

    socket.on('table-type', async (data, cb) => {
        let tableType = await fetchTables(timerId);
        console.log("Data for table-type: ", tableType);

        if (cb) {
            cb(tableType, socket.id);
        }
    });

    socket.on('chance', (data) => {
        console.log('chance function called !!!!!!!!!!', data)
        if (rooms[data.room]) {
            nsp.to(data.room).emit('is-it-your-chance', data.nxt_id, ' socket.io called 3...');
            console.log('is-it-your-chance function called !!!!!!!!!!', data.nxt_id, 'data.room', data.room, 'socket.io called 3...')
        }
    });

    function iKill(id, pid) {
        let boss = PLAYERS[id].myPieces[pid];
        console.log('ikill() function called ')

        // Check if boss piece is in a safe tile
        if (inAhomeTile(id, pid)) {
            return 0;
        }

        // For each player
        for (let i = 0; i < MYROOM.length; i++) {
            if (MYROOM[i] == id) continue; // Skip self

            // Count how many pieces this player has at boss's position
            let piecesAtPosition = 0;
            let piecesToKill = [];

            for (let j = 0; j < 4; j++) {
                if (boss.x == PLAYERS[MYROOM[i]].myPieces[j].x &&
                    boss.y == PLAYERS[MYROOM[i]].myPieces[j].y) {
                    piecesAtPosition++;
                    piecesToKill.push(j);
                }
            }

            // If there are pieces to kill
            if (piecesAtPosition > 0) {
                // Kill all pieces at that position
                for (let pieceId of piecesToKill) {
                    PLAYERS[MYROOM[i]].myPieces[pieceId].kill();
                    console.log(`Killed piece ${pieceId} of player ${MYROOM[i]}`);
                }
                console.log('ikill() function return 1')
                return 1;
            }
        }

        console.log('ikill() function return 0')
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

    socket.on('random', (playerObj, cb) => {
        console.log('random function called !!', playerObj, 'socket.io called 4...')
        if (!rooms[playerObj.room] || !rooms[playerObj.room][playerObj.id]) {
            console.log('random function called !!!!!!!!!!', playerObj.room, playerObj.id, 'playerObj', playerObj, 'socket.io called 4...')
            return;
        }

        if (playerObj['num'] != rooms[playerObj.room][playerObj.id]['num']) {
            console.log('Someone is trying to cheat!');
            return;
        }

        playerObj['num'] = rooms[playerObj.room][playerObj.id]['num'];
        nsp.to(playerObj.room).emit('Thrown-dice', playerObj);

        console.log('random function called !!!!Thrown-dice --> sent', playerObj, 'socket.io called 4...')
        console.log('Thrown-dice function called !!!!!!!!!!', playerObj.room, playerObj.id, 'playerObj', playerObj)
        cb(playerObj['num']);

        // Pass turn to next active player
        let players = Object.keys(rooms[playerObj.room]).sort(); // Ensure consistent order
        let currentIndex = players.indexOf(playerObj.id);
        let nextPlayerId = players[(currentIndex + 1) % players.length];

        console.log("Next player:", nextPlayerId);
        nsp.to(playerObj.room).emit('is-it-your-chance', nextPlayerId);

        console.log('random function called !!!!! is-it-your-chance--> sent', nextPlayerId, 'data.room', playerObj.room, ' socket.io called 4...')
    });

    socket.on('timeoutWinner', async (data) => {
        console.log('Timeout winner declared:', data);
        let tableType = await fetchTables(timerId);
        console.log("Data for table-type --> --> : ", tableType);
        if (tableType == "timer") {
            console.log("Timer mode detected. Clearing timeout.");
            clearTimeout(gameTimers[data.room].timer);
        }
        // Broadcast the timeout winner to all players in the room
        nsp.to(data.room).emit('timeoutWinner', {
            winnerId: data.winnerId,
            removedPlayer: data.removedPlayer
        });
    });

    socket.on('WON', (OBJ) => {
        console.log('WON function called !!!!!!!!!!', OBJ, 'socket.io called 5...');

        // Add a check for timeout win
        const isTimeoutWin = OBJ.hasOwnProperty('timeoutWin');

        if (isTimeoutWin || validateWinner(OBJ, socket)) {
            delete win[OBJ.room];
            delete NumberOfMembers[OBJ.room];
            if (rooms[OBJ.room]) {
                delete rooms[OBJ.room];
            }
            nsp.to(OBJ.room).emit('winner', OBJ.id);
            console.log('winner function called !!!!!!!!!!', OBJ.id, 'data.room', OBJ.room, ' socket.io called 5...');
        }
    });

    socket.on('resume', (data, cb) => {
        console.log('resume function called !!!!!!!!!!', data, 'socket.io called 6...')
        socket.to(data.room).emit('resume', data);
        console.log('resume function sent data -->', data.room, ' socket.io called 6...')
        if (NumberOfMembers[data.room]) {
            NumberOfMembers[data.room].members = Math.max(2, NumberOfMembers[data.room].members - 1);
            NumberOfMembers[data.room].constant = true;
        }
        // Only call callback if it exists
        if (typeof cb === 'function') {
            cb();
        }
    });

    socket.on('wait', (data, cb) => {
        console.log('wait function called !!!!!!!!!!', data, 'socket.io called 7...')
        socket.to(data.room).emit('wait', data);
        console.log('wait function sent data -->', data.room, ' socket.io called 7...')
        // Only call callback if it exists
        if (typeof cb === 'function') {
            cb();
        }
    });

    socket.on('disconnect', () => {
        console.log('disconnect function called !!!!!!!!!!', 'socket.io called 8...')
        let roomKey = deleteThisid(socket.id);
        if (roomKey && rooms[roomKey.room]) {
            console.log('Player left with player id:', roomKey.key);
            socket.to(roomKey.room).emit('user-disconnected', roomKey.key);
            console.log('user-disconnected function called !!!!!!!!!!', roomKey.key, 'data.room', roomKey.room)
            console.log('Number of members in room:', roomKey.room, ':', NumberOfMembers[roomKey.room] ? NumberOfMembers[roomKey.room].members : 0);
            if (NumberOfMembers[roomKey.room]) {
                NumberOfMembers[roomKey.room].members--;
                if (NumberOfMembers[roomKey.room].members >= 2) {
                    let players = Object.keys(rooms[roomKey.room]).sort();
                    let currentIndex = players.indexOf(roomKey.key);
                    let nextPlayerId = players[(currentIndex + 1) % players.length];
                    nsp.to(roomKey.room).emit('is-it-your-chance', nextPlayerId);
                    console.log('is-it-your-chance function data', nextPlayerId, 'data.room', roomKey.room)
                }
            }
        }
        console.log('A player disconnected');
    });
});

//
///CUSTOM FUNCTIONS
//

function generate_member_id(s_id, rc) {
    console.log("s_id --> ", s_id)
    console.log("rc --> ", rc)
    let m_id = Math.floor(Math.random() * 4);
    console.log('generate_member_id function called !!!!!!!!!!')
    console.log("rooms --> ", rooms)
    let m_r = Object.keys(rooms[rc]);
    if (m_r.length <= 4) {
        if (m_r.includes(m_id.toString())) {
            return generate_member_id(s_id, rc)
        } else {
            rooms[rc][m_id] = { sid: s_id, num: 0 };
            return m_id;
        }
    } else {
        return -1;
    }
}

function deleteThisid(id) {
    for (var roomcd in rooms) {
        console.log('deleteThisid function called !!!!!!!!!!')

        if (rooms.hasOwnProperty(roomcd)) {
            ky = Object.keys(rooms[roomcd]).find(key => rooms[roomcd][key]['sid'] == id);
            if (typeof (ky) === 'string') {
                delete rooms[roomcd][ky];
                return { key: ky, room: roomcd };
            }
            // Only delete room if no players remain
            if (Object.keys(rooms[roomcd]).length == 0) {
                delete rooms[roomcd];
                return undefined;
            }
        }
    }

}

function validateWinner(OBJ, socket) {
    if (!win[OBJ.room]) {
        win[OBJ.room] = {};
    }

    win[OBJ.room][OBJ.player] = { o: OBJ, s: socket.id };

    // Adjust validation for remaining players
    let activePlayers = Object.keys(rooms[OBJ.room]).length;
    if (Object.keys(win[OBJ.room]).length == activePlayers) {
        let winnerValid = true;
        let firstWinnerId = null;

        Object.keys(win[OBJ.room]).forEach(playerId => {
            if (!rooms[OBJ.room][playerId] ||
                win[OBJ.room][playerId]['s'] != rooms[OBJ.room][playerId]['sid']) {
                winnerValid = false;
            }

            if (firstWinnerId === null) {
                firstWinnerId = win[OBJ.room][playerId]['o'].id;
            } else if (win[OBJ.room][playerId]['o'].id !== firstWinnerId) {
                winnerValid = false;
            }
        });

        return winnerValid;
    }
    return false;
}


//
///Routes management
//

app.use('/', rootRouter);
app.use('/ludo', ludoRouter);
app.use(function (req, res) {
    res.statusCode = 404;
    res.end('404!');
});

server.listen(PORT, () => {
    console.log(`The server has started working on http://localhost:${PORT}`);
});

// Modify the endGame function to check table type
async function endGame(room) {
    if (!rooms[room]) return;

    // Find winner based on points
    let highestPoints = -1;
    let winnerId = null;

    Object.keys(rooms[room]).forEach(playerId => {
        const playerPoints = rooms[room][playerId].points || 0;
        if (playerPoints > highestPoints) {
            highestPoints = playerPoints;
            winnerId = playerId;
        }
    });

    // In case of a tie, winner is the player who moved furthest
    if (winnerId === null) {
        let furthestProgress = -1;
        Object.keys(rooms[room]).forEach(playerId => {
            const progress = calculatePlayerProgress(room, playerId);
            if (progress > furthestProgress) {
                furthestProgress = progress;
                winnerId = playerId;
            }
        });
    }

    // Cleanup
    if (gameTimers[room] && gameTimers[room].timer) {
        clearTimeout(gameTimers[room].timer);
    }
    delete gameTimers[room];
    delete rooms[room];
    delete win[room];
    delete NumberOfMembers[room];

    return { winnerId, highestPoints }
}

// Helper function to calculate player progress
function calculatePlayerProgress(room, playerId) {
    if (!rooms[room] || !rooms[room][playerId]) return 0;

    let totalProgress = 0;
    const player = rooms[room][playerId];

    // Sum up the positions of all pieces
    if (player.myPieces) {
        Object.values(player.myPieces).forEach(piece => {
            totalProgress += piece.pos || 0;
        });
    }

    return totalProgress;
}


async function fetchTableData(tableId) {
    console.log('table data', tableId);
    try {
        const tabledata = await Table.findOne({ _id: tableId });
        console.log("Fetched table data:", tableId);
        return tabledata;
    } catch (error) {
        console.error("Error fetching data:", error);
        return null;
    }
}

async function fetchUserTableData(userId) {
    console.log('user data', userId);
    try {
        const userdata = await User.findOne({ _id: userId });
        console.log("Fetched user table data:", userId);
        return userdata;
    } catch (error) {
        console.error("Error fetching user table data:", error);
        return null;
    }
}

async function joinTable(socket, io, data) {
    const { tableId, userId } = data;
    
    try {
        let tabledata = await fetchTableData(tableId);
        let userdata = await fetchUserTableData(userId);
        console.log('user table data ----->', userdata);
        console.log(' table data ----->', tabledata);

        if (!tabledata) {
            socket.emit("join_failed", { message: "Table not found." });
            return;
        }
        //let userdata = await User.findOne({ _id: userId });

        console.log('user table chips ----->', userdata.chips);
        if (userdata.chips >= tabledata.entry_fee) {
            userdata.chips -= tabledata.entry_fee;

            // const updatedTable = await Table.findByIdAndUpdate(
            //     userId, 
            //     { $set: { chips: userdata.chips } }, 
            //     { new: true }
            // );
            userdata.save();
            console.log('user table chips ----->', userdata.chips);
            // if (!updatedTable) {
                socket.emit("join_failed", { message: "Failed to update table data." });
                return;
            // }

            socket.emit("join_success", { message: "Successfully joined table.", table: updatedTable });
            io.to(tableId).emit("player_joined", { tableId, userdata });
        } else {
            socket.emit("join_failed", { message: "Not enough chips to join." });
        }
    } catch (error) {
        console.error("Error joining table:", error);
        socket.emit("join_failed", { message: "Error joining table." });
    }
}


