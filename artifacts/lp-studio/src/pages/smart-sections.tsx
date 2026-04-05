'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  Plus,
  MoreVertical,
  Copy,
  Pencil,
  Unlink,
  GripVertical,
  Check,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

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

const SAMPLE_SECTIONS: SmartSection[] = [
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

const SECTION_TYPES: SectionType[] = ['Hero', 'CTA', 'Testimonial', 'Pricing', 'FAQ', 'Footer', 'Header', 'Feature'];

const TYPE_COLORS: Record<SectionType, string> = {
  Hero: 'bg-blue-100 text-blue-800',
  CTA: 'bg-red-100 text-red-800',
  Testimonial: 'bg-purple-100 text-purple-800',
  Pricing: 'bg-green-100 text-green-800',
  FAQ: 'bg-yellow-100 text-yellow-800',
  Footer: 'bg-gray-100 text-gray-800',
  Header: 'bg-indigo-100 text-indigo-800',
  Feature: 'bg-pink-100 text-pink-800',
};

const GRADIENT_COLORS = [
  'from-blue-400 to-cyan-300',
  'from-purple-400 to-pink-300',
  'from-green-400 to-emerald-300',
  'from-orange-400 to-red-300',
  'from-indigo-400 to-purple-300',
  'from-yellow-400 to-orange-300',
  'from-pink-400 to-rose-300',
  'from-teal-400 to-cyan-300',
];

export default function SmartSections() {
  const [sections, setSections] = useState<SmartSection[]>(SAMPLE_SECTIONS);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<SectionType | 'all'>('all');
  const [activeTab, setActiveTab] = useState('my-sections');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newSection, setNewSection] = useState({
    name: '',
    type: 'Hero' as SectionType,
    description: '',
  });
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const filteredSections = sections.filter((section) => {
    const matchesSearch = section.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || section.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleCreateSection = () => {
    if (!newSection.name.trim()) {
      setToastMessage('Please enter a section name');
      setShowToast(true);
      return;
    }

    const section: SmartSection = {
      id: `ss-${Date.now()}`,
      name: newSection.name,
      type: newSection.type,
      description: newSection.description,
      usedOn: 0,
      synced: false,
      createdAt: new Date().toISOString().split('T')[0],
      lastEdited: new Date().toISOString().split('T')[0],
    };

    setSections([...sections, section]);
    setNewSection({ name: '', type: 'Hero', description: '' });
    setIsCreateDialogOpen(false);
    setToastMessage('Section created successfully!');
    setShowToast(true);
  };

  const handleDuplicate = (id: string) => {
    const section = sections.find((s) => s.id === id);
    if (section) {
      const duplicated: SmartSection = {
        ...section,
        id: `ss-${Date.now()}`,
        name: `${section.name} (Copy)`,
        usedOn: 0,
        synced: false,
      };
      setSections([...sections, duplicated]);
      setToastMessage('Section duplicated successfully!');
      setShowToast(true);
    }
  };

  const handleDetach = (id: string) => {
    setSections(
      sections.map((s) =>
        s.id === id ? { ...s, synced: false, syncedPages: 0 } : s
      )
    );
    setToastMessage('Section detached from synced instances');
    setShowToast(true);
  };

  const getGradientClass = (index: number) => {
    return GRADIENT_COLORS[index % GRADIENT_COLORS.length];
  };

  const SectionCard = ({ section, index }: { section: SmartSection; index: number }) => (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-200">
      <div className={`h-24 bg-gradient-to-br ${getGradientClass(index)}`} />

      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-2 flex-1">
            <GripVertical className="h-4 w-4 text-gray-400 mt-1 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">{section.name}</h3>
              {section.description && (
                <p className="text-xs text-gray-500 truncate mt-1">{section.description}</p>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="cursor-pointer">
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={() => handleDuplicate(section.id)}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              {section.synced && (
                <DropdownMenuItem className="cursor-pointer" onClick={() => handleDetach(section.id)}>
                  <Unlink className="h-4 w-4 mr-2" />
                  Detach
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-2">
          <Badge className={TYPE_COLORS[section.type]}>{section.type}</Badge>

          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>{section.usedOn} pages</span>
            <span>{section.lastEdited}</span>
          </div>

          {section.synced ? (
            <div className="flex items-center gap-1 text-xs text-green-600">
              <span className="h-2 w-2 bg-green-600 rounded-full" />
              Synced on {section.syncedPages} pages
            </div>
          ) : (
            <div className="text-xs text-gray-500">Local only</div>
          )}
        </div>
      </div>
    </Card>
  );

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold">Smart Sections</h1>
          <p className="text-gray-600 mt-2">
            Create reusable content blocks that sync across all your pages
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="my-sections">My Sections</TabsTrigger>
            <TabsTrigger value="shared-library">Shared Library</TabsTrigger>
            <TabsTrigger value="global">Global Sections</TabsTrigger>
          </TabsList>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search sections..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Select value={filterType} onValueChange={(value) => setFilterType(value as SectionType | 'all')}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {SECTION_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Section
            </Button>
          </div>

          {/* My Sections Tab */}
          <TabsContent value="my-sections" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSections.length > 0 ? (
                filteredSections.map((section, index) => (
                  <SectionCard key={section.id} section={section} index={index} />
                ))
              ) : (
                <div className="col-span-full text-center py-12">
                  <p className="text-gray-600">No sections found matching your criteria</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Shared Library Tab */}
          <TabsContent value="shared-library" className="mt-6">
            <Card className="p-8 text-center">
              <p className="text-gray-600">Team shared sections will appear here</p>
            </Card>
          </TabsContent>

          {/* Global Sections Tab */}
          <TabsContent value="global" className="mt-6">
            <Card className="p-8 text-center">
              <p className="text-gray-600">Organization-wide sections will appear here</p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Section Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Section</DialogTitle>
            <DialogDescription>
              Create a reusable content block that can be used across multiple pages
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Section Name</label>
              <Input
                placeholder="e.g., Hero - Product Launch"
                value={newSection.name}
                onChange={(e) => setNewSection({ ...newSection, name: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Section Type</label>
              <Select value={newSection.type} onValueChange={(type) => setNewSection({ ...newSection, type: type as SectionType })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECTION_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Description (Optional)</label>
              <Textarea
                placeholder="Describe what this section is used for..."
                value={newSection.description}
                onChange={(e) => setNewSection({ ...newSection, description: e.target.value })}
                className="mt-1"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSection}>
              <Check className="h-4 w-4 mr-2" />
              Create Section
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <Check className="h-4 w-4" />
          {toastMessage}
          <button
            onClick={() => setShowToast(false)}
            className="ml-2 text-white hover:opacity-80"
          >
            ×
          </button>
        </div>
      )}
    </AppLayout>
  );
}
