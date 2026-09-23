"""Author an editable SandScape sculpture in Blender and export web GLBs.
blender --background --factory-startup --python scripts/build_sculpture.py
"""
import bpy
import math
import json
import hashlib
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'www' / 'assets'
SOURCE = ROOT / 'art'
OUT.mkdir(exist_ok=True)
SOURCE.mkdir(exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, color, metal=0, rough=.35):
    m=bpy.data.materials.new(name); m.use_nodes=True
    n=m.node_tree.nodes.get('Principled BSDF')
    n.inputs['Base Color'].default_value=(*color,1)
    n.inputs['Metallic'].default_value=metal
    n.inputs['Roughness'].default_value=rough
    return m

brass=material('Brushed champagne bronze',(.42,.28,.12),1,.29)
edge=material('Polished gold reveal',(.64,.46,.23),1,.18)
dark=material('Dark anodized inner channel',(.024,.03,.027),1,.33)
stone=material('Ivory travertine',(.55,.50,.39),0,.7)
image=bpy.data.images.new('Authored travertine',width=256,height=256)
pixels=[]
for y in range(256):
    for x in range(256):
        vein=math.sin(y*.22+2*math.sin(x*.018)+.7*math.sin(x*.09))
        speck=((x*73856093 ^ y*19349663)&255)/255
        f=.83+.065*vein+.08*speck
        pixels.extend((f*.83,f*.79,f*.68,1))
image.pixels=pixels; image.pack()
tex=stone.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
stone.node_tree.links.new(tex.outputs['Color'],stone.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])

def box(name, loc, scale, mat, bevel=.04):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    obj=bpy.context.object;obj.name='GEO-'+name;obj.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.data.materials.append(mat)
    m=obj.modifiers.new('Soft machined edges','BEVEL');m.width=bevel;m.segments=5
    obj.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
    return obj

def ring(name, profile, mat, square=False):
    vertices=[];faces=[];segments=192
    for radius, depth in profile:
        for i in range(segments):
            a=i*2*math.pi/segments
            if square:
                # Intersect a radial ray with a rounded-square signed distance field.
                cx=math.cos(a);cz=math.sin(a);corner=radius*.28
                lo,hi=0,radius*1.5
                for _ in range(24):
                    t=(lo+hi)/2
                    qx=max(abs(cx*t)-(radius-corner),0)
                    qz=max(abs(cz*t)-(radius-corner),0)
                    if math.hypot(qx,qz)>corner:hi=t
                    else:lo=t
                x,z=cx*lo,cz*lo
            else: x,z=math.cos(a)*radius,math.sin(a)*radius
            vertices.append((x,depth,z+1.49))
    for j in range(len(profile)):
        k=(j+1)%len(profile)
        for i in range(segments):
            n=(i+1)%segments
            faces.append((j*segments+i,j*segments+n,k*segments+n,k*segments+i))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
    obj=bpy.data.objects.new('GEO-'+name,mesh);bpy.context.collection.objects.link(obj)
    mesh.materials.append(mat)
    for face in mesh.polygons: face.use_smooth=True
    return obj

exports=[]
for shape in ('circle','square'):
    col=bpy.data.collections.new('SandScape-'+shape);bpy.context.scene.collection.children.link(col)
    before=set(bpy.data.objects)
    square=shape=='square'
    profile=[(1.015,-.125),(1.025,-.153),(1.066,-.161),(1.075,-.157),
             (1.08,-.145),(1.112,-.14),(1.13,-.11),(1.137,-.075),
             (1.137,.08),(1.122,.12),(1.06,.13),(1.02,.105)]
    ring(shape+'-bronze-body',profile,brass,square)
    ring(shape+'-outer-highlight',[(1.119,-.13),(1.127,-.115),(1.13,-.108),(1.121,-.117)],edge,square)
    ring(shape+'-glass-bezel',[(1.012,-.14),(1.021,-.156),(1.03,-.156),(1.027,-.138)],edge,square)
    ring(shape+'-rear-gasket',[(1.01,.09),(1.035,.09),(1.035,.12),(1.01,.12)],dark,square)
    box(shape+'-stone-plinth',(0,0,.11),(1.95,.78,.22),stone,.075)
    box(shape+'-bronze-foot',(0,0,.245),(1.51,.53,.065),brass,.025)
    for x in (-.65,.65):
        box(shape+'-support', (x,.025,.33),(.105,.30,.23),dark,.025)
    # An inset brass signature plaque, real geometry.
    box(shape+'-signature-plaque',(0,-.396,.108),(.45,.012,.065),brass,.009)
    text=bpy.data.curves.new('SandScape signature','FONT');text.body='S A N D S C A P E';text.align_x='CENTER';text.size=.027;text.extrude=.0004
    label=bpy.data.objects.new('GEO-'+shape+'-signature',text);bpy.context.collection.objects.link(label)
    label.location=(0,-.405,.098);label.rotation_euler=(math.pi/2,0,0);text.materials.append(dark)
    objs=set(bpy.data.objects)-before
    for obj in objs:
        for old in list(obj.users_collection):old.objects.unlink(obj)
        col.objects.link(obj)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objs:obj.select_set(True)
    path=OUT/f'sculpture-{shape}.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_animations=False)
    exports.append({'file':path.name,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'objects':len(objs)})
    if square:col.hide_render=True;col.hide_viewport=True

# Source includes a lit camera view. Runtime adds live grains and optical glass.
bpy.ops.mesh.primitive_plane_add(size=200)
floor=bpy.context.object;floor.name='GEO-Studio-floor';floor.data.materials.append(material('Studio sage',(.10,.12,.10),0,.7))
def aim(obj,target):obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
for name,loc,energy,size,color in [('Key',(-3,-4,6),650,4,(1,.88,.67)),('Fill',(3,-2,3),400,3,(.7,.84,1)),('Rim',(1,3,4),900,3,(1,.86,.62))]:
    light=bpy.data.lights.new(name,'AREA');light.energy=energy;light.shape='DISK';light.size=size;light.color=color
    obj=bpy.data.objects.new(name,light);bpy.context.collection.objects.link(obj);obj.location=loc;aim(obj,(0,0,1.4))
cam=bpy.data.cameras.new('Hero camera');obj=bpy.data.objects.new('Hero camera',cam);bpy.context.collection.objects.link(obj)
obj.location=(2.3,-6,2.6);aim(obj,(0,0,1.3));cam.lens=55;bpy.context.scene.camera=obj
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1000;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'sandscape-sculpture.blend'))
(SOURCE/'asset-receipt.json').write_text(json.dumps({'tool':bpy.app.version_string,'author':'Original procedural model authored for SandScape','license':'MIT (project license)','front':'Blender -Y, glTF +Z','units':'meters; sculpture height 2.627','exports':exports},indent=2))
print('SANDSCAPE_ASSETS '+json.dumps(exports))
