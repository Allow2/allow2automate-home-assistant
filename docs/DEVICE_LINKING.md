# Allow2Automate Home Assistant Plugin - Device Linking System

**Version:** 1.0.0
**Last Updated:** 2026-01-15

---

## Table of Contents

1. [Overview](#overview)
2. [Link Types](#link-types)
3. [Database Schema](#database-schema)
4. [Linking Workflow](#linking-workflow)
5. [Usage Attribution Logic](#usage-attribution-logic)
6. [UI Mockups](#ui-mockups)
7. [API Design](#api-design)
8. [Smart Linking Suggestions](#smart-linking-suggestions)

---

## Overview

The device linking system creates **bi-directional relationships** between:
- **Children** (from Allow2 API)
- **Home Assistant Entities** (devices)

This enables accurate time tracking and quota enforcement per child per device.

### Key Features

1. **One-to-Many**: One child can have multiple linked devices
2. **Many-to-One**: One device can be shared by multiple children (with rules)
3. **Automatic Attribution**: Intelligently determine which child is using a shared device
4. **Manual Override**: Parents can manually assign usage when needed
5. **Link Suggestions**: AI-powered recommendations based on device names

---

## Link Types

### 1. Exclusive Link

**Definition**: Device is owned and used exclusively by one child

**Example**:
```javascript
{
  entityId: "media_player.xbox_series_x",
  childId: 123,  // Bobby
  linkType: "exclusive",
  deviceName: "Bobby's Xbox",
  location: "Bobby's Bedroom"
}
```

**Usage Attribution**:
- All activity on this device is attributed to childId=123
- No ambiguity, simple tracking

**Use Case**:
- Bobby's Xbox in his bedroom
- Sarah's Nintendo Switch in her room
- Personal tablets/computers

---

### 2. Shared Link

**Definition**: Device is shared by multiple children with time-based rules

**Example**:
```javascript
{
  entityId: "media_player.living_room_tv",
  childId: null,  // No single owner
  linkType: "shared",
  deviceName: "Family TV",
  location: "Living Room",
  usageRules: [
    {
      childId: 123,  // Bobby
      weekdays: ["mon", "tue", "wed", "thu", "fri"],
      timeRange: "15:00-17:00",
      priority: 1
    },
    {
      childId: 456,  // Sarah
      weekdays: ["mon", "tue", "wed", "thu", "fri"],
      timeRange: "17:00-19:00",
      priority: 2
    },
    {
      childId: 123,  // Bobby
      weekdays: ["sat", "sun"],
      timeRange: "10:00-12:00",
      priority: 1
    },
    {
      childId: 456,  // Sarah
      weekdays: ["sat", "sun"],
      timeRange: "14:00-16:00",
      priority: 2
    }
  ]
}
```

**Usage Attribution**:
- Check current day and time against rules
- Match to highest priority rule
- Fallback to manual attribution if no rule matches

**Use Case**:
- Shared family TV
- Living room gaming console
- Kitchen tablet

---

### 3. Family Link

**Definition**: Device is for family use and not tracked

**Example**:
```javascript
{
  entityId: "media_player.family_projector",
  childId: null,
  linkType: "family",
  deviceName: "Movie Night Projector",
  location: "Family Room"
}
```

**Usage Attribution**:
- Not tracked
- No quota enforcement
- Used for family activities

**Use Case**:
- Family movie nights
- Parent-controlled devices
- Educational family apps

---

### 4. Smart Plug Control Link

**Definition**: Smart plug that controls power to a linked device

**Example**:
```javascript
{
  entityId: "switch.bobby_xbox_plug",
  linkType: "power_control",
  linkedDevice: "media_player.xbox_series_x",
  childId: 123,
  enforceQuota: true,
  gracePeriod: 300  // seconds
}
```

**Relationship**:
```
media_player.xbox_series_x (tracked device)
       ↓ linked via
switch.bobby_xbox_plug (power control)
```

**Enforcement**:
- When quota exhausted, turn off smart plug
- Cut power to the device
- Prevent reactivation until quota resets

---

## Database Schema

### Table: device_links

```sql
CREATE TABLE device_links (
  id SERIAL PRIMARY KEY,
  entity_id VARCHAR(255) NOT NULL UNIQUE,
  child_id INTEGER,
  link_type VARCHAR(50) NOT NULL,  -- 'exclusive', 'shared', 'family', 'power_control'
  device_name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  linked_device_id VARCHAR(255),  -- For power_control type
  enforce_quota BOOLEAN DEFAULT true,
  grace_period INTEGER DEFAULT 60,  -- seconds
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB,

  FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
  CHECK (link_type IN ('exclusive', 'shared', 'family', 'power_control'))
);

CREATE INDEX idx_device_links_child ON device_links(child_id);
CREATE INDEX idx_device_links_entity ON device_links(entity_id);
CREATE INDEX idx_device_links_type ON device_links(link_type);
```

### Table: device_usage_rules

```sql
CREATE TABLE device_usage_rules (
  id SERIAL PRIMARY KEY,
  device_link_id INTEGER NOT NULL,
  child_id INTEGER NOT NULL,
  weekdays TEXT[],  -- ['mon', 'tue', 'wed']
  time_range VARCHAR(20),  -- '15:00-17:00'
  priority INTEGER DEFAULT 1,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (device_link_id) REFERENCES device_links(id) ON DELETE CASCADE,
  FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
);

CREATE INDEX idx_usage_rules_device ON device_usage_rules(device_link_id);
CREATE INDEX idx_usage_rules_child ON device_usage_rules(child_id);
```

### Table: device_activity_log

```sql
CREATE TABLE device_activity_log (
  id SERIAL PRIMARY KEY,
  device_link_id INTEGER NOT NULL,
  child_id INTEGER,
  activity_type VARCHAR(50),  -- 'gaming', 'video', 'audio', 'screen_time'
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  duration_ms BIGINT,
  state_data JSONB,  -- Store HA entity state
  attributed_manually BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (device_link_id) REFERENCES device_links(id) ON DELETE CASCADE,
  FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE SET NULL
);

CREATE INDEX idx_activity_log_child ON device_activity_log(child_id);
CREATE INDEX idx_activity_log_device ON device_activity_log(device_link_id);
CREATE INDEX idx_activity_log_time ON device_activity_log(start_time, end_time);
```

### Table: device_energy_usage

```sql
CREATE TABLE device_energy_usage (
  id SERIAL PRIMARY KEY,
  device_link_id INTEGER NOT NULL,
  child_id INTEGER,
  date DATE NOT NULL,
  kwh_consumed DECIMAL(10, 4),
  cost_usd DECIMAL(10, 4),
  hours_active DECIMAL(10, 2),
  hours_standby DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (device_link_id) REFERENCES device_links(id) ON DELETE CASCADE,
  FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE SET NULL,
  UNIQUE(device_link_id, date)
);

CREATE INDEX idx_energy_usage_child ON device_energy_usage(child_id, date);
CREATE INDEX idx_energy_usage_date ON device_energy_usage(date);
```

---

## Linking Workflow

### Step 1: Device Discovery

```
┌────────────────────────────────────────────────────────────┐
│ 1. User initiates device scan                              │
├────────────────────────────────────────────────────────────┤
│ Plugin calls DeviceDiscoveryService.scan()                 │
│                                                             │
│ • Connect to Home Assistant                                 │
│ • Fetch all entities: GET /api/states                       │
│ • Filter entertainment devices:                             │
│   - media_player.*                                          │
│   - sensor.*_power                                          │
│   - switch.* (with energy monitoring)                       │
│                                                             │
│ • Classify each entity:                                     │
│   - Gaming console (Xbox, PlayStation, Switch)              │
│   - Smart TV                                                │
│   - Media player (Roku, Chromecast, Apple TV)               │
│   - Smart plug (with power monitoring)                      │
│                                                             │
│ Returns: Array<DiscoveredDevice>                            │
└────────────────────────────────────────────────────────────┘
```

**Example Output**:
```javascript
[
  {
    entityId: "media_player.xbox_series_x",
    type: "gaming_console",
    platform: "xbox",
    name: "Xbox Series X",
    location: "Unknown",
    capabilities: ["power", "media_player", "activity"],
    suggestedChild: null
  },
  {
    entityId: "switch.tp_link_plug_01",
    type: "smart_plug",
    platform: "tplink",
    name: "TP-Link Smart Plug 01",
    location: "Unknown",
    capabilities: ["power", "energy_monitoring"],
    suggestedChild: null
  }
]
```

---

### Step 2: Link Suggestion

```
┌────────────────────────────────────────────────────────────┐
│ 2. Plugin generates link suggestions                        │
├────────────────────────────────────────────────────────────┤
│ For each discovered device:                                 │
│                                                             │
│ • Check device name for child name patterns:                │
│   "Bobby's Xbox" → Suggest link to Bobby                   │
│   "Sarah's Room TV" → Suggest link to Sarah                │
│                                                             │
│ • Check location for room patterns:                         │
│   "Bobby's Bedroom" → Suggest link to Bobby                │
│                                                             │
│ • Check historical usage patterns (if available):           │
│   Device used primarily 3-5 PM → Bobby's after-school time │
│                                                             │
│ Returns: Array<LinkSuggestion>                              │
└────────────────────────────────────────────────────────────┘
```

**Example Output**:
```javascript
[
  {
    deviceEntityId: "media_player.xbox_series_x",
    deviceName: "Xbox Series X",
    suggestedChild: {
      id: 123,
      name: "Bobby",
      confidence: 0.85,
      reason: "Device name pattern matching"
    },
    suggestedLinkType: "exclusive",
    suggestedLocation: "Bobby's Bedroom"
  }
]
```

---

### Step 3: Parent Review & Linking

```
┌────────────────────────────────────────────────────────────┐
│ 3. Parent reviews suggestions in UI                         │
├────────────────────────────────────────────────────────────┤
│ Parent sees:                                                │
│                                                             │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ Discovered Devices (3)                                │   │
│ ├──────────────────────────────────────────────────────┤   │
│ │ ✅ Xbox Series X                                      │   │
│ │    Suggested: Link to Bobby (85% confident)          │   │
│ │    Location: Bobby's Bedroom                          │   │
│ │                                                       │   │
│ │    [Accept] [Edit] [Skip]                             │   │
│ ├──────────────────────────────────────────────────────┤   │
│ │ ⚠️  Samsung TV (Living Room)                          │   │
│ │    Suggested: Shared device (Bobby & Sarah)          │   │
│ │    Usage rules needed                                 │   │
│ │                                                       │   │
│ │    [Configure Sharing] [Skip]                         │   │
│ ├──────────────────────────────────────────────────────┤   │
│ │ 🔌 TP-Link Smart Plug 01                             │   │
│ │    Suggested: Power control for Xbox Series X        │   │
│ │                                                       │   │
│ │    [Link to Xbox] [Skip]                              │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                             │
│ Parent can:                                                 │
│ • Accept suggestions                                        │
│ • Edit link details                                         │
│ • Configure sharing rules                                   │
│ • Skip devices (don't track)                                │
└────────────────────────────────────────────────────────────┘
```

---

### Step 4: Create Links

```
┌────────────────────────────────────────────────────────────┐
│ 4. Plugin creates device links                              │
├────────────────────────────────────────────────────────────┤
│ For each accepted link:                                     │
│                                                             │
│ INSERT INTO device_links (                                  │
│   entity_id, child_id, link_type,                          │
│   device_name, location, created_at                         │
│ ) VALUES (                                                  │
│   'media_player.xbox_series_x', 123, 'exclusive',          │
│   'Bobby''s Xbox', 'Bobby''s Bedroom', NOW()               │
│ );                                                          │
│                                                             │
│ For shared devices, also create usage rules:                │
│                                                             │
│ INSERT INTO device_usage_rules (                            │
│   device_link_id, child_id, weekdays,                      │
│   time_range, priority                                      │
│ ) VALUES (                                                  │
│   42, 123, ARRAY['mon','tue','wed','thu','fri'],          │
│   '15:00-17:00', 1                                          │
│ );                                                          │
│                                                             │
│ Store configuration:                                        │
│ configurationUpdate({ deviceLinks: [...] })                 │
└────────────────────────────────────────────────────────────┘
```

---

## Usage Attribution Logic

### Algorithm: Determine Active Child

```javascript
/**
 * Determine which child is using a device
 * @param {string} entityId - Home Assistant entity ID
 * @param {Date} currentTime - Current timestamp
 * @returns {number|null} - Child ID or null
 */
function resolveActiveChild(entityId, currentTime) {
  // 1. Get device link
  const link = getDeviceLink(entityId);
  if (!link) return null;

  // 2. Exclusive device - simple case
  if (link.linkType === 'exclusive') {
    return link.childId;
  }

  // 3. Family device - not tracked
  if (link.linkType === 'family') {
    return null;
  }

  // 4. Shared device - use time-based rules
  if (link.linkType === 'shared') {
    const rules = getUsageRules(link.id);

    // Current day of week
    const dayName = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][currentTime.getDay()];

    // Current time (HH:MM format)
    const timeString = currentTime.toTimeString().substring(0, 5);

    // Find matching rules
    const matchingRules = rules.filter(rule => {
      // Check weekday
      if (rule.weekdays && !rule.weekdays.includes(dayName)) {
        return false;
      }

      // Check time range
      if (rule.timeRange) {
        const [start, end] = rule.timeRange.split('-');
        if (timeString < start || timeString > end) {
          return false;
        }
      }

      return true;
    });

    // Sort by priority (lower number = higher priority)
    matchingRules.sort((a, b) => a.priority - b.priority);

    // Return highest priority match
    if (matchingRules.length > 0) {
      return matchingRules[0].childId;
    }

    // No matching rule - attribution failed
    return null;
  }

  return null;
}
```

### Example: Shared TV Attribution

```
Scenario: Living room TV turns on at 4:30 PM on Monday

Step 1: Get device link
┌────────────────────────────────────┐
│ entityId: media_player.living_tv    │
│ linkType: shared                    │
│ usageRules: [...]                   │
└────────────────────────────────────┘

Step 2: Get usage rules
┌─────────────────────────────────────────────┐
│ Rule 1:                                      │
│ • childId: 123 (Bobby)                       │
│ • weekdays: [mon, tue, wed, thu, fri]        │
│ • timeRange: 15:00-17:00                     │
│ • priority: 1                                │
├─────────────────────────────────────────────┤
│ Rule 2:                                      │
│ • childId: 456 (Sarah)                       │
│ • weekdays: [mon, tue, wed, thu, fri]        │
│ • timeRange: 17:00-19:00                     │
│ • priority: 2                                │
└─────────────────────────────────────────────┘

Step 3: Check current time
┌────────────────────────────────────┐
│ Current day: Monday                 │
│ Current time: 16:30                 │
└────────────────────────────────────┘

Step 4: Match rules
┌────────────────────────────────────┐
│ Rule 1 matches:                     │
│ • Monday ✓                          │
│ • 16:30 is between 15:00-17:00 ✓   │
│                                     │
│ Rule 2 does NOT match:              │
│ • Monday ✓                          │
│ • 16:30 is NOT between 17:00-19:00 ✗│
└────────────────────────────────────┘

Step 5: Return result
┌────────────────────────────────────┐
│ Active child: Bobby (ID 123)       │
│ Reason: Rule 1 matched              │
└────────────────────────────────────┘
```

---

## UI Mockups

### Device Linking Dashboard

```
┌────────────────────────────────────────────────────────────┐
│ Device Linking                                    [+ Add]  │
├────────────────────────────────────────────────────────────┤
│                                                             │
│ Bobby (Age 12)                                              │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ ⚙️ Xbox Series X                                     │   │
│ │ Location: Bobby's Bedroom                            │   │
│ │ Type: Exclusive • Gaming                             │   │
│ │ Status: ● Online (35 min today)                      │   │
│ │ Power: 🔌 switch.bobby_xbox_plug                    │   │
│ │                                                       │   │
│ │ [Edit] [Unlink] [View History]                       │   │
│ ├──────────────────────────────────────────────────────┤   │
│ │ 📺 Living Room TV (Shared)                           │   │
│ │ Location: Living Room                                │   │
│ │ Type: Shared • Video                                 │   │
│ │ Bobby's Time: Mon-Fri 3-5 PM                         │   │
│ │                                                       │   │
│ │ [Edit Rules] [View History]                          │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                             │
│ Sarah (Age 10)                                              │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ 🎮 Nintendo Switch                                   │   │
│ │ Location: Playroom                                   │   │
│ │ Type: Exclusive • Gaming                             │   │
│ │ Status: ○ Offline                                    │   │
│ │ Power: 🔌 switch.sarah_switch_plug                  │   │
│ │                                                       │   │
│ │ [Edit] [Unlink] [View History]                       │   │
│ ├──────────────────────────────────────────────────────┤   │
│ │ 📱 iPad Mini                                         │   │
│ │ Location: Sarah's Bedroom                            │   │
│ │ Type: Exclusive • Video                              │   │
│ │ Status: ● Online (12 min today)                      │   │
│ │                                                       │   │
│ │ [Edit] [Unlink] [View History]                       │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                             │
│ [Scan for New Devices]                                      │
└────────────────────────────────────────────────────────────┘
```

### Add Device Link Modal

```
┌────────────────────────────────────────────────────────────┐
│ Add Device Link                                        [×] │
├────────────────────────────────────────────────────────────┤
│                                                             │
│ Step 1: Select Device                                       │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ 🔍 Search Home Assistant devices...                  │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                             │
│ Available Devices:                                          │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ ○ media_player.playstation_5                         │   │
│ │   PlayStation 5 (Living Room)                        │   │
│ ├──────────────────────────────────────────────────────┤   │
│ │ ○ switch.tp_link_plug_02                             │   │
│ │   TP-Link Smart Plug (Basement)                      │   │
│ ├──────────────────────────────────────────────────────┤   │
│ │ ○ media_player.roku_ultra                            │   │
│ │   Roku Ultra (Master Bedroom)                        │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                             │
│ Step 2: Link Configuration                                  │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ Child:           [Bobby ▼]                           │   │
│ │ Link Type:       [Exclusive ▼]                       │   │
│ │ Device Name:     [Bobby's PlayStation]               │   │
│ │ Location:        [Living Room ▼]                     │   │
│ │                                                       │   │
│ │ Power Control (optional):                            │   │
│ │ Smart Plug:      [switch.bobby_ps5_plug ▼]          │   │
│ │ Grace Period:    [5] minutes                         │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                             │
│                               [Cancel] [Create Link]        │
└────────────────────────────────────────────────────────────┘
```

### Configure Shared Device Modal

```
┌────────────────────────────────────────────────────────────┐
│ Configure Shared Device: Living Room TV              [×]  │
├────────────────────────────────────────────────────────────┤
│                                                             │
│ Usage Rules                                                 │
│                                                             │
│ Rule 1:                                                     │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ Child:       [Bobby ▼]                               │   │
│ │ Days:        ☑ Mon ☑ Tue ☑ Wed ☑ Thu ☑ Fri           │   │
│ │              ☐ Sat ☐ Sun                              │   │
│ │ Time Range:  [15:00] to [17:00]                      │   │
│ │ Priority:    [1] (Higher number = lower priority)    │   │
│ │                                       [Remove Rule]   │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                             │
│ Rule 2:                                                     │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ Child:       [Sarah ▼]                               │   │
│ │ Days:        ☑ Mon ☑ Tue ☑ Wed ☑ Thu ☑ Fri           │   │
│ │              ☐ Sat ☐ Sun                              │   │
│ │ Time Range:  [17:00] to [19:00]                      │   │
│ │ Priority:    [2]                                      │   │
│ │                                       [Remove Rule]   │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                             │
│ [+ Add Rule]                                                │
│                                                             │
│ Preview:                                                    │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ Monday 4:30 PM → Attributed to Bobby (Rule 1)        │   │
│ │ Monday 7:00 PM → Attributed to Sarah (Rule 2)        │   │
│ │ Saturday 2:00 PM → Not attributed (no matching rule) │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                             │
│                               [Cancel] [Save Rules]         │
└────────────────────────────────────────────────────────────┘
```

---

## API Design

### Create Device Link

```javascript
// POST /api/device-links
{
  entityId: "media_player.xbox_series_x",
  childId: 123,
  linkType: "exclusive",
  deviceName: "Bobby's Xbox",
  location: "Bobby's Bedroom",
  powerControlEntityId: "switch.bobby_xbox_plug",
  gracePeriod: 300
}

// Response
{
  success: true,
  linkId: 42,
  message: "Device link created successfully"
}
```

### Update Device Link

```javascript
// PUT /api/device-links/:linkId
{
  deviceName: "Bobby's Xbox Series X",
  location: "Upstairs Bedroom",
  gracePeriod: 600
}

// Response
{
  success: true,
  message: "Device link updated"
}
```

### Delete Device Link

```javascript
// DELETE /api/device-links/:linkId

// Response
{
  success: true,
  message: "Device link removed"
}
```

### Create Usage Rule (for shared devices)

```javascript
// POST /api/device-links/:linkId/rules
{
  childId: 123,
  weekdays: ["mon", "tue", "wed", "thu", "fri"],
  timeRange: "15:00-17:00",
  priority: 1,
  description: "Bobby's after-school time"
}

// Response
{
  success: true,
  ruleId: 101,
  message: "Usage rule created"
}
```

### Get Child's Devices

```javascript
// GET /api/children/:childId/devices

// Response
{
  success: true,
  devices: [
    {
      linkId: 42,
      entityId: "media_player.xbox_series_x",
      deviceName: "Bobby's Xbox",
      linkType: "exclusive",
      location: "Bedroom",
      status: "online",
      usageToday: 95,  // minutes
      powerControlled: true
    },
    {
      linkId: 43,
      entityId: "media_player.living_room_tv",
      deviceName: "Family TV",
      linkType: "shared",
      location: "Living Room",
      status: "offline",
      usageToday: 30,
      powerControlled: false
    }
  ]
}
```

---

## Smart Linking Suggestions

### AI-Powered Link Recommendations

```javascript
class SmartLinkingSuggestions {
  /**
   * Generate link suggestions using pattern matching
   * @param {Array<Device>} devices - Discovered HA devices
   * @param {Array<Child>} children - Allow2 children
   * @returns {Array<Suggestion>}
   */
  generateSuggestions(devices, children) {
    const suggestions = [];

    for (const device of devices) {
      for (const child of children) {
        const confidence = this.calculateConfidence(device, child);

        if (confidence > 0.5) {
          suggestions.push({
            deviceEntityId: device.entityId,
            deviceName: device.name,
            childId: child.id,
            childName: child.name,
            confidence: confidence,
            reasons: this.getReasons(device, child, confidence),
            suggestedLinkType: this.suggestLinkType(device, children),
            suggestedLocation: this.suggestLocation(device, child)
          });
        }
      }
    }

    // Sort by confidence (highest first)
    suggestions.sort((a, b) => b.confidence - a.confidence);

    return suggestions;
  }

  /**
   * Calculate confidence score
   */
  calculateConfidence(device, child) {
    let score = 0;

    // Check device name for child name
    const deviceNameLower = device.name.toLowerCase();
    const childNameLower = child.name.toLowerCase();

    if (deviceNameLower.includes(childNameLower)) {
      score += 0.7;  // Strong signal
    }

    // Check for possessive patterns ("Bobby's", "Sarah's")
    if (deviceNameLower.includes(`${childNameLower}'s`) ||
        deviceNameLower.includes(`${childNameLower}s`)) {
      score += 0.2;
    }

    // Check location for room patterns
    if (device.attributes.friendly_name) {
      const friendlyName = device.attributes.friendly_name.toLowerCase();
      const roomPatterns = [
        `${childNameLower} room`,
        `${childNameLower}'s room`,
        `${childNameLower} bedroom`,
        `${childNameLower}'s bedroom`
      ];

      for (const pattern of roomPatterns) {
        if (friendlyName.includes(pattern)) {
          score += 0.3;
          break;
        }
      }
    }

    return Math.min(score, 1.0);
  }

  /**
   * Get human-readable reasons
   */
  getReasons(device, child, confidence) {
    const reasons = [];

    if (device.name.toLowerCase().includes(child.name.toLowerCase())) {
      reasons.push(`Device name contains "${child.name}"`);
    }

    if (device.attributes.friendly_name?.toLowerCase().includes(`${child.name.toLowerCase()} room`)) {
      reasons.push(`Device appears to be in ${child.name}'s room`);
    }

    if (confidence > 0.8) {
      reasons.push("High confidence match");
    }

    return reasons;
  }

  /**
   * Suggest link type based on device and children count
   */
  suggestLinkType(device, children) {
    // If device name contains a specific child's name, suggest exclusive
    for (const child of children) {
      if (device.name.toLowerCase().includes(child.name.toLowerCase())) {
        return 'exclusive';
      }
    }

    // Living room / family room devices are likely shared
    const communalPatterns = ['living room', 'family room', 'den', 'basement'];
    const location = device.attributes.friendly_name?.toLowerCase() || '';

    for (const pattern of communalPatterns) {
      if (location.includes(pattern)) {
        return 'shared';
      }
    }

    // Default to exclusive if unsure
    return 'exclusive';
  }

  /**
   * Suggest location from device attributes
   */
  suggestLocation(device, child) {
    const friendlyName = device.attributes.friendly_name || '';

    // Extract location from friendly name
    const locationPatterns = [
      /\(([^)]+)\)$/,  // Text in parentheses at end
      /- ([^-]+)$/     // Text after dash at end
    ];

    for (const pattern of locationPatterns) {
      const match = friendlyName.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    // Default to child's room if device name includes child name
    if (device.name.toLowerCase().includes(child.name.toLowerCase())) {
      return `${child.name}'s Room`;
    }

    return 'Unknown';
  }
}
```

### Example Suggestions Output

```javascript
[
  {
    deviceEntityId: "media_player.xbox_series_x",
    deviceName: "Xbox Series X (Bobby's Room)",
    childId: 123,
    childName: "Bobby",
    confidence: 0.95,
    reasons: [
      "Device name contains 'Bobby'",
      "Device appears to be in Bobby's room",
      "High confidence match"
    ],
    suggestedLinkType: "exclusive",
    suggestedLocation: "Bobby's Room"
  },
  {
    deviceEntityId: "media_player.living_room_tv",
    deviceName: "Samsung TV (Living Room)",
    childId: null,
    childName: null,
    confidence: 0.85,
    reasons: [
      "Device in communal area",
      "Multiple children likely share this device"
    ],
    suggestedLinkType: "shared",
    suggestedLocation: "Living Room"
  }
]
```

---

## Summary

The device linking system provides:

1. **Flexible link types** (exclusive, shared, family, power_control)
2. **Intelligent usage attribution** via time-based rules
3. **Smart suggestions** using AI pattern matching
4. **Comprehensive database schema** for tracking and reporting
5. **Parent-friendly UI** for easy device management
6. **Bi-directional relationships** between children and devices

This system enables accurate tracking and enforcement while remaining flexible for complex family device-sharing scenarios.

---

**Next**: See INTEGRATIONS.md for specific Home Assistant integration examples
