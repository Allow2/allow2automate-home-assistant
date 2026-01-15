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

import logger from './Logger';

/**
 * REST API Client for Home Assistant
 * Wraps fetch calls with authentication headers
 */
class HARestClient {
    constructor(baseUrl, accessToken) {
        this.baseUrl = baseUrl ? baseUrl.replace(/\/$/, '') : '';
        this.accessToken = accessToken;
        this.timeout = 10000; // 10 second timeout
    }

    /**
     * Update configuration
     * @param {string} baseUrl - Home Assistant URL
     * @param {string} accessToken - Long-lived access token
     */
    configure(baseUrl, accessToken) {
        this.baseUrl = baseUrl ? baseUrl.replace(/\/$/, '') : '';
        this.accessToken = accessToken;
    }

    /**
     * Check if client is configured
     * @returns {boolean}
     */
    isConfigured() {
        return Boolean(this.baseUrl && this.accessToken);
    }

    /**
     * Get default headers for requests
     * @returns {Object}
     */
    getHeaders() {
        return {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Make a GET request
     * @param {string} path - API path
     * @returns {Promise<any>}
     */
    async get(path) {
        if (!this.isConfigured()) {
            throw new Error('REST client not configured');
        }

        const url = `${this.baseUrl}${path}`;
        logger.debug(`GET ${url}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: this.getHeaders(),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${this.timeout}ms`);
            }
            throw error;
        }
    }

    /**
     * Make a POST request
     * @param {string} path - API path
     * @param {Object} data - Request body
     * @returns {Promise<any>}
     */
    async post(path, data = {}) {
        if (!this.isConfigured()) {
            throw new Error('REST client not configured');
        }

        const url = `${this.baseUrl}${path}`;
        logger.debug(`POST ${url}`, data);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(data),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
            }

            // Some HA endpoints return empty response
            const text = await response.text();
            return text ? JSON.parse(text) : {};
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${this.timeout}ms`);
            }
            throw error;
        }
    }

    /**
     * Test connection to Home Assistant
     * @returns {Promise<boolean>}
     */
    async testConnection() {
        try {
            const response = await this.get('/api/');
            return response && response.message === 'API running.';
        } catch (error) {
            logger.error('Connection test failed:', error.message);
            return false;
        }
    }

    /**
     * Get all entity states
     * @returns {Promise<Array>}
     */
    async getStates() {
        return await this.get('/api/states');
    }

    /**
     * Get specific entity state
     * @param {string} entityId - Entity ID
     * @returns {Promise<Object>}
     */
    async getState(entityId) {
        return await this.get(`/api/states/${entityId}`);
    }

    /**
     * Call a Home Assistant service
     * @param {string} domain - Service domain (e.g., 'switch', 'media_player')
     * @param {string} service - Service name (e.g., 'turn_off', 'turn_on')
     * @param {Object} data - Service data
     * @returns {Promise<Array>}
     */
    async callService(domain, service, data = {}) {
        return await this.post(`/api/services/${domain}/${service}`, data);
    }

    /**
     * Get Home Assistant configuration
     * @returns {Promise<Object>}
     */
    async getConfig() {
        return await this.get('/api/config');
    }

    /**
     * Get event history for an entity
     * @param {string} entityId - Entity ID
     * @param {Date} startTime - Start time
     * @param {Date} endTime - End time (optional)
     * @returns {Promise<Array>}
     */
    async getHistory(entityId, startTime, endTime = null) {
        let path = `/api/history/period/${startTime.toISOString()}?filter_entity_id=${entityId}`;
        if (endTime) {
            path += `&end_time=${endTime.toISOString()}`;
        }
        return await this.get(path);
    }
}

export default HARestClient;
