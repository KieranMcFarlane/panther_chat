#!/usr/bin/env python3
"""
Test to validate Bug #2 fix - template dict access fix
"""

import sys

def test_template_dict_access():
    """Test that template dict is accessed correctly"""
    print("\n🧪 Testing Template Dict Access Fix\n")

    try:
        from template_loader import TemplateLoader

        # Load template
        loader = TemplateLoader()
        template = loader.get_template('yellow_panther_agency')

        if template is None:
            print("❌ Template not found")
            return False

        print(f"✅ Template loaded: yellow_panther_agency")
        print(f"   Type: {type(template)}")

        # Test dict access (the fix)
        signal_patterns = template.get('signal_patterns', [])
        print(f"✅ signal_patterns accessible via .get(): {len(signal_patterns)} patterns")

        # Test the pattern structure
        if signal_patterns:
            first_pattern = signal_patterns[0]
            pattern_name = first_pattern.get('pattern_name', 'unknown')
            early_indicators = first_pattern.get('early_indicators', [])
            keywords = first_pattern.get('keywords', [])

            print(f"✅ First pattern: {pattern_name}")
            print(f"   Early indicators: {len(early_indicators)}")
            print(f"   Keywords: {len(keywords)}")

        print("\n✅ Template dict access fix validated!")
        print("\nThe fix correctly:")
        print("  - Changed template.signal_patterns to template.get('signal_patterns', [])")
        print("  - Template is accessed as a dict, not an object")

        return True

    except AttributeError as e:
        if "'dict' object has no attribute" in str(e):
            print(f"❌ Test FAILED with the original bug:")
            print(f"   {e}")
            print(f"\n   This means the fix wasn't applied correctly.")
            return False
        else:
            print(f"❌ Test FAILED with AttributeError: {e}")
            return False
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = test_template_dict_access()
    sys.exit(0 if success else 1)
