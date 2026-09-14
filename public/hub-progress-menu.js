(function(){
 const button=document.getElementById('hub-progress-button'),menu=document.getElementById('hub-progress-menu');
 function position(){const r=button.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(r.left,innerWidth-menu.offsetWidth-8))+'px';menu.style.top=Math.max(8,Math.min(r.bottom+8,innerHeight-menu.offsetHeight-8))+'px';}
 button.onclick=()=>{if(menu.matches(':popover-open'))menu.hidePopover();else{menu.showPopover();position();menu.querySelector('button').focus();}};
 menu.addEventListener('toggle',()=>button.setAttribute('aria-expanded',String(menu.matches(':popover-open'))));
 menu.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();menu.hidePopover();button.focus();}});
 menu.querySelectorAll('button').forEach(b=>b.onclick=()=>{menu.hidePopover();button.focus();if(b.dataset.action==='goals')assignedGoals.adminOpen();else openCertMenuModal();});
 window.addEventListener('resize',()=>{if(menu.matches(':popover-open'))position();});
})();
