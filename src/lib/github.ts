// src/lib/github.ts
import { Octokit } from 'octokit';
import { SmidrProjectData } from '@/types/keyboard';

const PROJECT_TAG = '[KeyboardBuilderProject]';

/**
 * Save or update a project to a GitHub Gist
 */
export const saveProjectToGist = async (
  octokit: Octokit,
  data: SmidrProjectData,
  name: string = "Smiðr Keyboard Layout",
  gistId?: string
) => {
  const files: Record<string, { content: string }> = {
    'source.json': { content: data['source.json'] },
    'keyboard.json': { content: data['keyboard.json'] },
    'via.json': { content: data['via.json'] },
  };

  const description = `${PROJECT_TAG} ${name}`;

  if (gistId) {
    const response = await octokit.rest.gists.update({
      gist_id: gistId,
      description,
      files,
    });
    return response.data;
  } else {
    const response = await octokit.rest.gists.create({
      description,
      public: false, 
      files,
    });
    return response.data;
  }
};

/**
 * Fetch all Smiðr projects from user's Gists
 */
export const fetchUserProjects = async (octokit: Octokit) => {
  const response = await octokit.rest.gists.list();
  return response.data.filter(gist => 
    gist.description?.includes(PROJECT_TAG)
  );
};

/**
 * Load project data from a specific Gist
 */
export const loadProjectFromGist = async (octokit: Octokit, gistId: string): Promise<SmidrProjectData | null> => {
  const response = await octokit.rest.gists.get({ gist_id: gistId });
  const files = response.data.files;
  
  if (!files || !files['source.json']?.content) {
    return null;
  }

  return {
    'source.json': files['source.json'].content,
    'keyboard.json': files['keyboard.json']?.content || '',
    'via.json': files['via.json']?.content || '',
  };
};
