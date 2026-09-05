/* eslint-disable @next/next/no-img-element */
import React, {useSyncExternalStore} from 'react';
const listeners=new Set();
export const organisationId='10000000-0000-4000-8000-000000000001';
export const profile={id:'20000000-0000-4000-8000-000000000001',full_name:'Alex Taylor',email:'alex@example.test'};
export const membership={id:'member',organisation_id:organisationId,user_id:profile.id,role:'admin',is_active:true,profile,organisation:{id:organisationId,name:'Valeron · Demo yard',slug:'demo-yard'}};
const photo='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="800" height="600" fill="#e7e5e2"/><ellipse cx="400" cy="430" rx="220" ry="40" fill="#bbb8b2"/><rect x="220" y="200" width="360" height="190" rx="30" fill="#555d65"/><circle cx="290" cy="295" r="90" fill="#89929b"/><circle cx="290" cy="295" r="50" fill="#30363c"/><path d="M520 220v-80h80v180h-80" fill="#a1a7aa"/><text x="400" y="540" font-family="sans-serif" font-size="24" text-anchor="middle" fill="#555">SYNTHETIC PART IMAGE</text></svg>');
export const items=Array.from({length:112},(_,i)=>({id:`30000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,organisation_id:organisationId,material_number:`MAT-${String(i+1).padStart(3,'0')}`,material_description:i===0?'Hydraulic pump assembly':`Bearing assembly ${String(i+1).padStart(3,'0')}`,wo_number:'45012345',location:i%2?'South yard':'North yard',quantity:12,condition:'Good',notes:'Original handling instructions',is_archived:false,created_at:'2026-09-06T01:00:00Z',updated_at:'2026-09-06T01:00:00Z',created_by:profile.id,creator:profile,creator_name:profile.full_name,available_quantity:12,status:'available',latest_note:'Inspection completed. Keep under cover and check the seals before fitting.',latest_note_at:'2026-09-06T03:00:00Z',item_photos:[{id:'photo',item_id:'',storage_path:'',display_order:0,is_primary:true,signed_url:photo}],item_movements:[],item_stock_additions:[],item_notes:[{id:'note',note_text:'Inspection completed. Keep under cover and check the seals before fitting.',created_at:'2026-09-06T03:00:00Z',is_legacy:false,author:profile}]}));
const clone=x=>JSON.parse(JSON.stringify(x));
export function navigate(url,replace=false){history[replace?'replaceState':'pushState'](null,'',url);}
const push=history.pushState.bind(history),replace=history.replaceState.bind(history);
history.pushState=(...args)=>{push(...args);listeners.forEach(f=>f());};history.replaceState=(...args)=>{replace(...args);listeners.forEach(f=>f());};
window.addEventListener('popstate',()=>listeners.forEach(f=>f()));
function useUrl(){return useSyncExternalStore(f=>{listeners.add(f);return()=>listeners.delete(f);},()=>location.pathname+location.search);}
export function useSearchParams(){return new URLSearchParams(useUrl().split('?')[1]||'');}
export function usePathname(){return useUrl().split('?')[0];}
export function useRouter(){return {push:url=>navigate(url),replace:url=>navigate(url,true),refresh:()=>{},back:()=>history.back()};}
export function Link({href,children,...props}){return <a href={href} {...props} onClick={e=>{if(!e.ctrlKey&&!e.metaKey){e.preventDefault();navigate(href);}}}>{children}</a>;}
export function Image({src,alt,fill,unoptimized:unused,sizes,style,...props}){void unused;return <img src={src} alt={alt} sizes={sizes} style={{...(fill?{position:'absolute',height:'100%',width:'100%',inset:0}:{}),...style}} {...props}/>;}
export const requireSession=async()=>({membership});
export const signPhotos=async records=>records;
export const signOut=async()=>{};
export async function loadPart(id){return {item:clone(items.find(i=>i.id===id)||null)};}
export async function loadRegister(query){const p=new URLSearchParams(query);let filtered=items.filter(i=>!i.is_archived);const q=p.get('q')?.toLowerCase();if(q)filtered=filtered.filter(i=>`${i.material_number} ${i.material_description} ${i.latest_note}`.toLowerCase().includes(q));if(p.get('location'))filtered=filtered.filter(i=>i.location===p.get('location'));if(p.get('material'))filtered=filtered.filter(i=>i.material_number.includes(p.get('material')));if(p.get('condition'))filtered=filtered.filter(i=>i.condition===p.get('condition'));const page=Number(p.get('page')||1);return {items:clone(filtered.slice((page-1)*50,page*50)),total:filtered.length};}
export async function findDuplicates(material,description){return {items:material||description?[{...clone(items[0]),reason:'Same material number',similarity_label:'Very close description'}]:[]};}
export async function updateItem(id,prev,fd){void prev;const i=items.find(i=>i.id===id);Object.assign(i,Object.fromEntries(fd));i.quantity=Number(fd.get('quantity'));i.available_quantity=i.quantity;return {ok:true};}
export async function addNote(id,prev,fd){void prev;const i=items.find(i=>i.id===id);i.item_notes.unshift({id:crypto.randomUUID(),note_text:fd.get('note'),created_at:new Date().toISOString(),is_legacy:false,author:profile});i.latest_note=fd.get('note');return {ok:true};}
export async function removeStock(id,prev,fd){void prev;items.find(i=>i.id===id).item_movements.push({id:crypto.randomUUID(),quantity_removed:Number(fd.get('quantity')),movement_type:'quantity_removal',status:'active',removed_at:new Date().toISOString(),remover:profile,note:fd.get('note')});return {ok:true};}
export async function reverseMovementInline(){return {ok:true};}
export async function archiveItemInline(){return {ok:true};}
export async function addStock(id,quantity){const i=items.find(i=>i.id===id);i.quantity+=quantity;i.available_quantity+=quantity;window.lastStockAddition={id,quantity};return {ok:true};}
export function createClient(){return {from:table=>{const result={data:table==='items'?clone(items):[]};const chain={select:()=>chain,eq:()=>chain,order:()=>chain,then:resolve=>resolve(result)};return chain;},rpc:async(name,args)=>{if(name==='create_item'){window.lastCreated=args;return {error:null};}return {data:{items:clone(items),total:items.length}};},storage:{from:()=>({upload:async()=>({error:null}),remove:async()=>({error:null})})}};}
export const options={locations:['North yard','South yard'],creators:[{id:profile.id,name:profile.full_name}]};
