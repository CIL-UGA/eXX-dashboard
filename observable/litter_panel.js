// ─────────────────────────────────────────────────────────────────────────────
// eXXpedition litter panel — Observable notebook cells (paste each block into its own cell)
// Data: the six litter_*.json / transect_survey_*.json files written by export_data.py
// ─────────────────────────────────────────────────────────────────────────────

// ── CELL 1: data location ────────────────────────────────────────────────────────
// Use the same base URL / FileAttachment pattern as your other panels. Swap `base` if yours differs.
base = "https://raw.githubusercontent.com/CIL-UGA/eXX-dashboard/main/data/"

// ── CELL 2: load the litter tables ───────────────────────────────────────────
litterRaw = Promise.all(
  ["litter_site", "litter_transect", "transect_survey", "litter_survey"].map(n => d3.json(`${base}${n}.json`))
).then(([sites, transects, surveys, items]) => ({ sites, transects, surveys, items }))

// ── CELL 3: shape the data (joins + numbers). `selectedLeg` = your existing leg filter value
// (a leg_id, or null/"all" for every leg). If your filter has another name, change it here only.
litterData = {
  const { sites, transects, surveys, items } = litterRaw;
  const legName = new Map(legs.map(l => [l.leg_id, l.leg_name]));          // `legs` = your expedition_leg.json cell
  const siteById = new Map(sites.map(s => [s.id, s]));
  const survByT = new Map(surveys.map(s => [s.transect_id, s]));
  const keep = d => selectedLeg == null || selectedLeg === "all" || +d.leg_id === +selectedLeg;
  const T = transects.filter(keep).map(t => {
    const s = survByT.get(t.id), site = siteById.get(t.site_id);
    const area = +s.transect_length * +s.transect_width;
    return { transect_id: t.id, site_id: t.site_id, site_label: site.site_label, site_type: t.site_type, leg_id: t.leg_id,
      leg: legName.get(t.leg_id), label: `${site.site_label}-T${t.transect}`, lat: +t.center_lat, lon: +t.center_lon,
      count: +s.trans_lit_count, area, per100: +s.trans_lit_count / area * 100, review: t.review_priority };
  });
  const ids = new Set(T.map(t => t.transect_id));
  const I = items.filter(i => ids.has(i.transect_id)).map(i => ({ ...i, quantity: +i.quantity, site_type: siteById.get(i.site_id).site_type }));
  const S = d3.rollups(T, v => ({ count: d3.sum(v, d => d.count), area: d3.sum(v, d => d.area), n: v.length,
      lat: d3.mean(v, d => d.lat), lon: d3.mean(v, d => d.lon) }), d => d.site_label)
    .map(([site_label, v]) => ({ site_label, ...v, per100: v.count / v.area * 100,
      site_type: T.find(t => t.site_label === site_label).site_type }));
  return { T, I, S };
}

// ── CELL 4: colours (placeholders — replace with your eXXpedition brand values) ───────────────
litterColors = ({ Land: "#1f6f8b", Coast: "#e07a3f" })

// ── CELL 5: headline numbers ─────────────────────────────────────────────────
litterKpis = html`<div style="display:flex;gap:2rem;flex-wrap:wrap;font:14px sans-serif">
  ${[["Sites", litterData.S.length], ["Transects", litterData.T.length],
     ["Items counted", d3.format(",")(d3.sum(litterData.T, d => d.count))],
     ["Median items / 100 m²", d3.format(".1f")(d3.median(litterData.T, d => d.per100) ?? 0)]]
    .map(([k, v]) => `<div><div style="font-size:28px;font-weight:600">${v}</div><div style="color:#666">${k}</div></div>`).join("")}
</div>`

// ── CELL 6: litter density by site ───────────────────────────────────────────
// Per 100 m² so land (50 × 1 m) and coast (20 × 5 m) transects are comparable.
litterDensity = Plot.plot({
  title: "Litter density by site",
  subtitle: "Items per 100 m² surveyed (land transects 50 × 1 m, coast transects 20 × 5 m)",
  marginLeft: 70, height: Math.max(220, litterData.S.length * 22 + 60),
  x: { label: "Items per 100 m²", grid: true },
  y: { label: null, domain: d3.sort(litterData.S, d => -d.per100).map(d => d.site_label) },
  color: { domain: ["Land", "Coast"], range: [litterColors.Land, litterColors.Coast], legend: true },
  marks: [
    Plot.barX(litterData.S, { y: "site_label", x: "per100", fill: "site_type",
      title: d => `${d.site_label}\n${d.count} items on ${d.n} transects\n${d.per100.toFixed(1)} per 100 m²` }),
    Plot.ruleX([0])
  ]
})

// ── CELL 7: what the litter is made of ───────────────────────────────────────
// Two panels (land | coast); each panel's bars are that site type's share of its own items.
litterMaterials = {
  const rows = d3.rollups(litterData.I, v => d3.sum(v, d => d.quantity), d => d.site_type, d => d.material)
    .flatMap(([site_type, m]) => { const tot = d3.sum(m, ([, q]) => q);
      return m.map(([material, q]) => ({ site_type, material, q, share: q / tot })); });
  const order = d3.sort(d3.rollups(rows, v => d3.sum(v, d => d.q), d => d.material), ([, q]) => -q).map(([m]) => m);
  return Plot.plot({
    title: "Material mix", subtitle: "Share of the items counted in each site type",
    marginLeft: 150, height: 400, width: 760,
    fx: { domain: ["Land", "Coast"], label: null }, x: { label: "Share of items (%)", percent: true, grid: true, ticks: 4 },
    y: { label: null, domain: order },
    marks: [
      Plot.barX(rows, { fx: "site_type", y: "material", x: "share", fill: d => litterColors[d.site_type],
        title: d => `${d.site_type}: ${d.material}\n${d.q} items (${(d.share * 100).toFixed(1)}%)` }),
      Plot.ruleX([0])
    ]
  });
}

// ── CELL 8: most common items ────────────────────────────────────────────────
litterTopItems = {
  const top = d3.sort(d3.rollups(litterData.I, v => d3.sum(v, d => d.quantity), d => d.item), ([, q]) => -q)
    .slice(0, 15).map(([item, q]) => ({ item, q }));
  return Plot.plot({
    title: "Fifteen most common items", marginLeft: 260, height: 400,
    x: { label: "Items counted", grid: true }, y: { label: null, domain: top.map(d => d.item) },
    marks: [Plot.barX(top, { y: "item", x: "q", fill: "#555", title: d => `${d.item}: ${d.q}` }), Plot.ruleX([0])]
  });
}

// ── CELL 9: transect maps, one per survey area (bubble size = items counted) ─────────────────
// Sites are far apart, so each area gets its own zoom. Areas are assigned by position for this expedition.
litterMap = {
  const area = t => t.lat > -35.9 ? "Bay of Islands" : t.lon > 175 ? "Great Barrier Island" : "Auckland";
  const groups = d3.groups(litterData.T, area).sort((a, b) => d3.ascending(a[0], b[0]));
  const rmax = d3.max(litterData.T, d => d.count) || 1;
  return html`<div style="display:flex;flex-wrap:wrap;gap:12px">${groups.map(([name, ts]) => {
    const sites = d3.rollups(ts, v => ({ lat: d3.mean(v, d => d.lat), lon: d3.mean(v, d => d.lon) }), d => d.site_label)
      .map(([site_label, v]) => ({ site_label, ...v }));
    const pad = 0.012, ext = [d3.extent(ts, d => d.lon), d3.extent(ts, d => d.lat)];
    const f = Plot.plot({
      title: name, width: 300, height: 300, margin: 8,
      projection: { type: "mercator", domain: { type: "MultiPoint", coordinates: [
        [ext[0][0] - pad, ext[1][0] - pad], [ext[0][1] + pad, ext[1][1] + pad]] } },
      r: { domain: [0, rmax], range: [2, 14] },
      color: { domain: ["Land", "Coast"], range: [litterColors.Land, litterColors.Coast] },
      marks: [
        Plot.frame({ stroke: "#ccc" }),
        Plot.dot(ts, { x: "lon", y: "lat", r: "count", fill: "site_type", fillOpacity: 0.6, stroke: "white",
          title: d => `${d.label} (${d.site_type})\n${d.count} items, ${d.per100.toFixed(1)} per 100 m²` }),
        Plot.text(sites, { x: "lon", y: "lat", text: "site_label", dy: -14, fontSize: 9, fill: "#333" })
      ]
    });
    return f.outerHTML;
  }).join("")}</div>`;
}
