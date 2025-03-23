// Load the Pyodide interpreter and initialize the checkers game
let pyodideReadyPromise;

// Enable debug mode
const DEBUG_MODE = true;

// Log debug information
function debugLog(...args) {
  if (DEBUG_MODE) {
    console.log(...args);
  }
}

async function initializePyodide() {
  try {
    // Load Pyodide
    console.log("Starting to load Pyodide...");
    self.pyodide = await loadPyodide();
    console.log("Pyodide loaded successfully");
    
    await self.pyodide.loadPackagesFromImports(`
      import sys
      import js
    `);
    console.log("Python packages imported");
    
    // Load the checkers game from Python code
    console.log("Fetching Python code...");
    const pythonCode = await fetch('js/checkers.py')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.text();
      });
    
    console.log("Python code fetched, running...");
    await self.pyodide.runPythonAsync(pythonCode);
    
    console.log("Pyodide initialized with checkers game");
    return self.pyodide;
  } catch (error) {
    console.error("Error initializing Pyodide:", error);
    document.getElementById('game-status').textContent = "Error loading game: " + error.message;
    throw error;
  }
}

// Start loading Pyodide right away
pyodideReadyPromise = initializePyodide();

// Function to check if Pyodide is loaded correctly
function isPyodideReady(pyodide) {
  if (!pyodide) {
    console.error("Pyodide is not initialized");
    return false;
  }
  
  try {
    // Test if we can access game object
    const testResult = pyodide.runPython('isinstance(game, CheckersGame)');
    debugLog("Pyodide ready check:", testResult);
    
    // Validate that the game object is properly initialized
    const validGame = validateGameState(pyodide);
    return testResult === true && validGame;
  } catch (error) {
    console.error("Error checking if Pyodide is ready:", error);
    return false;
  }
}

// Validate game state
function validateGameState(pyodide) {
  try {
    // Check if game has the expected attributes
    const hasBoard = pyodide.runPython('hasattr(game, "board")');
    const hasValidMoves = pyodide.runPython('hasattr(game, "valid_moves")');
    const hasSelectedPiece = pyodide.runPython('hasattr(game, "selected_piece")');
    
    debugLog("Game state validation:", { hasBoard, hasValidMoves, hasSelectedPiece });
    
    // Print the current board for debugging
    console.log("Current board state:");
    pyodide.runPython(`
      print("Board state:")
      for row in game.board:
          print(row)
      print("Current player:", game.current_player)
      print("Selected piece:", game.selected_piece)
      print("Valid moves:", game.valid_moves)
    `);
    
    return hasBoard && hasValidMoves && hasSelectedPiece;
  } catch (error) {
    console.error("Error validating game state:", error);
    return false;
  }
}

// Function to reload the Python module if needed
async function reloadPythonModuleIfNeeded() {
  try {
    debugLog("Checking if Python module needs to be reloaded...");
    
    // Try to access a method on the game object
    const methodsWorking = pyodide.runPython(`
      try:
          # Try calling a method to check if the object is still fully functional
          game.get_valid_moves(0, 0)
          True
      except Exception as e:
          print("Error calling method:", e)
          False
    `);
    
    if (!methodsWorking) {
      console.warn("Game object methods not working, reloading Python module...");
      
      // Reload the Python module
      const pythonCode = await fetch('js/checkers.py')
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          return response.text();
        });
      
      await pyodide.runPythonAsync(pythonCode);
      console.log("Python module reloaded");
      return true;
    }
    
    debugLog("Python module working correctly");
    return false;
  } catch (error) {
    console.error("Error checking/reloading Python module:", error);
    return false;
  }
}

// Modify the syncStateWithPython function to reload if needed
async function syncStateWithPython() {
  try {
    debugLog("Syncing state with Python");
    
    // Check if module needs to be reloaded
    const reloaded = await reloadPythonModuleIfNeeded();
    if (reloaded) {
      console.log("Python module was reloaded, refreshing UI...");
    }
    
    // Get current state from Python
    const boardState = pyodide.runPython('get_board_state()');
    const hasSelectedPiece = pyodide.runPython('game.selected_piece is not None');
    const currentPlayer = pyodide.runPython('game.current_player');
    
    debugLog("Board state:", boardState);
    debugLog("Has selected piece:", hasSelectedPiece);
    debugLog("Current player:", currentPlayer);
    
    // Update UI
    updateBoard();
    updateStatus();
    updateVisualIndicators();
    
    debugLog("State sync complete");
  } catch (error) {
    console.error("Error syncing state:", error);
  }
}

// Initialize the game board and UI elements
window.addEventListener('DOMContentLoaded', async function() {
  const checkerboard = document.getElementById('checkerboard');
  const statusDisplay = document.getElementById('game-status');
  const resetButton = document.getElementById('reset-game');
  
  try {
    // Wait for Pyodide to be ready
    statusDisplay.textContent = "Loading Python interpreter...";
    const pyodide = await pyodideReadyPromise;
    statusDisplay.textContent = "Initializing game...";
    
    // Check if Pyodide is properly initialized
    if (!isPyodideReady(pyodide)) {
      statusDisplay.textContent = "Error: Failed to initialize game engine.";
      console.error("Pyodide ready check failed - game engine not properly initialized");
      return;
    }
    
    // Handle clicks on the board
    checkerboard.onclick = function(event) {
      // If clicked directly on a piece or indicator, find its parent square
      let target = event.target;
      console.log("Click target:", target.className);
      
      if (target.classList.contains('piece')) {
        console.log("Clicked on piece, finding parent square");
        target = target.parentElement;
      } else if (target.classList.contains('valid-move-indicator')) {
        console.log("Clicked on valid move indicator, finding parent square");
        target = target.parentElement;
      }
      
      // Only process if we clicked on a square
      if (target.classList.contains('square')) {
        const row = parseInt(target.dataset.row);
        const col = parseInt(target.dataset.col);
        console.log(`Processing click on square at row=${row}, col=${col}`);
        
        try {
          // Direct call to Python handle_click
          const result = pyodide.runPython(`handle_click(${row}, ${col})`);
          console.log("Python handle_click result:", result);
          
          // Update the board with current state
          updateBoard();
          updateStatus();
          
          // Show valid moves
          showValidMoves();
        } catch (error) {
          console.error("Error handling click:", error);
          statusDisplay.textContent = "Error: " + error.message;
        }
      }
    };
    
    // Set up the checkerboard
    function createBoard() {
      // Clear the board
      checkerboard.innerHTML = '';
      
      // Create the board squares
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const square = document.createElement('div');
          square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
          square.dataset.row = row;
          square.dataset.col = col;
          checkerboard.appendChild(square);
        }
      }
      
      // Update the board with pieces
      updateBoard();
    }
    
    // Update the visual board from the Python game state
    function updateBoard() {
      try {
        // Get the board state
        const boardState = pyodide.runPython('get_board_state()');
        console.log("Raw board state:", boardState);
        
        // Parse the board state
        let parsedState;
        try {
          parsedState = JSON.parse(boardState);
          console.log("Parsed board state:", parsedState);
        } catch (error) {
          console.error("Error parsing board state:", error);
          console.log("Invalid board state:", boardState);
          return;
        }
        
        // Remove all pieces, but keep squares and indicators
        document.querySelectorAll('.piece').forEach(el => el.remove());
        
        // Add pieces based on current state
        for (let row = 0; row < 8; row++) {
          for (let col = 0; col < 8; col++) {
            const value = parsedState[row][col];
            if (value !== 0) {
              const square = document.querySelector(`.square[data-row="${row}"][data-col="${col}"]`);
              if (!square) {
                console.error(`Could not find square at row=${row}, col=${col}`);
                continue;
              }
              
              const piece = document.createElement('div');
              
              if (value === 1) piece.className = 'piece red';
              else if (value === 2) piece.className = 'piece red king';
              else if (value === -1) piece.className = 'piece black';
              else if (value === -2) piece.className = 'piece black king';
              
              square.appendChild(piece);
            }
          }
        }
      } catch (error) {
        console.error("Error updating board:", error);
        statusDisplay.textContent = "Error updating board: " + error.message;
      }
    }
    
    // Update the game status display
    function updateStatus() {
      try {
        const status = pyodide.runPython('get_game_status()');
        console.log("Game status:", status);
        statusDisplay.textContent = status;
      } catch (error) {
        console.error("Error updating status:", error);
        statusDisplay.textContent = "Error updating status";
      }
    }
    
    // Reset the game
    resetButton.addEventListener('click', function() {
      try {
        console.log("Resetting game...");
        pyodide.runPython('reset_game()');
        updateBoard();
        updateStatus();
        
        // Clear any valid move indicators when resetting
        document.querySelectorAll('.valid-move-indicator').forEach(el => el.remove());
        document.querySelectorAll('.selected-piece').forEach(el => el.classList.remove('selected-piece'));
        
        console.log("Game reset successfully");
      } catch (error) {
        console.error("Error resetting game:", error);
        statusDisplay.textContent = "Error resetting game: " + error.message;
      }
    });
    
    // Update visual indicators for selected piece and valid moves
    function updateVisualIndicators() {
      try {
        // Remove any existing indicators
        document.querySelectorAll('.selected-piece').forEach(el => el.classList.remove('selected-piece'));
        document.querySelectorAll('.valid-move-indicator').forEach(el => el.remove());
        
        // Get selected piece
        const hasSelectedPiece = pyodide.runPython('game.selected_piece is not None');
        
        if (hasSelectedPiece) {
          // Highlight selected piece
          const selectedRow = pyodide.runPython('game.selected_piece[0]');
          const selectedCol = pyodide.runPython('game.selected_piece[1]');
          
          const selectedSquare = document.querySelector(`.square[data-row="${selectedRow}"][data-col="${selectedCol}"]`);
          if (selectedSquare && selectedSquare.firstChild) {
            selectedSquare.firstChild.classList.add('selected-piece');
          }
          
          // Highlight valid moves
          const validMovesStr = pyodide.runPython('json.dumps(game.valid_moves)');
          const validMoves = JSON.parse(validMovesStr);
          
          for (const [moveRow, moveCol] of validMoves) {
            const moveSquare = document.querySelector(`.square[data-row="${moveRow}"][data-col="${moveCol}"]`);
            if (moveSquare) {
              const indicator = document.createElement('div');
              indicator.className = 'valid-move-indicator';
              moveSquare.appendChild(indicator);
            }
          }
        }
      } catch (error) {
        console.error("Error updating visual indicators:", error);
      }
    }
    
    // Function to show valid moves for selected piece
    function showValidMoves() {
      try {
        // Remove any previous valid move indicators
        document.querySelectorAll('.valid-move-indicator').forEach(el => el.remove());
        
        // Remove previous selections
        document.querySelectorAll('.selected-piece').forEach(el => el.classList.remove('selected-piece'));
        
        // Check if there's a selected piece
        const hasSelectedPiece = pyodide.runPython('game.selected_piece is not None');
        console.log("Has selected piece:", hasSelectedPiece);
        
        if (hasSelectedPiece) {
          // Get the selected piece position
          const selectedRow = pyodide.runPython('game.selected_piece[0]');
          const selectedCol = pyodide.runPython('game.selected_piece[1]');
          
          // Highlight the selected piece
          const selectedSquare = document.querySelector(`.square[data-row="${selectedRow}"][data-col="${selectedCol}"]`);
          if (selectedSquare && selectedSquare.firstChild) {
            selectedSquare.firstChild.classList.add('selected-piece');
          }
          
          // Get and show valid moves
          const validMovesStr = pyodide.runPython('json.dumps(game.valid_moves)');
          console.log("Valid moves JSON:", validMovesStr);
          
          const validMoves = JSON.parse(validMovesStr);
          console.log("Valid moves:", validMoves);
          
          for (const move of validMoves) {
            const moveRow = move[0];
            const moveCol = move[1];
            console.log(`Adding indicator at ${moveRow},${moveCol}`);
            
            const moveSquare = document.querySelector(`.square[data-row="${moveRow}"][data-col="${moveCol}"]`);
            if (moveSquare) {
              const indicator = document.createElement('div');
              indicator.className = 'valid-move-indicator';
              moveSquare.appendChild(indicator);
            }
          }
        }
      } catch (error) {
        console.error("Error showing valid moves:", error);
      }
    }
    
    // Initialize the game
    createBoard();
    updateStatus();
    console.log("Game initialized successfully");
  } catch (error) {
    console.error("Error setting up game:", error);
    statusDisplay.textContent = "Error setting up game: " + error.message;
  }
});

// Expose a debug function that can be called from the console
window.debugCheckers = function() {
  try {
    console.log("Debugging checkers game state:");
    
    // Board state
    const boardState = pyodide.runPython(`
      print("Board state:")
      for row in game.board:
          print(row)
      game.board
    `);
    console.log("Board:", boardState);
    
    // Selected piece
    const selectedPiece = pyodide.runPython(`
      print("Selected piece:", game.selected_piece)
      game.selected_piece
    `);
    console.log("Selected piece:", selectedPiece);
    
    // Valid moves
    const validMoves = pyodide.runPython(`
      print("Valid moves:", game.valid_moves)
      game.valid_moves
    `);
    console.log("Valid moves:", validMoves);
    
    // Current player
    const currentPlayer = pyodide.runPython(`
      print("Current player:", game.current_player)
      game.current_player
    `);
    console.log("Current player:", currentPlayer);
    
    // Must jump flag
    const mustJump = pyodide.runPython(`
      print("Must jump:", game.must_jump)
      game.must_jump
    `);
    console.log("Must jump:", mustJump);
    
    return {
      boardState,
      selectedPiece,
      validMoves,
      currentPlayer,
      mustJump
    };
  } catch (error) {
    console.error("Error in debug function:", error);
    return null;
  }
}; 