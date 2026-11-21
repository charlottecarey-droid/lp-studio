/**
 * The hub's two looks. "classic" is the hub as it has always been; "polished" keeps the same structure and
 * restyles it (display face on headings and big numbers, the brand colour used as a surface, pill controls,
 * a quiet table header). A hub with no look saved is classic, so nothing changes until someone picks the new one.
 *
 * The polished look is only CSS layered over the classic rules, scoped to `.prw.v2`, and it reads the same
 * brand variables (--dark, --on-dark, --accent, --on-accent), so it follows each workspace's brand.
 */
export type RoomLook = "classic" | "polished";

export const ROOM_LOOKS: { id: RoomLook; label: string; hint: string }[] = [
  { id: "classic", label: "Classic", hint: "The hub as it looks today" },
  { id: "polished", label: "Polished", hint: "Same layout, with the brand font on headings and numbers, softer tables and pill buttons" },
];

export function roomLook(value: unknown): RoomLook {
  return value === "polished" ? "polished" : "classic";
}

/** The class the hub's root carries for a look ("" for classic). */
export function roomLookClass(value: unknown): string {
  return roomLook(value) === "polished" ? " v2" : "";
}

export const ROOM_LOOK_CSS = `
.prw.v2{--sand:#F6F5EE}
.prw.v2 .prw-cover h1{font-weight:500;letter-spacing:-.02em;line-height:1.03}
.prw.v2 .prw-eyebrow{font-size:11.5px;letter-spacing:.14em}
.prw.v2 .prw-stats b,.prw.v2 .prw-kpi .v,.prw.v2 .prw-date b,.prw.v2 .prw-tl-wave>b,.prw.v2 .prw-tl-all .top b,.prw.v2 .prw-sc-tile b,.prw.v2 .prw-ob .oh h3{font-family:var(--disp);font-weight:500;letter-spacing:-.01em}
.prw.v2 .prw-hd h2,.prw.v2 .prw-welcome h2{font-weight:500;letter-spacing:-.02em}
.prw.v2 .prw-req,.prw.v2 .prw-sched{height:38px;padding:0 18px;border-radius:999px}
.prw.v2 .prw-sheet,.prw.v2 .prw-gate{border-color:transparent;border-radius:20px;box-shadow:0 30px 70px -36px color-mix(in srgb,var(--dark) 55%,transparent),0 0 0 1px color-mix(in srgb,var(--dark) 7%,transparent)}
.prw.v2 .prw-toc button{border-radius:10px}
.prw.v2 .prw-toc button.on{background:var(--dark);color:var(--on-dark)}
.prw.v2 .prw-toc button.on .n{color:var(--accent)}
.prw.v2 .prw-toc button.on em{color:inherit;opacity:.8}
.prw.v2 .prw-btn{height:34px;padding:0 16px;border-radius:999px}
.prw.v2 .prw-ib{border-radius:50%}
.prw.v2 .prw-seg{padding:3px;border:0;border-radius:999px;background:var(--sand)}
.prw.v2 .prw-seg button{border:0;border-radius:999px;background:transparent}
.prw.v2 .prw-seg button.on{background:var(--dark);color:var(--on-dark)}
.prw.v2 .prw-tools select,.prw.v2 .prw-tools input{height:38px;border-radius:999px;padding:0 14px}
.prw.v2 .prw-sc-tools .prw-sc-search input{padding-left:35px}
.prw.v2 :is(.prw-card,.prw-kpi,.prw-progs,.prw-min,.prw-agree,.prw-ob,.prw-tl-wave,.prw-tl-all,.prw-sc-kit,.prw-sc-check){border-radius:16px}
.prw.v2 table{border-radius:16px}
.prw.v2 .prw-scroll{border-radius:16px}
.prw.v2 thead th{background:var(--sand);color:var(--body);font-size:11.5px;font-weight:600;letter-spacing:0;text-transform:none;padding-top:12px;padding-bottom:12px}
.prw.v2 tbody tr:not(.grp):not(.chk):not(.picked):hover>td{background:#FAFBF7}
.prw.v2 .prw-sc-table td{padding-top:12px;padding-bottom:12px}
.prw.v2 .prw-sc-table td .t{max-width:320px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.prw.v2 .prw-track{height:6px;border-radius:999px}
.prw.v2 .prw-track i{border-radius:999px}
.prw.v2 .prw-track b{top:-7px;width:20px;height:20px;margin-left:-10px;border-radius:50%;background:var(--accent);border:4px solid var(--dark)}
.prw.v2 .prw-track em{top:-34px}
.prw.v2 .prw-phases{gap:14px}
.prw.v2 .prw-ph,.prw.v2 .prw-ph+.prw-ph{padding:20px 22px;border:0;border-radius:16px;background:var(--sand)}
.prw.v2 .prw-ph h3{font-size:17px}
.prw.v2 .prw-ph[data-room-phase=current]{background:var(--dark)}
.prw.v2 .prw-ph[data-room-phase=current] h3{color:var(--on-dark)}
.prw.v2 .prw-ph[data-room-phase=current] :is(.d,p){color:color-mix(in srgb,var(--on-dark) 76%,transparent)}
.prw.v2 .prw-ph[data-room-phase=current] .prw-st{color:var(--accent)}
.prw.v2 .prw-ph[data-room-phase=current] .prw-edit:focus{background:transparent}
.prw.v2 .prw-tl-wave[data-room-wave=current]{background:var(--dark);border-color:var(--dark);box-shadow:none}
.prw.v2 .prw-tl-wave[data-room-wave=current]>b{color:var(--on-dark)}
.prw.v2 .prw-tl-wave[data-room-wave=current]>b i{color:color-mix(in srgb,var(--on-dark) 60%,transparent)}
.prw.v2 .prw-tl-wave[data-room-wave=current] :is(.d,.m){color:color-mix(in srgb,var(--on-dark) 76%,transparent)}
.prw.v2 .prw-tl-wave[data-room-wave=current] .prw-st{color:var(--accent)}
.prw.v2 .prw-tl-wave[data-room-wave=current] .track{background:color-mix(in srgb,var(--on-dark) 20%,transparent)}
.prw.v2 .prw-tl-wave[data-room-wave=current] .track span{background:var(--accent)}
.prw.v2 .prw-sc-tile{padding:18px 18px 14px;border-color:transparent;border-radius:16px;background:var(--sand)}
.prw.v2 .prw-sc-tile b{font-size:32px;line-height:1}
.prw.v2 .prw-sc-tile:hover{border-color:color-mix(in srgb,var(--dark) 30%,transparent)}
.prw.v2 .prw-sc-tile.on{border-color:var(--dark);box-shadow:inset 0 0 0 1px var(--dark)}
.prw.v2 .prw-sc-tile[data-room-tile=live]{background:var(--dark);color:color-mix(in srgb,var(--on-dark) 72%,transparent)}
.prw.v2 .prw-sc-tile[data-room-tile=live] b{color:var(--accent)}
.prw.v2 .prw-sc-tile[data-room-tile=live] span{color:var(--on-dark)}
.prw.v2 .prw-sc-tile[data-room-tile=live] small i:is(.up,.down){color:var(--accent)}
.prw.v2 .prw-sc-tile[data-room-tile=live].on{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}
.prw.v2 .prw-sc-bar{margin-bottom:26px}
.prw.v2 .prw-chip{padding:3px 11px;font-size:12px}
.prw.v2 .prw-map-zoom{border-radius:12px}
.prw.v2 .prw-sc-cols .menu{border-radius:14px}
`;
