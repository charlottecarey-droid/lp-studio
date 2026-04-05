export interface OverlayField {
  id: string;
  label: string;
  type: "dso_name" | "phone" | "custom_text" | "qr_code" | "logo" | "dandy_logo";
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  bold: boolean;
  italic: boolean;
  defaultValue: string;
  qrSize?: number;
  logoUrl?: string;
  logoScale?: number;
  logoWidth?: number;
  logoHeight?: number;
  prefix?: string;
  suffix?: string;
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
}

export const TEMPLATE_VISIBILITY_KEY = "template_visibility";
export const DELETED_BUILTINS_KEY = "deleted_builtin_templates";
