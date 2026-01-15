// Copyright [2026] [Allow2 Pty Ltd]
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
'use strict';

import { EventEmitter } from 'events';
import HARestClient from '../utils/HARestClient';
import logger from '../utils/Logger';

/**
 * Manages REST and WebSocket connections to Home Assistant
 */
class HAConnectionManager extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            url: config.url || '',
            accessToken: config.accessToken || '',
            useWebSocket: config.useWebSocket !== false,
            reconnectDelay: config.reconnectDelay || 5000
        };

        this.restClient = new HARestClient(this.config.url, this.config.accessToken);
        this.wsClient = null;
        this.wsMessageId = 1;
        this.connected = false;
        this.authenticated = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectTimer = null;
        this.pendingRequests = new Map();
    }

    /**
     * Update configuration
     * @param {Object} config - New configuration
     */
    configure(config) {
        this.config = {
            ...this.config,
            ...config
        };
        this.restClient.configure(this.config.url, this.config.accessToken);
        logger.info('Connection configuration updated');
    }

    /**
     * Check if configured
     * @returns {boolean}
     */
    isConfigured() {
        return Boolean(this.config.url && this.config.accessToken);
    }

    /**
     * Test connection to Home Assistant
     * @returns {Promise<boolean>}
     */
    async testConnection() {
        try {
            const result = await this.restClient.testConnection();
            if (result) {
                this.emit('connected');
                logger.info('Connection test successful');
            }
            return result;
        } catch (error) {
            this.emit('error', { type: 'connection', error });
            logger.error('Connection test failed:', error.message);
            return false;
        }
    }

    /**
     * Connect WebSocket for real-time events
     * @returns {Promise<void>}
     */
    async connectWebSocket() {
        if (!this.isConfigured()) {
            throw new Error('Connection not configured');
        }

        if (this.wsClient) {
            this.disconnectWebSocket();
        }

        return new Promise((resolve, reject) => {
            try {
                // Convert http(s) to ws(s)
                const wsUrl = this.config.url
                    .replace('https://', 'wss://')
                    .replace('http://', 'ws://') + '/api/websocket';

                logger.info('Connecting WebSocket to:', wsUrl);

                // Use dynamic import for ws in Node.js environment
                const WebSocket = require('ws');
                this.wsClient = new WebSocket(wsUrl);

                this.wsClient.on('open', () => {
                    logger.info('WebSocket connected');
                    this.connected = true;
                    this.emit('ws_connected');
                });

                this.wsClient.on('message', (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        this.handleWebSocketMessage(message, resolve, reject);
                    } catch (error) {
                        logger.error('Failed to parse WebSocket message:', error);
                    }
                });

                this.wsClient.on('close', (code, reason) => {
                    logger.warn('WebSocket closed:', code, reason?.toString());
                    this.connected = false;
                    this.authenticated = false;
                    this.emit('ws_disconnected', { code, reason: reason?.toString() });
                    this.scheduleReconnect();
                });

                this.wsClient.on('error', (error) => {
                    logger.error('WebSocket error:', error.message);
                    this.emit('ws_error', error);
                    reject(error);
                });

            } catch (error) {
                logger.error('Failed to create WebSocket:', error);
                reject(error);
            }
        });
    }

    /**
     * Handle WebSocket messages
     * @param {Object} message - Parsed message
     * @param {Function} resolve - Promise resolve
     * @param {Function} reject - Promise reject
     */
    handleWebSocketMessage(message, resolve, reject) {
        switch (message.type) {
            case 'auth_required':
                logger.debug('Authentication required');
                this.authenticate();
                break;

            case 'auth_ok':
                logger.info('WebSocket authenticated');
                this.authenticated = true;
                this.reconnectAttempts = 0;
                this.emit('authenticated');
                this.subscribeToEvents();
                if (resolve) resolve();
                break;

            case 'auth_invalid':
                logger.error('Authentication failed:', message.message);
                this.emit('error', { type: 'auth_failed', message: message.message });
                if (reject) reject(new Error('Authentication failed: ' + message.message));
                break;

            case 'event':
                if (message.event && message.event.event_type === 'state_changed') {
                    this.emit('state_changed', message.event.data);
                }
                break;

            case 'result':
                this.handleResult(message);
                break;

            default:
                logger.debug('Unhandled message type:', message.type);
        }
    }

    /**
     * Authenticate WebSocket connection
     */
    authenticate() {
        if (this.wsClient && this.wsClient.readyState === 1) {
            this.wsClient.send(JSON.stringify({
                type: 'auth',
                access_token: this.config.accessToken
            }));
        }
    }

    /**
     * Subscribe to state change events
     */
    subscribeToEvents() {
        if (this.wsClient && this.wsClient.readyState === 1) {
            const id = this.wsMessageId++;
            this.wsClient.send(JSON.stringify({
                id: id,
                type: 'subscribe_events',
                event_type: 'state_changed'
            }));
            logger.info('Subscribed to state_changed events');
        }
    }

    /**
     * Handle WebSocket result messages
     * @param {Object} message - Result message
     */
    handleResult(message) {
        const pending = this.pendingRequests.get(message.id);
        if (pending) {
            if (message.success) {
                pending.resolve(message.result);
            } else {
                pending.reject(new Error(message.error?.message || 'Request failed'));
            }
            this.pendingRequests.delete(message.id);
        }
        this.emit('result', message);
    }

    /**
     * Send WebSocket command
     * @param {string} type - Command type
     * @param {Object} data - Command data
     * @returns {Promise<any>}
     */
    async sendCommand(type, data = {}) {
        return new Promise((resolve, reject) => {
            if (!this.wsClient || this.wsClient.readyState !== 1) {
                reject(new Error('WebSocket not connected'));
                return;
            }

            const id = this.wsMessageId++;
            this.pendingRequests.set(id, { resolve, reject });

            this.wsClient.send(JSON.stringify({
                id,
                type,
                ...data
            }));

            // Timeout after 30 seconds
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error('Request timeout'));
                }
            }, 30000);
        });
    }

    /**
     * Schedule WebSocket reconnection
     */
    scheduleReconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger.error('Max reconnection attempts reached');
            this.emit('error', { type: 'max_reconnects', message: 'Max reconnection attempts reached' });
            return;
        }

        const delay = Math.min(
            this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts),
            30000
        );
        this.reconnectAttempts++;

        logger.info(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

        this.reconnectTimer = setTimeout(() => {
            this.emit('reconnecting', { attempt: this.reconnectAttempts });
            this.connectWebSocket().catch(error => {
                logger.error('Reconnection failed:', error.message);
            });
        }, delay);
    }

    /**
     * Get all entity states via REST API
     * @returns {Promise<Array>}
     */
    async getStates() {
        try {
            return await this.restClient.getStates();
        } catch (error) {
            this.emit('error', { type: 'api_error', error });
            logger.error('Failed to get states:', error.message);
            return [];
        }
    }

    /**
     * Get specific entity state
     * @param {string} entityId - Entity ID
     * @returns {Promise<Object|null>}
     */
    async getState(entityId) {
        try {
            return await this.restClient.getState(entityId);
        } catch (error) {
            this.emit('error', { type: 'api_error', error });
            logger.error(`Failed to get state for ${entityId}:`, error.message);
            return null;
        }
    }

    /**
     * Call Home Assistant service
     * @param {string} domain - Service domain (e.g., 'switch')
     * @param {string} service - Service name (e.g., 'turn_off')
     * @param {Object} data - Service data
     * @returns {Promise<Array>}
     */
    async callService(domain, service, data = {}) {
        try {
            logger.info(`Calling service: ${domain}.${service}`, data);
            return await this.restClient.callService(domain, service, data);
        } catch (error) {
            this.emit('error', { type: 'service_call_failed', error, domain, service });
            logger.error(`Service call failed: ${domain}.${service}`, error.message);
            throw error;
        }
    }

    /**
     * Disconnect WebSocket
     */
    disconnectWebSocket() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.wsClient) {
            try {
                this.wsClient.close();
            } catch (error) {
                logger.warn('Error closing WebSocket:', error.message);
            }
            this.wsClient = null;
        }

        this.connected = false;
        this.authenticated = false;
    }

    /**
     * Disconnect and cleanup
     */
    disconnect() {
        this.disconnectWebSocket();
        this.pendingRequests.clear();
        logger.info('Disconnected from Home Assistant');
    }

    /**
     * Get connection status
     * @returns {Object}
     */
    getStatus() {
        return {
            configured: this.isConfigured(),
            connected: this.connected,
            authenticated: this.authenticated,
            reconnectAttempts: this.reconnectAttempts,
            url: this.config.url ? this.config.url.replace(/\/\/.*:.*@/, '//***:***@') : ''
        };
    }
}

export default HAConnectionManager;
