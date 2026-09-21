import {mkdir,copyFile} from 'node:fs/promises';
await mkdir(new URL('../dist/',import.meta.url),{recursive:true});
await copyFile(new URL('../src/olive-power-flow.js',import.meta.url),new URL('../dist/olive-power-flow.js',import.meta.url));
console.log('Built dist/olive-power-flow.js');
