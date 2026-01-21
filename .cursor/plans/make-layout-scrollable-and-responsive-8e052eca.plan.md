<!-- 8e052eca-52de-44ae-8fdc-ae84f33edb2a 0d444c98-3833-4cd7-85e9-7748781c5527 -->
# Full-Screen Layout Minus Sidebar with Scrollable Background

## Current State Analysis

**Current Layout (`index.html`):**

- Fixed background container (`position: fixed`) covering full viewport
- Centered content with `height: 100vh` constraint
- `overflow: hidden` prevents scrolling
- Background SVG with yellow (#FDEE00) background color

**Target Layout:**

- Full-screen content area minus sidebar (256px left margin)
- Scrollable background that extends with content
- Width-responsive, height-scrollable
- Background visible through transparent container

## Changes Required

### File: `apps/signal-noise-app/new-ui/style.css`

1. **Enable scrolling on body/html**

- Change `overflow: hidden` to `overflow-x: hidden; overflow-y: auto`
- Remove `height: 100%` constraint to allow natural document flow

2. **Make background scrollable and full-width**

- Change `.background-container` from `position: fixed` to `position: absolute`
- Change from `width: 100vw; height: 100vh` to `width: 100%; min-height: 100vh`
- Set `top: 0; left: 0` to anchor at top-left
- Keep `z-index: -1` to stay behind content
- Ensure SVG scales properly: `width: 100%; height: auto; min-height: 100vh`

3. **Create full-screen container layout**

- Add `.fullscreen-container` class:
- `padding: 1.5rem` (equivalent to `p-6`)
- `margin-left: 16rem` (equivalent to `ml-64` = 256px for sidebar)
- `background: transparent`
- `min-height: 100vh` to ensure full viewport height
- `width: calc(100% - 16rem)` to account for sidebar
- `transition: margin-left 1200ms cubic-bezier(0.37, 0, 0.63, 1)` for smooth transitions
- Add `.fullscreen-content` wrapper for inner content with proper spacing

4. **Update existing content styles**

- Modify `.content` to work within new container structure
- Remove fixed `height: 100vh` constraint
- Allow natural content flow and scrolling

5. **Add responsive considerations**

- Ensure container adapts on smaller screens
- Consider sidebar collapse state (optional: add collapsed margin variant)

### File: `apps/signal-noise-app/new-ui/index-alternative.html` (NEW)

Create new alternative HTML file demonstrating the layout:

- Same background SVG structure from `index.html`
- Full-screen container div with proper classes
- Sample mailbox/inbox content structure:
- Navigation sidebar area (visual placeholder)
- Main content area with email list structure
- Multiple content sections to demonstrate scrolling
- Link to same CSS file
- Include sample content that extends beyond viewport to show scrolling

## Implementation Details

- Background scrolls naturally with page content (not fixed)
- Content area takes full width minus 256px sidebar space
- Background remains visible through transparent container
- Width responsive: container adjusts to viewport width minus sidebar
- Height scrollable: content can extend beyond viewport
- Maintains existing SVG background pattern and yellow (#FDEE00) color scheme
- Smooth transitions for sidebar state changes