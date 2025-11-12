# Timeline Development Plan
## Upgrading ChannelTimeline.jsx to Match GV2.js Gantt Architecture

### Current State Analysis
- **Basic Implementation**: Current ChannelTimeline.jsx is a simple linear task list
- **Missing Features**: No Gantt chart, no hierarchies, no dependencies, no drag/drop, no zoom controls
- **Target Architecture**: GV2.js with sophisticated Gantt chart, task hierarchies, dependency management, and advanced interactions

---

## Phase 1: Gantt Chart Foundation 🏗️

### 1.1 Core Gantt Architecture
**Files to Create/Modify:**
- `frontend/src/components/timeline/ChannelTimeline.jsx` - Complete rewrite with Gantt chart
- `frontend/src/components/timeline/GanttChart.jsx` - Main Gantt rendering component
- `frontend/src/components/timeline/TimelineHeader.jsx` - Timeline header with zoom controls
- `frontend/src/components/timeline/TaskRow.jsx` - Individual task row component
- `frontend/src/components/timeline/EventBar.jsx` - Draggable timeline event bars

**Core Gantt Structure:**
```javascript
// Gantt chart layout from GV2.js staging
const GanttChart = ({ tasks, dependencies, zoom, timelineRange }) => {
  const [columnWidths, setColumnWidths] = useState(INITIAL_COLUMN_WIDTHS);
  const [showTimeline, setShowTimeline] = useState(true);
  const [optimisticEventDrags, setOptimisticEventDrags] = useState(new Map());
  
  // Timeline calculation
  const timelineData = useMemo(() => {
    const useWeeks = zoom <= DAILY_MODE_ZOOM_THRESHOLD;
    const { start, end } = timelineRange;
    
    if (useWeeks) {
      const weeks = getDateRange(start, end, true);
      return { weeks, days: [], startDate: start, isWeekly: true };
    } else {
      const days = getDateRange(start, end, false);
      return { days, weeks: [], startDate: start, isWeekly: false };
    }
  }, [timelineRange, zoom]);

  return (
    <div className="gantt-container">
      <div className="fixed-columns">
        {/* Task columns: Title, Assigned, Dates, etc. */}
      </div>
      <div className="timeline-area">
        <TimelineHeader timelineData={timelineData} zoom={zoom} />
        <div className="timeline-grid">
          {/* Timeline grid and event bars */}
        </div>
      </div>
    </div>
  );
};
```

### 1.2 Task Hierarchy System
**Hierarchical Structure:**
```javascript
// Process tasks into hierarchy using parent_task_id
const processTaskHierarchy = useCallback((tasks) => {
  const taskMap = new Map();
  const rootTasks = [];
  
  // First pass: create task map
  tasks.forEach(task => {
    taskMap.set(task.id, { ...task, children: [] });
  });
  
  // Second pass: build hierarchy
  tasks.forEach(task => {
    if (task.parent_task_id) {
      const parent = taskMap.get(task.parent_task_id);
      if (parent) {
        parent.children.push(taskMap.get(task.id));
      }
    } else {
      rootTasks.push(taskMap.get(task.id));
    }
  });
  
  return rootTasks;
}, []);

// Flatten hierarchy for rendering with levels
const flattenHierarchy = useCallback((hierarchyTasks) => {
  const flattened = [];
  
  const flatten = (task, level = 0) => {
    flattened.push({ ...task, level, hasChildren: task.children.length > 0 });
    
    if (expandedTasks.has(task.id)) {
      task.children.forEach(child => flatten(child, level + 1));
    }
  };
  
  hierarchyTasks.forEach(task => flatten(task));
  return flattened;
}, [expandedTasks]);
```

### 1.3 Timeline Rendering System
**Event Bar Positioning:**
```javascript
// Calculate timeline positions for events
const getEventStyle = useCallback((event, level) => {
  if (!event.start_date || !event.end_date) return { display: 'none' };
  
  const startDate = new Date(event.start_date);
  const endDate = new Date(event.end_date);
  const timelineStart = new Date(timelineData.startDate);
  
  // Normalize dates to midnight
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  timelineStart.setHours(0, 0, 0, 0);
  
  const totalDays = Math.floor((startDate - timelineStart) / (1000 * 60 * 60 * 24));
  const duration = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
  
  const left = totalDays * CELL_WIDTH * zoom;
  const width = duration * CELL_WIDTH * zoom;
  const levelIndent = level * 20;
  
  return {
    left: left + levelIndent,
    width: width - levelIndent,
    overflow: 'visible'
  };
}, [timelineData, zoom]);
```

---

## Phase 2: Advanced Drag & Drop System 🎯

### 2.1 Multi-Type Drag Operations
**Task Dragging:**
```javascript
// Different drag types from GV2.js
const TaskRow = ({ task, level, canEdit }) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'GANTT_ITEM', 
    item: { 
      id: task.id,
      type: task.dependencies?.length > 0 ? 'group-drag' : 'regular',
      task: task
    },
    canDrag: () => canEdit && !activeHandle,
    collect: (monitor) => ({ isDragging: !!monitor.isDragging() })
  });

  return (
    <div ref={drag} className={`task-row level-${level}`}>
      {/* Task content */}
    </div>
  );
};

// Task reordering within same hierarchy level
const ReorderDragHandle = ({ task, onReorder, level }) => {
  const [{ isDragging }, dragRef] = useDrag({
    type: 'TASK_REORDER',
    item: {
      taskId: task.id,
      level: level,
      originalPosition: task.position || 0
    },
    collect: (monitor) => ({ isDragging: monitor.isDragging() })
  });

  const [{ isOver }, dropRef] = useDrop({
    accept: 'TASK_REORDER',
    canDrop: (item) => item.level === level,
    drop: (item) => onReorder(item.taskId, task.position),
    collect: (monitor) => ({ isOver: monitor.isOver() })
  });

  return (
    <div ref={node => { dragRef(node); dropRef(node); }}>
      {/* 6-dot drag handle */}
    </div>
  );
};
```

### 2.2 Timeline Event Bar Dragging
**Event Bar Resizing & Moving:**
```javascript
const EventBar = ({ 
  event, 
  style, 
  onEventUpdate,
  isEditable, 
  zoom,
  timelineRef,
  level
}) => {
  const [activeHandle, setActiveHandle] = useState(null);
  const [isResizing, setIsResizing] = useState(false);
  
  // Drag for moving entire event
  const [{ dragging }, drag] = useDrag({
    type: 'GANTT_ITEM',
    item: { id: event.id, event: event },
    canDrag: () => isEditable && !activeHandle,
    collect: (monitor) => ({ isDragging: !!monitor.isDragging() })
  });

  // Handle resize start/end
  const handleResizeStart = useCallback((e, edge) => {
    if (!isEditable) return;
    
    setActiveHandle(edge);
    setIsResizing(true);
    
    const startX = e.pageX;
    const cellWidth = CELL_WIDTH * zoom;
    
    const handleMouseMove = (moveE) => {
      const mouseDiff = moveE.pageX - startX;
      const columnIndex = Math.floor(mouseDiff / cellWidth);
      
      // Visual feedback during resize
      updateEventBarPreview(edge, columnIndex);
    };
    
    const handleMouseUp = () => {
      // Finalize resize and update database
      finalizeResize(edge);
      setActiveHandle(null);
      setIsResizing(false);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [isEditable, zoom]);

  return (
    <div ref={drag} className="event-bar" style={style}>
      {/* Resize handles */}
      {isEditable && (
        <>
          <div 
            className="resize-handle left"
            onMouseDown={(e) => handleResizeStart(e, 'start')}
          />
          <div 
            className="resize-handle right"
            onMouseDown={(e) => handleResizeStart(e, 'end')}
          />
        </>
      )}
      
      <div className="event-content">
        {event.title}
      </div>
    </div>
  );
};
```

### 2.3 Dependency Creation
**Shift+Drag Dependency Creation:**
```javascript
// Dependency creation via Shift+drag from GV2.js
const handleResizeStart = useCallback((e, edge) => {
  if (e.shiftKey) {
    // Dependency creation mode
    setIsDependencyMode(true);
    setDependencySource({ taskId: event.id, edge: edge });
    
    const handleDependencyDrop = (targetTaskId, targetEdge) => {
      const dependencyType = getDependencyType(edge, targetEdge);
      
      onDependencyCreate({
        sourceTaskId: event.id,
        targetTaskId: targetTaskId,
        dependencyType: dependencyType
      });
    };
    
    return;
  }
  
  // Normal resize mode
  // ... resize logic
}, [event.id, onDependencyCreate]);

const getDependencyType = (sourceEdge, targetEdge) => {
  if (sourceEdge === 'end' && targetEdge === 'start') return 'FS'; // Finish-to-Start
  if (sourceEdge === 'start' && targetEdge === 'start') return 'SS'; // Start-to-Start  
  if (sourceEdge === 'end' && targetEdge === 'end') return 'FF'; // Finish-to-Finish
  if (sourceEdge === 'start' && targetEdge === 'end') return 'SF'; // Start-to-Finish
  return 'FS'; // Default
};
```

---

## Phase 3: Dependency System 🔗

### 3.1 Dependency Data Management
**Database Integration:**
```javascript
// Dependencies stored in channel_tasks.dependencies JSONB field
const [dependencies, setDependencies] = useState([]);

// Extract dependencies from task data
const extractDependenciesFromTasks = useCallback(() => {
  const taskDependencies = [];
  
  tasks.forEach(task => {
    if (task.dependencies && Array.isArray(task.dependencies)) {
      task.dependencies.forEach(dep => {
        taskDependencies.push({
          id: `${task.id}-${dep.task_id}`,
          source_task_id: task.id,           // successor (depends on)
          target_task_id: dep.task_id,       // predecessor (depended upon)
          dependency_type: dep.type || 'FS'
        });
      });
    }
  });
  
  setDependencies(taskDependencies);
}, [tasks]);

// Update task dependencies
const handleDependencyCreate = useCallback(async ({ 
  sourceTaskId, 
  targetTaskId, 
  dependencyType 
}) => {
  try {
    const sourceTask = tasks.find(t => t.id === sourceTaskId);
    const currentDeps = sourceTask.dependencies || [];
    
    const newDependency = {
      task_id: targetTaskId,
      type: dependencyType
    };
    
    const updatedDependencies = [...currentDeps, newDependency];
    
    await onTaskUpdate(sourceTaskId, {
      dependencies: updatedDependencies
    });
    
    message.success('Dependency created successfully');
  } catch (error) {
    console.error('Error creating dependency:', error);
    message.error('Failed to create dependency');
  }
}, [tasks, onTaskUpdate]);
```

### 3.2 Dependency Line Rendering
**Visual Dependency Lines:**
```javascript
const DependencyLines = ({ 
  dependencies, 
  getTaskPosition, 
  containerRef, 
  zoom 
}) => {
  const [lines, setLines] = useState([]);
  
  useEffect(() => {
    const newLines = dependencies.map(dep => {
      const sourcePos = getTaskPosition(dep.source_task_id);
      const targetPos = getTaskPosition(dep.target_task_id);
      
      if (!sourcePos || !targetPos) return null;
      
      // Calculate connection points based on dependency type
      let sourceX, sourceY, targetX, targetY;
      
      switch (dep.dependency_type) {
        case 'FS': // Finish-to-Start
          sourceX = sourcePos.left + sourcePos.width;
          targetX = targetPos.left;
          break;
        case 'SS': // Start-to-Start  
          sourceX = sourcePos.left;
          targetX = targetPos.left;
          break;
        case 'FF': // Finish-to-Finish
          sourceX = sourcePos.left + sourcePos.width;
          targetX = targetPos.left + targetPos.width;
          break;
        case 'SF': // Start-to-Finish
          sourceX = sourcePos.left;
          targetX = targetPos.left + targetPos.width;
          break;
      }
      
      sourceY = sourcePos.top + (sourcePos.height / 2);
      targetY = targetPos.top + (targetPos.height / 2);
      
      // Create smooth bezier curve
      const midX = (sourceX + targetX) / 2;
      const controlOffset = Math.abs(targetY - sourceY) * 0.3;
      
      return {
        id: dep.id,
        path: `M ${sourceX} ${sourceY} Q ${midX} ${sourceY + controlOffset} ${targetX} ${targetY}`,
        type: dep.dependency_type
      };
    }).filter(Boolean);
    
    setLines(newLines);
  }, [dependencies, getTaskPosition, zoom]);
  
  return (
    <div className="dependency-lines">
      <svg width="100%" height="100%">
        {lines.map(line => (
          <path
            key={line.id}
            d={line.path}
            stroke="#4a90e2"
            strokeWidth={2 * zoom}
            fill="none"
            markerEnd="url(#arrowhead)"
            strokeDasharray={line.type !== 'FS' ? "4 2" : ""}
          />
        ))}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="6"
            markerHeight="6" 
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L6,3 z" fill="#4a90e2" />
          </marker>
        </defs>
      </svg>
    </div>
  );
};
```

### 3.3 Auto-Scheduling
**Dependency-Based Scheduling:**
```javascript
const autoScheduleTasks = useCallback(() => {
  const tasksMap = new Map();
  tasks.forEach(task => tasksMap.set(task.id, task));
  
  // Topological sort for scheduling order
  const sortedTasks = topologicalSort(tasks, dependencies);
  const updatedTasks = [];
  
  sortedTasks.forEach(taskId => {
    const task = tasksMap.get(taskId);
    const taskDeps = dependencies.filter(dep => dep.source_task_id === taskId);
    
    if (taskDeps.length === 0) return; // No dependencies
    
    let earliestStart = null;
    
    taskDeps.forEach(dep => {
      const predecessorTask = tasksMap.get(dep.target_task_id);
      if (!predecessorTask?.end_date) return;
      
      let constraintDate = new Date(predecessorTask.end_date);
      
      switch (dep.dependency_type) {
        case 'FS': // Start after predecessor finishes
          constraintDate.setDate(constraintDate.getDate() + 1);
          break;
        case 'SS': // Start when predecessor starts
          constraintDate = new Date(predecessorTask.start_date);
          break;
        // ... other dependency types
      }
      
      if (!earliestStart || constraintDate > earliestStart) {
        earliestStart = constraintDate;
      }
    });
    
    if (earliestStart) {
      const currentStart = new Date(task.start_date);
      
      if (earliestStart > currentStart) {
        // Task needs rescheduling
        const duration = task.end_date ? 
          (new Date(task.end_date) - currentStart) / (1000 * 60 * 60 * 24) : 1;
        
        const newEndDate = new Date(earliestStart);
        newEndDate.setDate(newEndDate.getDate() + duration);
        
        updatedTasks.push({
          id: task.id,
          start_date: earliestStart.toISOString(),
          end_date: newEndDate.toISOString()
        });
      }
    }
  });
  
  // Apply all updates
  if (updatedTasks.length > 0) {
    Modal.confirm({
      title: 'Auto-schedule Tasks',
      content: `${updatedTasks.length} tasks need rescheduling. Apply changes?`,
      onOk: async () => {
        for (const update of updatedTasks) {
          await onTaskUpdate(update.id, update);
        }
        message.success(`Rescheduled ${updatedTasks.length} tasks`);
      }
    });
  }
}, [tasks, dependencies, onTaskUpdate]);
```

---

## Phase 4: Channel/Multi-Project Support 🔄

### 4.1 Channel-Based Project Organization
**Multi-Channel Timeline:**
```javascript
// Channel-based project grouping (similar to GV2.js project grouping)
const processChannelGroups = useCallback(() => {
  // Group tasks by channel (equivalent to projects in staging)
  const channelGroups = tasks.reduce((groups, task) => {
    const channelId = task.thread_id; // Tasks belong to channels
    const channel = channels.find(c => c.id === channelId);
    const channelName = channel ? `#${channel.name}` : 'Unknown Channel';
    
    if (!groups[channelName]) {
      groups[channelName] = {
        channelId: channelId,
        channelName: channelName,
        tasks: [],
        color: channel?.color || '#3498db'
      };
    }
    
    groups[channelName].tasks.push(task);
    return groups;
  }, {});
  
  // Apply channel-based sorting and filtering
  return Object.values(channelGroups);
}, [tasks, channels]);

// Channel collapse/expand state
const [collapsedChannels, setCollapsedChannels] = useState(new Set());

const toggleChannelCollapse = useCallback((channelName) => {
  setCollapsedChannels(prev => {
    const next = new Set(prev);
    if (next.has(channelName)) {
      next.delete(channelName);
    } else {
      next.add(channelName);
    }
    return next;
  });
}, []);
```

### 4.2 Channel Dropdown Integration
**Multi-Channel Selection:**
```javascript
// Reuse ChannelDropdown from Calendar plan
const ChannelTimelineView = () => {
  const [selectedChannels, setSelectedChannels] = useState(new Set());
  
  // Filter tasks by selected channels
  const filteredTasks = useMemo(() => {
    if (selectedChannels.size === 0) return tasks;
    
    return tasks.filter(task => 
      selectedChannels.has(task.thread_id)
    );
  }, [tasks, selectedChannels]);
  
  return (
    <div className="channel-timeline">
      <div className="timeline-header">
        <ChannelDropdown
          channels={accessibleChannels}
          selectedChannels={selectedChannels}
          onChannelToggle={setSelectedChannels}
          userPermissions={userPermissions}
        />
        <TimelineControls />
      </div>
      
      <GanttChart 
        tasks={filteredTasks}
        dependencies={dependencies}
        channels={channels}
      />
    </div>
  );
};
```

### 4.3 Cross-Channel Dependencies
**Inter-Channel Task Dependencies:**
```javascript
// Support dependencies across different channels
const validateCrossChannelDependency = (sourceTask, targetTask) => {
  const sourceChannel = channels.find(c => c.id === sourceTask.thread_id);
  const targetChannel = channels.find(c => c.id === targetTask.thread_id);
  
  // Check if user has access to both channels
  const canAccessSource = canAccessChannel(sourceChannel, userPermissions);
  const canAccessTarget = canAccessChannel(targetChannel, userPermissions);
  
  if (!canAccessSource || !canAccessTarget) {
    throw new Error('Cannot create dependency - insufficient channel access');
  }
  
  return true;
};

// Visual indicators for cross-channel dependencies
const renderDependencyLine = (dependency) => {
  const sourceTask = tasks.find(t => t.id === dependency.source_task_id);
  const targetTask = tasks.find(t => t.id === dependency.target_task_id);
  
  const isCrossChannel = sourceTask.thread_id !== targetTask.thread_id;
  
  return (
    <path
      className={isCrossChannel ? 'cross-channel-dependency' : 'same-channel-dependency'}
      stroke={isCrossChannel ? '#ff6b35' : '#4a90e2'}
      strokeDasharray={isCrossChannel ? "6 3" : "none"}
      // ... other path props
    />
  );
};
```

---

## Phase 5: Advanced UI Features 🎨

### 5.1 Zoom & Timeline Controls
**Timeline Zoom System:**
```javascript
// Zoom controls from GV2.js
const [zoom, setZoom] = useState(0.6);
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.05;

// Dynamic timeline rendering based on zoom
const useWeeks = zoom <= 0.5; // Switch to weekly view at low zoom

const TimelineControls = () => {
  return (
    <div className="timeline-controls">
      <button 
        onClick={() => setZoom(Math.max(MIN_ZOOM, zoom - ZOOM_STEP))}
        disabled={zoom <= MIN_ZOOM}
      >
        −
      </button>
      
      <span className="zoom-level">
        {Math.round(zoom * 100)}%
      </span>
      
      <button 
        onClick={() => setZoom(Math.min(MAX_ZOOM, zoom + ZOOM_STEP))}
        disabled={zoom >= MAX_ZOOM}
      >
        +
      </button>
      
      <button onClick={() => scrollToToday()}>
        Today
      </button>
      
      <button onClick={autoScheduleTasks}>
        Auto-Schedule
      </button>
    </div>
  );
};
```

### 5.2 Resizable Columns
**Column Management:**
```javascript
// Resizable columns with persistence
const [columnWidths, setColumnWidths] = useState({
  task: 300,
  assigned: 120, 
  startDate: 100,
  endDate: 100,
  status: 80,
  priority: 80
});

const [columnVisibility, setColumnVisibility] = useState({
  task: true,
  assigned: true,
  startDate: true,
  endDate: true,
  status: true,
  priority: false
});

const ResizableColumn = ({ title, width, onResize }) => {
  const [isResizing, setIsResizing] = useState(false);
  
  const handleMouseDown = useCallback((e) => {
    const startX = e.pageX;
    const startWidth = width;
    
    const handleMouseMove = (e) => {
      const newWidth = Math.max(50, startWidth + (e.pageX - startX));
      onResize(newWidth);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    setIsResizing(true);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [width, onResize]);
  
  return (
    <div className="column-header" style={{ width }}>
      <span>{title}</span>
      <div 
        className="resize-handle"
        onMouseDown={handleMouseDown}
      />
    </div>
  );
};
```

### 5.3 Inline Editing
**Inline Task Editing:**
```javascript
// Inline editing components for task fields
const InlineTaskTitle = ({ task, onUpdate, canEdit }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(task.title);
  
  const handleSave = async () => {
    if (value !== task.title) {
      await onUpdate(task.id, { title: value });
    }
    setIsEditing(false);
  };
  
  if (isEditing && canEdit) {
    return (
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') {
            setValue(task.title);
            setIsEditing(false);
          }
        }}
        autoFocus
      />
    );
  }
  
  return (
    <span 
      className={canEdit ? 'editable-text' : ''}
      onClick={() => canEdit && setIsEditing(true)}
    >
      {task.title}
    </span>
  );
};

// Similar components for assigned_to, dates, status, etc.
```

---

## Phase 6: Permissions & Polish 🔐

### 6.1 Permission-Based UI
**Role-Based Editing:**
```javascript
// Permission checking for channel tasks
const canEditTask = (task, user, channelMembers) => {
  const membership = channelMembers.find(m => 
    m.user_id === user.id && m.thread_id === task.thread_id
  );
  
  if (!membership) return false;
  
  // Admin can edit everything
  if (membership.role === 'admin') return true;
  
  // Members can edit tasks assigned to them or created by them
  if (membership.role === 'member') {
    return task.assigned_to === user.id || task.created_by === user.id;
  }
  
  return false;
};

// Visual permission indicators
const TaskRow = ({ task, user, channelMembers }) => {
  const canEdit = canEditTask(task, user, channelMembers);
  
  return (
    <div className={`task-row ${canEdit ? 'editable' : 'read-only'}`}>
      {canEdit && <ReorderHandle />}
      <InlineTaskTitle task={task} canEdit={canEdit} />
      {/* ... other task fields */}
    </div>
  );
};
```

### 6.2 Performance Optimizations
**Virtualized Rendering:**
```javascript
// Virtualize long task lists for performance
import { FixedSizeList as List } from 'react-window';

const VirtualizedTaskList = ({ tasks, itemHeight = 30 }) => {
  const Row = ({ index, style }) => {
    const task = tasks[index];
    return (
      <div style={style}>
        <TaskRow task={task} />
      </div>
    );
  };
  
  return (
    <List
      height={600} // Container height
      itemCount={tasks.length}
      itemSize={itemHeight}
      width="100%"
    >
      {Row}
    </List>
  );
};
```

### 6.3 Real-time Collaboration
**WebSocket Integration:**
```javascript
// Real-time updates for collaborative editing
useEffect(() => {
  if (socket) {
    socket.on('taskUpdated', (updatedTask) => {
      setTasks(prev => prev.map(task => 
        task.id === updatedTask.id ? updatedTask : task
      ));
    });
    
    socket.on('dependencyCreated', (dependency) => {
      setDependencies(prev => [...prev, dependency]);
    });
    
    socket.on('taskReordered', ({ taskId, newPosition, channelId }) => {
      setTasks(prev => prev.map(task => {
        if (task.id === taskId) {
          return { ...task, position: newPosition };
        }
        return task;
      }));
    });
    
    return () => {
      socket.off('taskUpdated');
      socket.off('dependencyCreated');
      socket.off('taskReordered');
    };
  }
}, [socket]);
```

---

## Implementation Priority Order 📋

### Week 1-2: Gantt Foundation
1. ✅ Rewrite ChannelTimeline.jsx with Gantt chart architecture
2. ✅ Implement task hierarchy system using parent_task_id 
3. ✅ Create timeline rendering and event bar positioning
4. ✅ Add zoom controls and timeline header

### Week 3-4: Drag & Drop System  
1. ✅ Integrate React DnD for task dragging and reordering
2. ✅ Implement event bar resizing with start/end handles
3. ✅ Add Shift+drag dependency creation mode
4. ✅ Implement optimistic updates for smooth interactions

### Week 5-6: Dependencies & Auto-Scheduling
1. ✅ Build dependency data management and JSONB storage
2. ✅ Create visual dependency line rendering system
3. ✅ Implement topological sort for auto-scheduling
4. ✅ Add dependency type support (FS, SS, FF, SF)

### Week 7: Channel Management
1. ✅ Integrate channel dropdown for multi-project support
2. ✅ Add channel-based task grouping and filtering
3. ✅ Support cross-channel dependencies with validation
4. ✅ Implement channel color theming

### Week 8: Advanced Features & Polish
1. ✅ Add resizable columns with persistence
2. ✅ Implement inline editing for task fields
3. ✅ Add virtualized rendering for performance
4. ✅ Integrate WebSocket real-time collaboration

---

## Architecture Comparison 🏗️

### Current vs Target Architecture

| Feature | Current ChannelTimeline | Target (GV2.js Style) | Implementation Status |
|---------|------------------------|----------------------|----------------------|
| **Layout** | Simple list | Gantt chart with timeline | 📋 Phase 1 |
| **Hierarchy** | Flat tasks | Parent/child with expand/collapse | 📋 Phase 1 |
| **Drag & Drop** | None | Multi-type drag operations | 🎯 Phase 2 |
| **Dependencies** | None | Visual lines with auto-schedule | 🔗 Phase 3 |  
| **Multi-Channel** | Single channel | Channel dropdown with filtering | 🔄 Phase 4 |
| **Permissions** | Basic | Role-based editing restrictions | 🔐 Phase 6 |
| **Timeline Scale** | Static | Dynamic zoom (daily/weekly) | 🎨 Phase 5 |
| **Real-time** | None | WebSocket collaborative editing | 🔐 Phase 6 |

### Key Architectural Decisions

1. **Timeline Rendering**: Use absolute positioning for event bars with proper date calculations
2. **Hierarchy Management**: Leverage existing `parent_task_id` field with expand/collapse state
3. **Dependency Storage**: JSONB array in database with efficient extraction and visualization
4. **Permission Model**: Channel-based with role inheritance (admin > member > viewer)
5. **Performance**: Virtualized rendering for 1000+ tasks with optimistic updates
6. **Collaboration**: WebSocket integration with conflict resolution

---

## Success Metrics 🎯

### Functional Requirements:
- ✅ **Gantt Chart**: Professional timeline with zoom controls
- ✅ **Task Hierarchy**: Expandable parent/child relationships
- ✅ **Drag & Drop**: Event bars resize/move with date updates
- ✅ **Dependencies**: Visual lines with 4 dependency types (FS, SS, FF, SF)
- ✅ **Auto-Schedule**: Dependency-based automatic rescheduling
- ✅ **Multi-Channel**: View/edit tasks across multiple channels
- ✅ **Permissions**: Role-based editing with visual indicators

### User Experience:
- ✅ **Industry Standard**: Matches Microsoft Project/Smartsheet functionality
- ✅ **Intuitive**: Drag to reschedule, Shift+drag for dependencies
- ✅ **Responsive**: Smooth interactions with optimistic updates
- ✅ **Professional**: Clean design with proper visual hierarchy
- ✅ **Collaborative**: Real-time updates across multiple users

### Technical Excellence:
- ✅ **Performance**: 60fps interactions with 1000+ tasks
- ✅ **Scalable**: Virtualized rendering prevents UI slowdown
- ✅ **Reliable**: Race condition prevention with optimistic updates
- ✅ **Maintainable**: Modular architecture with clear separation of concerns
- ✅ **Accessible**: Keyboard navigation and screen reader support

### Advanced Capabilities:
- ✅ **Cross-Channel**: Dependencies span multiple channels/projects  
- ✅ **Smart Scheduling**: Intelligent dependency-based rescheduling
- ✅ **Conflict Resolution**: Graceful handling of simultaneous edits
- ✅ **Data Persistence**: Column widths, view preferences, expanded states
- ✅ **Export Ready**: Architecture supports future PDF/Excel export

---

## Database Schema Utilization 📊

### Leveraging Existing Schema:
```sql
-- channel_tasks table is already perfectly designed for this
-- Key fields we'll utilize:
- id: Primary task identifier
- thread_id: Channel association (equivalent to projects)  
- parent_task_id: Task hierarchy support ✅
- dependencies: JSONB array for dependency relationships ✅
- start_date/end_date: Timeline positioning ✅
- assigned_to: Task ownership for permissions ✅
- status: Task state management ✅
- created_by: Creator permissions ✅

-- Additional indexes we may need:
CREATE INDEX IF NOT EXISTS idx_channel_tasks_hierarchy 
  ON channel_tasks(parent_task_id, thread_id);

CREATE INDEX IF NOT EXISTS idx_channel_tasks_timeline 
  ON channel_tasks(start_date, end_date, thread_id);
```

### Dependency Storage Format:
```json
{
  "dependencies": [
    {
      "task_id": "uuid-of-predecessor-task",
      "type": "FS" // FS, SS, FF, or SF
    },
    {
      "task_id": "another-task-uuid", 
      "type": "SS"
    }
  ]
}
```

This comprehensive plan transforms the basic ChannelTimeline.jsx into a sophisticated Gantt chart that matches the functionality and polish of your staging GV2.js implementation, while being fully adapted to work with the existing channel-based architecture and PostgreSQL schema.
