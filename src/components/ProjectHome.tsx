import React from 'react';
import { Cable, Clock3, FileUp, FolderOpen, Plus, Trash2 } from 'lucide-react';
import type { SmidrProject } from '@/types/keyboard';

interface ProjectHomeProps {
  projects: SmidrProject[];
  onCreate: () => void;
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onConnect: () => void;
  onOpen: (project: SmidrProject) => void;
  onDelete: (event: React.MouseEvent, id: string) => void;
  labels: Record<'eyebrow' | 'title' | 'description' | 'create' | 'createDescription' | 'import' | 'importDescription' | 'connect' | 'connectDescription' | 'recent' | 'empty' | 'keys', string>;
}

const StartCard = ({ icon: Icon, title, description, children }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
  children?: React.ReactNode;
}) => (
  <div className="group relative min-h-40 overflow-hidden rounded-2xl border border-[var(--border-main)] bg-[var(--bg-panel)] p-5 text-left transition-all hover:-translate-y-0.5 hover:border-amber-500/50 hover:shadow-xl">
    <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500"><Icon size={22} /></div>
    <h3 className="text-base font-semibold text-[var(--text-highlight)]">{title}</h3>
    <p className="mt-2 max-w-xs text-sm leading-6 text-[var(--text-muted)]">{description}</p>
    {children}
  </div>
);

export const ProjectHome: React.FC<ProjectHomeProps> = ({ projects, onCreate, onImport, onConnect, onOpen, onDelete, labels }) => (
  <main className="h-full overflow-y-auto bg-[var(--bg-app)] px-5 py-8 custom-scrollbar sm:px-8 lg:px-12">
    <div className="mx-auto max-w-6xl">
      <span className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-500">{labels.eyebrow}</span>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-highlight)] sm:text-4xl">{labels.title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)] sm:text-base">{labels.description}</p>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <button type="button" onClick={onCreate} className="text-left"><StartCard icon={Plus} title={labels.create} description={labels.createDescription} /></button>
        <label className="cursor-pointer">
          <StartCard icon={FileUp} title={labels.import} description={labels.importDescription}>
            <input type="file" accept=".smidr" onChange={onImport} className="absolute inset-0 cursor-pointer opacity-0" />
          </StartCard>
        </label>
        <button type="button" onClick={onConnect} className="text-left"><StartCard icon={Cable} title={labels.connect} description={labels.connectDescription} /></button>
      </section>

      <section className="mt-12">
        <div className="mb-4 flex items-center gap-2"><Clock3 size={18} className="text-amber-500" /><h3 className="text-base font-semibold text-[var(--text-highlight)]">{labels.recent}</h3></div>
        {projects.length === 0 ? (
          <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-[var(--border-main)] text-sm text-[var(--text-muted)]">{labels.empty}</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[...projects].sort((a, b) => b.updatedAt - a.updatedAt).map(project => (
              <div key={project.id} className="group flex items-center gap-3 rounded-xl border border-[var(--border-main)] bg-[var(--bg-panel)] p-3 transition-colors hover:border-amber-500/40">
                <button type="button" onClick={() => onOpen(project)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-app)] text-[var(--text-muted)]"><FolderOpen size={20} /></span>
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold text-[var(--text-highlight)]">{project.name || 'Untitled'}</span><span className="mt-1 block text-xs text-[var(--text-muted)]">{new Date(project.updatedAt).toLocaleString()} · {project.keys.length} {labels.keys}</span></span>
                </button>
                <button type="button" onClick={(event) => onDelete(event, project.id)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--text-dim)] opacity-0 transition-all hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100 focus:opacity-100" aria-label={`Delete ${project.name}`}><Trash2 size={17} /></button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  </main>
);
