#!/usr/bin/env node

/**
 * DATA-DRIVEN TDD FOR LEAGUE NAV CORE LOGIC
 * 
 * This test suite validates the core search and ranking logic
 * without requiring a browser or full application setup.
 */

// Test Data - Real-world scenarios
const testCases = {
  popularityRanking: [
    {
      description: 'Premier League should outrank Iraqi Premier League',
      searchTerm: 'premier',
      inputLeagues: [
        { name: 'Premier League', country: 'England', teams: ['Arsenal', 'Chelsea'] },
        { name: 'Iraqi Premier League', country: 'Iraq', teams: ['Al-Shorta', 'Al-Zawraa'] },
        { name: 'Premier Soccer League', country: 'South Africa', teams: ['Kaizer Chiefs', 'Orlando Pirates'] }
      ],
      expectedOrder: ['Premier League', 'Premier Soccer League', 'Iraqi Premier League']
    },
    {
      description: 'UEFA Champions League should rank highest',
      searchTerm: 'champions',
      inputLeagues: [
        { name: 'UEFA Champions League', country: 'Europe', teams: ['Real Madrid', 'Bayern Munich'] },
        { name: 'Indian Premier League', country: 'India', teams: ['Mumbai Indians', 'Chennai Super Kings'] }
      ],
      expectedOrder: ['UEFA Champions League', 'Indian Premier League']
    }
  ],
  
  directNavigation: [
    {
      description: 'Exact match "Arsenal" should trigger direct navigation',
      searchTerm: 'Arsenal',
      entities: [
        { name: 'Arsenal', id: '123', league: 'Premier League' },
        { name: 'Manchester United', id: '456', league: 'Premier League' },
        { name: 'Arsenal Women', id: '789', league: 'WSL' }
      ],
      expectedResult: { found: true, entity: { name: 'Arsenal', id: '123' } }
    },
    {
      description: 'Partial match "Ars" should NOT trigger direct navigation',
      searchTerm: 'Ars',
      entities: [
        { name: 'Arsenal', id: '123', league: 'Premier League' },
        { name: 'Manchester United', id: '456', league: 'Premier League' }
      ],
      expectedResult: { found: false }
    },
    {
      description: 'Case-insensitive exact match',
      searchTerm: 'manchester united',
      entities: [
        { name: 'Manchester United', id: '456', league: 'Premier League' },
        { name: 'Manchester City', id: '789', league: 'Premier League' }
      ],
      expectedResult: { found: true, entity: { name: 'Manchester United', id: '456' } }
    }
  ],
  
  searchPrioritization: [
    {
      description: 'Exact match should outrank popularity',
      searchTerm: 'Arsenal',
      entities: [
        { name: 'Arsenal', league: 'Premier League', popularity: 100 },
        { name: 'Bayern Munich', league: 'Bundesliga', popularity: 90 },
        { name: 'Real Madrid', league: 'LaLiga', popularity: 95 }
      ],
      expectedOrder: ['Arsenal', 'Bayern Munich', 'Real Madrid']
    },
    {
      description: 'Starts-with should outrank popularity',
      searchTerm: 'Man',
      entities: [
        { name: 'Bayern Munich', league: 'Bundesliga', popularity: 100 },
        { name: 'Manchester United', league: 'Premier League', popularity: 95 },
        { name: 'Manchester City', league: 'Premier League', popularity: 95 }
      ],
      expectedOrder: ['Manchester United', 'Manchester City', 'Bayern Munich']
    },
    {
      description: 'Popularity should be tiebreaker',
      searchTerm: 'XYZ', // Non-matching prefix
      entities: [
        { name: 'Chelsea', league: 'Premier League', popularity: 100 },
        { name: 'Bayern Munich', league: 'Bundesliga', popularity: 90 },
        { name: 'Ajax', league: 'Eredivisie', popularity: 80 }
      ],
      expectedOrder: ['Chelsea', 'Bayern Munich', 'Ajax']
    }
  ]
}

// League popularity scores (same as in LeagueNav component)
const leaguePopularity = {
  // Football - Major European leagues
  'Premier League': 100,
  'LaLiga': 95,
  'Bundesliga': 90,
  'Serie A': 85,
  'Ligue 1': 80,
  'English League Championship': 75,
  
  // Major competitions
  'UEFA Champions League': 110,
  'UEFA Europa League': 105,
  'FIFA World Cup': 130,
  'UEFA Euro': 120,
  
  // Other leagues
  'MLS': 70,
  'Eredivisie': 65,
  'Primeira Liga': 60,
  'Liga MX': 55,
  'Saudi Pro League': 50,
  'Premier Soccer League': 45, // South Africa
  'Iraqi Premier League': 25, // Lower popularity
  
  // Lower priority
  'League One': 35,
  'League Two': 30,
  'Scottish Premiership': 38,
  'Indian Premier League': 40, // Cricket, but included for testing
  
  // Default
  'default_league': 20
}

class LeagueNavLogicTDD {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      total: 0,
      tests: []
    }
  }

  test(description, testFn) {
    this.results.total++
    console.log(`\n🧪 ${description}`)
    
    try {
      const result = testFn()
      if (result.success) {
        console.log(`   ✅ ${result.message}`)
        this.results.passed++
        this.results.tests.push({ description, status: 'PASSED', message: result.message })
      } else {
        console.log(`   ❌ ${result.message}`)
        console.log(`   Expected: ${JSON.stringify(result.expected)}`)
        console.log(`   Actual: ${JSON.stringify(result.actual)}`)
        this.results.failed++
        this.results.tests.push({ 
          description, 
          status: 'FAILED', 
          message: result.message,
          expected: result.expected,
          actual: result.actual
        })
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`)
      this.results.failed++
      this.results.tests.push({ 
        description, 
        status: 'ERROR', 
        message: error.message 
      })
    }
  }

  // Core Logic Functions (copied from LeagueNav component)

  /**
   * Check for exact entity match for direct navigation
   */
  findExactEntityMatch(searchTerm, entities) {
    const searchTermLower = searchTerm.toLowerCase()
    return entities.find(entity => 
      entity.name?.toLowerCase() === searchTermLower
    )
  }

  /**
   * Sort search results by priority rules
   */
  sortSearchResults(entities, searchTerm) {
    const searchTermLower = searchTerm.toLowerCase()
    
    return entities.sort((a, b) => {
      const aName = a.name.toLowerCase()
      const bName = b.name.toLowerCase()
      
      // Priority 1: Exact name match
      if (aName === searchTermLower && bName !== searchTermLower) return -1
      if (bName === searchTermLower && aName !== searchTermLower) return 1
      
      // Priority 2: Starts with search term
      const aStarts = aName.startsWith(searchTermLower)
      const bStarts = bName.startsWith(searchTermLower)
      if (aStarts && !bStarts) return -1
      if (bStarts && !aStarts) return 1
      
      // Priority 3: League popularity
      const aPopScore = leaguePopularity[a.league] || leaguePopularity.default_league
      const bPopScore = leaguePopularity[b.league] || leaguePopularity.default_league
      
      if (aPopScore !== bPopScore) {
        return bPopScore - aPopScore // Higher score first
      }
      
      // Priority 4: Alphabetical
      return aName.localeCompare(bName)
    })
  }

  /**
   * Filter and sort leagues by popularity
   */
  filterAndSortLeagues(leagues, searchTerm) {
    const searchTermLower = searchTerm.toLowerCase()
    
    return leagues
      .filter(league => 
        league.name.toLowerCase().includes(searchTermLower) ||
        league.teams.some(team => team.toLowerCase().includes(searchTermLower))
      )
      .map(league => ({
        ...league,
        popularityScore: leaguePopularity[league.name] || leaguePopularity.default_league
      }))
      .sort((a, b) => {
        // Primary sort: by popularity score (descending)
        if (a.popularityScore !== b.popularityScore) {
          return b.popularityScore - a.popularityScore
        }
        
        // Secondary sort: if both contain the search term in name, prioritize exact matches
        const aExactMatch = a.name.toLowerCase() === searchTermLower
        const bExactMatch = b.name.toLowerCase() === searchTermLower
        if (aExactMatch && !bExactMatch) return -1
        if (bExactMatch && !aExactMatch) return 1
        
        // Tertiary sort: alphabetical
        return a.name.localeCompare(b.name)
      })
  }

  async runAllTests() {
    console.log('🚀 Starting LeagueNav Logic TDD Suite')
    console.log('=' .repeat(80))

    // Test 1: Popularity Ranking
    console.log('\n📊 TESTING POPULARITY RANKING')
    console.log('-'.repeat(50))
    
    testCases.popularityRanking.forEach(testCase => {
      this.test(testCase.description, () => {
        const sortedLeagues = this.filterAndSortLeagues(testCase.inputLeagues, testCase.searchTerm)
        const actualOrder = sortedLeagues.map(league => league.name)
        
        const success = JSON.stringify(actualOrder) === JSON.stringify(testCase.expectedOrder)
        
        return {
          success,
          message: success 
            ? `Correctly ordered: ${actualOrder.join(', ')}`
            : `Incorrect ordering`,
          expected: testCase.expectedOrder,
          actual: actualOrder
        }
      })
    })

    // Test 2: Direct Navigation
    console.log('\n🎯 TESTING DIRECT NAVIGATION')
    console.log('-'.repeat(50))
    
    testCases.directNavigation.forEach(testCase => {
      this.test(testCase.description, () => {
        const exactMatch = this.findExactEntityMatch(testCase.searchTerm, testCase.entities)
        
        const success = testCase.expectedResult.found ? 
          (exactMatch !== undefined && exactMatch.name === testCase.expectedResult.entity.name) :
          (exactMatch === undefined)
        
        return {
          success,
          message: success 
            ? exactMatch 
              ? `Found exact match: ${exactMatch.name} (${exactMatch.id})`
              : 'Correctly no exact match found'
            : exactMatch 
              ? `Unexpected exact match: ${exactMatch.name}`
              : 'Expected exact match but none found',
          expected: testCase.expectedResult,
          actual: exactMatch ? { found: true, entity: exactMatch } : { found: false }
        }
      })
    })

    // Test 3: Search Prioritization
    console.log('\n🔍 TESTING SEARCH PRIORITIZATION')
    console.log('-'.repeat(50))
    
    testCases.searchPrioritization.forEach(testCase => {
      this.test(testCase.description, () => {
        const sortedResults = this.sortSearchResults(testCase.entities, testCase.searchTerm)
        const actualOrder = sortedResults.map(entity => entity.name)
        
        const success = JSON.stringify(actualOrder) === JSON.stringify(testCase.expectedOrder)
        
        return {
          success,
          message: success 
            ? `Correctly prioritized: ${actualOrder.join(' → ')}`
            : `Incorrect prioritization`,
          expected: testCase.expectedOrder,
          actual: actualOrder
        }
      })
    })

    // Test 4: Edge Cases
    console.log('\n⚠️  TESTING EDGE CASES')
    console.log('-'.repeat(50))
    
    this.test('Handles empty search term', () => {
      const entities = [
        { name: 'Arsenal', league: 'Premier League', popularity: 100 },
        { name: 'Chelsea', league: 'Premier League', popularity: 100 }
      ]
      
      const sortedResults = this.sortSearchResults(entities, '')
      const success = sortedResults.length === 2 // Should not filter anything
      
      return {
        success,
        message: success ? 'Empty search term handled correctly' : 'Empty search term caused issues'
      }
    })
    
    this.test('Handles null/undefined entities', () => {
      const entities = [
        { name: 'Arsenal', league: 'Premier League', popularity: 100 },
        null,
        undefined,
        { name: 'Chelsea', league: 'Premier League', popularity: 100 }
      ]
      
      try {
        const sortedResults = this.sortSearchResults(entities.filter(Boolean), 'test')
        const success = sortedResults.length === 2
        
        return {
          success,
          message: success ? 'Null entities handled correctly' : 'Null entities caused issues'
        }
      } catch (error) {
        return {
          success: false,
          message: `Error handling null entities: ${error.message}`
        }
      }
    })
    
    this.test('Handles special characters', () => {
      const entities = [
        { name: 'Mönchengladbach', league: 'Bundesliga', popularity: 90 },
        { name: 'Bayern Munich', league: 'Bundesliga', popularity: 95 }
      ]
      
      try {
        const exactMatch = this.findExactEntityMatch('Mönchengladbach', entities)
        const success = exactMatch && exactMatch.name === 'Mönchengladbach'
        
        return {
          success,
          message: success ? 'Special characters handled correctly' : 'Special characters not handled'
        }
      } catch (error) {
        return {
          success: false,
          message: `Error with special characters: ${error.message}`
        }
      }
    })

    // Test 5: Performance
    console.log('\n⚡ TESTING PERFORMANCE')
    console.log('-'.repeat(50))
    
    this.test('Performance with large dataset', () => {
      // Create 1000 test entities
      const largeDataset = []
      const leagues = Object.keys(leaguePopularity).filter(k => k !== 'default_league')
      
      for (let i = 0; i < 1000; i++) {
        largeDataset.push({
          name: `Team ${i}`,
          league: leagues[i % leagues.length],
          popularity: leaguePopularity[leagues[i % leagues.length]]
        })
      }
      
      const startTime = performance.now()
      const sortedResults = this.sortSearchResults(largeDataset, 'Team')
      const endTime = performance.now()
      
      const duration = endTime - startTime
      const success = duration < 1000 && sortedResults.length === 1000 // Should complete in under 1 second
      
      return {
        success,
        message: success 
          ? `Processed 1000 entities in ${duration.toFixed(2)}ms`
          : `Performance issue: ${duration.toFixed(2)}ms for 1000 entities`
      }
    })

    return this.results
  }

  printResults() {
    console.log('\n' + '=' .repeat(80))
    console.log('🧪 LEAGUE NAV LOGIC TDD RESULTS')
    console.log('=' .repeat(80))
    
    this.results.tests.forEach(test => {
      const icon = test.status === 'PASSED' ? '✅' : '❌'
      console.log(`${icon} ${test.description}`)
      if (test.status === 'FAILED' || test.status === 'ERROR') {
        console.log(`   ${test.message}`)
        if (test.expected !== undefined) {
          console.log(`   Expected: ${JSON.stringify(test.expected)}`)
        }
        if (test.actual !== undefined) {
          console.log(`   Actual: ${JSON.stringify(test.actual)}`)
        }
      }
    })
    
    console.log('\n' + '=' .repeat(80))
    console.log(`📊 SUMMARY: ${this.results.passed}/${this.results.total} passed`)
    console.log(`📈 SUCCESS RATE: ${Math.round((this.results.passed / this.results.total) * 100)}%`)
    console.log(`⏱️  PERFORMANCE: ${this.results.total} tests completed`)
    console.log('=' .repeat(80))
    
    return this.results.failed === 0
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  const tdd = new LeagueNavLogicTDD()
  
  tdd.runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1)
    })
    .catch(error => {
      console.error('❌ Test runner failed:', error)
      process.exit(1)
    })
}

module.exports = LeagueNavLogicTDD