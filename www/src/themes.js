// File: themes.js
export const baseColorSchemes = [
    // Retro & Vibrant Themes (30)
    { name: "Arcade Glow", interior: "#E0FFFF", exterior: "#00B7EB", interiorTextColor: "#2F4F4F", exteriorTextColor: "#000000" },
    { name: "Pixel Peach", interior: "#FFEFD5", exterior: "#FF6F61", interiorTextColor: "#4A2F2F", exteriorTextColor: "#FFFFFF" },
    { name: "C64 Blue", interior: "#E6F0FA", exterior: "#4169E1", interiorTextColor: "#2F4F4F", exteriorTextColor: "#FFFFFF" },    
    { name: "Retro Rocket", interior: "#F5F5F5", exterior: "#FF4500", interiorTextColor: "#3C2F2F", exteriorTextColor: "#FFFFFF" },
    { name: "Sprite Spark", interior: "#F8F8FF", exterior: "#32CD32", interiorTextColor: "#355E3B", exteriorTextColor: "#000000" },    
    { name: "Toxic Glow", interior: "#32CD32", exterior: "#FF00FF", interiorTextColor: "#000000", exteriorTextColor: "#FFFFFF" },
    { name: "Floppy Disk", interior: "#F5F0E1", exterior: "#4682B4", interiorTextColor: "#2F4F4F", exteriorTextColor: "#FFFFFF" },
    { name: "Rustic Barn", interior: "#F5DEB3", exterior: "#8B4513", interiorTextColor: "#5C4033", exteriorTextColor: "#F5DEB3" },
    { name: "Midnight Cocoa", interior: "#FFF8DC", exterior: "#2C1A0D", interiorTextColor: "#2C1A0D", exteriorTextColor: "#FFF8DC" },
    { name: "Cosmic Clash", interior: "#FFD700", exterior: "#4B0082", interiorTextColor: "#2F0047", exteriorTextColor: "#FFD700" },
    { name: "Sneaky Pink", interior: "#FF1493", exterior: "#000000", interiorTextColor: "#FFFFFF", exteriorTextColor: "#FF1493" },
    { name: "Purple Haze", interior: "#9400D3", exterior: "#FFFF00", interiorTextColor: "#FFFFFF", exteriorTextColor: "#9400D3" },
    { name: "Violet Volt", interior: "#9400D3", exterior: "#00FFFF", interiorTextColor: "#FFFFFF", exteriorTextColor: "#9400D3" },
    { name: "Rasta Road", interior: "#FF0000", exterior: "#008000", interiorTextColor: "#FFFFFF", exteriorTextColor: "#FFFF00" },
    { name: "Pink Panther", interior: "#FF69B4", exterior: "#000080", interiorTextColor: "#FFFFFF", exteriorTextColor: "#FF69B4" },
    { name: "Crimson Bolt", interior: "#DC143C", exterior: "#00FF00", interiorTextColor: "#FFFFFF", exteriorTextColor: "#DC143C" },
    { name: "Red Rocket", interior: "#FF4500", exterior: "#00CED1", interiorTextColor: "#FFFFFF", exteriorTextColor: "#FF4500" },
    { name: "Maple Glaze", interior: "#FAEBD7", exterior: "#8B0000", interiorTextColor: "#4A2F2F", exteriorTextColor: "#FAEBD7" },    
    { name: "Winter Cabin", interior: "#D9E4DD", exterior: "#2F4F4F", interiorTextColor: "#2F4F4F", exteriorTextColor: "#D9E4DD" },
    { name: "Gold Rush", interior: "#FFD700", exterior: "#FF00FF", interiorTextColor: "#000000", exteriorTextColor: "#FFD700" },

    { name: "Cyber Punk", interior: "#00FF7F", exterior: "#2F0047", interiorTextColor: "#000000", exteriorTextColor: "#00FF7F" },
    { name: "Midnight Neon", interior: "#00FF00", exterior: "#191970", interiorTextColor: "#000000", exteriorTextColor: "#00FF00" },

    { name: "Saffron Dawn", interior: "#FFFACD", exterior: "#FF8247", interiorTextColor: "#8B4513", exteriorTextColor: "#FFFACD" },
    { name: "Teal Tempest", interior: "#008080", exterior: "#FF6347", interiorTextColor: "#FFFFFF", exteriorTextColor: "#008080" },
    { name: "Solar Flare", interior: "#FFFF00", exterior: "#FF4500", interiorTextColor: "#000000", exteriorTextColor: "#FFFFFF" },    
    { name: "Rose Quartz", interior: "#FFE4E1", exterior: "#BC8F8F", interiorTextColor: "#4A2F2F", exteriorTextColor: "#FFE4E1" },
    { name: "Mulled Wine", interior: "#FDF5E6", exterior: "#800020", interiorTextColor: "#4A2F2F", exteriorTextColor: "#FDF5E6" },
    { name: "Pebble Shore", interior: "#F5F5F5", exterior: "#696969", interiorTextColor: "#2F4F4F", exteriorTextColor: "#F5F5F5" },
    { name: "Birch Whisper", interior: "#F8F8FF", exterior: "#D2B48C", interiorTextColor: "#5C4033", exteriorTextColor: "#F8F8FF" },
    { name: "Stone Hearth", interior: "#F8F8FF", exterior: "#2F4F4F", interiorTextColor: "#2F4F4F", exteriorTextColor: "#F8F8FF" },
    { name: "Chai Latte", interior: "#FAEBD7", exterior: "#8B5A2B", interiorTextColor: "#5C4033", exteriorTextColor: "#FAEBD7" },

    { name: "Frosty Mint", interior: "#F5FFFA", exterior: "#3CB371", interiorTextColor: "#2F4F4F", exteriorTextColor: "#F5FFFA" },
    { name: "Ashen Pine", interior: "#F5F5F5", exterior: "#2E8B57", interiorTextColor: "#355E3B", exteriorTextColor: "#F5F5F5" },
    { name: "Cedar Wood", interior: "#F5F0E1", exterior: "#5C4033", interiorTextColor: "#3C2F2F", exteriorTextColor: "#F5F0E1" },
    { name: "Butterscotch Glow", interior: "#FFF8DC", exterior: "#FFA54F", interiorTextColor: "#8B5A2B", exteriorTextColor: "#FFF8DC" },


    { name: "Lava Flow", interior: "#FF6347", exterior: "#1C2526", interiorTextColor: "#FFFFFF", exteriorTextColor: "#FF6347" }

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