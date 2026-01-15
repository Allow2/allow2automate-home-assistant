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

import logger from '../utils/Logger';

/**
 * Link types for device-child relationships
 */
const LINK_TYPES = {
    EXCLUSIVE: 'exclusive',    // Device belongs to one child
    SHARED: 'shared',          // Device shared by multiple children with rules
    FAMILY: 'family'           // Family device, not tracked per child
};

/**
 * Manages device-to-child and child-to-device relationships
 */
class DeviceLinkingManager {
    constructor(config = {}) {
        this.config = config;
        this.links = new Map(); // entityId -> LinkInfo
        this.childDevices = new Map(); // childId -> Set<entityId>
        this.loadLinks(config.deviceLinks || []);
    }

    /**
     * Load existing links from configuration
     * @param {Array} deviceLinks - Array of link configurations
     */
    loadLinks(deviceLinks) {
        this.links.clear();
        this.childDevices.clear();

        for (const link of deviceLinks) {
            this.addLinkInternal(link, false);
        }

        logger.info(`Loaded ${this.links.size} device links`);
    }

    /**
     * Add device link (internal)
     * @param {Object} link - Link configuration
     * @param {boolean} log - Whether to log
     */
    addLinkInternal(link, log = true) {
        const {
            entityId,
            childId,
            deviceName,
            linkType = LINK_TYPES.EXCLUSIVE,
            usageRules = [],
            powerControl = null
        } = link;

        if (!entityId) {
            logger.warn('Cannot add link without entityId');
            return false;
        }

        this.links.set(entityId, {
            entityId,
            childId,
            deviceName,
            linkType,
            usageRules,
            powerControl,
            createdAt: link.createdAt || Date.now()
        });

        // Add to child's device list
        if (childId && linkType !== LINK_TYPES.FAMILY) {
            if (!this.childDevices.has(childId)) {
                this.childDevices.set(childId, new Set());
            }
            this.childDevices.get(childId).add(entityId);
        }

        // For shared devices, add to all children in usage rules
        if (linkType === LINK_TYPES.SHARED && usageRules.length > 0) {
            for (const rule of usageRules) {
                if (rule.childId) {
                    if (!this.childDevices.has(rule.childId)) {
                        this.childDevices.set(rule.childId, new Set());
                    }
                    this.childDevices.get(rule.childId).add(entityId);
                }
            }
        }

        if (log) {
            logger.info(`Added device link: ${entityId} -> child ${childId || 'family'}`);
        }

        return true;
    }

    /**
     * Add device link
     * @param {Object} link - Link configuration
     * @returns {boolean}
     */
    addLink(link) {
        return this.addLinkInternal(link, true);
    }

    /**
     * Remove device link
     * @param {string} entityId - Entity ID
     * @returns {boolean}
     */
    removeLink(entityId) {
        const link = this.links.get(entityId);
        if (!link) {
            return false;
        }

        // Remove from child's device list
        if (link.childId) {
            const devices = this.childDevices.get(link.childId);
            if (devices) {
                devices.delete(entityId);
            }
        }

        // Remove from shared children
        if (link.linkType === LINK_TYPES.SHARED && link.usageRules) {
            for (const rule of link.usageRules) {
                if (rule.childId) {
                    const devices = this.childDevices.get(rule.childId);
                    if (devices) {
                        devices.delete(entityId);
                    }
                }
            }
        }

        this.links.delete(entityId);
        logger.info(`Removed device link: ${entityId}`);
        return true;
    }

    /**
     * Update device link
     * @param {string} entityId - Entity ID
     * @param {Object} updates - Updates to apply
     * @returns {boolean}
     */
    updateLink(entityId, updates) {
        const existing = this.links.get(entityId);
        if (!existing) {
            return false;
        }

        // Remove old link and add updated one
        this.removeLink(entityId);
        return this.addLink({
            ...existing,
            ...updates,
            entityId // Ensure entityId is preserved
        });
    }

    /**
     * Get link for device
     * @param {string} entityId - Entity ID
     * @returns {Object|null}
     */
    getLink(entityId) {
        return this.links.get(entityId) || null;
    }

    /**
     * Check if device is linked
     * @param {string} entityId - Entity ID
     * @returns {boolean}
     */
    isLinked(entityId) {
        return this.links.has(entityId);
    }

    /**
     * Get all devices for a child
     * @param {number} childId - Child ID
     * @returns {Array<string>}
     */
    getChildDevices(childId) {
        const devices = this.childDevices.get(childId);
        return devices ? Array.from(devices) : [];
    }

    /**
     * Resolve which child is using a device at the current time
     * @param {string} entityId - Entity ID
     * @param {Date} currentTime - Current time (default: now)
     * @returns {number|null} - Child ID or null
     */
    resolveActiveChild(entityId, currentTime = new Date()) {
        const link = this.links.get(entityId);
        if (!link) return null;

        // Exclusive device
        if (link.linkType === LINK_TYPES.EXCLUSIVE) {
            return link.childId;
        }

        // Shared device with usage rules
        if (link.linkType === LINK_TYPES.SHARED && link.usageRules && link.usageRules.length > 0) {
            return this.matchUsageRule(link.usageRules, currentTime);
        }

        // Family device (not tracked per child)
        if (link.linkType === LINK_TYPES.FAMILY) {
            return null;
        }

        return link.childId;
    }

    /**
     * Match usage rule based on time
     * @param {Array} rules - Usage rules
     * @param {Date} currentTime - Current time
     * @returns {number|null}
     */
    matchUsageRule(rules, currentTime) {
        const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const dayName = dayNames[currentTime.getDay()];
        const timeString = currentTime.toTimeString().substring(0, 5); // HH:MM

        for (const rule of rules) {
            // Check if rule applies to this day
            if (rule.weekdays && rule.weekdays.length > 0) {
                if (!rule.weekdays.includes(dayName)) {
                    continue;
                }
            }

            // Check if current time is within rule's time range
            if (rule.timeRange) {
                const [start, end] = rule.timeRange.split('-');
                if (timeString >= start && timeString <= end) {
                    return rule.childId;
                }
            } else {
                // No time range means all day
                return rule.childId;
            }
        }

        return null;
    }

    /**
     * Get all links
     * @returns {Array}
     */
    getAllLinks() {
        return Array.from(this.links.values());
    }

    /**
     * Get links by type
     * @param {string} linkType - Link type
     * @returns {Array}
     */
    getLinksByType(linkType) {
        return Array.from(this.links.values()).filter(link => link.linkType === linkType);
    }

    /**
     * Get links for a specific child
     * @param {number} childId - Child ID
     * @returns {Array}
     */
    getLinksForChild(childId) {
        const entityIds = this.getChildDevices(childId);
        return entityIds.map(id => this.links.get(id)).filter(Boolean);
    }

    /**
     * Set power control for a device link
     * @param {string} entityId - Device entity ID
     * @param {string} powerControlEntityId - Smart plug entity ID
     * @param {Object} options - Power control options
     * @returns {boolean}
     */
    setPowerControl(entityId, powerControlEntityId, options = {}) {
        const link = this.links.get(entityId);
        if (!link) {
            return false;
        }

        link.powerControl = {
            entityId: powerControlEntityId,
            gracePeriod: options.gracePeriod || 60,
            enforceQuota: options.enforceQuota !== false
        };

        logger.info(`Set power control for ${entityId}: ${powerControlEntityId}`);
        return true;
    }

    /**
     * Remove power control from a device link
     * @param {string} entityId - Entity ID
     * @returns {boolean}
     */
    removePowerControl(entityId) {
        const link = this.links.get(entityId);
        if (!link) {
            return false;
        }

        link.powerControl = null;
        logger.info(`Removed power control for ${entityId}`);
        return true;
    }

    /**
     * Export links to configuration format
     * @returns {Array}
     */
    exportLinks() {
        return this.getAllLinks().map(link => ({
            entityId: link.entityId,
            childId: link.childId,
            deviceName: link.deviceName,
            linkType: link.linkType,
            usageRules: link.usageRules,
            powerControl: link.powerControl
        }));
    }

    /**
     * Clear all links
     */
    clear() {
        this.links.clear();
        this.childDevices.clear();
        logger.info('Cleared all device links');
    }
}

export { LINK_TYPES };
export default DeviceLinkingManager;
