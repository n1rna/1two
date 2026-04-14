import type {
  Theme,
  OgImage,
  GradientDirection,
  CustomElement,
} from "./types";

// Satori only renders fonts that are explicitly loaded.
// @vercel/og ships with a default sans-serif font, so we
// normalise every fontFamily to undefined (= use the default).

// ── Gradient helpers ──────────────────────────────────────

function gradientCss(theme: Theme): string {
  const { gradientColor1: c1, gradientColor2: c2, gradientDirection: d } = theme;
  if (d === "radial") return `radial-gradient(circle, ${c1}, ${c2})`;
  const dirs: Record<GradientDirection, string> = {
    "to-right": "to right",
    "to-bottom": "to bottom",
    "to-bottom-right": "to bottom right",
    "to-bottom-left": "to bottom left",
    radial: "to right",
  };
  return `linear-gradient(${dirs[d]}, ${c1}, ${c2})`;
}

// ── Layout renderers ──────────────────────────────────────

function CenteredLayout({ img, theme }: { img: OgImage; theme: Theme }) {
  const pad = theme.padding;
  const titleSize = img.titleSize ?? theme.titleSize;
  const subtitleSize = img.subtitleSize ?? theme.subtitleSize;
  const lineLen = Math.min((img.width - pad * 2) * 0.18, 80);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        padding: pad,
      }}
    >
      <div
        style={{
          width: lineLen,
          height: 2,
          backgroundColor: theme.accentColor,
          marginBottom: titleSize * 0.5,
        }}
      />
      <div
        style={{
          fontSize: titleSize,
          fontWeight: Number(theme.titleWeight),
          color: theme.textColor,
          lineHeight: 1.25,
          textAlign: "center",
          display: "flex",
        }}
      >
        {img.title || ""}
      </div>
      {img.subtitle ? (
        <div
          style={{
            fontSize: subtitleSize,
            fontWeight: 400,
            color: theme.textColor,
            opacity: 0.6,
            lineHeight: 1.3,
            textAlign: "center",
            display: "flex",
            marginTop: titleSize * 0.55 * 0.5,
          }}
        >
          {img.subtitle}
        </div>
      ) : null}
    </div>
  );
}

function EditorialLayout({ img, theme }: { img: OgImage; theme: Theme }) {
  const pad = theme.padding;
  const titleSize = img.titleSize ?? theme.titleSize;
  const subtitleSize = img.subtitleSize ?? theme.subtitleSize;
  const labelSize = Math.max(subtitleSize * 0.7, 14);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        width: "100%",
        height: "100%",
        paddingTop: pad * 1.4,
        paddingBottom: pad * 1.4,
        paddingLeft: pad,
        paddingRight: pad,
      }}
    >
      {img.subtitle ? (
        <div
          style={{
            fontSize: labelSize,
            fontWeight: 600,
            color: theme.accentColor,
            marginBottom: labelSize * 1.2,
            display: "flex",
          }}
        >
          {img.subtitle.toUpperCase()}
        </div>
      ) : null}
      <div
        style={{
          fontSize: titleSize,
          fontWeight: Number(theme.titleWeight),
          color: theme.textColor,
          lineHeight: 1.2,
          textAlign: "left",
          display: "flex",
        }}
      >
        {img.title || ""}
      </div>
    </div>
  );
}

function HeadlineLayout({ img, theme }: { img: OgImage; theme: Theme }) {
  const pad = theme.padding;
  const titleSize = img.titleSize ?? theme.titleSize;
  const subtitleSize = img.subtitleSize ?? theme.subtitleSize;
  const bigSize = Math.min(titleSize * 1.4, img.width * 0.14);
  const pillSize = Math.max(subtitleSize * 0.7, 14);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        padding: pad,
      }}
    >
      <div
        style={{
          fontSize: bigSize,
          fontWeight: Number(theme.titleWeight),
          color: theme.textColor,
          lineHeight: 1.15,
          textAlign: "left",
          display: "flex",
        }}
      >
        {img.title || ""}
      </div>
      {img.subtitle ? (
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: pad,
            right: pad,
            fontSize: pillSize,
            fontWeight: 500,
            color: theme.textColor,
            opacity: 0.65,
            backgroundColor: `${theme.textColor}1f`,
            borderRadius: 999,
            paddingTop: pillSize * 0.5,
            paddingBottom: pillSize * 0.5,
            paddingLeft: pillSize * 0.8,
            paddingRight: pillSize * 0.8,
          }}
        >
          {img.subtitle}
        </div>
      ) : null}
    </div>
  );
}

function CardsLayout({ img, theme }: { img: OgImage; theme: Theme }) {
  const pad = theme.padding;
  const titleSize = img.titleSize ?? theme.titleSize;
  const subtitleSize = img.subtitleSize ?? theme.subtitleSize;
  const r = Math.max(theme.borderRadius, 12);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        padding: pad,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          backgroundColor: `${theme.textColor}1f`,
          border: `1px solid ${theme.textColor}2e`,
          borderRadius: r,
          paddingTop: pad * 0.9,
          paddingBottom: pad * 0.9,
          paddingLeft: pad * 1.2,
          paddingRight: pad * 1.2,
          maxWidth: img.width - pad * 2,
        }}
      >
        <div
          style={{
            fontSize: titleSize,
            fontWeight: Number(theme.titleWeight),
            color: theme.textColor,
            lineHeight: 1.25,
            textAlign: "left",
            display: "flex",
          }}
        >
          {img.title || ""}
        </div>
        {img.subtitle ? (
          <div
            style={{
              fontSize: subtitleSize,
              fontWeight: 400,
              color: theme.textColor,
              opacity: 0.6,
              lineHeight: 1.3,
              textAlign: "left",
              display: "flex",
              marginTop: titleSize * 0.45 * 0.5,
            }}
          >
            {img.subtitle}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CornersLayout({ img, theme }: { img: OgImage; theme: Theme }) {
  const pad = theme.padding;
  const titleSize = img.titleSize ?? theme.titleSize;
  const subtitleSize = img.subtitleSize ?? theme.subtitleSize;
  const markLen = Math.min(pad * 0.9, 48);
  const markThick = 2;
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        padding: pad,
        position: "relative",
      }}
    >
      {/* Top-left corner mark */}
      <div style={{ position: "absolute", top: pad, left: pad, display: "flex", flexDirection: "column" }}>
        <div style={{ width: markLen, height: markThick, backgroundColor: theme.accentColor }} />
        <div style={{ width: markThick, height: markLen - markThick, backgroundColor: theme.accentColor }} />
      </div>
      {/* Bottom-right corner mark */}
      <div
        style={{
          position: "absolute",
          bottom: pad,
          right: pad,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
        }}
      >
        <div style={{ width: markThick, height: markLen - markThick, backgroundColor: theme.accentColor }} />
        <div style={{ width: markLen, height: markThick, backgroundColor: theme.accentColor }} />
      </div>
      {/* Title bottom-left */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          bottom: pad,
          left: pad,
          maxWidth: img.width - pad * 2.5,
        }}
      >
        <div
          style={{
            fontSize: titleSize,
            fontWeight: Number(theme.titleWeight),
            color: theme.textColor,
            lineHeight: 1.2,
            textAlign: "left",
            display: "flex",
          }}
        >
          {img.title || ""}
        </div>
      </div>
      {/* Subtitle top-right */}
      {img.subtitle ? (
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: pad + markLen + subtitleSize * 0.4,
            right: pad,
            maxWidth: (img.width - pad * 2.5) * 0.55,
          }}
        >
          <div
            style={{
              fontSize: subtitleSize,
              fontWeight: 400,
              color: theme.textColor,
              opacity: 0.6,
              lineHeight: 1.3,
              textAlign: "right",
              display: "flex",
            }}
          >
            {img.subtitle}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MinimalLayout({ img, theme }: { img: OgImage; theme: Theme }) {
  const pad = theme.padding;
  const titleSize = img.titleSize ?? theme.titleSize;
  const bigSize = Math.min(titleSize * 1.5, img.width * 0.11);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        padding: pad,
      }}
    >
      <div
        style={{
          fontSize: bigSize,
          fontWeight: Number(theme.titleWeight),
          color: theme.textColor,
          lineHeight: 1.2,
          textAlign: "center",
          display: "flex",
        }}
      >
        {img.title || ""}
      </div>
    </div>
  );
}

function CustomLayout({ img, theme }: { img: OgImage; theme: Theme }) {
  const elements = img.customElements ?? defaultCustomElements(img.title, img.subtitle, theme, img);
  return (
    <div style={{ display: "flex", width: "100%", height: "100%", position: "relative" }}>
      {elements.map((el) => {
        if (!el.text) return null;
        const color = el.color === "theme" ? theme.textColor : el.color;
        return (
          <div
            key={el.id}
            style={{
              position: "absolute",
              left: el.x * 100 + "%",
              top: el.y * 100 + "%",
              fontSize: el.fontSize,
              fontWeight: Number(el.fontWeight),
              color,
              opacity: el.opacity,
              textAlign: el.textAlign,
              display: "flex",
              maxWidth: el.maxWidth ? el.maxWidth * 100 + "%" : undefined,
            }}
          >
            {el.text}
          </div>
        );
      })}
    </div>
  );
}

function defaultCustomElements(
  title: string,
  subtitle: string,
  theme: Theme,
  img: OgImage,
): CustomElement[] {
  const els: CustomElement[] = [
    {
      id: "title",
      text: title,
      x: 0.5,
      y: 0.42,
      fontSize: img.titleSize ?? theme.titleSize,
      fontWeight: theme.titleWeight,
      color: "theme",
      opacity: 1,
      textAlign: "center",
      maxWidth: 0.8,
    },
  ];
  if (subtitle) {
    els.push({
      id: "subtitle",
      text: subtitle,
      x: 0.5,
      y: 0.62,
      fontSize: img.subtitleSize ?? theme.subtitleSize,
      fontWeight: "400",
      color: "theme",
      opacity: 0.6,
      textAlign: "center",
      maxWidth: 0.7,
    });
  }
  return els;
}

// ── Layout router ─────────────────────────────────────────

function LayoutContent({ img, theme }: { img: OgImage; theme: Theme }) {
  switch (img.layout) {
    case "centered":
      return <CenteredLayout img={img} theme={theme} />;
    case "editorial":
      return <EditorialLayout img={img} theme={theme} />;
    case "headline":
      return <HeadlineLayout img={img} theme={theme} />;
    case "cards":
      return <CardsLayout img={img} theme={theme} />;
    case "corners":
      return <CornersLayout img={img} theme={theme} />;
    case "minimal":
      return <MinimalLayout img={img} theme={theme} />;
    case "custom":
      return <CustomLayout img={img} theme={theme} />;
    default:
      return <CenteredLayout img={img} theme={theme} />;
  }
}

// ── Main render function ──────────────────────────────────

export function renderOgImage(img: OgImage, theme: Theme): React.ReactElement {
  const bg = theme.useGradient ? gradientCss(theme) : theme.bgColor;
  const useGradientBg = theme.useGradient;
  return (
    <div
      style={{
        display: "flex",
        width: img.width,
        height: img.height,
        ...(useGradientBg
          ? { backgroundImage: bg }
          : { backgroundColor: bg }),
        borderRadius: theme.borderRadius > 0 ? theme.borderRadius : 0,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <LayoutContent img={img} theme={theme} />
    </div>
  );
}
