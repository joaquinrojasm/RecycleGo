import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const problems=[];
async function scan(directory){
  for(const item of await readdir(directory,{withFileTypes:true})){
    const path=join(directory,item.name);
    if(item.isDirectory())await scan(path);
    else {
      const source=await readFile(path,'utf8');
      for(const [label,pattern] of [
        ['Clave privada',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
        ['Token privado de GitHub',/\b(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
        ['Ejecución dinámica de código',/\beval\s*\(|new\s+Function\s*\(/],
        ['Inserción HTML insegura',/\.innerHTML\s*=/]
      ])if(pattern.test(source))problems.push(`${label}: ${path}`);
      if(path.endsWith('.html')&&!source.includes("object-src 'none'"))problems.push(`Falta CSP: ${path}`);
    }
  }
}
await scan(join(root,'public'));
const rules=await readFile(join(root,'firestore.rules'),'utf8');
if(/allow\s+(?:read\s*,\s*write|write)\s*:\s*if\s+true/.test(rules))problems.push('Las reglas permiten escritura pública.');
if(problems.length){console.error(problems.join('\n'));process.exit(1);}
console.log('SEGURIDAD OK: sin claves privadas ni tokens de GitHub en el frontend; sin eval/innerHTML; CSP presente y sin escritura pública global.');
console.log('La configuración web de Firebase es pública. El análisis no reemplaza las pruebas de las reglas en Firebase.');
