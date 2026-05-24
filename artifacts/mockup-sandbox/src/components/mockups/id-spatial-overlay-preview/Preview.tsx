import { useInsideDandyStyles } from "../../../../../lp-studio/src/blocks/inside-dandy/insideDandyStyles";
import imgUrl from "../../../../../../attached_assets/image_1779585845215.png";

function Frame({ index, label, headline, where }: { index: number; label: string; headline: string; where: string }) {
  return (
    <div className={`id-frame id-f${index + 1} id-in-view`}>
      <div className="id-frame-img" style={{ backgroundImage: `url(${imgUrl})`, backgroundPosition: "center" }} />
      <div className="id-frame-vignette" />
      <div className="id-frame-spatial" aria-hidden>
        <span className="id-frame-spatial-corner id-frame-spatial-corner--tl" />
        <span className="id-frame-spatial-corner id-frame-spatial-corner--tr" />
        <span className="id-frame-spatial-corner id-frame-spatial-corner--bl" />
        <span className="id-frame-spatial-corner id-frame-spatial-corner--br" />
        <span className="id-frame-spatial-tick id-frame-spatial-tick--n" />
        <span className="id-frame-spatial-tick id-frame-spatial-tick--s" />
        <span className="id-frame-spatial-tick id-frame-spatial-tick--e" />
        <span className="id-frame-spatial-tick id-frame-spatial-tick--w" />
        <span className="id-frame-spatial-reticle" />
        <span className="id-frame-spatial-cross" />
        <span className="id-frame-spatial-pip" />
      </div>
      <div className="id-frame-caption">
        <div>
          <div className="id-frame-label">{label}</div>
          <h4 dangerouslySetInnerHTML={{ __html: headline }} />
        </div>
        <div className="id-frame-where">{where}</div>
      </div>
    </div>
  );
}

export default function Preview() {
  useInsideDandyStyles();
  return (
    <div style={{ background: "#061714", minHeight: "100vh", padding: 24 }}>
      <section className="id-block id-showcase" style={{ ["--id-parallax-start" as never]: "1.06" }}>
        <div className="id-stack">
          <Frame index={0} label="01 / CHAIRSIDE" headline="Scans, <em>verified</em>." where="OPERATORY" />
          <Frame index={1} label="02 / THE CROWN" headline="Every <em>margin</em> within microns." where="QA BENCH" />
          <Frame index={2} label="03 / THE TEAM" headline="Master ceramists, <em>AI co-pilots</em>." where="DESIGN STUDIO" />
        </div>
      </section>
    </div>
  );
}
