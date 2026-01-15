# Allow2Automate Home Assistant Plugin - Overview

**Version:** 1.0.0
**Status:** Design Phase
**Platform:** Home Assistant (Core, Supervised, OS, Container)

---

## 🎯 Critical Architecture Understanding

**Allow2 Platform is the Control Center:**
- **ALL parental decisions** (allowances, quotas, bans, day types) are managed through **Allow2 apps** (iOS, Android, Web)
- **Parent-child communication** (requests, approvals, notifications) happens through **Allow2 apps**
- **Allow2automate is NOT a configuration app** - it's a conduit/executor that connects Allow2 platform to devices

**Workflow:**
```
Parent Sets Rules → Allow2 Platform → allow2automate → Home Assistant → Device Control
Device Usage → Home Assistant → allow2automate → Allow2 Platform → Parent Sees in App
```

**The allow2automate parent app should ONLY:**
- Display linked devices and their current status
- Show device activity (which child is using what, when)
- Provide device linking UI (connect HA devices to Allow2 children)
- **NOT provide quota configuration**
- **NOT provide ban/pausing controls**
- **NOT provide child communication features**

---

## Executive Summary

The **allow2automate-homeassistant** plugin bridges parental controls with smart home automation by integrating with Home Assistant to monitor, track, and control entertainment devices, gaming consoles, TVs, and other smart home entities used by children.

**This plugin enforces decisions made in the Allow2 platform** - it does not make parental control decisions itself.

Unlike OS-level plugins that monitor computers, this plugin leverages Home Assistant's unified smart home platform to track and control:
- Gaming consoles (Xbox, PlayStation, Nintendo Switch)
- Smart TVs and streaming devices
- Media players (Roku, Apple TV, Chromecast)
- Smart plugs monitoring device power consumption
- Screen time across all connected entertainment devices

---

## Core Purpose

This plugin transforms Home Assistant into a parental control **enforcement hub** (not a decision-making hub) by:

1. **Monitoring device power states and activity** via Home Assistant sensors
2. **Tracking screen time per child per device** and reporting to Allow2 platform
3. **Measuring electricity usage** for gaming consoles and entertainment devices
4. **Automating device control** when quota limits (set in Allow2 apps) are reached
5. **Providing unified dashboard** in allow2automate app showing all linked devices and their activity
6. **Real-time enforcement** of rules configured in Allow2 platform

**Important:** Parents manage quotas, bans, and day types through Allow2 mobile/web apps, NOT through allow2automate.

---

## Key Features

### 1. Multi-Device Activity Tracking

**Gaming Consoles:**
- Xbox Series X/S, One
- PlayStation 5, 4
- Nintendo Switch (via power monitoring)

**Streaming & Media:**
- Smart TVs (Samsung, LG, Sony)
- Roku, Apple TV, Chromecast
- Fire TV, Android TV

**Power Monitoring:**
- Smart plug energy consumption
- Detect device on/off states
- Calculate usage costs

### 2. Bi-Directional Device-Child Linking

**Flexible Linking:**
- Link devices to specific children
- Link children to multiple devices
- Shared family devices with usage attribution
- Auto-detect active user when possible

**Linking Methods:**
- Manual parent assignment via UI
- Device location/room based (e.g., "Bobby's Xbox in bedroom")
- Time-based usage patterns (e.g., who uses device after school)
- Smart switch detection (e.g., smart plug on Bobby's TV)

### 3. Real-Time Monitoring via WebSocket

**Live Updates:**
- Subscribe to Home Assistant state changes
- Real-time device power state transitions
- Media player activity (playing, paused, idle)
- Instant quota enforcement triggers

**Event Streaming:**
```javascript
// Subscribe to Xbox power state
ws.send({
  type: 'subscribe_entities',
  entity_id: 'sensor.xbox_series_x_power'
});

// Receive state change
{
  event: {
    entity_id: 'sensor.xbox_series_x_power',
    new_state: { state: 'on', attributes: { ... } }
  }
}
```

### 4. Energy Monitoring & Cost Tracking

**Smart Plug Integration:**
- Track watt-hours consumed per device
- Calculate electricity costs per child
- Identify power vampires (standby consumption)
- Usage reports with cost breakdowns

**Example:**
```
Bobby's Xbox:
- Hours Used: 24h this week
- Energy Consumed: 3.2 kWh
- Estimated Cost: $0.38
- Peak Usage: Saturday 2-8pm
```

### 5. Automated Device Control

**Enforcement Actions:**
- Turn off smart plug when quota exhausted
- Send notifications to Home Assistant UI
- Trigger Home Assistant automations
- Pause media playback
- Lock device via smart plug schedule

**Warning System:**
```yaml
# Home Assistant automation example
automation:
  - alias: "Warn Bobby - 5 minutes left"
    trigger:
      platform: mqtt
      topic: allow2/bobby/quota_warning
    action:
      service: notify.mobile_app_bobby_phone
      data:
        message: "5 minutes of Xbox time remaining!"
```

### 6. Parent Dashboard & Reports

**Dashboard Features (in allow2automate app):**
- All linked devices with status
- Current activity by child
- Device-specific history
- Energy consumption charts

**Note:** Quotas, allowances, and parental controls are managed in **Allow2 mobile/web apps**, NOT in the allow2automate app. The allow2automate dashboard shows device activity and enforces rules, but does not configure them.

---

## Real-World Use Cases

### Use Case 1: Xbox Screen Time Tracking

**Scenario:** Bobby has 2 hours of Xbox time per day

**Setup:**
- Home Assistant Xbox integration detects console
- Smart plug monitors Xbox power consumption
- Plugin links Xbox to Bobby's Allow2 account in allow2automate app
- **Parent sets quota in Allow2 mobile/web app: 120 minutes/day**

**Flow:**
1. Bobby turns on Xbox → HA detects power state change
2. Plugin receives WebSocket event, starts timer for Bobby
3. Plugin sends usage to Allow2 API every 5 minutes
4. **Allow2 platform calculates remaining quota** based on parent's rules
5. At 115 minutes, **Allow2 platform triggers warning** → plugin sends notification
6. At 120 minutes, **Allow2 platform signals quota exhausted** → plugin turns off Xbox via smart plug
7. Bobby sees notification: "Daily Xbox time limit reached"

**Note:** The quota (120 minutes) is configured in the Allow2 app, NOT in allow2automate.

### Use Case 2: Shared Family TV with Multiple Users

**Scenario:** Living room TV used by Bobby and Sarah

**Setup:**
- Samsung TV integrated via Home Assistant
- Parent manually assigns usage periods
- Plugin tracks "who's watching when"

**Flow:**
1. Bobby logs into Netflix on TV (3-5 PM)
2. Plugin attributes usage to Bobby during his typical time
3. Sarah uses TV after dinner (7-9 PM)
4. Plugin attributes usage to Sarah
5. Weekly report shows:
   - Bobby: 10 hours this week
   - Sarah: 8 hours this week
   - Parents: 5 hours (not tracked)

### Use Case 3: Multi-Device Energy Monitoring

**Scenario:** Parent wants to track electricity cost of all gaming

**Setup:**
- Xbox on smart plug (bedroom)
- PlayStation on smart plug (living room)
- Nintendo Switch dock on smart plug (playroom)
- All plugs integrated in Home Assistant

**Dashboard Shows:**
```
This Month's Gaming Energy:
┌──────────────────────────────────────┐
│ Device          Hours  Energy  Cost  │
├──────────────────────────────────────┤
│ Xbox Series X     45h   6.8kWh $0.82 │
│ PlayStation 5     32h   4.2kWh $0.51 │
│ Switch Dock       18h   0.9kWh $0.11 │
├──────────────────────────────────────┤
│ Total            95h  11.9kWh $1.44  │
└──────────────────────────────────────┘
```

### Use Case 4: Bedtime Enforcement via Smart Plugs

**Scenario:** All gaming devices must turn off at 9 PM on school nights

**Setup:**
- Home Assistant schedule automation
- Plugin coordinates with bedtime rules
- Smart plugs cut power at bedtime

**Automation:**
```yaml
automation:
  - alias: "Bobby Bedtime - Gaming Off"
    trigger:
      platform: time
      at: "20:45:00"
    condition:
      condition: time
      weekday: [mon, tue, wed, thu, fri]
    action:
      # Warning notification
      - service: notify.bobby_phone
        data:
          message: "Gaming devices will turn off in 15 minutes for bedtime"
      # At 9 PM, cut power
      - delay: "00:15:00"
      - service: switch.turn_off
        entity_id:
          - switch.bobby_xbox_plug
          - switch.bobby_tv_plug
```

### Use Case 5: Remote Parental Control

**Scenario:** Parent at work sees Bobby is on Xbox during school hours

**Setup:**
- Home Assistant mobile app
- Plugin provides parent controls
- Remote device shutdown capability

**Flow:**
1. Parent opens Home Assistant app
2. Sees "Bobby's Xbox" is ON
3. Time: 2:30 PM (school day)
4. Parent taps "Turn Off Xbox"
5. Smart plug turns off via HA
6. Bobby receives notification: "Parent has turned off Xbox remotely"

### Use Case 6: PlayStation Network Time Tracking

**Scenario:** Track when Bobby is actually playing vs just Netflix

**Setup:**
- PlayStation integration shows media state
- Plugin distinguishes gaming vs streaming
- Different quotas for gaming vs video

**Implementation:**
```javascript
// Detect activity type from Home Assistant sensor
const ps5State = {
  state: 'playing',
  attributes: {
    media_content_type: 'game',
    media_title: 'Spider-Man 2',
    source: 'PlayStation'
  }
};

// Plugin logic
if (ps5State.attributes.media_content_type === 'game') {
  // Count against gaming quota (2h/day)
  trackUsage(bobby, 'gaming', device='ps5');
} else if (ps5State.attributes.media_content_type === 'video') {
  // Count against video quota (1h/day)
  trackUsage(bobby, 'video', device='ps5');
}
```

---

## Technical Approach

### Architecture Overview

```
┌───────────────────────────────────────────────────────────────┐
│              Allow2Automate Application                        │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │         Home Assistant Plugin (Main Process)             │  │
│  │  • REST API Client                                       │  │
│  │  • WebSocket Event Subscriber                            │  │
│  │  • Device-Child Mapper                                   │  │
│  │  • Activity Tracker                                      │  │
│  │  • Quota Enforcer                                        │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
                           │
                  REST API & WebSocket
                           │
                           ▼
┌───────────────────────────────────────────────────────────────┐
│                    Home Assistant                              │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Integrations (Xbox, PlayStation, SmartThings, etc.)    │  │
│  └─────────────────────────────────────────────────────────┘  │
│                           │                                    │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Entities (sensors, switches, media_players)            │  │
│  │  • sensor.xbox_power                                     │  │
│  │  • media_player.living_room_tv                           │  │
│  │  • switch.bobby_gaming_plug                              │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌───────────────────────────────────────────────────────────────┐
│                    Physical Devices                            │
│  Xbox • PlayStation • TVs • Smart Plugs • Switches            │
└───────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Device Discovery**: Plugin queries Home Assistant REST API for all entities
2. **Entity Classification**: Identifies gaming consoles, TVs, media players, smart plugs
3. **Device Linking**: Parent links entities to children via plugin UI
4. **State Monitoring**: WebSocket subscribes to entity state changes
5. **Usage Tracking**: Plugin tracks active time per device per child
6. **Quota Checking**: Plugin queries Allow2 API for quotas every 30 seconds
7. **Enforcement**: Plugin calls Home Assistant services to control devices
8. **Reporting**: Plugin sends activity logs to Allow2 API

---

## Integration with Home Assistant Ecosystem

### Supported Integrations

**Gaming:**
- Xbox (official integration)
- PlayStation (official integration)
- Steam (via custom component)
- Nintendo Switch (via network monitoring)

**Media:**
- Smart TV integrations (Samsung, LG, Sony, Vizio)
- Roku
- Apple TV
- Chromecast
- Fire TV
- Plex, Kodi, Emby

**Power Monitoring:**
- TP-Link Kasa smart plugs
- Shelly plugs
- Sonoff devices
- Zigbee/Z-Wave plugs
- Tuya/Smart Life plugs
- Energy monitoring sensors

### Home Assistant API Usage

**REST API:**
```javascript
// Get all entities
GET http://homeassistant.local:8123/api/states
Authorization: Bearer <long-lived-access-token>

// Get specific entity state
GET http://homeassistant.local:8123/api/states/sensor.xbox_power

// Call service (turn off device)
POST http://homeassistant.local:8123/api/services/switch/turn_off
{
  "entity_id": "switch.bobby_xbox_plug"
}
```

**WebSocket API:**
```javascript
// Connect
ws://homeassistant.local:8123/api/websocket

// Authenticate
{
  "type": "auth",
  "access_token": "<token>"
}

// Subscribe to state changes
{
  "id": 1,
  "type": "subscribe_events",
  "event_type": "state_changed"
}

// Receive state change
{
  "id": 1,
  "type": "event",
  "event": {
    "event_type": "state_changed",
    "data": {
      "entity_id": "sensor.xbox_power",
      "old_state": { "state": "off" },
      "new_state": { "state": "on" }
    }
  }
}
```

---

## Security & Privacy Considerations

1. **Access Token Security**: Home Assistant long-lived access tokens stored securely
2. **Local Network Only**: Plugin communicates on LAN, no cloud required
3. **Privacy Focused**: No video/audio monitoring, only device state
4. **Parent Controls**: Only parents can modify device links and quotas
5. **Audit Trail**: All enforcement actions logged for transparency

---

## Configuration Requirements

### Home Assistant Setup

```yaml
# Home Assistant configuration.yaml
http:
  cors_allowed_origins:
    - http://localhost:*

# Long-lived access token created via:
# Profile → Security → Long-Lived Access Tokens → Create Token
```

### Plugin Configuration

```javascript
{
  // Home Assistant connection
  homeAssistant: {
    url: "http://homeassistant.local:8123",
    accessToken: "eyJ0eXAiOiJKV1QiLCJhbGc...",
    useWebSocket: true
  },

  // Device-to-child mappings
  deviceLinks: [
    {
      entityId: "sensor.xbox_series_x",
      deviceName: "Bobby's Xbox",
      childId: 123,
      location: "bedroom"
    },
    {
      entityId: "media_player.living_room_tv",
      deviceName: "Family TV",
      childId: null,  // Shared device
      usageRules: [
        { childId: 123, timeRange: "15:00-17:00", weekdays: ["mon", "tue", "wed", "thu", "fri"] },
        { childId: 456, timeRange: "19:00-21:00", weekdays: ["mon", "tue", "wed", "thu", "fri"] }
      ]
    }
  ],

  // Smart plug power controls
  powerControls: [
    {
      entityId: "switch.bobby_xbox_plug",
      linkedDevice: "sensor.xbox_series_x",
      childId: 123,
      enforceQuota: true
    }
  ],

  // Energy monitoring
  energyTracking: {
    enabled: true,
    costPerKwh: 0.12,  // USD
    reportingInterval: 86400000  // Daily
  }
}
```

---

## Performance Metrics

- **API Latency**: < 100ms for state queries
- **WebSocket Latency**: < 50ms for event delivery
- **Memory Usage**: < 30 MB
- **CPU Usage**: < 1% average
- **Network Bandwidth**: < 10 KB/s average

---

## Future Enhancements

1. **AI-Powered Usage Attribution**: Automatically detect which child is using shared devices
2. **Device Recommendations**: Suggest linking new devices when detected
3. **Usage Predictions**: Forecast quota exhaustion times
4. **Multi-Home Support**: Manage devices across multiple locations
5. **Voice Assistant Integration**: "Alexa, how much Xbox time does Bobby have left?"
6. **Geofencing**: Auto-disable controls when child is away from home

---

## Success Criteria

- **Accurate Tracking**: 95%+ accuracy in device state detection
- **Real-Time Response**: < 2 second enforcement latency
- **Parent Satisfaction**: 4.5+ star rating
- **Reliability**: 99%+ uptime for monitoring
- **Adoption**: 500+ active installations in first year

---

**Next Steps:**
1. Review architecture design (ARCHITECTURE.md)
2. Implement device linking system (DEVICE_LINKING.md)
3. Study popular integrations (INTEGRATIONS.md)
4. Build comprehensive use cases (USE_CASES.md)
