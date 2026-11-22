const SUPABASE_URL='https://uxajejhmwptmcockqbav.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_yL2rRee-hAWtbf53cZSIag_WZWN4Byz';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=id=>document.getElementById(id);
let currentImages=[];
const msg=(id,text)=>$(id).textContent=text;
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function checkAdmin(){
 const {data:{user}}=await db.auth.getUser();
 if(!user){showLogin();return}
 const {data,error}=await db.from('store_admins').select('user_id').eq('user_id',user.id).maybeSingle();
 if(error||!data){await db.auth.signOut();showLogin('This account is not authorised to manage this store.');return}
 $('login-panel').classList.add('hidden');$('dashboard').classList.remove('hidden');$('logout').classList.remove('hidden');
 await Promise.all([loadProducts(),loadOrders()]);
}
function showLogin(message=''){ $('login-panel').classList.remove('hidden');$('dashboard').classList.add('hidden');$('logout').classList.add('hidden');msg('login-message',message)}
$('login-form').addEventListener('submit',async e=>{e.preventDefault();msg('login-message','Signing in…');const {error}=await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error){msg('login-message',error.message);return}await checkAdmin()});
$('logout').addEventListener('click',async()=>{await db.auth.signOut();showLogin('You have signed out.')});
$('images').addEventListener('change',()=>{const files=[...$('images').files];if(files.length>6){$('images').value='';msg('image-hint','Please select no more than 6 images.');return}if(files.some(f=>f.size>5*1024*1024)){ $('images').value='';msg('image-hint','Each image must be 5 MB or smaller.');return} $('image-preview').innerHTML=files.map(f=>`<img src="${URL.createObjectURL(f)}" alt="Preview">`).join('')});
async function uploadImages(files){const urls=[];for(const file of files){const ext=file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';const path=`${Date.now()}-${crypto.randomUUID()}.${ext}`;const {error}=await db.storage.from('ruxia-products').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});if(error)throw error;const {data}=db.storage.from('ruxia-products').getPublicUrl(path);urls.push(data.publicUrl)}return urls}
$('product-form').addEventListener('submit',async e=>{e.preventDefault();const btn=$('save-product');btn.disabled=true;msg('form-message','Saving product…');try{
 const files=[...$('images').files];if(files.length>6)throw Error('Maximum 6 images.');if(files.some(f=>f.size>5*1024*1024))throw Error('Each image must be 5 MB or smaller.');
 let imageUrls=currentImages;if(files.length)imageUrls=await uploadImages(files);if(!imageUrls.length)throw Error('Please add at least one product image.');
 const payload={name:$('name').value.trim(),category:$('category').value,caption:$('caption').value.trim(),description:$('description').value.trim(),price:$('price').value===''?null:Number($('price').value),currency:$('currency').value,quantity:Number($('quantity').value),sku:$('sku').value.trim()||null,image_urls:imageUrls,is_published:$('published').checked,updated_at:new Date().toISOString()};
 const id=$('product-id').value;let result=id?await db.from('products').update(payload).eq('id',id):await db.from('products').insert(payload);
 if(result.error)throw result.error;msg('form-message','Saved successfully.');resetForm();await loadProducts();
 }catch(err){msg('form-message','Could not save: '+err.message)}finally{btn.disabled=false}});
function resetForm(){$('product-form').reset();$('product-id').value='';$('quantity').value=1;$('published').checked=true;currentImages=[];$('image-preview').innerHTML='';$('form-title').textContent='Add a product / advertisement';msg('form-message','')}
$('reset-form').onclick=resetForm;$('cancel-edit').onclick=resetForm;
async function loadProducts(){const {data,error}=await db.from('products').select('*').order('created_at',{ascending:false});if(error){$('product-list').textContent=error.message;return}if(!data?.length){$('product-list').innerHTML='<p class="hint">No products yet. Add your first product above.</p>';return}
 $('product-list').innerHTML=data.map(p=>`<article class="product"><img src="${esc((p.image_urls||[])[0]||'')}" alt=""><div><h3>${esc(p.name)}</h3><p>${esc(p.category||'')} · ${p.price===null?'Price on request':esc(p.price+' '+p.currency)} · Stock: ${p.quantity??0}</p><p>${p.is_published?'<span class="status">Published</span>':'Draft'} · ${esc(p.caption||'')}</p></div><div class="actions row"><button class="btn light" data-edit="${p.id}">Edit</button><button class="btn danger" data-delete="${p.id}">Delete</button></div></article>`).join('');
 $('product-list').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editProduct(data.find(p=>String(p.id)===b.dataset.edit)));
 $('product-list').querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deleteProduct(b.dataset.delete));
}
function editProduct(p){if(!p)return;$('product-id').value=p.id;$('name').value=p.name||'';$('category').value=p.category||'Clothing';$('price').value=p.price??'';$('currency').value=p.currency||'AFN';$('quantity').value=p.quantity??0;$('sku').value=p.sku||'';$('caption').value=p.caption||'';$('description').value=p.description||'';$('published').checked=!!p.is_published;currentImages=p.image_urls||[];$('image-preview').innerHTML=currentImages.map(u=>`<img src="${esc(u)}" alt="Current product image">`).join('');$('form-title').textContent='Edit product / advertisement';$('images').value='';window.scrollTo({top:0,behavior:'smooth'})}
async function deleteProduct(id){if(!confirm('Delete this product? This cannot be undone.'))return;const {error}=await db.from('products').delete().eq('id',id);if(error){alert(error.message);return}await loadProducts()}
$('refresh').onclick=loadProducts;
async function loadOrders(){const {data,error}=await db.from('store_orders').select('*').order('created_at',{ascending:false}).limit(50);if(error){$('orders-list').textContent='Orders table not ready: '+error.message;return}if(!data?.length){$('orders-list').textContent='No order enquiries yet.';return}$('orders-list').innerHTML=data.map(o=>`<div class="order"><b>#${o.id} · ${esc(o.customer_name)}</b><p>${esc(o.customer_phone)} · ${new Date(o.created_at).toLocaleString()}</p><p>Status: ${esc(o.status)}</p><pre style="white-space:pre-wrap;font:12px inherit">${esc(JSON.stringify(o.items,null,2))}</pre><label>Update status<select data-order="${o.id}"><option ${o.status==='new'?'selected':''}>new</option><option ${o.status==='contacted'?'selected':''}>contacted</option><option ${o.status==='confirmed'?'selected':''}>confirmed</option><option ${o.status==='completed'?'selected':''}>completed</option><option ${o.status==='cancelled'?'selected':''}>cancelled</option></select></label></div>`).join('');$('orders-list').querySelectorAll('[data-order]').forEach(s=>s.onchange=async()=>{const {error}=await db.from('store_orders').update({status:s.value}).eq('id',s.dataset.order);if(error)alert(error.message)})}
$('refresh-orders').onclick=loadOrders;
checkAdmin();
