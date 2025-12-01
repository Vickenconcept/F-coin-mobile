/**
 * Phanrise Icon Generator
 * 
 * This script generates all required app icons for Phanrise.
 * 
 * Usage:
 *   node scripts/generate-icons.js
 * 
 * Requirements:
 *   npm install sharp --save-dev
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('❌ Error: "sharp" package not found.');
  console.log('📦 Install it first: npm install sharp --save-dev');
  console.log('\n💡 Alternative: Use the HTML generator (generate-icons.html) in your browser');
  process.exit(1);
}

const outputDir = path.join(__dirname, '../assets/images');
const brandColor = '#FF6B00';

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

/**
 * Create a simple Phanrise icon as SVG
 */
function createLogoSVG() {
  return `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <!-- Background Circle -->
  <circle cx="256" cy="256" r="240" fill="${brandColor}"/>
  
  <!-- Letter P -->
  <text x="220" y="280" font-family="Arial, sans-serif" font-size="280" font-weight="bold" fill="white">P</text>
  
  <!-- Coin Circle -->
  <circle cx="360" cy="260" r="45" fill="white" opacity="0.95"/>
  <circle cx="360" cy="260" r="35" fill="${brandColor}"/>
  <circle cx="360" cy="260" r="20" fill="white"/>
</svg>
  `.trim();
}

/**
 * Generate icon from SVG
 */
async function generateIcon(size, filename) {
  const svg = createLogoSVG();
  const outputPath = path.join(outputDir, filename);
  
  try {
    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(outputPath);
    
    console.log(`✅ Generated: ${filename} (${size}×${size})`);
    return true;
  } catch (error) {
    console.error(`❌ Error generating ${filename}:`, error.message);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🎨 Generating Phanrise App Icons...\n');
  
  const results = await Promise.all([
    generateIcon(1024, 'icon.png'),
    generateIcon(1024, 'adaptive-icon.png'),
    generateIcon(2048, 'splash-icon.png'),
    generateIcon(48, 'favicon.png'),
  ]);
  
  const successCount = results.filter(r => r).length;
  
  console.log(`\n✨ Done! Generated ${successCount}/4 icon files.`);
  console.log(`📁 Files saved to: ${outputDir}`);
  console.log('\n🔄 Next steps:');
  console.log('   1. Run: npx expo prebuild --clean');
  console.log('   2. Build: eas build --platform android');
}

main().catch(console.error);

