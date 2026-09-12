(function(){
  var canvas=document.getElementById('starry-canvas');if(!canvas)return;
  var ctx=canvas.getContext('2d');var stars=[];var raf=0;var reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function resize(){
    var ratio=Math.min(devicePixelRatio||1,2);canvas.width=Math.floor(innerWidth*ratio);canvas.height=Math.floor(innerHeight*ratio);canvas.style.width=innerWidth+'px';canvas.style.height=innerHeight+'px';ctx.setTransform(ratio,0,0,ratio,0,0);
    var count=Math.min(180,Math.max(70,Math.floor(innerWidth*innerHeight/9000)));stars=Array.from({length:count},function(){return{x:Math.random()*innerWidth,y:Math.random()*innerHeight,r:Math.random()*1.35+.25,a:Math.random()*.7+.2,s:Math.random()*.012+.003};});
  }
  function draw(t){ctx.clearRect(0,0,innerWidth,innerHeight);stars.forEach(function(star,i){var pulse=reduced?star.a:star.a+Math.sin(t*star.s+i)*.16;ctx.beginPath();ctx.fillStyle='rgba(215,205,255,'+Math.max(.08,pulse)+')';ctx.arc(star.x,star.y,star.r,0,Math.PI*2);ctx.fill();});if(!reduced)raf=requestAnimationFrame(draw);}
  addEventListener('resize',resize,{passive:true});resize();draw(0);addEventListener('pagehide',function(){cancelAnimationFrame(raf);});
})();
