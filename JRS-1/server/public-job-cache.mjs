// Cache only public catalogue data; authorization and application writes stay live.
export function publicJobCache({ttlMs=5000,now=Date.now}={}) {
 let cached=null,pending=null,generation=0;
 return {
  clear(){generation++;cached=null;pending=null;},
  async read(load){
   if(cached&&now()<cached.expires)return structuredClone(cached.value);
   let entry=pending;
   if(!entry){
    const version=generation;
    entry={task:Promise.resolve().then(load).then(value=>{
     if(version===generation)cached={value:structuredClone(value),expires:now()+ttlMs};
     return value;
    })};
    pending=entry;
   }
   try{return structuredClone(await entry.task);}
   finally{if(pending===entry)pending=null;}
  }
 };
}
