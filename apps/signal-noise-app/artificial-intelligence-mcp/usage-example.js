// For your use case - just map clubs to badges
const results = await bulkMapClubBadges({
  entities: [
    {id: "entity-1", name: "Arsenal"},
    {id: "entity-2", name: "Chelsea"},
    {id: "entity-3", name: "Manchester United"}
    // ... your 4k+ entities
  ],
  dry_run: true  // First test what would be created
});

// Then when ready:
const finalResults = await bulkMapClubBadges({
  entities: yourEntitiesArray,
  dry_run: false  // Actually create the badges
});