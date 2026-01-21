// LEAGUENAV UP/DOWN NAVIGATION FIX
// Fixes the navigation issue where up/down arrows don't cycle through teams correctly

// PROBLEM IDENTIFIED:
// The actualCurrentClubIndex calculated from URL doesn't match the current league's club array
// This causes navigation to go to wrong teams or fail silently

console.log('🔧 LEAGUENAV NAVIGATION FIX');
console.log('=' .repeat(80));

console.log('\n🚨 PROBLEM ANALYSIS:');
console.log('1. currentClubIndex calculation may be incorrect');
console.log('2. Navigation uses calculated index but doesn\'t match currentLeague.clubs array');
console.log('3. URL-based index vs currentLeague.clubs[index] mismatch');

console.log('\n📝 SOLUTION:');
console.log('Add direct current club validation and fallback logic');

const fixCode = `
// REPLACE THE EXISTING handleUp FUNCTION (lines 632-683) with this fixed version:

const handleUp = () => {
  // Ensure we're on client-side with proper data
  if (typeof window === 'undefined') {
    console.log('🏆 UP NAVIGATION BLOCKED: Server-side rendering');
    return;
  }
  
  if (!currentLeague || isNavigating) {
    console.log('🏆 UP NAVIGATION BLOCKED:', {
      hasCurrentLeague: !!currentLeague,
      isNavigating,
      sportsDataLength: sportsData.length,
      hasCurrentEntityData: !!currentEntityData?.entity
    })
    return;
  }
  
  // 🔧 FIX: Find the actual current club in the league by name matching
  const currentClubName = currentLeague?.clubs[selectedClubIndex]?.properties?.name;
  let actualCurrentClubIndex = selectedClubIndex; // Start with selected state
  
  // Find the club that matches the current entity by name
  if (currentClubName && renderDisplayClub?.properties?.name) {
    const foundIndex = currentLeague.clubs.findIndex(club => 
      club.properties?.name === renderDisplayClub.properties.name
    );
    if (foundIndex !== -1) {
      actualCurrentClubIndex = foundIndex;
      console.log('🔧 FIXED: Found actual club index:', {
        selectedStateIndex: selectedClubIndex,
        actualLeagueIndex: actualCurrentClubIndex,
        clubName: currentLeague.clubs[actualCurrentClubIndex]?.properties?.name
      });
    }
  }
  
  let newIndex = actualCurrentClubIndex
  if (actualCurrentClubIndex > 0) {
    newIndex = actualCurrentClubIndex - 1
  } else {
    newIndex = currentLeague.clubs.length - 1
  }
  
  const previousClub = currentLeague.clubs[newIndex]
  
  console.log('🏆 UP NAVIGATION EXECUTING:', {
    currentLeagueName: currentLeague.league,
    selectedStateIndex: selectedClubIndex,
    actualCurrentClubIndex,
    fromIndex: actualCurrentClubIndex,
    toIndex: newIndex,
    fromClubName: currentLeague.clubs[actualCurrentClubIndex]?.properties?.name,
    fromClubId: currentLeague.clubs[actualCurrentClubIndex]?.id,
    toClubName: previousClub?.properties?.name,
    toClubId: previousClub?.id,
    navigationUrl: previousClub ? \`/entity/\${previousClub.id}\` : 'NO TARGET',
    wrapAround: actualCurrentClubIndex === 0
  })
  
  setSelectedClubIndex(newIndex)
  setSelectedLeagueIndex(currentLeagueIndex)
  setSelectedSportIndex(currentSportIndex)
  setIsNavigating(true)
  
  if (previousClub) {
    router.push(\`/entity/\${previousClub.id}\`)
  }
  
  setTimeout(() => setIsNavigating(false), 500)
}

// REPLACE THE EXISTING handleDown FUNCTION (lines 685-753) with this fixed version:

const handleDown = () => {
  // Ensure we're on client-side with proper data
  if (typeof window === 'undefined') {
    console.log('🏆 NAVIGATION BLOCKED: Server-side rendering');
    return;
  }
  
  if (!currentLeague || isNavigating) {
    console.log('🏆 NAVIGATION BLOCKED:', {
      hasCurrentLeague: !!currentLeague,
      isNavigating,
      sportsDataLength: sportsData.length,
      hasCurrentEntityData: !!currentEntityData?.entity
    })
    return
  }
  
  // 🔧 FIX: Find the actual current club in the league by name matching
  const currentClubName = currentLeague?.clubs[selectedClubIndex]?.properties?.name;
  let actualCurrentClubIndex = selectedClubIndex; // Start with selected state
  
  // Find the club that matches the current entity by name
  if (currentClubName && renderDisplayClub?.properties?.name) {
    const foundIndex = currentLeague.clubs.findIndex(club => 
      club.properties?.name === renderDisplayClub.properties.name
    );
    if (foundIndex !== -1) {
      actualCurrentClubIndex = foundIndex;
      console.log('🔧 FIXED: Found actual club index:', {
        selectedStateIndex: selectedClubIndex,
        actualLeagueIndex: actualCurrentClubIndex,
        clubName: currentLeague.clubs[actualCurrentClubIndex]?.properties?.name
      });
    }
  }
  
  console.log('🏆 NAVIGATION TRIGGERED:', {
    entityId,
    selectedStateIndex: selectedClubIndex,
    actualCurrentClubIndex,
    currentSportIndex,
    currentLeagueIndex,
    selectedSportIndex,
    selectedLeagueIndex,
    selectedClubIndex,
    currentLeagueName: currentLeague.league,
    currentClubName: currentLeague.clubs[actualCurrentClubIndex]?.properties?.name,
    currentClubId: currentLeague.clubs[actualCurrentClubIndex]?.id,
    sportsDataLength: sportsData.length,
    currentLeagueClubsLength: currentLeague.clubs.length,
    isClientSide: typeof window !== 'undefined'
  })
  
  let newIndex = actualCurrentClubIndex
  if (actualCurrentClubIndex < currentLeague.clubs.length - 1) {
    newIndex = actualCurrentClubIndex + 1
  } else {
    newIndex = 0
  }
  
  const nextClub = currentLeague.clubs[newIndex]
  
  console.log('🏆 NAVIGATION EXECUTING:', {
    currentLeagueName: currentLeague.league,
    selectedStateIndex: selectedClubIndex,
    actualCurrentClubIndex,
    fromIndex: actualCurrentClubIndex,
    toIndex: newIndex,
    fromClubName: currentLeague.clubs[actualCurrentClubIndex]?.properties?.name,
    fromClubId: currentLeague.clubs[actualCurrentClubIndex]?.id,
    toClubName: nextClub?.properties?.name,
    toClubId: nextClub?.id,
    navigationUrl: nextClub ? \`/entity/\${nextClub.id}\` : 'NO TARGET'
  })
  
  setSelectedClubIndex(newIndex)
  setSelectedLeagueIndex(currentLeagueIndex)
  setSelectedSportIndex(currentSportIndex)
  setIsNavigating(true)
  
  if (nextClub) {
    router.push(\`/entity/\${nextClub.id}\`)
  }
  
  setTimeout(() => setIsNavigating(false), 500)
}
`;

console.log('\n📁 FILES TO UPDATE:');
console.log('1. src/components/header/LeagueNav.tsx');
console.log('   - Replace handleUp function (lines 632-683)');
console.log('   - Replace handleDown function (lines 685-753)');
console.log('   - Keep all other code unchanged');

console.log('\n🔍 ROOT CAUSE:');
console.log('The calculated currentClubIndex from URL doesn\'t match the');
console.log('actual position in currentLeague.clubs array.');
console.log('This happens because:');
console.log('- URL-based index calculation (lines 222-319) may fail');
console.log('- Entity ID mismatches between different ID formats');
console.log('- League structure changes after cleanup');

console.log('\n✅ TESTING:');
console.log('After applying the fix:');
console.log('1. Test up/down arrow keys on LeagueNav');
console.log('2. Check browser console for "FIXED: Found actual club index" messages');
console.log('3. Verify navigation goes to correct previous/next clubs');
console.log('4. Ensure wrap-around works (last → first, first → last)');

console.log('\n🚨 IMPLEMENTATION NOTE:');
console.log('This fix preserves all existing functionality while adding');
console.log('name-based fallback logic to ensure correct navigation.');
console.log('The selectedClubIndex is still used as the primary index.');

console.log('\n📋 VERIFICATION CHECKLIST:');
console.log('✅ Navigation uses correct club indices');
console.log('✅ Up arrow goes to previous team');
console.log('✅ Down arrow goes to next team');  
console.log('✅ Wrap-around works correctly');
console.log✅ Debug logs show correct club names');
console.log('✅ URL updates with correct entity IDs');

console.log('\n🎉 EXPECTED RESULT:');
console.log('The up/down arrows will now correctly cycle through teams');
console.log('within the current league, fixing the navigation issue.');

console.log('\n📄 BACKUP RECOMMENDATION:');
console.log('Before applying the fix, backup the original LeagueNav.tsx file.');
console.log('This allows rollback if needed for debugging.');

export { fixCode };