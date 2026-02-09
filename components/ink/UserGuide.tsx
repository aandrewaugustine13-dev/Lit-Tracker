import React from 'react';
import { 
  FileImage, 
  FileText, 
  Users, 
  Sparkles,
  MessageCircle,
  Copy,
  Layout
} from 'lucide-react';

interface UserGuideProps {
  showGutters: boolean;
}

const UserGuide: React.FC<UserGuideProps> = ({ showGutters }) => {
  return (
    <div className={`flex-1 overflow-y-auto ${showGutters ? 'bg-gray-100' : 'bg-ink-900'}`}>
      <div className="max-w-5xl mx-auto px-8 py-12">
        <div className={`${showGutters ? 'text-gray-900' : 'text-steel-100'}`}>
          
          {/* Header */}
          <div className="mb-12">
            <h1 className={`font-display text-6xl uppercase tracking-tighter mb-4 ${showGutters ? 'text-black' : 'text-steel-100'}`}>
              How to Use
            </h1>
            <p className={`text-lg font-mono ${showGutters ? 'text-gray-600' : 'text-steel-400'}`}>
              A comprehensive guide to mastering Ink Tracker
            </p>
          </div>

          {/* Getting Started */}
          <section className="mb-12">
            <h2 className={`font-mono text-2xl uppercase tracking-wider mb-6 ${showGutters ? 'text-black' : 'text-ember-400'}`}>
              Getting Started
            </h2>
            <div className={`space-y-4 ${showGutters ? 'text-gray-800' : 'text-steel-300'}`}>
              <div className="mb-6">
                <h3 className={`font-mono text-lg uppercase tracking-wide mb-2 ${showGutters ? 'text-gray-900' : 'text-steel-200'}`}>
                  Create a Project
                </h3>
                <p>Click the folder icon next to "Story" in the sidebar to open the Archive (Project Hub). Click "Initialize Sequence" to create a new project with a title.</p>
              </div>
              <div className="mb-6">
                <h3 className={`font-mono text-lg uppercase tracking-wide mb-2 ${showGutters ? 'text-gray-900' : 'text-steel-200'}`}>
                  Set Up Image Generation
                </h3>
                <p>In the sidebar, select your preferred AI image provider (Gemini, Leonardo, Grok, FAL, or SeaArt) and enter your API key.</p>
              </div>
              <div className="mb-6">
                <h3 className={`font-mono text-lg uppercase tracking-wide mb-2 ${showGutters ? 'text-gray-900' : 'text-steel-200'}`}>
                  Build Your Story
                </h3>
                <p>Create issues/chapters in the sidebar, add pages to each issue, and add panel frames to each page using the "ADD FRAME" button.</p>
              </div>
              <div className="mb-6">
                <h3 className={`font-mono text-lg uppercase tracking-wide mb-2 ${showGutters ? 'text-gray-900' : 'text-steel-200'}`}>
                  Generate Art
                </h3>
                <p>Write panel descriptions, assign characters, and click the "Generate" button on each panel or use "AUTO-INK" to generate all panels at once.</p>
              </div>
            </div>
          </section>

          {/* Core Features */}
          <section className="mb-12">
            <h2 className={`font-mono text-2xl uppercase tracking-wider mb-6 ${showGutters ? 'text-black' : 'text-ember-400'}`}>
              Core Features
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FeatureCard
                icon={<FileText size={24} />}
                title="Script Import"
                description="Import existing comic scripts in markdown format. The parser automatically creates pages and panels from your script."
                showGutters={showGutters}
              />
              <FeatureCard
                icon={<Users size={24} />}
                title="Character Tracker"
                description="Create detailed character profiles with physical appearances. Characters are automatically included in panel prompts for consistency."
                showGutters={showGutters}
              />
              <FeatureCard
                icon={<Sparkles size={24} />}
                title="Art Styles"
                description="Choose from curated art style presets like Film Noir, Superhero, Horror, or create your own custom style prompt."
                showGutters={showGutters}
              />
              <FeatureCard
                icon={<Copy size={24} />}
                title="Panel Linking"
                description="Link panels together for visual consistency. Reference previous panels to maintain character appearances and scene continuity."
                showGutters={showGutters}
              />
              <FeatureCard
                icon={<MessageCircle size={24} />}
                title="Text Elements"
                description="Add dialogue bubbles, thought clouds, captions, and phone messages to your panels with adjustable positioning and styling."
                showGutters={showGutters}
              />
              <FeatureCard
                icon={<Layout size={24} />}
                title="Page Templates"
                description="Apply pre-built layouts like 2×2 Grid, Manga style, or Single Splash to quickly set up your pages."
                showGutters={showGutters}
              />
            </div>
          </section>

          {/* Canvas Controls */}
          <section className="mb-12">
            <h2 className={`font-mono text-2xl uppercase tracking-wider mb-6 ${showGutters ? 'text-black' : 'text-ember-400'}`}>
              Canvas Controls
            </h2>
            <div className={`rounded-2xl overflow-hidden border ${showGutters ? 'bg-white border-gray-300' : 'bg-ink-800 border-ink-700'}`}>
              <table className="w-full">
                <thead className={`${showGutters ? 'bg-gray-100' : 'bg-ink-900'}`}>
                  <tr>
                    <th className={`font-mono text-xs uppercase tracking-wider px-6 py-3 text-left ${showGutters ? 'text-gray-700' : 'text-steel-400'}`}>Action</th>
                    <th className={`font-mono text-xs uppercase tracking-wider px-6 py-3 text-left ${showGutters ? 'text-gray-700' : 'text-steel-400'}`}>How To</th>
                  </tr>
                </thead>
                <tbody>
                  <TableRow showGutters={showGutters} action="Add Panel" howTo='Click "ADD FRAME" button in header' />
                  <TableRow showGutters={showGutters} action="Move Panel" howTo="Click and drag the panel move handle" />
                  <TableRow showGutters={showGutters} action="Resize Panel" howTo="Drag the bottom-right corner of panel" />
                  <TableRow showGutters={showGutters} action="Pan Canvas" howTo='Enable "NAV MODE" and drag canvas' />
                  <TableRow showGutters={showGutters} action="Apply Layout" howTo='Click "TEMPLATES" and select a layout' />
                  <TableRow showGutters={showGutters} action="Toggle Appearance" howTo='Click "GUTTERS" for light mode toggle' />
                </tbody>
              </table>
            </div>
          </section>

          {/* Export Options */}
          <section className="mb-12">
            <h2 className={`font-mono text-2xl uppercase tracking-wider mb-6 ${showGutters ? 'text-black' : 'text-ember-400'}`}>
              Export Options
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ExportCard
                icon={<FileImage size={20} />}
                title="ZIP Page Images"
                description="Download all panel images from the current page as a ZIP archive"
                showGutters={showGutters}
              />
              <ExportCard
                icon={<FileImage size={20} />}
                title="CBZ Issue"
                description="Export entire issue as a CBZ comic archive format, compatible with most comic reader apps"
                showGutters={showGutters}
              />
              <ExportCard
                icon={<FileImage size={20} />}
                title="PDF Page"
                description="Export current page panels as a PDF document"
                showGutters={showGutters}
              />
              <ExportCard
                icon={<FileImage size={20} />}
                title="PDF Issue"
                description="Export entire issue as a comprehensive PDF"
                showGutters={showGutters}
              />
            </div>
          </section>

          {/* Keyboard Shortcuts */}
          <section className="mb-12">
            <h2 className={`font-mono text-2xl uppercase tracking-wider mb-6 ${showGutters ? 'text-black' : 'text-ember-400'}`}>
              Keyboard Shortcuts
            </h2>
            <div className={`rounded-2xl overflow-hidden border ${showGutters ? 'bg-white border-gray-300' : 'bg-ink-800 border-ink-700'}`}>
              <table className="w-full">
                <thead className={`${showGutters ? 'bg-gray-100' : 'bg-ink-900'}`}>
                  <tr>
                    <th className={`font-mono text-xs uppercase tracking-wider px-6 py-3 text-left ${showGutters ? 'text-gray-700' : 'text-steel-400'}`}>Shortcut</th>
                    <th className={`font-mono text-xs uppercase tracking-wider px-6 py-3 text-left ${showGutters ? 'text-gray-700' : 'text-steel-400'}`}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  <TableRow showGutters={showGutters} action="Ctrl+Z / Cmd+Z" howTo="Undo last action" />
                  <TableRow showGutters={showGutters} action="Ctrl+Y / Cmd+Shift+Z" howTo="Redo last undone action" />
                  <TableRow showGutters={showGutters} action="← / ↑" howTo="Navigate to previous panel" />
                  <TableRow showGutters={showGutters} action="→ / ↓" howTo="Navigate to next panel" />
                  <TableRow showGutters={showGutters} action="Delete" howTo="Delete selected panel" />
                  <TableRow showGutters={showGutters} action="Escape" howTo="Deselect panel / Exit presentation" />
                  <TableRow showGutters={showGutters} action="Space (in presentation)" howTo="Advance to next panel" />
                </tbody>
              </table>
            </div>
          </section>

          {/* Tips */}
          <section className="mb-12">
            <h2 className={`font-mono text-2xl uppercase tracking-wider mb-6 ${showGutters ? 'text-black' : 'text-ember-400'}`}>
              Tips
            </h2>
            <div className={`space-y-4 ${showGutters ? 'text-gray-800' : 'text-steel-300'}`}>
              <TipCard
                title="Use Reference Panels"
                description="Link subsequent panels to an initial establishing shot for visual consistency. Adjust the consistency strength slider based on how much variation you want."
                showGutters={showGutters}
              />
              <TipCard
                title="Build Your Cast First"
                description="Create detailed character profiles before generating panels. The more detail you provide, the more consistent your character appearances will be."
                showGutters={showGutters}
              />
              <TipCard
                title="Export Regularly"
                description="Don't rely solely on browser storage. Export your work as CBZ or PDF regularly to avoid data loss."
                showGutters={showGutters}
              />
              <TipCard
                title="Experiment with Custom Styles"
                description="Create your own art style prompts by combining techniques, color palettes, and artist influences for unique results."
                showGutters={showGutters}
              />
            </div>
          </section>

          {/* Storage */}
          <section className="mb-12">
            <h2 className={`font-mono text-2xl uppercase tracking-wider mb-6 ${showGutters ? 'text-black' : 'text-ember-400'}`}>
              Storage
            </h2>
            <div className={`p-6 rounded-2xl border ${showGutters ? 'bg-white border-gray-300' : 'bg-ink-800 border-ink-700'}`}>
              <p className={`mb-4 ${showGutters ? 'text-gray-800' : 'text-steel-300'}`}>
                Ink Tracker stores your projects and data locally in your browser using two mechanisms:
              </p>
              <ul className={`space-y-2 ml-6 list-disc ${showGutters ? 'text-gray-800' : 'text-steel-300'}`}>
                <li><span className="font-mono">localStorage</span> - Stores project metadata, pages, and panel information</li>
                <li><span className="font-mono">IndexedDB</span> - Stores generated images for better performance</li>
              </ul>
              <p className={`mt-4 ${showGutters ? 'text-gray-700' : 'text-steel-400'} text-sm`}>
                Note: Clearing your browser data will delete all projects and images. Always export important work.
              </p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};

// Helper components
const FeatureCard: React.FC<{ icon: React.ReactNode; title: string; description: string; showGutters: boolean }> = ({ icon, title, description, showGutters }) => (
  <div className={`p-6 rounded-2xl border ${showGutters ? 'bg-white border-gray-300' : 'bg-ink-800 border-ink-700'}`}>
    <div className={`mb-3 ${showGutters ? 'text-gray-900' : 'text-ember-400'}`}>{icon}</div>
    <h3 className={`font-mono text-sm uppercase tracking-wider mb-2 ${showGutters ? 'text-gray-900' : 'text-steel-200'}`}>{title}</h3>
    <p className={`text-sm ${showGutters ? 'text-gray-700' : 'text-steel-400'}`}>{description}</p>
  </div>
);

const ExportCard: React.FC<{ icon: React.ReactNode; title: string; description: string; showGutters: boolean }> = ({ icon, title, description, showGutters }) => (
  <div className={`p-4 rounded-xl border ${showGutters ? 'bg-white border-gray-300' : 'bg-ink-800 border-ink-700'}`}>
    <div className="flex items-start gap-3">
      <div className={`mt-1 ${showGutters ? 'text-gray-900' : 'text-ember-400'}`}>{icon}</div>
      <div>
        <h3 className={`font-mono text-sm uppercase tracking-wide mb-1 ${showGutters ? 'text-gray-900' : 'text-steel-200'}`}>{title}</h3>
        <p className={`text-xs ${showGutters ? 'text-gray-700' : 'text-steel-400'}`}>{description}</p>
      </div>
    </div>
  </div>
);

const TableRow: React.FC<{ showGutters: boolean; action: string; howTo: string }> = ({ showGutters, action, howTo }) => (
  <tr className={`border-t ${showGutters ? 'border-gray-200' : 'border-ink-700'}`}>
    <td className={`px-6 py-3 font-mono text-sm ${showGutters ? 'text-gray-900' : 'text-steel-200'}`}>{action}</td>
    <td className={`px-6 py-3 text-sm ${showGutters ? 'text-gray-700' : 'text-steel-400'}`}>{howTo}</td>
  </tr>
);

const TipCard: React.FC<{ title: string; description: string; showGutters: boolean }> = ({ title, description, showGutters }) => (
  <div className={`p-4 rounded-xl border ${showGutters ? 'bg-white border-gray-300' : 'bg-ink-800 border-ink-700'}`}>
    <h3 className={`font-mono text-sm uppercase tracking-wide mb-2 ${showGutters ? 'text-gray-900' : 'text-steel-200'}`}>{title}</h3>
    <p className={`text-sm ${showGutters ? 'text-gray-700' : 'text-steel-400'}`}>{description}</p>
  </div>
);

export default UserGuide;
