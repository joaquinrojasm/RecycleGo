import { readdir, mkdir, cp, readFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
async function check(directory) {
  for (const item of await readdir(directory, {withFileTypes:true})) {
    const path = join(directory,item.name);
    if(item.isDirectory()) await check(path);
    else if(path.endsWith('.js') || path.endsWith('.mjs')) {
      const result=spawnSync(process.execPath,['--check',path],{stdio:'inherit'});
      if(result.status!==0)throw new Error(`Error de sintaxis: ${path}`);
    } else if(path.endsWith('.html')) {
      const text=await readFile(path,'utf8');
      if(!text.includes('<!doctype html>')||!text.includes('type="module"')||!text.includes('Content-Security-Policy'))throw new Error(`HTML incompleto: ${path}`);
    }
  }
}
await check(join(root,'public'));await check(join(root,'scripts'));
await mkdir(join(root,'dist'),{recursive:true});
await cp(join(root,'public'),join(root,'dist'),{recursive:true});
console.log('BUILD OK: HTML y sintaxis JavaScript validados; archivos estáticos preparados en dist/.');
