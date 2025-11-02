"""
VanityCert Widget Backend Proxy - Flask

This example shows how to create a secure proxy endpoint for the VanityCert widget.
The widget calls YOUR backend, and YOUR backend calls VanityCert API with your private API key.

Install dependencies:
    pip install flask requests

Environment variables needed:
    VANITYCERT_API_KEY_ID=vc_pk_abc123def456
    VANITYCERT_API_KEY=your_secret_key_here
    VANITYCERT_WEBHOOK_SECRET=whsec_your_secret_here (optional)
"""

import os
import hmac
import hashlib
import logging
from flask import Flask, request, jsonify
import requests

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# VanityCert API configuration
VANITYCERT_API_URL = os.environ.get('VANITYCERT_API_URL', 'https://app.vanitycert.com/api')
VANITYCERT_API_KEY_ID = os.environ.get('VANITYCERT_API_KEY_ID')  # e.g., vc_pk_abc123def456
VANITYCERT_API_KEY = os.environ.get('VANITYCERT_API_KEY')        # Your secret key
VANITYCERT_WEBHOOK_SECRET = os.environ.get('VANITYCERT_WEBHOOK_SECRET')

if not VANITYCERT_API_KEY_ID or not VANITYCERT_API_KEY:
    logger.error('ERROR: VANITYCERT_API_KEY_ID and VANITYCERT_API_KEY environment variables are required')
    exit(1)


@app.route('/api/vanitycert-proxy/<path:api_path>', methods=['GET', 'POST', 'PUT', 'DELETE'])
def vanitycert_proxy(api_path):
    """
    Proxy all VanityCert API requests

    POST /api/vanitycert-proxy/domains - Create domain
    GET  /api/vanitycert-proxy/domains/<id> - Get domain status
    DELETE /api/vanitycert-proxy/domains/<id> - Delete domain
    """
    try:
        # Optional: Add authentication/authorization checks here
        # if not current_user.is_authenticated:
        #     return jsonify({'error': 'Unauthorized'}), 401

        # Optional: Add rate limiting per user
        # check_rate_limit(current_user.id)

        # Build full URL
        url = f"{VANITYCERT_API_URL}/{api_path}"

        # Forward request to VanityCert API
        response = requests.request(
            method=request.method,
            url=url,
            headers={
                'X-API-KEY-ID': VANITYCERT_API_KEY_ID,
                'X-API-KEY': VANITYCERT_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            json=request.get_json() if request.is_json else None,
            timeout=30,
        )

        # Forward response back to widget
        return jsonify(response.json()), response.status_code

    except requests.exceptions.RequestException as e:
        logger.error(f'VanityCert proxy error: {str(e)}')
        return jsonify({
            'error': {
                'code': 'proxy_error',
                'message': 'Failed to connect to VanityCert API',
            }
        }), 500
    except Exception as e:
        logger.error(f'Unexpected error: {str(e)}')
        return jsonify({
            'error': {
                'code': 'internal_error',
                'message': 'Internal server error',
            }
        }), 500


@app.route('/webhooks/vanitycert', methods=['POST'])
def vanitycert_webhook():
    """
    Handle VanityCert webhook notifications
    """
    try:
        # Get raw body for signature verification
        payload = request.get_data()

        # Verify webhook signature (recommended)
        signature = request.headers.get('X-VanityCert-Signature')

        if VANITYCERT_WEBHOOK_SECRET:
            expected_signature = 'sha256=' + hmac.new(
                VANITYCERT_WEBHOOK_SECRET.encode('utf-8'),
                payload,
                hashlib.sha256
            ).hexdigest()

            if not hmac.compare_digest(signature, expected_signature):
                logger.error('Invalid webhook signature')
                return jsonify({'error': 'Invalid signature'}), 401

        # Parse webhook event
        event = request.get_json()
        logger.info(f"Received webhook: {event.get('event')} for {event.get('domain_url')}")

        # Process webhook asynchronously (recommended)
        # In production, use a task queue like Celery
        process_webhook(event)

        # Respond immediately
        return jsonify({'status': 'ok'}), 200

    except Exception as e:
        logger.error(f'Webhook error: {str(e)}')
        return jsonify({'error': 'Webhook processing failed'}), 500


def process_webhook(event):
    """
    Process webhook events

    Args:
        event (dict): Webhook event data
    """
    event_type = event.get('event')
    domain_url = event.get('domain_url')

    if event_type == 'certificate.issued':
        logger.info(f"Certificate issued for {domain_url}")
        # Update your database, send notification to user, etc.
        # Example:
        # domain = Domain.query.filter_by(url=domain_url).first()
        # domain.ssl_status = 'active'
        # db.session.commit()
        # send_email(domain.user.email, 'certificate_issued', domain=domain)

    elif event_type == 'certificate.validation_failed':
        reason = event.get('reason')
        logger.warning(f"Validation failed for {domain_url}: {reason}")
        # Send email to user about DNS configuration issue
        # Example:
        # domain = Domain.query.filter_by(url=domain_url).first()
        # send_email(domain.user.email, 'validation_failed', domain=domain, reason=reason)

    elif event_type == 'certificate.renewal_failed':
        reason = event.get('reason')
        logger.error(f"Renewal failed for {domain_url}: {reason}")
        # Alert operations team
        # Example:
        # send_slack_alert(f"Certificate renewal failed for {domain_url}: {reason}")

    else:
        logger.info(f'Unhandled webhook event: {event_type}')


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'ok'}), 200


# Optional: Rate limiting implementation
from functools import wraps
from time import time

rate_limit_cache = {}

def check_rate_limit(user_id, limit=60, window=60):
    """
    Simple in-memory rate limiting (use Redis in production)

    Args:
        user_id: User identifier
        limit: Max requests per window
        window: Time window in seconds
    """
    now = time()
    key = f'ratelimit:{user_id}'

    if key not in rate_limit_cache:
        rate_limit_cache[key] = []

    # Remove old requests outside the window
    rate_limit_cache[key] = [
        req_time for req_time in rate_limit_cache[key]
        if now - req_time < window
    ]

    if len(rate_limit_cache[key]) >= limit:
        raise Exception('Rate limit exceeded')

    rate_limit_cache[key].append(now)


def rate_limit(limit=60, window=60):
    """
    Rate limiting decorator

    Usage:
        @app.route('/api/endpoint')
        @rate_limit(limit=60, window=60)
        def endpoint():
            pass
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                # Assuming you have a current_user object
                # user_id = current_user.id
                # check_rate_limit(user_id, limit, window)
                pass
            except Exception as e:
                return jsonify({
                    'error': {
                        'code': 'rate_limit_exceeded',
                        'message': str(e),
                    }
                }), 429
            return f(*args, **kwargs)
        return decorated_function
    return decorator


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    logger.info(f'VanityCert proxy server running on port {port}')
    logger.info(f'Proxy endpoint: http://localhost:{port}/api/vanitycert-proxy')
    app.run(host='0.0.0.0', port=port, debug=False)
