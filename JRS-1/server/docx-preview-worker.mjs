import {parentPort,workerData} from 'node:worker_threads';
import mammoth from 'mammoth';
import yauzl from 'yauzl';
const limit=20*1024*1024,maxEntry=10*1024*1024;
async function inspectZip(bytes){
 const zip=await new Promise((resolve,reject)=>yauzl.fromBuffer(bytes,{lazyEntries:true,validateEntrySizes:true,strictFileNames:true},(error,value)=>error?reject(error):resolve(value)));
 let count=0,total=0,declared=0,hasDocument=false;
 try{await new Promise((resolve,reject)=>{
  zip.once('error',reject);zip.once('end',resolve);
  zip.on('entry',entry=>{(async()=>{
   if(++count>256||(entry.generalPurposeBitFlag&1)||entry.uncompressedSize>maxEntry||(declared+=entry.uncompressedSize)>limit)throw Error('Document exceeds preview limits.');
   if(entry.fileName==='word/document.xml')hasDocument=true;
   if(entry.fileName.endsWith('/'))return;
   const stream=await new Promise((r,j)=>zip.openReadStream(entry,(error,value)=>error?j(error):r(value)));
   let size=0;for await(const chunk of stream){size+=chunk.length;total+=chunk.length;if(size>maxEntry||total>limit){stream.destroy();throw Error('Document exceeds preview limits.');}}
  })().then(()=>zip.readEntry(),reject);});zip.readEntry();
 });if(!hasDocument)throw Error('Word document content is missing.');}finally{zip.close();}
}
try{const bytes=Buffer.from(workerData);if(bytes.length>5*1024*1024)throw Error('Document exceeds upload limits.');await inspectZip(bytes);const result=await mammoth.extractRawText({buffer:bytes});if(result.value.length>1000000)throw Error('Document text exceeds preview limits.');parentPort.postMessage({text:result.value});}
catch{parentPort.postMessage({error:'Preview unavailable'});}
