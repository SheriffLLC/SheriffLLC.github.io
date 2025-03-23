import json
from js import console

# Game state
class CheckersGame:
    def __init__(self):
        self.reset()
    
    def reset(self):
        # Board representation:
        # 0 = empty
        # 1 = red piece, 2 = red king
        # -1 = black piece, -2 = black king
        self.board = [
            [0, 1, 0, 1, 0, 1, 0, 1],
            [1, 0, 1, 0, 1, 0, 1, 0],
            [0, 1, 0, 1, 0, 1, 0, 1],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [-1, 0, -1, 0, -1, 0, -1, 0],
            [0, -1, 0, -1, 0, -1, 0, -1],
            [-1, 0, -1, 0, -1, 0, -1, 0]
        ]
        
        self.current_player = 1  # 1 = red, -1 = black
        self.selected_piece = None
        self.valid_moves = []
        self.must_jump = False
        self.game_over = False
        self.winner = None
        self.status = "Red's turn"
        console.log("Game reset, current_player =", self.current_player)
    
    def get_valid_moves(self, row, col):
        """Get all valid moves for a piece at given position"""
        piece = self.board[row][col]
        if piece == 0:
            return []
        
        # Check if piece belongs to current player
        if (piece > 0 and self.current_player == 1) or (piece < 0 and self.current_player == -1):
            moves = []
            jumps = []
            
            # Direction for regular pieces
            directions = []
            if piece == 1:  # Red piece moves down
                directions = [(1, -1), (1, 1)]
            elif piece == -1:  # Black piece moves up
                directions = [(-1, -1), (-1, 1)]
            elif piece in (2, -2):  # Kings move in all four diagonal directions
                directions = [(1, -1), (1, 1), (-1, -1), (-1, 1)]
            
            # Check each direction
            for dr, dc in directions:
                # Regular move
                new_row, new_col = row + dr, col + dc
                if 0 <= new_row < 8 and 0 <= new_col < 8 and self.board[new_row][new_col] == 0:
                    moves.append((new_row, new_col))
                
                # Jump move
                new_row, new_col = row + 2*dr, col + 2*dc
                mid_row, mid_col = row + dr, col + dc
                if (0 <= new_row < 8 and 0 <= new_col < 8 and 
                    self.board[new_row][new_col] == 0 and
                    ((self.board[mid_row][mid_col] > 0 and self.current_player == -1) or 
                     (self.board[mid_row][mid_col] < 0 and self.current_player == 1))):
                    jumps.append((new_row, new_col))
            
            # If jumps are available, only return jumps
            if jumps:
                return jumps
            else:
                return moves
        return []
    
    def check_for_jumps(self):
        """Check if there are any possible jumps for the current player"""
        for row in range(8):
            for col in range(8):
                piece = self.board[row][col]
                if (piece > 0 and self.current_player == 1) or (piece < 0 and self.current_player == -1):
                    moves = self.get_valid_moves(row, col)
                    # Check if any move is a jump (more than 1 square away)
                    for new_row, new_col in moves:
                        if abs(new_row - row) == 2:
                            return True
        return False
    
    def make_move(self, from_pos, to_pos):
        """Make a move from one position to another"""
        from_row, from_col = from_pos
        to_row, to_col = to_pos
        
        console.log(f"Making move from ({from_row},{from_col}) to ({to_row},{to_col})")
        
        # Move the piece
        piece = self.board[from_row][from_col]
        self.board[from_row][from_col] = 0
        self.board[to_row][to_col] = piece
        
        # Check for jump and remove captured piece
        if abs(to_row - from_row) == 2:
            mid_row = (from_row + to_row) // 2
            mid_col = (from_col + to_col) // 2
            console.log(f"Capturing piece at ({mid_row},{mid_col})")
            self.board[mid_row][mid_col] = 0
        
        # Check for king promotion
        if (piece == 1 and to_row == 7) or (piece == -1 and to_row == 0):
            console.log(f"Promoting piece at ({to_row},{to_col}) to king")
            self.board[to_row][to_col] = 2 if piece == 1 else -2
        
        # Check for additional jumps
        additional_jumps = False
        if abs(to_row - from_row) == 2:
            # Check if piece can jump again
            jumps = [move for move in self.get_valid_moves(to_row, to_col) if abs(move[0] - to_row) == 2]
            if jumps:
                console.log(f"Additional jumps available: {jumps}")
                additional_jumps = True
                self.selected_piece = (to_row, to_col)
                self.valid_moves = jumps
                self.must_jump = True
                return False  # Don't end turn yet
        
        if not additional_jumps:
            # End turn
            self.current_player *= -1
            self.selected_piece = None
            self.valid_moves = []
            console.log(f"Turn ended. New current player: {self.current_player}")
            
            # Check for game end conditions
            self.check_game_over()
            
            # Set status
            if self.game_over:
                if self.winner == 1:
                    self.status = "Game over! Red wins!"
                elif self.winner == -1:
                    self.status = "Game over! Black wins!"
                else:
                    self.status = "Game over! It's a draw!"
                console.log(f"Game over! Winner: {self.winner}")
            else:
                self.status = "Red's turn" if self.current_player == 1 else "Black's turn"
                
                # Check if current player must jump
                self.must_jump = self.check_for_jumps()
                if self.must_jump:
                    self.status += " (Must jump!)"
                    console.log("Current player must jump")
        
        return True  # Turn ended
    
    def check_game_over(self):
        """Check if the game is over (no valid moves or no pieces left)"""
        red_pieces = black_pieces = 0
        red_moves = black_moves = 0
        
        for row in range(8):
            for col in range(8):
                piece = self.board[row][col]
                if piece > 0:
                    red_pieces += 1
                    if self.current_player == 1:
                        red_moves += len(self.get_valid_moves(row, col))
                elif piece < 0:
                    black_pieces += 1
                    if self.current_player == -1:
                        black_moves += len(self.get_valid_moves(row, col))
        
        if red_pieces == 0:
            self.game_over = True
            self.winner = -1
        elif black_pieces == 0:
            self.game_over = True
            self.winner = 1
        elif (self.current_player == 1 and red_moves == 0) or (self.current_player == -1 and black_moves == 0):
            self.game_over = True
            self.winner = -1 if self.current_player == 1 else 1
            
    def handle_click(self, row, col):
        """Handle a click on the board at position (row, col)"""
        console.log(f"Python handle_click called: row={row}, col={col}")
        console.log(f"Current player: {self.current_player}, Selected piece: {self.selected_piece}")
        console.log(f"Valid moves: {self.valid_moves}")
        
        if self.game_over:
            console.log("Game is over, ignoring click")
            return False
            
        # If we already have a piece selected
        if self.selected_piece:
            selected_row, selected_col = self.selected_piece
            console.log(f"Have selected piece at ({selected_row}, {selected_col})")
            
            # If the clicked square is in the valid moves
            if (row, col) in self.valid_moves:
                console.log(f"Clicked on valid move square ({row}, {col})")
                # Make the move
                result = self.make_move((selected_row, selected_col), (row, col))
                console.log(f"Move made, result: {result}")
                return True
            # If clicking on a different piece of the same color and we're not in a must-jump situation
            elif self.board[row][col] * self.current_player > 0 and not self.must_jump:
                console.log(f"Clicked on different piece at ({row}, {col})")
                # Select the new piece
                self.selected_piece = (row, col)
                self.valid_moves = self.get_valid_moves(row, col)
                console.log(f"New valid moves: {self.valid_moves}")
                return True
            # If clicking on the same piece, deselect it if not in a must-jump situation
            elif row == selected_row and col == selected_col and not self.must_jump:
                console.log("Deselecting piece")
                self.selected_piece = None
                self.valid_moves = []
                return True
            else:
                console.log(f"Invalid click at ({row}, {col})")
        else:
            # If no piece is selected, try to select one
            piece = self.board[row][col]
            console.log(f"No piece selected. Clicked on square with piece value: {piece}")
            
            # Check if piece belongs to current player
            if (piece > 0 and self.current_player == 1) or (piece < 0 and self.current_player == -1):
                console.log("Piece belongs to current player")
                # Jumps are mandatory
                if self.must_jump:
                    console.log("Must jump is active")
                    moves = self.get_valid_moves(row, col)
                    jumps = [move for move in moves if abs(move[0] - row) == 2]
                    console.log(f"Available jumps: {jumps}")
                    if jumps:
                        self.selected_piece = (row, col)
                        self.valid_moves = jumps
                        return True
                    else:
                        console.log("No jumps available for this piece")
                else:
                    # Select the piece and calculate valid moves
                    self.selected_piece = (row, col)
                    self.valid_moves = self.get_valid_moves(row, col)
                    console.log(f"Selected piece at ({row}, {col}). Valid moves: {self.valid_moves}")
                    return True
            else:
                console.log("Piece does not belong to current player")
        
        console.log("No action taken")
        return False

# Initialize the game
game = CheckersGame()

# Functions exposed to JavaScript
def handle_click(row, col):
    # Validate row and column values
    if not (0 <= row < 8 and 0 <= col < 8):
        console.log(f"Invalid row/col values: row={row}, col={col}")
        return False
        
    result = game.handle_click(row, col)
    console.log(f"handle_click result: {result}")
    return result

def get_board_state():
    return json.dumps(game.board)

def get_game_status():
    status = game.status
    if game.selected_piece:
        row, col = game.selected_piece
        status += f" - Selected piece at ({row}, {col})"
    return status

def reset_game():
    game.reset()

console.log("Checkers game initialized") 