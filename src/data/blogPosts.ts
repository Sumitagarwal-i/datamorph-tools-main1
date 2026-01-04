export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  content: string; // In a real app, this might be MDX or HTML
  category: string;
  date: string;
  readTime: string;
  imageUrl?: string;
  featured?: boolean;
}

export const blogPosts: BlogPost[] = [
  {
    slug: "the-hidden-cost-of-silent-data-failures",
    title: "The hidden cost of silent data failures",
    excerpt: "Why 'valid' files that pass schema checks still break downstream pipelines, and how to catch them earlier.",
    category: "Data Quality",
    date: "Oct 12, 2025",
    readTime: "5 min read",
    featured: true,
    content: `
      <p>We often think of data validation as a binary state: a file is either valid or invalid. It either matches the schema or it doesn't. But anyone who has managed data pipelines at scale knows this is a dangerous oversimplification.</p>
      
      <h2>The "Valid" File Trap</h2>
      <p>Consider a CSV file uploaded by a partner. It has all the right columns. The data types match. The file parses without errors. By all standard definitions, this is a valid file.</p>
      
      <p>But what if the "Total" column is negative? What if the "StartDate" is after the "EndDate"? What if 40% of the rows are duplicates?</p>
      
      <p>These are not syntax errors. They are semantic failures. And they are much harder to catch because they don't break the parser—they break the business logic downstream.</p>
      
      <h2>Why Schema Validation Isn't Enough</h2>
      <p>Schema validation is necessary but insufficient. It tells you if the container is the right shape, not if the contents are spoiled.</p>
      
      <pre><code class="language-json">{
  "id": "123",
  "status": "active",
  "last_login": "1970-01-01T00:00:00Z"
}</code></pre>
      
      <p>The JSON above is perfectly valid. But if your analytics dashboard relies on "last_login" to calculate active users, this default Unix epoch timestamp is going to skew your metrics silently.</p>
      
      <h2>Moving Inspection Left</h2>
      <p>The solution isn't just better error handling in your ETL pipeline (though that helps). The solution is to move inspection left—closer to the source.</p>
      
      <div class="my-8 p-6 bg-[#F5F8FF] dark:bg-[#1A1F2E] rounded-xl border border-[#E8EDFF] dark:border-[#2A2A2A]">
        <p class="m-0 text-base font-medium text-[#4F7CFF] dark:text-[#8BA8FF]">
          This kind of issue is what we’re trying to surface earlier with DatumInt Inspect — before “valid” files quietly cause downstream damage.
        </p>
      </div>
      
      <p>By inspecting files for these semantic issues before they enter the pipeline, we save hours of debugging time and prevent polluted data lakes.</p>
    `
  },
  {
    slug: "schema-drift-in-the-wild",
    title: "Schema drift in the wild: When APIs change without notice",
    excerpt: "Strategies for detecting and handling unexpected changes in third-party data structures.",
    category: "Schema Drift",
    date: "Nov 03, 2025",
    readTime: "4 min read",
    content: `
      <p>APIs change. It's a fact of life. Ideally, they change with versioning and deprecation notices. In reality, fields disappear, types flip, and nested objects flatten without warning.</p>
      
      <h2>The Silent Breaker</h2>
      <p>Schema drift is particularly insidious because it often happens gradually. A new field appears. An optional field becomes null more often. A string field starts containing JSON.</p>
      
      <p>If your ingestion process is too rigid, it breaks immediately. If it's too loose, it swallows the garbage and corrupts your database.</p>
      
      <h2>Defensive Coding vs. Proactive Inspection</h2>
      <p>Defensive coding helps, but it adds complexity. Every "try-catch" block or "if exists" check is a band-aid over the uncertainty of the input.</p>
      
      <p>A better approach is proactive inspection. Before processing a batch of records, sample them. Check the distribution of fields. Check for new keys. Check for missing keys.</p>
      
      <p>This allows you to fail fast and alert the team, rather than polluting your data warehouse with half-baked records.</p>
    `
  },
  {
    slug: "why-csv-is-still-king-and-why-that-is-a-problem",
    title: "Why CSV is still king (and why that's a problem)",
    excerpt: "Despite the rise of Parquet and Avro, the world runs on CSV. Here is how to mitigate its inherent fragility.",
    category: "Engineering Notes",
    date: "Sep 28, 2025",
    readTime: "6 min read",
    content: `
      <p>CSV is the cockroach of file formats. It survives everything. It's simple, human-readable, and universally supported. But it's also incredibly fragile.</p>
      
      <h2>The Ambiguity of Comma Separation</h2>
      <p>Is that comma a delimiter or part of a text field? Is that newline a row separator or a line break in a comment? Without a strict schema, CSV is just a suggestion of structure.</p>
      
      <h2>Type Inference Nightmares</h2>
      <p>When you open a CSV in Excel, it helpfully converts "00123" to "123". It converts "MAR-10" to a date. These "helpful" features destroy data integrity.</p>
      
      <p>Automated pipelines often struggle with similar issues. Is "true" a boolean or a string? Is "NULL" a null value or a string literal?</p>
      
      <h2>Surviving the CSV Apocalypse</h2>
      <p>If you must work with CSV (and you probably do), treat it with extreme suspicion. Never assume types. Always validate headers. And inspect the raw data before letting it near your database.</p>
    `
  }
];
