import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { YouTubeEmbed } from './YouTubeEmbed';

interface HelpCenterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SectionId = 'getting-started' | 'how-it-thinks' | 'errors-explained' | 'export-reports' | 'limits-accuracy' | 'faqs';

interface Section {
  id: SectionId;
  title: string;
  icon: string;
}

const sections: Section[] = [
  { id: 'getting-started', title: 'Getting Started', icon: '' },
  { id: 'how-it-thinks', title: 'How Inspect Works', icon: '' },
  { id: 'errors-explained', title: 'Understanding Issues', icon: '' },
  { id: 'export-reports', title: 'Export & Share', icon: '' },
  { id: 'limits-accuracy', title: 'Capabilities & Limits', icon: '' },
  { id: 'faqs', title: 'Common Questions', icon: '' },
];

const helpContent: Record<SectionId, { title: string; content: JSX.Element }> = {
  'getting-started': {
    title: 'Getting Started',
    content: (
      <div className="space-y-5">
        {/* Video Embed */}
        <div className="aspect-video rounded-lg overflow-hidden bg-black">
          <YouTubeEmbed videoId="OSBS0LnuYUQ" title="Inspect Getting Started" />
        </div>

        <div>
          <h3 className="font-semibold text-slate-900 mb-2">Upload Your Data File</h3>
          <p className="text-slate-600 text-sm mb-2">
            Inspect analyzes data files in multiple formats. Click the upload button or drag and drop to analyze your file.
          </p>
          <ul className="text-sm text-slate-600 space-y-1 ml-4">
            <li>• Supports JSON, CSV, XML, YAML and other formats</li>
            <li>• Maximum file size: 10 MB</li>
            <li>• Automatically detects file type</li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900 mb-2">Review Analysis Results</h3>
          <p className="text-slate-600 text-sm mb-2">
            Once your file is uploaded, Inspect scans it for potential issues:
          </p>
          <ul className="text-sm text-slate-600 space-y-1 ml-4">
            <li>• Structure problems (format errors, syntax issues)</li>
            <li>• Data quality concerns (empty values, invalid data)</li>
            <li>• Exact line and column location for each issue</li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900 mb-2">Use Action Buttons</h3>
          <p className="text-slate-600 text-sm mb-2">
            At the bottom of the screen, you can:
          </p>
          <ul className="text-sm text-slate-600 space-y-1 ml-4">
            <li>• <strong>Export</strong> your analysis in JSON, CSV, or HTML format</li>
            <li>• <strong>Share</strong> findings via email, Twitter, or LinkedIn</li>
            <li>• <strong>Audit</strong> download a detailed audit log of the analysis</li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900 mb-2">Edit Your Data</h3>
          <p className="text-slate-600 text-sm">
            You can edit your data directly in the editor. Inspect will automatically re-analyze when you confirm your changes using the Confirm button.
          </p>
        </div>
      </div>
    ),
  },
  'how-it-thinks': {
    title: 'How Inspect Works',
    content: (
      <div className="space-y-5">
        <div>
          <h3 className="font-semibold text-slate-900 mb-2">Analysis Process</h3>
          <p className="text-slate-600 text-sm mb-2">
            Inspect analyzes your data files through two main phases:
          </p>
          <ul className="text-sm text-slate-600 space-y-1 ml-4">
            <li>• <strong>Structure Analysis:</strong> Checks if the file is properly formatted and valid</li>
            <li>• <strong>Data Analysis:</strong> Examines the actual data content for quality issues</li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900 mb-2">What Gets Checked</h3>
          <p className="text-slate-600 text-sm mb-2">
            Inspect looks for:
          </p>
          <ul className="text-sm text-slate-600 space-y-1 ml-4">
            <li>• Invalid number values (NaN, Infinity)</li>
            <li>• Missing or null data</li>
            <li>• Empty fields and values</li>
            <li>• Duplicate entries</li>
            <li>• Inconsistent data types</li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900 mb-2">How Issues Are Reported</h3>
          <p className="text-slate-600 text-sm mb-2">
            For each issue found, Inspect provides:
          </p>
          <ul className="text-sm text-slate-600 space-y-1 ml-4">
            <li>• Exact location (line and column)</li>
            <li>• What was observed</li>
            <li>• Why it might be a problem</li>
            <li>• A confidence level (high, medium, or low)</li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900 mb-2">Local Processing</h3>
          <p className="text-slate-600 text-sm">
            All analysis happens in your browser. Your data never leaves your computer and is never sent to any server.
          </p>
        </div>
      </div>
    ),
  },
  'errors-explained': {
    title: 'Understanding Issues',
    content: (
      <div className="space-y-5">
        <div>
          <h3 className="font-semibold text-slate-900 mb-2">Issue Severity Levels</h3>
          <p className="text-slate-600 text-sm mb-2">
            Inspect classifies issues at three levels:
          </p>
          <ul className="text-sm text-slate-600 space-y-1 ml-4">
            <li>• <strong>Error:</strong> Critical structural problems that prevent proper data processing</li>
            <li>• <strong>Warning:</strong> Data quality concerns that should be reviewed</li>
            <li>• <strong>Info:</strong> Observations that provide helpful context</li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900 mb-2">Common Issue Types</h3>
          <ul className="text-sm text-slate-600 space-y-2 ml-4">
            <li>
              <strong className="text-slate-900">Invalid Numbers:</strong> Fields containing NaN or Infinity values
            </li>
            <li>
              <strong className="text-slate-900">Missing Values:</strong> Null or undefined data where values are expected
            </li>
            <li>
              <strong className="text-slate-900">Empty Fields:</strong> Empty strings or blank values in records
            </li>
            <li>
              <strong className="text-slate-900">Duplicate Records:</strong> Identical or very similar entries appearing multiple times
            </li>
            <li>
              <strong className="text-slate-900">Type Inconsistency:</strong> Fields with mixed data types (some numbers, some text)
            </li>
            <li>
              <strong className="text-slate-900">Format Issues:</strong> Malformed JSON, CSV, XML, or other structure problems
            </li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900 mb-2">Confidence Levels</h3>
          <p className="text-slate-600 text-sm mb-2">
            Each finding has a confidence rating:
          </p>
          <ul className="text-sm text-slate-600 space-y-1 ml-4">
            <li>• <strong>High:</strong> Clear and definite issue</li>
            <li>• <strong>Medium:</strong> Likely issue, but may have valid context</li>
            <li>• <strong>Low:</strong> Potential concern that needs review</li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900 mb-2">Context Matters</h3>
          <p className="text-slate-600 text-sm">
            Inspect identifies potential problems, but you understand your data best. Some "issues" may be perfectly valid for your specific use case. Always review findings with your business knowledge.
          </p>
        </div>
      </div>
    ),
  },
  'export-reports': {
    title: 'Export & Share',
    content: (
      <div className="space-y-5">
        <div>
          <h3 className="font-semibold text-slate-900 mb-2">Export Your Analysis</h3>
          <p className="text-slate-600 text-sm mb-2">
            Click the <strong>Export</strong> button to download your analysis results in your preferred format:
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900 mb-2">JSON Format</h3>
          <p className="text-slate-600 text-sm mb-2">
            Structured data export with complete analysis details. Use this for:
          </p>
          <ul className="text-sm text-slate-600 space-y-1 ml-4">
            <li>• Programmatic processing and integration</li>
            <li>• Loading into other tools and systems</li>
            <li>• Detailed technical documentation</li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900 mb-2">CSV Format</h3>
          <p className="text-slate-600 text-sm mb-2">
            Spreadsheet-compatible export. Use this for:
          </p>
          <ul className="text-sm text-slate-600 space-y-1 ml-4">
            <li>• Opening in Excel or Google Sheets</li>
            <li>• Filtering and sorting issues</li>
            <li>• Sharing with non-technical stakeholders</li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900 mb-2">HTML Report</h3>
          <p className="text-slate-600 text-sm mb-2">
            Beautiful branded report. Use this for:
          </p>
          <ul className="text-sm text-slate-600 space-y-1 ml-4">
            <li>• Professional presentations</li>
            <li>• Email distribution</li>
            <li>• Print-friendly documentation</li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900 mb-2">Share Your Findings</h3>
          <p className="text-slate-600 text-sm mb-2">
            Click the <strong>Share</strong> button to share via:
          </p>
          <ul className="text-sm text-slate-600 space-y-1 ml-4">
            <li>• Email with pre-filled message</li>
            <li>• Twitter/X for social sharing</li>
            <li>• LinkedIn for professional networks</li>
            <li>• Copy to clipboard for easy distribution</li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900 mb-2">Audit Log</h3>
          <p className="text-slate-600 text-sm">
            Click the <strong>Audit</strong> button to download a detailed audit log in JSON or CSV format. This includes complete analysis metadata, timestamps, and issue details.
          </p>
        </div>
      </div>
    ),
  },
  'limits-accuracy': {
    title: 'Capabilities & Limits',
    content: (
      <div className="space-y-5">
        <div>
          <h3 className="font-semibold text-slate-900 mb-2">File Size Limits</h3>
          <p className="text-slate-600 text-sm">
            Inspect supports files up to <strong>10 MB</strong> in size. For larger files, consider splitting them into smaller datasets for analysis.
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900 mb-2">Supported Formats</h3>
          <p className="text-slate-600 text-sm mb-2">
            Inspect automatically detects and analyzes:
          </p>
          <ul className="text-sm text-slate-600 space-y-1 ml-4">
            <li>• JSON (and JSON with comments)</li>
            <li>• CSV and TSV files</li>
            <li>• XML</li>
            <li>• YAML</li>
            <li>• Plain text</li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900 mb-2">What Inspect Checks</h3>
          <ul className="text-sm text-slate-600 space-y-1 ml-4">
            <li>✓ File format and structure validity</li>
            <li>✓ Data type consistency</li>
            <li>✓ Missing and null values</li>
            <li>✓ Empty fields</li>
            <li>✓ Duplicate records</li>
            <li>✓ Invalid numeric values</li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900 mb-2">What Inspect Doesn't Check</h3>
          <ul className="text-sm text-slate-600 space-y-1 ml-4">
            <li>✗ Business rule validation (specific to your domain)</li>
            <li>✗ Semantic meaning of the data</li>
            <li>✗ Performance or optimization suggestions</li>
            <li>✗ Completeness based on expected fields</li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900 mb-2">Analysis Speed</h3>
          <p className="text-slate-600 text-sm">
            Most files are analyzed instantly. Larger files (1-10 MB) may take a few seconds depending on your computer's performance.
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900 mb-2">Data Privacy</h3>
          <p className="text-slate-600 text-sm">
            All analysis runs completely in your browser. Your data is never uploaded to any server and never leaves your computer.
          </p>
        </div>
      </div>
    ),
  },
  faqs: {
    title: 'Common Questions',
    content: (
      <div className="space-y-5">
        <div>
          <h3 className="font-semibold text-slate-900 mb-2">Is my data sent to a server?</h3>
          <p className="text-slate-600 text-sm">
            No. Inspect runs entirely in your browser. Your data never leaves your computer and is never sent anywhere.
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900 mb-2">Can Inspect fix my data?</h3>
          <p className="text-slate-600 text-sm">
            Inspect identifies and explains issues with suggestions for fixes. You make the actual changes to your data.
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900 mb-2">How fast is the analysis?</h3>
          <p className="text-slate-600 text-sm">
            Most files analyze instantly. Larger files (1-10 MB) typically take a few seconds depending on your computer.
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900 mb-2">Will I get the same results every time?</h3>
          <p className="text-slate-600 text-sm">
            Yes. If you upload the same file again, you should get identical results. Different results mean the data has changed.
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900 mb-2">Can I use this with sensitive data?</h3>
          <p className="text-slate-600 text-sm">
            Yes. Since analysis happens locally in your browser, it's completely safe for sensitive or confidential data. Nothing is stored or transmitted.
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900 mb-2">What's the difference between Error and Warning?</h3>
          <p className="text-slate-600 text-sm">
            <strong>Errors:</strong> Critical structural issues that prevent proper data handling. <strong>Warnings:</strong> Data quality concerns that should be reviewed. <strong>Info:</strong> Additional observations.
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900 mb-2">Can I analyze multiple files?</h3>
          <p className="text-slate-600 text-sm">
            Yes. Upload files one at a time and use tabs to switch between them. Each file maintains its own analysis results.
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900 mb-2">How do I share the analysis?</h3>
          <p className="text-slate-600 text-sm">
            Use the <strong>Share</strong> button to share via email, Twitter, LinkedIn, or copy to clipboard. You can also <strong>Export</strong> the full analysis in JSON, CSV, or HTML format.
          </p>
        </div>
      </div>
    ),
  },
};

export const HelpCenterModal = ({ open, onOpenChange }: HelpCenterModalProps) => {
  const [selectedSection, setSelectedSection] = useState<SectionId>('getting-started');


  // Close modal on Esc key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };

    if (open) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, onOpenChange]);

  if (!open) return null;

  const currentContent = helpContent[selectedSection];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      {/* Modal */}
      <div className="bg-gray-50 rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-slate-200 px-8 py-6 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Inspect Help</h1>
            <p className="text-sm text-slate-500 mt-1">Learn how to get the most out of your analysis</p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-lg"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Sidebar */}
          <div className="w-64 border-r border-slate-200 overflow-y-auto bg-slate-50">


            {/* Sections */}
            <nav className="p-4 space-y-1">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setSelectedSection(section.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors font-medium text-sm ${
                    selectedSection === section.id
                      ? 'bg-blue-100 text-blue-900'
                      : 'text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {section.title}
                </button>
              ))}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-8 max-w-3xl">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">{currentContent.title}</h2>
              <div className="text-slate-700">{currentContent.content}</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-8 py-4 text-center text-xs text-slate-500">
          <p>Inspect Help • Powered by DatumInt • Press ESC to close</p>
        </div>
      </div>
    </div>
  );
};
