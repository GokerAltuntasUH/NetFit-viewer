"use strict";
const assert=require("node:assert/strict"),C=require("../actions-core.js");
const near=(a,b)=>assert(Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const scene={format:"graph-workshop-scenario",schema_version:1,site:{min_x:-5,max_x:5,min_y:-5,max_y:5},
  nodes:[{id:10,x:-3,y:0,type:"road"},{id:20,x:3,y:0,type:"road"},{id:100,x:-1,y:-1,type:"building"},{id:101,x:1,y:-1,type:"building"},{id:102,x:1,y:1,type:"building"},{id:103,x:-1,y:1,type:"building"}],
  roads:[{id:1,source:10,target:20}],buildings:[{id:1,corners:[100,101,102,103]}]};
let s=new C.Session(scene);
near(s.current.intersectionLength,2);near(s.current.intersectionPenaltyLength,4);near(s.current.score,-1.6);
assert.equal(s.current.intersections.length,1);
assert.deepEqual(s.current.intersections[0].start,{x:-1,y:0});assert.deepEqual(s.current.intersections[0].end,{x:1,y:0});
const original=JSON.stringify(scene),initial=s.current.score;
s.move(10,"up");assert.equal(s.scene.nodes[0].y,1);assert.equal(JSON.stringify(scene),original);
s.undo();assert.equal(s.scene.nodes[0].y,0);near(s.current.score,initial);assert.equal(s.history.length,0);
s.move(20,"right");s.move(20,"right");s.move(20,"right");near(s.current.offsiteLength,1);near(s.current.offsitePenaltyLength,2);
assert.equal(s.current.offsiteSegments.length,1);s.reset();near(s.current.score,initial);assert.equal(s.history.length,0);
assert.throws(()=>s.move(100,"up"));assert.throws(()=>s.move(10,"invalid"));
const tangent=structuredClone(scene);tangent.nodes[0].x=-2;tangent.nodes[0].y=0;tangent.nodes[1].x=0;tangent.nodes[1].y=2;
s=new C.Session(tangent);near(s.current.intersectionLength,0);near(s.current.intersectionPenaltyLength,.0002);near(s.current.score,-.00008);
const inside=structuredClone(scene);inside.nodes[0].x=0;inside.nodes[1].x=.5;
s=new C.Session(inside);near(s.current.intersectionLength,.5);near(s.current.intersectionPenaltyLength,1.0002);
const collapsed=structuredClone(inside);collapsed.nodes[1].x=0;
s=new C.Session(collapsed);near(s.current.intersectionPenaltyLength,.0004);
assert.equal(C.clipSegment({x:-2,y:3},{x:2,y:3},{min_x:-1,min_y:-1,max_x:1,max_y:1}),null);
const reference=require("./scoring-reference.json");let comparisons=0;
for(const fixture of reference.cases){
  s=new C.Session(fixture.scene);near(s.current.score,fixture.initialScore);comparisons++;
  for(const step of fixture.moves){const result=s.move(step.nodeId,step.direction);near(result.afterScore,step.score);near(result.reward,step.reward);comparisons++;}
  while(s.history.length)s.undo();near(s.current.score,fixture.initialScore);
}
console.log(`PASS: ${comparisons} Python-reference scores, rewards, contact floors, self-edges, double counting, off-site lengths, unit movement, isolation, undo and reset.`);
