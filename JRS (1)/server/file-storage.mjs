import fs from 'node:fs/promises';
import path from 'node:path';

const maximumBytes = 5 * 1024 * 1024;
const validKey = key => typeof key === 'string' && (/^[a-f0-9]{64}$/.test(key) || /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.[a-z0-9]{1,8}$/.test(key));
function failure(status=503) {
  const error=new Error(status===404?'Stored file is unavailable.':'File storage is unavailable. Please try again later.');
  error.status=status;error.code=status===404?'STORAGE_NOT_FOUND':'STORAGE_UNAVAILABLE';return error;
}
function assertKey(key){if(!validKey(key))throw failure(404);}
export function storageSettings(env={}) {
  const provider=env.JRS_STORAGE_PROVIDER||'local';
  if(!['local','supabase'].includes(provider))throw new Error('Select a supported JRS_STORAGE_PROVIDER.');
  if(provider==='local'){
    if(env.NODE_ENV==='production' && env.RENDER==='true')throw new Error('Render requires private persistent object storage for uploaded files.');
    return {provider};
  }
  let endpoint;try{endpoint=new URL(env.SUPABASE_URL);}catch{throw new Error('Configure the Supabase project HTTPS endpoint.');}
  if(endpoint.protocol!=='https:'||!(/^[a-z0-9]+\.supabase\.co$/).test(endpoint.hostname)||endpoint.username||endpoint.password||endpoint.port||endpoint.pathname!=='/'||endpoint.search||endpoint.hash)throw new Error('Configure the Supabase project HTTPS endpoint.');
  if(!/^sb_secret_[A-Za-z0-9_-]{10,}$/.test(env.SUPABASE_SECRET_KEY||''))throw new Error('Configure a server-only Supabase secret key.');
  if(!/^[a-z0-9][a-z0-9-]{1,62}$/.test(env.SUPABASE_BUCKET||''))throw new Error('Configure a private Supabase bucket.');
  return {provider,endpoint:endpoint.origin,secret:env.SUPABASE_SECRET_KEY,bucket:env.SUPABASE_BUCKET};
}
export function createFileStore(settings,{fetchImpl=fetch}={}) {
  const config=storageSettings(settings);
  if(config.provider==='local'){
    const directory=settings.uploadDir;
    if(!directory)throw new Error('Configure a local file storage directory.');
    return {
      kind:'local',
      async put(key,bytes,{allowExisting=false}={}){assertKey(key);if(!Buffer.isBuffer(bytes)||bytes.length>maximumBytes)throw failure();await fs.mkdir(directory,{recursive:true});try{await fs.writeFile(path.join(directory,key),bytes,{flag:'wx',mode:0o600});}catch(error){if(!(allowExisting&&error.code==='EEXIST'))throw error;}},
      async get(key){assertKey(key);try{return await fs.readFile(path.join(directory,key));}catch(error){if(error.code==='ENOENT')throw failure(404);throw error;}},
      async remove(key){assertKey(key);try{await fs.unlink(path.join(directory,key));}catch(error){if(error.code!=='ENOENT')throw error;}},
      async check(){await fs.access(directory);},
    };
  }
  const bucket=encodeURIComponent(config.bucket),base=config.endpoint+'/storage/v1';
  async function request(suffix,options={}){
    try{
      return await fetchImpl(base+suffix,{...options,headers:{apikey:config.secret,'User-Agent':'JRS-Storage/1.0',...options.headers},redirect:'error',signal:AbortSignal.timeout(10000)});
    }catch{throw failure();}
  }
  let verifiedUntil=0;
  return {
    kind:'supabase',
    async put(key,bytes,{contentType='application/octet-stream',allowExisting=false}={}){
      assertKey(key);if(!Buffer.isBuffer(bytes)||bytes.length>maximumBytes)throw failure();
      const response=await request('/object/'+bucket+'/'+key,{method:'POST',headers:{'Content-Type':contentType,'x-upsert':'false','Cache-Control':'no-store'},body:bytes});
      if(!response.ok){const details=await response.json().catch(()=>null);if(!(allowExisting&&(response.status===409||String(details?.statusCode)==='409')&&(details?.error==='Duplicate'||details?.code==='Duplicate')))throw failure();}
      else await response.arrayBuffer();
    },
    async get(key){
      assertKey(key);const response=await request('/object/authenticated/'+bucket+'/'+key);
      if(!response.ok){const details=await response.json().catch(()=>null);throw failure(response.status===404||String(details?.statusCode)==='404'||details?.error==='not_found'?404:503);}
      if(Number(response.headers.get('content-length'))>maximumBytes){await response.body?.cancel();throw failure();}
      const chunks=[];let size=0;
      if(response.body)for await(const chunk of response.body){size+=chunk.length;if(size>maximumBytes)throw failure();chunks.push(Buffer.from(chunk));}
      return Buffer.concat(chunks);
    },
    async remove(key){
      assertKey(key);const response=await request('/object/'+bucket,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:[key]})});
      if(!response.ok){await response.body?.cancel();throw failure();}await response.arrayBuffer();
    },
    async check(){
      if(Date.now()<verifiedUntil)return;
      const response=await request('/bucket/'+bucket);if(!response.ok){await response.body?.cancel();throw failure();}
      const metadata=await response.json().catch(()=>null);
      if(metadata?.id!==config.bucket||metadata.public!==false)throw failure();verifiedUntil=Date.now()+60000;
    },
  };
}

