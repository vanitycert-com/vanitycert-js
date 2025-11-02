<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * VanityCert Widget Backend Proxy - Laravel
 *
 * This controller provides a secure proxy endpoint for the VanityCert widget.
 * The widget calls YOUR backend, and YOUR backend calls VanityCert API with your private API key.
 *
 * Installation:
 * 1. Add this controller to app/Http/Controllers/VanityCertProxyController.php
 * 2. Add routes to routes/api.php:
 *    Route::any('vanitycert-proxy/{path}', [VanityCertProxyController::class, 'proxy'])
 *         ->where('path', '.*')
 *         ->middleware('auth'); // Optional: add authentication
 * 3. Add to .env:
 *    VANITYCERT_API_KEY_ID=vc_pk_abc123def456
 *    VANITYCERT_API_KEY=your_secret_key_here
 *    VANITYCERT_API_URL=https://app.vanitycert.com/api
 */
class VanityCertProxyController extends Controller
{
    private const API_URL = 'https://app.vanitycert.com/api';

    /**
     * Proxy all requests to VanityCert API
     *
     * @param Request $request
     * @param string $path
     * @return \Illuminate\Http\JsonResponse
     */
    public function proxy(Request $request, string $path)
    {
        try {
            // Get API keys from environment
            $apiKeyId = config('services.vanitycert.api_key_id');
            $apiKey = config('services.vanitycert.api_key');

            if (!$apiKeyId || !$apiKey) {
                return response()->json([
                    'error' => [
                        'code' => 'configuration_error',
                        'message' => 'VanityCert API keys not configured',
                    ]
                ], 500);
            }

            // Optional: Add authentication check
            // if (!auth()->check()) {
            //     return response()->json(['error' => 'Unauthorized'], 401);
            // }

            // Optional: Add rate limiting per user
            // $this->checkRateLimit(auth()->id());

            // Build full URL
            $url = rtrim(config('services.vanitycert.api_url', self::API_URL), '/') . '/' . $path;

            // Forward request to VanityCert API
            $response = Http::withHeaders([
                'X-API-KEY-ID' => $apiKeyId,
                'X-API-KEY' => $apiKey,
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            ])
            ->send($request->method(), $url, [
                'json' => $request->all(),
            ]);

            // Forward response back to widget
            return response()->json(
                $response->json(),
                $response->status()
            );

        } catch (\Exception $e) {
            Log::error('VanityCert proxy error: ' . $e->getMessage(), [
                'path' => $path,
                'method' => $request->method(),
            ]);

            return response()->json([
                'error' => [
                    'code' => 'proxy_error',
                    'message' => 'Failed to connect to VanityCert API',
                ]
            ], 500);
        }
    }

    /**
     * Handle VanityCert webhook notifications
     *
     * Add to routes/api.php:
     * Route::post('webhooks/vanitycert', [VanityCertProxyController::class, 'webhook']);
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function webhook(Request $request)
    {
        try {
            // Verify webhook signature (recommended)
            $signature = $request->header('X-VanityCert-Signature');
            $webhookSecret = config('services.vanitycert.webhook_secret');

            if ($webhookSecret) {
                $expectedSignature = 'sha256=' . hash_hmac(
                    'sha256',
                    $request->getContent(),
                    $webhookSecret
                );

                if (!hash_equals($expectedSignature, $signature)) {
                    Log::error('Invalid VanityCert webhook signature');
                    return response()->json(['error' => 'Invalid signature'], 401);
                }
            }

            // Get event data
            $event = $request->all();
            Log::info('VanityCert webhook received', [
                'event' => $event['event'] ?? 'unknown',
                'domain' => $event['domain_url'] ?? null,
            ]);

            // Respond immediately
            $response = response()->json(['status' => 'ok']);

            // Process webhook asynchronously (recommended)
            dispatch(function () use ($event) {
                $this->processWebhook($event);
            })->afterResponse();

            return $response;

        } catch (\Exception $e) {
            Log::error('VanityCert webhook error: ' . $e->getMessage());
            return response()->json(['error' => 'Webhook processing failed'], 500);
        }
    }

    /**
     * Process webhook events
     *
     * @param array $event
     */
    private function processWebhook(array $event)
    {
        switch ($event['event'] ?? null) {
            case 'certificate.issued':
                Log::info("Certificate issued for {$event['domain_url']}");
                // Update database, send notification to user, etc.
                // Example:
                // $domain = Domain::where('url', $event['domain_url'])->first();
                // $domain->update(['ssl_status' => 'active']);
                // Mail::to($domain->user)->send(new CertificateIssuedMail($domain));
                break;

            case 'certificate.validation_failed':
                Log::warning("Validation failed for {$event['domain_url']}: {$event['reason']}");
                // Send email to user about DNS configuration issue
                // Example:
                // $domain = Domain::where('url', $event['domain_url'])->first();
                // Mail::to($domain->user)->send(new ValidationFailedMail($domain, $event['reason']));
                break;

            case 'certificate.renewal_failed':
                Log::error("Renewal failed for {$event['domain_url']}: {$event['reason']}");
                // Alert operations team
                // Example:
                // $domain = Domain::where('url', $event['domain_url'])->first();
                // Notification::route('slack', config('slack.ops_channel'))
                //     ->notify(new RenewalFailedNotification($domain));
                break;

            default:
                Log::info('Unhandled webhook event: ' . ($event['event'] ?? 'unknown'));
        }
    }

    /**
     * Optional: Rate limiting per user
     *
     * @param int $userId
     * @throws \Exception
     */
    private function checkRateLimit(int $userId)
    {
        $key = "vanitycert_ratelimit:{$userId}";
        $limit = 60; // requests per minute

        $current = \Cache::get($key, 0);

        if ($current >= $limit) {
            throw new \Exception('Rate limit exceeded');
        }

        \Cache::put($key, $current + 1, now()->addMinute());
    }
}
