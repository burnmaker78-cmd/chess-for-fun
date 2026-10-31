let board = null;
const game = new Chess();
const turnDisplay = document.getElementById('turn-display');
const bestMoveDisplay = document.getElementById('best-move-display');

// Function to fetch engine evaluations using an open-source public chess API
async function fetchEngineMove(fen) {
    bestMoveDisplay.innerText = "Calculating...";
    try {
        // Encodes the FEN string to safely pass via URL
        const encodedFen = encodeURIComponent(fen);
        const response = await fetch(`https://stockfish.online{encodedFen}`);
        const data = await response.json();

        if (data && data.success && data.bestmove) {
            // Extract the readable move snippet (e.g., "e2e4")
            const moveArray = data.bestmove.split(' ');
            const primaryMove = moveArray[1] || "None";
            bestMoveDisplay.innerText = primaryMove.toUpperCase();
        } else {
            bestMoveDisplay.innerText = "No move found";
        }
    } catch (error) {
        console.error("Engine fetch error:", error);
        bestMoveDisplay.innerText = "Error loading engine";
    }
}

function onDragStart(source, piece, position, orientation) {
    // Stop the game if it is checkmate or a draw
    if (game.game_over()) return false;
}

function onDrop(source, target) {
    // Attempt to make a valid chess move
    const move = game.move({
        from: source,
        to: target,
        promotion: 'q' // Auto-promote to Queen for fluent analysis tracking
    });

    // If the move is completely illegal according to rules, snap the piece back
    if (move === null) return 'snapback';

    updateDashboard();
}

function onSnapEnd() {
    board.position(game.fen());
}

function updateDashboard() {
    // Update the turn indicator text
    const currentTurn = game.turn() === 'w' ? 'White' : 'Black';
    turnDisplay.innerText = currentTurn;

    // Send the updated board setup directly to the engine
    fetchEngineMove(game.fen());
}

// Configuration options for Chessboard.js
const config = {
    draggable: true,
    position: 'start',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd
};

// Initialize the board
board = Chessboard('board', config);

// Request the initial move suggestions for the opening position
fetchEngineMove(game.fen());

// Event listeners for Sidebar Buttons
document.getElementById('flip-btn').addEventListener('click', () => {
    board.flip();
});

document.getElementById('reset-btn').addEventListener('click', () => {
    game.reset();
    board.start();
    updateDashboard();
});
