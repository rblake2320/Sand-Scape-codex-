import argparse,json,time,urllib.request,urllib.error
from pathlib import Path
parser=argparse.ArgumentParser()
parser.add_argument('--url',default='http://127.0.0.1:4187')
parser.add_argument('--output',required=True)
args=parser.parse_args()
cases=[('A warm orange desert sunset, slow and peaceful','sunset','slow'),('Blue ocean water with gentle slow waves','ocean','slow'),('An energetic fast tropical turquoise lagoon','turquoise','fast'),('White snow and silver ice at normal speed','arctic','normal'),('Dark red volcano lava and ash flowing fast','volcanic','fast'),('A quiet blue sea, moving very slowly','ocean','slow'),('A warm orange canyon with rapid flowing sand','sunset','fast'),('A green forest with calm gentle motion','turquoise','slow'),('Monochrome white snow, peaceful and slow','arctic','slow'),('Deep blue ocean, normal speed','ocean','normal')]
results=[]
for prompt,palette,flow in cases:
 req=urllib.request.Request(args.url+'/api/suggest',data=json.dumps({'prompt':prompt}).encode(),headers={'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=60) as response: data=json.load(response)
 results.append({'prompt':prompt,'expected':{'palette':palette,'flow':flow},'actual':data,'passed':data['choices']=={'palette':palette,'flow':flow}})
 print(json.dumps(results[-1]),flush=True)
Path(args.output).write_text(json.dumps({'label_source':'Agent-authored descriptive acceptance cases; not human calibration or held-out benchmark','results':results},indent=2))
