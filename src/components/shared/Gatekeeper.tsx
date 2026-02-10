import React, { useState } from 'react';
import { useLitStore } from '../../store';
import { Flame, Plus, FileText, Layers } from 'lucide-react';
import NewProjectModal from '../ink/NewProjectModal';
import { InkProject } from '../../types';

const Gatekeeper: React.FC = () => {
  const { inkState, inkDispatch } = useLitStore();
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);

  const handleSelectProject = (projectId: string) => {
    inkDispatch({ type: 'SET_ACTIVE_PROJECT', id: projectId });
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
    <div className="h-screen w-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-8">
      <div className="w-full max-w-5xl space-y-12 animate-fade-in">
        
        {/* Logo & Wordmark */}
        <div className="flex flex-col items-center space-y-6">
          <div className="flex items-center justify-center">
            <div className="relative">
              <Flame 
                className="w-16 h-16 text-amber-500 animate-pulse-glow" 
                strokeWidth={1.5}
              />
            </div>
          </div>
          <h1 className="text-2xl font-mono tracking-widest text-amber-500">
            LIT TRACKER
          </h1>
        </div>

        {/* Headline */}
        <div className="text-center">
          <h2 className="text-5xl font-display text-zinc-100">
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
                      group relative p-6 rounded-xl transition-all duration-300 text-left
                      ${isMostRecent 
                        ? 'bg-zinc-900 border-2 border-amber-500 shadow-lg shadow-amber-500/20 hover:shadow-xl hover:shadow-amber-500/30 col-span-full lg:col-span-2' 
                        : 'bg-zinc-900/60 border border-zinc-700 hover:bg-zinc-900 hover:border-zinc-600'
                      }
                    `}
                  >
                    {isMostRecent && (
                      <div className="absolute -top-3 -right-3 bg-amber-500 text-zinc-950 text-xs font-bold px-3 py-1 rounded-full">
                        Recent
                      </div>
                    )}

                    {/* Project Type Icon */}
                    <div className="mb-4">
                      <ProjectTypeIcon className={`w-8 h-8 ${isMostRecent ? 'text-amber-500' : 'text-zinc-400'}`} />
                    </div>

                    {/* Project Title */}
                    <h3 className={`text-2xl font-bold mb-3 group-hover:text-amber-500 transition-colors ${isMostRecent ? 'text-zinc-50' : 'text-zinc-200'}`}>
                      {project.title}
                    </h3>

                    {/* Project Stats */}
                    <div className="flex items-center gap-6 text-sm text-zinc-400">
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
                      <span className="inline-block px-3 py-1 bg-zinc-700/50 text-zinc-300 text-xs font-mono rounded-full">
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
                className="group flex items-center gap-3 px-6 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-600 hover:border-amber-500 rounded-xl transition-all duration-300"
              >
                <Plus className="w-5 h-5 text-zinc-400 group-hover:text-amber-500 transition-colors" />
                <span className="text-zinc-300 group-hover:text-amber-500 transition-colors font-medium">
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
              className="group flex items-center gap-4 px-8 py-4 bg-amber-600 hover:bg-amber-500 rounded-xl transition-all duration-300 shadow-lg shadow-amber-500/20 hover:shadow-xl hover:shadow-amber-500/30"
            >
              <Plus className="w-6 h-6 text-zinc-950" />
              <span className="text-zinc-950 font-bold text-lg">
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
