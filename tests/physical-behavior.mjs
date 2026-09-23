import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SandEngine } from '../www/js/engine.js';
import { SimulationClock } from '../www/js/sim-clock.js';

const sample = e => {
  let upper=0,columns=0;
  for(let x=0;x<e.N;x++){
    let cross=0;
    for(let y=0;y<e.N;y++){
      const t=e.mat[y*e.N+x];if(t>0&&t<255){if(y<e.N/2)upper++;if(Math.abs(y-e.N/2)<=2)cross++;}
    }
    if(cross)columns++;
  }
  return {upper_fraction:upper/e.grainCount(),active_crossing_columns:columns,mass:e.grainCount()};
};
const e=new SandEngine({size:256,seed:42});const mass=e.grainCount();e.flipFrame();const measurements=[];
for(let step=1;step<=12000;step++){
  e.step();if([150,1500,6000,12000].includes(step))measurements.push({step,...sample(e)});
}
assert.equal(e.grainCount(),mass);
assert.ok(measurements[0].upper_fraction>.5,'Suspended sand should not dump immediately');
assert.ok(measurements[1].upper_fraction>0);
assert.ok(measurements[1].active_crossing_columns>0&&measurements[1].active_crossing_columns<125,'Flow should use distinct gaps, not sheet-wide rain');
assert.ok(measurements[3].upper_fraction<measurements[1].upper_fraction,'Sand must continue releasing, not stay permanently stuck');

const flow=[];
for(const air of [.5,2]){
  const sim=new SandEngine({size:128,seed:42});sim.setAirResistance(air);sim.flipFrame();
  for(let i=0;i<600;i++)sim.step();flow.push({air,...sample(sim)});
}
assert.ok(flow[1].upper_fraction>flow[0].upper_fraction,'More air resistance must retain more upper sand');
const shake=new SandEngine({size:128,seed:42});const before=shake.mat.slice(),seed=shake.flowSeed;
shake.redistributeAir();assert.deepEqual(shake.mat,before);assert.notEqual(shake.flowSeed,seed);
assert.throws(()=>shake.setAirResistance(NaN));assert.throws(()=>shake.setAirResistance(0));

const rates=[];
for(const fps of [30,60,144]){
  const clock=new SimulationClock();let ticks=0;
  for(let frame=0;frame<=fps*10;frame++)clock.advance(frame*1000/fps,false,()=>ticks++);
  rates.push({fps,ticks});assert.equal(ticks,600);
  clock.advance(11000,true,()=>assert.fail('Paused clock advanced'));
}
const settling=[];
for(const type of [1,5]) {
  let sum=0;
  for(let seed=1;seed<=8;seed++){
    const particle=new SandEngine({size:128,seed});
    for(let i=0;i<particle.mat.length;i++)if(particle.mat[i]!==255)particle.mat[i]=0;
    particle.mat[30*128+64]=type;particle.fall[30*128+64]=1;
    for(let i=0;i<60;i++)particle.step();
    sum+=Math.floor(particle.mat.findIndex(t=>t===type)/128)-30;
  }
  settling.push({type,average_fall_cells:sum/8});
}
assert.ok(settling[0].average_fall_cells>settling[1].average_fall_cells,'Heavy black grains must fall faster through liquid');
const report={scenario:'Liquid sand-picture behavioral acceptance',status:'Worked',measurements,air_resistance:flow,
  shake:'Redistributes release gaps without flipping or moving sand',refresh_rate:rates,density_settling:settling,
  model:'Cellular granular simulation with a persistent air-resistance field; not a fluid/air CFD solver'};
console.log(JSON.stringify(report,null,2));
if(process.argv[2]){fs.mkdirSync(path.dirname(process.argv[2]),{recursive:true});fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2));}
