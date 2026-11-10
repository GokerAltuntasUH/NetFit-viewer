/* Tabular Q-learning, isolated from the road-graph viewers. */
(function (root) {
  "use strict";
  const MAZE = [[0,0,0,1,0],[1,1,0,1,0],[0,0,0,0,0],[0,1,1,1,0],[0,0,0,1,0]];
  const ACTIONS = [[-1,0],[1,0],[0,-1],[0,1]];
  const NAMES = ["Up","Down","Left","Right"];
  const DEFAULTS = {stepReward:-1,goalReward:10,wallReward:-5,initialQ:0,seed:42,
    alpha:0.1,gamma:0.9,epsilonStart:1,epsilonMin:0.01,epsilonDecay:0.99,maxSteps:100};

  // MT19937 and the legacy NumPy RandomState sampling rules. Local state only.
  class RandomState {
    constructor(seed) {
      this.words = new Uint32Array(624); this.words[0] = seed >>> 0; this.index = 624;
      for (let i=1;i<624;i++) {
        const previous=this.words[i-1];
        this.words[i]=(Math.imul(1812433253,previous^(previous>>>30))+i)>>>0;
      }
    }
    uint32() {
      if (this.index>=624) {
        for(let i=0;i<624;i++) {
          const y=(this.words[i]&0x80000000)|(this.words[(i+1)%624]&0x7fffffff);
          this.words[i]=(this.words[(i+397)%624]^(y>>>1)^((y&1)?0x9908b0df:0))>>>0;
        }
        this.index=0;
      }
      let y=this.words[this.index++];
      y^=y>>>11; y^=(y<<7)&0x9d2c5680; y^=(y<<15)&0xefc60000; y^=y>>>18;
      return y>>>0;
    }
    random() {return ((this.uint32()>>>5)*67108864+(this.uint32()>>>6))/9007199254740992;}
    integer(count) {
      if(count===1)return 0;
      const max=count-1;
      let mask=max; mask|=mask>>>1; mask|=mask>>>2; mask|=mask>>>4; mask|=mask>>>8; mask|=mask>>>16;
      let value; do {value=(this.uint32()&mask)>>>0;} while(value>max);
      return value;
    }
  }
  function settings(input={}) {
    const value={...DEFAULTS,...input};
    for(const key of Object.keys(DEFAULTS)) {
      if(typeof value[key]!=="number" || !Number.isFinite(value[key]))
        throw new Error("Enter finite numbers for every setting.");
    }
    if(!Number.isInteger(value.seed)||value.seed<0||value.seed>4294967295)
      throw new Error("Seed must be a whole number from 0 to 4294967295.");
    if(value.alpha<0||value.alpha>1)
      throw new Error("Learning rate (alpha) must be between 0 and 1.");
    if(value.gamma<0||value.gamma>1)
      throw new Error("Discount factor (gamma) must be between 0 and 1.");
    if(value.epsilonStart<0||value.epsilonStart>1||value.epsilonMin<0||
       value.epsilonMin>value.epsilonStart||value.epsilonDecay<0||value.epsilonDecay>1 ||
       !Number.isInteger(value.maxSteps)||value.maxSteps<1)
      throw new Error("Invalid learning settings.");
    return value;
  }
  class Session {
    constructor(input={}) {this.config=settings(input); this.reset();}
    reset() {
      this.maze=MAZE.map(row=>row.slice());
      this.q=MAZE.map(row=>row.map(()=>Array(4).fill(this.config.initialQ)));
      this.visits=MAZE.map(row=>row.map(()=>Array(4).fill(0)));
      this.rng=new RandomState(this.config.seed);
      this.state=[0,0]; this.episode=1; this.steps=0; this.totalReward=0;
      this.epsilon=this.config.epsilonStart; this.finished=false; this.last=null;
    }
    transition(action) {
      if(!Number.isInteger(action)||action<0||action>3)throw new Error("Choose one of four directions.");
      const [row,col]=this.state,[dr,dc]=ACTIONS[action],r=row+dr,c=col+dc;
      if(r<0||r>=5||c<0||c>=5||this.maze[r][c]===1)
        return {next:[row,col],reward:this.config.wallReward,done:false};
      return {next:[r,c],reward:r===4&&c===4?this.config.goalReward:this.config.stepReward,done:r===4&&c===4};
    }
    step(action,reason="Manual") {
      if(this.finished)return null;
      const {next,reward,done}=this.transition(action),origin=this.state.slice();
      const old=this.q[origin[0]][origin[1]][action],nextValues=this.q[next[0]][next[1]];
      const future=done?0:Math.max(...nextValues);
      const sources=done?[]:nextValues.flatMap((value,a)=>value===future?[[...next,a]]:[]);
      const {alpha,gamma}=this.config,target=reward+gamma*future,newValue=old+alpha*(target-old);
      if(!Number.isFinite(newValue)||!Number.isFinite(this.totalReward+reward))
        throw new Error("These settings produce numbers too large to calculate. Apply smaller values.");
      this.q[origin[0]][origin[1]][action]=newValue;
      this.visits[origin[0]][origin[1]][action]++;
      this.state=next; this.steps++; this.totalReward+=reward;
      this.finished=done||this.steps>=this.config.maxSteps;
      this.last={origin,action,next,reward,old,future,target,newValue,done,reason,sources,alpha,gamma};
      if(this.finished)this.decay();
      return this.last;
    }
    agentStep() {
      if(this.finished)return null;
      if(this.rng.random()<this.epsilon)return this.step(this.rng.integer(4),"Explore");
      const values=this.q[this.state[0]][this.state[1]],max=Math.max(...values);
      const best=values.flatMap((value,i)=>value===max?[i]:[]);
      return this.step(best[this.rng.integer(best.length)],"Exploit");
    }
    decay() {this.epsilon=Math.max(this.config.epsilonMin,this.epsilon*this.config.epsilonDecay);}
    newEpisode() {
      if(!this.steps)return;
      if(!this.finished)this.decay();
      this.episode++; this.steps=0; this.totalReward=0; this.state=[0,0]; this.finished=false; this.last=null;
    }
    links() {
      if(!this.last)return {keys:new Set(),role:""};
      const last=this.last,updated=[...last.origin,last.action].join(":");
      const survivors=last.sources.filter(([r,c,a])=>this.q[r][c][a]===last.future).map(p=>p.join(":"));
      const other=survivors.filter(key=>key!==updated);
      if(other.length)return {keys:new Set(other),role:"future"};
      if(survivors.includes(updated))return {keys:new Set([updated]),role:"updated"};
      return {keys:new Set(),role:""};
    }
  }
  const api={Session,RandomState,DEFAULTS:Object.freeze(DEFAULTS),NAMES:Object.freeze(NAMES)};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.MazeLearning=api;
})(typeof window!=="undefined"?window:globalThis);
