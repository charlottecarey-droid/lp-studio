import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";

function moveArr<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
import type { MenuSectionBlockProps, MenuSectionCourse, MenuSectionDish } from "@/lib/block-types";
import { ColorField } from "./BlockSettingsPanel";

interface Props {
  props: MenuSectionBlockProps;
  onChange: (next: MenuSectionBlockProps) => void;
}

export function MenuSectionPanel({ props, onChange }: Props) {
  const update = (patch: Partial<MenuSectionBlockProps>) => onChange({ ...props, ...patch });

  const updateCourse = (ci: number, patch: Partial<MenuSectionCourse>) => {
    update({ courses: props.courses.map((c, i) => (i === ci ? { ...c, ...patch } : c)) });
  };
  const removeCourse = (ci: number) => update({ courses: props.courses.filter((_, i) => i !== ci) });
  const moveCourse = (ci: number, dir: -1 | 1) => update({ courses: moveArr(props.courses, ci, ci + dir) });
  const addCourse = () => update({
    courses: [...props.courses, { title: "New course", dishes: [{ name: "Dish", price: "$0" }] }],
  });

  const updateDish = (ci: number, di: number, patch: Partial<MenuSectionDish>) => {
    const course = props.courses[ci];
    if (!course) return;
    const dishes = course.dishes.map((d, i) => (i === di ? { ...d, ...patch } : d));
    updateCourse(ci, { dishes });
  };
  const removeDish = (ci: number, di: number) => {
    const course = props.courses[ci];
    if (!course) return;
    updateCourse(ci, { dishes: course.dishes.filter((_, i) => i !== di) });
  };
  const moveDish = (ci: number, di: number, dir: -1 | 1) => {
    const course = props.courses[ci];
    if (!course) return;
    updateCourse(ci, { dishes: moveArr(course.dishes, di, di + dir) });
  };
  const addDish = (ci: number) => {
    const course = props.courses[ci];
    if (!course) return;
    updateCourse(ci, { dishes: [...course.dishes, { name: "New dish", price: "$0" }] });
  };

  return (
    <div className="space-y-4">
      <BlockRefreshButton
        blockType="menu-section"
        fields={["eyebrow", "headline", "subheadline"]}
        values={{ eyebrow: props.eyebrow ?? "", headline: props.headline, subheadline: props.subheadline ?? "" }}
        onApply={(u) => onChange({ ...props, ...u })}
      />
      <div>
        <Label className="text-xs">Eyebrow</Label>
        <Input value={props.eyebrow ?? ""} onChange={(e) => update({ eyebrow: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">Headline</Label>
        <Input value={props.headline} onChange={(e) => update({ headline: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">Subheadline</Label>
        <Textarea value={props.subheadline ?? ""} onChange={(e) => update({ subheadline: e.target.value })} rows={2} />
      </div>

      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Courses</Label>
          <Button size="sm" variant="outline" onClick={addCourse}><Plus className="h-3 w-3 mr-1" />Course</Button>
        </div>
        {props.courses.map((course, ci) => (
          <div key={ci} className="border rounded-md p-3 space-y-2">
            <div className="flex gap-2 items-center">
              <Input value={course.title} onChange={(e) => updateCourse(ci, { title: e.target.value })} placeholder="Course title" />
              <Button size="icon" variant="ghost" disabled={ci === 0} onClick={() => moveCourse(ci, -1)}><ChevronUp className="h-3 w-3" /></Button>
              <Button size="icon" variant="ghost" disabled={ci === props.courses.length - 1} onClick={() => moveCourse(ci, 1)}><ChevronDown className="h-3 w-3" /></Button>
              <Button size="icon" variant="ghost" onClick={() => removeCourse(ci)}><Trash2 className="h-3 w-3" /></Button>
            </div>
            <Input value={course.description ?? ""} onChange={(e) => updateCourse(ci, { description: e.target.value })} placeholder="Course description (optional)" />

            <div className="space-y-2 pl-2 border-l">
              {course.dishes.map((dish, di) => (
                <div key={di} className="space-y-1.5 p-2 bg-slate-50 rounded">
                  <div className="flex gap-2">
                    <Input value={dish.name} onChange={(e) => updateDish(ci, di, { name: e.target.value })} placeholder="Dish" className="flex-1" />
                    <Input value={dish.price} onChange={(e) => updateDish(ci, di, { price: e.target.value })} placeholder="$0" className="w-20" />
                    <Button size="icon" variant="ghost" disabled={di === 0} onClick={() => moveDish(ci, di, -1)}><ChevronUp className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" disabled={di === course.dishes.length - 1} onClick={() => moveDish(ci, di, 1)}><ChevronDown className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => removeDish(ci, di)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                  <Textarea value={dish.description ?? ""} onChange={(e) => updateDish(ci, di, { description: e.target.value })} placeholder="Description" rows={1} className="text-xs" />
                  <Input
                    value={(dish.tags ?? []).join(", ")}
                    onChange={(e) => updateDish(ci, di, { tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                    placeholder="Tags (comma separated)"
                    className="text-xs"
                  />
                </div>
              ))}
              <Button size="sm" variant="ghost" onClick={() => addDish(ci)}><Plus className="h-3 w-3 mr-1" />Dish</Button>
            </div>
          </div>
        ))}
      </div>

      <div>
        <Label className="text-xs">Footnote</Label>
        <Input value={props.footnote ?? ""} onChange={(e) => update({ footnote: e.target.value })} />
      </div>
      <ColorField label="Background" value={props.bgColor ?? "#FAF7F2"} onChange={(v) => update({ bgColor: v })} />
      <ColorField label="Text" value={props.textColor ?? "#1A1A1A"} onChange={(v) => update({ textColor: v })} />
      <ColorField label="Accent" value={props.accentColor ?? "#8B0000"} onChange={(v) => update({ accentColor: v })} />
    </div>
  );
}
