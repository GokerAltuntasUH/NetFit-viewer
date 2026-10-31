/* Unit-step movement and geometric scoring; no graph-message rendering. */
(function (root) {
  "use strict";
  const DIRECTIONS = Object.freeze({right:[1,0],left:[-1,0],up:[0,1],down:[0,-1]});
  const WEIGHTS = Object.freeze({intersection:0.4,offsite:0.6});
  const distance = (a,b) => Math.sqrt((b.x-a.x)**2+(b.y-a.y)**2);
  // Same Liang-Barsky equations/order as the source scoring implementation.
  function clipSegment(a,b,box) {
    const dx=b.x-a.x,dy=b.y-a.y;
    const ps=[-dy,dx,dy,-dx];
    const qs=[a.y-box.min_y,box.max_x-a.x,box.max_y-a.y,a.x-box.min_x];
    let enter=0,exit=1;
    for(let i=0;i<4;i++) {
      if(ps[i]===0) { if(qs[i]<0) return null; else continue; }
      if(ps[i]<0) enter=Math.max(enter,qs[i]/ps[i]);
      else exit=Math.min(exit,qs[i]/ps[i]);
    }
    if(enter>exit) return null;
    const start={x:a.x+enter*dx,y:a.y+enter*dy};
    const end={x:a.x+exit*dx,y:a.y+exit*dy};
    return {start,end,length:distance(start,end),enter,exit};
  }
  function normalizeScene(input) {
    const scene=JSON.parse(JSON.stringify(input));
    for(const n of scene.nodes) { n.x=Math.fround(n.x);n.y=Math.fround(n.y); }
    return scene;
  }
  function scoreScene(scene) {
    const nodes=new Map(scene.nodes.map(n=>[n.id,n]));
    const buildings=scene.buildings.map(b=>{
      const lower=nodes.get(b.corners[0]),upper=nodes.get(b.corners[2]);
      return {id:b.id,min_x:lower.x,min_y:lower.y,max_x:upper.x,max_y:upper.y};
    });
    const intersections=[],offsiteSegments=[];
    let intersectionLength=0,offsiteLength=0;
    // Physical lengths count each undirected road once for the visual explanation.
    for(const r of scene.roads) {
      const a=nodes.get(r.source),b=nodes.get(r.target);
      for(const box of buildings) {
        const hit=clipSegment(a,b,box);
        if(hit) {intersectionLength+=hit.length;intersections.push({...hit,roadId:r.id,buildingId:box.id});}
      }
      const inside=clipSegment(a,b,scene.site);
      offsiteLength+=distance(a,b)-(inside?inside.length:0);
      const segments=inside ? [[a,inside.start],[inside.end,b]] : [[a,b]];
      for(const [start,end] of segments) if(distance(start,end)>0)
        offsiteSegments.push({start:{x:start.x,y:start.y},end:{x:end.x,y:end.y},roadId:r.id});
    }
    // Reconstruct the exact road-edge order: first-use self loops, then A->B and B->A.
    // Boundary/tangent and zero-length contacts contribute max(length, 1e-4).
    const used=new Set(),edges=[];
    for(const r of scene.roads) {
      for(const id of [r.source,r.target]) if(!used.has(id)) {used.add(id);edges.push([id,id]);}
      edges.push([r.source,r.target],[r.target,r.source]);
    }
    let intersectionPenaltyLength=0,offsitePenaltyLength=0;
    for(const [source,target] of edges) {
      const a=nodes.get(source),b=nodes.get(target);
      for(const box of buildings) {
        const hit=clipSegment(a,b,box);
        if(hit) intersectionPenaltyLength+=Math.max(hit.length,1e-4);
      }
      const inside=clipSegment(a,b,scene.site);
      offsitePenaltyLength+=distance(a,b)-(inside?inside.length:0);
    }
    const score=-(offsitePenaltyLength*WEIGHTS.offsite+intersectionPenaltyLength*WEIGHTS.intersection);
    return {score,intersectionLength,offsiteLength,intersectionPenaltyLength,offsitePenaltyLength,intersections,offsiteSegments};
  }
  class Session {
    constructor(scene) {
      this.initial=normalizeScene(scene);
      this.scene=normalizeScene(scene);
      this.history=[];
      this.current=scoreScene(this.scene);
      this.initialScore=this.current.score;
    }
    move(id,direction) {
      if(!Object.hasOwn(DIRECTIONS,direction)) throw new Error("Choose up, down, left, or right.");
      const node=this.scene.nodes.find(n=>n.id===id);
      if(!node || node.type!=="road") throw new Error("Select a road node to move.");
      const [dx,dy]=DIRECTIONS[direction],from={x:node.x,y:node.y};
      const next={x:Math.fround(node.x+dx),y:Math.fround(node.y+dy)};
      if(next.x===from.x && next.y===from.y) throw new Error("This coordinate is too large to represent a unit movement. Load a smaller-scale scenario.");
      const beforeScore=this.current.score;
      node.x=next.x;node.y=next.y;
      this.current=scoreScene(this.scene);
      const action={nodeId:id,direction,from,to:next,beforeScore,afterScore:this.current.score,reward:this.current.score-beforeScore};
      this.history.push(action);
      return action;
    }
    undo() {
      const action=this.history.pop();
      if(!action) return null;
      const node=this.scene.nodes.find(n=>n.id===action.nodeId);
      node.x=action.from.x;node.y=action.from.y;
      this.current=scoreScene(this.scene);
      return action;
    }
    reset() {
      this.scene=normalizeScene(this.initial);this.history=[];this.current=scoreScene(this.scene);
    }
  }
  const api={DIRECTIONS,WEIGHTS,clipSegment,normalizeScene,scoreScene,Session};
  if(typeof module!=="undefined" && module.exports) module.exports=api;
  else root.MovementScoring=api;
})(typeof globalThis!=="undefined"?globalThis:this);
