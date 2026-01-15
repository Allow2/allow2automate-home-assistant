# Allow2Automate Home Assistant Plugin - Documentation

**Version:** 1.0.0
**Status:** Design Phase
**Last Updated:** 2026-01-15

---

## Overview

The **allow2automate-homeassistant** plugin bridges parental controls with smart home automation by integrating with Home Assistant to monitor, track, and control entertainment devices across your home.

Transform your Home Assistant installation into a comprehensive parental control enforcement hub for gaming consoles, smart TVs, streaming devices, and more.

---

## Documentation Structure

### 📋 [OVERVIEW.md](./OVERVIEW.md)
**Complete plugin overview and features**
- Executive summary
- Core purpose and key features
- Real-world use cases with implementation details
- Technical approach and architecture overview
- Integration with Home Assistant ecosystem
- Security, privacy, and configuration requirements
- Performance metrics and future enhancements

**Start here** to understand what the plugin does and why you need it.

---

### 🏗️ [ARCHITECTURE.md](./ARCHITECTURE.md)
**Technical architecture and implementation details**
- System architecture diagrams
- Core components (HAConnectionManager, DeviceDiscoveryService, ActivityTracker, etc.)
- Data monitors and action scripts
- Home Assistant API integration (REST & WebSocket)
- Device discovery and linking system
- Activity tracking and enforcement engine
- State management and error handling
- Database schemas and API design

**Read this** for deep technical implementation details.

---

### 📖 [USE_CASES.md](./USE_CASES.md)
**Real-world implementation scenarios**
- Gaming console time tracking (Xbox, PlayStation)
- Shared TV usage attribution
- Smart plug energy monitoring
- Bedtime automation
- Weekend vs weekday quotas
- Multi-device per child
- Remote parental override
- Activity type differentiation (gaming vs streaming)
- Power vampire detection
- Multi-child multi-room setup

**Read this** for complete end-to-end implementation examples.

---

### 🔗 [DEVICE_LINKING.md](./DEVICE_LINKING.md)
**Bi-directional device-child relationship system**
- Link types (exclusive, shared, family, power_control)
- Database schema for device links and usage rules
- Linking workflow (discovery → suggestion → review → create)
- Usage attribution logic with time-based rules
- UI mockups for device management
- API design for link management
- Smart linking suggestions with AI pattern matching

**Read this** to understand how children and devices are linked.

---

### ⚙️ [INTEGRATIONS.md](./INTEGRATIONS.md)
**Specific Home Assistant integration examples**
- Xbox Live integration with entity examples
- PlayStation 4/5 integration
- Nintendo Switch (indirect via power monitoring)
- Smart TV integrations (Samsung, LG, Sony)
- Media player integrations (Roku, Apple TV, Chromecast, Plex)
- Smart plug integrations (TP-Link Kasa, Shelly, Sonoff)
- Complete automation examples in YAML
- Troubleshooting guide

**Read this** for specific device integration instructions.

---

## Quick Start

### 1. Review the Plugin Purpose
Start with **[OVERVIEW.md](./OVERVIEW.md)** to understand:
- What the plugin does
- Key features and capabilities
- Real-world use cases
- Integration approach

### 2. Understand the Architecture
Read **[ARCHITECTURE.md](./ARCHITECTURE.md)** to learn:
- How the plugin connects to Home Assistant
- Core components and their responsibilities
- Data flow and state management
- API integration (REST & WebSocket)

### 3. Explore Implementation Scenarios
Study **[USE_CASES.md](./USE_CASES.md)** for:
- Complete implementation examples
- Flow diagrams with step-by-step execution
- Database records and API calls
- Parent dashboard mockups

### 4. Learn Device Linking
Review **[DEVICE_LINKING.md](./DEVICE_LINKING.md)** for:
- How to link devices to children
- Shared device usage rules
- Smart linking suggestions
- UI workflows

### 5. Implement Specific Integrations
Follow **[INTEGRATIONS.md](./INTEGRATIONS.md)** to:
- Set up Xbox, PlayStation, Switch tracking
- Configure smart TV monitoring
- Install and configure smart plugs
- Create Home Assistant automations

---

## Key Features

### 🎮 Multi-Device Activity Tracking
- Xbox Series X/S, One
- PlayStation 5, 4
- Nintendo Switch
- Smart TVs (Samsung, LG, Sony)
- Streaming devices (Roku, Apple TV, Chromecast)

### 👨‍👩‍👧‍👦 Flexible Device-Child Linking
- Exclusive devices (Bobby's Xbox)
- Shared devices with time-based rules (Family TV)
- Family devices (not tracked)
- Smart plug power controls

### ⚡ Real-Time Monitoring
- WebSocket subscriptions for instant updates
- Live device state changes
- Activity type classification (gaming vs streaming)
- Energy consumption tracking

### 🔌 Smart Plug Integration
- Power control for quota enforcement
- Energy monitoring (kWh, cost)
- Standby power detection
- Automated device shutdown

### 📊 Parent Dashboard
- All linked devices with status
- Current activity by child
- Usage vs quota tracking
- Energy consumption reports
- Weekly/monthly summaries

### 🌙 Automated Enforcement
- Quota warnings and exhaustion
- Bedtime automation
- Remote parent controls
- Device blocking and reactivation prevention

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│              Allow2Automate Application                 │
│  ┌──────────────────────────────────────────────────┐  │
│  │       Home Assistant Plugin (Main Process)        │  │
│  │  • REST API Client                                │  │
│  │  • WebSocket Event Subscriber                     │  │
│  │  • Device-Child Mapper                            │  │
│  │  • Activity Tracker                               │  │
│  │  • Quota Enforcer                                 │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
                       │
              REST & WebSocket
                       │
                       ▼
┌────────────────────────────────────────────────────────┐
│                  Home Assistant                         │
│  • Xbox, PlayStation, Switch integrations              │
│  • Smart TV integrations (Samsung, LG, Sony)           │
│  • Media players (Roku, Apple TV, Chromecast)          │
│  • Smart plugs (TP-Link, Shelly, Sonoff)              │
│  • Energy monitoring sensors                           │
└────────────────────────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────┐
│              Physical Devices                           │
│  Gaming Consoles • TVs • Media Players • Smart Plugs   │
└────────────────────────────────────────────────────────┘
```

---

## Example Use Case

### Bobby's Xbox Screen Time Tracking

**Setup:**
- Bobby (age 12) has Xbox Series X in bedroom
- Daily quota: 2 hours gaming
- Smart plug controls Xbox power

**Flow:**
1. Bobby turns on Xbox (3:30 PM)
2. Plugin receives WebSocket event from Home Assistant
3. Activity Tracker starts session for Bobby
4. Usage logged to Allow2 API every 5 minutes
5. At 5:25 PM (115 minutes), warning notification sent
6. At 5:30 PM (120 minutes), smart plug turns off Xbox
7. Bobby sees notification: "Daily Xbox time limit reached"

**Result:**
- Accurate time tracking
- Automatic enforcement
- Parent dashboard shows usage
- Energy cost calculated and reported

---

## Database Schema Summary

### Core Tables

**device_links** - Links Home Assistant entities to children
- `entity_id` (VARCHAR) - HA entity ID
- `child_id` (INTEGER) - Allow2 child ID
- `link_type` (VARCHAR) - exclusive, shared, family, power_control
- `device_name` (VARCHAR) - Friendly name
- `location` (VARCHAR) - Physical location

**device_usage_rules** - Time-based rules for shared devices
- `device_link_id` (INTEGER) - FK to device_links
- `child_id` (INTEGER) - Which child
- `weekdays` (TEXT[]) - Days of week
- `time_range` (VARCHAR) - HH:MM-HH:MM
- `priority` (INTEGER) - Rule priority

**device_activity_log** - Activity history
- `device_link_id` (INTEGER) - FK to device_links
- `child_id` (INTEGER) - Active child
- `activity_type` (VARCHAR) - gaming, video, audio, screen_time
- `start_time`, `end_time` (TIMESTAMP)
- `duration_ms` (BIGINT)

**device_energy_usage** - Energy tracking
- `device_link_id` (INTEGER) - FK to device_links
- `date` (DATE)
- `kwh_consumed` (DECIMAL)
- `cost_usd` (DECIMAL)
- `hours_active` (DECIMAL)

---

## API Examples

### Home Assistant REST API

```javascript
// Get all entities
GET http://homeassistant.local:8123/api/states
Authorization: Bearer <access-token>

// Get Xbox state
GET http://homeassistant.local:8123/api/states/media_player.xbox_series_x

// Turn off smart plug
POST http://homeassistant.local:8123/api/services/switch/turn_off
{
  "entity_id": "switch.bobby_xbox_plug"
}
```

### Home Assistant WebSocket API

```javascript
// Connect
ws://homeassistant.local:8123/api/websocket

// Authenticate
{ "type": "auth", "access_token": "<token>" }

// Subscribe to state changes
{ "id": 1, "type": "subscribe_events", "event_type": "state_changed" }

// Receive state change event
{
  "id": 1,
  "type": "event",
  "event": {
    "event_type": "state_changed",
    "data": {
      "entity_id": "media_player.xbox_series_x",
      "new_state": { "state": "playing" }
    }
  }
}
```

---

## Configuration Example

### Plugin Configuration

```javascript
{
  // Home Assistant connection
  homeAssistant: {
    url: "http://homeassistant.local:8123",
    accessToken: "eyJ0eXAiOiJKV1Qi...",
    useWebSocket: true
  },

  // Device links
  deviceLinks: [
    {
      entityId: "media_player.xbox_series_x",
      childId: 123,
      deviceName: "Bobby's Xbox",
      linkType: "exclusive",
      location: "Bobby's Bedroom"
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
        }
      ]
    }
  ],

  // Power controls
  powerControls: [
    {
      entityId: "switch.bobby_xbox_plug",
      linkedDevice: "media_player.xbox_series_x",
      childId: 123,
      enforceQuota: true,
      gracePeriod: 300
    }
  ],

  // Energy tracking
  energyTracking: {
    enabled: true,
    costPerKwh: 0.12,
    reportingInterval: 86400000
  }
}
```

---

## Development Roadmap

### Phase 1: Core Implementation ✅ (Design Complete)
- [x] Plugin architecture design
- [x] Home Assistant API integration
- [x] Device discovery service
- [x] Device linking system
- [x] Activity tracking engine
- [x] Quota enforcement
- [x] Documentation

### Phase 2: Implementation (Next Steps)
- [ ] Build core components
- [ ] Implement WebSocket client
- [ ] Create device discovery logic
- [ ] Build activity tracker
- [ ] Implement enforcement actions
- [ ] Create parent dashboard UI

### Phase 3: Testing & Refinement
- [ ] Unit tests for all components
- [ ] Integration tests with Home Assistant
- [ ] Beta testing with real families
- [ ] Performance optimization
- [ ] Bug fixes and improvements

### Phase 4: Advanced Features
- [ ] AI-powered usage attribution
- [ ] Voice assistant integration
- [ ] Multi-home support
- [ ] Usage predictions
- [ ] Geofencing support

---

## Requirements

### Home Assistant
- Version: 2023.1 or later
- Installation: Core, Supervised, OS, or Container
- Network: Local network access required
- Authentication: Long-lived access token

### Allow2Automate
- Version: 1.0.0+
- Platform: Electron-based application
- Node.js: 16.x or later

### Integrations (Optional)
- Xbox Live integration
- PlayStation integration
- Smart TV integrations (Samsung, LG, Sony)
- Media player integrations (Roku, Apple TV, etc.)
- Smart plug integrations (TP-Link, Shelly, Sonoff)

---

## Performance Targets

- **API Latency**: < 100ms for REST calls
- **WebSocket Latency**: < 50ms for event delivery
- **Memory Usage**: < 30 MB
- **CPU Usage**: < 1% average
- **Enforcement Latency**: < 2 seconds

---

## Support & Resources

### Documentation
- [Home Assistant Documentation](https://www.home-assistant.io/docs/)
- [Home Assistant API](https://developers.home-assistant.io/docs/api/rest/)
- [Allow2 API Documentation](https://developer.allow2.com/)

### Community
- [Home Assistant Community](https://community.home-assistant.io/)
- [Allow2 Support](https://allow2.com/support/)

---

## License

See main Allow2Automate project license.

---

## Authors

- Allow2Automate Team
- Documentation designed by Claude (Anthropic)

---

**Ready to implement?** Start with [ARCHITECTURE.md](./ARCHITECTURE.md) for technical details, then review [INTEGRATIONS.md](./INTEGRATIONS.md) for specific device setup instructions.
