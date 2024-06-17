const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "http://localhost:3005",
        methods: ["GET", "POST"]
    }
});

app.use(cors({
    origin: 'http://localhost:3005'
}));

let users = {};
let turnOrder = [];
let currentTurnIndex = 0;
let connectionTimes = [];
// let showClicks = false;
let showCards = false;
let dealerId = null;
let pot = 0;
let currentBet = 0;
let communityCards = [];
let gameState = 'waiting'; // can be 'waiting', 'pre-flop', 'flop', 'turn', 'river', 'showdown'

const suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const getDeck = () => {
    let deck = [];
    for (let suit of suits) {
        for (let value of values) {
            deck.push(`${suit} ${value}`);
        }
    }
    return deck;
};

const shuffleDeck = (deck) => {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
};

const dealCards = (deck, num) => {
    return deck.splice(-num, num);
};

const dealHoleCards = (deck) => {
    turnOrder.forEach(userId => {
        users[userId].cards = [deck.pop(), deck.pop()];
    });
};

const dealCommunityCards = (deck, num) => {
    communityCards.push(...dealCards(deck, num));
};

const updateHost = () => {
    if (connectionTimes.length > 0) {
        const hostId = connectionTimes[0].id;
        users[hostId].name = `${users[hostId].name.split(' (HOST)')[0]} (HOST)`;
        dealerId = hostId;
    }
};

const nextPhase = () => {
    switch (gameState) {
        case 'waiting':
            gameState = 'pre-flop';
            dealHoleCards(deck);
            break;
        case 'pre-flop':
            gameState = 'flop';
            dealCommunityCards(deck, 3);
            break;
        case 'flop':
            gameState = 'turn';
            dealCommunityCards(deck, 1);
            break;
        case 'turn':
            gameState = 'river';
            dealCommunityCards(deck, 1);
            break;
        case 'river':
            gameState = 'showdown';
            determineWinner();
            break;
        default:
    }
    io.emit('gameState', { gameState, communityCards, pot, currentBet });
};

const switchTurnToNextPlayer = () => {
    let nextTurnIndex = (currentTurnIndex + 1) % turnOrder.length;
    while (users[turnOrder[nextTurnIndex]].folded) {
        nextTurnIndex = (nextTurnIndex + 1) % turnOrder.length;
        if (nextTurnIndex === currentTurnIndex) break; // All remaining players have folded, end the round
    }
    currentTurnIndex = nextTurnIndex;
    io.emit('updateTurn', turnOrder[currentTurnIndex]);
};

const determineWinner = () => {
    // Determine the winner (placeholder logic)
    const remainingPlayers = turnOrder.filter(userId => !users[userId].folded);
    const winnerId = remainingPlayers[Math.floor(Math.random() * remainingPlayers.length)];
    
    users[winnerId].money += pot; // Add pot to winner's money

    // Reset game state for next round
    gameState = 'waiting';
    pot = 0;
    currentBet = 0;
    communityCards = [];
    turnOrder.forEach(userId => {
        users[userId].folded = false;
        users[userId].bet = 0;
    }); // Reset folded status and bets for all users
    deck = shuffleDeck(getDeck());
    io.emit('gameState', { gameState, communityCards, pot, currentBet });
    io.emit('updateUsers', users);
};

let deck = shuffleDeck(getDeck());

io.on('connection', (socket) => {
    console.log('New user connected:', socket.id);

    socket.on('join', (username) => {
        users[socket.id] = { id: socket.id, name: username, cards: [], bet: 0, folded: false, money: 100 };
        turnOrder.push(socket.id);
        connectionTimes.push({ id: socket.id, time: Date.now() });
        updateHost();
        io.emit('updateUsers', users);
        io.emit('updateTurn', turnOrder[currentTurnIndex]);
        io.emit('updateDealer', dealerId);
        socket.emit('setUserId', socket.id);
        // socket.emit('setShowClicks', showClicks);
        socket.emit('setShowCards', showCards);
    });

    socket.on('action', ({ action, amount }) => {
        if (turnOrder[currentTurnIndex] === socket.id) {
            if (action === 'Fold') {
                users[socket.id].folded = true;
            } else if (action === 'Bet') {
                users[socket.id].bet = amount;
                users[socket.id].money -= amount; // Subtract the bet amount from the user's money
                pot += parseInt(amount);
                currentBet = parseInt(amount);
            }
            console.log(`User ${socket.id} performed action: ${action} with amount: ${amount || ''}`);
            switchTurnToNextPlayer();
            io.emit('updateUsers', users);
            io.emit('updateTurn', turnOrder[currentTurnIndex]);
        }
    });

    // socket.on('showClicks', () => {
    //     if (connectionTimes[0].id === socket.id) {
    //         showClicks = !showClicks;
    //         io.emit('setShowClicks', showClicks);
    //     }
    // });

    socket.on('showCards', () => {
        if (connectionTimes[0].id === socket.id) {
            showCards = !showCards;
            io.emit('setShowCards', showCards);
        }
    });

    socket.on('deal', () => {
        if (socket.id === dealerId) {
            nextPhase();
            io.emit('updateUsers', users);
            switchTurnToNextPlayer();
            io.emit('updateTurn', turnOrder[currentTurnIndex]);
        }
    });

    socket.on('chooseDealer', (newDealerId) => {
        if (connectionTimes[0].id === socket.id) {
            dealerId = newDealerId;
            io.emit('updateDealer', dealerId);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        delete users[socket.id];
        turnOrder = turnOrder.filter(id => id !== socket.id);
        connectionTimes = connectionTimes.filter(user => user.id !== socket.id);
        if (currentTurnIndex >= turnOrder.length) currentTurnIndex = 0;
        updateHost();
        io.emit('updateUsers', users);
        io.emit('updateTurn', turnOrder[currentTurnIndex]);
        io.emit('updateDealer', dealerId);
    });
});

server.listen(3000, () => {
    console.log('Server is running on port 3000');
});
