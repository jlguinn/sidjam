// Draw a sine wave on a given canvas
export function drawSineWave(canvasId, frequency, amplitude, phaseOffset, time) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        window.logmsg(`Canvas with ID ${canvasId} not found`, 1);
        return;
    }
    const ctx = canvas.getContext('2d');
    const width = canvas.width; // 250
    const height = canvas.height; // 100
    const midY = height / 2;

    // Clear the canvas
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#444'; // Background color from styles.css
    ctx.fillRect(0, 0, width, height);

    // Draw sine wave
    ctx.beginPath();
    ctx.strokeStyle = '#00FF00'; // Bright green, as chosen
    ctx.lineWidth = 2; // Consistent line width

    for (let x = 0; x < width; x++) {
        const t = x / width; // Normalize x to [0, 1]
        const angle = 2 * Math.PI * frequency * t + phaseOffset + time;
        const y = midY + amplitude * Math.sin(angle);
        if (x === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
}

// Animation loop for all three voice canvases
function animateSineWaves() {
    const time = Date.now() * 0.001; // Time in seconds for animation
    drawSineWave('voice1-canvas', 2, 30, 0, time); // Voice 1: 2 cycles
    drawSineWave('voice2-canvas', 3, 30, Math.PI / 4, time); // Voice 2: 3 cycles, slight phase shift
    drawSineWave('voice3-canvas', 4, 30, Math.PI / 2, time); // Voice 3: 4 cycles, larger phase shift
    requestAnimationFrame(animateSineWaves);
}

// Initialize visualizations
function initVisualizations() {
    window.logmsg('Initializing sine wave test visualizations', 1);
    animateSineWaves();
}

// Start visualizations when the DOM is ready
document.addEventListener('DOMContentLoaded', initVisualizations);

// Export init function for potential external control
export { initVisualizations };