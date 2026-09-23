/* Fixed simulation time: a faster display must not pour the sand faster. */
export class SimulationClock {
  constructor() { this.last = null; this.accumulator = 0; }
  advance(now, paused, tick) {
    if (this.last === null) { this.last = now; return 0; }
    const delta = Math.max(0, Math.min(100, now-this.last)); this.last=now;
    if(paused){this.accumulator=0;return 0;}
    this.accumulator+=delta;
    let count=0;
    while(this.accumulator+1e-7>=1000/60 && count<6){tick();this.accumulator-=1000/60;count++;}
    return count;
  }
}
