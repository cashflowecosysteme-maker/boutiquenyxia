(function(){
  'use strict';

  var PORTAL_FALLBACK={
    nyxia:{id:'nyxia',name:'NyXia',intro:'Solutions techniques, accompagnement et services Done For You.',symbol:'N'},
    diane:{id:'diane',name:'Diane',intro:'Parcours, livres et créations de la fondatrice de l’écosystème.',symbol:'D'},
    eric:{id:'eric',name:'Éric',intro:'Marketing relationnel, communication et univers CashFlow™.',symbol:'É'},
    lena:{id:'lena',name:'Léna',intro:'Dons, outils spirituels et méthode DDM.',symbol:'L'},
    selena:{id:'selena',name:'Séléna',intro:'Libération émotionnelle, miroir et méthode A.M.I.E.™.',symbol:'S'},
    kael:{id:'kael',name:'Kael',intro:'Relations, activités et expériences à vivre à deux.',symbol:'K'},
    alex:{id:'alex',name:'Alex',intro:'Écriture, livres et parcours pour aller jusqu’au mot FIN.',symbol:'A'}
  };
  var TYPE_LABELS={formation:'Formation',livre:'Livre',service:'Service',evenement:'Événement',activite:'Activité',outil:'Outil','produit-physique':'Produit physique','produit-numerique':'Produit numérique',autre:'Découverte'};
  var CTA_LABELS={acheter:'Acheter','rendez-vous':'Prendre un rendez-vous',appel:'Prendre un appel','en-savoir-plus':'En savoir plus'};

  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(char){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];});}
  function api(path){return fetch(path,{headers:{Accept:'application/json'}}).then(function(response){if(!response.ok)throw new Error('La Boutique est momentanément indisponible.');return response.json();});}
  function productUrl(product){return '/produit.html?id='+encodeURIComponent(product.id);}
  function portalFrom(settings,id){
    var saved=((settings&&settings.portals)||[]).find(function(item){return item.id===id;})||{};
    return Object.assign({},PORTAL_FALLBACK[id]||{id:id,name:id,intro:'',symbol:'✦'},saved);
  }
  function currency(product){
    if(product.priceLabel)return esc(product.priceLabel);
    if(product.price==null||product.price==='')return 'Prix sur la fiche';
    try{return Number(product.price).toLocaleString('fr-CA',{style:'currency',currency:product.currency||'CAD'});}catch(_){return Number(product.price).toFixed(2)+' $';}
  }
  function oldPrice(product){
    if(product.oldPrice==null||product.oldPrice==='')return '';
    try{return Number(product.oldPrice).toLocaleString('fr-CA',{style:'currency',currency:product.currency||'CAD'});}catch(_){return Number(product.oldPrice).toFixed(2)+' $';}
  }
  function cardMedia(product,portal){
    if(product.imageMain)return '<img src="'+esc(product.imageMain)+'" alt="'+esc(product.title)+'" loading="lazy">';
    return '<span class="media-placeholder" aria-hidden="true">'+esc(portal.symbol||portal.name.charAt(0))+'</span>';
  }
  function productCard(product,settings){
    var portal=portalFrom(settings,product.portal);
    var description=String(product.shortDescription||product.description||'').slice(0,150);
    return '<article class="product-card">'
      +(product.featured?'<span class="featured-badge">Vedette</span>':'')
      +(product.promoActive?'<span class="promo-badge">Code '+esc(product.promoCode)+'</span>':'')
      +'<div class="card-media">'+cardMedia(product,portal)+'</div>'
      +'<div class="card-body"><div class="card-type"><span>'+esc(TYPE_LABELS[product.type]||product.type||'Découverte')+'</span><span>'+esc(portal.name)+'</span></div>'
      +'<h3>'+esc(product.title)+'</h3><p class="card-description">'+esc(description)+(description.length>=150?'…':'')+'</p>'
      +'<div class="price-row"><span class="price">'+currency(product)+'</span>'+(oldPrice(product)?'<span class="old-price">'+esc(oldPrice(product))+'</span>':'')+'</div>'
      +'<a class="card-link" href="'+productUrl(product)+'">Voir la fiche</a></div></article>';
  }
  function setBrand(settings){
    var title=(settings&&settings.title)||'Boutique NyXia';
    var brand=document.getElementById('brand-title');if(brand)brand.textContent=title;
    if(document.body.getAttribute('data-page')==='home')document.title=title;
  }

  function renderHome(settings,products){
    setBrand(settings);
    var heroTitle=document.getElementById('hero-title');var heroText=document.getElementById('hero-text');
    if(heroTitle)heroTitle.textContent=settings.heroTitle||heroTitle.textContent;
    if(heroText)heroText.textContent=settings.heroText||heroText.textContent;
    var portals=((settings&&settings.portals)||Object.keys(PORTAL_FALLBACK).map(function(id){return PORTAL_FALLBACK[id];}))
      .filter(function(portal){return portal.active!==false;})
      .sort(function(a,b){return(Number(a.order)||0)-(Number(b.order)||0);});
    var doors=document.getElementById('doors-grid');
    doors.innerHTML=portals.map(function(saved){
      var portal=portalFrom(settings,saved.id);
      return '<a class="door-card" data-portal="'+esc(portal.id)+'" href="/univers.html?portail='+encodeURIComponent(portal.id)+'">'
        +'<div class="door-content"><span class="door-mark">'+(portal.imageUrl?'<img src="'+esc(portal.imageUrl)+'" alt="">':esc(portal.symbol||portal.name.charAt(0)))+'</span>'
        +'<h3>'+esc(portal.name)+'</h3><p>'+esc(portal.intro||'')+'</p><span class="door-enter">Entrer dans l’univers →</span></div></a>';
    }).join('')||'<div class="empty-state">Les portes seront bientôt ouvertes.</div>';
    var featured=(products||[]).filter(function(product){return product.featured;});
    if(featured.length){
      document.getElementById('vedettes').hidden=false;
      document.getElementById('featured-grid').innerHTML=featured.map(function(product){return productCard(product,settings);}).join('');
    }
  }

  function requestedPortal(){
    var query=new URLSearchParams(location.search).get('portail');
    if(query)return query.toLowerCase();
    var match=location.pathname.match(/^\/univers\/([a-z0-9-]+)/);return match?match[1]:'';
  }
  function renderUniverse(settings,products){
    setBrand(settings);
    var id=requestedPortal();var portal=portalFrom(settings,id);
    if(!PORTAL_FALLBACK[id]){document.querySelector('main').innerHTML='<div class="error-state">Cet univers n’existe pas encore. <a href="/">Revenir aux sept portes</a></div>';return;}
    document.title=portal.name+' · '+(settings.title||'Boutique NyXia');
    var hero=document.querySelector('.universe-hero');
    hero.insertAdjacentHTML('beforeend','<div class="universe-copy"><p class="eyebrow">Univers '+esc(portal.name)+'</p><h1>'+esc(portal.name)+'</h1><p class="lead">'+esc(portal.intro||'')+'</p></div>');
    var mark=document.getElementById('universe-mark');
    mark.innerHTML=portal.imageUrl?'<img src="'+esc(portal.imageUrl)+'" alt="'+esc(portal.name)+'">':esc(portal.symbol||portal.name.charAt(0));
    hero.insertAdjacentHTML('afterend','<section class="catalog-section"><div class="catalog-toolbar"><div><p class="eyebrow">La collection</p><h2>Découvrir les offres</h2></div><label class="search">Rechercher<input type="search" id="catalog-search" placeholder="Titre, catégorie ou type…"></label></div><div class="products-grid" id="universe-products"></div></section>');
    var all=products||[];var grid=document.getElementById('universe-products');var search=document.getElementById('catalog-search');
    function draw(){
      var q=(search.value||'').trim().toLowerCase();
      var list=all.filter(function(product){return!q||[product.title,product.shortDescription,product.description,product.category,product.type].join(' ').toLowerCase().includes(q);});
      grid.innerHTML=list.length?list.map(function(product){return productCard(product,settings);}).join(''):'<div class="empty-state">Aucune offre ne correspond à cette recherche.</div>';
    }
    search.addEventListener('input',draw);draw();
  }

  function requestedProduct(){
    var query=new URLSearchParams(location.search).get('id');if(query)return query;
    var match=location.pathname.match(/^\/produit\/([a-zA-Z0-9_-]+)/);return match?match[1]:'';
  }
  function renderProduct(settings,product){
    setBrand(settings);
    var main=document.querySelector('main');var portal=portalFrom(settings,product.portal);
    document.title=product.title+' · '+(settings.title||'Boutique NyXia');
    var images=[product.imageMain].concat(product.images||[]).filter(Boolean).slice(0,5);
    var secondary=(product.images||[]).filter(Boolean).slice(0,4);
    var mainMedia=images.length?'<img id="gallery-main" src="'+esc(images[0])+'" alt="'+esc(product.title)+'">':'<span class="media-placeholder" aria-hidden="true">'+esc(portal.symbol||portal.name.charAt(0))+'</span>';
    var thumbs=secondary.length?'<div class="thumbs">'+secondary.map(function(url,index){return '<button class="thumb" type="button" data-image="'+esc(url)+'" aria-label="Voir l’image secondaire '+(index+1)+'"><img src="'+esc(url)+'" alt=""></button>';}).join('')+'</div>':'';
    var ctaUrl=product.ctaUrl||((product.ctaType==='rendez-vous'||product.ctaType==='appel')?settings.appointmentUrl:'');
    var ctaLabel=(product.ctaType==='rendez-vous'&&settings.appointmentLabel)?settings.appointmentLabel:(CTA_LABELS[product.ctaType]||'En savoir plus');
    var cta=ctaUrl?'<a class="product-cta" href="'+esc(ctaUrl)+'" target="_blank" rel="noopener">'+esc(ctaLabel)+'</a>':'';
    var promo=product.promoActive?'<div class="promo-box"><strong>'+esc(product.promoText||'Promotion en cours')+'</strong><br><span class="promo-code">'+esc(product.promoCode)+'</span></div>':'';
    var testimonial=product.testimonialQuote?'<div class="testimonial"><blockquote>« '+esc(product.testimonialQuote)+' »</blockquote>'+(product.testimonialAuthor?'<cite>— '+esc(product.testimonialAuthor)+'</cite>':'')+'</div>':'';
    main.innerHTML='<a class="back-link" href="/univers.html?portail='+encodeURIComponent(portal.id)+'">← Revenir à l’univers '+esc(portal.name)+'</a>'
      +'<article class="product-layout"><div class="product-gallery"><div class="product-main-image">'+mainMedia+'</div>'+thumbs+'</div>'
      +'<div class="product-copy"><p class="eyebrow">'+esc(TYPE_LABELS[product.type]||product.type||'Découverte')+' · '+esc(portal.name)+'</p><h1>'+esc(product.title)+'</h1>'
      +(product.shortDescription?'<p class="lead">'+esc(product.shortDescription)+'</p>':'')
      +'<p class="description">'+esc(product.description||'')+'</p><div class="price-row product-price"><span class="price">'+currency(product)+'</span>'+(oldPrice(product)?'<span class="old-price">'+esc(oldPrice(product))+'</span>':'')+'</div>'+promo+cta+testimonial+'</div></article>';
    document.querySelectorAll('.thumb').forEach(function(button){button.addEventListener('click',function(){var image=document.getElementById('gallery-main');if(image)image.src=button.getAttribute('data-image');document.querySelectorAll('.thumb').forEach(function(item){item.classList.remove('active');});button.classList.add('active');});});
  }

  var page=document.body.getAttribute('data-page');
  if(page==='home'){
    Promise.all([api('/api/config'),api('/api/catalog')]).then(function(result){renderHome(result[0].settings||{},result[1].products||[]);}).catch(function(error){document.getElementById('doors-grid').innerHTML='<div class="error-state">'+esc(error.message)+'</div>';});
  }else if(page==='universe'){
    var portalId=requestedPortal();
    Promise.all([api('/api/config'),api('/api/catalog?portal='+encodeURIComponent(portalId))]).then(function(result){renderUniverse(result[0].settings||{},result[1].products||[]);}).catch(function(error){document.querySelector('main').innerHTML='<div class="error-state">'+esc(error.message)+'</div>';});
  }else if(page==='product'){
    var productId=requestedProduct();
    Promise.all([api('/api/config'),api('/api/catalog?id='+encodeURIComponent(productId))]).then(function(result){var product=(result[1].products||[])[0];if(!product)throw new Error('Cette fiche produit est introuvable ou n’est pas encore publiée.');renderProduct(result[0].settings||{},product);}).catch(function(error){document.querySelector('main').innerHTML='<div class="error-state">'+esc(error.message)+' <a href="/">Revenir à la Boutique</a></div>';});
  }
})();
