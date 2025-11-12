# Calendar Development Plan
## Upgrading ChannelCalendar.jsx to Match InfiniteOSRMCalendar.js Architecture

### Current State Analysis
- **Basic Implementation**: Current ChannelCalendar.jsx is a simple grid-based view
- **Missing Features**: No drag/drop, no infinite scroll, no advanced date handling, no multi-day events
- **Target Architecture**: InfiniteOSRMCalendar.js with infinite scroll, sophisticated drag/drop, and advanced event rendering

---

## Phase 1: Core Infrastructure Upgrade 🚀

### 1.1 Infinite Scroll Calendar Base
**Files to Create/Modify:**
- `frontend/src/components/calendar/ChannelCalendar.jsx` - Complete rewrite
- `frontend/src/components/calendar/CalendarUtils.js` - Date utilities
- `frontend/src/components/calendar/EventItem.jsx` - Event component
- `frontend/src/components/calendar/DayCell.jsx` - Day cell component

**Key Features to Implement:**
```javascript
// Infinite scroll architecture from staging
const [visibleWeeks, setVisibleWeeks] = useState([]);
const [isLoadingHistory, setIsLoadingHistory] = useState(false);
const [optimisticEventUpdates, setOptimisticEventUpdates] = useState(new Map());

// Week loading system
const loadWeeks = useCallback((anchor, direction, count) => {
  // Generate weeks dynamically as user scrolls
});

// Scroll-based week loading
const handleScroll = useCallback(() => {
  // Load weeks backward/forward based on scroll position
});
```

### 1.2 Advanced Date Handling
**Critical Components:**
- **Timezone-aware date calculations** from staging
- **FileMaker date format compatibility** (MM/DD/YYYY)
- **All-day event exclusive date handling**
- **Multi-day event spanning logic**

```javascript
// From staging - critical date fix
const createConsistentDate = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();
  
  // Create UTC date using the same date components (prevents timezone shift)
  const utcDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  return utcDate.toISOString();
};
```

### 1.3 Event Rendering System
**Advanced Features:**
- **Multi-day event spanning** with start/end indicators
- **All-day vs timed event distinction**
- **Event numbering system** for timed events
- **Project color integration**
- **Visual sync indicators**

---

## Phase 2: Drag & Drop Implementation 🎯

### 2.1 React DnD Integration
**Dependencies:**
```bash
npm install react-dnd react-dnd-html5-backend
```

**Core Drag/Drop Components:**
```javascript
// EventItem with drag capability
const [{ isDragging }, drag] = useDrag({
  type: 'EVENT',
  item: { 
    id: event.event_id || event.eventId, 
    event: {
      ...event,
      isEditable: canEditEvent(event, username, userAccount, teamMembers)
    }, 
    isCopy: isOptionPressed,
    isEndDate: isEndDate
  },
  canDrag: () => isEditable && !batchMode,
  collect: (monitor) => ({ isDragging: !!monitor.isDragging() })
});

// DayCell as drop target
const [{ isOver }, drop] = useDrop({
  accept: 'EVENT',
  drop: (item) => onEventDrop(item, date),
  collect: (monitor) => ({ isOver: !!monitor.isOver() })
});
```

### 2.2 Optimistic Updates System
**Race Condition Prevention:**
```javascript
// Optimistic update pattern from staging
const [optimisticEventUpdates, setOptimisticEventUpdates] = useState(new Map());

// Apply optimistic update with flag
const optimisticUpdate = {
  start: eventData.start,
  end: eventData.end,
  due_manually_set: eventData.due_manually_set,
  due_end_date: eventData.due_end_date,
  _optimisticUpdate: true // FLAG to prevent WebSocket overwrites
};

setOptimisticEventUpdates(prev => new Map(prev).set(event.id, optimisticUpdate));
```

### 2.3 Complex Date Calculations
**Multi-day Event Logic:**
- **Start date dragging** - maintain duration
- **End date dragging** - preserve start date  
- **All-day event exclusive dates** - user-friendly display
- **Duration preservation** for timed events

---

## Phase 3: Channel/Workspace Switching 🔄

### 3.1 Channel Dropdown Component
**File:** `frontend/src/components/calendar/ChannelDropdown.jsx`

**Features:**
- **Multi-channel view support**
- **Permission-based channel filtering**
- **Real-time channel switching**
- **Channel color coding**

```javascript
const ChannelDropdown = ({ 
  channels, 
  selectedChannels, 
  onChannelToggle,
  userPermissions 
}) => {
  // Filter channels by user access
  const accessibleChannels = channels.filter(channel => 
    canAccessChannel(channel, userPermissions)
  );
  
  return (
    <DropdownMenu>
      {accessibleChannels.map(channel => (
        <DropdownItem
          key={channel.id}
          selected={selectedChannels.has(channel.id)}
          onToggle={() => onChannelToggle(channel.id)}
          color={channel.color}
        >
          {channel.name}
        </DropdownItem>
      ))}
    </DropdownMenu>
  );
};
```

### 3.2 Multi-Channel Data Management
**Event Aggregation:**
```javascript
// Combine events from multiple selected channels
const aggregatedEvents = useMemo(() => {
  return selectedChannels.flatMap(channelId => {
    const channelEvents = eventsByChannel[channelId] || [];
    return channelEvents.map(event => ({
      ...event,
      channelId,
      channelName: channels.find(c => c.id === channelId)?.name
    }));
  });
}, [selectedChannels, eventsByChannel, channels]);
```

---

## Phase 4: Permission System Integration 🔐

### 4.1 Advanced Permission Checking
**File:** `frontend/src/utils/channelPermissions.js`

```javascript
// Enhanced permission system from staging
export const canEditEvent = (event, username, userAccount, channelMembers, channels) => {
  // Check if user is channel admin/member
  const channel = channels.find(c => c.id === event.channelId);
  const membership = channelMembers.find(m => m.userId === userAccount.id);
  
  // Permission hierarchy: admin > assignee > assigner > channel member
  return isChannelAdmin(membership) || 
         isEventAssignee(event, userAccount) || 
         isEventCreator(event, userAccount) ||
         isChannelMember(membership);
};

export const canCreateEvent = (channelId, userAccount, channelMembers) => {
  const membership = channelMembers.find(m => 
    m.channelId === channelId && m.userId === userAccount.id
  );
  return membership && ['admin', 'member'].includes(membership.role);
};
```

### 4.2 UI Permission Integration
**Visual Indicators:**
```javascript
// Permission-based styling
const eventClasses = [
  'event-item',
  canEditEvent(event) ? 'editable' : 'non-editable',
  canEditEvent(event) ? '' : 'cursor-not-allowed opacity-75'
].filter(Boolean).join(' ');

// Drag capability based on permissions
canDrag: () => canEditEvent(event) && !batchMode
```

---

## Phase 5: Advanced Features 🌟

### 5.1 Project Color System
**Integration with Channel Themes:**
```javascript
// Project/channel color fetching from staging pattern
const fetchChannelColor = useCallback(async (channelId) => {
  try {
    const response = await fetch(`/api/channels/${channelId}/preferences`);
    const prefs = await response.json();
    const color = prefs?.color || '#3498db';
    
    setChannelColors(prev => ({
      ...prev,
      [channelId]: color
    }));
  } catch (error) {
    console.error('Error fetching channel color:', error);
  }
}, []);
```

### 5.2 Event Creation Enhancement  
**Click-to-Create:**
```javascript
const handleDayClick = useCallback((date) => {
  // Create new event with proper date handling
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);
  
  setNewEvent({
    start: dateOnly,
    end: dateOnly,
    isAllDay: false,
    title: '',
    channelId: selectedChannel.id,
    assignedTo: currentUser.id
  });
}, [selectedChannel, currentUser]);
```

### 5.3 WebSocket Integration
**Real-time Updates:**
```javascript
// WebSocket event handlers
useEffect(() => {
  if (connectionStatus === 'connected') {
    // Listen for task updates from other users
    socket.on('taskUpdated', handleTaskUpdate);
    socket.on('taskCreated', handleTaskCreate);
    socket.on('taskDeleted', handleTaskDelete);
  }
  
  return () => {
    socket.off('taskUpdated');
    socket.off('taskCreated'); 
    socket.off('taskDeleted');
  };
}, [connectionStatus]);
```

---

## Implementation Priority Order 📋

### Week 1-2: Foundation
1. ✅ Rewrite ChannelCalendar.jsx with infinite scroll architecture
2. ✅ Implement advanced date utilities 
3. ✅ Create EventItem and DayCell components

### Week 3-4: Drag & Drop
1. ✅ Integrate React DnD with proper event handling
2. ✅ Implement optimistic updates system
3. ✅ Add complex date calculation logic

### Week 5: Channel Management  
1. ✅ Build channel dropdown component
2. ✅ Implement multi-channel data aggregation
3. ✅ Add channel color theming

### Week 6: Permissions & Polish
1. ✅ Integrate advanced permission system
2. ✅ Add WebSocket real-time updates
3. ✅ Performance optimization and testing

---

## Success Metrics 🎯

### Functional Requirements:
- ✅ **Drag & Drop**: Smooth event movement between dates
- ✅ **Multi-Channel**: View/edit events across multiple channels  
- ✅ **Permissions**: Role-based editing restrictions
- ✅ **Real-time**: WebSocket updates without conflicts
- ✅ **Performance**: Smooth infinite scroll with 1000+ events

### User Experience:
- ✅ **Industry Standard**: Matches Google Calendar/Outlook functionality
- ✅ **Mobile Responsive**: Works on tablets and phones
- ✅ **Accessibility**: Keyboard navigation and screen reader support
- ✅ **Visual Polish**: Professional appearance with smooth animations

### Technical Excellence:
- ✅ **Race Condition Free**: Optimistic updates prevent conflicts
- ✅ **Memory Efficient**: Virtualized rendering for large datasets  
- ✅ **Error Resilient**: Graceful handling of network/API failures
- ✅ **Type Safe**: Full TypeScript integration where applicable
