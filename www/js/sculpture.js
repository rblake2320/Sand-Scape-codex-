/* Blender GLB + live granular geometry. DOM ownership remains in app.js. */
import * as THREE from '../vendor/three/three.module.js';
import { GLTFLoader } from '../vendor/three/loaders/GLTFLoader.js';

export class Sculpture {
  constructor(canvas, size, context) {
    this.size = size;
    this.canvas = canvas;
    this.shape = 'circle';
    this.azimuth = .26;
    this.targetAzimuth = .26;
    this.elevation = .12;
    this.time = 0;
    this.ready = false;
    this.models = {};
    this.renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, alpha: false, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#172019');
    this.scene.fog = new THREE.Fog('#172019', 8, 20);
    this.camera = new THREE.PerspectiveCamera(35, 1, .1, 40);
    this.group = new THREE.Group(); this.scene.add(this.group);
    this.rotor = new THREE.Group(); this.rotor.position.y=1.49;this.group.add(this.rotor);
    this.flipAngle=0;
    this.raycaster=new THREE.Raycaster();

    // A baked environment of oversized studio softboxes supplies metal/glass reflections.
    const env = new THREE.Scene();
    env.background = new THREE.Color('#606e61');
    const panels = [[-4, 4, 3, 3, 6, 0xffe5b8, 5], [4, 2, 1, 2, 5, 0xcde5ff, 3], [1, 5, -4, 4, 3, 0xffdab0, 7]];
    for (const [x,y,z,w,h,color,intensity] of panels) {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(w,h), new THREE.MeshBasicMaterial({color, side:THREE.DoubleSide}));
      panel.material.color.multiplyScalar(intensity); panel.position.set(x,y,z);panel.lookAt(0,1,0);env.add(panel);
    }
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environment = pmrem.fromScene(env, .025);
    this.scene.environment = this.environment.texture;
    pmrem.dispose();
    env.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
    this.scene.add(new THREE.HemisphereLight(0xffedcf, 0x24392a, 2));
    this.key = new THREE.DirectionalLight(0xffe0ad, 3.8);this.key.position.set(-3,6,4);
    this.key.castShadow=true;this.key.shadow.mapSize.set(1024,1024);this.key.shadow.normalBias=.015;
    Object.assign(this.key.shadow.camera,{left:-4,right:4,top:5,bottom:-2,near:.1,far:15});
    this.key.target.position.set(0,1.4,0);this.scene.add(this.key,this.key.target);
    const rim=new THREE.DirectionalLight(0xc4dcff,2.5);rim.position.set(3,3,-3);this.scene.add(rim);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:'#29332a',roughness:.8}));
    floor.rotation.x=-Math.PI/2;floor.position.y=-.015;floor.receiveShadow=true;this.scene.add(floor);

    const count=size*size;
    this.positions=new Float32Array(count*3);this.colors=new Float32Array(count*3);
    this.grainGeometry=new THREE.BufferGeometry();
    this.grainGeometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage));
    this.grainGeometry.setAttribute('color',new THREE.BufferAttribute(this.colors,3).setUsage(THREE.DynamicDrawUsage));
    this.grainMaterial=new THREE.ShaderMaterial({
      uniforms:{pointScale:{value:1},radius:{value:3.9/size}},
      vertexColors:true,
      vertexShader:`uniform float pointScale; uniform float radius; varying vec3 vColor;
        void main(){vColor=color;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(radius*pointScale/-p.z,1.,12.);}`,
      fragmentShader:`varying vec3 vColor;
        void main(){vec2 xy=gl_PointCoord*2.-1.;float r=dot(xy,xy);if(r>1.)discard;
        vec3 n=vec3(xy,sqrt(1.-r));float light=.68+.36*max(dot(n,normalize(vec3(-.5,.8,1.))),0.);
        vec3 c=pow(vColor,vec3(2.2))*light;float glint=pow(max(dot(n,normalize(vec3(-.4,.7,1.))),0.),32.);
        gl_FragColor=vec4(c+glint*.065,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`
    });
    this.grains=new THREE.Points(this.grainGeometry,this.grainMaterial);this.grains.frustumCulled=false;this.grains.position.y=-1.49;this.rotor.add(this.grains);
    this.bubblePositions=new Float32Array(count*3);
    this.bubbleGeometry=new THREE.BufferGeometry();this.bubbleGeometry.setAttribute('position',new THREE.BufferAttribute(this.bubblePositions,3).setUsage(THREE.DynamicDrawUsage));
    this.bubbleMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{pointScale:{value:1}},
      vertexShader:`uniform float pointScale;void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(.025*pointScale/-p.z,2.,12.);}`,
      fragmentShader:`void main(){vec2 q=gl_PointCoord*2.-1.;float d=length(q);if(d>1.)discard;float edge=smoothstep(.65,.92,d);float shine=exp(-25.*distance(q,vec2(-.3,-.5)));gl_FragColor=vec4(vec3(.8,.87,.9)+shine,edge*.55+shine*.5);}`});
    this.bubbles=new THREE.Points(this.bubbleGeometry,this.bubbleMaterial);this.bubbles.frustumCulled=false;this.bubbles.position.y=-1.49;this.rotor.add(this.bubbles);
    this.liquidMaterial=new THREE.MeshPhysicalMaterial({color:0x1c4fa0,roughness:.28,metalness:0,clearcoat:.6,clearcoatRoughness:.16,envMapIntensity:.35});
    this.glassMaterial=new THREE.MeshPhysicalMaterial({color:0xffffff,metalness:0,roughness:.06,transmission:1,thickness:.025,ior:1.46,envMapIntensity:.35,transparent:true,opacity:.32,depthWrite:false});
    this.liquid=new THREE.Mesh(new THREE.CircleGeometry(1.012,128),this.liquidMaterial);this.liquid.position.set(0,0,-.095);this.rotor.add(this.liquid);
    this.glass=new THREE.Mesh(new THREE.CircleGeometry(1.012,128),this.glassMaterial);this.glass.position.set(0,0,.133);this.rotor.add(this.glass);
    this.loader=new GLTFLoader();
  }

  async load() {
    for (const shape of ['circle','square']) {
      const gltf=await this.loader.loadAsync(`assets/sculpture-${shape}.glb`);
      gltf.scene.traverse(obj=>{if(obj.isMesh){obj.castShadow=true;obj.receiveShadow=true;}});
      this.models[shape]=gltf.scene;this.group.add(gltf.scene);gltf.scene.visible=shape===this.shape;
      const moving=new THREE.Group();moving.name=`rotating-${shape}`;this.rotor.add(moving);
      const meshes=[];gltf.scene.traverse(obj=>{if(obj.isMesh&&/body|highlight|bezel|gasket/.test(obj.name))meshes.push(obj);});
      for(const mesh of meshes){gltf.scene.updateMatrixWorld(true);moving.attach(mesh);}
      moving.visible=shape===this.shape;
      this.models[shape+'-rotating']=moving;
    }
    this.ready=true;
  }

  setPalette(palette) {
    this.liquidMaterial.color.set(palette.liquid[1]);
  }

  setFinish(finish) {
    const colors={bronze:'#bda16a',graphite:'#333b3e',silver:'#aebbbd'};
    if (!colors[finish]) return;
    Object.values(this.models).forEach(model=>model.traverse(obj=>{
      if(obj.isMesh && /bronze|gold/i.test(obj.material?.name || '')) {
        obj.material.color.set(colors[finish]);obj.material.metalness=1;
        obj.material.roughness=finish==='graphite'?.38:.26;
      }
    }));
  }

  setShape(shape) {
    if (shape===this.shape) return;
    this.shape=shape;
    Object.entries(this.models).forEach(([key,model])=>model.visible=key===shape||key===shape+'-rotating');
    let geometry;
    if(shape==='circle') geometry=new THREE.CircleGeometry(1.012,128);
    else {
      const outline=new THREE.Shape();
      // Match the engine's rounded square, radius 14% of the full width.
      const a=1.005,r=.28;
      outline.moveTo(-a+r,-a);outline.lineTo(a-r,-a);outline.quadraticCurveTo(a,-a,a,-a+r);
      outline.lineTo(a,a-r);outline.quadraticCurveTo(a,a,a-r,a);outline.lineTo(-a+r,a);
      outline.quadraticCurveTo(-a,a,-a,a-r);outline.lineTo(-a,-a+r);outline.quadraticCurveTo(-a,-a,-a+r,-a);
      geometry=new THREE.ShapeGeometry(outline,32);
    }
    this.liquid.geometry.dispose();this.glass.geometry.dispose();
    this.liquid.geometry=geometry;this.glass.geometry=geometry.clone();
  }

  resize(width,height) {
    this.renderer.setSize(width,height,false);this.camera.aspect=width/height;
    this.camera.updateProjectionMatrix();
    this.grainMaterial.uniforms.pointScale.value=height*this.renderer.getPixelRatio()/(2*Math.tan(THREE.MathUtils.degToRad(35/2)));
    this.bubbleMaterial.uniforms.pointScale.value=this.grainMaterial.uniforms.pointScale.value;
  }

  orbit(dx,dy) {
    this.targetAzimuth=Math.max(-.9,Math.min(.9,this.targetAzimuth+dx*.008));
    this.elevation=Math.max(-.03,Math.min(.45,this.elevation+dy*.004));
  }

  flip() { this.flipAngle+=Math.PI; }

  pick(nx,ny) {
    this.raycaster.setFromCamera(new THREE.Vector2(nx,ny),this.camera);
    const hit=this.raycaster.intersectObject(this.glass)[0];if(!hit)return null;
    const local=this.rotor.worldToLocal(hit.point);
    return {x:Math.round((local.x/2.04+.5)*this.size),y:Math.round((.5-local.y/2.04)*this.size)};
  }

  render(sim, pixels, paused) {
    if(!this.ready) return;
    let n=0, bubbles=0;
    const N=sim.N, scale=2.04/N;
    const px=Math.abs(sim.G.x)>Math.abs(sim.G.y)?Math.sign(sim.G.x):0;
    const py=px===0?Math.sign(sim.G.y):0;
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){
      const i=y*N+x,t=sim.mat[i];
      if(t===0){
        const above=(y-py)*N+x-px;
        if(sim.mat[above]>0&&sim.mat[above]<255&&!sim.fall[above]&&sim.permAt(x,y)<.2&&(x+y)%3===0){
          const j=bubbles*3;this.bubblePositions[j]=(x+.5-N/2)*scale;
          this.bubblePositions[j+1]=1.49+(N/2-y-.5)*scale;this.bubblePositions[j+2]=.107;bubbles++;
        }
        continue;
      }
      if(t===255)continue;
      const hash=((x*73856093)^(y*19349663))>>>0;
      const j=n*3;
      this.positions[j]=(x+.5-N/2)*scale;
      this.positions[j+1]=1.49+(N/2-y-.5)*scale;
      this.positions[j+2]=.012+(hash%1024)/1024*.083;
      const c=pixels[i];this.colors[j]=(c&255)/255;this.colors[j+1]=((c>>>8)&255)/255;this.colors[j+2]=((c>>>16)&255)/255;n++;
    }
    this.grainGeometry.setDrawRange(0,n);this.grainGeometry.attributes.position.needsUpdate=true;this.grainGeometry.attributes.color.needsUpdate=true;
    this.bubbleGeometry.setDrawRange(0,bubbles);this.bubbleGeometry.attributes.position.needsUpdate=true;
    this.azimuth+=(this.targetAzimuth-this.azimuth)*.12;
    this.flipAngle*=.88;if(Math.abs(this.flipAngle)<.001)this.flipAngle=0;
    this.rotor.rotation.z=-Math.atan2(sim.G.x,sim.G.y)+this.flipAngle;
    const distance=this.camera.aspect<.9?5.4:4.8;
    this.camera.position.set(Math.sin(this.azimuth)*distance,1.48+this.elevation*distance,Math.cos(this.azimuth)*distance);
    this.camera.lookAt(0,1.28,0);
    this.renderer.render(this.scene,this.camera);
  }

  stats() { return {ready:this.ready,points:this.grainGeometry.drawRange.count,bubbles:this.bubbleGeometry.drawRange.count,shape:this.shape,azimuth:this.azimuth,calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles}; }
  dispose() {
    this.scene.traverse(obj=>{obj.geometry?.dispose();if(Array.isArray(obj.material))obj.material.forEach(m=>m.dispose());else obj.material?.dispose();});
    this.environment.dispose();this.renderer.dispose();
  }
}
