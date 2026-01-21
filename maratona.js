
const socket = io();

// DOM Elements
const setupContainer = document.getElementById('maratona-setup-container');
const gameContainer = document.getElementById('maratona-game-container');
const setupMessage = document.getElementById('setup-message');
const marathonGrid = document.getElementById('marathon-grid');
const gameStatus = document.getElementById('game-status');
const backToLobbySetupBtn = document.getElementById('back-to-lobby-setup-btn');
const backToLobbyGameBtn = document.getElementById('back-to-lobby-game-btn');

// Game State
let currentGuess = '';
let gameStarted = false;
const WORD_LENGTH = 5;
let roomCode = '';

// Audio
const audioWin = new Audio('audio/audio_win.mp3');

// URL Params
const urlParams = new URLSearchParams(window.location.search);
const mode = urlParams.get('mode');
roomCode = urlParams.get('room');

// Initialize
if (mode === 'create') {
    socket.emit('createMaratonaRoom', 'it');
} else if (mode === 'join' && roomCode) {
    socket.emit('joinMaratonaRoom', roomCode);
}

// ========== SOCKET EVENTS ==========

socket.on('maratonaRoomCreated', (code) => {
    roomCode = code;
    setupMessage.textContent = `Codice Stanza: ${code}`;
    setupMessage.style.color = '#51cf66';
    window.history.replaceState({}, '', `maratona.html?mode=create&room=${code}`);
});

socket.on('maratonaRoomJoined', (code) => {
    roomCode = code;
    setupMessage.textContent = `Connesso! In attesa dell'inizio...`;
    setupMessage.style.color = '#51cf66';
});

socket.on('maratonaGameStart', (data) => {
    gameStarted = true;
    setupContainer.style.display = 'none';
    gameContainer.style.display = 'flex';
    setupMessage.textContent = data.message;
    marathonGrid.innerHTML = ''; // Start clean

    // Create initial empty row for typing
    createTypingRow();
});

socket.on('maratonaGuessUpdate', (data) => {
    // data: { word, feedback, isOwner }

    // Remove the temporary typing row if it exists
    const typingRow = marathonGrid.querySelector('.typing-row');
    if (typingRow) typingRow.remove();

    // Add the committed guess row
    addCommittedRow(data.word, data.feedback, data.isOwner);

    // If it was my guess, clear current input and update keyboard
    if (data.isOwner) {
        currentGuess = '';
        // updateKeyboardFeedback(data.word, data.feedback); // REMOVED
    }

    // Re-add typing row for next guess
    createTypingRow();
    // Scroll to bottom
    marathonGrid.scrollTop = marathonGrid.scrollHeight;
});

socket.on('maratonaGameOver', (data) => {
    gameStarted = false;
    const amIWinner = data.winnerId === socket.id;

    if (amIWinner) {
        gameStatus.innerHTML = `<span style="color: #51cf66;">HAI VINTO! 🎉</span>`;
        audioWin.play().catch(e => console.log('Audio play failed', e));
    } else {
        gameStatus.innerHTML = `<span style="color: #ff6b6b;">HAI PERSO! 😔</span>`;
    }
    gameStatus.innerHTML += `<br>Parola: ${data.secretWord}`;

    createRematchButton();
});

socket.on('maratonaRematchStart', (data) => {
    gameStatus.textContent = data.message;
    resetGame();
});

socket.on('maratonaRematchRequested', (msg) => {
    gameStatus.textContent = msg;
});

socket.on('maratonaError', (msg) => {
    if (gameStarted) {
        // Show in-game error (e.g., using a toast or shaking the row)
        // For now, let's use a temporary status message or alert
        const oldStatus = gameStatus.innerHTML;
        gameStatus.innerHTML = `<span style="color: #ff6b6b;">${msg}</span>`;
        setTimeout(() => {
            if (gameStarted) gameStatus.innerHTML = oldStatus;
        }, 2000);

        // Shake animation on typing row
        const row = marathonGrid.querySelector('.typing-row');
        if (row) {
            row.classList.add('shake-anim');
            setTimeout(() => row.classList.remove('shake-anim'), 500);
        }
    } else {
        setupMessage.textContent = msg;
        setupMessage.style.color = '#ff6b6b';
    }
});

socket.on('maratonaPlayerLeft', (msg) => {
    alert(msg);
    window.location.href = 'index.html';
});


// ========== UI LOGIC ==========

function createTypingRow() {
    if (!gameStarted) return;
    const row = document.createElement('div');
    row.className = 'grid-row typing-row';
    // Style it to look like it belongs to me (blueish placeholder?) or neutral?
    // It's the row I'm typing in.

    for (let i = 0; i < WORD_LENGTH; i++) {
        const box = document.createElement('div');
        box.className = 'box';
        // Fill with currentGuess if any
        if (currentGuess[i]) {
            box.textContent = currentGuess[i];
            box.classList.add('pop-anim');
        }
        row.appendChild(box);
    }
    marathonGrid.appendChild(row);
    // Scroll to bottom
    marathonGrid.scrollTop = marathonGrid.scrollHeight;
}

function updateTypingRow() {
    const row = marathonGrid.querySelector('.typing-row');
    if (!row) return;

    const boxes = row.querySelectorAll('.box');
    boxes.forEach((box, i) => {
        box.textContent = currentGuess[i] || '';
        if (currentGuess[i]) {
            // box.classList.add('pop-anim'); // Optional: animation
        }
    });
}

function addCommittedRow(word, feedback, isOwner) {
    const row = document.createElement('div');
    row.className = `grid-row ${isOwner ? 'marathon-own' : 'marathon-opponent'}`;

    for (let i = 0; i < WORD_LENGTH; i++) {
        const box = document.createElement('div');
        box.className = 'box';
        box.textContent = word[i];

        // Add feedback colors ONLY if Owner
        if (isOwner && feedback) {
            const status = feedback[i];
            if (status === 'correct') box.classList.add('correct-position');
            else if (status === 'present') box.classList.add('wrong-position');
            else if (status === 'absent') box.classList.add('not-in-word');
        } else {
            // Opponent sees neutral (maybe greyed out or just red border from row class)
            box.classList.add('neutral-filled'); // Add a class for filled but no hint if needed
        }
        row.appendChild(box);
    }
    marathonGrid.appendChild(row);
}

function resetGame() {
    gameStarted = true;
    marathonGrid.innerHTML = '';
    currentGuess = '';

    // Remove rematch button
    const btn = document.getElementById('rematch-btn');
    if (btn) btn.remove();

    createTypingRow();
}

function createRematchButton() {
    const existingBtn = document.getElementById('rematch-btn');
    if (existingBtn) return;

    const btn = document.createElement('button');
    btn.id = 'rematch-btn';
    btn.className = 'primary-btn';
    btn.textContent = 'Rivincita 🔄';
    btn.onclick = () => {
        socket.emit('maratonaRematch');
        btn.textContent = 'In attesa...';
        btn.disabled = true;
    };

    gameContainer.insertBefore(btn, keyboardContainer);
}


// ========== INPUT ==========

function handleKeyInput(key) {
    if (!gameStarted) return;

    if (key === 'ENTER') {
        if (currentGuess.length === WORD_LENGTH) {
            socket.emit('submitMaratonaGuess', currentGuess);
        } else {
            // Shake animation or warning
        }
    } else if (key === '⌫' || key === 'BACKSPACE') {
        currentGuess = currentGuess.slice(0, -1);
        updateTypingRow();
    } else if (currentGuess.length < WORD_LENGTH) {
        if (/^[A-Z]$/.test(key)) {
            currentGuess += key;
            updateTypingRow();
        }
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleKeyInput('ENTER');
    else if (e.key === 'Backspace') handleKeyInput('BACKSPACE');
    else if (/^[a-zA-Z]$/.test(e.key)) handleKeyInput(e.key.toUpperCase());
});

// ========== NAVIGATION ==========
backToLobbySetupBtn.onclick = () => window.location.href = 'index.html';
backToLobbyGameBtn.onclick = () => {
    if (confirm('Vuoi davvero uscire?')) window.location.href = 'index.html';
};
