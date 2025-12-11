-- Create validation_rules table for storing file validation rules
CREATE TABLE IF NOT EXISTS public.validation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_type TEXT NOT NULL CHECK (file_type IN ('json', 'csv', 'xml', 'yaml')),
  category TEXT NOT NULL CHECK (category IN ('syntax', 'structure', 'semantics', 'format', 'performance')),
  rule_name TEXT NOT NULL,
  rule_description TEXT NOT NULL,
  rule_example TEXT,
  common_mistake TEXT,
  fix_suggestion TEXT,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(file_type, category, rule_name)
);

-- Create validation_patterns table for regex patterns
CREATE TABLE IF NOT EXISTS public.validation_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_type TEXT NOT NULL CHECK (file_type IN ('json', 'csv', 'xml', 'yaml')),
  pattern_name TEXT NOT NULL,
  pattern_regex TEXT NOT NULL,
  pattern_description TEXT,
  error_message TEXT,
  severity TEXT DEFAULT 'high' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(file_type, pattern_name)
);

-- Create indexes for fast queries
CREATE INDEX idx_validation_rules_file_type ON public.validation_rules(file_type);
CREATE INDEX idx_validation_rules_category ON public.validation_rules(category);
CREATE INDEX idx_validation_rules_active ON public.validation_rules(is_active);
CREATE INDEX idx_validation_patterns_file_type ON public.validation_patterns(file_type);

-- Enable RLS (Row Level Security)
ALTER TABLE public.validation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validation_patterns ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public read access (anon users can read rules)
CREATE POLICY "Allow public read validation_rules" ON public.validation_rules
  FOR SELECT USING (true);

CREATE POLICY "Allow public read validation_patterns" ON public.validation_patterns
  FOR SELECT USING (true);

-- ============================================================================
-- INSERT JSON RULES
-- ============================================================================

INSERT INTO public.validation_rules (file_type, category, rule_name, rule_description, rule_example, common_mistake, fix_suggestion, severity) VALUES
('json', 'syntax', 'no_trailing_commas', 'JSON does not allow trailing commas after the last element', '{"name": "John", "age": 30}', '{"name": "John", "age": 30,}', 'Remove the comma after the last element', 'critical'),
('json', 'syntax', 'quoted_keys', 'All object keys must be wrapped in double quotes', '{"name": "John"}', '{name: "John"}', 'Wrap all keys in double quotes', 'critical'),
('json', 'syntax', 'quoted_strings', 'All string values must be wrapped in double quotes (not single)', '{"name": "John"}', "{'name': 'John'}", 'Use double quotes for all strings', 'critical'),
('json', 'syntax', 'no_unquoted_values', 'Property values must be quoted strings, numbers, booleans, null, objects, or arrays', '{"active": true}', '{"name": John}', 'Quote string values or use proper JSON types', 'critical'),
('json', 'syntax', 'valid_escape_sequences', 'Only valid escape sequences are allowed: \", \, /, b, f, n, r, t, uXXXX', '{"path": "C:\\\\Users\\\\John"}', '{"path": "C:\Users\John"}', 'Use double backslashes or forward slashes in paths', 'high'),
('json', 'structure', 'balanced_braces', 'All opening braces { must have matching closing braces }', '{"user": {"name": "John"}}', '{"user": {"name": "John"}', 'Add missing closing braces', 'critical'),
('json', 'structure', 'balanced_brackets', 'All opening brackets [ must have matching closing brackets ]', '{"items": [1, 2, 3]}', '{"items": [1, 2, 3}', 'Change closing bracket from } to ]', 'critical'),
('json', 'structure', 'valid_array_items', 'Array items must be valid JSON values separated by commas', '[1, 2, 3]', '[1, 2, 3,]', 'Remove trailing comma before ]', 'high'),
('json', 'structure', 'nested_structure', 'Objects and arrays can be nested, but must maintain proper syntax', '{"user": {"profile": {"age": 30}}}', '{"user": {"profile": {age: 30}}}', 'Quote all object keys properly', 'high'),
('json', 'semantics', 'type_consistency', 'Ensure values maintain their intended types (string, number, boolean, null, object, array)', '{"age": 30, "count": 5}', '{"age": "30", "count": 5}', 'Keep numeric values as numbers without quotes', 'medium'),
('json', 'semantics', 'required_fields', 'Check if all required fields are present in objects', '{"name": "John", "email": "john@example.com"}', '{"name": "John"}', 'Add missing required fields (email, etc.)', 'high'),
('json', 'format', 'consistent_naming', 'Use consistent property naming conventions (snake_case, camelCase, or PascalCase)', '{"first_name": "John", "last_name": "Doe"}', '{"first_name": "John", "lastName": "Doe"}', 'Use consistent naming: either first_name/last_name or firstName/lastName', 'medium'),
('json', 'format', 'proper_indentation', 'Use consistent indentation (usually 2 or 4 spaces)', '{"name":"John","age":30}', 'Inconsistent or missing indentation', 'Use consistent spacing with 2 or 4 spaces per level', 'low'),
('json', 'format', 'no_comments', 'JSON does not support comments (unlike JavaScript)', '{"name": "John"}', '{"name": "John"} // This is a name', 'Remove all comments; use a comment field as a string if needed', 'medium')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- INSERT CSV RULES
-- ============================================================================

INSERT INTO public.validation_rules (file_type, category, rule_name, rule_description, rule_example, common_mistake, fix_suggestion, severity) VALUES
('csv', 'structure', 'consistent_column_count', 'All rows must have the same number of columns as the header', 'name,age,email\nJohn,30,john@example.com', 'name,age,email\nJohn,30', 'Add missing columns or ensure all rows have matching number of fields', 'critical'),
('csv', 'structure', 'header_present', 'First row should contain column headers', 'name,age,email', 'John,30,john@example.com', 'Add header row at the beginning', 'high'),
('csv', 'format', 'proper_quoting', 'Fields containing commas, quotes, or newlines must be quoted', 'name,description\nProduct,"Has, comma"', 'name,description\nProduct,Has, comma', 'Quote fields containing special characters: "Has, comma"', 'high'),
('csv', 'format', 'escaped_quotes', 'Quotes inside quoted fields must be doubled', 'name,description\nBook,"She said ""Hello"""', 'name,description\nBook,"She said "Hello""', 'Double all quotes inside quoted fields: ""', 'high'),
('csv', 'format', 'consistent_delimiter', 'Use consistent delimiter (comma, semicolon, or tab) throughout the file', 'name,age,city\nJohn,30,NYC', 'name,age,city\nJohn;30;NYC', 'Use the same delimiter (comma) throughout all rows', 'medium'),
('csv', 'format', 'no_extra_spaces', 'Avoid extra spaces around delimiters (unless field is quoted)', 'name,age,city\nJohn,30,NYC', 'name, age, city\nJohn, 30, NYC', 'Remove spaces after commas unless the field is intentionally quoted', 'medium'),
('csv', 'semantics', 'type_consistency', 'Values in the same column should maintain consistent data types', 'id,age\n1,25\n2,30', 'id,age\n1,25\n2,thirty', 'Ensure all age values are numeric, not text like "thirty"', 'high'),
('csv', 'semantics', 'no_empty_columns', 'Columns should not be consistently empty throughout the file', 'name,age,phone\nJohn,30,', 'name,age,phone\nJohn,30,', 'Remove empty columns or fill with appropriate values', 'medium'),
('csv', 'semantics', 'consistent_null_representation', 'Use consistent representation for missing/null values (empty, NA, NULL, -)', 'name,age\nJohn,30\nJane,', 'name,age\nJohn,30\nJane,NA', 'Use consistent null representation: either empty or "NA" throughout', 'medium'),
('csv', 'performance', 'file_size', 'Large CSV files (>100MB) may cause performance issues', 'Typically < 100MB', 'Files > 100MB', 'Consider splitting large CSV files into multiple smaller files', 'low'),
('csv', 'format', 'bom_handling', 'Remove BOM (Byte Order Mark) from UTF-8 encoded files', 'Standard UTF-8 without BOM', 'UTF-8 with BOM prefix', 'Save file as UTF-8 without BOM in your text editor', 'medium')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- INSERT XML RULES
-- ============================================================================

INSERT INTO public.validation_rules (file_type, category, rule_name, rule_description, rule_example, common_mistake, fix_suggestion, severity) VALUES
('xml', 'syntax', 'xml_declaration', 'Should start with XML declaration', '<?xml version="1.0"?>\n<root></root>', '<root></root>', 'Add XML declaration at the beginning: <?xml version="1.0"?>', 'medium'),
('xml', 'syntax', 'root_element', 'Must have exactly one root element that wraps all content', '<?xml version="1.0"?>\n<root><item/></root>', '<?xml version="1.0"?>\n<item/>\n<item/>', 'Wrap all elements in a single root element', 'critical'),
('xml', 'syntax', 'balanced_tags', 'All opening tags must have corresponding closing tags', '<root><item>text</item></root>', '<root><item>text</root>', 'Add closing tag: </item>', 'critical'),
('xml', 'syntax', 'valid_tag_names', 'Tag names must start with letter/underscore and contain only alphanumeric characters, hyphens, underscores, periods', '<valid-tag_name></valid-tag_name>', '<123invalid></123invalid>', 'Rename tag to start with a letter: <tag123></tag123>', 'high'),
('xml', 'syntax', 'quoted_attributes', 'All attribute values must be quoted with double or single quotes', '<item name="John" age="30"></item>', '<item name=John age=30></item>', 'Quote all attribute values: name="John"', 'critical'),
('xml', 'syntax', 'escaped_special_chars', 'Special characters in content must be escaped: <, >, &, ", ''', '<root>&lt;script&gt;</root>', '<root><script></root>', 'Escape as: &lt; &gt; &amp; &quot; &apos;', 'high'),
('xml', 'structure', 'proper_nesting', 'Tags must be properly nested (no overlapping)', '<root><a><b></b></a></root>', '<root><a><b></a></b></root>', 'Fix nesting order so inner tags close before outer', 'critical'),
('xml', 'structure', 'consistent_hierarchy', 'Maintain consistent element hierarchy and structure', '<users><user><name>John</name></user></users>', '<users><user><name>John</user></users>', 'Ensure closing tags match opening tags in correct order', 'high'),
('xml', 'semantics', 'required_attributes', 'Ensure required attributes are present on elements', '<item id="1" name="Product"></item>', '<item name="Product"></item>', 'Add missing required attribute: id="1"', 'high'),
('xml', 'semantics', 'valid_attribute_types', 'Attribute values should match expected types (ID, integer, email, etc.)', '<item id="123" price="29.99"></item>', '<item id="abc" price="twenty"></item>', 'Use correct types: id should be numeric, price should be numeric', 'medium'),
('xml', 'format', 'consistent_indentation', 'Use consistent indentation for readability', '<root>\n  <item>value</item>\n</root>', 'No indentation or inconsistent indentation', 'Use 2 or 4 spaces per nesting level consistently', 'low'),
('xml', 'format', 'whitespace_handling', 'Whitespace in text content is significant in XML', '<root>text</root>', '<root> text </root>', 'Be aware that whitespace in text content is preserved', 'medium')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- INSERT YAML RULES
-- ============================================================================

INSERT INTO public.validation_rules (file_type, category, rule_name, rule_description, rule_example, common_mistake, fix_suggestion, severity) VALUES
('yaml', 'syntax', 'no_tabs', 'YAML requires spaces for indentation, not tabs', 'key:\n  nested: value', 'key:\n\tnested: value', 'Replace all tabs with spaces (usually 2 per level)', 'critical'),
('yaml', 'syntax', 'consistent_spacing', 'Use consistent indentation throughout (usually 2 spaces)', 'root:\n  child: value', 'root:\n   child: value', 'Use 2 spaces consistently for each nesting level', 'high'),
('yaml', 'syntax', 'valid_colons', 'Use colons with space after for key-value pairs', 'name: John', 'name:John', 'Add space after colon: name: John', 'high'),
('yaml', 'syntax', 'quoted_strings', 'Quote strings containing special characters or starting with special chars', 'description: "contains: colon"', 'description: contains: colon', 'Quote strings with colons or special chars', 'high'),
('yaml', 'syntax', 'no_duplicate_keys', 'Keys must be unique within the same level', 'name: John\nage: 30', 'name: John\nname: Jane', 'Remove or rename duplicate keys', 'critical'),
('yaml', 'structure', 'valid_lists', 'Arrays/lists must use dashes with consistent indentation', 'items:\n  - item1\n  - item2', 'items:\n  - item1\n  item2', 'Use dash and space for all list items', 'high'),
('yaml', 'structure', 'proper_nesting', 'Indentation indicates nesting level; child must be indented more than parent', 'parent:\n  child: value', 'parent:\nchild: value', 'Indent child element relative to parent', 'critical'),
('yaml', 'semantics', 'type_consistency', 'Values in similar contexts should have consistent types', 'ages:\n  - 25\n  - 30', 'ages:\n  - 25\n  - "thirty"', 'Keep values of same type: 25 and 30 are both numbers', 'medium'),
('yaml', 'semantics', 'required_fields', 'Include required configuration fields at root level', 'database:\n  host: localhost\n  port: 5432', 'database:\n  host: localhost', 'Add required fields like port, username, password', 'high'),
('yaml', 'format', 'no_comments', 'Comments start with # and go to end of line', 'name: John # Person name', 'name: John // Person name', 'Use # for comments, not // or /* */', 'medium'),
('yaml', 'format', 'boolean_format', 'Booleans should be true/false (lowercase)', 'active: true', 'active: True', 'Use lowercase true/false, not True/False', 'medium'),
('yaml', 'format', 'null_representation', 'Use ~ or null for null values (not empty string)', 'value: null', 'value: ""', 'Use explicit null or ~ for empty/missing values', 'medium')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- INSERT VALIDATION PATTERNS (Regex patterns for error detection)
-- ============================================================================

INSERT INTO public.validation_patterns (file_type, pattern_name, pattern_regex, pattern_description, error_message, severity) VALUES
('json', 'trailing_comma', ',\s*[}\]]', 'Detects trailing commas before closing brackets', 'Trailing comma found before closing bracket', 'critical'),
('json', 'unquoted_key', '{\s*[a-zA-Z_][a-zA-Z0-9_]*\s*:', 'Detects unquoted object keys', 'Object keys must be quoted', 'critical'),
('json', 'single_quotes', '\'[^\']*\'', 'Detects single-quoted strings', 'Strings must use double quotes, not single quotes', 'critical'),
('json', 'unclosed_brace', '{\s*[^}]*$', 'Detects unclosed opening braces', 'Missing closing brace', 'critical'),
('csv', 'inconsistent_cols', '.', 'Pattern to detect row with different column count', 'Row has inconsistent number of columns', 'critical'),
('csv', 'unquoted_special', '[^"]*,[^"]*', 'Detects fields with commas not quoted', 'Fields containing commas must be quoted', 'high'),
('xml', 'unclosed_tag', '<[a-zA-Z][a-zA-Z0-9]*[^/]>(?!.*</[a-zA-Z][a-zA-Z0-9]*>)', 'Detects unclosed tags', 'Tag is not properly closed', 'critical'),
('xml', 'mismatched_tags', '<([a-zA-Z][a-zA-Z0-9]*)[^>]*>.*?</(?!\1>)', 'Detects mismatched opening and closing tags', 'Opening and closing tags do not match', 'critical'),
('xml', 'unescaped_char', '[<>&"](?![a-z]*;)', 'Detects unescaped special characters', 'Special character must be escaped', 'high'),
('yaml', 'mixed_tabs_spaces', '\t', 'Detects tabs in indentation', 'YAML requires spaces, not tabs, for indentation', 'critical'),
('yaml', 'inconsistent_indent', '^\s{3}(?!\s*-)|^\s{5}(?!\s*-)', 'Detects indentation not in multiples of 2', 'Use consistent indentation (2 spaces per level)', 'high'),
('yaml', 'missing_colon_space', ':\S', 'Detects colon without space after', 'Must have space after colon', 'high')
ON CONFLICT DO NOTHING;

-- Create view to get rules for a specific file type
CREATE OR REPLACE VIEW public.vw_active_rules AS
SELECT 
  id,
  file_type,
  category,
  rule_name,
  rule_description,
  rule_example,
  common_mistake,
  fix_suggestion,
  severity
FROM public.validation_rules
WHERE is_active = true
ORDER BY file_type, severity DESC, category;

-- Create view to get active patterns for a specific file type
CREATE OR REPLACE VIEW public.vw_active_patterns AS
SELECT 
  id,
  file_type,
  pattern_name,
  pattern_regex,
  pattern_description,
  error_message,
  severity
FROM public.validation_patterns
WHERE is_active = true
ORDER BY file_type, severity DESC, pattern_name;

-- Grant read permissions to anon users (adjust if needed)
GRANT SELECT ON public.validation_rules TO anon;
GRANT SELECT ON public.validation_patterns TO anon;
GRANT SELECT ON public.vw_active_rules TO anon;
GRANT SELECT ON public.vw_active_patterns TO anon;
