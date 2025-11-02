/**
 * VanityCert Widget
 * Embeddable SSL certificate provisioning widget
 * @version 1.0.0
 */

(function(window) {
  'use strict';

  const VanityCert = {
    version: '1.0.0',
    instances: {},

    /**
     * Initialize the widget
     * @param {Object} config - Configuration options
     * @param {string} config.target - CSS selector for container element
     * @param {string} config.apiEndpoint - Customer's backend proxy endpoint
     * @param {number} config.serverId - VanityCert server ID
     * @param {string} config.userId - Unique identifier for end user
     * @param {Object} config.theme - Theme customization options
     * @param {Object} config.callbacks - Event callbacks
     */
    init: function(config) {
      // Validate required config
      if (!config.target) {
        throw new Error('VanityCert: target selector is required');
      }
      if (!config.apiEndpoint) {
        throw new Error('VanityCert: apiEndpoint is required');
      }
      if (!config.serverId) {
        throw new Error('VanityCert: serverId is required');
      }
      if (!config.userId) {
        throw new Error('VanityCert: userId is required');
      }

      const container = document.querySelector(config.target);
      if (!container) {
        throw new Error('VanityCert: target element not found');
      }

      // Create instance
      const instance = new VanityCertWidget(container, config);
      this.instances[config.target] = instance;

      return instance;
    },

    /**
     * Get instance by target selector
     */
    getInstance: function(target) {
      return this.instances[target];
    },

    /**
     * Destroy instance
     */
    destroy: function(target) {
      const instance = this.instances[target];
      if (instance) {
        instance.destroy();
        delete this.instances[target];
      }
    }
  };

  /**
   * VanityCert Widget Instance
   */
  class VanityCertWidget {
    constructor(container, config) {
      this.container = container;
      this.config = {
        apiEndpoint: config.apiEndpoint,
        serverId: config.serverId,
        userId: config.userId,
        theme: config.theme || {},
        callbacks: config.callbacks || {},
        pollInterval: config.pollInterval || 5000, // 5 seconds
        dnsPollInterval: config.dnsPollInterval || 10000, // 10 seconds during DNS validation
      };

      this.state = {
        step: 1,
        domain: null,
        domainId: null,
        domainUrl: '',
        dnsStatus: 'pending',
        sslStatus: 'pending',
        createdAt: null,
        error: null,
        isPolling: false
      };

      this.pollTimer = null;

      this.init();
    }

    init() {
      // Load saved state if exists
      this.loadState();

      // Render UI
      this.render();

      // Apply theme
      this.applyTheme();

      // Resume polling if needed
      if (this.state.domainId && this.state.step > 1 && this.state.step < 4) {
        this.startPolling();
      }
    }

    /**
     * Load state from localStorage
     */
    loadState() {
      try {
        const saved = localStorage.getItem(`vanitycert_${this.config.userId}`);
        if (saved) {
          const savedState = JSON.parse(saved);
          // Only load if domain exists and not completed
          if (savedState.domainId && savedState.step < 4) {
            this.state = { ...this.state, ...savedState };
          }
        }
      } catch (e) {
        console.error('VanityCert: Failed to load state', e);
      }
    }

    /**
     * Save state to localStorage
     */
    saveState() {
      try {
        localStorage.setItem(`vanitycert_${this.config.userId}`, JSON.stringify(this.state));
      } catch (e) {
        console.error('VanityCert: Failed to save state', e);
      }
    }

    /**
     * Clear saved state
     */
    clearState() {
      try {
        localStorage.removeItem(`vanitycert_${this.config.userId}`);
      } catch (e) {
        console.error('VanityCert: Failed to clear state', e);
      }
    }

    /**
     * Apply theme customization
     */
    applyTheme() {
      if (!this.config.theme) return;

      const root = this.container;
      const theme = this.config.theme;

      if (theme.primaryColor) root.style.setProperty('--vc-primary-color', theme.primaryColor);
      if (theme.secondaryColor) root.style.setProperty('--vc-secondary-color', theme.secondaryColor);
      if (theme.successColor) root.style.setProperty('--vc-success-color', theme.successColor);
      if (theme.errorColor) root.style.setProperty('--vc-error-color', theme.errorColor);
      if (theme.borderRadius) root.style.setProperty('--vc-border-radius', theme.borderRadius);
      if (theme.fontFamily) root.style.setProperty('--vc-font-family', theme.fontFamily);
    }

    /**
     * Render the widget UI
     */
    render() {
      this.container.innerHTML = `
        <div class="vanitycert-widget">
          ${this.renderStepper()}
          ${this.renderStepContent()}
        </div>
      `;

      this.attachEventListeners();
    }

    /**
     * Render stepper navigation
     */
    renderStepper() {
      const steps = [
        { number: 1, label: 'Enter Domain' },
        { number: 2, label: 'Validate DNS' },
        { number: 3, label: 'Issue Certificate' },
        { number: 4, label: 'Ready to Use' }
      ];

      return `
        <div class="vc-stepper">
          ${steps.map(step => `
            <div class="vc-step ${step.number === this.state.step ? 'active' : ''} ${step.number < this.state.step ? 'completed' : ''}">
              <div class="vc-step-number">
                ${step.number < this.state.step ? '<svg class="vc-check-icon" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>' : step.number}
              </div>
              <div class="vc-step-label">${step.label}</div>
            </div>
          `).join('')}
        </div>
      `;
    }

    /**
     * Render current step content
     */
    renderStepContent() {
      switch (this.state.step) {
        case 1:
          return this.renderStep1();
        case 2:
          return this.renderStep2();
        case 3:
          return this.renderStep3();
        case 4:
          return this.renderStep4();
        default:
          return '';
      }
    }

    /**
     * Step 1: Enter Domain
     */
    renderStep1() {
      return `
        <div class="vc-step-content">
          <h2 class="vc-title">Enter Your Domain</h2>
          <p class="vc-description">Enter the domain name you want to secure with an SSL certificate.</p>

          ${this.state.error ? `
            <div class="vc-alert vc-alert-error">
              <svg class="vc-alert-icon" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              <span>${this.state.error}</span>
            </div>
          ` : ''}

          <form class="vc-form" id="vc-domain-form">
            <div class="vc-form-group">
              <label for="vc-domain-input" class="vc-label">Domain Name</label>
              <input
                type="text"
                id="vc-domain-input"
                class="vc-input"
                placeholder="app.yourdomain.com"
                value="${this.state.domainUrl || ''}"
                required
              />
              <p class="vc-help-text">Enter a subdomain (e.g., app.example.com). Apex domains are not supported.</p>
            </div>

            <button type="submit" class="vc-button vc-button-primary">
              Continue
            </button>
          </form>
        </div>
      `;
    }

    /**
     * Step 2: Validate DNS
     */
    renderStep2() {
      const is24HoursPassed = this.check24HourTimeout();
      const isFailed = this.state.dnsStatus === 'error' || is24HoursPassed;

      return `
        <div class="vc-step-content">
          <h2 class="vc-title">Configure DNS</h2>
          <p class="vc-description">Add the following CNAME record to your DNS provider.</p>

          ${isFailed ? `
            <div class="vc-alert vc-alert-error">
              <svg class="vc-alert-icon" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              <div>
                <strong>DNS Validation Failed</strong>
                <p class="vc-error-detail">We couldn't find the CNAME record after 24 hours. Please verify your DNS configuration and try again.</p>
              </div>
            </div>
          ` : ''}

          <div class="vc-dns-box">
            <div class="vc-dns-row">
              <div class="vc-dns-label">Type:</div>
              <div class="vc-dns-value">
                <code>CNAME</code>
                <button class="vc-copy-btn" data-copy="CNAME" title="Copy">
                  <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                </button>
              </div>
            </div>
            <div class="vc-dns-row">
              <div class="vc-dns-label">Name:</div>
              <div class="vc-dns-value">
                <code>${this.state.domainUrl}</code>
                <button class="vc-copy-btn" data-copy="${this.state.domainUrl}" title="Copy">
                  <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                </button>
              </div>
            </div>
            <div class="vc-dns-row">
              <div class="vc-dns-label">Target:</div>
              <div class="vc-dns-value">
                <code>my.vanitycert.com</code>
                <button class="vc-copy-btn" data-copy="my.vanitycert.com" title="Copy">
                  <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                </button>
              </div>
            </div>
          </div>

          <div class="vc-info-box">
            <svg class="vc-info-icon" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
            <div>
              <strong>DNS Propagation</strong>
              <p>DNS changes can take 5-30 minutes to propagate. We'll automatically check for the record.</p>
            </div>
          </div>

          ${!isFailed ? `
            <div class="vc-status-indicator">
              <div class="vc-spinner"></div>
              <span>Checking DNS records...</span>
            </div>
          ` : `
            <div class="vc-retry-section">
              <button class="vc-button vc-button-primary" id="vc-retry-btn">
                <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; margin-right: 8px;">
                  <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                </svg>
                Retry Validation
              </button>
              <button class="vc-button vc-button-secondary" id="vc-cancel-btn">Start Over</button>
            </div>
          `}
        </div>
      `;
    }

    /**
     * Step 3: Issuing Certificate
     */
    renderStep3() {
      return `
        <div class="vc-step-content">
          <h2 class="vc-title">Issuing SSL Certificate</h2>
          <p class="vc-description">Your SSL certificate is being provisioned. This usually takes 1-5 minutes.</p>

          <div class="vc-progress-box">
            <div class="vc-progress-steps">
              <div class="vc-progress-step ${this.state.dnsStatus === 'validated' ? 'completed' : ''}">
                <div class="vc-progress-icon">
                  ${this.state.dnsStatus === 'validated' ?
                    '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>' :
                    '<div class="vc-spinner-small"></div>'}
                </div>
                <span>DNS Validated</span>
              </div>

              <div class="vc-progress-step ${this.state.sslStatus === 'active' ? 'completed' : ''}">
                <div class="vc-progress-icon">
                  ${this.state.sslStatus === 'active' ?
                    '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>' :
                    '<div class="vc-spinner-small"></div>'}
                </div>
                <span>Certificate Issued</span>
              </div>

              <div class="vc-progress-step ${this.state.sslStatus === 'active' ? 'completed' : ''}">
                <div class="vc-progress-icon">
                  ${this.state.sslStatus === 'active' ?
                    '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>' :
                    '<div class="vc-spinner-small"></div>'}
                </div>
                <span>Ready to Use</span>
              </div>
            </div>
          </div>

          <div class="vc-info-box">
            <svg class="vc-info-icon" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
            <div>
              <strong>Automatic Process</strong>
              <p>You can safely leave this page. We'll continue provisioning your certificate in the background.</p>
            </div>
          </div>
        </div>
      `;
    }

    /**
     * Step 4: Ready to Use
     */
    renderStep4() {
      return `
        <div class="vc-step-content">
          <div class="vc-success-box">
            <svg class="vc-success-icon" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            <h2 class="vc-title">SSL Certificate Active!</h2>
            <p class="vc-description">Your domain <strong>${this.state.domainUrl}</strong> is now secured with an SSL certificate.</p>
          </div>

          <div class="vc-certificate-details">
            <div class="vc-detail-row">
              <span class="vc-detail-label">Domain:</span>
              <span class="vc-detail-value">${this.state.domainUrl}</span>
            </div>
            <div class="vc-detail-row">
              <span class="vc-detail-label">Status:</span>
              <span class="vc-detail-value vc-status-badge vc-status-active">Active</span>
            </div>
            <div class="vc-detail-row">
              <span class="vc-detail-label">Valid For:</span>
              <span class="vc-detail-value">90 days</span>
            </div>
          </div>

          <div class="vc-info-box">
            <svg class="vc-info-icon" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
            <div>
              <strong>Automatic Renewal</strong>
              <p>Your certificate will automatically renew before it expires. You don't need to do anything.</p>
            </div>
          </div>

          <button class="vc-button vc-button-secondary" id="vc-done-btn">Done</button>
        </div>
      `;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
      // Domain form submission
      const form = this.container.querySelector('#vc-domain-form');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleDomainSubmit();
        });
      }

      // Copy buttons
      const copyButtons = this.container.querySelectorAll('.vc-copy-btn');
      copyButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.handleCopy(btn.dataset.copy, btn);
        });
      });

      // Retry button
      const retryBtn = this.container.querySelector('#vc-retry-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => this.handleRetry());
      }

      // Cancel button
      const cancelBtn = this.container.querySelector('#vc-cancel-btn');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => this.handleCancel());
      }

      // Done button
      const doneBtn = this.container.querySelector('#vc-done-btn');
      if (doneBtn) {
        doneBtn.addEventListener('click', () => this.handleDone());
      }
    }

    /**
     * Handle domain form submission
     */
    async handleDomainSubmit() {
      const input = this.container.querySelector('#vc-domain-input');
      const domain = input.value.trim();

      // Validate domain
      if (!this.validateDomain(domain)) {
        this.state.error = 'Please enter a valid subdomain (e.g., app.example.com)';
        this.render();
        return;
      }

      // Clear error
      this.state.error = null;

      try {
        // Show loading state
        const submitBtn = this.container.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<div class="vc-spinner-small"></div> Creating...';

        // Create domain via proxy
        const response = await this.apiRequest('POST', '/domains', {
          url: domain,
          server_id: this.config.serverId
        });

        // Update state
        this.state.domainUrl = domain;
        this.state.domainId = response.id;
        this.state.domain = response;
        this.state.dnsStatus = response.dns_status || 'pending';
        this.state.sslStatus = response.ssl_status || 'pending';
        this.state.createdAt = response.created_at || new Date().toISOString();
        this.state.step = 2;

        this.saveState();

        // Callback
        this.triggerCallback('onDomainCreated', response);

        // Render step 2
        this.render();

        // Start polling
        this.startPolling();

      } catch (error) {
        this.state.error = error.message || 'Failed to create domain. Please try again.';
        this.render();
        this.triggerCallback('onError', error);
      }
    }

    /**
     * Validate domain format
     */
    validateDomain(domain) {
      // Must be a subdomain (contains at least one dot)
      const parts = domain.split('.');
      if (parts.length < 2) return false;

      // No http/https
      if (domain.match(/^https?:\/\//i)) return false;

      // Basic format check
      const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;
      return domainRegex.test(domain);
    }

    /**
     * Start polling for domain status
     */
    startPolling() {
      if (this.state.isPolling) return;

      this.state.isPolling = true;
      this.poll();
    }

    /**
     * Stop polling
     */
    stopPolling() {
      this.state.isPolling = false;
      if (this.pollTimer) {
        clearTimeout(this.pollTimer);
        this.pollTimer = null;
      }
    }

    /**
     * Poll for domain status
     */
    async poll() {
      if (!this.state.isPolling || !this.state.domainId) return;

      try {
        const response = await this.apiRequest('GET', `/domains/${this.state.domainId}`);

        const oldDnsStatus = this.state.dnsStatus;
        const oldSslStatus = this.state.sslStatus;

        this.state.dnsStatus = response.dns_status;
        this.state.sslStatus = response.ssl_status;
        this.state.domain = response;

        // Check for status changes
        if (oldDnsStatus !== 'validated' && this.state.dnsStatus === 'validated') {
          this.triggerCallback('onDnsValidated', response);
          this.state.step = 3;
          this.render();
        }

        if (oldSslStatus !== 'active' && this.state.sslStatus === 'active') {
          this.stopPolling();
          this.triggerCallback('onCertificateIssued', response);
          this.state.step = 4;
          this.saveState();
          this.render();
          return;
        }

        // Check for failures
        if (this.state.dnsStatus === 'error' || this.state.sslStatus === 'error') {
          this.stopPolling();
          this.triggerCallback('onValidationFailed', response, 'DNS or SSL validation failed');
          this.render();
          return;
        }

        // Check 24 hour timeout
        if (this.check24HourTimeout()) {
          this.stopPolling();
          this.triggerCallback('onValidationFailed', response, 'DNS validation timeout (24 hours)');
          this.render();
          return;
        }

        this.saveState();

        // Continue polling with appropriate interval
        const interval = this.state.step === 2 ? this.config.dnsPollInterval : this.config.pollInterval;
        this.pollTimer = setTimeout(() => this.poll(), interval);

      } catch (error) {
        console.error('VanityCert: Polling error', error);
        // Continue polling even on error
        this.pollTimer = setTimeout(() => this.poll(), this.config.pollInterval);
      }
    }

    /**
     * Check if 24 hours have passed since domain creation
     */
    check24HourTimeout() {
      if (!this.state.createdAt) return false;

      const created = new Date(this.state.createdAt);
      const now = new Date();
      const hoursPassed = (now - created) / (1000 * 60 * 60);

      return hoursPassed >= 24;
    }

    /**
     * Handle copy to clipboard
     */
    async handleCopy(text, button) {
      try {
        await navigator.clipboard.writeText(text);

        // Visual feedback
        const originalHTML = button.innerHTML;
        button.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
        button.classList.add('vc-copied');

        setTimeout(() => {
          button.innerHTML = originalHTML;
          button.classList.remove('vc-copied');
        }, 2000);
      } catch (error) {
        console.error('VanityCert: Copy failed', error);
      }
    }

    /**
     * Handle retry after failed validation
     */
    async handleRetry() {
      try {
        // Delete old domain
        await this.apiRequest('DELETE', `/domains/${this.state.domainId}`);
      } catch (error) {
        console.warn('VanityCert: Failed to delete old domain', error);
      }

      // Reset state but keep domain URL
      const domainUrl = this.state.domainUrl;
      this.state = {
        step: 1,
        domain: null,
        domainId: null,
        domainUrl: domainUrl,
        dnsStatus: 'pending',
        sslStatus: 'pending',
        createdAt: null,
        error: null,
        isPolling: false
      };

      this.saveState();
      this.render();
    }

    /**
     * Handle cancel / start over
     */
    async handleCancel() {
      try {
        // Delete domain if exists
        if (this.state.domainId) {
          await this.apiRequest('DELETE', `/domains/${this.state.domainId}`);
        }
      } catch (error) {
        console.warn('VanityCert: Failed to delete domain', error);
      }

      // Reset completely
      this.stopPolling();
      this.state = {
        step: 1,
        domain: null,
        domainId: null,
        domainUrl: '',
        dnsStatus: 'pending',
        sslStatus: 'pending',
        createdAt: null,
        error: null,
        isPolling: false
      };

      this.clearState();
      this.render();
    }

    /**
     * Handle done button
     */
    handleDone() {
      this.clearState();
      this.triggerCallback('onComplete', this.state.domain);
    }

    /**
     * Make API request to customer's proxy endpoint
     */
    async apiRequest(method, path, data = null) {
      const url = `${this.config.apiEndpoint}${path}`;
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      if (data) {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(url, options);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw new Error(error.error?.message || error.message || 'Request failed');
      }

      return response.json();
    }

    /**
     * Trigger callback if defined
     */
    triggerCallback(name, ...args) {
      if (this.config.callbacks[name]) {
        try {
          this.config.callbacks[name](...args);
        } catch (error) {
          console.error(`VanityCert: Callback ${name} failed`, error);
        }
      }
    }

    /**
     * Destroy widget instance
     */
    destroy() {
      this.stopPolling();
      this.container.innerHTML = '';
    }
  }

  // Export to window
  window.VanityCert = VanityCert;

})(window);
