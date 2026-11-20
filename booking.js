'use strict';
const branches = [{name:'Блик · Центр', masters:['Артём','Михаил']}, {name:'Блик · Север', masters:['Денис','Илья']}];
const services = [{name:'Мужская стрижка',minutes:45,price:1600},{name:'Стрижка бороды',minutes:30,price:900},{name:'Стрижка + борода',minutes:75,price:2300}];
const $ = id => document.getElementById(id);
const form = $('booking');
const dates = Array.from({length:7}, (_, i) => {const d = new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+i+1); return d;});
const dateLabel = new Intl.DateTimeFormat('ru', {weekday:'short',day:'numeric',month:'long'});
const currency = new Intl.NumberFormat('ru', {style:'currency',currency:'RUB',maximumFractionDigits:0});
const timeLabel = m => `${Math.floor(m/60)}:${String(m%60).padStart(2,'0')}`;
const options = (id, labels) => $(id).replaceChildren(...labels.map((label,i)=>new Option(label,i)));
options('branch',branches.map(b=>b.name));
options('service',services.map(s=>`${s.name} · ${s.minutes} мин`));
options('day',dates.map(d=>dateLabel.format(d)));
function updateMasters(){options('master',branches[$('branch').value].masters);}
function summary(){
 const branch=branches[$('branch').value], service=services[$('service').value];
 const chosen=form.querySelector('input[name="time"]:checked');
 const details={branch:branch.name,service:service.name,master:branch.masters[$('master').value],when:dateLabel.format(dates[$('day').value])+(chosen?` · ${chosen.value}`:''),price:currency.format(service.price)};
 for(const [key,value] of Object.entries(details)) $('s-'+key).textContent=value;
 $('submit').disabled=!chosen;
 $('availability').textContent=chosen?`Выбрано время ${chosen.value}.`:'Выберите время, чтобы продолжить.';
 return details;
}
function updateSlots(){
 const seed=Number($('day').value)+Number($('master').value)*2+Number($('branch').value)*3;
 const duration=services[$('service').value].minutes;
 const hours=[600,660,720,780,840,900,960,1020,1080];
 const busy=hours.filter((_,i)=>(i+seed)%4===1);
 const starts=hours.filter(start=>start+duration<=1140&&!busy.some(block=>start<block+60&&start+duration>block));
 $('slots').replaceChildren(...starts.map(start=>{
  const label=document.createElement('label'); label.className='slot';
  const input=document.createElement('input'); input.type='radio'; input.name='time'; input.value=timeLabel(start); input.required=true;
  const text=document.createElement('span'); text.textContent=input.value; label.append(input,text);return label;
 }));
 summary();
}
form.addEventListener('change',event=>{
 if(event.target.name==='time'){summary();return;}
 if(event.target.id==='branch')updateMasters();
 updateSlots();
});
form.addEventListener('submit',event=>{
 event.preventDefault();
 if(!form.querySelector('input[name="time"]:checked'))return;
 const d=summary(); $('receipt').textContent=`${d.branch} · ${d.service} · ${d.master} · ${d.when}.`;
 form.hidden=true; $('success').hidden=false; $('success-title').focus();
});
$('again').addEventListener('click',()=>{
 form.reset();updateMasters();updateSlots();$('success').hidden=true;form.hidden=false;$('branch').focus();
});
updateMasters();updateSlots();
