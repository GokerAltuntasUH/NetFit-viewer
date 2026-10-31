"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const G = require("../graph.js");
const scene = {
  format:"graph-workshop-scenario",schema_version:1,
  site:{min_x:-5,max_x:5,min_y:-5,max_y:5},
  nodes:[{id:10,x:-3,y:0,type:"road"},{id:20,x:3,y:0,type:"road"},
    {id:30,x:3,y:0.5,type:"road"},{id:100,x:-1,y:-1,type:"building"},
    {id:101,x:1,y:-1,type:"building"},{id:102,x:1,y:1,type:"building"},{id:103,x:-1,y:1,type:"building"}],
  roads:[{id:1,source:10,target:20}],buildings:[{id:7,corners:[100,101,102,103]}]
};
assert.equal(G.validateScene(scene),scene);
const single=G.contextEdges(scene);
assert.equal(single.conflicts,1);assert.equal(single.edges.length,8);
assert(single.edges.every(e=>e.source>=100 && [10,20].includes(e.target)));
const doubled=structuredClone(scene);doubled.roads.push({id:2,source:10,target:30});
assert.equal(G.contextEdges(doubled).conflicts,2);
assert.equal(G.contextEdges(doubled).edges.length,12); // Shared endpoint links deduplicated.
const clear=structuredClone(scene);clear.nodes[0].y=4;clear.nodes[1].y=4;
assert.equal(G.contextEdges(clear).edges.length,0);
const baseline=G.messageEdges(scene,single.edges,{bidirectional:true,context:false,self:true});
assert.equal(baseline.length,9);assert.equal(baseline.filter(e=>e.target===10).length,2);
assert.equal(baseline.filter(e=>e.target===100).length,1);
const augmented=G.messageEdges(scene,single.edges,{bidirectional:true,context:true,self:false});
assert.equal(augmented.filter(e=>e.target===10).length,5);
assert.equal(augmented.filter(e=>e.target===100).length,0); // Context links are never reversed.
const directed=G.messageEdges(scene,[],{bidirectional:false,context:false,self:false});
assert.equal(directed.filter(e=>e.target===10).length,0);assert.equal(directed.filter(e=>e.target===20).length,1);
for(const [a,b,want] of [
  [{x:-2,y:0},{x:2,y:0},true], [{x:-2,y:1},{x:2,y:1},true],
  [{x:0,y:-2},{x:0,y:2},true], [{x:2,y:-2},{x:2,y:2},false],
  [{x:-2,y:2},{x:2,y:2},false], [{x:0,y:0},{x:0,y:0},true],
  [{x:2,y:2},{x:2,y:2},false]
]) assert.equal(G.intersects(a,b,{x:-1,y:-1},{x:1,y:1}),want);
for(const modify of [
  s=>{s.format="unsupported-scene-format";},s=>{s.schema_version=2;},
  s=>{s.nodes[0].x=Infinity;},s=>{s.nodes.push({...s.nodes[0]});},
  s=>{s.roads[0].target=999;},s=>{s.roads.push({id:2,source:20,target:10});},
  s=>{s.buildings[0].corners.reverse();},s=>{s.site.min_x=s.site.max_x;}
]) {const bad=structuredClone(scene);modify(bad);assert.throws(()=>G.validateScene(bad));}
assert.throws(()=>G.validateScene({format:"graph-workshop-collection"}));
const scope={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../example.js"),"utf8"),scope);
const example=JSON.parse(JSON.stringify(scope.window.exampleScenario));
G.validateScene(example);assert(G.contextEdges(example).edges.length>0);
for(const name of ["app.js","graph.js","example.js"]) new vm.Script(fs.readFileSync(path.join(__dirname,"..",name),"utf8"));
console.log("PASS: geometry, contact cases, context direction/deduplication, road direction, self-messages, clean layouts, invalid data, sample and script syntax.");

