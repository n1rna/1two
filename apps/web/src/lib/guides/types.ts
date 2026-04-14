export interface GuideDefinition {
  slug: string;
  title: string;
  description: string;
  icon: string; // Lucide icon name
  /** Tool slugs this guide relates to */
  relatedTools: string[];
  /** Keywords for SEO */
  keywords: string[];
}
