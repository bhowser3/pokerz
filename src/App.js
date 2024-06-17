import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

const socket = io('http://localhost:3000');

function App() {
    const [users, setUsers] = useState({});
    const [currentTurn, setCurrentTurn] = useState(null);
    const [username, setUsername] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userId, setUserId] = useState(null);
    const [showClicks, setShowClicks] = useState(false);
    const [showCards, setShowCards] = useState(false);
    const [dealerId, setDealerId] = useState(null);
    const [betAmount, setBetAmount] = useState('');
    const [gameState, setGameState] = useState('waiting');
    const [communityCards, setCommunityCards] = useState([]);
    const [pot, setPot] = useState(0);
    const [currentBet, setCurrentBet] = useState(0);

    useEffect(() => {
        socket.on('updateUsers', (updatedUsers) => {
            setUsers(updatedUsers);
        });

        socket.on('updateTurn', (turnUserId) => {
            setCurrentTurn(turnUserId);
        });

        socket.on('setUserId', (id) => {
            setUserId(id);
        });

        socket.on('setShowClicks', (show) => {
            setShowClicks(show);
        });

        socket.on('setShowCards', (show) => {
            setShowCards(show);
        });

        socket.on('updateDealer', (dealerId) => {
            setDealerId(dealerId);
        });

        socket.on('gameState', ({ gameState, communityCards, pot, currentBet }) => {
            setGameState(gameState);
            setCommunityCards(communityCards);
            setPot(pot);
            setCurrentBet(currentBet);
        });

        return () => {
            socket.off('updateUsers');
            socket.off('updateTurn');
            socket.off('setUserId');
            socket.off('setShowClicks');
            socket.off('setShowCards');
            socket.off('updateDealer');
            socket.off('gameState');
        };
    }, []);

    const handleAction = (action) => {
        const amount = action === 'Bet' ? betAmount : null;
        socket.emit('action', { action, amount });
    };

    const handleLogin = (e) => {
        e.preventDefault();
        if (username.trim()) {
            socket.emit('join', username);
            setIsLoggedIn(true);
        }
    };

    const handleShowCards = () => {
        socket.emit('showCards');
    };

    const handleDeal = () => {
        socket.emit('deal');
    };

    const handleChooseDealer = (e) => {
        const newDealerId = e.target.value;
        socket.emit('chooseDealer', newDealerId);
    };

    const cardPrettyDisplay = (card) => {
      if(card.includes("Hearts")){
        return (
          <div className='card'>
            <img 
              src="https://images.emojiterra.com/google/android-11/128px/2665.png" 
              alt="Hearts" 
              width="15" height="15"
            >
            </img>
            {card.split(' ')[1]}
          </div>
        );
      }else if(card.includes("Diamonds")){
        return (
          <div className='card'>
            <img 
              src="https://images.emojiterra.com/google/android-11/128px/2666.png"
              alt="Diamonds" 
              width="15" height="15"
            >
            </img>
            {card.split(' ')[1]}
          </div>
        );
      }else if(card.includes("Clubs")){
        return (
          <div className='card'>
            <img 
              src="https://images.emojiterra.com/google/android-11/128px/2663.png" 
              alt="Clubs" 
              width="15" height="15"
            >
            </img>
            {card.split(' ')[1]}
          </div>
        );
      }else if(card.includes("Spades")){
        return (
          <div className='card'>
            <img 
              src="https://images.emojiterra.com/google/android-11/128px/2660.png" 
              alt="Spades" 
              width="15" height="15"
            >
            </img>
            {card.split(' ')[1]}
          </div>
        );
      }
      return card
    }

    if (!isLoggedIn) {
        return (
            <div>
                <h1>Enter Your Username</h1>
                <form onSubmit={handleLogin}>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Username"
                    />
                    <button type="submit">Join</button>
                </form>
            </div>
        );
    }

    return (
        <div>
            <h1>Poker</h1><h4>{gameState}</h4>
            <div className='poker-table'>
              <div className='poker-players'>
                <ul>
                    {Object.values(users).map(user => (
                        <li key={user.id} style={{ textDecoration: user.folded ? 'line-through' : 'none' }}>
                            <div className='username-display'>{user.name} 
                              {currentTurn === user.id ? (
                                  user.id === userId ? ' (Your Turn)' : ' (Their Turn)'
                              ) : ''}
                            </div> 
                            <div>chip stack: ${user.money}</div>
                            <div>{user.bet > 0 && `Bet: $${user.bet}`}</div>
                            {showCards ? (
                                <div className='user-cards'>
                                    {user.cards.map((card, index) => (
                                        <div key={index}>{cardPrettyDisplay(card)}</div>
                                    ))}
                                </div>
                            ) : ''}
                        </li>
                    ))}
                </ul>
              </div>
              <div className='community-cards-container'>
                  <h4>Community Cards</h4>
                  <div className='community-cards'>
                      {communityCards.map((card, index) => (
                          <div key={index}>{cardPrettyDisplay(card)}</div>
                      ))}
                  </div>
                  <p>Pot: ${pot}</p>
                  <p>Current Bet: ${currentBet}</p>
              </div>
            </div>
            <div>
              <h4>My cards: </h4>
              {Object.values(users).map(user => (
                <>
                  {user.id === userId ? (
                        <div className='user-cards'>
                            {user.cards.map((card, index) => (
                                <div key={index}>{cardPrettyDisplay(card)}</div>
                            ))}
                        </div>
                  ) : ''}
                </>
              ))}
            </div>
            {userId === dealerId && (
                <button onClick={handleDeal}>{gameState === "waiting" ? "Deal" : 
                gameState === "pre-flop" ? "Deal Flop": 
                gameState === "flop" ? "Deal Turn": 
                gameState === "turn" ? "Deal River": 
                gameState === "river" ? "End" : "Deal"
                }</button>
            )}
            {currentTurn === userId && !users[userId]?.folded && (
                <div>
                    <button onClick={() => handleAction('Check')}>Check</button>
                    {/* <button onClick={() => handleAction('Fold')}>Fold</button> */}
                    {/* <button onClick={() => handleAction('Call')}>Call</button> */}
                    {/* <input
                        type="number"
                        value={betAmount}
                        onChange={(e) => setBetAmount(e.target.value)}
                        placeholder="Bet Amount"
                    /> */}
                    {/* <button onClick={() => handleAction('Bet')}>Bet</button> */}
                </div>
             )} 
            {users[userId]?.name.includes('(HOST)') && (
                <>
                    {/* <button onClick={handleShowCards}>{showCards ? 'Hide Cards' : 'Show Cards'}</button> */}
                    {/* <select onChange={handleChooseDealer} value={dealerId}>
                        {Object.values(users).map(user => (
                            <option key={user.id} value={user.id}>
                                {user.name}
                            </option>
                        ))}
                    </select> */}
                </>
            )}
        </div>
    );
}

export default App;
