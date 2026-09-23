/* Rebuild checked-in browser modules from the pinned npm package. */
import {copyFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const files={'build/three.module.js':'three.module.js','build/three.core.js':'three.core.js',
  'examples/jsm/loaders/GLTFLoader.js':'loaders/GLTFLoader.js',
  'examples/jsm/utils/BufferGeometryUtils.js':'utils/BufferGeometryUtils.js',
  'examples/jsm/utils/SkeletonUtils.js':'utils/SkeletonUtils.js','LICENSE':'LICENSE'};
for(const [source,target]of Object.entries(files)){
  const dest=path.join(root,'www/vendor/three',target);mkdirSync(path.dirname(dest),{recursive:true});
  copyFileSync(path.join(root,'node_modules/three',source),dest);
}
console.log('Vendored pinned Three.js modules and MIT license.');
