const { createClient } = require('@supabase/supabase-js');
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

require('dotenv').config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// All badges that exist in S3 (from your list)
const S3_BADGES = [
  '1-fc-koln-badge.png', '23xi-racing-badge.png', 'aalborg-badge.png', 'ac-milan-badge.png',
  'accrington-stanley-badge.png', 'aek-athens-badge.png', 'afc-wimbledon-badge.png',
  'aik-badge.png', 'ajax-badge.png', 'al-ittihad-badge.png', 'alcorcon-badge.png',
  'almeria-badge.png', 'anderlecht-badge.png', 'arminia-bielefeld-badge.png',
  'arsenal-badge.png', 'arsenal-corrected.png', 'as-monaco-badge.png', 'aston-villa-badge.png',
  'atalanta-badge.png', 'athletic-bilbao-badge.png', 'Athletico Paranaense-badge.png',
  'athletico-paranaense-badge.png', 'atlanta-united-badge.png', 'atletico-madrid-badge.png',
  'australian-football-league-badge.png', 'barcelona-badge.png', 'barnsley-badge.png',
  'barrow-badge.png', 'basel-badge.png', 'bayer-leverkusen-badge.png', 'bayern-munich-badge.png',
  'beijing-guoan-badge.png', 'benfica-badge.png', 'besiktas-badge.png', 'birmingham-city-badge.png',
  'blackburn-rovers-badge.png', 'blackpool-badge.png', 'boca-juniors-badge.png',
  'bologna-badge.png', 'bolton-wanderers-badge.png', 'borussia-dortmund-badge.png',
  'borussia-monchengladbach-badge.png', 'botafogo-badge.png', 'bournemouth-badge.png',
  'bradford-city-badge.png', 'brentford-badge.png', 'brentford-fc-badge.png',
  'brighton-and-hove-albion-badge.png', 'bristol-city-badge.png', 'bristol-rovers-badge.png',
  'bromley-badge.png', 'brondby-badge.png', 'burnley-badge.png', 'burton-albion-badge.png',
  'cadillac-racing-badge.png', 'cadiz-badge.png', 'cambridge-united-badge.png',
  'canberra-olympic-badge.png', 'cardiff-city-badge.png', 'carlisle-united-badge.png',
  'cartagena-badge.png', 'celta-vigo-badge.png', 'celtic-badge.png',
  'cerezo-osaka-badge.png', 'cfr-cluj-badge.png', 'charlton-athletic-badge.png',
  'chelsea-badge.png', 'cheltenham-town-badge.png', 'chesterfield-badge.png',
  'club-brugge-badge.png', 'colchester-united-badge.png', 'concacaf-champions-cup-badge.png',
  'Corinthians-badge.png', 'Coton Sport FC de Garoua-badge.png', 'coventry-city-badge.png',
  'crawley-town-badge.png', 'crewe-alexandra-badge.png', 'cruz-azul-badge.png',
  'Crystal Palace-badge.png', 'crystal-palace-badge.png', 'dakar-rally-badge.png',
  'debrecen-badge.png', 'derby-county-badge.png', 'dinamo-bucuresti-badge.png',
  'dinamo-zagreb-badge.png', 'dynamo-kyiv-badge.png', 'eibar-badge.png',
  'eintracht-frankfurt-badge.png', 'elche-badge.png', 'elfsborg-badge.png',
  'espanyol-badge.png', 'everton-badge.png', 'exeter-city-badge.png',
  'FC Porto-badge.png', 'fc-augsburg-badge.png', 'fc-porto-badge.png',
  'fenerbahce-badge.png', 'ferencvaros-badge.png', 'feyenoord-badge.png',
  'fiorentina-badge.png', 'flamengo-badge.png', 'fleetwood-town-badge.png',
  'fluminense-badge.png', 'freiburg-badge.png', 'fulham-badge.png',
  'galatasaray-badge.png', 'gamba-osaka-badge.png', 'genk-badge.png',
  'german-bundesliga-badge.png', 'getafe-badge.png', 'gillingham-badge.png',
  'girona-badge.png', 'granada-badge.png', 'gremio-badge.png',
  'greuther-furth-badge.png', 'grimsby-town-badge.png', 'guadalajara-badge.png',
  'guangzhou-fc-badge.png', 'hacken-badge.png', 'hajduk-split-badge.png',
  'hammarby-badge.png', 'harrogate-town-badge.png', 'hellas-verona-badge.png',
  'hjk-helsinki-badge.png', 'hoffenheim-badge.png', 'honka-badge.png',
  'huddersfield-town-badge.png', 'hull-city-badge.png', 'independiente-badge.png',
  'indian-premier-league-badge.png', 'inter-milan-badge.png', 'internacional-badge.png',
  'ipswich-town-badge.png', 'Islamabad United-badge.png', 'jeonbuk-hyundai-motors-badge.png',
  'juventus-badge.png', 'kashima-antlers-badge.png', 'kawasaki-frontale-badge.png',
  'kups-badge.png', 'la-galaxy-badge.png', 'lafc-badge.png',
  'las-palmas-badge.png', 'lazio-badge.png', 'Lazio-badge.png',
  'lecce-badge.png', 'lech-poznan-badge.png', 'leeds-united-badge.png',
  'leganes-badge.png', 'legia-warsaw-badge.png', 'leicester-city-badge.png',
  'lens-badge.png', 'leyton-orient-badge.png', 'lille-badge.png',
  'lincoln-city-badge.png', 'liverpool-badge.png', 'lugano-badge.png',
  'luton-town-badge.png', 'lyon-badge.png', 'malaga-badge.png',
  'malmo-ff-badge.png', 'manchester-city-badge.png', 'manchester-united-badge.png',
  'mansfield-town-badge.png', 'mariehamn-badge.png', 'marseille-badge.png',
  'middlesbrough-badge.png', 'midtjylland-badge.png', 'millwall-badge.png',
  'mk-dons-badge.png', 'molde-badge.png', 'monaco-badge.png',
  'monterrey-badge.png', 'morecambe-badge.png', 'mtk-budapest-badge.png',
  'nagoya-grampus-badge.png', 'napoli-badge.png', 'newcastle-united-badge.png',
  'newport-county-badge.png', 'nice-badge.png', 'northampton-town-badge.png',
  'norwich-city-badge.png', 'nottingham-forest-badge.png', 'notts-county-badge.png',
  'olympiacos-badge.png', 'palmeiras-badge.png', 'panathinaikos-badge.png',
  'paok-badge.png', 'partizan-belgrade-badge.png', 'persepolis-badge.png',
  'peterborough-united-badge.png', 'plymouth-argyle-badge.png', 'port-vale-badge.png',
  'portsmouth-badge.png', 'premier-league-badge.png', 'preston-north-end-badge.png',
  'psv-eindhoven-badge.png', 'queens-park-rangers-badge.png', 'racing-club-badge.png',
  'rangers-badge.png', 'rapid-vienna-badge.png', 'rayo-vallecano-badge.png',
  'rb-leipzig-badge.png', 'reading-badge.png', 'real-betis-badge.png',
  'real-madrid-badge.png', 'real-sociedad-badge.png', 'real-valladolid-badge.png',
  'red-bull-salzburg-badge.png', 'rennes-badge.png', 'river-plate-badge.png',
  'roma-badge.png', 'rosenborg-badge.png', 'rotherham-united-badge.png',
  'salford-city-badge.png', 'santos-badge.png', 'sao-paulo-badge.png',
  'sassuolo-badge.png', 'sevilla-badge.png', 'shakhtar-donetsk-badge.png',
  'shandong-taishan-badge.png', 'sheffield-united-badge.png', 'sheffield-wednesday-badge.png',
  'shrewsbury-town-badge.png', 'slavia-prague-badge.png', 'southampton-badge.png',
  'sparta-prague-badge.png', 'standard-liege-badge.png', 'steaua-bucuresti-badge.png',
  'stevenage-badge.png', 'stockport-county-badge.png', 'stoke-city-badge.png',
  'strasbourg-badge.png', 'sturm-graz-badge.png', 'sunderland-badge.png',
  'sutton-united-badge.png', 'suwon-samsung-bluewings-badge.png', 'swansea-city-badge.png',
  'swindon-town-badge.png', 'torino-badge.png', 'tottenham-badge.png',
  'tottenham-hotspur-badge.png', 'tottenham-hotspur-corrected.png', 'trabzonspor-badge.png',
  'Trackhouse Racing-badge.png', 'tranmere-rovers-badge.png', 'udinese-badge.png',
  'union-berlin-badge.png', 'urawa-red-diamonds-badge.png', 'valencia-badge.png',
  'valerenga-badge.png', 'vfb-stuttgart-badge.png', 'viking-badge.png',
  'viktoria-plzen-badge.png', 'villarreal-badge.png', 'watford-badge.png',
  'werder-bremen-badge.png', 'west-bromwich-albion-badge.png', 'west-ham-united-badge.png',
  'wigan-athletic-badge.png', 'wisla-krakow-badge.png', 'wolverhampton-wanderers-badge.png',
  'wrexham-badge.png', 'wycombe-wanderers-badge.png', 'yokohama-f-marinos-badge.png',
  'young-boys-badge.png', 'zenit-st-petersburg-badge.png', 'zurich-badge.png'
];

// Normalization function
function normalizeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Only keep letters and numbers
    .trim();
}

function findBadgeForEntity(entityName, currentBadge) {
  const normalizedName = normalizeName(entityName);
  const currentBadgeName = normalizeName(currentBadge.replace('.png', ''));

  // If current badge already matches (case insensitive), keep it
  if (S3_BADGES.some(b => normalizeName(b.replace('.png', '')) === currentBadgeName)) {
    return currentBadge; // Keep existing
  }

  // Try exact match first
  const exactMatch = S3_BADGES.find(badge =>
    normalizeName(badge.replace('.png', '')) === normalizedName
  );
  if (exactMatch) return exactMatch;

  // Try contains match - entity name is substring of badge or vice versa
  const containsMatch = S3_BADGES.find(badge => {
    const badgeName = normalizeName(badge.replace('.png', ''));
    return badgeName.includes(normalizedName) || normalizedName.includes(badgeName);
  });
  if (containsMatch) return containsMatch;

  return null;
}

async function fixBadgeUrls() {
  console.log('🔍 Fetching entities with badge_s3_url from Supabase...');

  const { data: entities, error } = await supabase
    .from('cached_entities')
    .select('id, badge_s3_url, properties')
    .not('badge_s3_url', 'is', null)
    .limit(500);

  if (error) {
    console.error('❌ Supabase error:', error);
    return;
  }

  console.log(`✅ Found ${entities.length} entities with badge_s3_url\n`);

  const updates = [];
  const notFound = [];

  for (const entity of entities) {
    const currentBadge = entity.badge_s3_url.split('/').pop();
    // Extract name from properties JSON
    const entityName = entity.properties?.name || 'Unknown';
    const correctBadge = findBadgeForEntity(entityName, currentBadge);

    console.log(`DEBUG: entity="${entityName}", current="${currentBadge}", matched="${correctBadge}"`);

    if (!correctBadge) {
      notFound.push({ name: entityName, currentBadge });
      continue;
    }

    if (currentBadge !== correctBadge) {
      const newUrl = `https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/${correctBadge}`;
      updates.push({
        id: entity.id,
        name: entityName,
        oldUrl: entity.badge_s3_url,
        newUrl: newUrl
      });
    }
  }

  console.log(`📊 Summary:`);
  console.log(`  - Matched correctly: ${entities.length - updates.length - notFound.length}`);
  console.log(`  - Need fixing: ${updates.length}`);
  console.log(`  - No badge found: ${notFound.length}\n`);

  if (updates.length > 0) {
    console.log('🔧 Updates needed (first 20):');
    updates.slice(0, 20).forEach(u => {
      console.log(`  ${u.name}`);
      console.log(`    OLD: ${u.oldUrl.split('/').pop()}`);
      console.log(`    NEW: ${u.newUrl.split('/').pop()}`);
      console.log('');
    });

    console.log(`\n⚠️  Total updates to apply: ${updates.length}`);
    console.log('Do you want to apply these updates? (This would require manual confirmation)');
  }

  if (notFound.length > 0) {
    console.log('❌ No badge found for (first 10):');
    notFound.slice(0, 10).forEach(n => {
      console.log(`  ${n.name} -> ${n.currentBadge}`);
    });
  }

  return { updates, notFound };
}

fixBadgeUrls().then(({ updates, notFound }) => {
  console.log(`\n✅ Done! ${updates.length} badges need fixing, ${notFound.length} have no matching badge.`);
}).catch(console.error);
