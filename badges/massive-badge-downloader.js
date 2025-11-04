#!/usr/bin/env node

/**
 * Massive Badge Downloader - Aggressive download with extended delays
 * Targets 200+ badges with comprehensive club coverage
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Massive list of clubs from all continents
const MASSIVE_CLUB_LIST = [
    // English Championship & Lower Leagues
    'Watford', 'Norwich City', 'Coventry City', 'Middlesbrough', 'West Bromwich Albion',
    'Sunderland', 'Hull City', 'Preston North End', 'Luton Town', 'Sheffield Wednesday',
    'Bristol City', 'Millwall', 'Queens Park Rangers', 'Blackburn Rovers', 'Swansea City',
    'Reading', 'Huddersfield Town', 'Wigan Athletic', 'Rotherham United', 'Plymouth Argyle',
    
    // Spanish Segunda & Others
    'Espanyol', 'Alcorcon', 'Almeria', 'Cartagena', 'Eibar', 'Elche', 'Girona',
    'Las Palmas', 'Leganes', 'Malaga', 'Mirandes', 'Numancia', 'Oviedo', 'Ponferradina',
    'Real Oviedo', 'Real Zaragoza', 'Sporting Gijon', 'Tenerife', 'Valladolid',
    'Villarreal B', 'Xerez', 'Zaragoza',
    
    // Italian Serie B & Others
    'Ascoli', 'Bari', 'Benevento', 'Brescia', 'Cagliari', 'Cittadella', 'Como',
    'Cosenza', 'Cremonese', 'Crotone', 'Empoli', 'Frosinone', 'Genoa', 'Lecce',
    'Modena', 'Monza', 'Padova', 'Parma', 'Perugia', 'Pescara', 'Pisa',
    'Reggina', 'Salernitana', 'Sampdoria', 'Sassuolo', 'Spezia', 'SPAL', 'Ternana',
    'Trapani', 'Udinese', 'Venezia', 'Verona', 'Vicenza',
    
    // German 2. Bundesliga & Others
    'Augsburg', 'Bochum', 'Braunschweig', 'Darmstadt', 'Dresden', 'Duisburg',
    'Erzgebirge Aue', 'Fortuna Dusseldorf', 'Hamburg', 'Hannover', 'Heidenheim',
    'Holstein Kiel', 'Ingolstadt', 'Jahn Regensburg', 'Karlsruhe', 'Kaiserslautern',
    'Magdeburg', 'Nurnberg', 'Osnabruck', 'Paderborn', 'Sandhausen', 'St. Pauli',
    'Wiesbaden', 'Wurzburger Kickers',
    
    // French Ligue 2 & Others
    'Ajaccio', 'Amiens', 'Auxerre', 'Bastia', 'Bordeaux', 'Brest', 'Caen',
    'Clermont', 'Dijon', 'Grenoble', 'Guingamp', 'Le Havre', 'Lens', 'Lorient',
    'Metz', 'Nancy', 'Niort', 'Paris FC', 'Quevilly', 'Reims', 'Saint-Etienne',
    'Sochaux', 'Strasbourg', 'Troyes', 'Valenciennes',
    
    // Dutch Eredivisie & Eerste Divisie
    'AZ Alkmaar', 'ADO Den Haag', 'Cambuur', 'De Graafschap', 'Emmen', 'Excelsior',
    'FC Eindhoven', 'FC Groningen', 'FC Twente', 'FC Utrecht', 'Fortuna Sittard',
    'Go Ahead Eagles', 'Helmond Sport', 'Heracles Almelo', 'Jong Ajax', 'Jong PSV',
    'MVV Maastricht', 'NAC Breda', 'NEC Nijmegen', 'RKC Waalwijk', 'Roda JC',
    'Sparta Rotterdam', 'Telstar', 'Utrecht', 'Vitesse', 'Volendam', 'VVV Venlo',
    'Willem II', 'Zwolle',
    
    // Portuguese Primeira Liga & Segunda
    'Belenenses', 'Boavista', 'Braga', 'Famalicao', 'Feirense', 'Gil Vicente',
    'Maritimo', 'Moreirense', 'Nacional', 'Paços de Ferreira', 'Portimonense',
    'Rio Ave', 'Santa Clara', 'Setubal', 'Tondela', 'Vizela', 'Academica',
    'Chaves', 'Covilha', 'Estoril', 'Farense', 'Leixoes', 'Mafra', 'Penafiel',
    'Porto B', 'Sporting B', 'Varzim',
    
    // Scottish Premiership & Championship
    'Aberdeen', 'Dundee', 'Dundee United', 'Hibernian', 'Kilmarnock', 'Livingston',
    'Motherwell', 'Ross County', 'St Johnstone', 'St Mirren', 'Airdrieonians', 'Arbroath',
    'Ayr United', 'Clyde', 'Dunfermline', 'East Fife', 'Falkirk', 'Greenock Morton',
    'Hamilton', 'Inverness', 'Kilmarnock', 'Partick Thistle', 'Queen of the South',
    'Raith Rovers', 'Stirling Albion',
    
    // Scandinavian Clubs
    'AIK', 'Djurgarden', 'Hammarby', 'Malmo FF', 'Hacken', 'Elfsborg', 'Norrkoping',
    'Brondby', 'Copenhagen', 'Midtjylland', 'Aalborg', 'Aarhus', 'Odense', 'Viborg',
    'Rosenborg', 'Bodo Glimt', 'Molde', 'Viking', 'Valerenga', 'Lillestrom', 'Haugesund',
    'HJK Helsinki', 'KuPS', 'Honka', 'Mariehamn', 'Hibernian', 'Dundee United',
    
    // Eastern European Clubs
    'Red Star Belgrade', 'Partizan Belgrade', 'Crvena Zvezda', 'Vojvodina',
    'Dinamo Zagreb', 'Hajduk Split', 'Rijeka', 'Osijek', 'Slaven Belupo',
    'Sparta Prague', 'Slavia Prague', 'Viktoria Plzen', 'Banik Ostrava', 'Slovan Liberec',
    'Wisla Krakow', 'Legia Warsaw', 'Lech Poznan', 'Piast Gliwice', 'Jagiellonia',
    'Ferencvaros', 'MTK Budapest', 'Debrecen', 'Fehervar', 'Honved', 'Ujpest',
    'Steaua Bucuresti', 'Dinamo Bucuresti', 'CFR Cluj', 'Universitatea Craiova', 'Astra',
    'Shakhtar Donetsk', 'Dynamo Kyiv', 'Dnipro', 'Zorya', 'Vorskla', 'Oleksandriya',
    'Slovan Bratislava', 'Spartak Trnava', 'Zilina', 'Trencin', 'Ruzomberok',
    'Levski Sofia', 'CSKA Sofia', 'Ludogorets', 'Beroe', 'Slavia Sofia',
    'Partizani Tirana', 'Skenderbeu', 'Kukes', 'Teuta', 'Vllaznia',
    
    // More Asian Clubs
    'Urawa Red Diamonds', 'Kashima Antlers', 'Kawasaki Frontale', 'Yokohama F Marinos',
    'Nagoya Grampus', 'Cerezo Osaka', 'Gamba Osaka', 'Consadole Sapporo', 'FC Tokyo',
    'Shimizu S-Pulse', 'Urawa Red Diamonds', 'Vissel Kobe', 'Sanfrecce Hiroshima',
    'Jeonbuk Hyundai Motors', 'Seoul FC', 'Suwon Samsung Bluewings', 'Ulsan Hyundai',
    'Pohang Steelers', 'Jeju United', 'Gangwon FC', 'Incheon United', 'Seongnam FC',
    'Shanghai SIPG', 'Guangzhou FC', 'Beijing Guoan', 'Shandong Taishan', 'Henan Jianye',
    'Shenzhen FC', 'Tianjin Jinmen Tiger', 'Hebei China Fortune', 'Dalian Professional',
    'Melbourne Victory', 'Sydney FC', 'Wellington Phoenix', 'Melbourne City', 'Western Sydney',
    'Brisbane Roar', 'Adelaide United', 'Perth Glory', 'Western United', 'Macarthur FC',
    'Muangthong United', 'Buriram United', 'Chiangrai United', 'Bangkok United', 'Port FC',
    'Johor Darul Takzim', 'Selangor', 'Kedah', 'Pahang', 'Terengganu',
    
    // More African Clubs
    'Al Ahly', 'Zamalek', 'Pyramids FC', 'Ismaily', 'ENPPI', 'El Gounah',
    'Kaizer Chiefs', 'Orlando Pirates', 'Mamelodi Sundowns', 'SuperSport United', 'Bidvest Wits',
    'TP Mazembe', 'AS Vita Club', 'Tout Puissant Mazembe', 'CS Sfaxien', 'Esperance',
    'Etoile du Sahel', 'Club Africain', 'Raja Casablanca', 'Wydad Casablanca', 'FAR Rabat',
    'Horoya AC', 'AS Kaloum', 'Simba SC', 'Yanga SC', 'Gor Mahia', 'Asec Mimosas'
];

class MassiveBadgeDownloader {
    constructor() {
        this.baseDir = '/Users/kieranmcfarlane/Downloads/panther_chat/badges';
        this.logFile = path.join(this.baseDir, 'massive-download.log');
        this.successCount = 0;
        this.errorCount = 0;
        this.skippedCount = 0;
        this.rateLimitDelay = 3000; // 3 seconds between API calls
    }

    log(message) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}\n`;
        console.log(logMessage.trim());
        fs.appendFileSync(this.logFile, logMessage);
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getTeamBadgeUrl(teamName) {
        try {
            if (this.successCount % 10 === 0) {
                this.log(`🔍 ${teamName}... (${this.successCount} downloaded so far)`);
            } else {
                this.log(`🔍 ${teamName}...`);
            }
            
            const apiUrl = `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(teamName)}`;
            const response = execSync(`curl -s "${apiUrl}"`, { encoding: 'utf8' });
            
            // Check for rate limiting
            if (response.includes('error code: 1015')) {
                this.log(`⚠️  Rate limited for ${teamName}, waiting 10s...`);
                await this.sleep(10000);
                return null;
            }
            
            const data = JSON.parse(response);
            
            if (data.teams && data.teams.length > 0) {
                const badgeUrl = data.teams[0].strBadge;
                if (badgeUrl && badgeUrl.startsWith('http')) {
                    return badgeUrl;
                }
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async downloadBadge(url, filename) {
        try {
            const filePath = path.join(this.baseDir, filename);
            
            // Skip if exists
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                if (stats.size > 5000) {
                    this.skippedCount++;
                    return true;
                } else {
                    fs.unlinkSync(filePath);
                }
            }

            execSync(`curl -s "${url}" -o "${filePath}"`, { stdio: 'pipe' });
            
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                if (stats.size > 5000) {
                    this.successCount++;
                    this.log(`✅ ${filename} (${stats.size}b)`);
                    return true;
                } else {
                    fs.unlinkSync(filePath);
                }
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    async run() {
        this.log('🚀 MASSIVE badge download started - Targeting 200+ badges!');
        this.log('Current count before starting:');
        
        const currentFiles = fs.readdirSync(this.baseDir).filter(f => f.endsWith('.png'));
        this.log(`📊 Starting with ${currentFiles.length} badges`);
        
        fs.writeFileSync(this.logFile, '');
        
        // Process in smaller batches with longer delays
        const batchSize = 5;
        const totalBatches = Math.ceil(MASSIVE_CLUB_LIST.length / batchSize);
        
        for (let i = 0; i < totalBatches; i++) {
            const start = i * batchSize;
            const end = Math.min(start + batchSize, MASSIVE_CLUB_LIST.length);
            const batch = MASSIVE_CLUB_LIST.slice(start, end);
            
            this.log(`🚀 Batch ${i + 1}/${totalBatches} (${start + 1}-${end} of ${MASSIVE_CLUB_LIST.length})`);
            
            for (const clubName of batch) {
                const badgeUrl = await this.getTeamBadgeUrl(clubName);
                if (badgeUrl) {
                    const filename = `${clubName.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '').replace(/'/g, '').replace(/&/g, 'and')}-badge.png`;
                    await this.downloadBadge(badgeUrl, filename);
                } else {
                    this.log(`❌ ${clubName}`);
                }
                
                await this.sleep(this.rateLimitDelay);
            }
            
            // Extra long delay between batches
            if (i < totalBatches - 1) {
                this.log(`⏳ Long break between batches...`);
                await this.sleep(5000);
            }
            
            // Progress check every 5 batches
            if ((i + 1) % 5 === 0) {
                const currentFiles = fs.readdirSync(this.baseDir).filter(f => f.endsWith('.png'));
                this.log(`📊 Progress check: ${currentFiles.length} badges downloaded`);
            }
        }
        
        // Final count
        const finalFiles = fs.readdirSync(this.baseDir).filter(f => f.endsWith('.png'));
        const totalSize = finalFiles.reduce((sum, file) => {
            try {
                return sum + fs.statSync(path.join(this.baseDir, file)).size;
            } catch {
                return sum;
            }
        }, 0);
        
        this.log(`\n🎉 MASSIVE DOWNLOAD COMPLETE!`);
        this.log(`===============================`);
        this.log(`✅ New downloads: ${this.successCount}`);
        this.log(`❌ Failed: ${this.errorCount}`);
        this.log(`⏭️  Skipped: ${this.skippedCount}`);
        this.log(`🎯 Total badges: ${finalFiles.length}`);
        this.log(`📦 Total size: ${Math.round(totalSize / 1024 / 1024)}MB`);
        this.log(`🚀 Goal achieved: ${finalFiles.length >= 200 ? '200+ MILESTONE REACHED!' : 'Keep pushing!'}`);
    }
}

// Run the massive downloader
if (require.main === module) {
    const downloader = new MassiveBadgeDownloader();
    downloader.run().catch(console.error);
}