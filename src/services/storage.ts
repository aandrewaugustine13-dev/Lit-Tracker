/**
 * Database Persistence Service for Parsed Scripts
 * Handles saving parsed script data to Supabase
 */

import { supabase, isSupabaseConfigured } from './supabase';
import type { ParsedScript, Page, Panel } from '../utils/scriptParser';

export interface SavedScriptRecord {
  id: string;
  project_id: string;
  created_at: string;
  characters: any;
  overall_lore_summary?: string;
}

/**
 * Save parsed script data to Supabase
 * Upserts top-level script record and replaces pages/panels
 */
export async function saveParsedScript(
  parsedData: ParsedScript,
  projectId: string
): Promise<string> {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured. Skipping database save.');
    return 'local-only';
  }

  if (!projectId) {
    throw new Error('Project ID is required to save parsed script');
  }

  try {
    // 1. Upsert top-level script record
    const { data: scriptRecord, error: scriptError } = await supabase!
      .from('parsed_scripts')
      .upsert(
        {
          project_id: projectId,
          characters: parsedData.characters,
          overall_lore_summary: parsedData.overall_lore_summary || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'project_id',
        }
      )
      .select()
      .single();

    if (scriptError) {
      throw new Error(`Failed to save script record: ${scriptError.message}`);
    }

    const scriptId = scriptRecord.id;

    // 2. Delete existing pages/panels for this script (replace strategy)
    const { error: deletePagesError } = await supabase!
      .from('pages')
      .delete()
      .eq('script_id', scriptId);

    if (deletePagesError) {
      console.warn('Failed to delete old pages:', deletePagesError.message);
    }

    // 3. Insert new pages
    if (parsedData.pages.length > 0) {
      const pageRecords = parsedData.pages.map((page) => ({
        script_id: scriptId,
        page_number: page.page_number,
      }));

      const { data: insertedPages, error: pagesError } = await supabase!
        .from('pages')
        .insert(pageRecords)
        .select();

      if (pagesError) {
        throw new Error(`Failed to insert pages: ${pagesError.message}`);
      }

      // 4. Insert panels for each page
      const panelRecords: any[] = [];
      parsedData.pages.forEach((page, pageIdx) => {
        const pageId = insertedPages![pageIdx].id;
        page.panels.forEach((panel) => {
          panelRecords.push({
            page_id: pageId,
            panel_number: panel.panel_number,
            description: panel.description,
            dialogue: panel.dialogue,
            panel_id: panel.panel_id,
          });
        });
      });

      if (panelRecords.length > 0) {
        const { error: panelsError } = await supabase!
          .from('panels')
          .insert(panelRecords);

        if (panelsError) {
          throw new Error(`Failed to insert panels: ${panelsError.message}`);
        }
      }
    }

    return scriptId;
  } catch (error) {
    console.error('Error saving parsed script to database:', error);
    throw error;
  }
}
