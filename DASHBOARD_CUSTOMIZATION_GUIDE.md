# Dashboard Customization Guide

## Overview

The Stellar Dev Dashboard now features a fully customizable widget-based layout system that allows users to personalize their dashboard experience with drag-and-drop functionality, resizable widgets, and persistent layouts.

## Features


### ✨ Core Features
- **Drag & Drop**: Rearrange widgets by dragging them to new positions
- **Resizable Widgets**: Resize widgets using the resize handle in edit mode
- **Persistent Layout**: Your dashboard layout is automatically saved and restored
- **Responsive Design**: Adapts to different screen sizes (mobile, tablet, desktop)
- **Widget Categories**: Organized widget selection by category
- **Edit Mode**: Toggle between view and edit modes for safety

### 🎛️ Available Widgets

#### Account Widgets
- **XLM Balance**: Display your XLM balance with USD estimates
- **Asset Holdings**: Show your non-native asset balances
- **Account Stats**: Display account details, sequence, signers, and security info

#### Activity Widgets
- **Recent Transactions**: Show your latest transactions with external links

#### Network Widgets
- **Network Stats**: Current network statistics (ledger, fees, timing)

#### Market Widgets
- **Price Ticker**: Live XLM price and market data (mainnet only)

#### Tool Widgets
- **Quick Actions**: Common tasks and shortcuts to other dashboard sections

## How to Use


### Basic Usage


1. **View Mode** (Default)
   - View your widgets in read-only mode
   - Interact with widget content normally
   - Click "Edit" button to enter edit mode


2. **Edit Mode**
   - **Drag & Drop**: Click and drag widgets to rearrange them
   - **Resize**: Use the resize handle (⤡) in the top-right corner of widgets
   - **Remove**: Click the × button to remove widgets
   - **Add Widgets**: Click "Add Widget" to open the widget selector


3. **Adding Widgets**
   - Click "Add Widget" in edit mode
   - Browse widgets by category (Account, Activity, Network, etc.)
   - Click on a widget to add it to your dashboard
   - Already added widgets are marked with a checkmark

4. **Reset Layout**
   - Click "Reset" in edit mode to restore the default layout
   - This will remove all customizations and return to the original setup

### Responsive Behavior

The dashboard automatically adapts to different screen sizes:

- **Desktop**: 3-column grid with full functionality
- **Tablet**: 2-column grid with touch-optimized controls
- **Mobile**: 1-column grid with always-visible controls

### Persistence

Your dashboard layout is automatically saved to browser storage and will be restored when you return to the application. This includes:
- Widget positions and order
- Widget sizes (if resized)
- Which widgets are added or removed

## Widget Development

### Creating New Widgets

To create a new widget, follow this structure:

```jsx
import WidgetBase from './WidgetBase';

export default function MyCustomWidget({ onRefresh }) {
  return (
    <WidgetBase
      title="My Widget"
      subtitle="Widget description"
      icon="🎯"
      onRefresh={onRefresh}
      loading={false}
    >
      {/* Your widget content here */}
    </WidgetBase>
  );
}
```

### Widget Base Props

The `WidgetBase` component provides common functionality:

- `title`: Widget title displayed in header
- `subtitle`: Optional subtitle text
- `icon`: Emoji or icon for the widget
- `onRefresh`: Callback for refresh button
- `loading`: Show loading state
- `error`: Show error state
- `headerActions`: Custom header buttons
- `contentPadding`: Whether to add padding to content (default: true)

### Adding to Widget Selector

1. Import your widget in `WidgetSelector.jsx`
2. Add it to the `AVAILABLE_WIDGETS` object:

```javascript
myWidget: {
  id: 'myWidget',
  name: 'My Widget',
  description: 'What this widget does',
  icon: '🎯',
  component: MyCustomWidget,
  defaultSize: { width: 300, height: 250 },
  category: 'tools'
}
```

3. Update the `getWidgetComponent` function in `Overview.jsx`

## Technical Implementation

### Architecture

- **DashboardGrid**: Core grid system with drag-and-drop functionality
- **WidgetBase**: Base component providing common widget functionality
- **WidgetSelector**: Modal for adding new widgets
- **Individual Widgets**: Specific widget implementations
- **Persistence**: Uses `usePersistedState` hook with IndexedDB storage

### Key Components

1. **DashboardGrid.jsx**: Handles layout, drag-and-drop, and resizing
2. **WidgetBase.jsx**: Provides consistent widget styling and behavior
3. **WidgetSelector.jsx**: Widget selection modal with categories
4. **Overview.jsx**: Main dashboard component orchestrating the system

### Responsive Grid System

The grid system uses CSS Grid with responsive column counts:
- Mobile: 1 column
- Tablet: 2 columns  
- Desktop: 3 columns

Widgets can span multiple columns using the `span` property.

## Styling

### CSS Custom Properties

The widget system uses CSS custom properties for consistent theming:

```css
--bg-card: Widget background color
--border: Widget border color
--cyan: Primary accent color
--transition: Standard transition timing
```

### Widget States

- **Default**: Normal widget appearance
- **Hover**: Highlighted border and controls visibility
- **Dragging**: Reduced opacity during drag
- **Resizing**: Highlighted resize border
- **Loading**: Spinner overlay
- **Error**: Error state with retry option

## Best Practices

### Widget Design
- Keep widgets focused on a single purpose
- Use consistent iconography and colors
- Provide loading and error states
- Make content responsive within the widget
- Use the WidgetBase component for consistency

### Performance
- Widgets should handle their own data fetching
- Use React.memo for expensive widgets
- Implement proper cleanup in useEffect hooks
- Avoid heavy computations in render methods

### Accessibility
- Ensure keyboard navigation works in edit mode
- Provide proper ARIA labels for drag handles
- Use semantic HTML within widgets
- Test with screen readers

## Troubleshooting

### Common Issues

1. **Widget not appearing**: Check if it's added to AVAILABLE_WIDGETS and getWidgetComponent
2. **Drag not working**: Ensure editable prop is true on DashboardGrid
3. **Layout not persisting**: Check browser storage permissions
4. **Responsive issues**: Test grid column configuration for different breakpoints

### Debug Mode

Enable debug logging by adding this to your widget:

```javascript
console.log('Widget rendered:', { props, state });
```

## Future Enhancements

Potential improvements for the widget system:

- **Widget Configuration**: Allow users to configure widget settings
- **Import/Export**: Share dashboard layouts between users
- **Widget Marketplace**: Community-contributed widgets
- **Advanced Layouts**: Support for complex grid layouts
- **Widget Themes**: Per-widget color themes
- **Performance Monitoring**: Widget performance metrics
- **Keyboard Shortcuts**: Hotkeys for common actions

## Support

For issues or questions about the dashboard customization system:

1. Check this guide for common solutions
2. Review the component source code
3. Test in different browsers and screen sizes
4. Check browser console for error messages

The customizable dashboard system provides a powerful and flexible way to personalize the Stellar Dev Dashboard experience while maintaining performance and accessibility standards.