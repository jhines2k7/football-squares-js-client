let web3Provider;
let socket = null;
let contracts = {};
let accounts = [];
let web3 = null;
let gameIdH2 = null;
let playerIdH3 = null;
let gameNameH4 = null;
let GAME_ID = null;
let PLAYER_CLAIMED_SQUARES = {};
let PLAYER_SQUARES_TO_UNCLAIM = {};
const GRADIENT_COLORS = generateColorGradient();
let CURRENT_COLOR_IDX = 0;
const USD_PER_SQUARE = 4.00
let CONTRACT_ADDRESS = "0x40c6019F6D7b3328c3d0d3B49DD661FAc07c26F6";
let PLAYER_NONCE = "";
let IDENTICON_SIZE = null;

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

function getPlayerId() {
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

  return guid;
}

function getPlayerNonce() {
  // Check if a nonce already exists in the cookie
  let nonce = document.cookie.split('; ').find(row => row.startsWith('nonce='));

  // If a nonce exists, split the string to get the value
  if (nonce) {
    nonce = nonce.split('=')[1];
  } else {
    // If a nonce doesn't exist, generate a new one
    nonce = web3.utils.randomHex(16);

    // Save the new nonce to the cookie
    // This cookie expires in 1 year
    let date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    document.cookie = `nonce=${nonce}; level=1; expires=${date.toUTCString()}; path=/`;
  }

  return nonce;
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

function clickSquare(event) {
  const playerId = getPlayerId();
  const row = event.currentTarget.getAttribute('data-row');
  const column = event.currentTarget.getAttribute('data-col');
  const gameId = event.currentTarget.getAttribute('data-game-id');
  const weekId = event.currentTarget.getAttribute('data-week-id');
  const paid = JSON.parse(event.currentTarget.getAttribute('data-paid'));

  const cell = selectTableCell(row, column);
  console.log(`Clicked cell at row: ${row}, col: ${column}`);

  const square = { 
    id: `${row}${column}`,
    away_points: column, 
    home_points: row,
    player_id: playerId,
    game_id: gameId,
    week_id: weekId,
    paid: paid,
  };

  console.log(`Square: ${JSON.stringify(square)}`);
  
  // is cell already claimed?
  if (cell.innerHTML !== '') {
    // is cell claimed by current player?
    if (getCellPlayerId(cell) === getPlayerId()) {
      console.log(`Cell at row ${row}, column ${column} is already marked by current player. Unclaiming square.`)
      // unclaim square
      unclaimSquare(square);
    }

    return;
  }

  PLAYER_CLAIMED_SQUARES[gameId].push(square.id);

  // add a new li to the beginning of the #your-squares list
  let markedSquaresUL = document.getElementById('marked-squares');

  let newSquareLi = document.createElement('li');
  newSquareLi.textContent = square.id;

  if(PLAYER_CLAIMED_SQUARES[gameId].length === 1) {
    let claimSquaresButton = document.createElement('button');
    claimSquaresButton.textContent = 'Claim Squares';
    claimSquaresButton.addEventListener('click', claimSquares);

    let claimButtonLI = document.createElement('li');
    claimButtonLI.appendChild(claimSquaresButton);
    markedSquaresUL.appendChild(claimButtonLI);
  }

  markedSquaresUL.insertBefore(newSquareLi, markedSquaresUL.firstChild);

  const rect = cell.getBoundingClientRect();
  const xPosition = rect.left + window.scrollX;
  const yPosition = rect.top + window.scrollY;

  const element = {
    clientX: xPosition + (IDENTICON_SIZE / 2),
    clientY: yPosition + (IDENTICON_SIZE / 2)
  };

  explode(element);

  let identicon = createIdenticon(getPlayerId(), IDENTICON_SIZE);

  event.target.appendChild(identicon);
  // console.log(`GRADIENT_COLOR: ${GRADIENT_COLORS[CURRENT_COLOR_IDX]}`);
  // event.target.style.backgroundColor = 'yellow';
  CURRENT_COLOR_IDX++;

  socket.emit('claim_square', square);
}

function unclaimSquare(square) {
  let cell = selectTableCell(square.home_points, square.away_points);

  // if(square.paid === true) {
  //   // remove square from PLAYER_SQUARES_TO_UNCLAIM
  //   const index = PLAYER_SQUARES_TO_UNCLAIM[square.game_id].findIndex(s => s === square.id);
  //   PLAYER_SQUARES_TO_UNCLAIM[square.game_id].splice(index, 1);

  //   // remove square from #unclaim-squares list
  //   let unclaimSquaresList = document.getElementById('squares-to-unclaim');
  //   let items = unclaimSquaresList.getElementsByTagName('li');
  //   for (li in items) {
  //     if (items[li].textContent === square.id) {
  //       items[li].remove();
  //     }
  //   }

  //   if(PLAYER_SQUARES_TO_UNCLAIM[square.game_id].length === 0) {
  //     unclaimSquaresList.innerHTML = '';
  //   }

  //   // cell.style.backgroundColor = 'green';
  // } else if(square.paid === true) {
  if(square.paid === true) {
    // add square to PLAYER_SQUARES_TO_UNCLAIM
    PLAYER_SQUARES_TO_UNCLAIM[square.game_id].push(square.id);
    
    // add a new li to the beginning of the #unclaim-squares list
    let unclaimSquaresUL = document.getElementById('squares-to-unclaim');

    if(PLAYER_SQUARES_TO_UNCLAIM[square.game_id].length === 1) {
      let unclaimSquaresButton = document.createElement('button');
      unclaimSquaresButton.textContent = 'Unclaim Squares';
      unclaimSquaresButton.addEventListener('click', unclaimSquares);

      let unclaimButtonLI = document.createElement('li');
      unclaimButtonLI.appendChild(unclaimSquaresButton);
      unclaimSquaresUL.appendChild(unclaimButtonLI);
    }

    let unclaimedSquareLI = document.createElement('li');
    unclaimedSquareLI.textContent = square.id;
    unclaimSquaresUL.insertBefore(unclaimedSquareLI, unclaimSquaresUL.firstChild);
  } else {
    const rect = cell.getBoundingClientRect();
    const xPosition = rect.left + window.scrollX;
    const yPosition = rect.top + window.scrollY;
  
    const element = {
      clientX: xPosition + (IDENTICON_SIZE / 2),
      clientY: yPosition + (IDENTICON_SIZE / 2)
    };
  
    // cell.addEventListener('click', clickSquare);

    cell.innerHTML = '';

    explode(element);

    // cell.style.backgroundColor = 'white';

    const index = PLAYER_CLAIMED_SQUARES[square.game_id].findIndex(s => s === square.id);
    console.log(`Index of square to unclaim: ${index}`);
    // get the square from the array
    const liToRemove = PLAYER_CLAIMED_SQUARES[square.game_id][index];
    console.log(`Removing square: ${JSON.stringify(liToRemove)}`);
    
    PLAYER_CLAIMED_SQUARES[square.game_id].splice(index, 1);

    let markedSquaresList = document.getElementById('marked-squares');

    if(PLAYER_CLAIMED_SQUARES[square.game_id].length === 0) {
      markedSquaresList.innerHTML = '';
    } else {
      // remove square from #marked-squares list
      let items = markedSquaresList.getElementsByTagName('li');
      for (li in items) {
        if (items[li].textContent === liToRemove) {
          items[li].remove();
        }
      }
    }

    console.log(`Unclaiming square: ${JSON.stringify(square)}`);
    socket.emit('unclaim_square', square);
  }
}

function difference(array1, array2) {
  return array1.filter(item => !array2.includes(item));
}

function unclaimSquares() {
  console.log(`Unclaiming squares: ${JSON.stringify(PLAYER_SQUARES_TO_UNCLAIM[GAME_ID])}`);

  (async () => {
    while (!window.ethereum) {
      console.log('Waiting for MetaMask...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Request access to user's MetaMask accounts
    await window.ethereum.request({ method: 'eth_requestAccounts' })

    web3 = new Web3(window.ethereum);

    // Use web3.js
    accounts = await web3.eth.getAccounts();

    console.log(`Your accounts: ${accounts}`);

    // Fetch the FootballSquare contract abi
    const contractABI = await loadContractABI();
    const contract = new web3.eth.Contract(contractABI.abi, web3.utils.toChecksumAddress(CONTRACT_ADDRESS));

    const nonce = await web3.eth.getTransactionCount(accounts[0]);
    console.log(`The nonce for your address is ${nonce}`);

    // Example usage:
    // const list1 = [1, 2, 3, 4, 5];
    // const list2 = [4, 5, 6, 7, 8];

    // const diff1to2 = difference(list1, list2); // [1, 2, 3]
    // const diff2to1 = difference(list2, list1); // [6, 7, 8]
    const diff = difference(PLAYER_CLAIMED_SQUARES[GAME_ID], PLAYER_SQUARES_TO_UNCLAIM[GAME_ID]);

    PLAYER_CLAIMED_SQUARES[GAME_ID] = [];
    PLAYER_CLAIMED_SQUARES[GAME_ID] = diff;

    const totalCostUSD = PLAYER_CLAIMED_SQUARES[GAME_ID].length * USD_PER_SQUARE;

    const playerMove = {
      'player_address': accounts[0],
      'game_id': GAME_ID,
      'claimed_squares': PLAYER_CLAIMED_SQUARES[GAME_ID],
      'total_cost_in_usd': totalCostUSD,
    }
    const playerMoveString = JSON.stringify(playerMove);

    PLAYER_NONCE = getPlayerNonce();
    console.log(`The playerMove as a string is ${playerMoveString + PLAYER_NONCE}`);

    const playerMoveHash = web3.utils.sha3(web3.utils.toHex(playerMoveString + PLAYER_NONCE), {encoding:"hex"});
    console.log(`The playerMoveHash is ${playerMoveHash}`);

    const encodedData = contract.methods.claimSquares(GAME_ID, accounts[0], playerMoveHash).encodeABI();
    const transaction = {
      'from': web3.utils.toChecksumAddress(accounts[0]),
      'to': web3.utils.toChecksumAddress(CONTRACT_ADDRESS),
      'value': '0x' + web3.utils.toBigInt(0).toString(16),
      'nonce': nonce,
      'data': encodedData,
    };

    try {
      const gasEstimate = await web3.eth.estimateGas(transaction);
      transaction['gas'] = gasEstimate;
      console.log(`The gas estimate is ${gasEstimate}`);
    } catch (error) {
      console.error(`Error estimating gas: ${error}`);
      
      handleWeb3Error(error, contractAddress);

      return;
    }

    const gasOracle = await getGasOracle();

    // socket.emit('paying_stake', {
    //   game_id: gameId,
    //   player_id: playerId,
    // });

    const maxPriorityFeePerGas = parseInt(gasOracle.FastGasPrice) - parseInt(gasOracle.suggestBaseFee);
    console.log(`The maxFeePerGas is ${maxPriorityFeePerGas}`);
    
    transaction['maxFeePerGas'] = web3.utils.toWei(gasOracle.SafeGasPrice, 'gwei');
    transaction['maxPriorityFeePerGas'] = web3.utils.toWei(maxPriorityFeePerGas.toString(), 'gwei');
    const txHash = web3.eth.sendTransaction(transaction);

    txHash.catch((error) => {
      console.error(JSON.stringify(error));

      handleWeb3Error(error, contractAddress);
    });

    txHash.on('transactionHash', function (hash) {
      let transactionStatusP = document.getElementById('transaction-status');
      transactionStatusP.innerText = 'Transaction hash received. Waiting for transaction to be mined...';
      transactionStatusP.classList.add('flashing');
      // Transaction hash received
      console.log(`The transaction hash is ${hash}`);
      // socket.emit('pay_stake_hash', {
      //   game_id: gameId,
      //   transaction_hash: hash,
      //   player_id: playerId,
      //   contract_address: contractAddress,
      // });
    });

    txHash.on('receipt', function (receipt) {
      let transactionStatusP = document.getElementById('transaction-status');
      transactionStatusP.innerText = 'Transaction receipt received. Transaction mined, waiting for confirmation...';
      // Transaction receipt received
      // console.log(`The receipt is ${receipt}`);
      // socket.emit('pay_stake_receipt', {
      //   game_id: gameId,
      //   player_id: playerId,
      //   address: accounts[0],
      //   contract_address: contractAddress,
      // });
    });

    txHash.on('confirmation', function (confirmation, receipt) {
      let transactionStatusP = document.getElementById('transaction-status');
      transactionStatusP.innerText = 'Transaction confirmed.';
      transactionStatusP.classList.remove('flashing');

      // set an unpaid property on each cell in PLAYER_UNCLAIMED_SQUARES[GAME_ID]
      for (let square in PLAYER_SQUARES_TO_UNCLAIM[GAME_ID]) {
        const currentSquare = PLAYER_SQUARES_TO_UNCLAIM[GAME_ID][square];
        let cell = selectTableCell(currentSquare.home_points, currentSquare.away_points);
        cell.setAttribute('data-paid', false);

        unclaimSquare(currentSquare);
      }

      // clear #squares-to-unclaim list
      let yourSquaresList = document.getElementById('squares-to-unclaim');
      yourSquaresList.innerHTML = '';

      socket.emit('unclaim_squares', { "squares_to_unclaim": PLAYER_SQUARES_TO_UNCLAIM[GAME_ID], "game_id": GAME_ID });
    });

    txHash.on('error', function (error) {
      // Transaction error occurred
      console.error(`An error occurred: ${error}`);
    });
  })();  
}

function handleWeb3Error(error, contractAddress) {
  let dappError = {}

  if (error.innerError) {
    dappError['error'] = error.innerError
  } else {
    dappError['error'] = error.error
  }

  // if (dappError.error.code === 4001) {
  //   console.error(dappError.error.message);
  //   // emit an event to the server to let the other player know you rejected the transaction
  //   socket.emit('contract_rejected', {
  //     game_id: gameId,
  //     player_id: getPlayerId(),
  //     contract_address: contractAddress,
  //     error: error
  //   });

  //   payStakeStatusP.innerText = "You decided not to accept the contract. Your opponent has been notified. " +
  //     "Refresh to start a new game.";

  //   payStakeStatusP.classList.remove('flashing');
  // }

  if (dappError.error.code === -32000) {
    console.error(dappError.error.message);

    socket.emit('insufficient_funds', {
      game_id: gameId,
      player_id: getPlayerId(),
      contract_address: contractAddress,
      error: error
    });

    payStakeStatusP.innerText = "Check your account balance. Your wallet may have insufficient funds for gas * price + value. This " +
      "is sometimes due to a sudden increase in gas prices on the network. We've notified your opponent. Try again " +
      "in a few minutes or refresh now to start a new game.";

    payStakeStatusP.style.color = 'red';
    payStakeStatusP.classList.remove('flashing');
  }

  if (dappError.error.code === -32603) {
    console.error(dappError.error.message);

    socket.emit('rpc_error', {
      game_id: gameId,
      player_id: getPlayerId(),
      contract_address: contractAddress,
      error: error
    });

    payStakeStatusP.innerText = "An Internal JSON-RPC error has occured. You may need to restart your MetaMask app. We've notified your opponent.";

    payStakeStatusP.style.color = 'red';
    payStakeStatusP.classList.remove('flashing');

    clearGUIDCookie();
  }
}

function claimSquares() {
  console.log(`Claiming squares: ${JSON.stringify(PLAYER_CLAIMED_SQUARES[GAME_ID])}`);
  (async () => {
    while (!window.ethereum) {
      console.log('Waiting for MetaMask...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Request access to user's MetaMask accounts
    await window.ethereum.request({ method: 'eth_requestAccounts' })

    web3 = new Web3(window.ethereum);

    // Use web3.js
    accounts = await web3.eth.getAccounts();

    console.log(`Your accounts: ${accounts}`);

    // Fetch the FootballSquare contract abi
    const contractABI = await loadContractABI();
    const contract = new web3.eth.Contract(contractABI.abi, web3.utils.toChecksumAddress(CONTRACT_ADDRESS));

    const nonce = await web3.eth.getTransactionCount(accounts[0]);
    console.log(`The nonce for your address is ${nonce}`);

    const totalCostUSD = PLAYER_CLAIMED_SQUARES[GAME_ID].length * USD_PER_SQUARE;
    let totalCostInEther = await dollarsToEthereum(totalCostUSD);
    console.log(`The total cost in Ether is ${totalCostInEther}`);
    const totalCostInWei = web3.utils.toWei(totalCostInEther.toString(), 'ether');
    console.log(`The total cost in Wei is ${totalCostInWei}`);

    const playerMove = {
      'player_address': accounts[0],
      'game_id': GAME_ID,
      'claimed_squares': PLAYER_CLAIMED_SQUARES[GAME_ID],
      'total_cost_in_usd': totalCostUSD,
    }
    const playerMoveString = JSON.stringify(playerMove);

    PLAYER_NONCE = getPlayerNonce();
    console.log(`The playerMove as a string is ${playerMoveString + PLAYER_NONCE}`);

    const playerMoveHash = web3.utils.sha3(web3.utils.toHex(playerMoveString + PLAYER_NONCE), {encoding:"hex"});
    console.log(`The playerMoveHash is ${playerMoveHash}`);

    const encodedData = contract.methods.claimSquares(GAME_ID, accounts[0], playerMoveHash).encodeABI();
    const transaction = {
      'from': web3.utils.toChecksumAddress(accounts[0]),
      'to': web3.utils.toChecksumAddress(CONTRACT_ADDRESS),
      'value': '0x' + web3.utils.toBigInt(totalCostInWei).toString(16),
      'nonce': nonce,
      'data': encodedData,
    };

    try {
      const gasEstimate = await web3.eth.estimateGas(transaction);
      transaction['gas'] = gasEstimate;
      console.log(`The gas estimate is ${gasEstimate}`);
    } catch (error) {
      console.error(`Error estimating gas: ${error}`);
      
      handleWeb3Error(error, CONTRACT_ADDRESS);

      return;
    }

    const gasOracle = await getGasOracle();

    // socket.emit('paying_stake', {
    //   game_id: gameId,
    //   player_id: playerId,
    // });

    const maxPriorityFeePerGas = parseInt(gasOracle.FastGasPrice) - parseInt(gasOracle.suggestBaseFee);
    console.log(`The maxFeePerGas is ${maxPriorityFeePerGas}`);
    
    transaction['maxFeePerGas'] = web3.utils.toWei(gasOracle.SafeGasPrice, 'gwei');
    transaction['maxPriorityFeePerGas'] = web3.utils.toWei(maxPriorityFeePerGas.toString(), 'gwei');
    const txHash = web3.eth.sendTransaction(transaction);

    txHash.catch((error) => {
      console.error(JSON.stringify(error));

      handleWeb3Error(error, CONTRACT_ADDRESS);
    });

    txHash.on('transactionHash', function (hash) {
      let transactionStatusP = document.getElementById('transaction-status');
      transactionStatusP.innerText = 'Transaction hash received. Waiting for transaction to be mined...';
      transactionStatusP.classList.add('flashing');
      // Transaction hash received
      console.log(`The transaction hash is ${hash}`);
      // socket.emit('pay_stake_hash', {
      //   game_id: gameId,
      //   transaction_hash: hash,
      //   player_id: playerId,
      //   contract_address: contractAddress,
      // });
    });

    txHash.on('receipt', function (receipt) {
      let transactionStatusP = document.getElementById('transaction-status');
      transactionStatusP.innerText = 'Transaction receipt received. Transaction mined, waiting for confirmation...';
      // Transaction receipt received
      console.log(`The receipt is ${receipt}`);
      socket.emit('squares_claimed', {
        player_id: getPlayerId(),
        game_id: GAME_ID
      });

      // set a paid property on each cell in PLAYER_CLAIMED_SQUARES[GAME_ID]
      for (let item in PLAYER_CLAIMED_SQUARES[GAME_ID]) {
        const squareId = PLAYER_CLAIMED_SQUARES[GAME_ID][item];
        const [row, col] = squareId.split('');
        console.log(`Setting square ${row}, ${col} to paid`);
        let cell = selectTableCell(row, col);
        cell.setAttribute('data-paid', true);

        const rect = cell.getBoundingClientRect();
        const xPosition = rect.left + window.scrollX;
        const yPosition = rect.top + window.scrollY;
      
        const element = {
          clientX: xPosition + (IDENTICON_SIZE / 2),
          clientY: yPosition + (IDENTICON_SIZE / 2)
        };
  
        explode(element);

        // <span class="overlay-text">Your Text</span>
        let overlayText = document.createElement('span');
        overlayText.classList.add('overlay-text', 'seymour');
        overlayText.innerHTML = `H: ${row}<br>V: ${col}`;

        cell.appendChild(overlayText);
        cell.children[1].style.opacity = 0.5;

        // add to #claimed-squares list
        let claimedSquares = document.getElementById('claimed-squares');
        let claimedSquareLi = document.createElement('li');
        claimedSquareLi.textContent = squareId;
        claimedSquares.appendChild(claimedSquareLi);
      }

      // clear #your-squares list
      let yourSquaresList = document.getElementById('marked-squares');
      yourSquaresList.innerHTML = '';
    });

    txHash.on('confirmation', function (confirmation, receipt) {
      let transactionStatusP = document.getElementById('transaction-status');
      console.log('Transaction confirmed.');
      transactionStatusP.innerText = 'Transaction confirmed.';
      transactionStatusP.classList.remove('flashing');
      // Transaction confirmed
      console.log(`The confirmation number is ${JSON.stringify(confirmation)}`);  
    });

    txHash.on('error', function (error) {
      // Transaction error occurred
      console.error(`An error occurred: ${error}`);
    });
  })();
}

function selectTableCell(dataRow, dataColumn) {
  return document.querySelector(`td[data-row='${dataRow}'][data-col='${dataColumn}']`);
}

function generateColorGradient() {
  // Generate a random color
  const randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16);

  // Convert the random color to RGB values
  const randomRed = parseInt(randomColor.slice(1, 3), 16);
  const randomGreen = parseInt(randomColor.slice(3, 5), 16);
  const randomBlue = parseInt(randomColor.slice(5, 7), 16);

  // Calculate the step size for each RGB value
  const stepRed = Math.floor(randomRed / 400);
  const stepGreen = Math.floor(randomGreen / 400);
  const stepBlue = Math.floor(randomBlue / 400);

  // Create an array to store the gradient colors
  const gradientColors = [];

  // Generate the gradient colors
  for (let i = 0; i < 50; i++) {
    const red = randomRed - (stepRed * i);
    const green = randomGreen - (stepGreen * i);
    const blue = randomBlue - (stepBlue * i);

    // Convert the RGB values back to hexadecimal
    const hexColor = `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`;

    // Add the color to the gradientColors array
    gradientColors.push(hexColor);
  }

  return gradientColors;
}

function generateGamesList(games, ul) {
  console.log(`Generating games list: ${JSON.stringify(games)}`);
  ul.innerHTML = '';
  for (let i = 0; i < games.length; i++) {
    let a = document.createElement('a');
    a.setAttribute('href', `#/game/${games[i].game_id}?week_id=${games[i].week_id}`);
    a.textContent = games[i].name;

    let li = document.createElement('li');
    li.appendChild(a);

    ul.appendChild(li);
  }
}

function joinGame(game) {
  console.log("Joining game with id: " + game.id);
  socket.emit('join_game', { week_id:game.week_id, game_id: game.id, player_address: "", player_id: getPlayerId() });

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
      cell.setAttribute('data-paid', false);

      cell.addEventListener('click', clickSquare);

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

  socket.on('connect', () => {
    console.log('Connected to the server.');
    if (socket.recovered) {
      console.log('Connection recovered. Replay events from last offset')
    } else {
      // new or unrecoverable session
    }

    const currentLocation = router.getCurrentLocation();
    console.log(`Current route location: ${JSON.stringify(currentLocation)}`);
  });
  
  socket.on('disconnect', (reason) => {
    console.log('Disconnected from the server:', reason);
    // Handle disconnection
    // The 'reason' argument provides why the client disconnected
  });
  
  socket.on('reconnect', (attemptNumber) => {
    console.log('Reconnected to the server after', attemptNumber, 'attempts');
    // Handle successful reconnection
  });

  socket.on('game_joined', (game) => {
    console.log(`Game joined: ${JSON.stringify(game)}`);
    console.log(`Color gradient: ${JSON.stringify(GRADIENT_COLORS)}`)
    GAME_ID = game.id;

    let gameIdH2 = document.querySelector('#app h2 span');
    let gameNameH4 = document.querySelector('#app h4 span');

    gameIdH2.textContent = game.id;
    gameNameH4.textContent = game.name;

    let yourIdenticon = createIdenticon(getPlayerId(), 80);
    let yourIdenticonSpan = document.getElementById('your-identicon');
    yourIdenticonSpan.appendChild(yourIdenticon);

    // mark squares
    const claimedSquares = game.claimed_squares;
    PLAYER_CLAIMED_SQUARES[game.id] = [];
    PLAYER_SQUARES_TO_UNCLAIM[game.id] = [];

    let markedSquaresUL = document.getElementById('marked-squares');
    markedSquaresUL.innerHTML = '';

    // let claimedSquaresUL = document.getElementById('claimed-squares');
    const claimedSquaresList = document.getElementById('claimed-squares');

    for (const item in claimedSquares) {
      const square = claimedSquares[item];
      const claimedBy = square.player_id;
      let [row, column] = square.id.split('');
      const cell = selectTableCell(row, column);
      let identicon = createIdenticon(claimedBy, IDENTICON_SIZE);
      cell.appendChild(identicon);

      if(claimedBy === getPlayerId()) {
        if(!square.paid) {
          let markedSquareLI = document.createElement('li');
          PLAYER_CLAIMED_SQUARES[GAME_ID].push(square.id);
          markedSquareLI.textContent = square.id;
          markedSquaresUL.appendChild(markedSquareLI);
        }
        
        if (square.paid) {
          let claimedSquaresLI = document.createElement('li');
          claimedSquaresLI.textContent = square.id;
          claimedSquaresList.appendChild(claimedSquaresLI);
        }
      }

      if (square.paid) {
        // <span class="overlay-text">Your Text</span>
        let overlayText = document.createElement('span');
        overlayText.classList.add('overlay-text', 'seymour');
        overlayText.innerHTML = `H: ${row}<br>V: ${column}`;

        cell.appendChild(overlayText);
        cell.setAttribute('data-paid', true);
        cell.children[0].style.opacity = 0.5;
      }
    }

    // how many items in #claimed-squares list?
    const claimedSquaresListItems = claimedSquaresList.getElementsByTagName('li');

    if(claimedSquaresListItems.length > 0) {
      let claimedSquaresP = document.createElement('p');
      claimedSquaresP.textContent = 'Claimed Squares';
      claimedSquaresList.insertBefore(claimedSquaresP, claimedSquaresList.firstChild);
    }

    console.log(`Player claimed squares: ${JSON.stringify(PLAYER_CLAIMED_SQUARES)}`);

    // display claimed squares as list items in the #your-squares list
    let yourSquares = document.getElementById('marked-squares');
    yourSquares.innerHTML = '';
    
    for(item in PLAYER_CLAIMED_SQUARES[game.id]) {
      const squareId = PLAYER_CLAIMED_SQUARES[game.id][item];
      let newSquareLi = document.createElement('li');
      newSquareLi.textContent = squareId;
      yourSquares.appendChild(newSquareLi);
    }

    if(PLAYER_CLAIMED_SQUARES[game.id].length > 0) {
      let claimSquaresButton = document.createElement('button');
      claimSquaresButton.textContent = 'Claim Squares';
      claimSquaresButton.addEventListener('click', claimSquares);
  
      let claimButtonLI = document.createElement('li');
      claimButtonLI.appendChild(claimSquaresButton);
      markedSquaresUL.appendChild(claimButtonLI);
    }

    // if(PLAYER_SQUARES_TO_UNCLAIM[game.id].length > 0) {
    //   let unclaimSquaresButton = document.createElement('button');
    //   unclaimSquaresButton.textContent = 'Unclaim Squares';
    //   unclaimSquaresButton.addEventListener('click', unclaimSquares);
  
    //   let unclaimButtonLI = document.createElement('li');
    //   unclaimButtonLI.appendChild(unclaimSquaresButton);
    //   unclaimSquaresUL.appendChild(unclaimButtonLI);
    // }

    // display players
    const players = game.players;
    let playerList = document.getElementById('player-list');
    playerList.innerHTML = '';

    for (const id in players) {
      if (players[id] !== getPlayerId()) {
        let newPlayerLi = document.createElement('li');

        let identicon = createIdenticon(players[id], 50);
        newPlayerLi.appendChild(identicon);

        playerList.appendChild(newPlayerLi);
      }
    }
  });

  socket.on('square_claimed', (square) => {
    if(square.game_id === GAME_ID) {
      console.log(`Square marked: ${JSON.stringify(square)}`);
      // get digits from square.id
      let [row, column] = square.id.split('');
      const cell = selectTableCell(row, column);

      const rect = cell.getBoundingClientRect();
      const xPosition = rect.left + window.scrollX;
      const yPosition = rect.top + window.scrollY;
    
      const element = {
        clientX: xPosition + (IDENTICON_SIZE / 2),
        clientY: yPosition + (IDENTICON_SIZE / 2)
      };

      explode(element);

      let identicon = createIdenticon(square.player_id, IDENTICON_SIZE);
      cell.appendChild(identicon);
      cell.removeEventListener('click', clickSquare);
      // cell.style.backgroundColor = 'yellow';
    }
  });

  socket.on('square_unclaimed', (square) => {
    if(square.game_id === GAME_ID) {
      console.log(`Square unmarked: ${JSON.stringify(square)}`);
      unclaimSquare(square);
    }    
  });

  socket.on('squares_claimed', (data) => {
    console.log(`Squares claimed: ${JSON.stringify(data)}`);

    if(data.game_id === GAME_ID) {
      for (let item in data.squares) {
        const square = data.squares[item];

        if(square.paid === true) {
          let cell = selectTableCell(square.home_points, square.away_points);
          cell.setAttribute('data-paid', true);
  
          const rect = cell.getBoundingClientRect();
          const xPosition = rect.left + window.scrollX;
          const yPosition = rect.top + window.scrollY;
        
          const element = {
            clientX: xPosition + (IDENTICON_SIZE / 2),
            clientY: yPosition + (IDENTICON_SIZE / 2)
          };
    
          explode(element);

          // <span class="overlay-text">Your Text</span>
          let overlayText = document.createElement('span');
          overlayText.classList.add('overlay-text', 'seymour');
          overlayText.innerHTML = `H: ${square.home_points}<br>V: ${square.away_points}`;

          cell.appendChild(overlayText);
          cell.children[0].style.opacity = 0.5;
        }
      }
    }
  });

  socket.on('new_player_joined', (data) => {
    if(data.game_id === GAME_ID) {
      console.log(`New player joined: ${JSON.stringify(data)}`);

      let playerList = document.getElementById('player-list');
      let newPlayerLi = document.createElement('li');
      newPlayerLi.classList.add('fade-in');

      let identicon = createIdenticon(data.player_id, 50);

      newPlayerLi.appendChild(identicon);
      playerList.appendChild(newPlayerLi);
    }
  });

  socket.on('player_left_game', (data) => {
    if (data.game_id === GAME_ID) {
      console.log(`Player left game: ${JSON.stringify(data.player_id)}`);

      const unclaimedSquares = data.unclaimed_squares;

      let i = 1;
      for (let square in unclaimedSquares) {
        setTimeout(() => {
          unclaimSquare(unclaimedSquares[square]);
        }, i * 150);
        i++;
      }

      let playerList = document.getElementById('player-list');
      let players = playerList.getElementsByTagName('li');

      for (let i = 0; i < players.length; i++) {
        if (players[i].firstChild.getAttribute('data-jdenticon-value') === data.player_id) {
          setTimeout(() => {
            const rect = players[i].getBoundingClientRect();
            const xPosition = rect.left + window.scrollX;
            const yPosition = rect.top + window.scrollY;
          
            const element = {
              clientX: xPosition + (IDENTICON_SIZE / 2),
              clientY: yPosition + (IDENTICON_SIZE / 2)
            };

            players[i].remove();
            explode(element);
          }, 1500);
        }
      }
    }
  });

  socket.on('square_match', (data, ack) => {
    if(GAME_ID === data.square.game_id) {
      // console.log(`Square match: ${JSON.stringify(data)}`);
      console.log(`Event num: ${data.event_num}`);

      // let rect = document.getElementById('app').getBoundingClientRect();
      // let xPosition = rect.left + window.scrollX;
      // let yPosition = rect.top + window.scrollY;
  
      // const event = {
      //   clientX: xPosition + 25,
      //   clientY: yPosition + 25
      // };
  
      // explode(event);
  
      let square = data.square;
      let cell = selectTableCell(square.home_points, square.away_points);
      // cell.style.backgroundColor = 'green';
      cell.removeEventListener('click', clickSquare);

      ack_data = {
        // 'square': square,
        'player_id': getPlayerId(),
        'event_num': data.event_num,
        'event_name': 'mark_claimed_square_match'
      }
      // console.log(`Sending ack_data: ${JSON.stringify(ack_data)}`);
      ack(ack_data);
    }
  });

  socket.on('mark_claimed_square_match', (data) => {
    if(GAME_ID === data.square.game_id) {
      console.log(`Mark claimed square match: ${JSON.stringify(data)}`);

      // let rect = document.getElementById('app').getBoundingClientRect();
      // let xPosition = rect.left + window.scrollX;
      // let yPosition = rect.top + window.scrollY;
  
      // const event = {
      //   clientX: xPosition + 25,
      //   clientY: yPosition + 25
      // };
  
      // explode(event);
  
      let square = data.square;
      let cell = selectTableCell(square.home_points, square.away_points);
      // cell.style.backgroundColor = 'red';
      cell.removeEventListener('click', clickSquare);

      ack_data = {
        'square': square,
        'player_id': getPlayerId(),
        'event_num': data.event_num,
        'event_name': 'mark_claimed_square_match'
      }
      console.log(`Sending ack_data: ${JSON.stringify(ack_data)}`);
      // callback(ack_data);
    }
  });

  socket.on('mark_unclaimed_square_match', (data, ack) => {
    if(GAME_ID === data.game_id) {
      // console.log(`Mark unclaimed square match: ${JSON.stringify(data)}`);
      console.log(`Event num: ${data.event_num}`);

      // let rect = document.getElementById('app').getBoundingClientRect();
      // let xPosition = rect.left + window.scrollX;
      // let yPosition = rect.top + window.scrollY;
  
      // const event = {
      //   clientX: xPosition + 25,
      //   clientY: yPosition + 25
      // };
  
      // explode(event);
  
      let square = data.square;
      let cell = selectTableCell(square.home_points, square.away_points);
      // cell.style.backgroundColor = 'red';
      cell.removeEventListener('click', clickSquare);
      socket.auth.serverOffset = data.scoring_play.offset;
      socket.auth.game_id = data.square.game_id;
      socket.auth.week_id = data.square.week_id;

      ack_data = {
        // 'square': square,
        'player_id': getPlayerId(),
        'event_num': data.event_num,
        'event_name': 'mark_unclaimed_square_match'
      }
      // console.log(`Sending ack_data: ${JSON.stringify(ack_data)}`);
      ack(ack_data);
    }
  });
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
  return fetch(`${domain}/ethereum-price?game_id=${GAME_ID}`)
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
  return fetch(`${domain}/gas-oracle?game_id=${GAME_ID}`)
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
      console.log(`The FootballSquares ABI is ${data.abi}`)
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
  if(window.innerWidth <= 600) {
    IDENTICON_SIZE = 30;
  } else {
    IDENTICON_SIZE = 50;
  }

  console.log(`Identicon size: ${IDENTICON_SIZE}`);

  socket = io(domain,
    {
      auth: {
        serverOffset: 0
      },
      transports: ['websocket'],
      query: {
        player_id: getPlayerId(),
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
    .on("/game/:gameId", (match) => {
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
          a.setAttribute('href', `#/leave/${match.data.gameId}?week_id=${match.params.week_id}`);
          a.setAttribute('data-navigo', '')
          a.textContent = 'Leave Game';

          let nav = document.querySelector('#game-info .home');
          nav.appendChild(a);

          done();
        })();
      }
    })
    .on("/leave/:gameId", (match) => {
      console.log(`Match value on leave route: ${JSON.stringify(match)}`);

      router.navigate('');
    }, {
      before(done, match) {
        socket.emit('leave_game', { 
          game_id: match.data.gameId, 
          player_id: getPlayerId(), 
          week_id: match.params.week_id,
          player_address: ""
        });
        GAME_ID = null;
        done();
      }
    })
    .resolve();
});
