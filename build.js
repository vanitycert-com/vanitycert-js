#!/usr/bin/env node

/**
 * VanityCert Widget Build Script
 *
 * This script minifies the JavaScript and CSS files using npx (no installation required).
 *
 * Usage:
 *   node build.js
 *
 * Requirements:
 *   - Node.js 14+ (for npx)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FILES = {
  js: {
    source: 'vanitycert.js',
    output: 'vanitycert.min.js'
  },
  css: {
    source: 'vanitycert.css',
    output: 'vanitycert.min.css'
  }
};

console.log('🔨 Building VanityCert Widget...\n');

// Check if source files exist
function checkSourceFiles() {
  const missing = [];

  if (!fs.existsSync(FILES.js.source)) {
    missing.push(FILES.js.source);
  }
  if (!fs.existsSync(FILES.css.source)) {
    missing.push(FILES.css.source);
  }

  if (missing.length > 0) {
    console.error('❌ Error: Source files not found:');
    missing.forEach(file => console.error(`   - ${file}`));
    process.exit(1);
  }
}

// Get file size in KB
function getFileSize(filepath) {
  const stats = fs.statSync(filepath);
  return (stats.size / 1024).toFixed(2);
}

// Minify JavaScript
function minifyJavaScript() {
  console.log('📦 Minifying JavaScript...');

  try {
    execSync(
      `npx terser ${FILES.js.source} -o ${FILES.js.output} -c -m --comments false`,
      { stdio: 'inherit' }
    );

    const originalSize = getFileSize(FILES.js.source);
    const minifiedSize = getFileSize(FILES.js.output);
    const reduction = ((1 - minifiedSize / originalSize) * 100).toFixed(1);

    console.log(`   ✓ ${FILES.js.source} → ${FILES.js.output}`);
    console.log(`   ✓ ${originalSize} KB → ${minifiedSize} KB (${reduction}% reduction)\n`);

    return true;
  } catch (error) {
    console.error('   ❌ Failed to minify JavaScript');
    console.error('   Error:', error.message);
    return false;
  }
}

// Minify CSS
function minifyCSS() {
  console.log('🎨 Minifying CSS...');

  try {
    // Read source CSS
    const css = fs.readFileSync(FILES.css.source, 'utf8');

    // Simple CSS minification (remove comments, whitespace, etc.)
    const minified = css
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/\s*([{}:;,])\s*/g, '$1') // Remove spaces around special chars
      .replace(/;}/g, '}') // Remove last semicolon in block
      .trim();

    fs.writeFileSync(FILES.css.output, minified, 'utf8');

    const originalSize = getFileSize(FILES.css.source);
    const minifiedSize = getFileSize(FILES.css.output);
    const reduction = ((1 - minifiedSize / originalSize) * 100).toFixed(1);

    console.log(`   ✓ ${FILES.css.source} → ${FILES.css.output}`);
    console.log(`   ✓ ${originalSize} KB → ${minifiedSize} KB (${reduction}% reduction)\n`);

    return true;
  } catch (error) {
    console.error('   ❌ Failed to minify CSS');
    console.error('   Error:', error.message);
    return false;
  }
}

// Main build process
function build() {
  checkSourceFiles();

  const jsSuccess = minifyJavaScript();
  const cssSuccess = minifyCSS();

  if (jsSuccess && cssSuccess) {
    console.log('✅ Build complete!\n');
    console.log('📁 Output files:');
    console.log(`   - ${FILES.js.output}`);
    console.log(`   - ${FILES.css.output}`);
    console.log('\n💡 Test the minified files by updating examples/demo.html');
  } else {
    console.error('\n❌ Build failed. See errors above.');
    process.exit(1);
  }
}

// Run build
build();
