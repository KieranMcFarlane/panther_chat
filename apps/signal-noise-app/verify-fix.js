
const { badgeService } = require('./src/services/badge-service');

async function verify() {
    console.log('🔍 Verifying Badge Service Fix...');

    // Test case 1: Entity with S3 bucket fallback
    const entityName = 'Lecce';
    const entityId = '1237';

    console.log(`\nTesting entity: ${entityName} (${entityId})`);

    try {
        const mapping = await badgeService.getBadgeForEntity(entityId, entityName);
        console.log('Mapping found:', mapping);

        if (mapping && mapping.s3Url) {
            console.log('✅ S3 URL present:', mapping.s3Url);
            if (mapping.s3Url.includes('sportsintelligence')) {
                console.log('✅ Bucket name correct (fallback worked)');
            } else {
                console.log('❌ Bucket name incorrect:', mapping.s3Url);
            }
        } else {
            console.log('❌ No S3 URL in mapping');
        }

        const url = badgeService.getBadgeUrl(mapping);
        console.log('Final URL:', url);

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

verify();
