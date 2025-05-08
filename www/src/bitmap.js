// Bitmap matrices
const guestBitmap = [
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,1,1,0,0,0,0,0,0],
    [0,0,0,0,1,1,1,1,1,1,1,0,0,0,0],
    [0,0,0,0,1,1,1,1,1,1,1,0,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,0,1,1,1,1,1,1,1,0,0,0,0],
    [0,0,0,0,1,1,1,1,1,1,1,0,0,0,0],
    [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

const profileBitmap = [
    [0,0,0,0,1,1,1,1,1,1,1,0,0,0,0],
    [0,0,1,1,0,0,0,0,0,0,0,1,1,0,0],
    [0,1,0,0,0,0,1,1,1,0,0,0,0,1,0],
    [1,0,0,0,1,1,1,1,1,1,1,0,0,0,1],
    [1,0,0,0,1,1,1,1,1,1,1,0,0,0,1],
    [0,1,0,1,0,0,0,0,0,0,0,1,0,1,0],
    [1,1,0,1,0,0,0,1,0,0,0,1,0,1,1],
    [1,1,0,1,0,0,1,1,1,0,0,1,0,1,1],
    [1,1,0,1,1,1,1,1,1,1,1,1,0,1,1],
    [0,1,0,0,1,1,1,1,1,1,1,0,0,1,0],
    [0,0,0,0,1,1,1,1,1,1,1,0,0,0,0],
    [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

const leftThumbUpBitmap = [
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,2,2,2,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,2,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,2,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,2,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,2,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,2,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,2,2,2,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,1,2,2,2,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,2,2,2,2,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,1,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,1,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,1,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,1,1,2,2,2,2,2,2,2,2,2,2,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,1,2,2,2,2,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
]

/*
const leftThumbUpBitmap = [
    [0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,1,2,2,2,1,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,1,2,2,2,2,2,1,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,2,2,2,2,2,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,2,2,2,2,2,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,2,2,2,2,2,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,2,2,2,2,2,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,1,2,2,2,2,2,2,2,1,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,2,2,2,1,1,1,1,1,0,0,0,0,0,0,0,0],
    [0,0,1,1,1,1,2,2,2,2,2,2,2,2,1,1,1,1,1,0,0,0,0],
    [0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,0],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,0],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
    [1,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,0,0],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0],
    [0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0],
    [0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0],
    [0,1,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0,0,0],
    [0,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0,0,0],
    [0,0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,0,0,0,0,0],
    [0,0,1,1,2,2,2,2,2,2,2,2,2,2,1,1,0,0,0,0,0,0,0],
    [0,0,0,0,1,2,2,2,2,1,1,1,1,1,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
]
*/

const leftThumbInBitmap = rotateBitmap(leftThumbUpBitmap, 90);
const leftThumbDownBitmap = rotateBitmap(leftThumbUpBitmap, 180);

const rightThumbupBitmap = flipBitmapHorizontally(leftThumbUpBitmap);
const rightThumbInBitmap = rotateBitmap(rightThumbupBitmap, -90);
const rightThumDownBitmap = rotateBitmap(rightThumbupBitmap, -180);


// Transformation utilities
export function flipBitmapHorizontally(bitmap) {
    return bitmap.map(row => [...row].reverse());
}

export function rotateBitmap(bitmap, degrees) {
    let rows = bitmap.length;
    let cols = bitmap[0].length;
    let result;

    degrees = ((degrees % 360) + 360) % 360;

    if (degrees === 0) {
        return bitmap.map(row => [...row]);
    } else if (degrees === 180) {
        return bitmap.map(row => [...row].reverse()).reverse();
    } else {
        result = Array(cols).fill().map(() => Array(rows).fill(0));
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                result[col][row] = bitmap[row][col];
            }
        }
        if (degrees === 90) {
            return result.map(row => [...row].reverse());
        } else { // 270° (-90°)
            return result.reverse();
        }
    }
}

// Core rendering function
export function renderBitmap(bitmap, domElement, pixelSize, primaryColor, secondaryColor) {
    if (!domElement) {
        console.error('DOM element for bitmap rendering not found.');
        return;
    }
    domElement.innerHTML = '';

    const rows = bitmap.length;
    const cols = bitmap[0].length;

    domElement.style.display = 'grid';
    domElement.style.gridTemplateColumns = `repeat(${cols}, ${pixelSize}px)`;
    domElement.style.gridTemplateRows = `repeat(${rows}, ${pixelSize}px)`;
    domElement.style.width = `${cols * pixelSize}px`;
    domElement.style.height = `${rows * pixelSize}px`;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const pixel = document.createElement('div');
            pixel.style.width = `${pixelSize}px`;
            pixel.style.height = `${pixelSize}px`;
            if (bitmap[row][col] === 1) {
                pixel.style.backgroundColor = primaryColor; // Outline color
            } else if (bitmap[row][col] === 2) {
                pixel.style.backgroundColor = secondaryColor; // Interior flesh color
            } else {
                pixel.style.backgroundColor = 'transparent'; // Empty pixels
            }
            domElement.appendChild(pixel);
        }
    }
}

// Profile bitmap rendering
export function renderProfileBitmap(isLoggedIn, color, pixelSize = 4, domElementId = 'profile-bitmap') {
    const domElement = document.getElementById(domElementId);
    const bitmap = isLoggedIn ? profileBitmap : guestBitmap;
    renderBitmap(bitmap, domElement, pixelSize, color);
}

// Global lock to prevent concurrent animations per button
const animationLocks = {
    'winner-left': false,
    'winner-right': false
};

export function renderWinnerButtonBitmap(contenderIndex, playerState) {
    const winnerButtonId = contenderIndex === 0 ? 'winner-left' : 'winner-right';
    const winnerButton = document.getElementById(winnerButtonId);
    if (!winnerButton) {
        window.logmsg(`Winner button for contender ${contenderIndex} (ID: ${winnerButtonId}) not found`, 0);
        return;
    }

    // Check if button is animating
    if (animationLocks[winnerButtonId]) {
        window.logmsg(`Animation locked for ${winnerButtonId}, skipping render`, 2);
        return;
    }

    // Determine new bitmap state
    let bitmap;
    const isWinner = playerState.winner === contenderIndex;
    const isBothSelected = playerState.bothContendersSelected;
    const isOtherWinner = playerState.winner !== null && playerState.winner !== contenderIndex;
    let newState;

    if (isWinner || (isBothSelected && playerState.activeBracket === "0 - 0")) {
        bitmap = contenderIndex === 0 ? leftThumbUpBitmap : rightThumbupBitmap;
        newState = 'up';
    } else if (isOtherWinner) {
        bitmap = contenderIndex === 0 ? leftThumbDownBitmap : rightThumDownBitmap;
        newState = 'down';
    } else {
        bitmap = contenderIndex === 0 ? leftThumbInBitmap : rightThumbInBitmap;
        newState = 'in';
    }

    // Get current bitmap state
    const currentState = winnerButton.dataset.bitmapState || 'in';

    // Determine rotation class
    let rotationClass = null;
    if (currentState !== newState) {
        if (contenderIndex === 0) {
            if (currentState === 'in' && newState === 'up') rotationClass = 'rotate-minus-90';
            else if (currentState === 'in' && newState == 'down') rotationClass = 'rotate-plus-90';
            else if (currentState === 'up' && newState === 'down') rotationClass = 'rotate-plus-180';
            else if (currentState === 'down' && newState === 'up') rotationClass = 'rotate-minus-180';
            else if (currentState === 'up' && newState === 'in') rotationClass = 'rotate-plus-90';
            else if (currentState === 'down' && newState === 'in') rotationClass = 'rotate-minus-90';
        } else {
            if (currentState === 'in' && newState === 'up') rotationClass = 'rotate-plus-90';
            else if (currentState === 'in' && newState === 'down') rotationClass = 'rotate-minus-90';
            else if (currentState === 'up' && newState === 'down') rotationClass = 'rotate-minus-180';
            else if (currentState === 'down' && newState === 'up') rotationClass = 'rotate-plus-180';
            else if (currentState === 'up' && newState === 'in') rotationClass = 'rotate-minus-90';
            else if (currentState === 'down' && newState === 'in') rotationClass = 'rotate-plus-90';
        }
    }

    // Apply rotation animation and delay bitmap redraw
    if (rotationClass) {
        animationLocks[winnerButtonId] = true; // Lock animation
        winnerButton.dataset.bitmapState = newState; // Update state immediately
        winnerButton.classList.add(rotationClass);
        winnerButton.style.opacity = '0.7';

        // Use requestAnimationFrame to wait for 500ms
        const startTime = performance.now();
        const animationDuration = 500; // 500ms

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            if (elapsed >= animationDuration) {
                // Redraw bitmap
                const primaryColor = '#000000';
                const secondaryColor = '#FFDAB9';
                const pixelSize = 2;
                renderBitmap(bitmap, winnerButton, pixelSize, primaryColor, secondaryColor);
                // Reset styles and unlock
                winnerButton.style.transform = 'none';
                winnerButton.style.opacity = '1';
                winnerButton.classList.remove(rotationClass);
                animationLocks[winnerButtonId] = false;
            } else {
                // Schedule next frame
                requestAnimationFrame(animate);
            }
        };

        // Start animation loop
        requestAnimationFrame(animate);
    } else {
        // Immediate render
        const primaryColor = '#000000';
        const secondaryColor = '#FFDAB9';
        const pixelSize = 2;
        renderBitmap(bitmap, winnerButton, pixelSize, primaryColor, secondaryColor);
        winnerButton.dataset.bitmapState = newState;
        winnerButton.style.transform = 'none';
        winnerButton.style.opacity = '1';
    }
}