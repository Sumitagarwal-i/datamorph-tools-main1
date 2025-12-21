import { X, Search, FileJson, Zap, AlertTriangle, CheckCircle, TrendingUp } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
  type: 'what' | 'how' | 'faq';
}

export const DetectiveDHelpModal = ({ open, onClose, type }: HelpModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-slate-900 border-slate-700 text-slate-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-800 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
        
        {type === 'what' && <WhatDetectiveDDoes />}
        {type === 'how' && <HowItWorks />}
        {type === 'faq' && <FAQs />}
      </DialogContent>
    </Dialog>
  );
};

const WhatDetectiveDDoes = () => (
  <div className="space-y-6 py-2">
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <Search className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          What Detective D Does 🕵️
        </h2>
      </div>
      <p className="text-slate-400 text-sm">
        Your friendly data detective, always on the case!
      </p>
    </div>

    <div className="space-y-4">
      <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-lg p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Zap className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-blue-300 text-lg mb-2">Instant Data Health Checks</h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              Detective D automatically scans your JSON, CSV, XML, and YAML files the moment you upload them. 
              No "Analyze" button needed—it just works! Think of it as a spell-checker, but for your data.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-lg p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <AlertTriangle className="h-4 w-4 text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-purple-300 text-lg mb-2">Comprehensive Data Quality Checks</h3>
            <p className="text-slate-300 text-sm leading-relaxed mb-3">
              Detective D performs four levels of analysis:
            </p>
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-semibold text-purple-300 mb-2">1. Structure (Syntax) Issues</p>
                <ul className="space-y-1 ml-4">
                  <li className="text-slate-300"><strong>JSON:</strong> Invalid syntax, missing commas, unclosed brackets, trailing commas, unclosed quotes</li>
                  <li className="text-slate-300"><strong>CSV:</strong> Column count mismatches, unclosed quotes</li>
                  <li className="text-slate-300"><strong>YAML/XML:</strong> Malformed tags, unclosed elements, indentation errors</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-purple-300 mb-2">2. Schema & Data Quality Issues</p>
                <ul className="space-y-1 ml-4">
                  <li className="text-slate-300">Empty required fields and missing values</li>
                  <li className="text-slate-300">Type mismatches (string where number expected, boolean as string)</li>
                  <li className="text-slate-300">Non-ISO date formats (12/31/2025 instead of 2025-12-31)</li>
                  <li className="text-slate-300">Unexpected enum values and duplicate keys/IDs</li>
                  <li className="text-slate-300">Implausible values (negative numbers, dates far in past/future, out-of-range values)</li>
                  <li className="text-slate-300">Placeholder values ("N/A", "unknown", "null" as string)</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-purple-300 mb-2">3. Logic & Consistency Checks</p>
                <ul className="space-y-1 ml-4">
                  <li className="text-slate-300">Start date after end date and other temporal logic</li>
                  <li className="text-slate-300">Duplicate records and missing required fields</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-purple-300 mb-2">4. General Warnings</p>
                <ul className="space-y-1 ml-4">
                  <li className="text-slate-300">High null/empty rates in fields</li>
                  <li className="text-slate-300">Suspicious patterns and outliers</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-lg p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <CheckCircle className="h-4 w-4 text-green-400" />
          </div>
          <div>
            <h3 className="font-semibold text-green-300 text-lg mb-2">Explains Everything Simply</h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              Every issue comes with a clear explanation of <em>what's wrong</em>, <em>why it matters</em>, 
              and <em>how to fix it</em>. No cryptic error codes—just friendly, actionable advice!
            </p>
          </div>
        </div>
      </div>
    </div>

    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-5">
      <p className="text-sm text-slate-300 leading-relaxed">
        <strong className="text-slate-100">💡 Pro tip:</strong> Detective D is deterministic—it never guesses or hallucinates. 
        Every finding is backed by evidence, so you can trust what it tells you!
      </p>
    </div>
  </div>
);

const HowItWorks = () => (
  <div className="space-y-6 py-2">
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
          <TrendingUp className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
          How It Works 🎯
        </h2>
      </div>
      <p className="text-slate-400 text-sm">
        Behind the scenes with your data detective
      </p>
    </div>

    <div className="space-y-5">
      {/* Step 1 */}
      <div className="relative pl-8 pb-5 border-l-2 border-orange-500/30">
        <div className="absolute left-[-9px] top-0 h-4 w-4 rounded-full bg-orange-500 border-4 border-slate-900"></div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-orange-300 flex items-center gap-2">
            <span className="text-2xl">1️⃣</span> Upload Your File
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed">
            Drop your JSON, CSV, XML, or YAML file onto Detective D. It works with files up to <strong>50MB</strong>.
            The moment your file uploads, Detective D springs into action!
          </p>
        </div>
      </div>

      {/* Step 2 */}
      <div className="relative pl-8 pb-5 border-l-2 border-blue-500/30">
        <div className="absolute left-[-9px] top-0 h-4 w-4 rounded-full bg-blue-500 border-4 border-slate-900"></div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-blue-300 flex items-center gap-2">
            <span className="text-2xl">2️⃣</span> Automatic Structure Check
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed mb-3">
            First, Detective D validates your file's structure—like checking if your JSON has matching brackets 
            or your CSV has consistent columns. These show up with a <strong className="text-red-400">red border</strong> in the issues panel.
          </p>
          <div className="bg-slate-900 border border-slate-600 rounded p-3 text-xs font-mono text-slate-400">
            <div className="text-red-400">❌ Missing comma at line 15, column 23</div>
            <div className="text-slate-500 mt-1">// Detective D catches syntax errors instantly</div>
          </div>
        </div>
      </div>

      {/* Step 3 */}
      <div className="relative pl-8 pb-5 border-l-2 border-purple-500/30">
        <div className="absolute left-[-9px] top-0 h-4 w-4 rounded-full bg-purple-500 border-4 border-slate-900"></div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-purple-300 flex items-center gap-2">
            <span className="text-2xl">3️⃣</span> Deep Data Analysis
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed mb-3">
            Then Detective D analyzes your data's <em>meaning</em>—checking types, spotting outliers, 
            finding duplicate IDs, and catching logic errors. These show up with color-coded borders:
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-1 w-8 bg-orange-500 rounded-full"></div>
              <span className="text-slate-300"><strong className="text-orange-400">Orange</strong> = Errors (type mismatches, critical issues)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1 w-8 bg-yellow-500 rounded-full"></div>
              <span className="text-slate-300"><strong className="text-yellow-400">Yellow</strong> = Warnings (outliers, suspicious patterns)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1 w-8 bg-blue-500 rounded-full"></div>
              <span className="text-slate-300"><strong className="text-blue-400">Blue</strong> = Info (minor issues, suggestions)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Step 4 */}
      <div className="relative pl-8">
        <div className="absolute left-[-9px] top-0 h-4 w-4 rounded-full bg-green-500 border-4 border-slate-900"></div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-green-300 flex items-center gap-2">
            <span className="text-2xl">4️⃣</span> Review & Fix
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed">
            Click any issue in the left panel to see detailed explanations on the right. Use the <strong>"Go to Line"</strong> button 
            to jump straight to the problem in your code. Fix it, and Detective D will recheck automatically!
          </p>
        </div>
      </div>
    </div>

    <div className="bg-gradient-to-r from-orange-500/10 to-purple-500/10 border border-orange-500/20 rounded-lg p-5">
      <h4 className="font-semibold text-orange-300 mb-2 flex items-center gap-2">
        <FileJson className="h-5 w-5" />
        Example: Catching a Type Mismatch
      </h4>
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-xs font-mono space-y-3">
        <div>
          <div className="text-slate-500 mb-1">// Your data</div>
          <div className="text-slate-300">{"{"}</div>
          <div className="text-slate-300 ml-4">"age": <span className="text-red-400">"twenty-five"</span>,</div>
          <div className="text-slate-300 ml-4">"salary": <span className="text-green-400">50000</span></div>
          <div className="text-slate-300">{"}"}</div>
        </div>
        <div>
          <div className="text-yellow-400">⚠️ Detective D says:</div>
          <div className="text-slate-400 mt-1">"Age should be a number, but found text. This will break calculations!"</div>
        </div>
      </div>
    </div>
  </div>
);

const FAQs = () => (
  <div className="space-y-6 py-2">
    <div className="space-y-2">
      <h2 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-teal-500 bg-clip-text text-transparent">
        Frequently Asked Questions 💬
      </h2>
      <p className="text-slate-400 text-sm">
        Everything you need to know about Detective D
      </p>
    </div>

    <div className="space-y-4">
      {/* FAQ 1 */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-5 space-y-2">
        <h3 className="font-semibold text-slate-100 flex items-start gap-2">
          <span className="text-green-400 flex-shrink-0">Q:</span>
          <span>Do I need to click "Analyze" after uploading?</span>
        </h3>
        <p className="text-sm text-slate-300 leading-relaxed pl-6">
          <strong className="text-green-400">A:</strong> Nope! Detective D analyzes automatically on upload. 
          Just drop your file and watch the issues appear. It's like magic, but deterministic! ✨
        </p>
      </div>

      {/* FAQ 2 */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-5 space-y-2">
        <h3 className="font-semibold text-slate-100 flex items-start gap-2">
          <span className="text-green-400 flex-shrink-0">Q:</span>
          <span>What file formats does it support?</span>
        </h3>
        <p className="text-sm text-slate-300 leading-relaxed pl-6">
          <strong className="text-green-400">A:</strong> Detective D works with <strong>JSON, CSV, XML, and YAML</strong> files 
          up to 50MB. Perfect for config files, API responses, datasets, and more!
        </p>
      </div>

      {/* FAQ 3 */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-5 space-y-2">
        <h3 className="font-semibold text-slate-100 flex items-start gap-2">
          <span className="text-green-400 flex-shrink-0">Q:</span>
          <span>Can I still analyze files with structure errors?</span>
        </h3>
        <p className="text-sm text-slate-300 leading-relaxed pl-6">
          <strong className="text-green-400">A:</strong> It's best to fix structure errors first (like missing commas or brackets), 
          but Detective D will try its best to analyze what it can. The error panel will guide you!
        </p>
      </div>

      {/* FAQ 4 */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-5 space-y-2">
        <h3 className="font-semibold text-slate-100 flex items-start gap-2">
          <span className="text-green-400 flex-shrink-0">Q:</span>
          <span>What do the colored borders mean?</span>
        </h3>
        <div className="text-sm text-slate-300 leading-relaxed pl-6 space-y-2">
          <p><strong className="text-green-400">A:</strong> Each issue has a colored left border to show its severity:</p>
          <ul className="space-y-1 ml-4">
            <li><span className="text-red-400">• Red</span> = Structure errors (broken syntax)</li>
            <li><span className="text-orange-400">• Orange</span> = Critical data errors</li>
            <li><span className="text-yellow-400">• Yellow</span> = Warnings (suspicious patterns)</li>
            <li><span className="text-blue-400">• Blue</span> = Info (suggestions)</li>
          </ul>
        </div>
      </div>

      {/* FAQ 5 */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-5 space-y-2">
        <h3 className="font-semibold text-slate-100 flex items-start gap-2">
          <span className="text-green-400 flex-shrink-0">Q:</span>
          <span>Does Detective D use AI?</span>
        </h3>
        <p className="text-sm text-slate-300 leading-relaxed pl-6">
          <strong className="text-green-400">A:</strong> Nope! Detective D is 100% deterministic and rule-based. 
          It never guesses or hallucinates—every finding is backed by hard evidence. You can trust what it tells you!
        </p>
      </div>

      {/* FAQ 6 */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-5 space-y-2">
        <h3 className="font-semibold text-slate-100 flex items-start gap-2">
          <span className="text-green-400 flex-shrink-0">Q:</span>
          <span>Can I download a report of all issues?</span>
        </h3>
        <p className="text-sm text-slate-300 leading-relaxed pl-6">
          <strong className="text-green-400">A:</strong> Yes! Check the footer at the bottom of the page for export options. 
          You can download a complete error report customized with DatumInt branding.
        </p>
      </div>

      {/* FAQ 7 */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-5 space-y-2">
        <h3 className="font-semibold text-slate-100 flex items-start gap-2">
          <span className="text-green-400 flex-shrink-0">Q:</span>
          <span>What if I upload multiple files?</span>
        </h3>
        <p className="text-sm text-slate-300 leading-relaxed pl-6">
          <strong className="text-green-400">A:</strong> No problem! Detective D handles multiple files like a pro. 
          Each file gets its own tab, and errors are isolated per file—no cross-contamination!
        </p>
      </div>

      {/* FAQ 8 */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-5 space-y-2">
        <h3 className="font-semibold text-slate-100 flex items-start gap-2">
          <span className="text-green-400 flex-shrink-0">Q:</span>
          <span>Is my data safe?</span>
        </h3>
        <p className="text-sm text-slate-300 leading-relaxed pl-6">
          <strong className="text-green-400">A:</strong> Absolutely! All analysis happens in your browser—your data never leaves your machine. 
          Privacy-first by design. 🔒
        </p>
      </div>

      {/* FAQ 9 */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-5 space-y-2">
        <h3 className="font-semibold text-slate-100 flex items-start gap-2">
          <span className="text-green-400 flex-shrink-0">Q:</span>
          <span>What does Detective D NOT check?</span>
        </h3>
        <div className="text-sm text-slate-300 leading-relaxed pl-6 space-y-2">
          <p><strong className="text-green-400">A:</strong> Detective D is rule-based and deterministic. It does NOT:</p>
          <ul className="space-y-1 ml-4">
            <li className="text-slate-400">• Check deep business logic (e.g., "salary must be greater than minimum wage")</li>
            <li className="text-slate-400">• Validate cross-file relationships</li>
            <li className="text-slate-400">• Use AI or ML-based anomaly detection (only deterministic rules)</li>
            <li className="text-slate-400">• Understand natural language or semantic meaning</li>
          </ul>
          <p className="mt-3 text-slate-400 italic">Think of it as a spell-checker for data: it catches syntax, structure, and obvious quality issues, but not business logic!</p>
        </div>
      </div>
    </div>

    <div className="bg-gradient-to-r from-green-500/10 to-teal-500/10 border border-green-500/20 rounded-lg p-5 text-center">
      <p className="text-sm text-slate-300">
        <strong className="text-green-400">Still have questions?</strong> Detective D is here to help! 
        Just upload a file and start exploring—it's easier to learn by doing! 🚀
      </p>
    </div>
  </div>
);
