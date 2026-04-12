import { HomeLanding } from "@/components/home-landing";
import { homepageJsonLd } from "@/lib/tools/seo";

export default function Home() {
  const jsonLdItems = homepageJsonLd();
  return (
    <>
      {jsonLdItems.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <HomeLanding />
    </>
  );
}
