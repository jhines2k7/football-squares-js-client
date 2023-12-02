let web3Provider;
let socket = null;
let contracts = {};
let accounts = [];
let web3 = null;
let gameIdH2 = null;
let playerIdH3 = null;
let gameNameH4 = null;
let GAME_ID = null;
let weekId = null;
let PLAYER = null;

let heartbeatInterval;

const domain = 'http://localhost:8000';

const router = new Navigo('/', { hash: true });

function createIdenticon(hashValue, size) {
  var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttributeNS(null, "width", size);
  svg.setAttributeNS(null, "height", size);
  svg.setAttributeNS(null, "data-jdenticon-value", hashValue);
  return svg;
}

function appendIdenticon(hashValue, size, targetElement) {
  var identicon = createIdenticon(hashValue, size);
  document.querySelector(targetElement).appendChild(identicon);
  jdenticon.update(identicon);
}

function getPlayerInfo() {
  // Check if a GUID already exists in the cookie
  let guid = document.cookie.split('; ').find(row => row.startsWith('guid='));

  // If a GUID exists, split the string to get the value
  if (guid) {
    guid = guid.split('=')[1];
  } else {
    // If a GUID doesn't exist, generate a new one
    guid = generateGUID();

    // Save the new GUID and level to the cookie
    // This cookie expires in 1 year
    let date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    document.cookie = `guid=${guid}; level=1; expires=${date.toUTCString()}; path=/`;
  }

  // Retrieve the level from the cookie
  let level = document.cookie.split('; ').find(row => row.startsWith('level='));
  if (level) {
    level = parseInt(level.split('=')[1]);
  } else {
    // If level doesn't exist, set it to 0
    level = 0;
  }

  return { guid, level };
}

function generateGUID() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
};

function clearGUIDCookie() {
  document.cookie = "guid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
}

function getCellPlayerId(cell) {
  return cell.firstChild.getAttribute('data-jdenticon-value');
}

function claimSquare(event) {
  // clearInterval(heartbeatInterval);
  const playerId = getPlayerInfo().guid;
  const row = event.currentTarget.getAttribute('data-row');
  const column = event.currentTarget.getAttribute('data-col');
  const gameId = event.currentTarget.getAttribute('data-game-id');
  const weekId = event.currentTarget.getAttribute('data-week-id');

  console.log('Clicked cell at row ' + row + ', col ' + column);

  const cell = selectTableCell(row, column);
  const square = { 
    id: `${row}${column}`,
    away_points: row, 
    home_points: column,
    player_id: playerId,
    game_id: gameId,
    week_id: weekId
  };

  // is cell already claimed?
  if (cell.innerHTML !== '') {
    // is cell claimed by current player?
    if (getCellPlayerId(cell) === getPlayerInfo().guid) {
      console.log(`Cell at row ${row}, column ${column} is already claimed by current player. Unclaiming square.`)
      // unclaim square
      unclaimSquare(square);
      unmarkSquare(square);
    }
    return;
  }

  explode(event);

  let identicon = createIdenticon(getPlayerInfo().guid, 50);

  event.target.appendChild(identicon);
  // event.target.removeEventListener('click', claimSquare);
  event.target.style.backgroundColor = 'yellow';

  // if (!heartbeatInterval) {
  //   heartbeatInterval = setInterval(function () {
  //     socket.emit('heartbeat', { player_id: playerId, ping: 'ping' })
  //   }, 20000); // Send heartbeat every 20 seconds
  // }
  // row-major order, which means the value of the row is the first digit, and the value of the column is the second digit
  socket.emit('claim_square', square);
}

function selectTableCell(dataRow, dataColumn) {
  return document.querySelector(`td[data-row='${dataRow}'][data-col='${dataColumn}']`);
}

function generateGamesList(games, ul) {
  console.log(`Generating games list: ${JSON.stringify(games)}`);
  ul.innerHTML = '';
  for (let i = 0; i < games.length; i++) {
    let a = document.createElement('a');
    a.setAttribute('href', `#game/${games[i].game_id}?week_id=${games[i].week_id}`);
    a.textContent = games[i].name;

    let li = document.createElement('li');
    li.appendChild(a);

    ul.appendChild(li);
  }
}

function joinGame(game) {
  console.log("Joining game with id: " + game.id);
  socket.emit('join_game', { week_id:game.week_id, game_id: game.id, player_level: getPlayerInfo().level, player_id: getPlayerInfo().guid });

  // create the squares grid
  var table = document.getElementById('squares-grid');

  // Outer loop to create rows
  for (var i = 0; i < 10; i++) {
    var row = document.createElement('tr');

    // Inner loop to create cells
    for (var j = 0; j < 10; j++) {
      var cell = document.createElement('td');

      // Set data attributes for row and column numbers
      cell.setAttribute('data-row', i);
      cell.setAttribute('data-col', j);
      cell.setAttribute('data-game-id', game.id);
      cell.setAttribute('data-week-id', game.week_id);

      cell.addEventListener('click', claimSquare);

      row.appendChild(cell);
    }

    // Add the row to the table
    table.appendChild(row);
  }
}

async function loadTemplate(name, element) {
  return fetch(`templates/${name}`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.text();
    })
    .then(data => {
      element.innerHTML = data;
    })
    .catch(error => {
      console.log('There has been a problem with your fetch operation: ', error);
    });
}

function registerSocketIOEventListeners() {
  socket.on('heartbeat_response', (data) => {
    console.log(`Heartbeat received: ${JSON.stringify(data)}`);
  });

  socket.on('game_not_found', (data) => {
    console.log(`Game not found: ${JSON.stringify(data)}`);
    router.navigate('');
  });

  socket.on('connected', (player) => {
    console.log(`Player info: ${player.id}`);
    // console.log(`Games list: ${JSON.stringify(data.games_list)}`);

    // const currentLocation = router.getCurrentLocation();
    // console.log(`Current route location: ${JSON.stringify(currentLocation)}`);

    // if (currentLocation.route.name === '#' || currentLocation.route.name === '') {
    //   loadGameList();
    // }
  });

  socket.on('game_joined', (game) => {
    console.log(`Game joined: ${JSON.stringify(game)}`);
    GAME_ID = game.id;

    // const game = data.game;

    let gameIdH2 = document.querySelector('#app h2 span');
    let gameNameH4 = document.querySelector('#app h4 span');

    gameIdH2.textContent = game.id;
    gameNameH4.textContent = game.name;

    let yourIdenticon = createIdenticon(getPlayerInfo().guid, 80);
    let yourIdenticonSpan = document.getElementById('your-identicon');
    yourIdenticonSpan.appendChild(yourIdenticon);

    // mark claimed squares
    const claimedSquares = game.claimed_squares;
    for (const claimedSquare in claimedSquares) {
      let [row, column] = claimedSquares[claimedSquare].id.split('');
      const cell = selectTableCell(row, column);
      let identicon = createIdenticon(claimedSquares[claimedSquare].player_id, 50);
      cell.appendChild(identicon);
      // cell.removeEventListener('click', claimSquare);
      cell.style.backgroundColor = 'yellow';
    }

    // display players
    const players = game.players;
    let playerList = document.getElementById('player-list');
    playerList.innerHTML = '';

    for (const id in players) {
      if (players[id] !== getPlayerInfo().guid) {
        let newPlayerLi = document.createElement('li');

        let identicon = createIdenticon(players[id], 50);
        newPlayerLi.appendChild(identicon);

        playerList.appendChild(newPlayerLi);
      }
    }
  });

  socket.on('square_claimed', (square) => {
    console.log(`Square claimed: ${JSON.stringify(square)}`);
    // get digits from square.id
    let [row, column] = square.id.split('');
    const cell = selectTableCell(row, column);

    let rect = cell.getBoundingClientRect();
    let xPosition = rect.left + window.scrollX;
    let yPosition = rect.top + window.scrollY;

    const event = {
      clientX: xPosition + 25,
      clientY: yPosition + 25
    };

    explode(event);

    let identicon = createIdenticon(square.player_id, 50);
    cell.appendChild(identicon);
    cell.removeEventListener('click', claimSquare);
    cell.style.backgroundColor = 'yellow';
  });

  socket.on('square_unclaimed', (square) => {
    console.log(`Square unclaimed: ${JSON.stringify(square)}`);
    unmarkSquare(square);
  });

  socket.on('new_player_joined', (data) => {
    console.log(`New player joined: ${JSON.stringify(data)}`);

    let playerList = document.getElementById('player-list');
    let newPlayerLi = document.createElement('li');
    newPlayerLi.classList.add('fade-in');

    let identicon = createIdenticon(data.player_id, 50);

    newPlayerLi.appendChild(identicon);
    playerList.appendChild(newPlayerLi);
  });

  socket.on('player_left_game', (data) => {
    if (data.game_id === GAME_ID) {
      console.log(`Player left game: ${JSON.stringify(data.player_id)}`);

      const unclaimedSquares = data.unclaimed_squares;

      let i = 1;
      for (let square in unclaimedSquares) {
        setTimeout(() => {
          unmarkSquare(unclaimedSquares[square]);
        }, i * 150);
        i++;
      }

      let playerList = document.getElementById('player-list');
      let players = playerList.getElementsByTagName('li');

      for (let i = 0; i < players.length; i++) {
        if (players[i].firstChild.getAttribute('data-jdenticon-value') === data.player_id) {
          setTimeout(() => {
            let rect = players[i].getBoundingClientRect();
            let xPosition = rect.left + window.scrollX;
            let yPosition = rect.top + window.scrollY;

            const event = {
              clientX: xPosition + 25,
              clientY: yPosition + 25
            };

            players[i].remove();
            explode(event);
          }, 1500);
        }
      }
    }
  });
}

function unmarkSquare(square) {
  console.log(`Unmarking square: ${JSON.stringify(square)}`);

  // let { row, column } = square;
  let cell = selectTableCell(square.away_points, square.home_points);

  let rect = cell.getBoundingClientRect();
  let xPosition = rect.left + window.scrollX;
  let yPosition = rect.top + window.scrollY;

  const event = {
    clientX: xPosition + 25,
    clientY: yPosition + 25
  };

  explode(event);

  cell.style.backgroundColor = 'white';
  cell.innerHTML = '';
  cell.addEventListener('click', claimSquare);
}

function unclaimSquare(square) {
  console.log(`Unclaiming square: ${JSON.stringify(square)}`);
  socket.emit('unclaim_square', {'square': square});
}

async function dollarsToEthereum(dollars) {
  try {
    const ethInUSD = await getEthereumPrice();
    let ethInUsd = dollars / ethInUSD;
    console.log(`The value of $${dollars} in ETH is: ${ethInUsd}`);
    return ethInUsd;
  } catch (err) {
    return console.log(err);
  }
}

async function getEthereumPrice() {
  return fetch(`${domain}/ethereum-price?game_id=${gameId}`)
    .then(response => response.json())
    .then(data => {
      console.log(`The gas oracle is ${data}`)
      return data;
    })
    .catch(error => {
      console.error(`Error: ${error}`);
    });
}

async function getGasOracle() {
  return fetch(`${domain}/gas-oracle?game_id=${gameId}`)
    .then(response => response.json())
    .then(data => {
      console.log(`Gas oracle: ${data.result}`)
      return data.result;
    })
    .catch(error => {
      console.error(`Error: ${error}`);
    });
}

async function loadContractABI() {
  return fetch(`${domain}/fs-contract-abi`)
    .then(response => response.json())
    .then(data => {
      // Use the loaded JSON data here
      console.log(`The RPSContract ABI is ${data.abi}`)
      return data;
    })
    .catch(error => {
      // Handle any potential errors
      console.error(`Error: ${error}`);
    });
}

async function loadGameList() {
  return fetch(`${domain}/games`)
    .then(response => response.json())
    .then(games => {
      generateGamesList(games, document.getElementById('games-list'));
    })
    .catch(error => {
      // Handle any potential errors
      console.error(`Error: ${error}`);
    });
}

document.addEventListener('DOMContentLoaded', () => {
  socket = io(domain,
    {
      transports: ['websocket'],
      query: {
        player_id: getPlayerInfo().guid,
      }
    });

  registerSocketIOEventListeners();

  router
    .on("/", (match) => {
      console.log(`Match value on home route: ${JSON.stringify(match)}`);
    }, {
      before(done) {
        (async () => {
          await loadTemplate("home.html", document.getElementById('app'));
          await loadGameList();
          done();
        })();
      }
    })
    .on("game/:gameId", (match) => {
      console.log(`Match value on game route: ${JSON.stringify(match)}`);

      const game = {
        id: match.data.gameId,
        week_id: match.params.week_id
      };

      joinGame(game);
    }, {
      before(done, match) {
        (async () => {
          await loadTemplate("game.html", document.getElementById('app'));

          let a = document.createElement('a');
          a.setAttribute('href', `/leave/${match.data.gameId}?week_id=${match.params.week_id}`);
          a.setAttribute('data-navigo', '')
          a.textContent = 'Leave Game';

          let nav = document.querySelector('#game-info .home');
          nav.appendChild(a);

          done();
        })();
      }
    })
    .on("leave/:gameId", (match) => {
      console.log(`Match value on leave route: ${JSON.stringify(match)}`);

      router.navigate('');
    }, {
      before(done, match) {
        socket.emit('leave_game', { 
          game_id: match.data.gameId, 
          player_id: getPlayerInfo().guid, 
          week_id: match.params.week_id,
          player_level: getPlayerInfo().level
        });
        GAME_ID = null;
        done();
      }
    })
    .resolve();
});
