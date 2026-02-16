import React, { useState } from 'react';
import { useLitStore } from '../../store';
import { Plus, FileText, Layers } from 'lucide-react';
import NewProjectModal from '../ink/NewProjectModal';
import { InkProject } from '../../types';

const Gatekeeper: React.FC = () => {
  const { inkState, inkDispatch, setActiveModule } = useLitStore();
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);

  const handleSelectProject = (projectId: string) => {
    inkDispatch({ type: 'SET_ACTIVE_PROJECT', id: projectId });
    // Set active module to Lore Tracker after selecting a project
    setActiveModule('lore');
  };

  const getProjectStats = (project: InkProject) => {
    const issueCount = project.issues.length;
    const pageCount = project.issues.reduce((sum, issue) => sum + issue.pages.length, 0);
    return { issueCount, pageCount };
  };

  const getProjectTypeLabel = (projectType?: string) => {
    switch (projectType) {
      case 'comic': return 'Comic';
      case 'screenplay': return 'Screenplay';
      case 'stage-play': return 'Stage Play';
      case 'tv-series': return 'TV Series';
      default: return 'Comic';
    }
  };

  const getProjectTypeIcon = (projectType?: string) => {
    switch (projectType) {
      case 'screenplay':
      case 'stage-play':
      case 'tv-series':
        return FileText;
      default:
        return Layers;
    }
  };

  const hasProjects = inkState.projects.length > 0;
  const mostRecentProject = inkState.projects[0]; // First project is most recent

  return (
    <div className="h-screen w-screen bg-paper text-ink flex items-center justify-center p-8">
      <div className="w-full max-w-5xl space-y-12 animate-fade-in">
        
        {/* Logo & Wordmark */}
        <div className="flex flex-col items-center space-y-6">
          <h1 className="text-xl font-display font-semibold text-ink tracking-tight leading-tight">
            Lit<span className="font-normal text-stone-400">Tracker</span>
          </h1>
        </div>

        {/* Headline */}
        <div className="text-center">
          <h2 className="text-5xl font-display font-normal text-ink leading-tight">
            What are you working on?
          </h2>
        </div>

        {/* Projects or Create Button */}
        {hasProjects ? (
          <div className="space-y-8">
            {/* Project Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {inkState.projects.map((project, index) => {
                const { issueCount, pageCount } = getProjectStats(project);
                const ProjectTypeIcon = getProjectTypeIcon(project.projectType);
                const isMostRecent = index === 0;

                return (
                  <button
                    key={project.id}
                    onClick={() => handleSelectProject(project.id)}
                    className={`
                      group relative p-6 rounded-sm transition-all duration-300 text-left bg-card border border-stone-200 hover:border-stone-400
                      ${isMostRecent ? 'col-span-full lg:col-span-2 border-l-[3px] border-l-ember-500' : ''}
                    `}
                  >
                    {/* Project Type Icon */}
                    <div className="mb-4">
                      <ProjectTypeIcon className="w-8 h-8 text-stone-500" />
                    </div>

                    {/* Project Title */}
                    <h3 className="text-2xl font-display font-medium mb-3 text-ink transition-colors">
                      {project.title}
                    </h3>

                    {/* Project Stats */}
                    <div className="flex items-center gap-6 text-sm text-stone-500">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span>
                          {issueCount} {issueCount === 1 
                            ? (project.issueType === 'issue' ? 'issue' : 'chapter')
                            : (project.issueType === 'issue' ? 'issues' : 'chapters')
                          }
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4" />
                        <span>{pageCount} page{pageCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>

                    {/* Project Type Badge */}
                    <div className="mt-4">
                      <span className="inline-block px-3 py-1 bg-stone-100 text-stone-700 text-xs font-body rounded-full border border-stone-200">
                        {getProjectTypeLabel(project.projectType)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Create New Button for Returning Users */}
            <div className="flex justify-center pt-4">
              <button
                onClick={() => setShowNewProjectModal(true)}
                className="group flex items-center gap-3 px-6 py-3 bg-transparent text-ink border border-stone-200 hover:border-stone-400 hover:bg-stone-50 rounded font-body font-semibold text-sm transition-all duration-300"
              >
                <Plus className="w-5 h-5" />
                <span>
                  Create New Universe
                </span>
              </button>
            </div>
          </div>
        ) : (
          /* Create New Button for New Users */
          <div className="flex justify-center">
            <button
              onClick={() => setShowNewProjectModal(true)}
              className="group flex items-center gap-4 px-8 py-4 bg-transparent text-ink border border-stone-200 hover:border-stone-400 hover:bg-stone-50 rounded font-body font-semibold text-sm transition-all duration-300"
            >
              <Plus className="w-6 h-6" />
              <span>
                Create New Universe
              </span>
            </button>
          </div>
        )}

      </div>

      {/* New Project Modal */}
      {showNewProjectModal && (
        <NewProjectModal
          onClose={() => setShowNewProjectModal(false)}
          dispatch={inkDispatch}
        />
      )}
    </div>
  );
};

export default Gatekeeper;
