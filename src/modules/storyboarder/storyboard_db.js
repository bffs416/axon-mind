import { supabase } from '../config.js';

export const storyboardDb = {
  async fetchProjects() {
    try {
      const { data: scenesData, error: scenesError } = await supabase
        .from('storyboard_scenes')
        .select('project_name');
      if (scenesError) throw scenesError;
      const sceneNames = scenesData ? scenesData.map(d => d.project_name) : [];

      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('title');
      if (tasksError) throw tasksError;
      const taskNames = tasksData ? tasksData.map(t => t.title) : [];

      const allNames = ['General', ...sceneNames, ...taskNames];
      return [...new Set(allNames)].filter(Boolean);
    } catch (e) {
      console.error('Error fetching projects:', e);
      return ['General'];
    }
  },

  async fetchScenes(projectName = 'General') {
    try {
      const { data, error } = await supabase
        .from('storyboard_scenes')
        .select('*')
        .eq('project_name', projectName)
        .order('scene_number', { ascending: true })
        .order('shot_number', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.error('Error fetching scenes:', e);
      return [];
    }
  },

  async saveScene(scene) {
    try {
      // Clean up fields to match DB columns
      const payload = {
        project_name: scene.project_name || 'General',
        scene_number: parseInt(scene.scene_number) || 1,
        scene_heading: scene.scene_heading || 'INT. ESCENA - DIA',
        shot_number: parseInt(scene.shot_number) || 1,
        camera_shot_type: scene.camera_shot_type || '',
        camera_angle: scene.camera_angle || '',
        camera_movement: scene.camera_movement || '',
        visual_effect: scene.visual_effect || '',
        action_description: scene.action_description || '',
        character_name: scene.character_name || '',
        dialogue: scene.dialogue || '',
        reference_image_url: scene.reference_image_url || '',
        reference_links: scene.reference_links || [],
        updated_at: new Date().toISOString()
      };

      let query;
      if (scene.id) {
        payload.id = scene.id;
        query = supabase
          .from('storyboard_scenes')
          .update(payload)
          .eq('id', scene.id);
      } else {
        query = supabase
          .from('storyboard_scenes')
          .insert(payload);
      }

      const { data, error } = await query.select();

      if (error) throw error;
      return data[0];
    } catch (e) {
      console.error('Error saving scene:', e);
      throw e;
    }
  },

  async deleteScene(id) {
    try {
      const { error } = await supabase
        .from('storyboard_scenes')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } catch (e) {
      console.error('Error deleting scene:', e);
      throw e;
    }
  },

  async uploadReferenceImage(file) {
    try {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result); // Returns Base64 Data URL
        };
        reader.onerror = (err) => {
          console.error('FileReader error:', err);
          reject(err);
        };
        reader.readAsDataURL(file);
      });
    } catch (e) {
      console.error('Error converting image to Base64:', e);
      throw e;
    }
  }
};

