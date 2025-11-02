/**
 * VanityCert Widget Backend Proxy - Express.js
 *
 * This example shows how to create a secure proxy endpoint for the VanityCert widget.
 * The widget calls YOUR backend, and YOUR backend calls VanityCert API with your private API key.
 *
 * Install dependencies:
 *   npm install express axios
 *
 * Environment variables needed:
 *   VANITYCERT_API_KEY_ID=vc_pk_abc123def456
 *   VANITYCERT_API_KEY=your_secret_key_here
 */

const express = require('express');
const axios = require('axios');

const app = express();

// IMPORTANT: Use raw body parser for this route only
app.use('/api/vanitycert-proxy', express.json());

// VanityCert API configuration
const VANITYCERT_API_URL = 'https://app.vanitycert.com/api';
const VANITYCERT_API_KEY_ID = process.env.VANITYCERT_API_KEY_ID; // e.g., vc_pk_abc123def456
const VANITYCERT_API_KEY = process.env.VANITYCERT_API_KEY;       // Your secret key

if (!VANITYCERT_API_KEY_ID || !VANITYCERT_API_KEY) {
  console.error('ERROR: VANITYCERT_API_KEY_ID and VANITYCERT_API_KEY environment variables are required');
  process.exit(1);
}

/**
 * Proxy all VanityCert API requests
 *
 * POST /api/vanitycert-proxy/domains - Create domain
 * GET  /api/vanitycert-proxy/domains/:id - Get domain status
 * DELETE /api/vanitycert-proxy/domains/:id - Delete domain
 */
app.all('/api/vanitycert-proxy/*', async (req, res) => {
  try {
    // Extract the path after /api/vanitycert-proxy
    const apiPath = req.params[0];
    const url = `${VANITYCERT_API_URL}/${apiPath}`;

    // Optional: Add authentication/authorization checks here
    // if (!req.user) {
    //   return res.status(401).json({ error: 'Unauthorized' });
    // }

    // Optional: Add rate limiting per user
    // await checkRateLimit(req.user.id);

    // Forward request to VanityCert API
    const response = await axios({
      method: req.method,
      url: url,
      headers: {
        'X-API-KEY-ID': VANITYCERT_API_KEY_ID,
        'X-API-KEY': VANITYCERT_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      data: req.body,
      validateStatus: null, // Don't throw on any status code
    });

    // Forward response back to widget
    res.status(response.status).json(response.data);

  } catch (error) {
    console.error('VanityCert proxy error:', error.message);

    if (error.response) {
      // API returned an error
      res.status(error.response.status).json(error.response.data);
    } else {
      // Network or other error
      res.status(500).json({
        error: {
          code: 'proxy_error',
          message: 'Failed to connect to VanityCert API',
        }
      });
    }
  }
});

// Optional: Webhook endpoint to receive VanityCert notifications
app.post('/webhooks/vanitycert', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Verify webhook signature (recommended)
    const signature = req.headers['x-vanitycert-signature'];
    const webhookSecret = process.env.VANITYCERT_WEBHOOK_SECRET;

    if (webhookSecret) {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(req.body)
        .digest('hex');

      if (signature !== `sha256=${expectedSignature}`) {
        console.error('Invalid webhook signature');
        return res.status(401).send('Invalid signature');
      }
    }

    // Parse webhook event
    const event = JSON.parse(req.body.toString());
    console.log('Received webhook:', event.event, event.domain_url);

    // Respond immediately
    res.status(200).send('OK');

    // Process webhook asynchronously
    await processWebhook(event);

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Error processing webhook');
  }
});

async function processWebhook(event) {
  switch (event.event) {
    case 'certificate.issued':
      console.log(`Certificate issued for ${event.domain_url}`);
      // Update your database, send notification to user, etc.
      break;

    case 'certificate.validation_failed':
      console.log(`Validation failed for ${event.domain_url}:`, event.reason);
      // Send email to user about DNS configuration issue
      break;

    case 'certificate.renewal_failed':
      console.log(`Renewal failed for ${event.domain_url}:`, event.reason);
      // Alert operations team
      break;

    default:
      console.log('Unhandled webhook event:', event.event);
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`VanityCert proxy server running on port ${PORT}`);
  console.log(`Proxy endpoint: http://localhost:${PORT}/api/vanitycert-proxy`);
});

module.exports = app;
