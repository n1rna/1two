export type LayoutTemplate =
  | "centered"
  | "editorial"
  | "headline"
  | "cards"
  | "corners"
  | "minimal"
  | "custom";

export type GradientDirection =
  | "to-right"
  | "to-bottom"
  | "to-bottom-right"
  | "to-bottom-left"
  | "radial";

export type ExportFormat = "image/png" | "image/jpeg" | "image/webp";

export type FontWeight = "300" | "400" | "500" | "600" | "700" | "800";

export interface Theme {
  bgColor: string;
  useGradient: boolean;
  gradientColor1: string;
  gradientColor2: string;
  gradientDirection: GradientDirection;
  textColor: string;
  accentColor: string;
  fontFamily: string;
  titleSize: number;
  subtitleSize: number;
  titleWeight: FontWeight;
  padding: number;
  borderRadius: number;
}

export interface CustomElement {
  id: string;
  text: string;
  x: number; // 0-1
  y: number; // 0-1
  fontSize: number;
  fontWeight: string;
  color: string; // hex or "theme" to use theme.textColor
  opacity: number;
  textAlign: CanvasTextAlign;
  maxWidth?: number; // 0-1 range, proportion of canvas width; undefined = no wrapping
}

export interface OgImage {
  id: string;
  label: string;
  width: number;
  height: number;
  enabled: boolean;
  isCustom: boolean;
  title: string;
  subtitle: string;
  layout: LayoutTemplate;
  titleSize?: number;
  subtitleSize?: number;
  customElements?: CustomElement[];
}

export interface SavedCustomLayout {
  id: string;
  name: string;
  elements: CustomElement[];
}

export interface OgBuilderState {
  theme: Theme;
  images: OgImage[];
  exportFormat: ExportFormat;
  jpegQuality: number;
  defaultTitle: string;
  defaultSubtitle: string;
}

export interface OgCollectionSummary {
  id: string;
  slug: string;
  name: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OgCollection {
  id: string;
  slug: string;
  name: string;
  config: OgBuilderState;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}
