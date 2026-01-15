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
import logger from '../utils/Logger';

/**
 * Enforcement actions
 */
const ENFORCEMENT_ACTIONS = {
    WARN: 'warn',
    PAUSE: 'pause',
    TURN_OFF: 'turn_off',
    CUT_POWER: 'cut_power'
};

/**
 * Enforces parental control decisions on Home Assistant devices
 */
class EnforcementEngine extends EventEmitter {
    constructor(haConnection, linkingManager, config = {}) {
        super();
        this.haConnection = haConnection;
        this.linkingManager = linkingManager;
        this.config = {
            defaultGracePeriod: config.defaultGracePeriod || 60,
            enableNotifications: config.enableNotifications !== false,
            notifyService: config.notifyService || 'persistent_notification',
            ...config
        };

        this.pendingEnforcements = new Map(); // entityId -> enforcementInfo
        this.enforcementHistory = []; // Array of enforcement records
    }

    /**
     * Enforce quota exhaustion for a device
     * @param {string} entityId - Entity ID to enforce
     * @param {Object} options - Enforcement options
     * @returns {Promise<Object>}
     */
    async enforceQuotaExhausted(entityId, options = {}) {
        const {
            childId,
            childName = 'Child',
            action = ENFORCEMENT_ACTIONS.TURN_OFF,
            gracePeriod = this.config.defaultGracePeriod,
            reason = 'Quota exhausted'
        } = options;

        logger.info(`Enforcing quota exhaustion for ${entityId}: ${action} in ${gracePeriod}s`);

        // Get device link info
        const link = this.linkingManager.getLink(entityId);

        // Check if there's already a pending enforcement
        if (this.pendingEnforcements.has(entityId)) {
            logger.warn(`Enforcement already pending for ${entityId}`);
            return { success: false, message: 'Enforcement already pending' };
        }

        // Send warning notification if enabled
        if (this.config.enableNotifications && gracePeriod > 0) {
            await this.sendWarning(entityId, childName, gracePeriod, reason);
        }

        // Create enforcement record
        const enforcement = {
            entityId,
            childId,
            childName,
            action,
            gracePeriod,
            reason,
            startTime: Date.now(),
            executeTime: Date.now() + (gracePeriod * 1000),
            status: 'pending'
        };

        this.pendingEnforcements.set(entityId, enforcement);
        this.emit('enforcement_scheduled', enforcement);

        // Schedule the enforcement action
        if (gracePeriod > 0) {
            setTimeout(async () => {
                await this.executeEnforcement(entityId);
            }, gracePeriod * 1000);
        } else {
            // Execute immediately
            await this.executeEnforcement(entityId);
        }

        return {
            success: true,
            message: `Enforcement scheduled for ${entityId}`,
            enforcement
        };
    }

    /**
     * Execute enforcement action
     * @param {string} entityId - Entity ID
     * @returns {Promise<Object>}
     */
    async executeEnforcement(entityId) {
        const enforcement = this.pendingEnforcements.get(entityId);
        if (!enforcement) {
            return { success: false, message: 'No pending enforcement' };
        }

        logger.info(`Executing enforcement for ${entityId}: ${enforcement.action}`);

        try {
            let result;

            switch (enforcement.action) {
                case ENFORCEMENT_ACTIONS.WARN:
                    result = await this.sendFinalWarning(entityId, enforcement.childName);
                    break;

                case ENFORCEMENT_ACTIONS.PAUSE:
                    result = await this.pauseDevice(entityId);
                    break;

                case ENFORCEMENT_ACTIONS.TURN_OFF:
                    result = await this.turnOffDevice(entityId);
                    break;

                case ENFORCEMENT_ACTIONS.CUT_POWER:
                    result = await this.cutPower(entityId);
                    break;

                default:
                    result = await this.turnOffDevice(entityId);
            }

            enforcement.status = 'executed';
            enforcement.executedTime = Date.now();
            enforcement.result = result;

            this.enforcementHistory.push(enforcement);
            this.pendingEnforcements.delete(entityId);

            this.emit('enforcement_executed', enforcement);

            return {
                success: true,
                enforcement
            };

        } catch (error) {
            logger.error(`Enforcement failed for ${entityId}:`, error.message);

            enforcement.status = 'failed';
            enforcement.error = error.message;

            this.enforcementHistory.push(enforcement);
            this.pendingEnforcements.delete(entityId);

            this.emit('enforcement_failed', enforcement);

            return {
                success: false,
                error: error.message,
                enforcement
            };
        }
    }

    /**
     * Cancel pending enforcement
     * @param {string} entityId - Entity ID
     * @returns {boolean}
     */
    cancelEnforcement(entityId) {
        const enforcement = this.pendingEnforcements.get(entityId);
        if (!enforcement) {
            return false;
        }

        enforcement.status = 'cancelled';
        enforcement.cancelledTime = Date.now();

        this.enforcementHistory.push(enforcement);
        this.pendingEnforcements.delete(entityId);

        logger.info(`Enforcement cancelled for ${entityId}`);
        this.emit('enforcement_cancelled', enforcement);

        return true;
    }

    /**
     * Send warning notification
     * @param {string} entityId - Entity ID
     * @param {string} childName - Child's name
     * @param {number} gracePeriod - Seconds until enforcement
     * @param {string} reason - Reason for enforcement
     */
    async sendWarning(entityId, childName, gracePeriod, reason) {
        try {
            const message = `${childName}, your ${reason.toLowerCase()}! Device will turn off in ${gracePeriod} seconds.`;

            await this.haConnection.callService('notify', this.config.notifyService, {
                message: message,
                title: 'Parental Controls Warning'
            });

            logger.info(`Warning sent for ${entityId}`);
        } catch (error) {
            logger.error('Failed to send warning notification:', error.message);
        }
    }

    /**
     * Send final warning
     * @param {string} entityId - Entity ID
     * @param {string} childName - Child's name
     */
    async sendFinalWarning(entityId, childName) {
        try {
            const message = `${childName}, your screen time is up! Please save your progress and stop now.`;

            await this.haConnection.callService('notify', this.config.notifyService, {
                message: message,
                title: 'Screen Time Limit Reached'
            });

            return { action: 'warning_sent', entityId };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Pause media player
     * @param {string} entityId - Entity ID
     */
    async pauseDevice(entityId) {
        // First try media_player pause
        if (entityId.startsWith('media_player.')) {
            await this.haConnection.callService('media_player', 'media_pause', {
                entity_id: entityId
            });

            return { action: 'paused', entityId };
        }

        // Fall back to turn off
        return await this.turnOffDevice(entityId);
    }

    /**
     * Turn off device
     * @param {string} entityId - Entity ID
     */
    async turnOffDevice(entityId) {
        const domain = entityId.split('.')[0];

        switch (domain) {
            case 'media_player':
                await this.haConnection.callService('media_player', 'turn_off', {
                    entity_id: entityId
                });
                break;

            case 'switch':
                await this.haConnection.callService('switch', 'turn_off', {
                    entity_id: entityId
                });
                break;

            case 'light':
                await this.haConnection.callService('light', 'turn_off', {
                    entity_id: entityId
                });
                break;

            default:
                // Try homeassistant.turn_off as fallback
                await this.haConnection.callService('homeassistant', 'turn_off', {
                    entity_id: entityId
                });
        }

        return { action: 'turned_off', entityId };
    }

    /**
     * Cut power via smart plug
     * @param {string} entityId - Entity ID of the device
     */
    async cutPower(entityId) {
        const link = this.linkingManager.getLink(entityId);

        if (!link || !link.powerControl) {
            // No power control configured, fall back to turn off
            logger.warn(`No power control configured for ${entityId}, falling back to turn_off`);
            return await this.turnOffDevice(entityId);
        }

        const powerControlEntityId = link.powerControl.entityId;

        // First try to gracefully turn off the device
        try {
            await this.turnOffDevice(entityId);
            // Wait a moment for graceful shutdown
            await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (error) {
            logger.warn(`Graceful shutdown failed for ${entityId}, cutting power immediately`);
        }

        // Cut power via smart plug
        await this.haConnection.callService('switch', 'turn_off', {
            entity_id: powerControlEntityId
        });

        return { action: 'power_cut', entityId, powerControlEntityId };
    }

    /**
     * Turn on device (restore access)
     * @param {string} entityId - Entity ID
     */
    async turnOnDevice(entityId) {
        const domain = entityId.split('.')[0];

        switch (domain) {
            case 'media_player':
                await this.haConnection.callService('media_player', 'turn_on', {
                    entity_id: entityId
                });
                break;

            case 'switch':
                await this.haConnection.callService('switch', 'turn_on', {
                    entity_id: entityId
                });
                break;

            default:
                await this.haConnection.callService('homeassistant', 'turn_on', {
                    entity_id: entityId
                });
        }

        logger.info(`Device turned on: ${entityId}`);
        this.emit('device_restored', { entityId });

        return { action: 'turned_on', entityId };
    }

    /**
     * Restore power via smart plug
     * @param {string} entityId - Entity ID
     */
    async restorePower(entityId) {
        const link = this.linkingManager.getLink(entityId);

        if (!link || !link.powerControl) {
            return await this.turnOnDevice(entityId);
        }

        const powerControlEntityId = link.powerControl.entityId;

        await this.haConnection.callService('switch', 'turn_on', {
            entity_id: powerControlEntityId
        });

        logger.info(`Power restored: ${powerControlEntityId}`);
        this.emit('power_restored', { entityId, powerControlEntityId });

        return { action: 'power_restored', entityId, powerControlEntityId };
    }

    /**
     * Check if enforcement is pending
     * @param {string} entityId - Entity ID
     * @returns {boolean}
     */
    isEnforcementPending(entityId) {
        return this.pendingEnforcements.has(entityId);
    }

    /**
     * Get pending enforcement
     * @param {string} entityId - Entity ID
     * @returns {Object|null}
     */
    getPendingEnforcement(entityId) {
        return this.pendingEnforcements.get(entityId) || null;
    }

    /**
     * Get all pending enforcements
     * @returns {Array}
     */
    getAllPendingEnforcements() {
        return Array.from(this.pendingEnforcements.values());
    }

    /**
     * Get enforcement history
     * @param {Object} filters - Optional filters
     * @returns {Array}
     */
    getEnforcementHistory(filters = {}) {
        let history = this.enforcementHistory;

        if (filters.childId) {
            history = history.filter(e => e.childId === filters.childId);
        }

        if (filters.status) {
            history = history.filter(e => e.status === filters.status);
        }

        if (filters.since) {
            const sinceMs = filters.since instanceof Date ? filters.since.getTime() : filters.since;
            history = history.filter(e => e.startTime >= sinceMs);
        }

        return history;
    }

    /**
     * Clear enforcement history
     */
    clearHistory() {
        this.enforcementHistory = [];
    }
}

export { ENFORCEMENT_ACTIONS };
export default EnforcementEngine;
