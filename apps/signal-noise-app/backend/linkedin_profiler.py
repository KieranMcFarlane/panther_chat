#!/usr/bin/env python3
"""
LinkedIn Profile Extraction and Analysis

Multi-pass LinkedIn profiling system powered by BrightData:
- Pass 1: Cached BrightData sweep (fast, 30s)
- Pass 2: Targeted BrightData scraping (deep, 2min)
- Pass 3+: Hybrid approach with versioning

Extracts:
- Executive profiles and career history
- Job postings and requirements
- LinkedIn posts (signal detection)
- Mutual connections (Yellow Panther → targets)
- Company posts (opportunity detection)
- Skills and endorsements
- Activity patterns
"""

import asyncio
import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

from schemas import LinkedInProfile, LinkedInEpisodeType, EntityProfile
from brightdata_sdk_client import BrightDataSDKClient

logger = logging.getLogger(__name__)


@dataclass
class MutualConnectionPath:
    """Represents a connection path between YP team member and target contact"""
    yp_member: str
    target_contact: str
    mutual_connections: List[str]
    path_strength: float
    connection_type: str  # 'direct', 'one_hop', 'two_hop'


@dataclass
class ConversationStarter:
    """Represents a conversation starter extracted from LinkedIn posts"""
    post_content: str
    post_date: str
    author: str
    relevance_score: float
    conversation_angle: str
    url: Optional[str]


@dataclass
class CurrentProvider:
    """Represents an identified current vendor/solution provider"""
    provider_name: str
    solution_type: str  # 'crm', 'analytics', 'digital', etc.
    confidence: float
    source_post: str
    mentioned_date: str


@dataclass
class CommunicationPattern:
    """Represents communication patterns of target contacts"""
    contact_name: str
    posting_frequency: str  # 'daily', 'weekly', 'monthly', 'rarely'
    best_contact_times: List[str]
    engagement_style: str  # 'active', 'passive', 'responsive'


@dataclass
class OutreachIntelligence:
    """
    Comprehensive outreach intelligence for sales team

    Provides:
    - Mutual connection paths for warm introductions
    - Conversation starters from recent posts
    - Current vendor relationships
    - Communication patterns for optimal outreach timing
    """
    entity_name: str
    mutual_paths: List[MutualConnectionPath]
    conversation_starters: List[ConversationStarter]
    current_providers: List[CurrentProvider]
    communication_patterns: List[CommunicationPattern]
    generated_at: datetime


class LinkedInProfiler:
    """
    Multi-pass LinkedIn profiling system

    Progressive refinement across temporal sweeps:
    - Pass 1: Quick cached sweep via BrightData
    - Pass 2: Targeted API deep dive for executives
    - Pass 3+: Hybrid with cache warming
    """

    def __init__(self, brightdata_client: BrightDataSDKClient):
        """
        Initialize LinkedIn profiler

        Args:
            brightdata_client: BrightData SDK client for scraping
        """
        self.brightdata = brightdata_client

        # Executive role keywords
        self.executive_keywords = [
            'cto', 'chief technology officer',
            'cio', 'chief information officer',
            'cdo', 'chief digital officer',
            'head of technology', 'head of digital',
            'technology director', 'digital director',
            'it director', 'procurement director',
            'head of procurement', 'vp of technology'
        ]

        # Provider keywords for vendor extraction
        self.provider_keywords = [
            'salesforce', 'hubspot', 'oracle', 'sap', 'microsoft',
            'adobe', 'google', 'amazon', 'aws', 'azure',
            'tableau', 'powerbi', 'looker', 'snowflake',
            'slack', 'zoom', 'teams', 'workday'
        ]

        # Solution type mapping
        self.solution_type_map = {
            'salesforce': 'crm',
            'hubspot': 'crm',
            'oracle': 'crm',
            'sap': 'crm',
            'tableau': 'analytics',
            'powerbi': 'analytics',
            'looker': 'analytics',
            'snowflake': 'data',
            'aws': 'cloud',
            'azure': 'cloud',
            'slack': 'collaboration',
            'zoom': 'collaboration',
            'teams': 'collaboration',
            'workday': 'hr',
            'adobe': 'marketing',
            'google': 'marketing',
            'amazon': 'cloud'
        }

    async def profile_entity(
        self,
        entity_name: str,
        pass_number: int = 1,
        use_cached: bool = True,
        previous_profiles: Optional[List[LinkedInProfile]] = None
    ) -> List[LinkedInProfile]:
        """
        Profile entity LinkedIn presence across multiple passes

        Args:
            entity_name: Entity name to search for
            pass_number: Sweep pass number (1=quick, 2=deep, 3+=hybrid)
            use_cached: Whether to use cached data (Pass 1)
            previous_profiles: Profiles from previous passes

        Returns:
            List of LinkedIn profiles found
        """
        logger.info(f"Starting LinkedIn profiling pass {pass_number} for {entity_name}")

        if pass_number == 1:
            # Pass 1: Quick cached sweep
            profiles = await self._pass_1_cached_sweep(entity_name)
        elif pass_number == 2:
            # Pass 2: Targeted deep dive
            profiles = await self._pass_2_targeted_deep_dive(entity_name, previous_profiles)
        else:
            # Pass 3+: Hybrid approach
            profiles = await self._pass_hybrid(entity_name, previous_profiles, pass_number)

        logger.info(f"LinkedIn profiling pass {pass_number} complete: {len(profiles)} profiles found")
        return profiles

    async def _pass_1_cached_sweep(self, entity_name: str) -> List[LinkedInProfile]:
        """
        Pass 1: Quick cached sweep using BrightData

        Searches for:
        - Job postings via LinkedIn
        - Company pages
        - Basic executive mentions

        Duration: ~30 seconds per entity
        """
        logger.info(f"Pass 1: Cached sweep for {entity_name}")

        profiles = []

        # Search for job postings
        try:
            jobs_results = await self.brightdata.scrape_jobs_board(
                entity_name=entity_name,
                keywords=['technology', 'digital', 'data', 'crm', 'analytics']
            )

            if jobs_results.get('status') == 'success':
                for job in jobs_results.get('results', [])[:10]:  # Limit to 10 jobs
                    profile = LinkedInProfile(
                        profile_id=f"job_{entity_name.replace(' ', '-')}_{job.get('position', 'unknown')}_{int(datetime.now(timezone.utc).timestamp())}",
                        entity_id=entity_name.replace(' ', '-').lower(),
                        profile_type="JOB_POSTING",
                        sweep_pass=1,
                        data_source="CACHE",
                        job_title=job.get('title'),
                        job_description=job.get('description'),
                        posting_date=self._parse_date(job.get('date')),
                        requirements=self._extract_requirements(job.get('description', '')),
                        confidence_score=0.7,  # Cached data confidence
                        version=1
                    )
                    profiles.append(profile)

                logger.info(f"Found {len(profiles)} job postings in Pass 1")
        except Exception as e:
            logger.error(f"Error scraping jobs board: {e}")

        # Search for company LinkedIn page
        try:
            company_search = await self.brightdata.search_engine(
                query=f'"{entity_name}" site:linkedin.com/company',
                engine='google',
                num_results=5
            )

            if company_search.get('status') == 'success':
                for result in company_search.get('results', []):
                    profile = LinkedInProfile(
                        profile_id=f"company_{entity_name.replace(' ', '-')}_{int(datetime.now(timezone.utc).timestamp())}",
                        entity_id=entity_name.replace(' ', '-').lower(),
                        profile_type="COMPANY",
                        sweep_pass=1,
                        data_source="CACHE",
                        company=entity_name,
                        profile_url=result.get('url'),
                        confidence_score=0.8,
                        version=1
                    )
                    profiles.append(profile)

                logger.info(f"Found company LinkedIn page in Pass 1")
        except Exception as e:
            logger.error(f"Error searching for company page: {e}")

        return profiles

    async def _pass_2_targeted_deep_dive(
        self,
        entity_name: str,
        previous_profiles: Optional[List[LinkedInProfile]]
    ) -> List[LinkedInProfile]:
        """
        Pass 2: Targeted deep dive for executive profiles

        Uses targeted searches for:
        - Executive names identified in Pass 1
        - Technology leadership roles
        - Procurement decision makers

        Duration: ~2 minutes per entity (with rate limiting)
        """
        logger.info(f"Pass 2: Targeted deep dive for {entity_name}")

        profiles = []

        # Extract executive names from previous pass
        executive_names = set()
        if previous_profiles:
            for profile in previous_profiles:
                # Check job descriptions for executive keywords
                if profile.job_description:
                    for keyword in self.executive_keywords:
                        if keyword in profile.job_description.lower():
                            # Try to extract name (simple heuristic)
                            # In production, would use NER
                            executive_names.add(keyword)

        logger.info(f"Found {len(executive_names)} executive roles to target")

        # Search for each executive role
        for role in list(executive_names)[:5]:  # Limit to 5 for cost
            try:
                exec_results = await self.brightdata.search_engine(
                    query=f'"{entity_name}" "{role}" site:linkedin.com',
                    engine='google',
                    num_results=3
                )

                if exec_results.get('status') == 'success':
                    for result in exec_results.get('results', []):
                        profile = LinkedInProfile(
                            profile_id=f"exec_{entity_name.replace(' ', '-')}_{role.replace(' ', '-')}_{int(datetime.now(timezone.utc).timestamp())}",
                            entity_id=entity_name.replace(' ', '-').lower(),
                            profile_type="EXECUTIVE",
                            sweep_pass=2,
                            data_source="API",
                            title=role,
                            company=entity_name,
                            profile_url=result.get('url'),
                            confidence_score=0.9,  # High confidence for direct LinkedIn URLs
                            version=1
                        )
                        profiles.append(profile)

            except Exception as e:
                logger.error(f"Error searching for {role}: {e}")

        logger.info(f"Pass 2 found {len(profiles)} executive profiles")
        return profiles

    async def _pass_hybrid(
        self,
        entity_name: str,
        previous_profiles: Optional[List[LinkedInProfile]],
        pass_number: int
    ) -> List[LinkedInProfile]:
        """
        Pass 3+: Hybrid approach with cache warming

        Combines:
        - Refresh stale cached data
        - Update existing profiles with new info
        - Targeted searches for gaps

        Duration: ~90 seconds per entity
        """
        logger.info(f"Pass {pass_number}: Hybrid approach for {entity_name}")

        profiles = []

        # Refresh job postings (cache warming)
        try:
            jobs_results = await self.brightdata.scrape_jobs_board(
                entity_name=entity_name,
                keywords=['technology', 'digital', 'data', 'crm', 'analytics']
            )

            if jobs_results.get('status') == 'success':
                for job in jobs_results.get('results', [])[:10]:
                    # Check if this is a new job posting
                    is_new = True
                    if previous_profiles:
                        for prev in previous_profiles:
                            if prev.job_title == job.get('title'):
                                is_new = False
                                break

                    if is_new:
                        profile = LinkedInProfile(
                            profile_id=f"job_{entity_name.replace(' ', '-')}_{job.get('position', 'unknown')}_{int(datetime.now(timezone.utc).timestamp())}",
                            entity_id=entity_name.replace(' ', '-').lower(),
                            profile_type="JOB_POSTING",
                            sweep_pass=pass_number,
                            data_source="HYBRID",
                            job_title=job.get('title'),
                            job_description=job.get('description'),
                            posting_date=self._parse_date(job.get('date')),
                            requirements=self._extract_requirements(job.get('description', '')),
                            confidence_score=0.8,
                            version=pass_number
                        )
                        profiles.append(profile)

        except Exception as e:
            logger.error(f"Error in hybrid job search: {e}")

        # Update executive profiles if any
        if previous_profiles:
            for prev_profile in previous_profiles:
                if prev_profile.profile_type == "EXECUTIVE":
                    # Create updated version
                    updated_profile = LinkedInProfile(
                        profile_id=prev_profile.profile_id,
                        entity_id=prev_profile.entity_id,
                        profile_type=prev_profile.profile_type,
                        sweep_pass=pass_number,
                        data_source="HYBRID",
                        name=prev_profile.name,
                        title=prev_profile.title,
                        company=prev_profile.company,
                        profile_url=prev_profile.profile_url,
                        career_history=prev_profile.career_history,
                        skills=prev_profile.skills,
                        connections_count=prev_profile.connections_count,
                        collected_at=datetime.now(timezone.utc),
                        confidence_score=prev_profile.confidence_score * 0.95,  # Slight decay
                        version=pass_number
                    )
                    profiles.append(updated_profile)

        logger.info(f"Pass {pass_number} found/updated {len(profiles)} profiles")
        return profiles

    def _parse_date(self, date_str: Optional[str]) -> Optional[datetime]:
        """Parse date string to datetime"""
        if not date_str:
            return None

        try:
            # Try common formats
            for fmt in ['%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y']:
                try:
                    return datetime.strptime(date_str, fmt)
                except ValueError:
                    continue
        except Exception as e:
            logger.warning(f"Could not parse date {date_str}: {e}")

        return None

    async def extract_outreach_intelligence(
        self,
        entity_name: str,
        target_contacts: List[str],
        yp_team_members: List[str],
        days_to_lookback: int = 30
    ) -> OutreachIntelligence:
        """
        Extract comprehensive outreach intelligence for sales team

        Provides:
        - Mutual connection paths for warm introductions
        - Conversation starters from recent posts
        - Current vendor relationships
        - Communication patterns for optimal outreach timing

        Args:
            entity_name: Target entity name
            target_contacts: List of target contact LinkedIn URLs or names
            yp_team_members: List of Yellow Panther team member LinkedIn URLs or names
            days_to_lookback: How many days back to analyze posts (default: 30)

        Returns:
            OutreachIntelligence object with all extracted intelligence
        """
        logger.info(f"Extracting outreach intelligence for {entity_name}")
        logger.info(f"Target contacts: {len(target_contacts)}, YP team: {len(yp_team_members)}")

        mutual_paths = []
        conversation_starters = []
        current_providers = []
        communication_patterns = []

        # Analyze each target contact
        for contact in target_contacts[:10]:  # Limit to 10 for cost control
            try:
                # 1. Find mutual connections with YP team
                for yp_member in yp_team_members[:5]:  # Limit YP team to 5
                    mutuals = await self._find_mutual_connections(yp_member, contact)
                    if mutuals:
                        path_strength = self._calculate_path_strength(mutuals)
                        connection_type = 'direct' if len(mutuals) > 3 else 'one_hop' if len(mutuals) > 0 else 'two_hop'

                        mutual_paths.append(MutualConnectionPath(
                            yp_member=yp_member,
                            target_contact=contact,
                            mutual_connections=mutuals,
                            path_strength=path_strength,
                            connection_type=connection_type
                        ))

                # 2. Extract recent posts
                recent_posts = await self._get_recent_posts(contact, days_to_lookback)
                for post in recent_posts[:5]:  # Top 5 posts per contact
                    if self._is_post_relevant(post, entity_name):
                        relevance_score = self._score_post_relevance(post)
                        conversation_angle = self._generate_conversation_angle(post, entity_name)

                        conversation_starters.append(ConversationStarter(
                            post_content=post.get('content', '')[:500],
                            post_date=post.get('date', ''),
                            author=post.get('author', contact),
                            relevance_score=relevance_score,
                            conversation_angle=conversation_angle,
                            url=post.get('url')
                        ))

                        # 3. Extract current providers from posts
                        providers = self._extract_providers(post, self.provider_keywords)
                        for provider in providers:
                            solution_type = self.solution_type_map.get(provider.lower(), 'other')

                            # Avoid duplicates
                            existing = [p for p in current_providers if p.provider_name.lower() == provider.lower()]
                            if not existing:
                                current_providers.append(CurrentProvider(
                                    provider_name=provider,
                                    solution_type=solution_type,
                                    confidence=0.7,
                                    source_post=post.get('content', '')[:200],
                                    mentioned_date=post.get('date', '')
                                ))

                # 4. Analyze communication patterns
                if recent_posts:
                    comm_pattern = self._analyze_communication_pattern(contact, recent_posts)
                    communication_patterns.append(comm_pattern)

            except Exception as e:
                logger.error(f"Error extracting intelligence for {contact}: {e}")
                continue

        intelligence = OutreachIntelligence(
            entity_name=entity_name,
            mutual_paths=mutual_paths,
            conversation_starters=conversation_starters,
            current_providers=current_providers,
            communication_patterns=communication_patterns,
            generated_at=datetime.now(timezone.utc)
        )

        logger.info(f"Extracted outreach intelligence: {len(mutual_paths)} paths, "
                   f"{len(conversation_starters)} starters, {len(current_providers)} providers")

        return intelligence

    async def _find_mutual_connections(self, yp_member: str, contact: str) -> List[str]:
        """
        Find mutual connections between YP team member and target contact

        Args:
            yp_member: YP team member LinkedIn URL or name
            contact: Target contact LinkedIn URL or name

        Returns:
            List of mutual connection names/URLs
        """
        try:
            # Search for mutual connections
            search_query = f'"{yp_member}" "{contact}" mutual connections site:linkedin.com'
            results = await self.brightdata.search_engine(
                query=search_query,
                engine='google',
                num_results=5
            )

            mutuals = []
            if results.get('status') == 'success':
                for result in results.get('results', []):
                    # Extract mutual connection names from snippets
                    snippet = result.get('snippet', '')
                    # Simple extraction - in production would use proper parsing
                    if 'mutual' in snippet.lower():
                        mutuals.append(result.get('title', 'Unknown Connection'))

            return mutuals[:5]  # Limit to 5 mutual connections

        except Exception as e:
            logger.error(f"Error finding mutual connections: {e}")
            return []

    async def _get_recent_posts(self, contact: str, days: int) -> List[Dict]:
        """
        Get recent posts from a contact

        Args:
            contact: Contact LinkedIn URL or name
            days: Number of days to look back

        Returns:
            List of posts with metadata
        """
        try:
            # Search for recent posts
            date_filter = f"after:{datetime.now(timezone.utc) - timedelta(days=days)}"
            search_query = f'"{contact}" posts site:linkedin.com {date_filter}'
            results = await self.brightdata.search_engine(
                query=search_query,
                engine='google',
                num_results=10
            )

            posts = []
            if results.get('status') == 'success':
                for result in results.get('results', []):
                    # Scrape the post content
                    content = await self.brightdata.scrape_as_markdown(result.get('url'))
                    posts.append({
                        'content': content.get('content', ''),
                        'url': result.get('url'),
                        'date': result.get('date', datetime.now(timezone.utc).isoformat()),
                        'author': contact,
                        'snippet': result.get('snippet', '')
                    })

            return posts

        except Exception as e:
            logger.error(f"Error getting recent posts: {e}")
            return []

    def _is_post_relevant(self, post: Dict, entity_name: str) -> bool:
        """
        Check if post is relevant to target entity

        Args:
            post: Post data dictionary
            entity_name: Target entity name

        Returns:
            True if post is relevant
        """
        content_lower = post.get('content', '').lower()
        snippet_lower = post.get('snippet', '').lower()

        # Relevance keywords
        relevance_keywords = [
            'technology', 'digital', 'crm', 'analytics', 'data',
            'transformation', 'innovation', 'vendor', 'partner',
            'procurement', 'rfp', 'tender', 'hiring', 'investing'
        ]

        # Check if any relevance keyword is present
        for keyword in relevance_keywords:
            if keyword in content_lower or keyword in snippet_lower:
                return True

        return False

    def _score_post_relevance(self, post: Dict) -> float:
        """
        Score post relevance based on content

        Args:
            post: Post data dictionary

        Returns:
            Relevance score between 0.0 and 1.0
        """
        score = 0.5  # Base score
        content = post.get('content', '').lower()

        # High relevance keywords (+0.2 each)
        high_relevance = ['procurement', 'rfp', 'tender', 'vendor selection', 'crm', 'analytics']
        for keyword in high_relevance:
            if keyword in content:
                score += 0.2

        # Medium relevance keywords (+0.1 each)
        medium_relevance = ['technology', 'digital', 'transformation', 'hiring', 'investing']
        for keyword in medium_relevance:
            if keyword in content:
                score += 0.1

        return min(score, 1.0)  # Cap at 1.0

    def _generate_conversation_angle(self, post: Dict, entity_name: str) -> str:
        """
        Generate conversation angle from post content

        Args:
            post: Post data dictionary
            entity_name: Target entity name

        Returns:
            Conversation angle string
        """
        content = post.get('content', '').lower()

        # Conversation angle mappings
        angles = {
            'procurement': f"I noticed your post about procurement initiatives at {entity_name}. Would love to share how we've helped similar organizations streamline their vendor selection process.",
            'rfp': f"Saw your post about RFP activity. We've recently helped several organizations navigate similar procurement processes - would be happy to share insights.",
            'digital transformation': f"Interesting post on digital transformation. We're currently working with sports organizations on similar modernization initiatives.",
            'hiring': f"Congratulations on the team growth! This suggests exciting digital initiatives at {entity_name}. We'd love to support your expansion.",
            'analytics': f"Great insights on analytics! We've been helping organizations unlock value from their data - would love to compare notes.",
            'technology': f"Fascinating perspective on technology. Given your focus in this area, you might be interested in recent advancements we've seen in the sports industry."
        }

        # Find best matching angle
        for keyword, angle in angles.items():
            if keyword in content:
                return angle

        # Default angle
        return f"I came across your recent post and thought it might be valuable to connect. Given the exciting initiatives at {entity_name}, there could be interesting synergies."

    def _extract_providers(self, post: Dict, keywords: List[str]) -> List[str]:
        """
        Extract current providers/vendor mentions from post

        Args:
            post: Post data dictionary
            keywords: Provider keywords to look for

        Returns:
            List of provider names found
        """
        content = post.get('content', '').lower()
        found_providers = []

        for keyword in keywords:
            if keyword.lower() in content:
                found_providers.append(keyword)

        return found_providers

    def _calculate_path_strength(self, mutuals: List[str]) -> float:
        """
        Calculate connection path strength based on mutual connections

        Args:
            mutuals: List of mutual connection names

        Returns:
            Path strength score between 0.0 and 1.0
        """
        if not mutuals:
            return 0.0

        # Strength formula: logarithmic scaling
        # 1 mutual = 0.3, 2-3 = 0.5, 4-5 = 0.7, 6+ = 0.9
        count = len(mutuals)

        if count == 1:
            return 0.3
        elif count <= 3:
            return 0.5
        elif count <= 5:
            return 0.7
        else:
            return 0.9

    def _analyze_communication_pattern(self, contact: str, posts: List[Dict]) -> CommunicationPattern:
        """
        Analyze communication patterns from posts

        Args:
            contact: Contact name/URL
            posts: List of posts from contact

        Returns:
            CommunicationPattern object
        """
        # Calculate posting frequency
        if not posts:
            return CommunicationPattern(
                contact_name=contact,
                posting_frequency='rarely',
                best_contact_times=[],
                engagement_style='passive'
            )

        # Count posts in last 30 days
        recent_count = len(posts)

        if recent_count >= 20:
            frequency = 'daily'
        elif recent_count >= 8:
            frequency = 'weekly'
        elif recent_count >= 2:
            frequency = 'monthly'
        else:
            frequency = 'rarely'

        # Determine engagement style based on content
        total_length = sum(len(post.get('content', '')) for post in posts)
        avg_length = total_length / len(posts) if posts else 0

        if avg_length > 500:
            engagement = 'active'  # Long, thoughtful posts
        elif avg_length > 200:
            engagement = 'responsive'  # Moderate engagement
        else:
            engagement = 'passive'  # Short, minimal posts

        # Best contact times (simplified - would analyze actual timestamps)
        best_times = ['Tuesday', 'Wednesday', 'Thursday']  # Midweek typically best

        return CommunicationPattern(
            contact_name=contact,
            posting_frequency=frequency,
            best_contact_times=best_times,
            engagement_style=engagement
        )

    def _extract_requirements(self, job_description: str) -> List[str]:
        """Extract skill requirements from job description"""
        requirements = []

        # Common skill keywords
        skill_keywords = [
            'python', 'java', 'javascript', 'react', 'angular', 'vue',
            'sql', 'nosql', 'mongodb', 'postgresql', 'mysql',
            'aws', 'azure', 'gcp', 'cloud',
            'crm', 'salesforce', 'hubspot',
            'analytics', 'tableau', 'powerbi', 'looker',
            'ai', 'ml', 'machine learning', 'data science'
        ]

        description_lower = job_description.lower()
        for skill in skill_keywords:
            if skill in description_lower:
                requirements.append(skill)

        return requirements

    async def extract_decision_makers(
        self,
        profiles: List[LinkedInProfile],
        entity_name: str
    ) -> List[Dict[str, Any]]:
        """
        Extract decision maker information from LinkedIn profiles

        Args:
            profiles: LinkedIn profiles from sweeps
            entity_name: Entity name

        Returns:
            List of decision makers with contact info
        """
        decision_makers = []

        for profile in profiles:
            # Check if profile is an executive
            if profile.profile_type != "EXECUTIVE":
                continue

            # Check if title matches decision maker keywords
            title_lower = (profile.title or "").lower()
            is_decision_maker = any(keyword in title_lower for keyword in self.executive_keywords)

            if is_decision_maker:
                decision_maker = {
                    'name': profile.name,
                    'title': profile.title,
                    'company': profile.company,
                    'profile_url': profile.profile_url,
                    'confidence': profile.confidence_score,
                    'sweep_pass': profile.sweep_pass,
                    'data_source': profile.data_source
                }
                decision_makers.append(decision_maker)

        logger.info(f"Extracted {len(decision_makers)} decision makers from profiles")
        return decision_makers

    async def scrape_linkedin_posts(
        self,
        entity_name: str,
        profile_url: Optional[str] = None,
        max_posts: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Scrape LinkedIn posts from entity or profile for signal detection

        Detects:
        - RFP mentions
        - Technology needs
        - Partnership announcements
        - Hiring signals
        - Digital transformation initiatives

        Args:
            entity_name: Entity name to search for
            profile_url: Optional specific profile URL
            max_posts: Maximum posts to scrape

        Returns:
            List of posts with signal analysis
        """
        logger.info(f"Scraping LinkedIn posts for {entity_name}")

        posts = []

        # Search for company posts
        try:
            search_query = f'"{entity_name}" site:linkedin.com/company/posts'
            results = await self.brightdata.search_engine(
                query=search_query,
                engine='google',
                num_results=5
            )

            if results.get('status') == 'success':
                for result in results.get('results', [])[:3]:
                    # Scrape the posts page
                    post_content = await self.brightdata.scrape_as_markdown(result.get('url'))

                    # Extract posts from content (simplified - in production would parse HTML)
                    post_data = self._extract_posts_from_content(
                        post_content.get('content', ''),
                        entity_name
                    )
                    posts.extend(post_data)

        except Exception as e:
            logger.error(f"Error scraping LinkedIn posts: {e}")

        logger.info(f"Scraped {len(posts)} LinkedIn posts")
        return posts

    async def scrape_mutual_connections(
        self,
        yellow_panther_profile_url: str,
        target_entity_profiles: List[LinkedInProfile]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Scrape mutual connections between Yellow Panther and target entities

        Useful for:
        - Warm introductions
        - Relationship mapping
        - Network analysis
        - Partnership opportunities

        Args:
            yellow_panther_profile_url: Yellow Panther's LinkedIn profile URL
            target_entity_profiles: List of target entity profiles

        Returns:
            Dictionary mapping target entity to mutual connections
        """
        logger.info(f"Scraping mutual connections for {len(target_entity_profiles)} entities")

        mutual_connections = {}

        # In production, would use LinkedIn's mutual connections feature
        # For now, we'll scrape profiles and look for shared connections

        for profile in target_entity_profiles[:5]:  # Limit to 5 for cost
            if profile.profile_url:
                try:
                    # Scrape the profile
                    content = await self.brightdata.scrape_as_markdown(profile.profile_url)

                    # Look for mutual connections indicators
                    # (This is simplified - real implementation would need more sophisticated parsing)
                    mutuals = self._extract_mutual_connections_from_content(
                        content.get('content', ''),
                        profile.entity_id
                    )

                    if mutuals:
                        mutual_connections[profile.entity_id] = mutuals

                except Exception as e:
                    logger.error(f"Error scraping mutuals for {profile.entity_id}: {e}")

        logger.info(f"Found mutual connections for {len(mutual_connections)} entities")
        return mutual_connections

    async def scrape_company_posts_for_opportunities(
        self,
        entity_name: str,
    ) -> List[Dict[str, Any]]:
        """
        Scrape company LinkedIn posts for procurement opportunities

        Detects:
        - RFP announcements
        - Technology procurement needs
        - Digital transformation initiatives
        - Partnership requests
        - Budget allocations
        - Strategic priorities

        Args:
            entity_name: Entity name to search for

        Returns:
            List of opportunity signals from posts
        """
        logger.info(f"Scraping company posts for opportunities: {entity_name}")

        opportunities = []

        try:
            # Search for recent company posts
            search_results = await self.brightdata.search_engine(
                query=f'"{entity_name}" posts site:linkedin.com/company',
                engine='google',
                num_results=10
            )

            if search_results.get('status') == 'success':
                for result in search_results.get('results', [])[:5]:
                    # Scrape the post
                    content = await self.brightdata.scrape_as_markdown(result.get('url'))

                    # Analyze for opportunity signals
                    signals = self._analyze_post_for_opportunities(
                        content.get('content', ''),
                        entity_name,
                        result.get('url')
                    )

                    opportunities.extend(signals)

        except Exception as e:
            logger.error(f"Error scraping company posts: {e}")

        logger.info(f"Found {len(opportunities)} opportunity signals")
        return opportunities

    def _extract_posts_from_content(
        self,
        content: str,
        entity_name: str
    ) -> List[Dict[str, Any]]:
        """Extract individual posts from scraped content"""
        posts = []

        # Split by common post indicators
        # This is simplified - production would use proper HTML parsing
        lines = content.split('\n')
        current_post = []

        for line in lines:
            if len(line.strip()) > 50:  # Likely post content
                current_post.append(line.strip())
            elif current_post:
                # End of post, analyze it
                post_text = '\n'.join(current_post)
                signals = self._analyze_post_for_signals(post_text, entity_name)

                if signals:
                    posts.append({
                        'content': post_text[:500],  # Limit length
                        'signals': signals,
                        'scraped_at': datetime.now(timezone.utc).isoformat()
                    })

                current_post = []

        return posts

    def _analyze_post_for_signals(
        self,
        post_text: str,
        entity_name: str
    ) -> List[str]:
        """Analyze post content for procurement signals"""
        signals = []
        post_lower = post_text.lower()

        # Signal keywords
        signal_keywords = {
            'rfp': ['request for proposal', 'rfp', 'tender', 'procurement'],
            'technology': ['crm', 'analytics', 'digital transformation', 'ai', 'ml', 'cloud'],
            'hiring': ['hiring', 'we are looking', 'join our team', 'career opportunity'],
            'partnership': ['partnership', 'collaboration', 'strategic alliance', 'vendor'],
            'expansion': ['expanding', 'growing', 'new initiative', 'launching']
        }

        for signal_type, keywords in signal_keywords.items():
            if any(keyword in post_lower for keyword in keywords):
                signals.append(signal_type)

        return signals

    def _extract_mutual_connections_from_content(
        self,
        content: str,
        entity_id: str
    ) -> List[Dict[str, Any]]:
        """Extract mutual connections from profile content"""
        mutuals = []

        # Look for mutual connections indicators
        # (Simplified - production would use proper parsing)
        if 'mutual connection' in content.lower():
            # Extract names/roles
            lines = content.split('\n')
            for i, line in enumerate(lines):
                if 'mutual' in line.lower():
                    # Get context around the mention
                    context = '\n'.join(lines[max(0, i-2):i+3])
                    mutuals.append({
                        'context': context[:200],
                        'entity_id': entity_id,
                        'detected_at': datetime.now(timezone.utc).isoformat()
                    })

        return mutuals

    def _analyze_post_for_opportunities(
        self,
        post_content: str,
        entity_name: str,
        source_url: str
    ) -> List[Dict[str, Any]]:
        """Analyze company post for procurement opportunities"""
        opportunities = []
        post_lower = post_content.lower()

        # Opportunity patterns
        opportunity_patterns = {
            'RFP_SIGNAL': ['request for proposal', 'rfp', 'tender', 'bid'],
            'TECHNOLOGY_NEED': ['looking for', 'seeking', 'need', 'requirement'],
            'DIGITAL_INITIATIVE': ['digital transformation', 'modernizing', 'upgrading'],
            'PARTNERSHIP_OPPORTUNITY': ['strategic partner', 'vendor partnership', 'collaboration'],
            'HIRING_SIGNAL': ['hiring for', 'growing team', 'new role'],
            'BUDGET_INDICATOR': ['investing in', 'allocating budget', 'funding']
        }

        for opp_type, patterns in opportunity_patterns.items():
            for pattern in patterns:
                if pattern in post_lower:
                    # Extract context around the match
                    idx = post_lower.find(pattern)
                    context_start = max(0, idx - 100)
                    context_end = min(len(post_content), idx + 200)
                    context = post_content[context_start:context_end].strip()

                    opportunities.append({
                        'opportunity_type': opp_type,
                        'pattern_matched': pattern,
                        'context': context,
                        'source_url': source_url,
                        'entity_name': entity_name,
                        'detected_at': datetime.now(timezone.utc).isoformat(),
                        'confidence': 0.7  # Base confidence
                    })

                    # Don't add duplicate opportunities for same post
                    break

        return opportunities


# Example usage
if __name__ == "__main__":
    import asyncio
    from brightdata_sdk_client import BrightDataSDKClient

    async def test_linkedin_profiler():
        brightdata = BrightDataSDKClient()
        profiler = LinkedInProfiler(brightdata)

        # Pass 1: Quick sweep
        pass1_profiles = await profiler.profile_entity("Arsenal FC", pass_number=1)
        print(f"Pass 1: {len(pass1_profiles)} profiles")

        # Pass 2: Deep dive
        pass2_profiles = await profiler.profile_entity("Arsenal FC", pass_number=2, previous_profiles=pass1_profiles)
        print(f"Pass 2: {len(pass2_profiles)} profiles")

        # Extract decision makers
        decision_makers = await profiler.extract_decision_makers(pass1_profiles + pass2_profiles, "Arsenal FC")
        print(f"Decision makers: {len(decision_makers)}")

        # Extract outreach intelligence
        intelligence = await profiler.extract_outreach_intelligence(
            entity_name="Arsenal FC",
            target_contacts=["https://linkedin.com/in/cto-arsenal", "https://linkedin.com/in/cio-arsenal"],
            yp_team_members=["https://linkedin.com/in/yp-founder", "https://linkedin.com/in/yp-sales"],
            days_to_lookback=30
        )

        print(f"\nOutreach Intelligence for {intelligence.entity_name}:")
        print(f"Mutual Paths: {len(intelligence.mutual_paths)}")
        for path in intelligence.mutual_paths[:3]:
            print(f"  - {path.yp_member} -> {path.target_contact}: {path.path_strength:.2f} strength ({path.connection_type})")

        print(f"\nConversation Starters: {len(intelligence.conversation_starters)}")
        for starter in intelligence.conversation_starters[:2]:
            print(f"  - Relevance: {starter.relevance_score:.2f}")
            print(f"    Angle: {starter.conversation_angle[:100]}...")

        print(f"\nCurrent Providers: {len(intelligence.current_providers)}")
        for provider in intelligence.current_providers[:5]:
            print(f"  - {provider.provider_name} ({provider.solution_type}): {provider.confidence:.2f} confidence")

        print(f"\nCommunication Patterns: {len(intelligence.communication_patterns)}")
        for pattern in intelligence.communication_patterns[:3]:
            print(f"  - {pattern.contact_name}: {pattern.posting_frequency} posting, {pattern.engagement_style} engagement")

    asyncio.run(test_linkedin_profiler())
