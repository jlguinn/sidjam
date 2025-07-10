// File: themes.js
export const baseColorSchemes = [
    // Retro & Vibrant Themes (30)

// Light
    { name: "ABCD-Fault", interior: "#E4E4E4", exterior: "#F0F0F0", interiorTextColor: "#000000", exteriorTextColor: "#000000" },

// Red-Violet
    { name: "8-Bit Bloom", interior: "#F8F1F1", exterior: "#FFB6C1", interiorTextColor: "#4A2F2F", exteriorTextColor: "#000000" },
    { name: "Cyan Craze", interior: "#00FFFF", exterior: "#FF4500", interiorTextColor: "#000000", exteriorTextColor: "#FFFFFF" },
    { name: "Byte Blossom", interior: "#FFF0F5", exterior: "#DB7093", interiorTextColor: "#4A2F2F", exteriorTextColor: "#FFFFFF" },
    { name: "Pixel Peach", interior: "#FFEFD5", exterior: "#FF6F61", interiorTextColor: "#4A2F2F", exteriorTextColor: "#FFFFFF" },
    { name: "VHS Sunset", interior: "#FFF0F5", exterior: "#FF69B4", interiorTextColor: "#4A2F2F", exteriorTextColor: "#FFFFFF" },
    { name: "Synth Star", interior: "#F0F8FF", exterior: "#9400D3", interiorTextColor: "#483D8B", exteriorTextColor: "#FFFFFF" },
    { name: "Gold Rush", interior: "#FFD700", exterior: "#FF00FF", interiorTextColor: "#000000", exteriorTextColor: "#FFD700" },
    { name: "Cosmic Clash", interior: "#FFD700", exterior: "#4B0082", interiorTextColor: "#2F0047", exteriorTextColor: "#FFD700" },
    { name: "Glitch Core", interior: "#00FF7F", exterior: "#FF00FF", interiorTextColor: "#000000", exteriorTextColor: "#FFFFFF" },



// Blue
    { name: "Arcade Glow", interior: "#E0FFFF", exterior: "#00B7EB", interiorTextColor: "#2F4F4F", exteriorTextColor: "#000000" },
    { name: "Velvet Twilight", interior: "#E6E6FA", exterior: "#191970", interiorTextColor: "#191970", exteriorTextColor: "#E6E6FA" },
    { name: "Funky Fusion", interior: "#FFA500", exterior: "#00CED1", interiorTextColor: "#000000", exteriorTextColor: "#FFFFFF" },
    { name: "Red Rocket", interior: "#FF4500", exterior: "#00CED1", interiorTextColor: "#FFFFFF", exteriorTextColor: "#FF4500" },
    { name: "Floppy Disk", interior: "#F5F0E1", exterior: "#4682B4", interiorTextColor: "#2F4F4F", exteriorTextColor: "#FFFFFF" },    
    { name: "Miami Vice", interior: "#E6E6FA", exterior: "#00CED1", interiorTextColor: "#2F4F4F", exteriorTextColor: "#000000" },    
    { name: "Ocean Breeze", interior: "#E0FFFF", exterior: "#4682B4", interiorTextColor: "#2F4F4F", exteriorTextColor: "#E0FFFF" },


// Green 
    { name: "Retro Mint", interior: "#F5FFFA", exterior: "#3CB371", interiorTextColor: "#355E3B", exteriorTextColor: "#000000" },    
    { name: "Ivy Nook", interior: "#F0FFF0", exterior: "#006400", interiorTextColor: "#355E3B", exteriorTextColor: "#F0FFF0" },
    { name: "Ashen Pine", interior: "#F5F5F5", exterior: "#2E8B57", interiorTextColor: "#355E3B", exteriorTextColor: "#F5F5F5" },

// Yellow / Orange
    { name: "Lemon Pop", interior: "#FFFFE0", exterior: "#FFD700", interiorTextColor: "#8B5A2B", exteriorTextColor: "#000000" },
    { name: "Tangerine Dream", interior: "#FFFACD", exterior: "#FFA500", interiorTextColor: "#8B4513", exteriorTextColor: "#000000" },
    { name: "Emerald Flash", interior: "#00FF7F", exterior: "#FFDD47", interiorTextColor: "#000000", exteriorTextColor: "#FFFFFF" },

// Earthy / Dark
    { name: "Autumn Hearth", interior: "#F4E1D2", exterior: "#8B4513", interiorTextColor: "#3C2F2F", exteriorTextColor: "#F4E1D2" },
    { name: "Rustic Barn", interior: "#F5DEB3", exterior: "#8B4513", interiorTextColor: "#5C4033", exteriorTextColor: "#F5DEB3" },
    { name: "Winter Cabin", interior: "#D9E4DD", exterior: "#2F4F4F", interiorTextColor: "#2F4F4F", exteriorTextColor: "#D9E4DD" },
    { name: "Midnight Cocoa", interior: "#FFF8DC", exterior: "#2C1A0D", interiorTextColor: "#2C1A0D", exteriorTextColor: "#FFF8DC" },
    { name: "Mulled Wine", interior: "#FDF5E6", exterior: "#800020", interiorTextColor: "#4A2F2F", exteriorTextColor: "#FDF5E6" },
    { name: "Cyber Punk", interior: "#00FF7F", exterior: "#2F0047", interiorTextColor: "#000000", exteriorTextColor: "#00FF7F" },
    { name: "Punk Riot", interior: "#FF1493", exterior: "#000000", interiorTextColor: "#FFFFFF", exteriorTextColor: "#FF1493" },


// Loud
    { name: "Firecracker", interior: "#FF6347", exterior: "#FFFF00", interiorTextColor: "#000000", exteriorTextColor: "#FF6347" },
    { name: "Purple Punch", interior: "#9400D3", exterior: "#32CD32", interiorTextColor: "#FFFFFF", exteriorTextColor: "#9400D3" },
    { name: "Purple Haze", interior: "#9400D3", exterior: "#FFFF00", interiorTextColor: "#FFFFFF", exteriorTextColor: "#9400D3" }
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