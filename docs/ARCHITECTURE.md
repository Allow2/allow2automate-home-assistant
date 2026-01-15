# Allow2Automate Home Assistant Plugin - Technical Architecture

**Version:** 1.0.0
**Last Updated:** 2026-01-15

---

## 🎯 Allow2 Platform Integration

**Critical Architectural Principle:**
This plugin is an **enforcement layer**, not a decision-making layer. All parental control decisions are made in the **Allow2 platform** (iOS/Android/Web apps).

**Control Flow:**
```
┌──────────────────────────────────────────────────────────────┐
│                    Allow2 Platform                            │
│              (iOS/Android/Web Apps)                           │
│                                                               │
│  • Parents set quotas, bans, day types                       │
│  • Parents approve/deny child requests                        │
│  • Parent-child communication                                 │
│  • Quota calculations and decision logic                      │
└──────────────────────────────────────────────────────────────┘
                          │
                          │ API (Rules, Quotas, Decisions)
                          ▼
┌──────────────────────────────────────────────────────────────┐
│              Allow2Automate Plugin                            │
│            (Enforcement Layer)                                │
│                                                               │
│  • Monitor device activity                                    │
│  • Report usage to Allow2 API                                 │
│  • Enforce decisions from Allow2 platform                     │
│  • Display device status in dashboard                         │
└──────────────────────────────────────────────────────────────┘
                          │
                          │ REST & WebSocket
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                   Home Assistant                              │
│  • Device integrations                                        │
│  • State management                                           │
└──────────────────────────────────────────────────────────────┘
```

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Core Components](#core-components)
3. [Data Monitors](#data-monitors)
4. [Action Scripts](#action-scripts)
5. [Home Assistant API Integration](#home-assistant-api-integration)
6. [Device Discovery & Linking](#device-discovery--linking)
7. [Activity Tracking System](#activity-tracking-system)
8. [Enforcement Engine](#enforcement-engine)
9. [State Management](#state-management)
10. [Error Handling](#error-handling)

---

## System Architecture

### High-Level Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                      Allow2 Platform                            │
│          (iOS/Android/Web - NOT allow2automate)                 │
│  • Parent sets all quotas, bans, allowances                    │
│  • Quota calculation and decision logic                         │
│  • Parent-child communication                                   │
└────────────────────────────────────────────────────────────────┘
                           │ Allow2 API
                           ▼
┌────────────────────────────────────────────────────────────────┐
│                    Electron Main Process                        │
│                      (allow2automate)                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Home Assistant Plugin Entry Point                 │  │
│  │  • Plugin lifecycle management                            │  │
│  │  • IPC handler registration                               │  │
│  │  • Configuration management                               │  │
│  │  • Queries Allow2 API for quota status                    │  │
│  │  • Reports device usage to Allow2 API                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Core Controllers                             │  │
│  │                                                            │  │
│  │  ┌─────────────────┐  ┌──────────────────┐              │  │
│  │  │ HA Connection   │  │ Device Discovery │              │  │
│  │  │ Manager         │  │ Service          │              │  │
│  │  │                 │  │                  │              │  │
│  │  │ • REST Client   │  │ • Entity scan    │              │  │
│  │  │ • WebSocket     │  │ • Classification │              │  │
│  │  │ • Auth          │  │ • Capabilities   │              │  │
│  │  └─────────────────┘  └──────────────────┘              │  │
│  │                                                            │  │
│  │  ┌─────────────────┐  ┌──────────────────┐              │  │
│  │  │ Device Linking  │  │ Activity Tracker │              │  │
│  │  │ Manager         │  │                  │              │  │
│  │  │                 │  │ • State monitor  │              │  │
│  │  │ • Child→Device  │  │ • Time tracking  │              │  │
│  │  │ • Shared devices│  │ • Usage reports  │              │  │
│  │  └─────────────────┘  └──────────────────┘              │  │
│  │                                                            │  │
│  │  ┌─────────────────┐  ┌──────────────────┐              │  │
│  │  │ Quota Manager   │  │ Enforcement      │              │  │
│  │  │                 │  │ Engine           │              │  │
│  │  │ • Quota checks  │  │                  │              │  │
│  │  │ • Warnings      │  │ • Device control │              │  │
│  │  │ • Allow2 sync   │  │ • Notifications  │              │  │
│  │  └─────────────────┘  └──────────────────┘              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Home Assistant API Client                       │  │
│  │                                                            │  │
│  │  • REST API wrapper                                       │  │
│  │  • WebSocket event handler                                │  │
│  │  • Service caller                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
                            │
                   REST & WebSocket
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│                     Home Assistant                              │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  State Machine & Entity Registry                          │  │
│  │  • All device entities and states                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Integrations                                             │  │
│  │  Xbox • PlayStation • Smart Plugs • TVs • Media Players   │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### Plugin Lifecycle

```javascript
// 1. Plugin Installation
npm install @allow2/allow2automate-homeassistant

// 2. Plugin Loading (Main Process)
const plugin = require('@allow2/allow2automate-homeassistant');
const pluginInstance = plugin.plugin({
  ipcMain,
  configurationUpdate,
  statusUpdate,
  services: { allow2Client }
});

// 3. Initialization
pluginInstance.onLoad({
  homeAssistant: {
    url: 'http://homeassistant.local:8123',
    accessToken: 'eyJ0eXAi...'
  },
  deviceLinks: []
});

// 4. Device Discovery
await discoveryService.scan();

// 5. WebSocket Connection
await haConnection.connectWebSocket();

// 6. Active Monitoring
haConnection.on('state_changed', (event) => {
  activityTracker.processStateChange(event);
});

// 7. State Changes
pluginInstance.newState(updatedConfiguration);

// 8. Cleanup
pluginInstance.onUnload();
```

---

## Core Components

### 1. HAConnectionManager

**Purpose**: Manage REST and WebSocket connections to Home Assistant

**Responsibilities**:
- Authenticate with long-lived access token
- Maintain WebSocket connection with auto-reconnect
- Provide REST API wrapper methods
- Handle connection errors and retries

**API**:

```javascript
class HAConnectionManager extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.restClient = new HARestClient(config.url, config.accessToken);
    this.wsClient = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
  }

  /**
   * Test connection to Home Assistant
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    try {
      const response = await this.restClient.get('/api/');
      return response.message === 'API running.';
    } catch (error) {
      this.emit('error', { type: 'connection', error });
      return false;
    }
  }

  /**
   * Connect WebSocket for real-time events
   * @returns {Promise<void>}
   */
  async connectWebSocket() {
    try {
      this.wsClient = new WebSocket(`${this.config.url.replace('http', 'ws')}/api/websocket`);

      this.wsClient.on('open', () => {
        this.emit('ws_connected');
      });

      this.wsClient.on('message', (data) => {
        const message = JSON.parse(data);
        this.handleWebSocketMessage(message);
      });

      this.wsClient.on('close', () => {
        this.emit('ws_disconnected');
        this.scheduleReconnect();
      });

      this.wsClient.on('error', (error) => {
        this.emit('ws_error', error);
      });

    } catch (error) {
      this.emit('error', { type: 'websocket', error });
    }
  }

  /**
   * Handle WebSocket messages
   */
  handleWebSocketMessage(message) {
    switch (message.type) {
      case 'auth_required':
        this.authenticate();
        break;

      case 'auth_ok':
        this.connected = true;
        this.reconnectAttempts = 0;
        this.subscribeToEvents();
        this.emit('authenticated');
        break;

      case 'auth_invalid':
        this.emit('error', { type: 'auth_failed', message: 'Invalid access token' });
        break;

      case 'event':
        if (message.event.event_type === 'state_changed') {
          this.emit('state_changed', message.event.data);
        }
        break;

      case 'result':
        this.emit('result', message);
        break;
    }
  }

  /**
   * Authenticate WebSocket connection
   */
  authenticate() {
    this.wsClient.send(JSON.stringify({
      type: 'auth',
      access_token: this.config.accessToken
    }));
  }

  /**
   * Subscribe to state change events
   */
  subscribeToEvents() {
    this.wsClient.send(JSON.stringify({
      id: 1,
      type: 'subscribe_events',
      event_type: 'state_changed'
    }));
  }

  /**
   * Schedule WebSocket reconnection
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('error', { type: 'max_reconnects', message: 'Max reconnection attempts reached' });
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    setTimeout(() => {
      this.emit('reconnecting', { attempt: this.reconnectAttempts });
      this.connectWebSocket();
    }, delay);
  }

  /**
   * Get all entities
   * @returns {Promise<Array>}
   */
  async getStates() {
    try {
      return await this.restClient.get('/api/states');
    } catch (error) {
      this.emit('error', { type: 'api_error', error });
      return [];
    }
  }

  /**
   * Get specific entity state
   * @param {string} entityId
   * @returns {Promise<Object>}
   */
  async getState(entityId) {
    try {
      return await this.restClient.get(`/api/states/${entityId}`);
    } catch (error) {
      this.emit('error', { type: 'api_error', error });
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
  async callService(domain, service, data) {
    try {
      return await this.restClient.post(`/api/services/${domain}/${service}`, data);
    } catch (error) {
      this.emit('error', { type: 'service_call_failed', error });
      throw error;
    }
  }

  /**
   * Disconnect and cleanup
   */
  disconnect() {
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = null;
    }
    this.connected = false;
  }
}

/**
 * REST API Client
 */
class HARestClient {
  constructor(baseUrl, accessToken) {
    this.baseUrl = baseUrl;
    this.accessToken = accessToken;
  }

  async get(path) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  async post(path, data) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }
}
```

### 2. DeviceDiscoveryService

**Purpose**: Discover and classify Home Assistant entities

**Responsibilities**:
- Scan all Home Assistant entities
- Classify by type (gaming console, TV, media player, smart plug)
- Extract device capabilities
- Suggest device-child links

**API**:

```javascript
class DeviceDiscoveryService {
  constructor(haConnection) {
    this.haConnection = haConnection;
    this.devices = new Map(); // entityId -> DeviceInfo
  }

  /**
   * Scan for all entertainment devices
   * @returns {Promise<Array<DeviceInfo>>}
   */
  async scan() {
    const entities = await this.haConnection.getStates();
    const devices = [];

    for (const entity of entities) {
      const deviceInfo = this.classifyEntity(entity);
      if (deviceInfo) {
        this.devices.set(entity.entity_id, deviceInfo);
        devices.push(deviceInfo);
      }
    }

    return devices;
  }

  /**
   * Classify entity type
   * @param {Object} entity - Home Assistant entity
   * @returns {DeviceInfo|null}
   */
  classifyEntity(entity) {
    const { entity_id, state, attributes } = entity;

    // Xbox detection
    if (this.isXbox(entity_id, attributes)) {
      return {
        entityId: entity_id,
        type: 'gaming_console',
        platform: 'xbox',
        name: attributes.friendly_name || 'Xbox',
        capabilities: ['power', 'media_player', 'activity'],
        state: state,
        attributes: attributes
      };
    }

    // PlayStation detection
    if (this.isPlayStation(entity_id, attributes)) {
      return {
        entityId: entity_id,
        type: 'gaming_console',
        platform: 'playstation',
        name: attributes.friendly_name || 'PlayStation',
        capabilities: ['power', 'media_player', 'activity'],
        state: state,
        attributes: attributes
      };
    }

    // Smart TV detection
    if (this.isSmartTV(entity_id, attributes)) {
      return {
        entityId: entity_id,
        type: 'smart_tv',
        platform: this.detectTVBrand(attributes),
        name: attributes.friendly_name || 'Smart TV',
        capabilities: ['power', 'media_player'],
        state: state,
        attributes: attributes
      };
    }

    // Media Player detection
    if (entity_id.startsWith('media_player.')) {
      return {
        entityId: entity_id,
        type: 'media_player',
        platform: this.detectMediaPlayerType(entity_id, attributes),
        name: attributes.friendly_name || 'Media Player',
        capabilities: ['media_player'],
        state: state,
        attributes: attributes
      };
    }

    // Smart Plug detection
    if (this.isSmartPlug(entity_id, attributes)) {
      return {
        entityId: entity_id,
        type: 'smart_plug',
        platform: this.detectPlugBrand(attributes),
        name: attributes.friendly_name || 'Smart Plug',
        capabilities: ['power', 'energy_monitoring'],
        state: state,
        attributes: attributes,
        powerWatts: attributes.current_power_w || 0,
        energyKwh: attributes.energy_kwh || 0
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
      /xb_one/i
    ];

    return xboxPatterns.some(pattern =>
      pattern.test(entityId) || pattern.test(attributes.friendly_name || '')
    );
  }

  /**
   * Check if entity is PlayStation
   */
  isPlayStation(entityId, attributes) {
    const psPatterns = [
      /playstation/i,
      /ps[45]/i,
      /sony.*console/i
    ];

    return psPatterns.some(pattern =>
      pattern.test(entityId) || pattern.test(attributes.friendly_name || '')
    );
  }

  /**
   * Check if entity is Smart TV
   */
  isSmartTV(entityId, attributes) {
    if (!entityId.startsWith('media_player.')) return false;

    const tvPatterns = [
      /tv/i,
      /television/i,
      /samsung/i,
      /lg.*tv/i,
      /sony.*bravia/i
    ];

    return tvPatterns.some(pattern =>
      pattern.test(entityId) || pattern.test(attributes.friendly_name || '')
    );
  }

  /**
   * Detect TV brand
   */
  detectTVBrand(attributes) {
    const name = (attributes.friendly_name || '').toLowerCase();

    if (name.includes('samsung')) return 'samsung';
    if (name.includes('lg')) return 'lg';
    if (name.includes('sony') || name.includes('bravia')) return 'sony';
    if (name.includes('vizio')) return 'vizio';

    return 'unknown';
  }

  /**
   * Detect media player type
   */
  detectMediaPlayerType(entityId, attributes) {
    const name = entityId.toLowerCase() + (attributes.friendly_name || '').toLowerCase();

    if (name.includes('roku')) return 'roku';
    if (name.includes('apple_tv') || name.includes('appletv')) return 'apple_tv';
    if (name.includes('chromecast')) return 'chromecast';
    if (name.includes('fire_tv') || name.includes('firetv')) return 'fire_tv';
    if (name.includes('plex')) return 'plex';
    if (name.includes('kodi')) return 'kodi';

    return 'generic';
  }

  /**
   * Check if entity is smart plug
   */
  isSmartPlug(entityId, attributes) {
    if (!entityId.startsWith('switch.')) return false;

    const plugPatterns = [
      /plug/i,
      /outlet/i,
      /socket/i
    ];

    return plugPatterns.some(pattern =>
      pattern.test(entityId) || pattern.test(attributes.friendly_name || '')
    ) && (attributes.current_power_w !== undefined || attributes.energy_kwh !== undefined);
  }

  /**
   * Detect smart plug brand
   */
  detectPlugBrand(attributes) {
    const name = (attributes.friendly_name || '').toLowerCase();

    if (name.includes('kasa') || name.includes('tp-link')) return 'tplink';
    if (name.includes('shelly')) return 'shelly';
    if (name.includes('sonoff')) return 'sonoff';
    if (name.includes('tuya')) return 'tuya';

    return 'unknown';
  }

  /**
   * Get device by entity ID
   */
  getDevice(entityId) {
    return this.devices.get(entityId);
  }

  /**
   * Get all devices by type
   */
  getDevicesByType(type) {
    return Array.from(this.devices.values()).filter(d => d.type === type);
  }

  /**
   * Suggest device links based on device names
   * @param {Array<Object>} children - Allow2 children
   * @returns {Array<Suggestion>}
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
            confidence: 0.9,
            reason: `Device name contains "${child.name}"`
          });
        }

        // Check for common room patterns (Bobby's Room, etc.)
        const roomPattern = new RegExp(`${childName}.*room|room.*${childName}|${childName}.*bedroom`, 'i');
        if (roomPattern.test(deviceName)) {
          suggestions.push({
            childId: child.id,
            childName: child.name,
            entityId: entityId,
            deviceName: device.name,
            confidence: 0.8,
            reason: `Device appears to be in ${child.name}'s room`
          });
        }
      }
    }

    return suggestions;
  }
}
```

### 3. DeviceLinkingManager

**Purpose**: Manage device-to-child and child-to-device relationships

**Responsibilities**:
- Create and store device links
- Handle shared devices with time-based attribution
- Resolve which child is using a device
- Manage link lifecycle

**API**:

```javascript
class DeviceLinkingManager {
  constructor(config) {
    this.config = config;
    this.links = new Map(); // entityId -> LinkInfo
    this.childDevices = new Map(); // childId -> Set<entityId>
    this.loadLinks(config.deviceLinks || []);
  }

  /**
   * Load existing links from configuration
   */
  loadLinks(deviceLinks) {
    for (const link of deviceLinks) {
      this.addLink(link);
    }
  }

  /**
   * Add device link
   * @param {Object} link - Link configuration
   */
  addLink(link) {
    const { entityId, childId, deviceName, linkType, usageRules } = link;

    this.links.set(entityId, {
      entityId,
      childId,
      deviceName,
      linkType: linkType || 'exclusive', // 'exclusive' | 'shared' | 'family'
      usageRules: usageRules || [],
      createdAt: Date.now()
    });

    if (childId) {
      if (!this.childDevices.has(childId)) {
        this.childDevices.set(childId, new Set());
      }
      this.childDevices.get(childId).add(entityId);
    }
  }

  /**
   * Remove device link
   * @param {string} entityId
   */
  removeLink(entityId) {
    const link = this.links.get(entityId);
    if (link && link.childId) {
      const devices = this.childDevices.get(link.childId);
      if (devices) {
        devices.delete(entityId);
      }
    }
    this.links.delete(entityId);
  }

  /**
   * Get link for device
   * @param {string} entityId
   * @returns {Object|null}
   */
  getLink(entityId) {
    return this.links.get(entityId) || null;
  }

  /**
   * Get all devices for a child
   * @param {number} childId
   * @returns {Array<string>}
   */
  getChildDevices(childId) {
    const devices = this.childDevices.get(childId);
    return devices ? Array.from(devices) : [];
  }

  /**
   * Resolve which child is using a device
   * @param {string} entityId
   * @param {Date} currentTime
   * @returns {number|null} - Child ID or null
   */
  resolveActiveChild(entityId, currentTime = new Date()) {
    const link = this.links.get(entityId);
    if (!link) return null;

    // Exclusive device
    if (link.linkType === 'exclusive') {
      return link.childId;
    }

    // Shared device with usage rules
    if (link.linkType === 'shared' && link.usageRules.length > 0) {
      return this.matchUsageRule(link.usageRules, currentTime);
    }

    // Family device (not tracked)
    if (link.linkType === 'family') {
      return null;
    }

    return link.childId;
  }

  /**
   * Match usage rule based on time
   * @param {Array<Object>} rules
   * @param {Date} currentTime
   * @returns {number|null}
   */
  matchUsageRule(rules, currentTime) {
    const dayName = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][currentTime.getDay()];
    const timeString = currentTime.toTimeString().substring(0, 5); // HH:MM

    for (const rule of rules) {
      // Check if rule applies to this day
      if (rule.weekdays && !rule.weekdays.includes(dayName)) {
        continue;
      }

      // Check if current time is within rule's time range
      if (rule.timeRange) {
        const [start, end] = rule.timeRange.split('-');
        if (timeString >= start && timeString <= end) {
          return rule.childId;
        }
      }
    }

    return null;
  }

  /**
   * Get all links
   * @returns {Array<Object>}
   */
  getAllLinks() {
    return Array.from(this.links.values());
  }

  /**
   * Export links to configuration format
   * @returns {Array<Object>}
   */
  exportLinks() {
    return this.getAllLinks().map(link => ({
      entityId: link.entityId,
      childId: link.childId,
      deviceName: link.deviceName,
      linkType: link.linkType,
      usageRules: link.usageRules
    }));
  }
}
```

### 4. ActivityTracker

**Purpose**: Track device usage and calculate time spent

**Responsibilities**:
- Monitor device state changes from WebSocket
- Calculate active time per device per child
- Distinguish between different activity types (gaming vs streaming)
- Generate usage reports

**API**:

```javascript
class ActivityTracker extends EventEmitter {
  constructor(haConnection, linkingManager, config) {
    super();
    this.haConnection = haConnection;
    this.linkingManager = linkingManager;
    this.config = config;

    this.activeSessions = new Map(); // entityId -> SessionInfo
    this.usageHistory = new Map(); // childId -> Array<UsageRecord>
  }

  /**
   * Initialize activity tracking
   */
  start() {
    // Listen for state changes from WebSocket
    this.haConnection.on('state_changed', (data) => {
      this.processStateChange(data);
    });
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
      // Device state changed while active (e.g., playing → paused)
      this.updateSession(entity_id, new_state);
    }
  }

  /**
   * Determine if state is "active"
   * @param {Object} state
   * @returns {boolean}
   */
  isActiveState(state) {
    if (!state) return false;

    const activeStates = ['on', 'playing', 'paused', 'idle'];
    return activeStates.includes(state.state);
  }

  /**
   * Start activity session
   * @param {string} entityId
   * @param {number} childId
   * @param {Object} state
   */
  startSession(entityId, childId, state) {
    const session = {
      entityId,
      childId,
      startTime: Date.now(),
      lastUpdate: Date.now(),
      activityType: this.detectActivityType(state),
      state: state,
      totalTime: 0
    };

    this.activeSessions.set(entityId, session);

    this.emit('session_started', session);
  }

  /**
   * End activity session
   * @param {string} entityId
   * @param {number} childId
   */
  endSession(entityId, childId) {
    const session = this.activeSessions.get(entityId);
    if (!session) return;

    const endTime = Date.now();
    const duration = endTime - session.startTime;

    // Record usage
    const usageRecord = {
      entityId,
      childId,
      startTime: session.startTime,
      endTime: endTime,
      duration: duration, // milliseconds
      activityType: session.activityType
    };

    // Store in history
    if (!this.usageHistory.has(childId)) {
      this.usageHistory.set(childId, []);
    }
    this.usageHistory.get(childId).push(usageRecord);

    this.activeSessions.delete(entityId);

    this.emit('session_ended', usageRecord);
  }

  /**
   * Update active session
   * @param {string} entityId
   * @param {Object} newState
   */
  updateSession(entityId, newState) {
    const session = this.activeSessions.get(entityId);
    if (!session) return;

    const now = Date.now();
    const elapsed = now - session.lastUpdate;

    session.totalTime += elapsed;
    session.lastUpdate = now;
    session.state = newState;
    session.activityType = this.detectActivityType(newState);

    this.emit('session_updated', session);
  }

  /**
   * Detect activity type from device state
   * @param {Object} state
   * @returns {string}
   */
  detectActivityType(state) {
    const { attributes } = state;

    // Media player activity detection
    if (attributes.media_content_type) {
      const type = attributes.media_content_type;

      if (type === 'game' || attributes.source?.includes('Game')) {
        return 'gaming';
      }

      if (type === 'video' || type === 'movie' || type === 'tvshow') {
        return 'video';
      }

      if (type === 'music' || type === 'audio') {
        return 'audio';
      }
    }

    // Default to generic screen time
    return 'screen_time';
  }

  /**
   * Get active sessions for a child
   * @param {number} childId
   * @returns {Array<SessionInfo>}
   */
  getActiveSessionsForChild(childId) {
    return Array.from(this.activeSessions.values())
      .filter(session => session.childId === childId);
  }

  /**
   * Get usage report for a child
   * @param {number} childId
   * @param {Date} startDate
   * @param {Date} endDate
   * @returns {Object}
   */
  getUsageReport(childId, startDate, endDate) {
    const records = this.usageHistory.get(childId) || [];

    // Filter by date range
    const filtered = records.filter(r =>
      r.startTime >= startDate.getTime() && r.endTime <= endDate.getTime()
    );

    // Calculate totals by activity type
    const totals = {};
    for (const record of filtered) {
      const type = record.activityType;
      if (!totals[type]) {
        totals[type] = 0;
      }
      totals[type] += record.duration;
    }

    // Calculate total across all types
    const totalTime = Object.values(totals).reduce((sum, time) => sum + time, 0);

    return {
      childId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalTime: totalTime,
      breakdown: totals,
      records: filtered.length
    };
  }

  /**
   * Flush active sessions (calculate current totals)
   * @returns {Array<Object>}
   */
  flushActiveSessions() {
    const updates = [];

    for (const [entityId, session] of this.activeSessions.entries()) {
      const now = Date.now();
      const elapsed = now - session.lastUpdate;
      session.totalTime += elapsed;
      session.lastUpdate = now;

      updates.push({
        entityId,
        childId: session.childId,
        activeTime: session.totalTime,
        activityType: session.activityType
      });
    }

    return updates;
  }

  /**
   * Stop tracking
   */
  stop() {
    this.haConnection.removeAllListeners('state_changed');
  }
}
```

---

## Data Monitors

### Monitor Scripts

The Home Assistant plugin uses **WebSocket subscriptions** instead of periodic monitor scripts, providing real-time state change detection.

### WebSocket Event Monitor

```javascript
/**
 * Monitor configuration
 */
module.exports = {
  id: 'ha-realtime-monitor',
  type: 'websocket',

  /**
   * Subscribe to Home Assistant events
   */
  async subscribe(haConnection, linkingManager) {
    // Subscribe to all state changes
    await haConnection.subscribeToEvents();

    // Filter only linked devices
    haConnection.on('state_changed', (data) => {
      const { entity_id } = data;

      if (linkingManager.getLink(entity_id)) {
        // Forward to activity tracker
        return data;
      }
    });
  }
};
```

---

## Action Scripts

### Turn Off Device via Smart Plug

```javascript
/**
 * Action: Turn off device via smart plug
 */
module.exports = {
  id: 'turn-off-smart-plug',
  platforms: ['all'],

  /**
   * Execute action
   * @param {Object} args
   * @param {HAConnectionManager} haConnection
   */
  async execute(args, haConnection) {
    const { entityId, childName, gracePeriod } = args;

    // Send warning notification
    await haConnection.callService('notify', 'persistent_notification', {
      message: `${childName}, your time is up! Device will turn off in ${gracePeriod} seconds.`,
      title: 'Parental Controls Warning'
    });

    // Wait grace period
    await new Promise(resolve => setTimeout(resolve, gracePeriod * 1000));

    // Turn off smart plug
    await haConnection.callService('switch', 'turn_off', {
      entity_id: entityId
    });

    return {
      success: true,
      message: `Turned off ${entityId}`
    };
  }
};
```

### Pause Media Player

```javascript
/**
 * Action: Pause media player
 */
module.exports = {
  id: 'pause-media-player',
  platforms: ['all'],

  async execute(args, haConnection) {
    const { entityId, childName } = args;

    // Pause playback
    await haConnection.callService('media_player', 'media_pause', {
      entity_id: entityId
    });

    // Send notification
    await haConnection.callService('notify', 'persistent_notification', {
      message: `${childName}, your screen time quota has been reached. Media playback paused.`,
      title: 'Screen Time Limit'
    });

    return {
      success: true,
      message: `Paused ${entityId}`
    };
  }
};
```

---

## Home Assistant API Integration

### REST API Examples

```javascript
// Get all entities
const entities = await haConnection.restClient.get('/api/states');

// Get specific entity
const xboxState = await haConnection.restClient.get('/api/states/sensor.xbox_power');

// Turn off smart plug
await haConnection.restClient.post('/api/services/switch/turn_off', {
  entity_id: 'switch.bobby_xbox_plug'
});

// Send notification
await haConnection.restClient.post('/api/services/notify/mobile_app_bobby_phone', {
  message: 'Xbox time is up!',
  title: 'Parental Controls'
});
```

### WebSocket API Flow

```javascript
// 1. Connect
ws = new WebSocket('ws://homeassistant.local:8123/api/websocket');

// 2. Authenticate
ws.send(JSON.stringify({
  type: 'auth',
  access_token: 'eyJ0eXAiOiJKV1Q...'
}));

// 3. Subscribe to events
ws.send(JSON.stringify({
  id: 1,
  type: 'subscribe_events',
  event_type: 'state_changed'
}));

// 4. Receive events
ws.on('message', (data) => {
  const message = JSON.parse(data);

  if (message.type === 'event' && message.event.event_type === 'state_changed') {
    const { entity_id, new_state, old_state } = message.event.data;

    // Process state change
    console.log(`${entity_id}: ${old_state.state} → ${new_state.state}`);
  }
});
```

---

## State Management

### Configuration Schema

```javascript
{
  // Home Assistant connection
  homeAssistant: {
    url: "http://homeassistant.local:8123",
    accessToken: "eyJ0eXAiOiJKV1QiLCJhbGc...",
    useWebSocket: true,
    reconnectDelay: 5000
  },

  // Device links
  deviceLinks: [
    {
      entityId: "sensor.xbox_series_x",
      childId: 123,
      deviceName: "Bobby's Xbox",
      linkType: "exclusive",
      location: "bedroom"
    },
    {
      entityId: "media_player.living_room_tv",
      childId: null,
      deviceName: "Family TV",
      linkType: "shared",
      usageRules: [
        {
          childId: 123,
          weekdays: ["mon", "tue", "wed", "thu", "fri"],
          timeRange: "15:00-17:00"
        },
        {
          childId: 456,
          weekdays: ["mon", "tue", "wed", "thu", "fri"],
          timeRange: "19:00-21:00"
        }
      ]
    }
  ],

  // Power controls (smart plugs)
  powerControls: [
    {
      entityId: "switch.bobby_xbox_plug",
      linkedDevice: "sensor.xbox_series_x",
      childId: 123,
      enforceQuota: true,
      gracePeriod: 60
    }
  ],

  // Energy tracking
  energyTracking: {
    enabled: true,
    costPerKwh: 0.12,
    reportingInterval: 86400000
  },

  // Activity classification
  activityTypes: {
    gaming: { quota: 'gaming' },
    video: { quota: 'video' },
    audio: { quota: 'music' },
    screen_time: { quota: 'screen' }
  }
}
```

---

## Error Handling

### Error Categories

1. **Connection Errors**: Cannot reach Home Assistant
2. **Authentication Errors**: Invalid access token
3. **Entity Not Found**: Linked device no longer exists
4. **Service Call Failed**: Cannot control device
5. **WebSocket Disconnected**: Real-time monitoring interrupted

### Error Recovery Strategy

```javascript
class ErrorHandler {
  constructor(statusUpdate) {
    this.statusUpdate = statusUpdate;
  }

  handle(error, context) {
    console.error(`[HA Plugin] Error in ${context}:`, error);

    switch (error.type) {
      case 'connection':
        this.statusUpdate({
          status: 'error',
          message: 'Cannot connect to Home Assistant. Check URL and network.',
          details: { error: error.message, context }
        });
        break;

      case 'auth_failed':
        this.statusUpdate({
          status: 'error',
          message: 'Invalid access token. Please update Home Assistant credentials.',
          details: { error: error.message, context }
        });
        break;

      case 'websocket':
        this.statusUpdate({
          status: 'warning',
          message: 'WebSocket disconnected. Will attempt to reconnect...',
          details: { error: error.message, context }
        });
        break;

      case 'service_call_failed':
        this.statusUpdate({
          status: 'warning',
          message: `Failed to control device: ${error.message}`,
          details: { error: error.message, context }
        });
        break;

      default:
        this.statusUpdate({
          status: 'error',
          message: `Unexpected error: ${error.message}`,
          details: { error: error.message, context }
        });
    }
  }
}
```

---

**Next**: See USE_CASES.md for detailed implementation scenarios
**Next**: See DEVICE_LINKING.md for device-child relationship design
**Next**: See INTEGRATIONS.md for specific Home Assistant integration examples
