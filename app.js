const $=id=>document.getElementById(id);
const KEY='realvision_mobile_history';
function load(){let list=JSON.parse(localStorage.getItem(KEY)||'[]');$('historyList').innerHTML='';if(!list.length){$('historyList').textContent='Seus vídeos e pedidos aparecerão aqui.';return}list.forEach(item=>{let el=document.createElement('div');el.className='entry';el.textContent=item.prompt;let small=document.createElement('small');small.textContent=item.date+' • '+item.format+' • '+item.style;el.appendChild(small);$('historyList').appendChild(el)})}
$('generate').onclick=()=>{let prompt=$('prompt').value.trim();if(prompt.length<8){$('notice').textContent='Escreva uma descrição com pelo menos 8 caracteres.';return}let list=JSON.parse(localStorage.getItem(KEY)||'[]');list.unshift({prompt,date:new Date().toLocaleString('pt-BR'),format:$('format').value,style:$('style').value});localStorage.setItem(KEY,JSON.stringify(list.slice(0,30)));load();$('notice').textContent='Descrição salva! Para gerar o arquivo de vídeo, precisamos conectar um serviço de geração de IA com cota gratuita.'};
$('clear').onclick=()=>{if(confirm('Apagar o histórico deste aparelho?')){localStorage.removeItem(KEY);load()}};
let deferred;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;$('install').hidden=false});
$('install').onclick=async()=>{if(!deferred)return;deferred.prompt();await deferred.userChoice;deferred=null;$('install').hidden=true};
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'));
load();
