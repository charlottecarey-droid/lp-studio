---
name: Microsite generator block-schema field parity
description: The sales-microsite generator hand-mirrors each block's prop schema AND a deterministic per-block normalizer; both must use the EXACT renderer prop field names or columns render empty / "Click to edit".
---

# Microsite generator block-schema field parity

`generate-microsite.ts` (sales microsites) describes every block to the AI with
a hand-written schema string (a map keyed by block type) AND runs a deterministic
per-block normalizer (`switch (type)`) that copies/defaults the AI's props into
the stored block JSON. NEITHER imports the renderer's prop types — they are
hand-maintained, so a field-name typo drifts silently.

**Symptom seen:** the `dso-comparison` block rendered its left column as empty
"Click to edit" placeholders on EVERY microsite, while the same block on
landing pages was fine. Root cause: the renderer `BlockDsoComparison` and the LP
generator (`generate-page.ts`) use row key **`need`**, but the microsite
generator used **`feature`** in TWO places:
1. the AI schema descriptor string (`rows: [{ feature, dandy, traditional }]`),
   so the model emitted `feature` and never `need`; and
2. the deterministic normalizer (`rows.map(r => ({ feature: r.feature ?? "", … }))`),
   which both read a non-existent `r.feature` and wrote a `feature` key the
   renderer ignores — double-guaranteeing `row.need` was empty.

**How to apply:** when adding or auditing a block in the microsite generator,
diff its schema-string field names AND its normalizer field names against the
actual renderer prop interface (and the LP generator's schema for the same
block). Column-style blocks are the easy miss — an empty column shows the
inline-editor placeholder, not an error. The `dandy` row key is a deliberate
internal name for the "us" column (NOT a brand name) and is correct as-is; only
`need` was wrong.
