"""
Template Loader

Loads discovery templates from JSON files in bootstrapped_templates/.

Templates define hypothesis patterns for entity discovery:
- Signal patterns (categories, keywords, early indicators)
- Discovery strategies
- Confidence weights
- Entity types

Usage:
    from template_loader import TemplateLoader

    loader = TemplateLoader()
    template = loader.get_template("yellow_panther_agency")
"""

import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)


class TemplateLoader:
    """Load discovery templates from JSON files"""

    def __init__(self, template_dir: Optional[str] = None):
        """
        Initialize template loader

        Args:
            template_dir: Directory containing template JSON files
        """
        if template_dir is None:
            # Default to bootstrapped_templates directory
            current_dir = Path(__file__).parent
            template_dir = current_dir / "bootstrapped_templates"

        self.template_dir = Path(template_dir)
        logger.info(f"📁 Template loader initialized: {self.template_dir}")

    def get_template(self, template_id: str) -> Optional[Dict[str, Any]]:
        """
        Load template by ID

        Args:
            template_id: Template identifier (e.g., "yellow_panther_agency")

        Returns:
            Template dictionary or None if not found
        """
        # Try loading from JSON file with matching name
        template_file = self.template_dir / f"{template_id}.json"

        if template_file.exists():
            try:
                with open(template_file, 'r') as f:
                    template = json.load(f)

                logger.info(f"✅ Loaded template: {template_id} from {template_file.name}")
                return template

            except Exception as e:
                logger.error(f"❌ Error loading template {template_id}: {e}")
                return None

        # If not found as direct file, search in production_templates.json
        production_file = self.template_dir / "production_templates.json"

        if production_file.exists():
            try:
                with open(production_file, 'r') as f:
                    templates = json.load(f)

                # Handle both list and dict formats
                if isinstance(templates, list):
                    for template in templates:
                        if template.get('template_id') == template_id:
                            logger.info(f"✅ Found template: {template_id} in production_templates.json")
                            return template

                elif isinstance(templates, dict):
                    if template_id in templates:
                        logger.info(f"✅ Found template: {template_id} in production_templates.json")
                        return templates[template_id]

            except Exception as e:
                logger.error(f"❌ Error loading production templates: {e}")

        logger.warning(f"⚠️ Template not found: {template_id}")
        return None

    def list_templates(self) -> List[str]:
        """
        List all available templates

        Returns:
            List of template IDs
        """
        templates = []

        # List all JSON files in template directory
        for json_file in self.template_dir.glob("*.json"):
            template_id = json_file.stem
            templates.append(template_id)

        return templates

    def get_all_templates(self) -> Dict[str, Dict[str, Any]]:
        """
        Load all templates

        Returns:
            Dictionary mapping template_id to template data
        """
        all_templates = {}

        for json_file in self.template_dir.glob("*.json"):
            try:
                with open(json_file, 'r') as f:
                    template = json.load(f)

                # Get template ID
                if isinstance(template, list):
                    for t in template:
                        template_id = t.get('template_id', json_file.stem)
                        all_templates[template_id] = t
                elif isinstance(template, dict):
                    # Check if this is a collection of templates
                    if 'template_id' in template:
                        # Single template
                        template_id = template['template_id']
                        all_templates[template_id] = template
                    else:
                        # Collection of templates
                        for template_id, t in template.items():
                            all_templates[template_id] = t

            except Exception as e:
                logger.warning(f"⚠️ Could not load {json_file.name}: {e}")

        logger.info(f"📚 Loaded {len(all_templates)} templates")
        return all_templates


# Convenience function
def load_template(template_id: str, template_dir: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Convenience function to load a template

    Args:
        template_id: Template identifier
        template_dir: Optional template directory path

    Returns:
        Template dictionary or None if not found
    """
    loader = TemplateLoader(template_dir)
    return loader.get_template(template_id)
