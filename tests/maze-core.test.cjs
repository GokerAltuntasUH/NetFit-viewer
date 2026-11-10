"use strict";
const assert=require("node:assert/strict"),M=require("../maze-core.js"),reference=require("./maze-reference.json");
const close=(a,b)=>assert(Math.abs(a-b)<1e-12,`${a} != ${b}`);
for(const run of reference.runs) {
  const {seed,initialQ,stepReward,goalReward,wallReward}=run;
  const session=new M.Session({seed,initialQ,stepReward,goalReward,wallReward}),lengths=[],returns=[],first=[];
  for(let episode=0;episode<run.episodes;episode++) {
    while(!session.finished) {const move=session.agentStep();if(first.length<40)first.push(move.action);}
    lengths.push(session.steps);returns.push(session.totalReward);
    if(episode<run.episodes-1)session.newEpisode();
  }
  assert.deepEqual(first,run.firstActions);assert.deepEqual(lengths,run.lengths);assert.deepEqual(returns,run.returns);
  session.q.flat(2).forEach((v,i)=>close(v,run.q.flat(2)[i]));close(session.epsilon,run.epsilon);
}
let session=new M.Session({initialQ:-1});
session.step(3);close(session.q[0][0][3],-1.09);
assert.equal(session.links().keys.size,4);
session.reset();session.step(1);close(session.q[0][0][1],-1.49);assert.deepEqual(session.state,[0,0]);
session.reset();session.state=[3,4];session.step(1);close(session.q[3][4][1],0.1);
assert.equal(session.last.future,0);assert.equal(session.links().keys.size,0);assert.equal(session.agentStep(),null);
const learned=JSON.stringify(session.q);session.newEpisode();assert.equal(JSON.stringify(session.q),learned);
assert.equal(session.epsilon,0.99);assert.deepEqual(session.state,[0,0]);
session.reset();session.q[0][0]=[-3,2,-4,-5];session.step(1);assert.equal(session.links().keys.size,0);
session.reset();session.q[0][0]=[-3,2,-4,2];session.step(1);
assert.deepEqual([...session.links().keys],["0:0:3"]);assert.equal(session.links().role,"future");
session.reset();session.q[0][0]=[-60,-50,-60,-60];session.step(1);assert.equal(session.links().role,"updated");
for(const input of [{initialQ:NaN},{goalReward:Infinity},{seed:-1},{seed:1.5},{seed:4294967296}])assert.throws(()=>new M.Session(input));
const left=new M.Session(),right=new M.Session();left.step(3);assert.equal(right.q[0][0][3],0);
const once=right.agentStep();right.reset();assert.deepEqual(right.agentStep(),once);
// Adjustable alpha/gamma must affect the update, including endpoints.
session=new M.Session({initialQ:-1,alpha:0.5,gamma:0.25});session.step(3);close(session.q[0][0][3],-1.125);
assert.equal(session.last.alpha,0.5);assert.equal(session.last.gamma,0.25);
session=new M.Session({initialQ:-1,alpha:0});session.step(3);assert.equal(session.q[0][0][3],-1);
session=new M.Session({initialQ:-1,alpha:1});session.step(3);close(session.q[0][0][3],-1.9);
session=new M.Session({initialQ:-2,alpha:0.5,gamma:0});session.step(3);close(session.q[0][0][3],-1.5);
session=new M.Session({initialQ:-2,alpha:0.5,gamma:1});session.step(3);close(session.q[0][0][3],-2.5);
for(const alpha of [-0.1,1.1])assert.throws(()=>new M.Session({alpha}),/Learning rate/);
for(const gamma of [-0.1,1.1])assert.throws(()=>new M.Session({gamma}),/Discount factor/);
console.log("PASS: 560 episodes match NumPy (actions, episode lengths, returns, Q), decimals, terminal values, color sources, reset, isolation and validation.");
console.log("PASS: adjustable alpha/gamma, endpoint behavior, recorded coefficients and range validation.");
