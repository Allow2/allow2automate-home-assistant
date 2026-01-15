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
 * Device types that can be discovered
 */
const DEVICE_TYPES = {
    GAMING_CONSOLE: 'gaming_console',
    SMART_TV: 'smart_tv',
    MEDIA_PLAYER: 'media_player',
    SMART_PLUG: 'smart_plug'
};

/**
 * Discovers and classifies Home Assistant entities
 */
class DeviceDiscoveryService {
    constructor(haConnection) {
        this.haConnection = haConnection;
        this.devices = new Map(); // entityId -> DeviceInfo
        this.lastScan = null;
    }

    /**
     * Scan for all entertainment devices
     * @returns {Promise<Array>}
     */
    async scan() {
        logger.info('Starting device discovery scan...');

        try {
            const entities = await this.haConnection.getStates();
            const devices = [];

            for (const entity of entities) {
                const deviceInfo = this.classifyEntity(entity);
                if (deviceInfo) {
                    this.devices.set(entity.entity_id, deviceInfo);
                    devices.push(deviceInfo);
                }
            }

            this.lastScan = Date.now();
            logger.info(`Discovery complete. Found ${devices.length} controllable devices`);

            return devices;
        } catch (error) {
            logger.error('Device discovery failed:', error.message);
            throw error;
        }
    }

    /**
     * Classify entity type
     * @param {Object} entity - Home Assistant entity
     * @returns {Object|null}
     */
    classifyEntity(entity) {
        const { entity_id, state, attributes } = entity;

        // Xbox detection
        if (this.isXbox(entity_id, attributes)) {
            return {
                entityId: entity_id,
                type: DEVICE_TYPES.GAMING_CONSOLE,
                platform: 'xbox',
                name: attributes.friendly_name || 'Xbox',
                capabilities: this.getCapabilities(entity_id, attributes),
                state: state,
                attributes: attributes,
                icon: 'gaming-console-xbox'
            };
        }

        // PlayStation detection
        if (this.isPlayStation(entity_id, attributes)) {
            return {
                entityId: entity_id,
                type: DEVICE_TYPES.GAMING_CONSOLE,
                platform: 'playstation',
                name: attributes.friendly_name || 'PlayStation',
                capabilities: this.getCapabilities(entity_id, attributes),
                state: state,
                attributes: attributes,
                icon: 'gaming-console-playstation'
            };
        }

        // Nintendo Switch detection
        if (this.isNintendoSwitch(entity_id, attributes)) {
            return {
                entityId: entity_id,
                type: DEVICE_TYPES.GAMING_CONSOLE,
                platform: 'nintendo',
                name: attributes.friendly_name || 'Nintendo Switch',
                capabilities: this.getCapabilities(entity_id, attributes),
                state: state,
                attributes: attributes,
                icon: 'gaming-console-nintendo'
            };
        }

        // Smart TV detection
        if (this.isSmartTV(entity_id, attributes)) {
            return {
                entityId: entity_id,
                type: DEVICE_TYPES.SMART_TV,
                platform: this.detectTVBrand(attributes),
                name: attributes.friendly_name || 'Smart TV',
                capabilities: this.getCapabilities(entity_id, attributes),
                state: state,
                attributes: attributes,
                icon: 'smart-tv'
            };
        }

        // Media Player detection (streaming devices)
        if (this.isStreamingDevice(entity_id, attributes)) {
            return {
                entityId: entity_id,
                type: DEVICE_TYPES.MEDIA_PLAYER,
                platform: this.detectMediaPlayerType(entity_id, attributes),
                name: attributes.friendly_name || 'Media Player',
                capabilities: this.getCapabilities(entity_id, attributes),
                state: state,
                attributes: attributes,
                icon: 'media-player'
            };
        }

        // Smart Plug detection
        if (this.isSmartPlug(entity_id, attributes)) {
            return {
                entityId: entity_id,
                type: DEVICE_TYPES.SMART_PLUG,
                platform: this.detectPlugBrand(attributes),
                name: attributes.friendly_name || 'Smart Plug',
                capabilities: ['power', 'energy_monitoring'],
                state: state,
                attributes: attributes,
                powerWatts: attributes.current_power_w || attributes.power || 0,
                energyKwh: attributes.energy_kwh || attributes.total_energy_kwh || 0,
                icon: 'smart-plug'
            };
        }

        return null;
    }

    /**
     * Check if entity is Xbox
     */
    isXbox(entityId, attributes) {
        const xboxPatterns = [
            /xbox/i,
            /xb_series/i,
            /xb_one/i,
            /xboxone/i,
            /xboxseries/i
        ];

        const searchText = `${entityId} ${attributes.friendly_name || ''} ${attributes.source || ''}`;
        return xboxPatterns.some(pattern => pattern.test(searchText));
    }

    /**
     * Check if entity is PlayStation
     */
    isPlayStation(entityId, attributes) {
        const psPatterns = [
            /playstation/i,
            /ps[45]/i,
            /sony.*console/i,
            /psn/i
        ];

        const searchText = `${entityId} ${attributes.friendly_name || ''} ${attributes.source || ''}`;
        return psPatterns.some(pattern => pattern.test(searchText));
    }

    /**
     * Check if entity is Nintendo Switch
     */
    isNintendoSwitch(entityId, attributes) {
        const nintendoPatterns = [
            /nintendo/i,
            /switch/i
        ];

        const searchText = `${entityId} ${attributes.friendly_name || ''} ${attributes.source || ''}`;
        return nintendoPatterns.some(pattern => pattern.test(searchText));
    }

    /**
     * Check if entity is Smart TV
     */
    isSmartTV(entityId, attributes) {
        if (!entityId.startsWith('media_player.')) return false;

        const tvPatterns = [
            /\btv\b/i,
            /television/i,
            /samsung.*tv/i,
            /lg.*tv/i,
            /sony.*bravia/i,
            /vizio/i,
            /roku.*tv/i,
            /android.*tv/i,
            /webos/i
        ];

        const searchText = `${entityId} ${attributes.friendly_name || ''}`;
        return tvPatterns.some(pattern => pattern.test(searchText));
    }

    /**
     * Check if entity is a streaming device (not TV)
     */
    isStreamingDevice(entityId, attributes) {
        if (!entityId.startsWith('media_player.')) return false;
        if (this.isSmartTV(entityId, attributes)) return false;
        if (this.isXbox(entityId, attributes)) return false;
        if (this.isPlayStation(entityId, attributes)) return false;

        const streamingPatterns = [
            /roku/i,
            /apple.?tv/i,
            /chromecast/i,
            /fire.?tv/i,
            /firestick/i,
            /nvidia.*shield/i,
            /plex/i,
            /kodi/i,
            /emby/i,
            /jellyfin/i
        ];

        const searchText = `${entityId} ${attributes.friendly_name || ''}`;
        return streamingPatterns.some(pattern => pattern.test(searchText));
    }

    /**
     * Check if entity is smart plug
     */
    isSmartPlug(entityId, attributes) {
        if (!entityId.startsWith('switch.')) return false;

        const plugPatterns = [
            /plug/i,
            /outlet/i,
            /socket/i,
            /power.*strip/i
        ];

        const searchText = `${entityId} ${attributes.friendly_name || ''}`;
        const hasEnergyMonitoring = attributes.current_power_w !== undefined ||
            attributes.power !== undefined ||
            attributes.energy_kwh !== undefined;

        return plugPatterns.some(pattern => pattern.test(searchText)) || hasEnergyMonitoring;
    }

    /**
     * Detect TV brand
     */
    detectTVBrand(attributes) {
        const name = (attributes.friendly_name || '').toLowerCase();

        if (name.includes('samsung')) return 'samsung';
        if (name.includes('lg') || name.includes('webos')) return 'lg';
        if (name.includes('sony') || name.includes('bravia')) return 'sony';
        if (name.includes('vizio')) return 'vizio';
        if (name.includes('tcl')) return 'tcl';
        if (name.includes('hisense')) return 'hisense';
        if (name.includes('roku')) return 'roku';
        if (name.includes('android')) return 'android_tv';

        return 'generic';
    }

    /**
     * Detect media player type
     */
    detectMediaPlayerType(entityId, attributes) {
        const name = (entityId + ' ' + (attributes.friendly_name || '')).toLowerCase();

        if (name.includes('roku')) return 'roku';
        if (name.includes('apple_tv') || name.includes('appletv')) return 'apple_tv';
        if (name.includes('chromecast')) return 'chromecast';
        if (name.includes('fire_tv') || name.includes('firetv') || name.includes('firestick')) return 'fire_tv';
        if (name.includes('nvidia') || name.includes('shield')) return 'nvidia_shield';
        if (name.includes('plex')) return 'plex';
        if (name.includes('kodi')) return 'kodi';
        if (name.includes('emby')) return 'emby';
        if (name.includes('jellyfin')) return 'jellyfin';

        return 'generic';
    }

    /**
     * Detect smart plug brand
     */
    detectPlugBrand(attributes) {
        const name = (attributes.friendly_name || '').toLowerCase();

        if (name.includes('kasa') || name.includes('tp-link') || name.includes('tplink')) return 'tplink';
        if (name.includes('shelly')) return 'shelly';
        if (name.includes('sonoff')) return 'sonoff';
        if (name.includes('tuya') || name.includes('smart life')) return 'tuya';
        if (name.includes('wemo')) return 'wemo';
        if (name.includes('wyze')) return 'wyze';
        if (name.includes('meross')) return 'meross';
        if (name.includes('gosund')) return 'gosund';

        return 'generic';
    }

    /**
     * Get device capabilities based on entity type
     */
    getCapabilities(entityId, attributes) {
        const capabilities = [];

        if (entityId.startsWith('switch.')) {
            capabilities.push('power');
        }

        if (entityId.startsWith('media_player.')) {
            capabilities.push('media_player');

            if (attributes.supported_features) {
                const features = attributes.supported_features;
                // Common media player feature flags
                if (features & 1) capabilities.push('pause');
                if (features & 2) capabilities.push('seek');
                if (features & 4) capabilities.push('volume_set');
                if (features & 8) capabilities.push('volume_mute');
                if (features & 16) capabilities.push('previous_track');
                if (features & 32) capabilities.push('next_track');
                if (features & 128) capabilities.push('turn_on');
                if (features & 256) capabilities.push('turn_off');
            }
        }

        if (attributes.current_power_w !== undefined || attributes.power !== undefined) {
            capabilities.push('energy_monitoring');
        }

        return capabilities;
    }

    /**
     * Get device by entity ID
     */
    getDevice(entityId) {
        return this.devices.get(entityId) || null;
    }

    /**
     * Get all devices by type
     */
    getDevicesByType(type) {
        return Array.from(this.devices.values()).filter(d => d.type === type);
    }

    /**
     * Get all discovered devices
     */
    getAllDevices() {
        return Array.from(this.devices.values());
    }

    /**
     * Suggest device links based on device names and children
     * @param {Array} children - Allow2 children
     * @returns {Array}
     */
    suggestLinks(children) {
        const suggestions = [];

        for (const child of children) {
            const childName = child.name.toLowerCase();

            for (const [entityId, device] of this.devices.entries()) {
                const deviceName = device.name.toLowerCase();

                // Check if child name is in device name
                if (deviceName.includes(childName)) {
                    suggestions.push({
                        childId: child.id,
                        childName: child.name,
                        entityId: entityId,
                        deviceName: device.name,
                        deviceType: device.type,
                        confidence: 0.9,
                        reason: `Device name contains "${child.name}"`
                    });
                    continue;
                }

                // Check for room patterns
                const roomPatterns = [
                    new RegExp(`${childName}.*room`, 'i'),
                    new RegExp(`${childName}.*bedroom`, 'i'),
                    new RegExp(`${childName}'s`, 'i')
                ];

                for (const pattern of roomPatterns) {
                    if (pattern.test(deviceName)) {
                        suggestions.push({
                            childId: child.id,
                            childName: child.name,
                            entityId: entityId,
                            deviceName: device.name,
                            deviceType: device.type,
                            confidence: 0.8,
                            reason: `Device appears to be in ${child.name}'s room`
                        });
                        break;
                    }
                }
            }
        }

        // Sort by confidence
        suggestions.sort((a, b) => b.confidence - a.confidence);

        return suggestions;
    }

    /**
     * Refresh device state
     * @param {string} entityId - Entity ID to refresh
     * @returns {Promise<Object|null>}
     */
    async refreshDeviceState(entityId) {
        try {
            const state = await this.haConnection.getState(entityId);
            if (state && this.devices.has(entityId)) {
                const device = this.devices.get(entityId);
                device.state = state.state;
                device.attributes = state.attributes;
                this.devices.set(entityId, device);
                return device;
            }
            return null;
        } catch (error) {
            logger.error(`Failed to refresh state for ${entityId}:`, error.message);
            return null;
        }
    }

    /**
     * Clear discovered devices
     */
    clear() {
        this.devices.clear();
        this.lastScan = null;
    }
}

export { DEVICE_TYPES };
export default DeviceDiscoveryService;
