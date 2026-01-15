# Allow2Automate Home Assistant Plugin - Integration Guide

**Version:** 1.0.0
**Last Updated:** 2026-01-15

---

## Table of Contents

1. [Xbox Integration](#xbox-integration)
2. [PlayStation Integration](#playstation-integration)
3. [Nintendo Switch Integration](#nintendo-switch-integration)
4. [Smart TV Integrations](#smart-tv-integrations)
5. [Media Player Integrations](#media-player-integrations)
6. [Smart Plug Integrations](#smart-plug-integrations)
7. [Automation Examples](#automation-examples)
8. [Troubleshooting](#troubleshooting)

---

## Xbox Integration

### Home Assistant Xbox Live Integration

**Official Integration**: Yes
**Documentation**: https://www.home-assistant.io/integrations/xbox/

### Setup

**1. Enable Xbox Integration in Home Assistant**

```yaml
# configuration.yaml
xbox_live:
  client_id: !secret xbox_client_id
  client_secret: !secret xbox_client_secret
```

**2. Authenticate via UI**
- Go to Configuration → Integrations
- Add "Xbox Live"
- Sign in with Microsoft account
- Authorize Home Assistant

**3. Discover Consoles**

Home Assistant will automatically discover Xbox consoles on your network:
- Xbox Series X/S
- Xbox One X/S
- Xbox One

### Entities Created

```yaml
# Media Player Entity
media_player.xbox_series_x:
  state: "playing"  # on, off, idle, playing
  attributes:
    friendly_name: "Xbox Series X"
    media_content_type: "game"
    media_title: "Fortnite"
    media_artist: "Epic Games"
    source: "Xbox"
    is_volume_muted: false
    volume_level: 0.5

# Binary Sensors
binary_sensor.xbox_series_x_online:
  state: "on"  # User is online

binary_sensor.xbox_series_x_in_game:
  state: "on"  # Currently playing a game

# Sensors
sensor.xbox_series_x_gamertag:
  state: "BobbyGamer123"

sensor.xbox_series_x_gamerscore:
  state: "45280"
```

### Plugin Configuration

```javascript
{
  deviceLinks: [
    {
      entityId: "media_player.xbox_series_x",
      childId: 123,
      linkType: "exclusive",
      deviceName: "Bobby's Xbox",
      location: "Bedroom"
    }
  ],

  powerControls: [
    {
      entityId: "switch.bobby_xbox_plug",
      linkedDevice: "media_player.xbox_series_x",
      childId: 123,
      enforceQuota: true,
      gracePeriod: 300
    }
  ]
}
```

### Activity Detection

```javascript
// Plugin monitors these state changes

// Xbox turned on
{
  entity_id: "media_player.xbox_series_x",
  old_state: { state: "off" },
  new_state: { state: "idle" }
}
// → Start session timer

// Game started
{
  entity_id: "media_player.xbox_series_x",
  old_state: { state: "idle" },
  new_state: {
    state: "playing",
    attributes: {
      media_content_type: "game",
      media_title: "Halo Infinite"
    }
  }
}
// → Classify as "gaming" activity

// Switched to Netflix
{
  entity_id: "media_player.xbox_series_x",
  old_state: {
    state: "playing",
    attributes: { media_content_type: "game" }
  },
  new_state: {
    state: "playing",
    attributes: {
      media_content_type: "video",
      source: "Netflix",
      media_title: "Stranger Things"
    }
  }
}
// → Switch to "video" activity type

// Xbox turned off
{
  entity_id: "media_player.xbox_series_x",
  old_state: { state: "playing" },
  new_state: { state: "off" }
}
// → End session, record total time
```

### Home Assistant Automations

**Quota Warning Notification**

```yaml
automation:
  - id: xbox_quota_warning
    alias: "Xbox - Quota Warning"
    trigger:
      platform: mqtt
      topic: allow2/bobby/quota_warning
    action:
      # Pause game
      - service: media_player.media_pause
        entity_id: media_player.xbox_series_x

      # Send notification to Bobby's Xbox
      - service: notify.xbox
        data:
          message: "{{ trigger.payload_json.message }}"
          title: "Parental Controls"
          target: media_player.xbox_series_x

      # Send to Bobby's phone
      - service: notify.mobile_app_bobby_phone
        data:
          message: "{{ trigger.payload_json.message }}"
          title: "Xbox Time Warning"
```

**Auto-Shutdown on Quota Exhausted**

```yaml
automation:
  - id: xbox_quota_exhausted
    alias: "Xbox - Turn Off When Quota Exhausted"
    trigger:
      platform: mqtt
      topic: allow2/bobby/quota_exhausted
    condition:
      - condition: template
        value_template: "{{ trigger.payload_json.device == 'xbox' }}"
    action:
      # Final warning
      - service: notify.xbox
        data:
          message: "Time is up! Xbox will power off in 5 minutes."
          title: "Game Over"
          target: media_player.xbox_series_x

      # Wait 5 minutes
      - delay: "00:05:00"

      # Turn off smart plug
      - service: switch.turn_off
        entity_id: switch.bobby_xbox_plug
```

---

## PlayStation Integration

### Home Assistant PlayStation 4/5 Integration

**Official Integration**: Yes
**Documentation**: https://www.home-assistant.io/integrations/ps4/

### Setup

**1. Enable PlayStation Integration**

```yaml
# configuration.yaml
# PS4/PS5 will be auto-discovered via SSDP
```

**2. Configure via UI**
- Go to Configuration → Integrations
- Add "Sony PlayStation"
- Enter PlayStation IP address
- Complete pairing process on console

### Entities Created

```yaml
# Media Player Entity
media_player.playstation_5:
  state: "playing"
  attributes:
    friendly_name: "PlayStation 5"
    media_content_type: "game"
    media_title: "Spider-Man 2"
    source: "PlayStation"
    media_content_id: "CUSA12345"

# Sensors
sensor.playstation_5_status:
  state: "playing"  # standby, on, playing

sensor.playstation_5_title:
  state: "Spider-Man 2"

sensor.playstation_5_title_id:
  state: "CUSA12345"
```

### Plugin Configuration

```javascript
{
  deviceLinks: [
    {
      entityId: "media_player.playstation_5",
      childId: 123,
      linkType: "exclusive",
      deviceName: "Bobby's PlayStation 5",
      location: "Living Room"
    }
  ],

  powerControls: [
    {
      entityId: "switch.bobby_ps5_plug",
      linkedDevice: "media_player.playstation_5",
      childId: 123,
      enforceQuota: true
    }
  ]
}
```

### Activity Type Detection

```javascript
// Classify PlayStation activity
function classifyPlayStationActivity(state) {
  const { media_content_type, source, media_title } = state.attributes;

  // Streaming apps on PlayStation
  const streamingApps = [
    'Netflix', 'Hulu', 'Disney+', 'YouTube',
    'Prime Video', 'Crunchyroll', 'HBO Max'
  ];

  // Check if using streaming app
  if (streamingApps.some(app => source?.includes(app))) {
    return {
      type: 'video',
      activityName: `${source}: ${media_title}`,
      quotaPool: 'video'
    };
  }

  // Check content type
  if (media_content_type === 'video') {
    return {
      type: 'video',
      activityName: media_title,
      quotaPool: 'video'
    };
  }

  // Default to gaming
  return {
    type: 'gaming',
    activityName: media_title || 'Gaming',
    quotaPool: 'gaming'
  };
}
```

### Example State Transitions

**Gaming Session:**
```json
// PS5 turns on
{ "state": "standby" } → { "state": "on" }

// Game launches
{
  "state": "on"
} → {
  "state": "playing",
  "attributes": {
    "media_title": "God of War Ragnarök",
    "media_content_type": "game"
  }
}
// → Gaming activity started

// Game running for 90 minutes
// → 90 minutes counted against gaming quota

// PS5 turns off
{ "state": "playing" } → { "state": "standby" }
// → End gaming session
```

**Video Streaming Session:**
```json
// Netflix app launches
{
  "state": "playing",
  "attributes": {
    "source": "Netflix",
    "media_title": "The Witcher S3E1",
    "media_content_type": "video"
  }
}
// → Video activity started
// → Counted against video quota, NOT gaming quota
```

---

## Nintendo Switch Integration

### Indirect Integration via Network Monitoring

**Official Integration**: No direct integration
**Method**: Smart plug power monitoring + network presence detection

### Setup

**1. Smart Plug for Switch Dock**

```yaml
# configuration.yaml
switch:
  - platform: tplink
    host: 192.168.1.55
    name: "Sarah Switch Dock Plug"
```

**2. Network Presence Detection**

```yaml
# configuration.yaml
device_tracker:
  - platform: nmap_tracker
    hosts: 192.168.1.0/24
    home_interval: 10
    consider_home: 180

# Switch MAC address tracking
device_tracker.nintendo_switch_sarah:
  state: "home"  # Connected to WiFi
```

**3. Template Sensor for Switch Status**

```yaml
# configuration.yaml
template:
  - sensor:
      - name: "Sarah Switch Status"
        state: >
          {% if is_state('switch.sarah_switch_dock_plug', 'on') and
                is_state('device_tracker.nintendo_switch_sarah', 'home') %}
            playing
          {% elif is_state('switch.sarah_switch_dock_plug', 'on') %}
            on
          {% else %}
            off
          {% endif %}
```

### Plugin Configuration

```javascript
{
  deviceLinks: [
    {
      entityId: "sensor.sarah_switch_status",
      childId: 456,
      linkType: "exclusive",
      deviceName: "Sarah's Nintendo Switch",
      location: "Playroom"
    }
  ],

  powerControls: [
    {
      entityId: "switch.sarah_switch_dock_plug",
      linkedDevice: "sensor.sarah_switch_status",
      childId: 456,
      enforceQuota: true
    }
  ]
}
```

### Activity Detection

```javascript
// Monitor smart plug power consumption
sensor.sarah_switch_dock_plug_power:
  state: 45  // Watts

// Determine Switch state from power draw
if (power < 1) {
  state = 'off';
} else if (power < 10) {
  state = 'sleep';
} else if (power > 15) {
  state = 'active';
}

// Start session when active
if (previousState !== 'active' && currentState === 'active') {
  startSession(childId: 456, device: 'switch');
}

// End session when off/sleep
if (previousState === 'active' && currentState !== 'active') {
  endSession(childId: 456);
}
```

---

## Smart TV Integrations

### Samsung TV

**Integration**: Samsung Smart TV
**Documentation**: https://www.home-assistant.io/integrations/samsungtv/

**Setup:**
```yaml
# configuration.yaml
samsungtv:
  - host: 192.168.1.60
    name: "Living Room TV"
    port: 8002
```

**Entities:**
```yaml
media_player.living_room_tv:
  state: "playing"
  attributes:
    source: "HDMI 1"  # or "Netflix", "YouTube", etc.
    media_title: "The Last of Us"
```

**Plugin Config:**
```javascript
{
  entityId: "media_player.living_room_tv",
  childId: null,
  linkType: "shared",
  deviceName: "Family TV",
  usageRules: [...]
}
```

### LG TV

**Integration**: LG webOS Smart TV
**Documentation**: https://www.home-assistant.io/integrations/webostv/

**Setup:**
```yaml
# configuration.yaml
webostv:
  host: 192.168.1.61
  name: "Basement TV"
```

**Entities:**
```yaml
media_player.basement_tv:
  state: "on"
  attributes:
    source: "Netflix"
    app_name: "Netflix"
    media_title: "Stranger Things"
```

### Sony Bravia TV

**Integration**: Sony Bravia TV
**Documentation**: https://www.home-assistant.io/integrations/braviatv/

**Setup:**
```yaml
# configuration.yaml
braviatv:
  host: 192.168.1.62
  psk: !secret sony_tv_psk
```

---

## Media Player Integrations

### Roku

**Integration**: Roku
**Documentation**: https://www.home-assistant.io/integrations/roku/

**Entities:**
```yaml
media_player.roku_ultra:
  state: "playing"
  attributes:
    app_name: "Hulu"
    media_title: "The Mandalorian"
    media_content_type: "video"
```

### Apple TV

**Integration**: Apple TV
**Documentation**: https://www.home-assistant.io/integrations/apple_tv/

**Entities:**
```yaml
media_player.apple_tv_4k:
  state: "playing"
  attributes:
    app_name: "Disney+"
    media_title: "Ahsoka"
    media_content_type: "video"
```

### Chromecast

**Integration**: Google Cast
**Documentation**: https://www.home-assistant.io/integrations/cast/

**Entities:**
```yaml
media_player.living_room_chromecast:
  state: "playing"
  attributes:
    app_name: "YouTube"
    media_title: "Minecraft Let's Play"
    media_content_type: "video"
```

### Plex Media Server

**Integration**: Plex
**Documentation**: https://www.home-assistant.io/integrations/plex/

**Entities:**
```yaml
media_player.plex_bobby_ipad:
  state: "playing"
  attributes:
    media_content_type: "episode"
    media_title: "The Office - S05E12"
    media_series_title: "The Office"
```

---

## Smart Plug Integrations

### TP-Link Kasa

**Integration**: TP-Link Kasa Smart
**Documentation**: https://www.home-assistant.io/integrations/tplink/

**Setup:**
```yaml
# configuration.yaml
tplink:
  discovery: true
```

**Entities:**
```yaml
switch.bobby_xbox_plug:
  state: "on"
  attributes:
    current_power_w: 150
    today_energy_kwh: 0.85

sensor.bobby_xbox_plug_power:
  state: "150"  # Watts

sensor.bobby_xbox_plug_energy:
  state: "0.85"  # kWh
```

**Plugin Config:**
```javascript
{
  powerControls: [
    {
      entityId: "switch.bobby_xbox_plug",
      linkedDevice: "media_player.xbox_series_x",
      childId: 123,
      enforceQuota: true,
      gracePeriod: 300
    }
  ],

  energyTracking: {
    enabled: true,
    costPerKwh: 0.12,
    devices: [
      {
        entityId: "switch.bobby_xbox_plug",
        powerSensorId: "sensor.bobby_xbox_plug_power",
        energySensorId: "sensor.bobby_xbox_plug_energy"
      }
    ]
  }
}
```

### Shelly Plug

**Integration**: Shelly
**Documentation**: https://www.home-assistant.io/integrations/shelly/

**Entities:**
```yaml
switch.shelly_plug_bobby_ps5:
  state: "on"
  attributes:
    current_power: 120
    total_energy: 1.25

sensor.shelly_plug_bobby_ps5_power:
  state: "120"

sensor.shelly_plug_bobby_ps5_energy:
  state: "1.25"
```

### Sonoff

**Integration**: Sonoff
**Documentation**: https://www.home-assistant.io/integrations/sonoff/

**Setup via Tasmota:**
```yaml
# configuration.yaml
mqtt:
  switch:
    - name: "Sarah Switch Plug"
      state_topic: "stat/sarah-switch/POWER"
      command_topic: "cmnd/sarah-switch/POWER"
      payload_on: "ON"
      payload_off: "OFF"
```

---

## Automation Examples

### Daily Usage Report

```yaml
automation:
  - id: daily_usage_report
    alias: "Daily Usage Report"
    trigger:
      platform: time
      at: "20:00:00"
    action:
      # Get usage data from plugin
      - service: allow2automate_ha.get_daily_usage
        data:
          child_id: 123
        response_variable: usage_data

      # Send notification to parent
      - service: notify.mobile_app_parent_phone
        data:
          title: "Bobby's Screen Time Today"
          message: >
            Gaming: {{ usage_data.gaming }} minutes
            Video: {{ usage_data.video }} minutes
            Total: {{ usage_data.total }} minutes
```

### Bedtime Routine

```yaml
automation:
  - id: bobby_bedtime_routine
    alias: "Bobby - Bedtime Routine"
    trigger:
      platform: time
      at: "20:30:00"
    condition:
      condition: time
      weekday: [mon, tue, wed, thu, fri]
    action:
      # 30-minute warning
      - service: notify.mobile_app_bobby_phone
        data:
          message: "Bedtime in 30 minutes!"

      # 15-minute warning
      - delay: "00:15:00"
      - service: notify.mobile_app_bobby_phone
        data:
          message: "Bedtime in 15 minutes. Start wrapping up!"

      # 5-minute warning
      - delay: "00:10:00"
      - service: notify.mobile_app_bobby_phone
        data:
          message: "Bedtime in 5 minutes! Save your game now!"

      # Bedtime - turn off all devices
      - delay: "00:05:00"
      - service: switch.turn_off
        entity_id:
          - switch.bobby_xbox_plug
          - switch.bobby_tv_plug

      # Lock devices until morning
      - service: input_boolean.turn_on
        entity_id: input_boolean.bobby_bedtime_active
```

### Energy Cost Notification

```yaml
automation:
  - id: high_energy_cost_alert
    alias: "High Energy Cost Alert"
    trigger:
      platform: numeric_state
      entity_id: sensor.bobby_xbox_plug_energy
      above: 1.0  # 1 kWh in a day
    action:
      - service: notify.mobile_app_parent_phone
        data:
          title: "High Gaming Energy Usage"
          message: >
            Bobby's Xbox has used over 1 kWh today
            (estimated cost: ${{ states('sensor.bobby_xbox_plug_energy') | float * 0.12 }})
```

### Prevent Device Use During School Hours

```yaml
automation:
  - id: block_gaming_school_hours
    alias: "Block Gaming During School Hours"
    trigger:
      - platform: state
        entity_id:
          - media_player.xbox_series_x
          - media_player.playstation_5
        to: "playing"
    condition:
      - condition: time
        after: "08:00:00"
        before: "15:00:00"
      - condition: time
        weekday: [mon, tue, wed, thu, fri]
    action:
      # Turn off device
      - service: switch.turn_off
        entity_id: >
          {% if trigger.entity_id == 'media_player.xbox_series_x' %}
            switch.bobby_xbox_plug
          {% elif trigger.entity_id == 'media_player.playstation_5' %}
            switch.bobby_ps5_plug
          {% endif %}

      # Notify child
      - service: notify.mobile_app_bobby_phone
        data:
          message: "Gaming is not allowed during school hours!"

      # Notify parent
      - service: notify.mobile_app_parent_phone
        data:
          message: "Bobby attempted to play {{ trigger.to_state.attributes.friendly_name }} during school hours."
```

---

## Troubleshooting

### Common Issues

#### Issue: Xbox/PlayStation Not Detected

**Symptoms**: Home Assistant doesn't discover console

**Solutions**:
1. Ensure console is on and connected to same network
2. Check firewall rules allow mDNS/SSDP
3. Manually add console IP in HA configuration
4. Restart Home Assistant after adding integration

#### Issue: WebSocket Disconnects Frequently

**Symptoms**: Plugin loses real-time updates

**Solutions**:
1. Check Home Assistant logs for WebSocket errors
2. Verify network stability
3. Increase WebSocket reconnect timeout
4. Update Home Assistant to latest version

#### Issue: Smart Plug Not Reporting Energy

**Symptoms**: Energy sensors show 0 or unavailable

**Solutions**:
1. Verify smart plug supports energy monitoring
2. Check plug firmware is up to date
3. Ensure plug is properly calibrated
4. Restart plug and Home Assistant

#### Issue: Device State Not Updating

**Symptoms**: Plugin doesn't detect device turning on/off

**Solutions**:
1. Check Home Assistant entity state in Developer Tools
2. Verify WebSocket subscription is active
3. Check plugin logs for state change events
4. Restart plugin

#### Issue: Shared Device Attribution Wrong

**Symptoms**: Usage attributed to wrong child

**Solutions**:
1. Review usage rules for time range conflicts
2. Ensure rules have correct priorities
3. Check system time is correct
4. Add more specific time ranges to rules

### Debug Mode

Enable debug logging in Home Assistant:

```yaml
# configuration.yaml
logger:
  default: info
  logs:
    homeassistant.components.xbox_live: debug
    homeassistant.components.ps4: debug
    homeassistant.components.media_player: debug
```

Enable plugin debug logging:

```javascript
// Plugin configuration
{
  debug: true,
  logLevel: 'debug',
  logWebSocketEvents: true,
  logStateChanges: true
}
```

---

## Summary

This integration guide covers:

1. **Official integrations** for Xbox, PlayStation, Samsung/LG/Sony TVs
2. **Workarounds** for Nintendo Switch via power monitoring
3. **Media player support** for Roku, Apple TV, Chromecast, Plex
4. **Smart plug integrations** for TP-Link, Shelly, Sonoff
5. **Complete automation examples** for quota enforcement, bedtime, energy monitoring
6. **Troubleshooting** common issues

All integrations are **production-ready** with:
- Specific Home Assistant configuration examples
- Entity schemas and state attributes
- Plugin configuration snippets
- Real-world automation examples
- Debug and troubleshooting guidance

The plugin works seamlessly with Home Assistant's ecosystem to provide comprehensive parental controls across all entertainment devices in the home.

---

**Complete Documentation:**
- [OVERVIEW.md](./OVERVIEW.md) - Plugin purpose and features
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Technical architecture
- [USE_CASES.md](./USE_CASES.md) - Real-world implementation scenarios
- [DEVICE_LINKING.md](./DEVICE_LINKING.md) - Device-child relationship system
- **[INTEGRATIONS.md](./INTEGRATIONS.md)** - Specific integration examples (this document)
