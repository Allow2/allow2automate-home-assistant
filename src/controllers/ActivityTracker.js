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
 * Activity types for usage classification
 */
const ACTIVITY_TYPES = {
    GAMING: 'gaming',
    VIDEO: 'video',
    AUDIO: 'audio',
    SCREEN_TIME: 'screen_time'
};

/**
 * Maps activity types to Allow2 quota types
 */
const QUOTA_MAPPING = {
    [ACTIVITY_TYPES.GAMING]: 'gaming',
    [ACTIVITY_TYPES.VIDEO]: 'video',
    [ACTIVITY_TYPES.AUDIO]: 'music',
    [ACTIVITY_TYPES.SCREEN_TIME]: 'screen'
};

/**
 * Tracks device usage and calculates time spent per child
 */
class ActivityTracker extends EventEmitter {
    constructor(haConnection, linkingManager, config = {}) {
        super();
        this.haConnection = haConnection;
        this.linkingManager = linkingManager;
        this.config = config;

        this.activeSessions = new Map(); // entityId -> SessionInfo
        this.usageHistory = new Map(); // childId -> Array<UsageRecord>
        this.flushInterval = null;
        this.flushIntervalMs = config.flushIntervalMs || 60000; // 1 minute default
        this.tracking = false;
    }

    /**
     * Initialize activity tracking
     */
    start() {
        if (this.tracking) {
            logger.warn('Activity tracker already started');
            return;
        }

        logger.info('Starting activity tracker');

        // Listen for state changes from WebSocket
        this.stateChangeHandler = (data) => {
            this.processStateChange(data);
        };
        this.haConnection.on('state_changed', this.stateChangeHandler);

        // Set up periodic flush for active sessions
        this.flushInterval = setInterval(() => {
            this.flushActiveSessions();
        }, this.flushIntervalMs);

        this.tracking = true;
    }

    /**
     * Stop activity tracking
     */
    stop() {
        if (!this.tracking) {
            return;
        }

        logger.info('Stopping activity tracker');

        // Remove event listener
        if (this.stateChangeHandler) {
            this.haConnection.off('state_changed', this.stateChangeHandler);
            this.stateChangeHandler = null;
        }

        // Clear flush interval
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }

        // End all active sessions
        for (const [entityId] of this.activeSessions) {
            const link = this.linkingManager.getLink(entityId);
            if (link) {
                this.endSession(entityId, link.childId);
            }
        }

        this.tracking = false;
    }

    /**
     * Process Home Assistant state change event
     * @param {Object} data - State change data
     */
    processStateChange(data) {
        const { entity_id, new_state, old_state } = data;

        // Check if this device is linked
        const link = this.linkingManager.getLink(entity_id);
        if (!link) return;

        // Resolve which child is using this device
        const childId = this.linkingManager.resolveActiveChild(entity_id);
        if (!childId) return;

        // Detect state transitions
        const wasActive = this.isActiveState(old_state);
        const isActive = this.isActiveState(new_state);

        if (!wasActive && isActive) {
            // Device turned on
            this.startSession(entity_id, childId, new_state);
        } else if (wasActive && !isActive) {
            // Device turned off
            this.endSession(entity_id, childId);
        } else if (wasActive && isActive) {
            // Device state changed while active
            this.updateSession(entity_id, new_state);
        }
    }

    /**
     * Determine if state is "active"
     * @param {Object} state - Entity state
     * @returns {boolean}
     */
    isActiveState(state) {
        if (!state || !state.state) return false;

        const activeStates = ['on', 'playing', 'paused', 'idle', 'buffering'];
        const inactiveStates = ['off', 'unavailable', 'standby', 'unknown'];

        const stateValue = state.state.toLowerCase();

        if (inactiveStates.includes(stateValue)) {
            return false;
        }

        return activeStates.includes(stateValue);
    }

    /**
     * Start activity session
     * @param {string} entityId - Entity ID
     * @param {number} childId - Child ID
     * @param {Object} state - Entity state
     */
    startSession(entityId, childId, state) {
        // Check if session already exists
        if (this.activeSessions.has(entityId)) {
            logger.debug(`Session already active for ${entityId}`);
            return;
        }

        const session = {
            entityId,
            childId,
            startTime: Date.now(),
            lastUpdate: Date.now(),
            activityType: this.detectActivityType(state),
            state: state,
            totalActiveTime: 0,
            reportedTime: 0
        };

        this.activeSessions.set(entityId, session);

        logger.info(`Session started: ${entityId} for child ${childId} (${session.activityType})`);

        this.emit('session_started', {
            entityId,
            childId,
            activityType: session.activityType,
            startTime: session.startTime
        });
    }

    /**
     * End activity session
     * @param {string} entityId - Entity ID
     * @param {number} childId - Child ID
     */
    endSession(entityId, childId) {
        const session = this.activeSessions.get(entityId);
        if (!session) {
            return;
        }

        const endTime = Date.now();
        const duration = endTime - session.startTime;

        // Calculate unreported time
        const unreportedTime = session.totalActiveTime - session.reportedTime;

        // Record usage
        const usageRecord = {
            entityId,
            childId: session.childId,
            startTime: session.startTime,
            endTime: endTime,
            duration: duration,
            activeTime: session.totalActiveTime,
            activityType: session.activityType,
            quotaType: QUOTA_MAPPING[session.activityType] || 'screen'
        };

        // Store in history
        if (!this.usageHistory.has(session.childId)) {
            this.usageHistory.set(session.childId, []);
        }
        this.usageHistory.get(session.childId).push(usageRecord);

        // Limit history size
        const history = this.usageHistory.get(session.childId);
        if (history.length > 1000) {
            history.splice(0, history.length - 1000);
        }

        this.activeSessions.delete(entityId);

        logger.info(`Session ended: ${entityId} for child ${session.childId} (${Math.round(duration / 60000)} min)`);

        this.emit('session_ended', usageRecord);
    }

    /**
     * Update active session
     * @param {string} entityId - Entity ID
     * @param {Object} newState - New state
     */
    updateSession(entityId, newState) {
        const session = this.activeSessions.get(entityId);
        if (!session) return;

        const now = Date.now();
        const elapsed = now - session.lastUpdate;

        // Only count time if state was active
        if (this.isActiveState(session.state)) {
            session.totalActiveTime += elapsed;
        }

        session.lastUpdate = now;
        session.state = newState;
        session.activityType = this.detectActivityType(newState);

        this.emit('session_updated', {
            entityId,
            childId: session.childId,
            activityType: session.activityType,
            totalActiveTime: session.totalActiveTime
        });
    }

    /**
     * Detect activity type from device state
     * @param {Object} state - Entity state
     * @returns {string}
     */
    detectActivityType(state) {
        if (!state || !state.attributes) {
            return ACTIVITY_TYPES.SCREEN_TIME;
        }

        const { attributes } = state;

        // Check media content type
        if (attributes.media_content_type) {
            const type = attributes.media_content_type.toLowerCase();

            if (type === 'game' || type === 'app') {
                return ACTIVITY_TYPES.GAMING;
            }

            if (type === 'video' || type === 'movie' || type === 'tvshow' || type === 'episode') {
                return ACTIVITY_TYPES.VIDEO;
            }

            if (type === 'music' || type === 'audio' || type === 'podcast') {
                return ACTIVITY_TYPES.AUDIO;
            }
        }

        // Check source for gaming hints
        if (attributes.source) {
            const source = attributes.source.toLowerCase();
            if (source.includes('game') || source.includes('xbox') || source.includes('playstation')) {
                return ACTIVITY_TYPES.GAMING;
            }
        }

        // Check app name
        if (attributes.app_name) {
            const appName = attributes.app_name.toLowerCase();

            const gamingApps = ['game', 'xbox', 'playstation', 'steam', 'fortnite', 'minecraft', 'roblox'];
            const videoApps = ['netflix', 'youtube', 'hulu', 'disney', 'amazon', 'prime', 'plex', 'kodi', 'hbo', 'peacock'];
            const audioApps = ['spotify', 'apple music', 'pandora', 'soundcloud', 'tidal'];

            if (gamingApps.some(app => appName.includes(app))) {
                return ACTIVITY_TYPES.GAMING;
            }

            if (videoApps.some(app => appName.includes(app))) {
                return ACTIVITY_TYPES.VIDEO;
            }

            if (audioApps.some(app => appName.includes(app))) {
                return ACTIVITY_TYPES.AUDIO;
            }
        }

        return ACTIVITY_TYPES.SCREEN_TIME;
    }

    /**
     * Get active sessions for a child
     * @param {number} childId - Child ID
     * @returns {Array}
     */
    getActiveSessionsForChild(childId) {
        return Array.from(this.activeSessions.values())
            .filter(session => session.childId === childId);
    }

    /**
     * Get all active sessions
     * @returns {Array}
     */
    getAllActiveSessions() {
        return Array.from(this.activeSessions.values());
    }

    /**
     * Check if a device is currently active
     * @param {string} entityId - Entity ID
     * @returns {boolean}
     */
    isDeviceActive(entityId) {
        return this.activeSessions.has(entityId);
    }

    /**
     * Get current session for a device
     * @param {string} entityId - Entity ID
     * @returns {Object|null}
     */
    getSession(entityId) {
        return this.activeSessions.get(entityId) || null;
    }

    /**
     * Get usage report for a child
     * @param {number} childId - Child ID
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Object}
     */
    getUsageReport(childId, startDate, endDate) {
        const records = this.usageHistory.get(childId) || [];

        // Filter by date range
        const startMs = startDate.getTime();
        const endMs = endDate.getTime();

        const filtered = records.filter(r =>
            r.startTime >= startMs && r.endTime <= endMs
        );

        // Calculate totals by activity type
        const totals = {};
        for (const record of filtered) {
            const type = record.activityType;
            if (!totals[type]) {
                totals[type] = 0;
            }
            totals[type] += record.activeTime;
        }

        // Calculate total across all types
        const totalTime = Object.values(totals).reduce((sum, time) => sum + time, 0);

        return {
            childId,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            totalTime: totalTime,
            totalTimeMinutes: Math.round(totalTime / 60000),
            breakdown: totals,
            breakdownMinutes: Object.fromEntries(
                Object.entries(totals).map(([k, v]) => [k, Math.round(v / 60000)])
            ),
            recordCount: filtered.length
        };
    }

    /**
     * Get today's usage for a child
     * @param {number} childId - Child ID
     * @returns {Object}
     */
    getTodayUsage(childId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        return this.getUsageReport(childId, today, tomorrow);
    }

    /**
     * Flush active sessions (calculate current totals)
     * @returns {Array}
     */
    flushActiveSessions() {
        const updates = [];

        for (const [entityId, session] of this.activeSessions.entries()) {
            const now = Date.now();
            const elapsed = now - session.lastUpdate;

            if (this.isActiveState(session.state)) {
                session.totalActiveTime += elapsed;
            }
            session.lastUpdate = now;

            const unreportedTime = session.totalActiveTime - session.reportedTime;

            if (unreportedTime > 0) {
                updates.push({
                    entityId,
                    childId: session.childId,
                    unreportedTime: unreportedTime,
                    unreportedMinutes: Math.round(unreportedTime / 60000),
                    activityType: session.activityType,
                    quotaType: QUOTA_MAPPING[session.activityType] || 'screen'
                });

                // Mark as reported
                session.reportedTime = session.totalActiveTime;
            }
        }

        if (updates.length > 0) {
            this.emit('usage_update', updates);
        }

        return updates;
    }

    /**
     * Clear usage history
     * @param {number} childId - Optional child ID (clears all if not provided)
     */
    clearHistory(childId = null) {
        if (childId) {
            this.usageHistory.delete(childId);
        } else {
            this.usageHistory.clear();
        }
    }
}

export { ACTIVITY_TYPES, QUOTA_MAPPING };
export default ActivityTracker;
