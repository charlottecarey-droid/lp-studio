import type React from "react";
import type { BackgroundStyle } from "../bg-styles";

export type BlockCategory = "Layout" | "Content" | "Social Proof" | "CTA" | "Lead Capture" | "Engagement" | "Interactive" | "DSO" | "DSO Practices";

export type CtaMode = "link" | "chilipiper";

export type FormFieldType = "text" | "email" | "phone" | "textarea" | "select" | "checkbox" | "hidden";

export interface BlockSettings {
  anchorId?: string;
  spacingTop?: "none" | "xs" | "sm" | "md" | "lg" | "xl";
  spacingBottom?: "none" | "xs" | "sm" | "md" | "lg" | "xl";
  textScale?: "75" | "85" | "90" | "100" | "110" | "125" | "150";
  paddingX?: "none" | "sm" | "md" | "lg" | "xl";
  minHeight?: "none" | "25" | "50" | "75" | "100";
  bgColor?: string;
  textColor?: string;
  headlineColor?: string;
  bodyColor?: string;
  cardBgColor?: string;
  animationStyle?: "fade-up" | "fade-in" | "slide-left" | "slide-right" | "scale-in" | "none";
  animationDelay?: number;
  bgImageUrl?: string;
  bgImageParallax?: boolean;
  bgImageOpacity?: number;
}

/** Condition that controls whether a step or field is shown */
export interface StepCondition {
  /** The field ID whose value we check */
  fieldId: string;
  /** How to compare */
  operator: "equals" | "not_equals" | "contains" | "any_of";
  /** The value(s) to compare against. For "any_of", pipe-separated: "A|B|C" */
  value: string;
}

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  /** Static value or template variable for hidden fields (e.g. "{{utm_source}}", "Website") */
  defaultValue?: string;
  /** If set, this field is only visible when the condition is met */
  visibilityCondition?: StepCondition;
}

export interface FormStep {
  title: string;
  fields: FormField[];
  /** If set, this entire step is only shown when the condition is met */
  condition?: StepCondition;
}

export interface CaseStudyItem {
  image: string;
  logoUrl: string;
  title: string;
  categories: string;
  url: string;
}

export interface ResourceItem {
  image: string;
  title: string;
  description: string;
  category: string;
  url: string;
}

export interface NavHeaderLink {
  label: string;
  url: string;
}

export interface NavHeaderCta {
  label: string;
  url: string;
}

export interface FooterLink {
  label: string;
  url: string;
}

export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

export interface ZigzagFeatureRow {
  tag: string;
  headline: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
  ctaAction?: "url" | "chilipiper";
  chilipiperUrl?: string;
  imageUrl: string;
}

export interface ProductShowcaseCard {
  name: string;
  description: string;
  badge: string;
  image?: string;
}

export interface RoiInputField {
  id: string;
  label: string;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  suffix?: string;
  inputType: "number" | "slider";
}

export interface RoiOutputField {
  id: string;
  label: string;
  formula: string;
  format: "currency" | "number" | "percent";
  decimals: number;
  highlight?: boolean;
}

export type PopupTrigger = "exit-intent" | "scroll-percent" | "time-delay" | "click";
