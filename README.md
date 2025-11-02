# VanityCert JavaScript Widget

A lightweight, embeddable JavaScript widget that allows your users to provision SSL certificates directly on your website without redirecting to VanityCert's white-label portal.

## Features

- **Zero Dependencies** - Pure vanilla JavaScript, no frameworks required
- **Secure** - Uses your backend as a proxy to keep API keys private
- **Customizable** - Full theming support via CSS custom properties
- **Persistent State** - LocalStorage-based state management per user
- **Responsive** - Works on desktop, tablet, and mobile devices
- **4-Step Process** - Enter domain → Validate DNS → Issue certificate → Done
- **Auto-polling** - Automatic status updates without manual refresh
- **Callback System** - React to events in your application

## Quick Start

### 1. Include the Widget Files

Add the CSS and JavaScript files to your HTML:

```html
<link rel="stylesheet" href="/path/to/vanitycert.css">
<script src="/path/to/vanitycert.js"></script>
```

### 2. Add Container Element

```html
<div id="ssl-widget"></div>
```

### 3. Initialize the Widget

```javascript
VanityCert.init({
  target: '#ssl-widget',
  apiEndpoint: '/api/vanitycert-proxy',
  serverId: 123,
  userId: 'user-' + currentUser.id
});
```

### 4. Create Backend Proxy

The widget requires a backend proxy to securely call the VanityCert API. See [Backend Proxy Examples](#backend-proxy-examples) below.

## Installation

### CDN

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@vanitycert/widget@1/vanitycert.min.css">
<script src="https://cdn.jsdelivr.net/npm/@vanitycert/widget@1/vanitycert.min.js"></script>
```

### NPM

```bash
npm install @vanitycert/widget
```

### Self-Hosted

1. Download `vanitycert.js` and `vanitycert.css`
2. Place them in your public directory
3. Include them in your HTML

## Configuration Options

### Required Options

| Option | Type | Description |
|--------|------|-------------|
| `target` | string | CSS selector for the container element |
| `apiEndpoint` | string | Your backend proxy endpoint URL |
| `serverId` | number | VanityCert server ID where certificates will be installed |
| `userId` | string | Unique identifier for the current user (for state persistence) |

### Optional Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `theme` | object | `{}` | Custom theme colors (see [Theming](#theming)) |
| `callbacks` | object | `{}` | Event callbacks (see [Callbacks](#callbacks)) |
| `pollInterval` | number | `5000` | Status polling interval in milliseconds (certificate issuance) |
| `dnsPollInterval` | number | `10000` | DNS validation polling interval in milliseconds |

## Complete Example

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="/js/vanitycert-widget/vanitycert.css">
</head>
<body>
  <div id="ssl-widget"></div>

  <script src="/js/vanitycert-widget/vanitycert.js"></script>
  <script>
    // Initialize widget
    VanityCert.init({
      target: '#ssl-widget',
      apiEndpoint: '/api/vanitycert-proxy',
      serverId: 123,
      userId: 'user-' + currentUser.id,

      // Custom theme
      theme: {
        primaryColor: '#10243f',
        secondaryColor: '#1867a0',
        successColor: '#28a745'
      },

      // Event callbacks
      callbacks: {
        onDomainCreated: function(domain) {
          console.log('Domain created:', domain);
          // Track in analytics
          analytics.track('SSL Setup Started', { domain: domain.url });
        },

        onDnsValidated: function(domain) {
          console.log('DNS validated:', domain);
        },

        onCertificateIssued: function(domain) {
          console.log('Certificate issued:', domain);
          // Show success notification
          showNotification('SSL certificate ready!', 'success');
        },

        onValidationFailed: function(domain, reason) {
          console.error('Validation failed:', reason);
          // Send email to user
          fetch('/api/notify-dns-issue', {
            method: 'POST',
            body: JSON.stringify({ userId: currentUser.id, domain: domain.url })
          });
        },

        onError: function(error) {
          console.error('Widget error:', error);
          // Log to error tracking service
          Sentry.captureException(new Error(error.message));
        },

        onComplete: function(domain) {
          console.log('Setup complete:', domain);
          // Redirect or update UI
          window.location.href = '/dashboard';
        }
      }
    });
  </script>
</body>
</html>
```

## Backend Proxy Examples

The widget cannot call the VanityCert API directly because that would expose your private API key in the browser. Instead, you must create a backend proxy endpoint.

### Express.js (Node.js)

See [examples/backend-proxy/express.js](examples/backend-proxy/express.js)

```javascript
const express = require('express');
const axios = require('axios');
const app = express();

app.use('/api/vanitycert-proxy', express.json());

app.all('/api/vanitycert-proxy/*', async (req, res) => {
  const apiPath = req.params[0];
  const url = `https://app.vanitycert.com/api/${apiPath}`;

  const response = await axios({
    method: req.method,
    url: url,
    headers: {
      'X-API-KEY-ID': process.env.VANITYCERT_API_KEY_ID,
      'X-API-KEY': process.env.VANITYCERT_API_KEY,
      'Content-Type': 'application/json',
    },
    data: req.body,
    validateStatus: null,
  });

  res.status(response.status).json(response.data);
});

app.listen(3000);
```

### Laravel (PHP)

See [examples/backend-proxy/VanityCertProxyController.php](examples/backend-proxy/VanityCertProxyController.php)

```php
// routes/api.php
Route::any('vanitycert-proxy/{path}', [VanityCertProxyController::class, 'proxy'])
     ->where('path', '.*');

// app/Http/Controllers/VanityCertProxyController.php
public function proxy(Request $request, string $path)
{
    $url = "https://app.vanitycert.com/api/{$path}";

    $response = Http::withHeaders([
        'X-API-KEY-ID' => config('services.vanitycert.api_key_id'),
        'X-API-KEY' => config('services.vanitycert.api_key'),
    ])->send($request->method(), $url, ['json' => $request->all()]);

    return response()->json($response->json(), $response->status());
}
```

### Flask (Python)

See [examples/backend-proxy/flask_app.py](examples/backend-proxy/flask_app.py)

```python
import os
import requests
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/api/vanitycert-proxy/<path:api_path>', methods=['GET', 'POST', 'DELETE'])
def vanitycert_proxy(api_path):
    url = f"https://app.vanitycert.com/api/{api_path}"

    response = requests.request(
        method=request.method,
        url=url,
        headers={
            'X-API-KEY-ID': os.environ['VANITYCERT_API_KEY_ID'],
            'X-API-KEY': os.environ['VANITYCERT_API_KEY'],
            'Content-Type': 'application/json',
        },
        json=request.get_json() if request.is_json else None,
    )

    return jsonify(response.json()), response.status_code
```

## Callbacks

The widget provides callbacks for all major events:

### onDomainCreated

Called when a domain is successfully created in VanityCert.

```javascript
onDomainCreated: function(domain) {
  // domain = { id, url, dns_status, ssl_status, created_at }
  console.log('Domain created:', domain.url);
}
```

### onDnsValidated

Called when DNS validation succeeds.

```javascript
onDnsValidated: function(domain) {
  console.log('DNS validated for:', domain.url);
}
```

### onCertificateIssued

Called when the SSL certificate is issued and active.

```javascript
onCertificateIssued: function(domain) {
  console.log('Certificate issued for:', domain.url);
}
```

### onValidationFailed

Called when DNS validation fails after 24 hours.

```javascript
onValidationFailed: function(domain, reason) {
  // Send email to user
  emailUser(domain.url, reason);
}
```

### onError

Called when any error occurs (network issues, API errors, etc).

```javascript
onError: function(error) {
  // error = { code, message, details }
  console.error('Error:', error.message);
}
```

### onComplete

Called when the user clicks "Done" on the final success screen.

```javascript
onComplete: function(domain) {
  // Redirect or update UI
  window.location.href = '/dashboard';
}
```

## Theming

Customize the widget appearance using CSS custom properties:

### JavaScript Theme Object

```javascript
VanityCert.init({
  target: '#ssl-widget',
  // ... other options
  theme: {
    primaryColor: '#10243f',
    secondaryColor: '#1867a0',
    tertiaryColor: '#92c2e9',
    successColor: '#28a745',
    errorColor: '#dc3545',
    fontFamily: '"Helvetica Neue", Arial, sans-serif'
  }
});
```

### CSS Custom Properties

Alternatively, override CSS variables in your stylesheet:

```css
:root {
  /* Brand Colors */
  --vc-primary-color: #10243f;
  --vc-secondary-color: #1867a0;
  --vc-tertiary-color: #92c2e9;
  --vc-success-color: #28a745;
  --vc-error-color: #dc3545;

  /* Typography */
  --vc-font-family: "Helvetica Neue", Arial, sans-serif;
  --vc-font-size-base: 16px;

  /* Spacing */
  --vc-border-radius: 8px;
  --vc-spacing-md: 16px;
}
```

### Available Theme Variables

See [vanitycert.css](vanitycert.css) for the complete list of customizable CSS variables.

## API Methods

### VanityCert.init(config)

Initialize a new widget instance.

```javascript
const widget = VanityCert.init({
  target: '#ssl-widget',
  apiEndpoint: '/api/proxy',
  serverId: 123,
  userId: 'user-123'
});
```

Returns: `VanityCertWidget` instance

### VanityCert.getInstance(target)

Get an existing widget instance.

```javascript
const widget = VanityCert.getInstance('#ssl-widget');
```

Returns: `VanityCertWidget` instance or `null`

### VanityCert.destroy(target)

Destroy a widget instance and clean up.

```javascript
VanityCert.destroy('#ssl-widget');
```

## Widget Instance Methods

### widget.handleRetry()

Retry domain setup after validation failure.

```javascript
const widget = VanityCert.getInstance('#ssl-widget');
widget.handleRetry();
```

### widget.handleCancel()

Cancel domain setup and reset widget.

```javascript
widget.handleCancel();
```

### widget.handleDone()

Complete the setup process (called automatically on success screen).

```javascript
widget.handleDone();
```

## State Management

The widget automatically persists state to LocalStorage using the key `vanitycert_${userId}`. This allows users to:

- Return to the setup page and see their progress
- Continue where they left off if they navigate away
- See the current status of their domain

State is cleared when:
- User clicks "Done" on success screen
- User clicks "Cancel" during setup
- `widget.handleDone()` or `widget.handleCancel()` is called

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Security Considerations

### Never Expose API Keys in Frontend

❌ **Wrong:**
```javascript
// DON'T DO THIS!
VanityCert.init({
  apiKey: 'vc_live_...'  // NEVER put API key in frontend
});
```

✅ **Correct:**
```javascript
// Use backend proxy
VanityCert.init({
  apiEndpoint: '/api/vanitycert-proxy'  // Your backend handles API key
});
```

### Backend Proxy Security

Your backend proxy should:

1. **Authenticate requests** - Verify user is logged in
2. **Rate limit** - Prevent abuse
3. **Validate input** - Check domain format, server_id ownership
4. **Log requests** - Track API usage

### Webhook Verification

Always verify webhook signatures in your backend:

```javascript
const crypto = require('crypto');

const signature = request.headers['x-vanitycert-signature'];
const expectedSignature = 'sha256=' + crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(rawBody)
  .digest('hex');

if (signature !== expectedSignature) {
  throw new Error('Invalid signature');
}
```

## Troubleshooting

### Widget Not Rendering

Check that:
1. CSS file is loaded: `<link rel="stylesheet" href="/path/to/vanitycert.css">`
2. JS file is loaded: `<script src="/path/to/vanitycert.js"></script>`
3. Container element exists: `<div id="ssl-widget"></div>`
4. Init called after DOM ready

### API Errors

If you see "Failed to connect to VanityCert API":
1. Check backend proxy is running
2. Verify API key in backend environment variables
3. Check CORS settings if proxy on different domain
4. Check browser console for network errors

### DNS Validation Stuck

If DNS validation doesn't progress:
1. Verify CNAME record is configured: `dig domain.com CNAME`
2. Check CNAME points to `my.vanitycert.com`
3. Wait 5-30 minutes for DNS propagation
4. Check for conflicting A/AAAA records

### State Not Persisting

If state resets on page reload:
1. Check `userId` is provided and consistent
2. Verify LocalStorage is enabled in browser
3. Check for browser privacy settings blocking storage

## Examples

See the [examples](examples/) directory for complete integration examples:

- **HTML Demo** - Basic HTML page with widget
- **Express.js** - Node.js backend proxy
- **Laravel** - PHP backend proxy
- **Flask** - Python backend proxy

## Support

- **Documentation**: https://docs.vanitycert.com
- **API Reference**: https://app.vanitycert.com/api/docs
- **Email**: support@vanitycert.com
- **Dashboard**: https://app.vanitycert.com

## License

Proprietary - © 2025 VanityCert

## Changelog

### Version 1.0.0 (2025-01-01)

- Initial release
- 4-step SSL provisioning flow
- LocalStorage state persistence
- Full theming support
- Comprehensive callback system
- Backend proxy architecture
