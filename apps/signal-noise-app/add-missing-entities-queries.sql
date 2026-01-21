-- Comprehensive Missing Entities Addition
-- Generated: 2025-11-15T15:21:10.857Z


MERGE (e:Entity {
  name: 'Arsenal FC',
  type: 'Club',
  sport: 'Football',
  league: 'English Premier League',
  country: 'England',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Aston Villa FC',
  type: 'Club',
  sport: 'Football',
  league: 'English Premier League',
  country: 'England',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Bournemouth AFC',
  type: 'Club',
  sport: 'Football',
  league: 'English Premier League',
  country: 'England',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Chelsea FC',
  type: 'Club',
  sport: 'Football',
  league: 'English Premier League',
  country: 'England',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Crystal Palace FC',
  type: 'Club',
  sport: 'Football',
  league: 'English Premier League',
  country: 'England',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Everton FC',
  type: 'Club',
  sport: 'Football',
  league: 'English Premier League',
  country: 'England',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Ipswich Town FC',
  type: 'Club',
  sport: 'Football',
  league: 'English Premier League',
  country: 'England',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Leicester City FC',
  type: 'Club',
  sport: 'Football',
  league: 'English Premier League',
  country: 'England',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Liverpool FC',
  type: 'Club',
  sport: 'Football',
  league: 'English Premier League',
  country: 'England',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Manchester City FC',
  type: 'Club',
  sport: 'Football',
  league: 'English Premier League',
  country: 'England',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Newcastle United FC',
  type: 'Club',
  sport: 'Football',
  league: 'English Premier League',
  country: 'England',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Nottingham Forest FC',
  type: 'Club',
  sport: 'Football',
  league: 'English Premier League',
  country: 'England',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Southampton FC',
  type: 'Club',
  sport: 'Football',
  league: 'English Premier League',
  country: 'England',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'West Ham United FC',
  type: 'Club',
  sport: 'Football',
  league: 'English Premier League',
  country: 'England',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Wolverhampton Wanderers FC',
  type: 'Club',
  sport: 'Football',
  league: 'English Premier League',
  country: 'England',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Atlanta Hawks',
  type: 'Sports Team',
  sport: 'Basketball',
  league: 'NBA',
  country: 'USA',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Boston Celtics',
  type: 'Sports Team',
  sport: 'Basketball',
  league: 'NBA',
  country: 'USA',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Brooklyn Nets',
  type: 'Sports Team',
  sport: 'Basketball',
  league: 'NBA',
  country: 'USA',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Charlotte Hornets',
  type: 'Sports Team',
  sport: 'Basketball',
  league: 'NBA',
  country: 'USA',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Chicago Bulls',
  type: 'Sports Team',
  sport: 'Basketball',
  league: 'NBA',
  country: 'USA',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Cleveland Cavaliers',
  type: 'Sports Team',
  sport: 'Basketball',
  league: 'NBA',
  country: 'USA',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Denver Nuggets',
  type: 'Sports Team',
  sport: 'Basketball',
  league: 'NBA',
  country: 'USA',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Detroit Pistons',
  type: 'Sports Team',
  sport: 'Basketball',
  league: 'NBA',
  country: 'USA',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Golden State Warriors',
  type: 'Sports Team',
  sport: 'Basketball',
  league: 'NBA',
  country: 'USA',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Houston Rockets',
  type: 'Sports Team',
  sport: 'Basketball',
  league: 'NBA',
  country: 'USA',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Indiana Pacers',
  type: 'Sports Team',
  sport: 'Basketball',
  league: 'NBA',
  country: 'USA',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Los Angeles Clippers',
  type: 'Sports Team',
  sport: 'Basketball',
  league: 'NBA',
  country: 'USA',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Los Angeles Lakers',
  type: 'Sports Team',
  sport: 'Basketball',
  league: 'NBA',
  country: 'USA',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Memphis Grizzlies',
  type: 'Sports Team',
  sport: 'Basketball',
  league: 'NBA',
  country: 'USA',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Miami Heat',
  type: 'Sports Team',
  sport: 'Basketball',
  league: 'NBA',
  country: 'USA',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Milwaukee Bucks',
  type: 'Sports Team',
  sport: 'Basketball',
  league: 'NBA',
  country: 'USA',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'New Orleans Pelicans',
  type: 'Sports Team',
  sport: 'Basketball',
  league: 'NBA',
  country: 'USA',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'New York Knicks',
  type: 'Sports Team',
  sport: 'Basketball',
  league: 'NBA',
  country: 'USA',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Oklahoma City Thunder',
  type: 'Sports Team',
  sport: 'Basketball',
  league: 'NBA',
  country: 'USA',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Orlando Magic',
  type: 'Sports Team',
  sport: 'Basketball',
  league: 'NBA',
  country: 'USA',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Philadelphia 76ers',
  type: 'Sports Team',
  sport: 'Basketball',
  league: 'NBA',
  country: 'USA',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Phoenix Suns',
  type: 'Sports Team',
  sport: 'Basketball',
  league: 'NBA',
  country: 'USA',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Portland Trail Blazers',
  type: 'Sports Team',
  sport: 'Basketball',
  league: 'NBA',
  country: 'USA',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Sacramento Kings',
  type: 'Sports Team',
  sport: 'Basketball',
  league: 'NBA',
  country: 'USA',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'San Antonio Spurs',
  type: 'Sports Team',
  sport: 'Basketball',
  league: 'NBA',
  country: 'USA',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Toronto Raptors',
  type: 'Sports Team',
  sport: 'Basketball',
  league: 'NBA',
  country: 'Canada',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Utah Jazz',
  type: 'Sports Team',
  sport: 'Basketball',
  league: 'NBA',
  country: 'USA',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Washington Wizards',
  type: 'Sports Team',
  sport: 'Basketball',
  league: 'NBA',
  country: 'USA',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Real Madrid',
  type: 'Club',
  sport: 'Football',
  league: 'La Liga',
  country: 'Spain',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Barcelona FC',
  type: 'Club',
  sport: 'Football',
  league: 'La Liga',
  country: 'Spain',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Atlético Madrid',
  type: 'Club',
  sport: 'Football',
  league: 'La Liga',
  country: 'Spain',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Bayern Munich',
  type: 'Club',
  sport: 'Football',
  league: 'Bundesliga',
  country: 'Germany',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Borussia Dortmund',
  type: 'Club',
  sport: 'Football',
  league: 'Bundesliga',
  country: 'Germany',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'RB Leipzig',
  type: 'Club',
  sport: 'Football',
  league: 'Bundesliga',
  country: 'Germany',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Bayer Leverkusen',
  type: 'Club',
  sport: 'Football',
  league: 'Bundesliga',
  country: 'Germany',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Paris Saint-Germain',
  type: 'Club',
  sport: 'Football',
  league: 'Ligue 1',
  country: 'France',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Juventus FC',
  type: 'Club',
  sport: 'Football',
  league: 'Serie A',
  country: 'Italy',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'AC Milan',
  type: 'Club',
  sport: 'Football',
  league: 'Serie A',
  country: 'Italy',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Inter Milan',
  type: 'Club',
  sport: 'Football',
  league: 'Serie A',
  country: 'Italy',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'SSC Napoli',
  type: 'Club',
  sport: 'Football',
  league: 'Serie A',
  country: 'Italy',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Mumbai Indians',
  type: 'Sports Entity',
  sport: 'Cricket',
  league: 'Indian Premier League',
  country: 'India',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Chennai Super Kings',
  type: 'Sports Entity',
  sport: 'Cricket',
  league: 'Indian Premier League',
  country: 'India',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Royal Challengers Bangalore',
  type: 'Sports Entity',
  sport: 'Cricket',
  league: 'Indian Premier League',
  country: 'India',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Kolkata Knight Riders',
  type: 'Sports Entity',
  sport: 'Cricket',
  league: 'Indian Premier League',
  country: 'India',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Delhi Capitals',
  type: 'Sports Entity',
  sport: 'Cricket',
  league: 'Indian Premier League',
  country: 'India',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Rajasthan Royals',
  type: 'Sports Entity',
  sport: 'Cricket',
  league: 'Indian Premier League',
  country: 'India',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Punjab Kings',
  type: 'Sports Entity',
  sport: 'Cricket',
  league: 'Indian Premier League',
  country: 'India',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Sunrisers Hyderabad',
  type: 'Sports Entity',
  sport: 'Cricket',
  league: 'Indian Premier League',
  country: 'India',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Lucknow Super Giants',
  type: 'Sports Entity',
  sport: 'Cricket',
  league: 'Indian Premier League',
  country: 'India',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();


MERGE (e:Entity {
  name: 'Gujarat Titans',
  type: 'Sports Entity',
  sport: 'Cricket',
  league: 'Indian Premier League',
  country: 'India',
  confidence_score: 0.95,
  digital_presence_score: 0.90,
  opportunity_score: 0.85,
  last_updated: datetime(),
  source: 'comprehensive_enhancement_2024',
  status: 'active'
})
ON CREATE SET e.created_at = datetime()
ON MATCH SET e.last_updated = datetime();
