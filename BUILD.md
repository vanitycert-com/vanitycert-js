# Building Minified Versions

This guide explains how to create minified versions of the VanityCert widget files for production use.

## Quick Build (Using npx - No Installation Required)

```bash
# Minify JavaScript
npx terser vanitycert.js -o vanitycert.min.js -c -m --comments false

# Minify CSS
npx cssnano vanitycert.css vanitycert.min.css
```

## Alternative: Online Minifiers

If you prefer not to use npm tools, you can use online minifiers:

### JavaScript
1. Go to https://www.toptal.com/developers/javascript-minifier
2. Paste contents of `vanitycert.js`
3. Click "Minify"
4. Save as `vanitycert.min.js`

### CSS
1. Go to https://www.toptal.com/developers/cssminifier
2. Paste contents of `vanitycert.css`
3. Click "Minify"
4. Save as `vanitycert.min.css`

## Build Script

A `build.js` script is provided that uses npx (no permanent installation):

```bash
node build.js
```

This will create:
- `vanitycert.min.js` (minified JavaScript)
- `vanitycert.min.css` (minified CSS)

## Manual Build with Installed Tools

If you have a separate build project:

```bash
npm install terser cssnano-cli

# JavaScript
npx terser vanitycert.js \
  --output vanitycert.min.js \
  --compress \
  --mangle \
  --comments false

# CSS
npx cssnano vanitycert.css vanitycert.min.css
```

## Verification

After building, verify the files work:

1. Open `examples/demo.html`
2. Replace includes with minified versions:
   ```html
   <link rel="stylesheet" href="../vanitycert.min.css">
   <script src="../vanitycert.min.js"></script>
   ```
3. Test all functionality

## File Size Expectations

- `vanitycert.js`: ~18 KB
- `vanitycert.min.js`: ~8 KB (55% reduction)
- `vanitycert.css`: ~12 KB
- `vanitycert.min.css`: ~9 KB (25% reduction)

## Production Checklist

Before deploying to production:

- [ ] Minified files generated
- [ ] Tested in demo.html
- [ ] Source maps created (optional)
- [ ] Files uploaded to CDN
- [ ] Cache headers configured
- [ ] Gzip/Brotli compression enabled on server
