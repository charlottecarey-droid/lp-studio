import { Router, Request, Response } from 'express';

const router = Router();

type SectionType = 'Hero' | 'CTA' | 'Testimonial' | 'Pricing' | 'FAQ' | 'Footer' | 'Header' | 'Feature';

interface SmartSection {
  id: string;
  name: string;
  type: SectionType;
  description?: string;
  usedOn: number;
  synced: boolean;
  createdAt: string;
  lastEdited: string;
  syncedPages?: number;
}

// Sample sections data - in production this would come from a database
const sections: SmartSection[] = [
  {
    id: 'ss-001',
    name: 'Primary Hero v2',
    type: 'Hero',
    description: 'Main landing page hero with gradient background',
    usedOn: 5,
    synced: true,
    createdAt: '2024-03-15',
    lastEdited: '2024-04-02',
    syncedPages: 5,
  },
  {
    id: 'ss-002',
    name: 'Social Proof Bar',
    type: 'Testimonial',
    description: 'Customer logos and trust badges',
    usedOn: 8,
    synced: true,
    createdAt: '2024-02-20',
    lastEdited: '2024-03-28',
    syncedPages: 8,
  },
  {
    id: 'ss-003',
    name: 'Pricing Table - 3 Tier',
    type: 'Pricing',
    description: 'Standard 3-tier pricing comparison',
    usedOn: 3,
    synced: true,
    createdAt: '2024-01-10',
    lastEdited: '2024-03-15',
    syncedPages: 3,
  },
  {
    id: 'ss-004',
    name: 'FAQ Accordion',
    type: 'FAQ',
    description: 'Common questions with collapsible answers',
    usedOn: 2,
    synced: true,
    createdAt: '2024-03-01',
    lastEdited: '2024-03-25',
    syncedPages: 2,
  },
  {
    id: 'ss-005',
    name: 'CTA - Free Trial',
    type: 'CTA',
    description: 'Call-to-action section with trial signup',
    usedOn: 12,
    synced: true,
    createdAt: '2024-01-05',
    lastEdited: '2024-04-01',
    syncedPages: 12,
  },
  {
    id: 'ss-006',
    name: 'Footer - Minimal',
    type: 'Footer',
    description: 'Clean footer with links and copyright',
    usedOn: 15,
    synced: true,
    createdAt: '2023-12-01',
    lastEdited: '2024-03-20',
    syncedPages: 15,
  },
  {
    id: 'ss-007',
    name: 'Feature Grid - 4 Column',
    type: 'Feature',
    description: 'Product features showcase grid',
    usedOn: 4,
    synced: true,
    createdAt: '2024-02-15',
    lastEdited: '2024-03-30',
    syncedPages: 4,
  },
  {
    id: 'ss-008',
    name: 'Navigation Bar - Dark',
    type: 'Header',
    description: 'Dark themed header with dropdown menus',
    usedOn: 10,
    synced: true,
    createdAt: '2024-01-20',
    lastEdited: '2024-03-18',
    syncedPages: 10,
  },
  {
    id: 'ss-009',
    name: 'Stats Counter Section',
    type: 'Feature',
    description: 'Animated statistics display',
    usedOn: 6,
    synced: true,
    createdAt: '2024-02-10',
    lastEdited: '2024-03-22',
    syncedPages: 6,
  },
  {
    id: 'ss-010',
    name: 'Team Testimonials',
    type: 'Testimonial',
    description: 'Client success stories carousel',
    usedOn: 7,
    synced: false,
    createdAt: '2024-03-10',
    lastEdited: '2024-04-03',
  },
];

/**
 * GET /lp/smart-sections
 * Retrieve all smart sections with optional filtering
 * Query params:
 *   - type: Filter by section type (Hero, CTA, etc.)
 *   - synced: Filter by sync status (true/false)
 */
router.get('/lp/smart-sections', async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, synced } = req.query;

    let filteredSections = [...sections];

    if (type && typeof type === 'string') {
      filteredSections = filteredSections.filter((s) => s.type === type);
    }

    if (synced !== undefined) {
      const syncedBool = synced === 'true';
      filteredSections = filteredSections.filter((s) => s.synced === syncedBool);
    }

    res.json({
      success: true,
      data: filteredSections,
      count: filteredSections.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve smart sections',
    });
  }
});

/**
 * GET /lp/smart-sections/:id
 * Retrieve a specific smart section by ID
 */
router.get('/lp/smart-sections/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const section = sections.find((s) => s.id === id);

    if (!section) {
      res.status(404).json({
        success: false,
        error: 'Section not found',
      });
      return;
    }

    res.json({
      success: true,
      data: section,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve section',
    });
  }
});

/**
 * POST /lp/smart-sections
 * Create a new smart section
 * Body:
 *   - name (string, required)
 *   - type (SectionType, required)
 *   - description (string, optional)
 */
router.post('/lp/smart-sections', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, type, description } = req.body;

    // Validation
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({
        success: false,
        error: 'Section name is required',
      });
      return;
    }

    if (!type || typeof type !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Section type is required',
      });
      return;
    }

    const newSection: SmartSection = {
      id: `ss-${Date.now()}`,
      name: name.trim(),
      type: type as SectionType,
      description: description || undefined,
      usedOn: 0,
      synced: false,
      createdAt: new Date().toISOString().split('T')[0],
      lastEdited: new Date().toISOString().split('T')[0],
    };

    sections.push(newSection);

    res.status(201).json({
      success: true,
      data: newSection,
      message: 'Section created successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create section',
    });
  }
});

/**
 * PUT /lp/smart-sections/:id
 * Update an existing smart section
 */
router.put('/lp/smart-sections/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, type, description } = req.body;

    const sectionIndex = sections.findIndex((s) => s.id === id);

    if (sectionIndex === -1) {
      res.status(404).json({
        success: false,
        error: 'Section not found',
      });
      return;
    }

    const section = sections[sectionIndex];

    if (name) section.name = name;
    if (type) section.type = type as SectionType;
    if (description !== undefined) section.description = description;
    section.lastEdited = new Date().toISOString().split('T')[0];

    res.json({
      success: true,
      data: section,
      message: 'Section updated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update section',
    });
  }
});

/**
 * DELETE /lp/smart-sections/:id
 * Delete a smart section
 */
router.delete('/lp/smart-sections/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const sectionIndex = sections.findIndex((s) => s.id === id);

    if (sectionIndex === -1) {
      res.status(404).json({
        success: false,
        error: 'Section not found',
      });
      return;
    }

    const deletedSection = sections.splice(sectionIndex, 1);

    res.json({
      success: true,
      data: deletedSection[0],
      message: 'Section deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete section',
    });
  }
});

/**
 * POST /lp/smart-sections/:id/duplicate
 * Create a copy of an existing smart section
 */
router.post('/lp/smart-sections/:id/duplicate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const section = sections.find((s) => s.id === id);

    if (!section) {
      res.status(404).json({
        success: false,
        error: 'Section not found',
      });
      return;
    }

    const duplicatedSection: SmartSection = {
      ...section,
      id: `ss-${Date.now()}`,
      name: `${section.name} (Copy)`,
      usedOn: 0,
      synced: false,
      createdAt: new Date().toISOString().split('T')[0],
      lastEdited: new Date().toISOString().split('T')[0],
    };

    sections.push(duplicatedSection);

    res.status(201).json({
      success: true,
      data: duplicatedSection,
      newId: duplicatedSection.id,
      message: 'Section duplicated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to duplicate section',
    });
  }
});

/**
 * POST /lp/smart-sections/:id/detach
 * Detach a section from all synced instances
 */
router.post('/lp/smart-sections/:id/detach', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const sectionIndex = sections.findIndex((s) => s.id === id);

    if (sectionIndex === -1) {
      res.status(404).json({
        success: false,
        error: 'Section not found',
      });
      return;
    }

    const section = sections[sectionIndex];

    if (!section.synced) {
      res.status(400).json({
        success: false,
        error: 'Section is not synced',
      });
      return;
    }

    section.synced = false;
    section.syncedPages = 0;
    section.lastEdited = new Date().toISOString().split('T')[0];

    res.json({
      success: true,
      data: section,
      message: 'Section detached from all synced instances',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to detach section',
    });
  }
});

/**
 * POST /lp/smart-sections/:id/sync
 * Sync a section across specified pages
 * Body:
 *   - pageIds (string[], required)
 */
router.post('/lp/smart-sections/:id/sync', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { pageIds } = req.body;

    if (!Array.isArray(pageIds)) {
      res.status(400).json({
        success: false,
        error: 'pageIds must be an array',
      });
      return;
    }

    const sectionIndex = sections.findIndex((s) => s.id === id);

    if (sectionIndex === -1) {
      res.status(404).json({
        success: false,
        error: 'Section not found',
      });
      return;
    }

    const section = sections[sectionIndex];
    section.synced = true;
    section.syncedPages = pageIds.length;
    section.usedOn = pageIds.length;
    section.lastEdited = new Date().toISOString().split('T')[0];

    res.json({
      success: true,
      data: section,
      message: `Section synced to ${pageIds.length} page(s)`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to sync section',
    });
  }
});

export default router;
