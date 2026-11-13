import {readFileSync,writeFileSync} from 'node:fs';
const envPath=new URL('../.env',import.meta.url);
const source=new URL('../.env.google-oauth.json',import.meta.url);
const json=JSON.parse(readFileSync(source,'utf8').replace(/^\uFEFF/,''));
const web=json.web;
if(!web||!web.client_id?.endsWith('.apps.googleusercontent.com')||typeof web.client_secret!=='string'||web.client_secret.length<10)throw new Error('El JSON debe corresponder a un cliente OAuth de aplicación web.');
let content=readFileSync(envPath,'utf8');
const url=content.match(/^SUPABASE_URL=(.+)$/m)?.[1].trim();
if(!url)throw new Error('Falta la URL de Supabase en backend/.env.');
const required=[url+'/auth/v1/callback',url+'/functions/v1/calendar'];
const missing=required.filter(uri=>!web.redirect_uris?.includes(uri));
if(missing.length)throw new Error('Faltan redirecciones en el cliente de Google: '+missing.join(', '));
for(const [key,value] of Object.entries({GOOGLE_OAUTH_CLIENT_ID:web.client_id,GOOGLE_OAUTH_CLIENT_SECRET:web.client_secret})){
 if(/[\r\n]/.test(value))throw new Error('Credencial con formato no válido.');
 const expression=new RegExp('^'+key+'=.*$','m');
 content=expression.test(content)?content.replace(expression,()=>key+'='+value):content.trimEnd()+'\n'+key+'='+value+'\n';
}
writeFileSync(envPath,content,{encoding:'utf8'});
console.log('Cliente OAuth web validado: ambas redirecciones correctas. Credenciales importadas sin mostrar valores.');
