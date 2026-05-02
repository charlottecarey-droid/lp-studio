export interface TeamMember {
  name: string;
  title: string;
  photoUrl?: string;
}

export interface OverlayField {
  id: string;
  label: string;
  type:
    | "dso_name"
    | "phone"
    | "custom_text"
    | "qr_code"
    | "logo"
    | "dandy_logo"
    | "heading"
    | "divider"
    | "footer"
    | "link"
    | "meet_the_team";
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  bold: boolean;
  italic: boolean;
  defaultValue: string;
  // text / qr / logo
  qrSize?: number;
  logoUrl?: string;
  logoScale?: number;
  logoWidth?: number;
  logoHeight?: number;
  prefix?: string;
  suffix?: string;
  // divider
  lineThickness?: number;
  width?: number;        // % of page width (default 80)
  // heading / text
  lineHeight?: number;   // line-height factor, default 1.15
  // link
  underline?: boolean;
  // meet_the_team
  sectionTitle?: string;
  teamMembers?: TeamMember[];
  cardBg?: string;       // hex bg color for each card (default "rgba(0,0,0,0)")
  photoSize?: number;    // % of page width per photo circle (default 7)
  // ── Sales-rep editability (set by marketing in the template editor) ──
  /** When true, this field is shown as an editable input in the sales rep's
   *  PDF generation form. When false/undefined, the field is locked to its
   *  defaultValue and only marketing can change it. */
  editableBySales?: boolean;
  /** Optional override label shown to the sales rep (defaults to `label`). */
  salesLabel?: string;
  /** Optional help text shown under the input in the sales rep's form. */
  salesHelpText?: string;
}

export interface CustomTemplate {
  id?: number;
  name: string;
  background_url: string;
  orientation: string;
  fields: OverlayField[];
  isDeleted?: boolean;
  headerHeight?: number;
  headerImageUrl?: string;
  /** ISO timestamp set by the API when the template is created. */
  createdAt?: string;
}

export const TEMPLATE_VISIBILITY_KEY = "template_visibility";
export const DELETED_BUILTINS_KEY = "deleted_builtin_templates";
