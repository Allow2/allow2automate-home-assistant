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

import TabContent from './components/TabContent';
import HAConnectionManager from './controllers/HAConnectionManager';
import DeviceDiscoveryService from './controllers/DeviceDiscoveryService';
import DeviceLinkingManager from './controllers/DeviceLinkingManager';
import ActivityTracker from './controllers/ActivityTracker';
import EnforcementEngine from './controllers/EnforcementEngine';
import logger from './utils/Logger';

/**
 * Home Assistant Plugin for Allow2Automate
 *
 * This plugin provides integration with Home Assistant for parental controls.
 * It acts as an ENFORCEMENT layer - all quota decisions come from Allow2 platform.
 */
function plugin(context) {
    const haPlugin = {
        // Plugin instance data
        haConnection: null,
        discoveryService: null,
        linkingManager: null,
        activityTracker: null,
        enforcementEngine: null,
        state: null
    };

    /**
     * Called when plugin is loaded
     * @param {Object} loadState - Persisted state
     */
    haPlugin.onLoad = function(loadState) {
        logger.info('Home Assistant plugin loading...');

        // Initialize state
        haPlugin.state = loadState || {
            homeAssistant: {
                url: '',
                accessToken: ''
            },
            devices: {},
            deviceLinks: {},
            activeSessions: [],
            todayUsage: {},
            connectionStatus: {
                connected: false,
                authenticated: false
            }
        };

        // Ensure devices and deviceLinks exist
        if (!haPlugin.state.devices) haPlugin.state.devices = {};
        if (!haPlugin.state.deviceLinks) haPlugin.state.deviceLinks = {};

        // Initialize connection manager
        haPlugin.haConnection = new HAConnectionManager({
            url: haPlugin.state.homeAssistant?.url,
            accessToken: haPlugin.state.homeAssistant?.accessToken
        });

        // Initialize services
        haPlugin.discoveryService = new DeviceDiscoveryService(haPlugin.haConnection);
        haPlugin.linkingManager = new DeviceLinkingManager({
            deviceLinks: Object.values(haPlugin.state.deviceLinks || {})
        });
        haPlugin.activityTracker = new ActivityTracker(
            haPlugin.haConnection,
            haPlugin.linkingManager,
            { flushIntervalMs: 60000 }
        );
        haPlugin.enforcementEngine = new EnforcementEngine(
            haPlugin.haConnection,
            haPlugin.linkingManager,
            { defaultGracePeriod: 60 }
        );

        // Set up event handlers
        setupEventHandlers(haPlugin, context);

        // Register IPC handlers
        registerIPCHandlers(haPlugin, context);

        // Auto-connect if credentials exist
        if (haPlugin.state.homeAssistant?.url && haPlugin.state.homeAssistant?.accessToken) {
            logger.info('Auto-connecting to Home Assistant...');
            haPlugin.haConnection.testConnection()
                .then(connected => {
                    if (connected) {
                        haPlugin.haConnection.connectWebSocket()
                            .then(() => {
                                haPlugin.activityTracker.start();
                                // Trigger device discovery
                                haPlugin.discoveryService.scan();
                            })
                            .catch(err => logger.error('WebSocket connection failed:', err.message));
                    }
                })
                .catch(err => logger.error('Connection test failed:', err.message));
        }

        logger.info('Home Assistant plugin loaded');
    };

    /**
     * Called when state is updated
     * @param {Object} newState - New state
     */
    haPlugin.newState = function(newState) {
        logger.debug('State updated');
        haPlugin.state = newState;

        // Update connection config if changed
        if (newState.homeAssistant) {
            haPlugin.haConnection.configure(newState.homeAssistant);
        }

        // Update device links
        if (newState.deviceLinks) {
            haPlugin.linkingManager.loadLinks(Object.values(newState.deviceLinks));
        }
    };

    /**
     * Called when plugin is enabled/disabled
     * @param {boolean} enabled - Enabled state
     */
    haPlugin.onSetEnabled = function(enabled) {
        logger.info('Plugin', enabled ? 'enabled' : 'disabled');

        if (enabled) {
            haPlugin.activityTracker.start();
        } else {
            haPlugin.activityTracker.stop();
        }
    };

    /**
     * Called when plugin is unloaded
     * @param {Function} callback - Completion callback
     */
    haPlugin.onUnload = function(callback) {
        logger.info('Unloading Home Assistant plugin...');

        // Stop tracking
        if (haPlugin.activityTracker) {
            haPlugin.activityTracker.stop();
        }

        // Disconnect
        if (haPlugin.haConnection) {
            haPlugin.haConnection.disconnect();
        }

        callback(null);
    };

    return haPlugin;
}

/**
 * Set up event handlers for connection and activity events
 */
function setupEventHandlers(haPlugin, context) {
    // Connection events
    haPlugin.haConnection.on('connected', () => {
        updateConnectionStatus(haPlugin, context, { connected: true });
    });

    haPlugin.haConnection.on('ws_disconnected', () => {
        updateConnectionStatus(haPlugin, context, { connected: false, authenticated: false });
    });

    haPlugin.haConnection.on('authenticated', () => {
        updateConnectionStatus(haPlugin, context, { authenticated: true });
    });

    haPlugin.haConnection.on('error', (error) => {
        logger.error('Connection error:', error);
        context.statusUpdate({
            status: 'error',
            message: error.message || 'Connection error',
            details: error
        });
    });

    // Activity tracker events
    haPlugin.activityTracker.on('session_started', (session) => {
        logger.info('Session started:', session.entityId);
        updateActiveSessions(haPlugin, context);
    });

    haPlugin.activityTracker.on('session_ended', (record) => {
        logger.info('Session ended:', record.entityId, `${Math.round(record.duration / 60000)} min`);
        updateActiveSessions(haPlugin, context);
        updateTodayUsage(haPlugin, context, record.childId);

        // Report usage to Allow2 if services available
        if (context.services?.allow2Client) {
            reportUsageToAllow2(context.services.allow2Client, record);
        }
    });

    haPlugin.activityTracker.on('usage_update', (updates) => {
        // Periodic usage update
        for (const update of updates) {
            if (context.services?.allow2Client) {
                reportUsageToAllow2(context.services.allow2Client, update);
            }
        }
    });

    // Enforcement events
    haPlugin.enforcementEngine.on('enforcement_executed', (enforcement) => {
        logger.info('Enforcement executed:', enforcement.entityId, enforcement.action);
        context.statusUpdate({
            status: 'info',
            message: `Device ${enforcement.entityId} ${enforcement.action}`,
            details: enforcement
        });
    });
}

/**
 * Register IPC handlers for renderer communication
 */
function registerIPCHandlers(haPlugin, context) {
    const { ipcMain } = context;

    // Test connection
    ipcMain.handle('ha:testConnection', async (event, params) => {
        try {
            const testClient = new HAConnectionManager(params);
            const success = await testClient.testConnection();
            testClient.disconnect();
            return { success, message: success ? 'Connected' : 'Connection failed' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    });

    // Connect to Home Assistant
    ipcMain.handle('ha:connect', async (event, params) => {
        try {
            haPlugin.haConnection.configure(params);

            const connected = await haPlugin.haConnection.testConnection();
            if (!connected) {
                return { success: false, message: 'Connection test failed' };
            }

            await haPlugin.haConnection.connectWebSocket();
            haPlugin.activityTracker.start();

            updateConnectionStatus(haPlugin, context, { connected: true, authenticated: true });

            // Auto-discover devices
            await haPlugin.discoveryService.scan();
            updateDevices(haPlugin, context);

            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    });

    // Disconnect
    ipcMain.handle('ha:disconnect', async () => {
        haPlugin.activityTracker.stop();
        haPlugin.haConnection.disconnect();
        updateConnectionStatus(haPlugin, context, { connected: false, authenticated: false });
        return { success: true };
    });

    // Discover devices
    ipcMain.handle('ha:discoverDevices', async () => {
        try {
            const devices = await haPlugin.discoveryService.scan();
            updateDevices(haPlugin, context);
            return { success: true, devices };
        } catch (error) {
            return { success: false, message: error.message };
        }
    });

    // Link device
    ipcMain.handle('ha:linkDevice', async (event, linkData) => {
        try {
            haPlugin.linkingManager.addLink(linkData);
            updateDeviceLinks(haPlugin, context);
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    });

    // Unlink device
    ipcMain.handle('ha:unlinkDevice', async (event, params) => {
        try {
            haPlugin.linkingManager.removeLink(params.entityId);
            updateDeviceLinks(haPlugin, context);
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    });

    // Enforce quota
    ipcMain.handle('ha:enforceQuota', async (event, params) => {
        try {
            const result = await haPlugin.enforcementEngine.enforceQuotaExhausted(
                params.entityId,
                params
            );
            return result;
        } catch (error) {
            return { success: false, message: error.message };
        }
    });

    // Get device state
    ipcMain.handle('ha:getDeviceState', async (event, params) => {
        try {
            const state = await haPlugin.haConnection.getState(params.entityId);
            return { success: true, state };
        } catch (error) {
            return { success: false, message: error.message };
        }
    });

    // Turn device on/off
    ipcMain.handle('ha:controlDevice', async (event, params) => {
        try {
            if (params.action === 'turn_on') {
                await haPlugin.enforcementEngine.turnOnDevice(params.entityId);
            } else if (params.action === 'turn_off') {
                await haPlugin.enforcementEngine.turnOffDevice(params.entityId);
            }
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    });
}

/**
 * Update connection status in state
 */
function updateConnectionStatus(haPlugin, context, status) {
    haPlugin.state.connectionStatus = {
        ...haPlugin.state.connectionStatus,
        ...status
    };
    context.configurationUpdate(haPlugin.state);
}

/**
 * Update discovered devices in state
 */
function updateDevices(haPlugin, context) {
    const devices = haPlugin.discoveryService.getAllDevices();
    haPlugin.state.devices = {};

    for (const device of devices) {
        haPlugin.state.devices[device.entityId] = device;
    }

    context.configurationUpdate(haPlugin.state);
}

/**
 * Update device links in state
 */
function updateDeviceLinks(haPlugin, context) {
    const links = haPlugin.linkingManager.exportLinks();
    haPlugin.state.deviceLinks = {};

    for (const link of links) {
        haPlugin.state.deviceLinks[link.entityId] = link;
    }

    context.configurationUpdate(haPlugin.state);
}

/**
 * Update active sessions in state
 */
function updateActiveSessions(haPlugin, context) {
    haPlugin.state.activeSessions = haPlugin.activityTracker.getAllActiveSessions();
    context.configurationUpdate(haPlugin.state);
}

/**
 * Update today's usage for a child
 */
function updateTodayUsage(haPlugin, context, childId) {
    if (!haPlugin.state.todayUsage) {
        haPlugin.state.todayUsage = {};
    }

    haPlugin.state.todayUsage[childId] = haPlugin.activityTracker.getTodayUsage(childId);
    context.configurationUpdate(haPlugin.state);
}

/**
 * Report usage to Allow2 API
 */
async function reportUsageToAllow2(allow2Client, usageData) {
    try {
        // This would call Allow2 API to report usage
        // The actual implementation depends on Allow2 client API
        logger.debug('Reporting usage to Allow2:', usageData);

        // Example: allow2Client.reportUsage(usageData.childId, usageData.quotaType, usageData.duration);
    } catch (error) {
        logger.error('Failed to report usage to Allow2:', error.message);
    }
}

// Export plugin and components
module.exports = {
    plugin,
    TabContent,
    requiresMainProcess: true
};
