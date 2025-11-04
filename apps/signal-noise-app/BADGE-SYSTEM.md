# Badge System Documentation

## Overview

The badge system provides a comprehensive solution for managing and displaying entity badges across your frontend application. It supports automatic badge mapping, fallback handling, caching, and easy integration with existing components.

## Features

- **Automatic Badge Mapping**: Intelligently maps entities to their badge images
- **Multiple Badge Sources**: Support for TheSportsDB, local files, and custom badges
- **Fallback Handling**: Graceful fallbacks to initials or icons when badges aren't available
- **Caching**: Built-in caching for improved performance
- **Size Variants**: Small, medium, and large badge sizes
- **TypeScript Support**: Full type safety and IntelliSense
- **Responsive Design**: Mobile-friendly components
- **Easy Integration**: Works seamlessly with existing EntityCard component

## Quick Start

### Basic Usage

```tsx
import { EntityBadge } from '@/components/badge'

function MyComponent() {
  const entity = {
    id: '133602',
    name: 'Manchester United',
    labels: ['Club'],
    properties: { name: 'Manchester United' }
  }

  return <EntityBadge entity={entity} />
}
```

### Compact Badge

```tsx
import { CompactEntityBadge } from '@/components/badge'

<CompactEntityBadge entity={entity} size="sm" />
```

### Badge Grid

```tsx
import { EntityBadgeGrid } from '@/components/badge'

<EntityBadgeGrid 
  entities={entities} 
  size="md"
  maxItems={12}
/>
```

## Components

### EntityBadge

The main badge component with full features:

```tsx
interface BadgeComponentProps {
  entity: {
    id: string | number
    name: string
    labels: string[]
    properties: Record<string, any>
  }
  size?: 'sm' | 'md' | 'lg'
  className?: string
  showFallback?: boolean
  onClick?: () => void
}
```

**Features:**
- Automatic badge lookup and loading
- Loading states with spinner
- Error handling with fallbacks
- Entity type detection (club, league, organization, event)
- Type-specific icons and colors
- Click handlers for interactivity

### CompactEntityBadge

Lightweight version for lists and compact layouts:

```tsx
<CompactEntityBadge 
  entity={entity} 
  size="sm"
  onClick={() => console.log('Badge clicked')}
/>
```

### EntityBadgeGrid

Grid layout for displaying multiple entities:

```tsx
<EntityBadgeGrid 
  entities={entities}
  size="md"
  maxItems={12}
  className="my-4"
/>
```

## Services

### BadgeService

Core service for badge management:

```tsx
import { badgeService } from '@/services/badge-service'

// Get badge mapping
const mapping = await badgeService.getBadgeForEntity('133602', 'Manchester United')

// Get badge URL
const url = badgeService.getBadgeUrl(mapping, 'md')

// Get entity initials
const initials = badgeService.getEntityInitials('Manchester United')

// Get entity type
const type = badgeService.getEntityType(['Club'])
```

### BadgeManager

Persistent storage and configuration management:

```tsx
import { badgeManager } from '@/services/badge-manager'

// Add new mapping
badgeManager.addOrUpdateMapping({
  entityId: 'new-id',
  entityName: 'New Entity',
  badgePath: '/badges/new-entity-badge.png',
  source: 'local'
})

// Get all mappings
const allMappings = badgeManager.getAllMappings()

// Export/Import mappings
const exportData = badgeManager.exportMappings()
badgeManager.importMappings(exportData)
```

## Configuration

### Badge Configurations

Define badge configurations in `src/config/badge-config.ts`:

```tsx
export const BADGE_CONFIGS: Record<string, BadgeConfig> = {
  'manchester-united': {
    id: 'manchester-united',
    name: 'Manchester United',
    entityType: 'club',
    category: 'sports',
    defaultSize: 'md'
  }
}
```

### Service Configuration

Configure the badge service behavior:

```tsx
const badgeService = new BadgeService({
  baseUrl: '/badges',
  fallbackMode: 'initials',
  enableCaching: true,
  cacheTTL: 3600000 // 1 hour
})
```

## Integration Examples

### Enhanced EntityCard

The existing EntityCard component has been enhanced to include badges:

```tsx
// Before: Plain text header
<CardHeader>
  <CardTitle>{entity.properties.name}</CardTitle>
</CardHeader>

// After: Badge integration
<CardHeader>
  <div className="flex items-start gap-4">
    <EntityBadge entity={entity} size="lg" />
    <div className="flex-1">
      <CardTitle>{entity.properties.name}</CardTitle>
      {/* ... other content */}
    </div>
  </div>
</CardHeader>
```

### Dashboard Integration

Add badge management to your admin dashboard:

```tsx
import { BadgeManagementDashboard } from '@/components/badge/BadgeManagementDashboard'

function AdminDashboard() {
  return (
    <div>
      <BadgeManagementDashboard />
    </div>
  )
}
```

## Badge Storage

### File Structure

```
badges/
├── manchester-united-badge.png
├── sao-paulo-badge.png
├── premier-league-badge.png
├── indian-premier-league-badge.png
├── australian-football-league-badge.png
└── placeholder-badge.png
```

### Naming Convention

- Use format: `[entity-name]-badge.png`
- Replace spaces with hyphens
- Use lowercase letters
- Example: `manchester-united-badge.png`

## Fallback System

### Fallback Types

1. **Initials**: Entity initials with colored background
2. **Icon**: Type-specific icon (club, league, etc.)
3. **Placeholder**: Generic placeholder image

### Type Detection

The system automatically detects entity types:

- **Club**: Teams, sports clubs (blue theme, users icon)
- **League**: Sports leagues, competitions (yellow theme, trophy icon)
- **Event**: Matches, events (green theme, shield icon)
- **Organization**: Companies, organizations (gray theme, building icon)

## API Reference

### Types

```tsx
interface BadgeMapping {
  entityId: string | number
  entityName: string
  badgePath: string
  badgeUrl?: string
  lastUpdated: string
  source: 'thesportsdb' | 'local' | 'custom'
}

interface BadgeConfig {
  id: string
  name: string
  entityType: 'club' | 'league' | 'organization' | 'event'
  category: 'sports' | 'business' | 'technology' | 'other'
  fallbackIcon?: string
  defaultSize?: 'sm' | 'md' | 'lg'
}
```

### Hooks

The system is designed to work without hooks, but you can create custom hooks:

```tsx
function useBadge(entityId: string, entityName: string) {
  const [mapping, setMapping] = useState<BadgeMapping | null>(null)
  
  useEffect(() => {
    getBadgeForEntity(entityId, entityName).then(setMapping)
  }, [entityId, entityName])
  
  return mapping
}
```

## Performance Considerations

- **Caching**: Badges are cached for 1 hour by default
- **Image Optimization**: Uses Next.js Image component for optimization
- **Lazy Loading**: Images are loaded only when needed
- **Error Boundaries**: Graceful handling of missing images

## Browser Support

- Modern browsers with ES6+ support
- Requires `localStorage` for persistent mappings
- Image loading uses modern browser APIs

## Contributing

### Adding New Badges

1. Download badge image to `/badges/` directory
2. Follow naming convention: `[name]-badge.png`
3. Add mapping to badge service
4. Test with different entity types

### Adding New Entity Types

1. Update type definitions in `src/types/badge.ts`
2. Add icon mapping in `EntityBadge` component
3. Update color schemes if needed
4. Add configuration options

## Troubleshooting

### Common Issues

**Badge not showing:**
- Check if badge file exists in `/badges/` directory
- Verify file naming convention
- Check browser console for errors

**Fallback showing instead of badge:**
- Verify badge URL is accessible
- Check image file format (should be PNG)
- Clear browser cache

**Performance issues:**
- Check caching configuration
- Verify image sizes (optimize if necessary)
- Monitor network requests

### Debug Mode

Enable debug logging:

```tsx
const badgeService = new BadgeService({
  debug: true
})
```

## Examples

See `src/components/badge/BadgeUsageExamples.tsx` for comprehensive usage examples and integration patterns.