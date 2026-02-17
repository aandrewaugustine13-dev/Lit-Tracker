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

  return (
    <div className="h-screen w-screen bg-paper text-ink flex items-center justify-center p-8">
      <div className="w-full max-w-5xl space-y-12 animate-fade-in">
        
        {/* Logo */}
        <div className="flex flex-col items-center space-y-6">
          <h1 className="text-2xl font-display font-semibold text-ink tracking-tight">
            Lit<span className="font-normal text-steel-500">Tracker</span>
          </h1>
        </div>

        {/* Headline */}
        <div className="text-center">
          <h2 className="text-5xl font-display font-normal text-ink leading-tight tracking-tight">
            What are you working on?
          </h2>
        </div>

        {/* Projects or Create Button */}
        {hasProjects ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {inkState.projects.map((project, index) => {
                const { issueCount, pageCount } = getProjectStats(project);
                const ProjectTypeIcon = getProjectTypeIcon(project.projectType);
                const isMostRecent = index === 0;

                return (
                  <button
                    key={project.id}
                    onClick={() => handleSelectProject(project.id)}
                    className={`
                      group relative p-6 text-left bg-card border border-border rounded-sm
                      hover:border-steel-600 transition-all duration-200
                      ${isMostRecent ? 'col-span-full lg:col-span-2 border-l-[3px] border-l-ember-500' : ''}
                    `}
                  >
                    <div className="mb-3">
                      <ProjectTypeIcon className="w-6 h-6 text-steel-500" />
                    </div>

                    <h3 className="text-2xl font-display font-medium mb-3 text-ink group-hover:text-ember-500 transition-colors tracking-tight">
                      {project.title}
                    </h3>

                    <div className="flex items-center gap-5 text-sm text-steel-500">
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

                    <div className="mt-4">
                      <span className="inline-block px-3 py-1 bg-ink-900 text-steel-400 text-xs font-body rounded">
                        {getProjectTypeLabel(project.projectType)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-center pt-4">
              <button
                onClick={() => setShowNewProjectModal(true)}
                className="group flex items-center gap-3 px-6 py-3 bg-card text-ink border border-border hover:border-steel-600 rounded font-body font-semibold text-sm transition-all"
              >
                <Plus className="w-5 h-5 text-steel-500" />
                Create New Universe
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              onClick={() => setShowNewProjectModal(true)}
              className="group flex items-center gap-4 px-8 py-4 bg-ink text-white hover:bg-steel-200 rounded font-body font-semibold text-base transition-all"
            >
              <Plus className="w-6 h-6" />
              Create New Universe
            </button>
          </div>
        )}
      </div>

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
