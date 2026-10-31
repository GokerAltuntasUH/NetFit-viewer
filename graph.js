/* Pure operations for inspecting graph observations. */
(function(root) {
"use strict";
function validateScene(scene) {
  const fail = message => { throw new Error(message); };
  if (!scene || scene.format !== "graph-workshop-scenario" || scene.schema_version !== 1)
    fail("Choose a scenario JSON exported by the current workshop notebook (schema 1). A ZIP or collection manifest is not a scenario.");
  for (const key of ["nodes","roads","buildings"]) if (!Array.isArray(scene[key])) fail(`Missing ${key} array.`);
  if (!scene.nodes.length || scene.nodes.length>5000 || scene.roads.length>12000 || scene.buildings.length>1500)
    fail("Use 1\u20135,000 nodes, at most 12,000 roads, and 1,500 buildings.");
  const s=scene.site;
  if (!s || ![s.min_x,s.max_x,s.min_y,s.max_y].every(Number.isFinite) || s.min_x>=s.max_x || s.min_y>=s.max_y) fail("Invalid site bounds.");
  const nodes=new Map();
  for (const n of scene.nodes) {
    if (!n || !Number.isSafeInteger(n.id) || nodes.has(n.id) || !["road","building"].includes(n.type) || !Number.isFinite(n.x) || !Number.isFinite(n.y))
      fail("Nodes need unique integer IDs, finite x/y coordinates, and a road or building type.");
    nodes.set(n.id,n);
  }
  for (const key of ["roads","buildings"]) {
    const ids=new Set();
    for (const item of scene[key]) {
      if (!item || !Number.isSafeInteger(item.id) || ids.has(item.id)) fail(`${key} need unique integer IDs.`);
      ids.add(item.id);
    }
  }
  const pairs=new Set();
  for (const r of scene.roads) {
    if (r.source===r.target || nodes.get(r.source)?.type!=="road" || nodes.get(r.target)?.type!=="road") fail("Roads must join two distinct road nodes.");
    const key=[r.source,r.target].sort((a,b)=>a-b).join(":");
    if (pairs.has(key)) fail("Store each physical road once, without reversed duplicates.");
    pairs.add(key);
  }
  const owned=new Set();
  for (const b of scene.buildings) {
    if (!Array.isArray(b.corners) || b.corners.length!==4 || new Set(b.corners).size!==4 || b.corners.some(id=>nodes.get(id)?.type!=="building")) fail("Buildings must reference four distinct building corners.");
    for (const id of b.corners) { if (owned.has(id)) fail("Building corners cannot belong to multiple buildings."); owned.add(id); }
    const [a,c,d,e]=b.corners.map(id=>nodes.get(id));
    if (!(a.x<c.x && a.y<e.y && a.y===c.y && c.x===d.x && d.y===e.y && e.x===a.x)) fail("Building corners must be an axis-aligned rectangle ordered lower-left, lower-right, upper-right, upper-left.");
  }
  if ([...scene.nodes.flatMap(n=>[n.x,n.y]),s.min_x,s.max_x,s.min_y,s.max_y].some(v=>Math.abs(v)>1e9)) fail("Coordinates must be within \u00b11,000,000,000.");
  return scene;
}
// Boundary contact counts as intersection, matching the workshop scoring rules.
function intersects(a,b,lower,upper) {
  let entry=0, exit=1;
  for (const axis of ["x","y"]) {
    const delta=b[axis]-a[axis];
    if (delta===0) { if (a[axis]<lower[axis] || a[axis]>upper[axis]) return false; }
    else {
      const t1=(lower[axis]-a[axis])/delta,t2=(upper[axis]-a[axis])/delta;
      entry=Math.max(entry,Math.min(t1,t2)); exit=Math.min(exit,Math.max(t1,t2));
      if (entry>exit) return false;
    }
  }
  return true;
}
function contextEdges(scene) {
  const nodes=new Map(scene.nodes.map(n=>[n.id,n])), unique=new Map();
  let conflicts=0;
  for (const road of scene.roads) for (const building of scene.buildings) {
    if (!intersects(nodes.get(road.source),nodes.get(road.target),nodes.get(building.corners[0]),nodes.get(building.corners[2]))) continue;
    conflicts++;
    for (const source of building.corners) for (const target of [road.source,road.target]) {
      unique.set(`${source}:${target}`,{source,target,type:"obstacle_context"});
      if (unique.size>60000) throw new Error("Too many context links to inspect interactively. Choose a smaller layout.");
    }
  }
  return {edges:[...unique.values()],conflicts};
}
function messageEdges(scene,context,options) {
  const edges=[];
  for (const r of scene.roads) {
    edges.push({source:r.source,target:r.target,type:"road"});
    if (options.bidirectional) edges.push({source:r.target,target:r.source,type:"road"});
  }
  if (options.context) edges.push(...context);
  if (options.self) for (const n of scene.nodes) edges.push({source:n.id,target:n.id,type:"self"});
  return edges;
}
const api={validateScene,intersects,contextEdges,messageEdges};
if (typeof module!=="undefined" && module.exports) module.exports=api;
else root.GraphObservations=api;
})(typeof globalThis!=="undefined"?globalThis:this);
