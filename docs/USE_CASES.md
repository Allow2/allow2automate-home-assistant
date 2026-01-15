# Allow2Automate Home Assistant Plugin - Use Cases

**Version:** 1.0.0
**Last Updated:** 2026-01-15

---

## Table of Contents

1. [Gaming Console Time Tracking](#gaming-console-time-tracking)
2. [Shared TV Usage Attribution](#shared-tv-usage-attribution)
3. [Smart Plug Energy Monitoring](#smart-plug-energy-monitoring)
4. [Bedtime Automation](#bedtime-automation)
5. [Weekend vs Weekday Quotas](#weekend-vs-weekday-quotas)
6. [Multi-Device Per Child](#multi-device-per-child)
7. [Remote Parental Override](#remote-parental-override)
8. [Activity Type Differentiation](#activity-type-differentiation)
9. [Power Vampire Detection](#power-vampire-detection)
10. [Multi-Child Multi-Room Setup](#multi-child-multi-room-setup)

---

## Gaming Console Time Tracking

### Use Case: Bobby's Xbox Screen Time

**Scenario:**
- Bobby (age 12) has an Xbox Series X in his bedroom
- Parents allow 2 hours of gaming per weekday, 4 hours per weekend day
- Xbox is connected to a TP-Link Kasa smart plug for power monitoring

### Home Assistant Setup

**Entities:**
- `media_player.xbox_series_x` - Xbox integration
- `sensor.xbox_series_x_power` - Power state sensor
- `switch.bobby_xbox_plug` - Smart plug controlling Xbox power

**Home Assistant Configuration:**
```yaml
# configuration.yaml
xbox_live:
  devices:
    - device: "FD0123456789"
      name: "Bobby's Xbox"

# Kasa smart plug
switch:
  - platform: tplink
    host: 192.168.1.50
    name: "Bobby Xbox Plug"
```

### Plugin Configuration

```javascript
{
  deviceLinks: [
    {
      entityId: "media_player.xbox_series_x",
      childId: 123,
      deviceName: "Bobby's Xbox",
      linkType: "exclusive",
      location: "Bobby's Bedroom"
    }
  ],

  powerControls: [
    {
      entityId: "switch.bobby_xbox_plug",
      linkedDevice: "media_player.xbox_series_x",
      childId: 123,
      enforceQuota: true,
      gracePeriod: 300  // 5 minutes warning
    }
  ]
}
```

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Bobby turns on Xbox (3:30 PM)                             │
├─────────────────────────────────────────────────────────────┤
│ • Smart plug detects power draw: 150W                        │
│ • HA state change: switch.bobby_xbox_plug → 'on'            │
│ • Plugin receives WebSocket event                            │
│ • Activity Tracker starts session for childId=123            │
│ • API call: POST /log (activity_id=1, start_time=...)       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 2. Gaming in progress (3:30 PM - 5:25 PM)                    │
├─────────────────────────────────────────────────────────────┤
│ • Activity Tracker updates session every 5 minutes           │
│ • Plugin sends usage to Allow2: POST /log                    │
│ • Current usage: 115 minutes                                 │
│ • Quota remaining: 5 minutes                                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 3. Quota warning (5:25 PM)                                   │
├─────────────────────────────────────────────────────────────┤
│ • Quota Manager detects 5 minutes remaining                  │
│ • Trigger warning notification                               │
│                                                              │
│ HA Service Call:                                             │
│   notify.mobile_app_bobby_phone:                             │
│     message: "5 minutes of Xbox time remaining!"            │
│     title: "Parental Controls"                               │
│                                                              │
│ • Bobby sees notification on phone and Xbox overlay          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 4. Quota exhausted (5:30 PM)                                 │
├─────────────────────────────────────────────────────────────┤
│ • Quota Manager detects 0 minutes remaining                  │
│ • Enforcement Engine executes action                         │
│                                                              │
│ Step 1: Final warning                                        │
│   notify.persistent_notification:                            │
│     message: "Time is up! Xbox turning off in 5 minutes."   │
│                                                              │
│ Step 2: Wait grace period (5 minutes)                        │
│                                                              │
│ Step 3: Cut power                                            │
│   switch.turn_off:                                           │
│     entity_id: switch.bobby_xbox_plug                        │
│                                                              │
│ • Xbox powers off immediately                                │
│ • Activity Tracker ends session (120 minutes total)          │
│ • Usage logged to Allow2 API                                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 5. Next day reset (Midnight)                                 │
├─────────────────────────────────────────────────────────────┤
│ • Allow2 API resets daily quota                              │
│ • Plugin queries new quota: 120 minutes available            │
│ • Bobby can play again tomorrow                              │
└─────────────────────────────────────────────────────────────┘
```

### Database Records

**Activity Log:**
```sql
INSERT INTO activity_log (
  child_id, device_entity_id, activity_type,
  start_time, end_time, duration_ms
) VALUES (
  123, 'media_player.xbox_series_x', 'gaming',
  '2026-01-15 15:30:00', '2026-01-15 17:30:00', 7200000
);
```

**Energy Usage:**
```sql
INSERT INTO energy_usage (
  child_id, device_entity_id, date,
  kwh_consumed, cost_usd
) VALUES (
  123, 'switch.bobby_xbox_plug', '2026-01-15',
  0.3, 0.036
);
```

---

## Shared TV Usage Attribution

### Use Case: Family Living Room TV

**Scenario:**
- Samsung TV in living room used by Bobby (age 12) and Sarah (age 10)
- Bobby watches after school (3-5 PM)
- Sarah watches after dinner (7-9 PM)
- Parents want separate time tracking for each child

### Home Assistant Setup

**Entities:**
- `media_player.living_room_tv` - Samsung TV integration

**Samsung TV Integration:**
```yaml
# configuration.yaml
samsungtv:
  - host: 192.168.1.60
    name: "Living Room TV"
    port: 8002
```

### Plugin Configuration

```javascript
{
  deviceLinks: [
    {
      entityId: "media_player.living_room_tv",
      childId: null,  // Shared device
      deviceName: "Living Room TV",
      linkType: "shared",
      usageRules: [
        {
          childId: 123,  // Bobby
          weekdays: ["mon", "tue", "wed", "thu", "fri"],
          timeRange: "15:00-17:00",
          description: "Bobby's after-school time"
        },
        {
          childId: 456,  // Sarah
          weekdays: ["mon", "tue", "wed", "thu", "fri"],
          timeRange: "19:00-21:00",
          description: "Sarah's after-dinner time"
        },
        {
          childId: null,  // Parents/family time
          weekdays: ["sat", "sun"],
          timeRange: "00:00-23:59",
          description: "Weekend family time (not tracked)"
        }
      ]
    }
  ]
}
```

### Flow: Time-Based Attribution

```
Monday 3:15 PM:
┌────────────────────────────────────┐
│ TV turns on                         │
│ media_player.living_room_tv: 'on'  │
│                                     │
│ Device Linking Manager checks:     │
│ • Current time: 15:15               │
│ • Current day: Monday               │
│                                     │
│ Matches rule:                       │
│ • childId: 123 (Bobby)              │
│ • timeRange: 15:00-17:00            │
│                                     │
│ Result: Attribute to Bobby          │
└────────────────────────────────────┘

Monday 7:30 PM:
┌────────────────────────────────────┐
│ TV turns on again                   │
│                                     │
│ Device Linking Manager checks:     │
│ • Current time: 19:30               │
│ • Current day: Monday               │
│                                     │
│ Matches rule:                       │
│ • childId: 456 (Sarah)              │
│ • timeRange: 19:00-21:00            │
│                                     │
│ Result: Attribute to Sarah          │
└────────────────────────────────────┘

Saturday 2:00 PM:
┌────────────────────────────────────┐
│ TV turns on                         │
│                                     │
│ Device Linking Manager checks:     │
│ • Current day: Saturday             │
│                                     │
│ Matches rule:                       │
│ • childId: null (Family)            │
│ • Weekend exception                 │
│                                     │
│ Result: Not tracked                 │
└────────────────────────────────────┘
```

### Parent Dashboard View

```
Living Room TV Usage This Week
┌────────────────────────────────────────┐
│ Device: media_player.living_room_tv    │
│ Type: Shared                            │
├────────────────────────────────────────┤
│ Bobby (Mon-Fri 3-5 PM)                 │
│ • This Week: 8 hours                    │
│ • Daily Avg: 1.6 hours                  │
│ • Quota: 2h/day → 0.4h remaining today │
├────────────────────────────────────────┤
│ Sarah (Mon-Fri 7-9 PM)                 │
│ • This Week: 7 hours                    │
│ • Daily Avg: 1.4 hours                  │
│ • Quota: 2h/day → 0.6h remaining today │
├────────────────────────────────────────┤
│ Untracked (weekends)                   │
│ • This Week: 5 hours                    │
│ • Not counted against quotas           │
└────────────────────────────────────────┘
```

---

## Smart Plug Energy Monitoring

### Use Case: Track Gaming Energy Costs

**Scenario:**
- Parents want to track electricity cost of Bobby's gaming
- Show Bobby how much his gaming costs per month
- Incentivize energy-conscious behavior

### Home Assistant Setup

**Entities:**
- `switch.bobby_xbox_plug` - TP-Link HS110 with energy monitoring
- `sensor.bobby_xbox_plug_power` - Current power draw (watts)
- `sensor.bobby_xbox_plug_energy` - Total energy (kWh)

**TP-Link Kasa Integration:**
```yaml
# configuration.yaml
tplink:
  discovery: false
  switch:
    - host: 192.168.1.50
      name: "Bobby Xbox Plug"
```

### Plugin Configuration

```javascript
{
  energyTracking: {
    enabled: true,
    costPerKwh: 0.12,  // $0.12 per kWh
    reportingInterval: 86400000,  // Daily reports
    devices: [
      {
        entityId: "switch.bobby_xbox_plug",
        childId: 123,
        deviceName: "Bobby's Xbox",
        powerSensorId: "sensor.bobby_xbox_plug_power",
        energySensorId: "sensor.bobby_xbox_plug_energy"
      }
    ]
  }
}
```

### Energy Tracking Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Day 1: Gaming Session 1                                      │
├─────────────────────────────────────────────────────────────┤
│ 3:00 PM - Xbox turns on                                      │
│ • sensor.bobby_xbox_plug_power: 150W                         │
│ • sensor.bobby_xbox_plug_energy: 0.0 kWh (reset daily)      │
│                                                              │
│ 5:00 PM - Xbox turns off (2 hours)                           │
│ • sensor.bobby_xbox_plug_power: 0W                           │
│ • sensor.bobby_xbox_plug_energy: 0.3 kWh                     │
│                                                              │
│ Energy Tracker calculates:                                   │
│ • Energy used: 0.3 kWh                                       │
│ • Cost: 0.3 × $0.12 = $0.036                                 │
│ • Store in database                                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Day 1: Gaming Session 2                                      │
├─────────────────────────────────────────────────────────────┤
│ 7:00 PM - Xbox turns on again                                │
│ • sensor.bobby_xbox_plug_energy: 0.3 kWh (cumulative)       │
│                                                              │
│ 8:30 PM - Xbox turns off (1.5 hours)                         │
│ • sensor.bobby_xbox_plug_energy: 0.525 kWh                   │
│                                                              │
│ Energy Tracker calculates:                                   │
│ • Session energy: 0.525 - 0.3 = 0.225 kWh                   │
│ • Session cost: 0.225 × $0.12 = $0.027                       │
│ • Daily total: $0.036 + $0.027 = $0.063                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ End of Week Report (Sunday night)                            │
├─────────────────────────────────────────────────────────────┤
│ Plugin aggregates 7 days of data:                            │
│                                                              │
│ Bobby's Xbox Energy Report                                   │
│ Week of Jan 15-21, 2026                                      │
│                                                              │
│ ┌────────────────────────────────────────────┐              │
│ │ Day       Hours  Energy  Cost               │              │
│ ├────────────────────────────────────────────┤              │
│ │ Monday    3.5h   0.53kWh $0.063            │              │
│ │ Tuesday   2.0h   0.30kWh $0.036            │              │
│ │ Wednesday 4.0h   0.60kWh $0.072            │              │
│ │ Thursday  2.5h   0.38kWh $0.045            │              │
│ │ Friday    3.0h   0.45kWh $0.054            │              │
│ │ Saturday  6.0h   0.90kWh $0.108            │              │
│ │ Sunday    5.0h   0.75kWh $0.090            │              │
│ ├────────────────────────────────────────────┤              │
│ │ Total     26h    3.91kWh $0.468            │              │
│ └────────────────────────────────────────────┘              │
│                                                              │
│ Monthly projection: $2.02                                    │
│ Yearly projection: $24.34                                    │
│                                                              │
│ Report sent to:                                              │
│ • Parent email                                               │
│ • Allow2 mobile app                                          │
│ • Home Assistant dashboard                                   │
└─────────────────────────────────────────────────────────────┘
```

### Home Assistant Dashboard Card

```yaml
# dashboard.yaml
type: energy-entity-card
entity: sensor.bobby_xbox_plug_energy
name: "Bobby's Xbox Energy"
cost_entity: sensor.bobby_xbox_energy_cost
kWh_max: 10
```

### Parent Insights

**Energy Comparison Dashboard:**
```
Family Entertainment Energy Costs (This Month)
┌────────────────────────────────────────────┐
│ Device                Hours  Energy  Cost  │
├────────────────────────────────────────────┤
│ Bobby's Xbox           95h   14.2kWh $1.71 │
│ Sarah's Nintendo       45h    4.5kWh $0.54 │
│ Living Room TV        120h   18.0kWh $2.16 │
│ Bedroom TVs (both)     60h    7.2kWh $0.86 │
├────────────────────────────────────────────┤
│ Total Entertainment   320h   43.9kWh $5.27 │
└────────────────────────────────────────────┘

Insight: Bobby's Xbox uses the most energy per hour (149W avg)
Recommendation: Consider energy-saving mode when idle
```

---

## Bedtime Automation

### Use Case: Automatic Device Shutdown at Bedtime

**Scenario:**
- Bobby must be off all devices by 9 PM on school nights
- Progressive warnings before shutdown
- Physical power cut via smart plugs

### Home Assistant Setup

**Entities:**
- `switch.bobby_xbox_plug`
- `switch.bobby_tv_plug`
- `switch.bobby_tablet_charger`

### Plugin Configuration

```javascript
{
  bedtimeRules: [
    {
      childId: 123,
      enabled: true,
      schedule: {
        weekdays: ["mon", "tue", "wed", "thu", "fri"],
        bedtime: "21:00",
        wakeTime: "06:00"
      },
      warnings: [
        { minutesBefore: 30, message: "Bedtime in 30 minutes" },
        { minutesBefore: 15, message: "Bedtime in 15 minutes" },
        { minutesBefore: 5, message: "Bedtime in 5 minutes - save your progress!" }
      ],
      enforcementActions: [
        {
          type: "turn_off_switches",
          entityIds: [
            "switch.bobby_xbox_plug",
            "switch.bobby_tv_plug",
            "switch.bobby_tablet_charger"
          ]
        },
        {
          type: "notify",
          message: "All devices have been turned off for bedtime. Good night!"
        }
      ]
    }
  ]
}
```

### Bedtime Automation Flow

```
Monday Evening Timeline:
┌─────────────────────────────────────────────────────────────┐
│ 8:30 PM - Warning #1 (30 minutes before)                     │
├─────────────────────────────────────────────────────────────┤
│ Bedtime Manager checks:                                      │
│ • Current time: 20:30                                        │
│ • Bedtime: 21:00                                             │
│ • Time remaining: 30 minutes                                 │
│                                                              │
│ Actions:                                                     │
│ • HA notification to Bobby's phone                           │
│ • Xbox overlay notification (if supported)                   │
│ • Parent notification: "Bobby bedtime warning sent"          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 8:45 PM - Warning #2 (15 minutes before)                     │
├─────────────────────────────────────────────────────────────┤
│ Actions:                                                     │
│ • Critical priority notification                             │
│ • Message: "Bedtime in 15 minutes. Start wrapping up!"      │
│ • Persistent notification (stays on screen)                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 8:55 PM - Final Warning (5 minutes before)                   │
├─────────────────────────────────────────────────────────────┤
│ Actions:                                                     │
│ • Critical notification                                      │
│ • Message: "5 minutes until bedtime! Save your game now!"   │
│ • Trigger auto-save if supported by game                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 9:00 PM - Bedtime Enforcement                                │
├─────────────────────────────────────────────────────────────┤
│ Enforcement Engine executes:                                 │
│                                                              │
│ 1. Check all Bobby's devices:                                │
│    • sensor.xbox_series_x: 'on' → needs shutdown            │
│    • media_player.bobby_tv: 'on' → needs shutdown           │
│    • switch.bobby_tablet_charger: 'on' → needs shutdown     │
│                                                              │
│ 2. Send final notification:                                  │
│    notify.mobile_app_bobby_phone:                            │
│      message: "Bedtime! All devices turning off now."       │
│      title: "Good Night"                                     │
│                                                              │
│ 3. Turn off smart plugs:                                     │
│    switch.turn_off:                                          │
│      entity_id:                                              │
│        - switch.bobby_xbox_plug                              │
│        - switch.bobby_tv_plug                                │
│        - switch.bobby_tablet_charger                         │
│                                                              │
│ 4. Block device re-activation until wake time:               │
│    • Store "bedtime_active" state                            │
│    • Prevent smart plug turn-on until 6:00 AM                │
│                                                              │
│ 5. Log event:                                                │
│    • Activity Tracker ends all active sessions               │
│    • Store bedtime enforcement record                        │
│    • Parent notification: "Bobby's devices off for bedtime" │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 9:15 PM - Bobby tries to turn Xbox back on                   │
├─────────────────────────────────────────────────────────────┤
│ Home Assistant automation detects attempt:                   │
│                                                              │
│ trigger:                                                     │
│   platform: state                                            │
│   entity_id: switch.bobby_xbox_plug                          │
│   to: 'on'                                                   │
│ condition:                                                   │
│   - condition: state                                         │
│     entity_id: input_boolean.bobby_bedtime_active            │
│     state: 'on'                                              │
│ action:                                                      │
│   # Immediately turn off again                               │
│   - service: switch.turn_off                                 │
│     entity_id: switch.bobby_xbox_plug                        │
│   # Notify Bobby                                             │
│   - service: notify.mobile_app_bobby_phone                   │
│     data:                                                    │
│       message: "Nice try! Devices are off until 6 AM."      │
│   # Alert parent                                             │
│   - service: notify.mobile_app_parent_phone                  │
│     data:                                                    │
│       message: "Bobby attempted to bypass bedtime controls." │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 6:00 AM Tuesday - Wake Time                                  │
├─────────────────────────────────────────────────────────────┤
│ Bedtime Manager:                                             │
│ • Clear "bedtime_active" state                               │
│ • Re-enable smart plug control                               │
│ • Bobby can turn on devices again                            │
│                                                              │
│ Optional: Good morning notification                          │
│ notify.mobile_app_bobby_phone:                               │
│   message: "Good morning! You have 2 hours of Xbox time     │
│             available today."                                │
└─────────────────────────────────────────────────────────────┘
```

### Home Assistant Automation (Bedtime Block)

```yaml
# automations.yaml
automation:
  - id: bobby_bedtime_block_reactivation
    alias: "Bobby - Block Bedtime Device Reactivation"
    description: "Prevent Bobby from turning devices back on after bedtime"
    trigger:
      - platform: state
        entity_id:
          - switch.bobby_xbox_plug
          - switch.bobby_tv_plug
          - switch.bobby_tablet_charger
        to: 'on'
    condition:
      - condition: state
        entity_id: input_boolean.bobby_bedtime_active
        state: 'on'
    action:
      # Turn off immediately
      - service: switch.turn_off
        target:
          entity_id: "{{ trigger.entity_id }}"

      # Notify Bobby
      - service: notify.mobile_app_bobby_phone
        data:
          message: "Devices are locked until 6:00 AM for bedtime."
          title: "Bedtime Active"

      # Alert parent
      - service: notify.mobile_app_parent_phone
        data:
          message: "Bobby attempted to turn on {{ trigger.to_state.attributes.friendly_name }} during bedtime."
          title: "Bedtime Bypass Attempt"
```

---

## Weekend vs Weekday Quotas

### Use Case: Different Limits for School Days and Weekends

**Scenario:**
- Weekdays (Mon-Fri): 2 hours gaming + 1 hour video
- Weekends (Sat-Sun): 4 hours gaming + 2 hours video
- Separate tracking for gaming vs streaming

### Plugin Configuration

```javascript
{
  quotaRules: [
    {
      childId: 123,
      activityType: "gaming",
      weekdayQuota: 120,  // minutes
      weekendQuota: 240
    },
    {
      childId: 123,
      activityType: "video",
      weekdayQuota: 60,
      weekendQuota: 120
    }
  ]
}
```

### Activity Type Detection

```javascript
// PlayStation 5 example
{
  entity_id: "media_player.playstation_5",
  state: "playing",
  attributes: {
    media_content_type: "game",
    media_title: "Spider-Man 2",
    source: "PlayStation",
    media_artist: null
  }
}
// → Classified as "gaming"

{
  entity_id: "media_player.playstation_5",
  state: "playing",
  attributes: {
    media_content_type: "video",
    media_title: "The Avengers",
    source: "Netflix",
    media_artist: null
  }
}
// → Classified as "video"
```

### Weekly Usage Report

```
Bobby's Usage Report - Week of Jan 15-21, 2026
┌──────────────────────────────────────────────────────────┐
│ Weekdays (Mon-Fri)                                        │
├──────────────────────────────────────────────────────────┤
│ Gaming:                                                   │
│ • Quota: 2 hours/day × 5 days = 10 hours total           │
│ • Used: 9.5 hours                                         │
│ • Remaining: 0.5 hours                                    │
│ • Daily breakdown:                                        │
│   Mon: 2.0h  Tue: 1.8h  Wed: 2.0h  Thu: 1.7h  Fri: 2.0h │
│                                                           │
│ Video:                                                    │
│ • Quota: 1 hour/day × 5 days = 5 hours total             │
│ • Used: 4.2 hours                                         │
│ • Remaining: 0.8 hours                                    │
│ • Daily breakdown:                                        │
│   Mon: 1.0h  Tue: 0.5h  Wed: 1.0h  Thu: 0.7h  Fri: 1.0h │
├──────────────────────────────────────────────────────────┤
│ Weekend (Sat-Sun)                                         │
├──────────────────────────────────────────────────────────┤
│ Gaming:                                                   │
│ • Quota: 4 hours/day × 2 days = 8 hours total            │
│ • Used: 7.5 hours                                         │
│ • Remaining: 0.5 hours                                    │
│ • Daily breakdown:                                        │
│   Sat: 4.0h  Sun: 3.5h                                   │
│                                                           │
│ Video:                                                    │
│ • Quota: 2 hours/day × 2 days = 4 hours total            │
│ • Used: 3.0 hours                                         │
│ • Remaining: 1.0 hour                                     │
│ • Daily breakdown:                                        │
│   Sat: 1.5h  Sun: 1.5h                                   │
└──────────────────────────────────────────────────────────┘
```

---

## Multi-Device Per Child

### Use Case: Bobby Has Multiple Gaming Devices

**Scenario:**
- Bobby has Xbox Series X (bedroom), PlayStation 5 (living room), Nintendo Switch (portable)
- Total gaming quota applies across all devices (not per-device)
- Track which device used when

### Plugin Configuration

```javascript
{
  deviceLinks: [
    {
      entityId: "media_player.xbox_series_x",
      childId: 123,
      deviceName: "Bobby's Xbox",
      location: "Bedroom",
      quotaPool: "gaming"  // Share quota with other gaming devices
    },
    {
      entityId: "media_player.playstation_5",
      childId: 123,
      deviceName: "Bobby's PlayStation",
      location: "Living Room",
      quotaPool: "gaming"
    },
    {
      entityId: "switch.bobby_switch_dock_plug",
      childId: 123,
      deviceName: "Bobby's Nintendo Switch",
      location: "Portable",
      quotaPool: "gaming"
    }
  ]
}
```

### Unified Quota Tracking

```
Bobby's Gaming Quota Today (Shared Pool)
┌────────────────────────────────────────┐
│ Total Daily Quota: 2 hours (120 min)   │
│ Used: 95 minutes                        │
│ Remaining: 25 minutes                   │
├────────────────────────────────────────┤
│ Device Breakdown:                       │
│ • Xbox Series X:       45 min (47%)    │
│ • PlayStation 5:       30 min (32%)    │
│ • Nintendo Switch:     20 min (21%)    │
├────────────────────────────────────────┤
│ All devices will shut down when        │
│ total quota reaches 0 minutes.         │
└────────────────────────────────────────┘
```

### Multi-Device Enforcement

```
Scenario: Bobby uses 115 minutes of Xbox, then switches to PlayStation
┌─────────────────────────────────────────────────────────────┐
│ 1. Xbox Session (3:00 PM - 4:55 PM)                          │
├─────────────────────────────────────────────────────────────┤
│ • Bobby plays Xbox for 115 minutes                           │
│ • Quota remaining: 5 minutes                                 │
│ • Warning sent: "5 minutes remaining across all devices"    │
│ • Xbox powers off at 4:55 PM                                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 2. Bobby tries PlayStation (5:00 PM)                         │
├─────────────────────────────────────────────────────────────┤
│ • PlayStation turns on                                       │
│ • Plugin detects state change                                │
│ • Quota check: 5 minutes remaining (shared pool)             │
│ • Allow PlayStation to start                                 │
│ • Immediate notification: "Only 5 minutes left today!"       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 3. PlayStation Session (5:00 PM - 5:05 PM)                   │
├─────────────────────────────────────────────────────────────┤
│ • Bobby plays PlayStation for 5 minutes                      │
│ • Quota exhausted: 0 minutes remaining                       │
│ • Enforcement: Turn off PlayStation                          │
│ • Block all gaming devices for rest of day                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 4. Bobby tries Nintendo Switch (6:00 PM)                     │
├─────────────────────────────────────────────────────────────┤
│ • Switch dock smart plug turns on                            │
│ • Plugin checks quota: 0 minutes remaining                   │
│ • Immediate enforcement:                                     │
│   - Turn off switch.bobby_switch_dock_plug                   │
│   - Notification: "Gaming quota used up for today"           │
│ • Parent alert: "Bobby attempted to use Switch after quota" │
└─────────────────────────────────────────────────────────────┘
```

---

## Remote Parental Override

### Use Case: Parent Remotely Controls Device

**Scenario:**
- Parent at work sees Bobby on Xbox during school hours
- Parent remotely turns off Xbox and sends message

### Home Assistant Mobile App

**Parent Views Dashboard:**
```
Bobby's Devices - Live Status
┌────────────────────────────────────┐
│ Xbox Series X                       │
│ Status: ● ON (since 2:15 PM)        │
│ Current Activity: Fortnite          │
│ Time Today: 0h 45m / 2h 00m        │
│ Location: Bedroom                   │
│                                     │
│ [Turn Off Now] [Send Message]       │
└────────────────────────────────────┘
```

### Remote Action Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Parent opens Home Assistant app (3:00 PM)                 │
├─────────────────────────────────────────────────────────────┤
│ • Sees "Bobby's Xbox: ON"                                    │
│ • Notices: "Should be at school!"                            │
│ • Taps "Turn Off Now"                                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 2. Parent Confirms Action                                    │
├─────────────────────────────────────────────────────────────┤
│ Confirmation Dialog:                                         │
│                                                              │
│ "Turn off Bobby's Xbox remotely?"                            │
│                                                              │
│ [ ] Send notification to Bobby                               │
│ [ ] Block device for rest of day                             │
│                                                              │
│ Message to Bobby: (optional)                                 │
│ ┌──────────────────────────────────────┐                    │
│ │ "You should be at school, not gaming.│                    │
│ │ We'll talk about this tonight."      │                    │
│ └──────────────────────────────────────┘                    │
│                                                              │
│ [Cancel] [Turn Off]                                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 3. Action Executed                                           │
├─────────────────────────────────────────────────────────────┤
│ HA Service Calls:                                            │
│                                                              │
│ 1. Send notification to Bobby:                               │
│    notify.mobile_app_bobby_phone:                            │
│      message: "Parent has turned off your Xbox remotely.    │
│                You should be at school, not gaming.          │
│                We'll talk about this tonight."               │
│      data:                                                   │
│        tag: 'parental_override'                              │
│        priority: 'high'                                      │
│                                                              │
│ 2. Turn off Xbox:                                            │
│    switch.turn_off:                                          │
│      entity_id: switch.bobby_xbox_plug                       │
│                                                              │
│ 3. Block device for rest of day:                             │
│    input_boolean.turn_on:                                    │
│      entity_id: input_boolean.bobby_xbox_blocked             │
│                                                              │
│ 4. Log override event:                                       │
│    • Store in database                                       │
│    • Reason: "parental_override_school_hours"                │
│    • Timestamp: 2026-01-15 15:00:00                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 4. Bobby Receives Notification (3:00 PM)                     │
├─────────────────────────────────────────────────────────────┤
│ Phone Notification:                                          │
│ ┌──────────────────────────────────────┐                    │
│ │ 🎮 Parental Controls                  │                    │
│ │                                       │                    │
│ │ Parent has turned off your Xbox       │                    │
│ │ remotely. You should be at school,    │                    │
│ │ not gaming. We'll talk about this     │                    │
│ │ tonight.                              │                    │
│ │                                       │                    │
│ │ Your Xbox is blocked for the rest     │                    │
│ │ of today.                             │                    │
│ └──────────────────────────────────────┘                    │
│                                                              │
│ • Xbox turns off immediately                                 │
│ • Bobby cannot turn it back on                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 5. Bobby Tries to Turn Xbox Back On (3:15 PM)                │
├─────────────────────────────────────────────────────────────┤
│ • Bobby presses Xbox power button                            │
│ • Smart plug detects turn-on attempt                         │
│ • Automation checks: input_boolean.bobby_xbox_blocked = ON   │
│ • Immediately turns plug back off                            │
│ • Notification: "Device blocked by parent until tomorrow"   │
│ • Parent receives alert: "Bobby attempted bypass"            │
└─────────────────────────────────────────────────────────────┘
```

---

## Activity Type Differentiation

### Use Case: Gaming vs Streaming on Same Device

**Scenario:**
- Bobby's PlayStation 5 used for both gaming and Netflix
- Different quotas: 2h gaming, 1h video per day
- Automatically classify activity type

### Home Assistant State Examples

**Gaming State:**
```json
{
  "entity_id": "media_player.playstation_5",
  "state": "playing",
  "attributes": {
    "friendly_name": "PlayStation 5",
    "media_content_type": "game",
    "media_title": "God of War Ragnarök",
    "source": "PlayStation",
    "media_duration": null,
    "media_position": null
  }
}
```

**Streaming State:**
```json
{
  "entity_id": "media_player.playstation_5",
  "state": "playing",
  "attributes": {
    "friendly_name": "PlayStation 5",
    "media_content_type": "video",
    "media_title": "Stranger Things S4E1",
    "source": "Netflix",
    "media_duration": 3600,
    "media_position": 1234
  }
}
```

### Activity Classification Logic

```javascript
function classifyActivity(entityState) {
  const { media_content_type, source, media_title } = entityState.attributes;

  // Check content type
  if (media_content_type === 'game') {
    return {
      type: 'gaming',
      quotaPool: 'gaming',
      activityName: media_title || 'Gaming'
    };
  }

  if (media_content_type === 'video') {
    return {
      type: 'video',
      quotaPool: 'video',
      activityName: `${source}: ${media_title}`
    };
  }

  // Fallback: check source
  if (source && ['Netflix', 'Hulu', 'Disney+', 'YouTube'].includes(source)) {
    return {
      type: 'video',
      quotaPool: 'video',
      activityName: `${source} streaming`
    };
  }

  // Default to gaming for PlayStation
  return {
    type: 'gaming',
    quotaPool: 'gaming',
    activityName: 'Gaming'
  };
}
```

### Dual Quota Tracking

```
Bobby's PlayStation 5 Usage Today
┌────────────────────────────────────────┐
│ Gaming Quota                            │
│ • Allowed: 2 hours                      │
│ • Used: 95 minutes                      │
│ • Remaining: 25 minutes                 │
│                                         │
│ Activities:                             │
│ • 3:00-4:30 PM: God of War (90 min)    │
│ • 7:00-7:05 PM: Spider-Man (5 min)     │
├────────────────────────────────────────┤
│ Video Quota                             │
│ • Allowed: 1 hour                       │
│ • Used: 45 minutes                      │
│ • Remaining: 15 minutes                 │
│                                         │
│ Activities:                             │
│ • 6:00-6:30 PM: Netflix (30 min)       │
│ • 8:00-8:15 PM: YouTube (15 min)       │
└────────────────────────────────────────┘
```

---

## Power Vampire Detection

### Use Case: Detect Standby Power Waste

**Scenario:**
- Smart plugs measure standby power draw
- Identify devices left in standby mode
- Educate child about energy waste

### Energy Monitoring

```
Smart Plug Power States:
┌────────────────────────────────────────┐
│ Active Gaming: 150W                     │
│ Menu/Idle: 85W                          │
│ Standby: 15W                            │
│ Off (plug still on): 2W                 │
│ Off (plug off): 0W                      │
└────────────────────────────────────────┘

Plugin Logic:
if power < 5W:
  state = 'off'
elif power < 30W:
  state = 'standby'  # Vampire power
elif power < 100W:
  state = 'idle'
else:
  state = 'active'
```

### Vampire Power Report

```
Bobby's Xbox Energy Waste Report
┌────────────────────────────────────────┐
│ This Week:                              │
│                                         │
│ Total Hours Plugged In: 168h           │
│ • Active Gaming: 26h (15%)             │
│ • Idle in Menu: 12h (7%)               │
│ • Standby Mode: 105h (62%) ⚠️          │
│ • Fully Off: 25h (15%)                 │
│                                         │
│ Standby Power Waste:                    │
│ • 105 hours × 15W = 1.58 kWh           │
│ • Cost: $0.19 wasted this week         │
│ • Annual projection: $9.60 wasted      │
│                                         │
│ Recommendation:                         │
│ Turn off smart plug when not in use    │
│ to save energy and money!               │
└────────────────────────────────────────┘
```

### Auto-Shutdown Idle Devices

```yaml
# Home Assistant automation
automation:
  - id: auto_shutdown_idle_xbox
    alias: "Auto Shutdown Idle Xbox"
    trigger:
      # Xbox in standby for 30 minutes
      - platform: numeric_state
        entity_id: sensor.bobby_xbox_plug_power
        below: 30
        for:
          minutes: 30
    action:
      # Turn off smart plug
      - service: switch.turn_off
        entity_id: switch.bobby_xbox_plug
      # Notify Bobby
      - service: notify.mobile_app_bobby_phone
        data:
          message: "Xbox was left in standby mode and has been fully powered off to save energy."
```

---

## Multi-Child Multi-Room Setup

### Use Case: Multiple Children, Multiple Devices, Separate Tracking

**Scenario:**
- Bobby (age 12): Xbox in bedroom, PlayStation in living room
- Sarah (age 10): Nintendo Switch in playroom, tablet in bedroom
- Separate quotas and bedtimes for each child

### Complete Configuration

```javascript
{
  children: [
    {
      id: 123,
      name: "Bobby",
      age: 12,
      quotas: {
        gaming: { weekday: 120, weekend: 240 },
        video: { weekday: 60, weekend: 120 }
      },
      bedtime: {
        weekday: "21:00",
        weekend: "22:00"
      }
    },
    {
      id: 456,
      name: "Sarah",
      age: 10,
      quotas: {
        gaming: { weekday: 90, weekend: 180 },
        video: { weekday: 60, weekend: 90 }
      },
      bedtime: {
        weekday: "20:30",
        weekend: "21:30"
      }
    }
  ],

  deviceLinks: [
    // Bobby's devices
    {
      entityId: "media_player.xbox_series_x",
      childId: 123,
      deviceName: "Bobby's Xbox",
      location: "Bobby's Bedroom",
      quotaPool: "gaming"
    },
    {
      entityId: "media_player.playstation_5",
      childId: 123,
      deviceName: "Bobby's PlayStation",
      location: "Living Room",
      quotaPool: "gaming"
    },

    // Sarah's devices
    {
      entityId: "switch.sarah_switch_dock_plug",
      childId: 456,
      deviceName: "Sarah's Switch",
      location: "Playroom",
      quotaPool: "gaming"
    },
    {
      entityId: "switch.sarah_tablet_plug",
      childId: 456,
      deviceName: "Sarah's Tablet",
      location: "Sarah's Bedroom",
      quotaPool: "video"
    }
  ],

  powerControls: [
    {
      entityId: "switch.bobby_xbox_plug",
      linkedDevice: "media_player.xbox_series_x",
      childId: 123
    },
    {
      entityId: "switch.bobby_ps5_plug",
      linkedDevice: "media_player.playstation_5",
      childId: 123
    },
    {
      entityId: "switch.sarah_switch_dock_plug",
      linkedDevice: null,
      childId: 456
    },
    {
      entityId: "switch.sarah_tablet_plug",
      linkedDevice: null,
      childId: 456
    }
  ]
}
```

### Parent Dashboard - All Children View

```
Family Entertainment Dashboard
┌────────────────────────────────────────────────────────────┐
│ Bobby (Age 12)                                              │
├────────────────────────────────────────────────────────────┤
│ Gaming:  [████████████░░░░] 95/120 min (79%)               │
│ Video:   [██████░░░░░░░░░░] 30/60 min (50%)                │
│                                                             │
│ Active Devices:                                             │
│ • Xbox Series X: ON (Bedroom) - 45 min                     │
│ • PlayStation 5: OFF (Living Room)                          │
│                                                             │
│ Bedtime: 21:00 (in 2h 15m)                                  │
├────────────────────────────────────────────────────────────┤
│ Sarah (Age 10)                                              │
├────────────────────────────────────────────────────────────┤
│ Gaming:  [██████████░░░░░░] 60/90 min (67%)                │
│ Video:   [████████░░░░░░░░] 40/60 min (67%)                │
│                                                             │
│ Active Devices:                                             │
│ • Nintendo Switch: ON (Playroom) - 35 min                  │
│ • Tablet: OFF (Bedroom)                                     │
│                                                             │
│ Bedtime: 20:30 (in 1h 45m)                                  │
├────────────────────────────────────────────────────────────┤
│ Energy Today:                                               │
│ • Bobby's devices: 0.7 kWh ($0.08)                          │
│ • Sarah's devices: 0.3 kWh ($0.04)                          │
│ • Total: 1.0 kWh ($0.12)                                    │
└────────────────────────────────────────────────────────────┘
```

---

## Summary

These use cases demonstrate the flexibility and power of the Home Assistant plugin:

1. **Real-time tracking** via WebSocket state changes
2. **Flexible device linking** (exclusive, shared, family)
3. **Activity classification** (gaming vs streaming)
4. **Unified quota management** across multiple devices
5. **Energy monitoring** and cost tracking
6. **Automated enforcement** via smart plugs
7. **Parent dashboards** for monitoring all children
8. **Remote control** capabilities via Home Assistant mobile app

All use cases are **implementation-ready** with:
- Specific Home Assistant configurations
- Plugin configuration examples
- API call sequences
- Database schemas
- UI mockups
- Parent and child notification flows

---

**Next**: See DEVICE_LINKING.md for detailed linking system architecture
**Next**: See INTEGRATIONS.md for specific integration examples (Xbox, PS5, TVs, etc.)
