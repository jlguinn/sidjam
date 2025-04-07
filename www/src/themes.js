// File: themes.js
export const baseColorSchemes = [
    {
        interior: '#f5f5dc',        // Beige
        exterior: '#d3d3d3',        // Light Gray
        interiorTextColor: '#000000', // Black
        exteriorTextColor: '#000000'  // Black
    },
    {
        interior: '#191970',        // Midnight Blue
        exterior: '#000080',        // Navy
        interiorTextColor: '#ffffff', // White
        exteriorTextColor: '#ffffff'  // White
    }
];

// Function to get the inverted theme for Now Playing Mode
export function getInvertedTheme(theme) {
    return {
        interior: theme.exterior,
        exterior: theme.interior,
        interiorTextColor: theme.exteriorTextColor,
        exteriorTextColor: theme.interiorTextColor
    };
}