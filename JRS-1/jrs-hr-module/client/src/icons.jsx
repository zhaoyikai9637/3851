import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  ChartColumn,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Mail,
  Plus,
  ScrollText,
  Search,
  UserRound,
  Users,
} from "lucide-react";

// One icon set (Lucide) across the applicant portal and the HR workspace.
// Callers keep using semantic names so the visual set can change in one place.
const icons = {
  plus: Plus,
  search: Search,
  dashboard: LayoutDashboard,
  applications: ClipboardList,
  candidates: Users,
  jobs: BriefcaseBusiness,
  calendar: CalendarDays,
  reports: ChartColumn,
  bell: Bell,
  mail: Mail,
  templates: FileText,
  log: ScrollText,
  person: UserRound,
};

export function Icon({ name, size = 20 }) {
  const Glyph = icons[name] || ScrollText;
  return <Glyph size={size} strokeWidth={1.75} aria-hidden="true" focusable="false" />;
}
