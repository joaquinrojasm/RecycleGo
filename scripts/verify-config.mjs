import { firebaseConfig } from '../public/js/config.js';
const missing=['apiKey','authDomain','projectId','appId'].filter(k=>!firebaseConfig[k]||firebaseConfig[k].includes('REEMPLAZAR'));
if(missing.length){console.error(`Completa public/js/config.js antes de desplegar: ${missing.join(', ')}`);process.exit(1);}
console.log(`Configuración web completa para el proyecto ${firebaseConfig.projectId}.`);
