-- Basketball Cleanup: Remove International Basketball contamination

UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', '"NBA"')
   WHERE properties->>'sport' = 'Basketball'
     AND properties->>'league' = 'International Basketball'
     AND properties->>'country' = 'United States'

UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', '"EuroLeague"')
   WHERE properties->>'sport' = 'Basketball'
     AND properties->>'league' = 'International Basketball'
     AND properties->>'country' IN ('Spain', 'Greece', 'Italy', 'France', 'Germany', 'Turkey', 'Russia', 'Lithuania', 'Serbia', 'Croatia')

UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', '"Chinese Basketball Association"')
   WHERE properties->>'sport' = 'Basketball'
     AND properties->>'league' = 'International Basketball'
     AND properties->>'country' = 'China'

UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', '"Korean Basketball League"')
   WHERE properties->>'sport' = 'Basketball'
     AND properties->>'league' = 'International Basketball'
     AND properties->>'country' = 'South Korea'

UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', '"Philippine Basketball Association"')
   WHERE properties->>'sport' = 'Basketball'
     AND properties->>'league' = 'International Basketball'
     AND properties->>'country' = 'Philippines'

-- Baseball Cleanup: Remove International Baseball contamination

UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', '"Major League Baseball"')
   WHERE properties->>'sport' = 'Baseball'
     AND properties->>'league' = 'International Baseball'
     AND properties->>'country' = 'United States'

UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', '"NPB Central League"')
   WHERE properties->>'sport' = 'Baseball'
     AND properties->>'league' = 'International Baseball'
     AND properties->>'country' = 'Japan'
     AND properties->>'region' = 'Central'

UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', '"NPB Pacific League"')
   WHERE properties->>'sport' = 'Baseball'
     AND properties->>'league' = 'International Baseball'
     AND properties->>'country' = 'Japan'
     AND properties->>'region' = 'Pacific'

UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', '"KBO League"')
   WHERE properties->>'sport' = 'Baseball'
     AND properties->>'league' = 'International Baseball'
     AND properties->>'country' = 'South Korea'

-- Cricket Cleanup: Remove International Cricket contamination

UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', '"Indian Premier League"')
   WHERE properties->>'sport' = 'Cricket'
     AND properties->>'league' = 'International Cricket'
     AND properties->>'country' = 'India'

UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', '"Big Bash League"')
   WHERE properties->>'sport' = 'Cricket'
     AND properties->>'league' = 'International Cricket'
     AND properties->>'country' = 'Australia'

UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', '"County Championship"')
   WHERE properties->>'sport' = 'Cricket'
     AND properties->>'league' = 'International Cricket'
     AND properties->>'country' = 'England'

UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', '"Pakistan Super League"')
   WHERE properties->>'sport' = 'Cricket'
     AND properties->>'league' = 'International Cricket'
     AND properties->>'country' = 'Pakistan'

-- Ice Hockey Cleanup: Remove International Hockey contamination

UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', '"National Hockey League"')
   WHERE properties->>'sport' = 'Ice Hockey'
     AND properties->>'league' = 'International Hockey'
     AND properties->>'country' = 'United States'

UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', '"National Hockey League"')
   WHERE properties->>'sport' = 'Ice Hockey'
     AND properties->>'league' = 'International Hockey'
     AND properties->>'country' = 'Canada'

UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', '"Kontinental Hockey League"')
   WHERE properties->>'sport' = 'Ice Hockey'
     AND properties->>'league' = 'International Hockey'
     AND properties->>'country' IN ('Russia', 'Belarus', 'Kazakhstan', 'Latvia', 'Finland')

-- Remove remaining generic league classifications

DELETE FROM cached_entities 
   WHERE properties->>'league' = 'International Basketball'
     AND properties->>'sport' = 'Basketball'

DELETE FROM cached_entities 
   WHERE properties->>'league' = 'International Baseball'
     AND properties->>'sport' = 'Baseball'

DELETE FROM cached_entities 
   WHERE properties->>'league' = 'International Cricket'
     AND properties->>'sport' = 'Cricket'

DELETE FROM cached_entities 
   WHERE properties->>'league' = 'International Hockey'
     AND properties->>'sport' = 'Ice Hockey'