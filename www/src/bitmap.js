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

const leftThumbInBitmap = rotateBitmap(leftThumbUpBitmap, 90);
const leftThumbDownBitmap = rotateBitmap(leftThumbUpBitmap, 180);

const rightThumbupBitmap = flipBitmapHorizontally(leftThumbUpBitmap);
const rightThumInBitmap = rotateBitmap(rightThumbupBitmap, -90);
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

// Winner button rendering
export function renderWinnerButtonBitmap(contenderIndex, playerState) {
    const winnerButtonId = contenderIndex === 0 ? 'winner-left' : 'winner-right';
    const winnerButton = document.getElementById(winnerButtonId);
    if (!winnerButton) {
        window.logmsg(`Winner button for contender ${contenderIndex} (ID: ${winnerButtonId}) not found`, 0);
        return;
    }

    // Check disabled state for color adjustment
    const isDisabled = winnerButton.disabled;

    const primaryColor = '#000000'; 
    const secondaryColor = '#FFDAB9';

    // const primaryColor = isDisabled ? '#666666' : '#000000'; // Gray outline when disabled
    // const secondaryColor = isDisabled ? '#CCAA99' : '#FFDAB9'; // Muted flesh when disabled

    const isWinner = playerState.winner === contenderIndex;
    const isContenderSelected = playerState.selectedContender === contenderIndex;
    let bitmap = leftThumbUpBitmap;

    // Apply transformations based on contender index
    if (contenderIndex === 0) {
        // Left thumb: Rotate 90 degrees clockwise
        bitmap = rotateBitmap(leftThumbUpBitmap, 90);
    } else {
        // Right thumb: Flip horizontally, then rotate -90 degrees (counterclockwise)
        const flippedBitmap = flipBitmapHorizontally(leftThumbUpBitmap);
        bitmap = rotateBitmap(flippedBitmap, -90);
    }

    const pixelSize = 2; // Pixel size for bitmap rendering
    renderBitmap(bitmap, winnerButton, pixelSize, primaryColor, secondaryColor); 
}