UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', '2. Bundesliga')
   WHERE properties->>'league' = 'Premier League' 
     AND properties->>'name' = '2. Bundesliga'

UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'A-League')
   WHERE properties->>'league' = 'Premier League' 
     AND properties->>'name' = 'A-League'

UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'Allsvenskan')
   WHERE properties->>'league' = 'Premier League' 
     AND properties->>'name' = 'Allsvenskan'

UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'Belgian Pro League')
   WHERE properties->>'league' = 'Premier League' 
     AND properties->>'name' = 'Belgian Pro League'

UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'Brasileirão Série A')
   WHERE properties->>'league' = 'Premier League' 
     AND properties->>'name' = 'Brasileirão Série A'

UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'Austrian Bundesliga')
   WHERE properties->>'league' = 'Premier League' 
     AND properties->>'name' = 'Austrian Bundesliga'

UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'FIFA Member Association')
   WHERE properties->>'league' = 'Premier League'
     AND properties->>'name' IN ('Afghanistan Football Federation', 'Albanian Football Association', 'Algerian Football Association', 'Angolan Football Association', 'Anguilla Football Association', 'Antigua and Barbuda Football Association', 'Argentine Football Association', 'Armenian Football Association', 'Aruba Football Federation', 'Asian Football Confederation', 'Asian Football Confederation (AFC)', 'Austrian Football Association', 'Azerbaijan Football Federation', 'Bahamas Football Association', 'Bahrain Football Association', 'Bangladesh Football Federation', 'Barbados Football Association', 'Belarus Football Association', 'Belgian Football Association', 'Belize Football Association', 'Benin Football Federation', 'Bermuda Football Association', 'Bhutan Football Federation', 'Bolivian Football Association', 'Bosnia and Herzegovina Football Federation', 'Botswana Football Association', 'Brazilian Football Confederation', 'British Virgin Islands Football Association')

UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'Qatar Stars League')
   WHERE properties->>'league' = 'Premier League'
     AND properties->>'level' = 'Qatar Stars League'

UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'Sudan Premier League')
   WHERE properties->>'league' = 'Premier League'
     AND properties->>'level' = 'Sudan Premier League'

UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'Chinese Super League')
   WHERE properties->>'league' = 'Premier League'
     AND properties->>'level' = 'Chinese Super League'

UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'Belgian Pro League')
   WHERE properties->>'league' = 'Premier League'
     AND properties->>'level' = 'Belgian Pro League'

UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'Categoría Primera A')
   WHERE properties->>'league' = 'Premier League'
     AND properties->>'level' = 'Categoría Primera A'

UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'Austrian Bundesliga')
   WHERE properties->>'league' = 'Premier League'
     AND properties->>'level' = 'Austrian Bundesliga'

UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'Botola Pro')
   WHERE properties->>'league' = 'Premier League'
     AND properties->>'level' = 'Top-tier'

UPDATE cached_entities 
   SET properties = jsonb_set(
     jsonb_set(
       jsonb_set(properties, '{country}', '"England"'),
       '{level}', '"Tier 1"'
     ),
     '{league}', '"Premier League"'
   )
   WHERE properties->>'name' IN ('Arsenal', 'Aston Villa', 'Bournemouth', 'Brentford', 'Brighton & Hove Albion', 'Burnley', 'Chelsea', 'Crystal Palace', 'Everton', 'Fulham', 'Ipswich Town', 'Liverpool', 'Manchester City', 'Manchester United', 'Newcastle United', 'Nottingham Forest', 'Sheffield United', 'Tottenham', 'West Ham United', 'Wolverhampton Wanderers')
     AND properties->>'sport' = 'Football'

UPDATE cached_entities 
   SET labels = ARRAY['Entity', 'Club']
   WHERE properties->>'name' IN ('Arsenal', 'Aston Villa', 'Bournemouth', 'Brentford', 'Brighton & Hove Albion', 'Burnley', 'Chelsea', 'Crystal Palace', 'Everton', 'Fulham', 'Ipswich Town', 'Liverpool', 'Manchester City', 'Manchester United', 'Newcastle United', 'Nottingham Forest', 'Sheffield United', 'Tottenham', 'West Ham United', 'Wolverhampton Wanderers')
     AND properties->>'sport' = 'Football'
     AND NOT 'Club' = ANY(labels)

DELETE FROM cached_entities 
   WHERE properties->>'league' = 'Premier League'
     AND properties->>'sport' = 'Football'
     AND properties->>'name' NOT IN ('Arsenal', 'Aston Villa', 'Bournemouth', 'Brentford', 'Brighton & Hove Albion', 'Burnley', 'Chelsea', 'Crystal Palace', 'Everton', 'Fulham', 'Ipswich Town', 'Liverpool', 'Manchester City', 'Manchester United', 'Newcastle United', 'Nottingham Forest', 'Sheffield United', 'Tottenham', 'West Ham United', 'Wolverhampton Wanderers')