# Publishing Guide

This guide explains how to publish the VanityCert Widget to npm.

## Prerequisites

1. **npm Account**: Create an account at https://www.npmjs.com
2. **npm CLI**: Ensure you have npm installed and logged in
3. **Organization Access**: If publishing under `@vanitycert`, you need access to the org

## Setup

### 1. Login to npm

```bash
npm login
```

Enter your npm credentials when prompted.

### 2. Verify Login

```bash
npm whoami
```

Should display your npm username.

### 3. Create npm Organization (First Time Only)

If publishing as `@vanitycert/widget`, create the organization:

```bash
npm org create vanitycert
```

Or change the package name in `package.json` to an unscoped name:
```json
{
  "name": "vanitycert-widget"
}
```

## Pre-Publish Checklist

- [ ] Update version in `package.json` (use semantic versioning)
- [ ] Update `CHANGELOG.md` with changes
- [ ] Build minified files: `npm run build`
- [ ] Test the widget locally
- [ ] Review `README.md` for accuracy
- [ ] Ensure all files are committed to git
- [ ] Tag the release in git

## Publishing

### 1. Build the Package

```bash
npm run build
```

This will create minified versions of JS and CSS.

### 2. Test the Package Locally

```bash
# Dry run to see what will be published
npm pack --dry-run

# Or create actual tarball
npm pack
```

Review the output to ensure only necessary files are included.

### 3. Publish to npm

#### First Release

```bash
npm publish --access public
```

Note: The `--access public` flag is required for scoped packages (@vanitycert/widget).

#### Subsequent Releases

```bash
# Patch release (1.0.0 -> 1.0.1)
npm version patch
npm publish

# Minor release (1.0.0 -> 1.1.0)
npm version minor
npm publish

# Major release (1.0.0 -> 2.0.0)
npm version major
npm publish
```

The `npm version` command will:
- Update version in `package.json`
- Create a git commit
- Create a git tag

## Post-Publish

### 1. Push to Git

```bash
git push
git push --tags
```

### 2. Create GitHub Release

1. Go to https://github.com/vanitycert/widget/releases
2. Click "Draft a new release"
3. Select the version tag
4. Add release notes from `CHANGELOG.md`
5. Publish release

### 3. Update Documentation

Update any external documentation that references the package:
- Installation instructions
- CDN links
- Version numbers

## CDN Setup (Optional)

After publishing to npm, the package is automatically available via CDNs:

### jsDelivr

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@vanitycert/widget@1/vanitycert.min.css">
<script src="https://cdn.jsdelivr.net/npm/@vanitycert/widget@1/vanitycert.min.js"></script>
```

### unpkg

```html
<link rel="stylesheet" href="https://unpkg.com/@vanitycert/widget@1/vanitycert.min.css">
<script src="https://unpkg.com/@vanitycert/widget@1/vanitycert.min.js"></script>
```

## Versioning Strategy

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0 -> 2.0.0): Breaking changes
- **MINOR** (1.0.0 -> 1.1.0): New features, backward compatible
- **PATCH** (1.0.0 -> 1.0.1): Bug fixes, backward compatible

Examples:
- Breaking API change → Major
- New callback added → Minor
- CSS bug fix → Patch
- Documentation update → Patch

## Unpublishing (Emergency Only)

If you need to unpublish a version:

```bash
# Unpublish specific version
npm unpublish @vanitycert/widget@1.0.0

# Unpublish entire package (within 72 hours)
npm unpublish @vanitycert/widget --force
```

**Warning**: Unpublishing is discouraged. Use deprecation instead:

```bash
npm deprecate @vanitycert/widget@1.0.0 "This version has a critical bug. Please upgrade to 1.0.1"
```

## Troubleshooting

### "You do not have permission to publish"

- Verify you're logged in: `npm whoami`
- Check organization access: `npm org ls vanitycert`
- Ensure `publishConfig.access` is set to `"public"` in package.json

### "Package name already taken"

- Choose a different name
- Or request ownership if you believe you should own it

### "Version already published"

- Increment version in `package.json`
- Use `npm version patch/minor/major` to update version

### Build fails

- Ensure Node.js 14+ is installed
- Run `npm install` to install dev dependencies
- Check for syntax errors in `build.js`

## Best Practices

1. **Always test before publishing**: Use `npm pack --dry-run`
2. **Keep CHANGELOG updated**: Document all changes
3. **Use git tags**: Tag releases for easy rollback
4. **Test in real projects**: Install published package and test
5. **Monitor downloads**: Check npm stats regularly
6. **Respond to issues**: Monitor GitHub issues and npm feedback
7. **Security updates**: Keep dependencies updated

## Support

For help with publishing:
- npm documentation: https://docs.npmjs.com/
- npm support: https://npmjs.com/support
- Internal: contact DevOps team

## Checklist Template

Copy this for each release:

```
Release v1.0.0 Checklist:
- [ ] Code complete and tested
- [ ] Version bumped in package.json
- [ ] CHANGELOG.md updated
- [ ] README.md reviewed
- [ ] npm run build successful
- [ ] npm pack --dry-run reviewed
- [ ] npm publish completed
- [ ] Git tagged and pushed
- [ ] GitHub release created
- [ ] Documentation updated
- [ ] Team notified
```
