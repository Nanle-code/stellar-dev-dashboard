# Interactive Tutorial System Guide

## Overview

The Stellar Dev Dashboard now features a comprehensive interactive tutorial system designed to onboard new users and teach them all dashboard features through engaging, step-by-step guided tours.

## Features

### 🎯 7 Interactive Tutorials

1. **Welcome to Stellar Dashboard** (3 min, Beginner)
   - Connect wallet or enter public key
   - Switch between networks (Testnet/Mainnet)
   - Navigate the sidebar
   - View account overview

2. **Building & Signing Transactions** (5 min, Intermediate)
   - Use the transaction builder
   - Sign transactions with wallets
   - Simulate before submitting

3. **Soroban Smart Contracts** (7 min, Advanced)
   - Enter contract addresses
   - Browse contract ABIs
   - Invoke contract functions

4. **Decentralized Exchange (DEX)** (6 min, Intermediate)
   - Explore order books
   - View spreads and depth charts
   - Use path payment finder

5. **Portfolio Analytics** (4 min, Beginner)
   - View USD portfolio value
   - Analyze asset breakdown
   - Compare multiple accounts

6. **Setting Up Alerts** (5 min, Intermediate)
   - Create custom alert rules
   - Configure thresholds and frequencies
   - Manage notifications

7. **Wallet Integration** (4 min, Beginner)
   - Connect Freighter wallet
   - Use Ledger hardware wallet
   - Understand security best practices

### 📹 Video Walkthroughs

Each tutorial includes:
- Embedded video walkthrough link
- Step-by-step visual guides
- Real-time demonstrations
- Best practices and tips

### 📊 Progress Tracking

- **Overall Completion**: Track percentage of completed tutorials
- **Category Progress**: Monitor progress by feature category
- **Time Tracking**: See time spent on each tutorial
- **Step Persistence**: Resume tutorials where you left off

### 🏆 Achievement System

Earn achievements for completing tutorials:
- **Getting Started** 🎉 - Complete your first tutorial
- **Transaction Builder** ⚡ - Master transaction building
- **Contract Expert** 🎓 - Learn Soroban contracts
- **DEX Trader** 📈 - Explore the DEX
- **Tour Master** 🏆 - Complete all tutorials

### ✨ Interactive Elements

- **Spotlight Highlighting**: Target elements pulse with visual focus
- **Smart Positioning**: Tooltips automatically position for best visibility
- **Interactive Hints**: Pro tips and actionable guidance
- **Prerequisites**: Locked tours until prerequisites are met
- **Smooth Animations**: Engaging transitions and effects

## Usage

### For Users

#### Starting a Tutorial

1. Click the floating help button (📚) in the bottom-right corner
2. Browse available tutorials by category
3. Click "Start" on any unlocked tutorial
4. Follow the step-by-step guided tour

#### Viewing Progress

1. Click the help button to open the tutorial panel
2. See your overall completion percentage in the progress ring
3. View completed tutorials marked with a checkmark
4. Check category-specific progress

#### Watching Videos

1. Open the tutorial panel
2. Video links appear on the first step of each tour
3. Click "Watch Video Tutorial" to open in a new tab
4. Videos are hosted on Vimeo for reliable streaming

#### Tracking Achievements

1. Click the trophy icon (🏆) in the tutorial panel
2. View all earned achievements
3. See which achievements are still available

### For Developers

#### Adding New Tutorials

Edit `src/lib/tutorialSystem.js` and add to the `TOURS` object:

```javascript
'new-feature': {
  id: 'new-feature',
  title: 'Feature Name',
  description: 'Brief description',
  category: 'Category Name',
  estimatedTime: '5 min',
  difficulty: 'beginner', // or 'intermediate', 'advanced'
  videoUrl: 'https://player.vimeo.com/video/YOUR_VIDEO_ID',
  thumbnail: '🎨', // emoji icon
  prerequisites: ['welcome'], // optional, array of prerequisite tour IDs
  steps: [
    {
      id: 'step-1',
      target: '[data-tour="element-selector"]',
      title: 'Step Title',
      content: 'Step description explaining what to do',
      placement: 'bottom', // or 'top', 'left', 'right'
      action: 'Try clicking the button',
      interactiveHint: 'Pro tip: This is a helpful hint',
    },
    // Add more steps...
  ],
}
```

#### Adding Tour Targets to Components

Add `data-tour` attributes to elements you want to highlight:

```jsx
<button data-tour="my-feature-button">
  Click Me
</button>
```

#### Adding Contextual Help

Add help topics to the `HELP_ENTRIES` object in `tutorialSystem.js`:

```javascript
'new-concept': {
  title: 'Concept Name',
  content: 'Detailed explanation of the concept',
  learnMore: 'https://link-to-documentation',
}
```

#### Creating New Achievements

Add to the `ACHIEVEMENTS` object in `tutorialSystem.js`:

```javascript
'new-achievement': {
  id: 'new-achievement',
  title: 'Achievement Name',
  description: 'How to earn this achievement',
  icon: '🎖️',
}
```

Then add logic in `tutorialSystem.checkAchievements()` to award it:

```javascript
if (/* condition */) {
  achievements.push('new-achievement');
}
```

## Components

### TourLauncher

The main floating button and tutorial browser panel.

**Props**: None (self-contained)

**Features**:
- Category filtering
- Progress display
- Achievement showcase
- Recommended next tour
- Tour reset functionality

### GuidedTour

Renders the spotlight overlay and manages tour state.

**Props**:
- `tourId`: string - ID of the tour to display
- `onClose`: function - Called when tour ends

**Features**:
- Target element highlighting
- Automatic scrolling
- Step persistence
- Timer tracking

### TourTooltip

The step tooltip with content and navigation.

**Props**:
- `step`: object - Current step data
- `stepIndex`: number - Current step index
- `totalSteps`: number - Total steps in tour
- `position`: object - Tooltip position
- `onNext`: function - Next step handler
- `onPrev`: function - Previous step handler
- `onSkip`: function - Skip tour handler
- `tour`: object - Tour metadata

**Features**:
- Progress bar
- Video link (first step)
- Interactive hints
- Action prompts
- Navigation controls

### VideoTutorialLibrary

Browse and search all video tutorials.

**Props**:
- `onClose`: function - Called when closed

**Features**:
- Search functionality
- Category filtering
- Difficulty filtering
- Grid layout
- Completion badges

### ProgressDashboard

Detailed progress tracking and statistics.

**Props**:
- `onClose`: function - Called when closed

**Features**:
- Overall completion stats
- Achievement display
- Category progress
- Time tracking
- Completed tutorial list

## Data Storage

All tutorial state is stored in `localStorage`:

- `tutorial_state`: Completion status, step positions, timers
- `tutorial_progress`: Progress percentages per tour
- `tutorial_achievements`: List of earned achievement IDs

## API Reference

### tutorialSystem

```javascript
// Core methods
tutorialSystem.getTour(tourId)
tutorialSystem.getTours()
tutorialSystem.getToursByCategory(category)
tutorialSystem.getCategories()

// Progress tracking
tutorialSystem.isCompleted(tourId)
tutorialSystem.complete(tourId)
tutorialSystem.getProgress(tourId)
tutorialSystem.getOverallProgress()

// Step management
tutorialSystem.getSavedStep(tourId)
tutorialSystem.saveStep(tourId, stepIndex)

// Achievements
tutorialSystem.getAchievements()
tutorialSystem.checkAchievements()

// Recommendations
tutorialSystem.getRecommendedTour()

// Time tracking
tutorialSystem.startTimer(tourId)
tutorialSystem.stopTimer(tourId)
tutorialSystem.getDuration(tourId)

// Reset
tutorialSystem.reset(tourId)
tutorialSystem.resetAll()

// Help
tutorialSystem.getHelp(topic)
tutorialSystem.getAllHelp()

// First visit detection
tutorialSystem.isFirstVisit()
```

## Styling

The tutorial system uses CSS custom properties for theming:

```css
--accent: Primary accent color (buttons, progress)
--accent-bright: Lighter accent shade
--bg-card: Card background
--bg-secondary: Secondary background
--border: Border color
--text-primary: Primary text color
--text-secondary: Secondary text color
--text-muted: Muted text color
```

## Accessibility

- **Keyboard Navigation**: Full keyboard support
- **ARIA Labels**: Proper labeling for screen readers
- **Focus Management**: Appropriate focus states
- **Color Contrast**: WCAG AA compliant colors
- **Screen Reader Announcements**: Important actions announced

## Best Practices

### Tutorial Design

1. **Keep steps concise**: 3-5 steps per tutorial is ideal
2. **Clear titles**: Use action-oriented step titles
3. **Progressive difficulty**: Start simple, build complexity
4. **Real examples**: Use actual features, not mockups
5. **Provide context**: Explain why, not just how

### Target Selection

1. **Stable selectors**: Use `data-tour` attributes, not classes
2. **Visible elements**: Target elements that are always visible
3. **Interactive elements**: Highlight buttons, inputs, links
4. **Proper spacing**: Ensure tooltips have room to display

### Video Content

1. **Short and focused**: 2-5 minutes per video
2. **High quality**: Minimum 1080p resolution
3. **Captions**: Include closed captions for accessibility
4. **Professional audio**: Clear narration without background noise
5. **Consistent branding**: Use dashboard theme colors

## Future Enhancements

Potential additions to the tutorial system:

- [ ] Interactive quizzes after each tutorial
- [ ] Certificate generation for completed tutorials
- [ ] Multi-language support
- [ ] Tutorial playlists for learning paths
- [ ] User feedback and ratings
- [ ] Export progress reports
- [ ] Tutorial creation wizard for admins
- [ ] Integration with user profiles
- [ ] Gamification with points and levels
- [ ] Tutorial challenges and competitions

## Troubleshooting

### Tour not starting

- Check that the target element has the correct `data-tour` attribute
- Verify the element is visible in the DOM
- Ensure no modal or overlay is blocking the element

### Progress not saving

- Check browser localStorage is enabled
- Verify no browser extensions are blocking storage
- Check for localStorage quota errors in console

### Video not loading

- Verify video URL is correct and accessible
- Check network connectivity
- Ensure Vimeo is not blocked by firewall

### Performance issues

- Reduce number of active animations
- Check for memory leaks with React DevTools
- Profile component renders with Performance tab

## Support

For questions or issues:
- Open an issue on GitHub
- Check existing documentation
- Review the code comments
- Contact the development team

## License

This tutorial system is part of the Stellar Dev Dashboard project and is licensed under the MIT License.
