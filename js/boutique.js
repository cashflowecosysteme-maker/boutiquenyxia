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

  var TYPE_LABELS={
    formation:'Formation',
    livre:'Livre',
    service:'Service',
    evenement:'Événement',
    activite:'Activité',
    outil:'Outil',
    'produit-physique':'Produit physique',
    'produit-numerique':'Produit numérique',
    autre:'Découverte'
  };

  /*
   * Ton relationnel NyXia :
   * - l'ancien choix "acheter" sert maintenant de mode automatique sur les CARTES
   * - avec prix => En savoir plus
   * - sans prix => GRATUIT
   * - "appel" est présenté comme Réservation consultation
   */
  var CTA_LABELS={
    acheter:'En savoir plus',
    'rendez-vous':'Prendre un rendez-vous',
    appel:'Réservation consultation',
    'en-savoir-plus':'En savoir plus'
  };

  function esc(value){
    return String(value==null?'':value).replace(/[&<>"']/g,function(char){
      return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];
    });
  }

  function api(path){
    return fetch(path,{headers:{Accept:'application/json'}}).then(function(response){
      if(!response.ok)throw new Error('La Boutique est momentanément indisponible.');
      return response.json();
    });
  }

  var REF_STORAGE_KEY='nyxia_ref';

  function normalizeRef(value){
    return String(value||'').trim().toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,120);
  }

  function storeRef(ref){
    ref=normalizeRef(ref);
    if(!ref)return'';
    try{localStorage.setItem(REF_STORAGE_KEY,ref);}catch(_){}
    try{
      var maxAge=60*60*24*90;
      document.cookie='nyxia_ref='+encodeURIComponent(ref)+'; Path=/; Max-Age='+maxAge+'; SameSite=Lax; Secure; Domain=.nyxia.top';
    }catch(_){}
    return ref;
  }

  function cookieRef(){
    try{
      var match=document.cookie.match(/(?:^|;\s*)nyxia_ref=([^;]+)/);
      return match?normalizeRef(decodeURIComponent(match[1])):'';
    }catch(_){return'';}
  }

  function currentRef(){
    var params=new URLSearchParams(location.search);
    var incoming=normalizeRef(params.get('ref')||params.get('code')||'');
    if(incoming)return storeRef(incoming);
    try{
      var saved=normalizeRef(localStorage.getItem(REF_STORAGE_KEY)||'');
      if(saved)return saved;
    }catch(_){}
    return cookieRef();
  }

  function checkoutUrl(raw,productId){
    var url=String(raw||'').trim();
    if(!url)return'';
    try{
      var parsed=new URL(url,location.origin);
      var ref=currentRef();
      if(ref)parsed.searchParams.set('ref',ref);
      if(productId)parsed.searchParams.set('nyxia_product',String(productId));
      return parsed.toString();
    }catch(_){return url;}
  }

  function recordRefClick(productId){
    var ref=currentRef();
    if(!ref||!productId)return;
    try{
      fetch('/api/ref-click',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ref:ref,productId:String(productId)}),
        keepalive:true
      }).catch(function(){});
    }catch(_){}
  }

  function productUrl(product){
    return '/produit.html?id='+encodeURIComponent(product.id);
  }

  function portalFrom(settings,id){
    var saved=((settings&&settings.portals)||[]).find(function(item){return item.id===id;})||{};
    return Object.assign({},PORTAL_FALLBACK[id]||{id:id,name:id,intro:'',symbol:'✦'},saved);
  }

  function hasRealPrice(product){
    if(product.priceLabel)return true;
    if(product.price==null||product.price==='')return false;
    var value=Number(product.price);
    return Number.isFinite(value)&&value>0;
  }

  function currency(product){
    if(product.priceLabel)return esc(product.priceLabel);
    if(product.price==null||product.price==='')return '';
    var value=Number(product.price);
    if(!Number.isFinite(value)||value<=0)return '';
    try{
      return value.toLocaleString('fr-CA',{style:'currency',currency:product.currency||'CAD'});
    }catch(_){
      return value.toFixed(2)+' $';
    }
  }

  function oldPrice(product){
    if(product.oldPrice==null||product.oldPrice==='')return '';
    var value=Number(product.oldPrice);
    if(!Number.isFinite(value)||value<=0)return '';
    try{
      return value.toLocaleString('fr-CA',{style:'currency',currency:product.currency||'CAD'});
    }catch(_){
      return value.toFixed(2)+' $';
    }
  }

  function cardAction(product,settings){
    var type=String(product.ctaType||'acheter');

    /*
     * L'ancien "acheter" est notre mode AUTO sur les cartes.
     * Il ne s'affiche jamais comme mot de vente.
     */
    if(type==='acheter'){
      type=hasRealPrice(product)?'en-savoir-plus':'gratuit';
    }

    if(type==='appel')type='reservation-consultation';

    var label='En savoir plus';
    if(type==='gratuit')label='GRATUIT';
    else if(type==='rendez-vous')label='Prendre un rendez-vous';
    else if(type==='reservation-consultation')label='Réservation consultation';
    else if(type==='en-savoir-plus')label='En savoir plus';

    var url=productUrl(product);
    var external=false;

    if(type==='rendez-vous'||type==='reservation-consultation'){
      url=String(product.ctaUrl||settings.appointmentUrl||productUrl(product)).trim();
      external=/^https:\/\//i.test(url);
    }else if(type==='gratuit'&&String(product.ctaUrl||'').trim()){
      url=String(product.ctaUrl).trim();
      external=/^https:\/\//i.test(url);
    }

    return{type:type,label:label,url:url,external:external};
  }

  function cardMedia(product,portal){
    if(product.imageMain)return '<img src="'+esc(product.imageMain)+'" alt="'+esc(product.title)+'" loading="lazy">';
    return '<span class="media-placeholder" aria-hidden="true">'+esc(portal.symbol||portal.name.charAt(0))+'</span>';
  }

  function productCard(product,settings){
    var portal=portalFrom(settings,product.portal);
    var description=String(product.shortDescription||product.description||'').slice(0,150);
    var priceText=currency(product);
    var previousPrice=oldPrice(product);
    var priceBlock=priceText
      ?'<div class="price-row"><span class="price">'+priceText+'</span>'+(previousPrice?'<span class="old-price">'+esc(previousPrice)+'</span>':'')+'</div>'
      :'';

    var action=cardAction(product,settings);
    var actionAttrs=action.external?' target="_blank" rel="noopener"':'';
    var actionMarkup='<a href="'+esc(action.url)+'"'+actionAttrs+' style="color:inherit;text-decoration:none;font-weight:800">'+esc(action.label)+'</a>';

    return '<article class="product-card">'
      +(product.featured?'<span class="featured-badge">Vedette</span>':'')
      +(product.promoActive?'<span class="promo-badge">Code '+esc(product.promoCode)+'</span>':'')
      +'<div class="card-media">'+cardMedia(product,portal)+'</div>'
      +'<div class="card-body"><div class="card-type"><span>'+esc(TYPE_LABELS[product.type]||product.type||'Découverte')+'</span><span>'+esc(portal.name)+'</span></div>'
      +'<h3>'+esc(product.title)+'</h3><p class="card-description">'+esc(description)+(description.length>=150?'…':'')+'</p>'
      +priceBlock
      +'<div class="card-link" style="gap:10px;align-items:center;flex-wrap:wrap">'
      +'<a href="'+productUrl(product)+'" style="color:inherit;text-decoration:none;font-weight:800">Voir la fiche</a>'
      +'<span aria-hidden="true" style="opacity:.45">|</span>'
      +actionMarkup
      +'</div></div></article>';
  }

  function setBrand(settings){
    var title=(settings&&settings.title)||'Boutique NyXia';
    var brand=document.getElementById('brand-title');
    if(brand)brand.textContent=title;
    if(document.body.getAttribute('data-page')==='home')document.title=title;
  }

  function renderHome(settings,products){
    setBrand(settings);

    var heroTitle=document.getElementById('hero-title');
    var heroText=document.getElementById('hero-text');
    if(heroTitle)heroTitle.textContent=settings.heroTitle||heroTitle.textContent;
    if(heroText)heroText.textContent=settings.heroText||heroText.textContent;

    var portals=((settings&&settings.portals)||Object.keys(PORTAL_FALLBACK).map(function(id){return PORTAL_FALLBACK[id];}))
      .filter(function(portal){return portal.active!==false;})
      .sort(function(a,b){return(Number(a.order)||0)-(Number(b.order)||0);});

    var doors=document.getElementById('doors-grid');
    doors.innerHTML=portals.map(function(saved){
      var portal=portalFrom(settings,saved.id);
      return '<a class="door-card" data-portal="'+esc(portal.id)+'" href="/univers.html?portail='+encodeURIComponent(portal.id)+'">'
        +'<div class="door-content"><span class="door-mark">'
        +(portal.imageUrl?'<img src="'+esc(portal.imageUrl)+'" alt="'+esc(portal.name)+'" loading="lazy">':esc(portal.symbol||portal.name.charAt(0)))
        +'</span><h3>'+esc(portal.name)+'</h3><p>'+esc(portal.intro||'')+'</p><span class="door-enter">Entrer dans l’univers →</span></div></a>';
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
    var match=location.pathname.match(/^\/univers\/([a-z0-9-]+)/);
    return match?match[1]:'';
  }

  function renderUniverse(settings,products){
    setBrand(settings);

    var id=requestedPortal();
    var portal=portalFrom(settings,id);

    if(!PORTAL_FALLBACK[id]){
      document.querySelector('main').innerHTML='<div class="error-state">Cet univers n’existe pas encore. <a href="/">Revenir aux sept portes</a></div>';
      return;
    }

    document.title=portal.name+' · '+(settings.title||'Boutique NyXia');

    var hero=document.querySelector('.universe-hero');
    hero.insertAdjacentHTML('beforeend','<div class="universe-copy"><p class="eyebrow">Univers '+esc(portal.name)+'</p><h1>'+esc(portal.name)+'</h1><p class="lead">'+esc(portal.intro||'')+'</p></div>');

    var mark=document.getElementById('universe-mark');
    mark.innerHTML=portal.imageUrl?'<img src="'+esc(portal.imageUrl)+'" alt="'+esc(portal.name)+'">':esc(portal.symbol||portal.name.charAt(0));

    hero.insertAdjacentHTML('afterend','<section class="catalog-section"><div class="catalog-toolbar"><div><p class="eyebrow">La collection</p><h2>Découvrir les propositions</h2></div><label class="search">Rechercher<input type="search" id="catalog-search" placeholder="Titre, catégorie ou type…"></label></div><div class="products-grid" id="universe-products"></div></section>');

    var all=products||[];
    var grid=document.getElementById('universe-products');
    var search=document.getElementById('catalog-search');

    function draw(){
      var q=(search.value||'').trim().toLowerCase();
      var list=all.filter(function(product){
        return!q||[product.title,product.shortDescription,product.description,product.category,product.type].join(' ').toLowerCase().includes(q);
      });
      grid.innerHTML=list.length
        ?list.map(function(product){return productCard(product,settings);}).join('')
        :'<div class="empty-state">Aucune proposition ne correspond à cette recherche.</div>';
    }

    search.addEventListener('input',draw);
    draw();
  }

  function requestedProduct(){
    var query=new URLSearchParams(location.search).get('id');
    if(query)return query;
    var match=location.pathname.match(/^\/produit\/([a-zA-Z0-9_-]+)/);
    return match?match[1]:'';
  }

  function videoInfo(url){
    var raw=String(url||'').trim();
    if(!raw)return null;
    try{
      var parsed=new URL(raw,location.origin);
      var host=parsed.hostname.toLowerCase().replace(/^www\./,'');
      var id='';

      if(host==='youtube.com'||host==='m.youtube.com'||host==='youtube-nocookie.com'){
        if(parsed.pathname==='/watch')id=parsed.searchParams.get('v')||'';
        else{
          var ym=parsed.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{6,})/);
          if(ym)id=ym[1];
        }
        if(id)return{kind:'iframe',src:'https://www.youtube-nocookie.com/embed/'+encodeURIComponent(id)+'?rel=0',provider:'YouTube'};
      }

      if(host==='youtu.be'){
        id=parsed.pathname.replace(/^\//,'').split('/')[0];
        if(id)return{kind:'iframe',src:'https://www.youtube-nocookie.com/embed/'+encodeURIComponent(id)+'?rel=0',provider:'YouTube'};
      }

      if(host==='vimeo.com'||host==='player.vimeo.com'){
        var vm=parsed.pathname.match(/(?:\/video)?\/(\d+)/);
        if(vm&&vm[1])return{kind:'iframe',src:'https://player.vimeo.com/video/'+vm[1],provider:'Vimeo'};
      }

      if(/\.mp4(?:$|[?#])/i.test(parsed.href))return{kind:'video',src:parsed.href,provider:'MP4'};
    }catch(_){}
    return null;
  }

  function videoMarkup(product,context){
    var info=videoInfo(product.videoUrl);
    if(!info)return'';
    var title=product.videoTitle||('Vidéo — '+product.title);
    var media=info.kind==='iframe'
      ?'<iframe src="'+esc(info.src)+'" title="'+esc(title)+'" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>'
      :'<video controls preload="metadata" playsinline><source src="'+esc(info.src)+'" type="video/mp4">Ton navigateur ne peut pas lire cette vidéo.</video>';
    return '<div class="product-video-frame" data-video-context="'+esc(context||'product')+'">'+media+'</div>'
      +(product.videoTitle?'<div class="product-video-title">'+esc(product.videoTitle)+'</div>':'');
  }

  function testimonialMarkup(product){
    var quote=String(product.testimonialQuote||'').trim();
    var author=String(product.testimonialAuthor||'').trim();
    var image=String(product.testimonialImageUrl||'').trim();
    var mode=String(product.testimonialMode||'').trim();
    if(['text','image','both'].indexOf(mode)<0){
      mode=image&&quote?'both':(image?'image':'text');
    }

    var showText=(mode==='text'||mode==='both')&&quote;
    var showImage=(mode==='image'||mode==='both')&&image;
    if(!showText&&!showImage)return'';

    var html='<div class="testimonial'+(showImage?' has-image':'')+'">';
    if(showText){
      html+='<blockquote>« '+esc(quote)+' »</blockquote>'+(author?'<cite>— '+esc(author)+'</cite>':'');
    }
    if(showImage){
      html+='<button class="testimonial-image-button" type="button" data-testimonial-image="'+esc(image)+'" aria-label="Agrandir le témoignage">'
        +'<img src="'+esc(image)+'" alt="Témoignage'+(author?' — '+esc(author):'')+'" loading="lazy">'
        +'<span>Agrandir</span></button>';
    }
    return html+'</div>';
  }

  function ensureTestimonialLightbox(){
    var existing=document.getElementById('testimonial-lightbox');
    if(existing)return existing;
    var box=document.createElement('div');
    box.id='testimonial-lightbox';
    box.className='testimonial-lightbox';
    box.hidden=true;
    box.innerHTML='<button class="testimonial-lightbox-close" type="button" aria-label="Fermer">×</button><img src="" alt="Témoignage agrandi">';
    document.body.appendChild(box);

    function close(){
      box.classList.remove('is-open');
      document.body.classList.remove('testimonial-open');
      window.setTimeout(function(){if(!box.classList.contains('is-open'))box.hidden=true;},180);
    }
    box.querySelector('.testimonial-lightbox-close').addEventListener('click',close);
    box.addEventListener('click',function(event){if(event.target===box)close();});
    document.addEventListener('keydown',function(event){if(event.key==='Escape'&&box.classList.contains('is-open'))close();});
    box._close=close;
    return box;
  }

  function bindTestimonialLightbox(){
    var box=ensureTestimonialLightbox();
    document.querySelectorAll('[data-testimonial-image]').forEach(function(button){
      button.addEventListener('click',function(){
        var src=button.getAttribute('data-testimonial-image');
        var image=box.querySelector('img');
        image.src=src||'';
        box.hidden=false;
        document.body.classList.add('testimonial-open');
        requestAnimationFrame(function(){box.classList.add('is-open');});
      });
    });
  }

  function renderProduct(settings,product){
    setBrand(settings);

    var main=document.querySelector('main');
    var portal=portalFrom(settings,product.portal);
    document.title=product.title+' · '+(settings.title||'Boutique NyXia');

    var images=[product.imageMain].concat(product.images||[]).filter(Boolean).slice(0,5);
    var secondary=(product.images||[]).filter(Boolean).slice(0,4);
    var videoPosition=['gallery','description','hidden'].indexOf(product.videoPosition)>=0?product.videoPosition:'gallery';
    var hasGalleryVideo=!!videoInfo(product.videoUrl)&&videoPosition==='gallery';
    var initialVideo=!images.length&&hasGalleryVideo;

    var mainMedia=initialVideo
      ?videoMarkup(product,'gallery')
      :(images.length
        ?'<img id="gallery-main" src="'+esc(images[0])+'" alt="'+esc(product.title)+'">'
        :'<span class="media-placeholder" aria-hidden="true">'+esc(portal.symbol||portal.name.charAt(0))+'</span>');

    var thumbs='';
    if(hasGalleryVideo){
      var galleryImages=images.slice(0,5);
      thumbs='<div class="thumbs product-media-thumbs">'
        +galleryImages.map(function(url,index){
          return '<button class="thumb media-thumb'+(!initialVideo&&index===0?' active':'')+'" type="button" data-media-image="'+esc(url)+'" aria-label="Voir l’image '+(index+1)+'"><img src="'+esc(url)+'" alt=""></button>';
        }).join('')
        +'<button class="thumb media-thumb video-thumb'+(initialVideo?' active':'')+'" type="button" data-media-video="1" aria-label="Voir la vidéo"><span class="video-thumb-icon">▶</span><small>Vidéo</small></button>'
        +'</div>';
    }else if(secondary.length){
      thumbs='<div class="thumbs">'+secondary.map(function(url,index){
        return '<button class="thumb" type="button" data-image="'+esc(url)+'" aria-label="Voir l’image secondaire '+(index+1)+'"><img src="'+esc(url)+'" alt=""></button>';
      }).join('')+'</div>';
    }

    var isSystemeCheckout=!!String(product.systemeCheckoutUrl||'').trim();
    var ctaRaw=isSystemeCheckout
      ?product.systemeCheckoutUrl
      :(product.ctaUrl||((product.ctaType==='rendez-vous'||product.ctaType==='appel')?settings.appointmentUrl:''));
    var ctaUrl=isSystemeCheckout?checkoutUrl(ctaRaw,product.id):ctaRaw;
    var ctaLabel=isSystemeCheckout
      ?'Continuer'
      :((product.ctaType==='rendez-vous'&&settings.appointmentLabel)
        ?settings.appointmentLabel
        :(CTA_LABELS[product.ctaType]||'En savoir plus'));

    var cta=ctaUrl?'<a class="product-cta" href="'+esc(ctaUrl)+'" target="_blank" rel="noopener"'+(isSystemeCheckout?' data-nyxia-checkout="'+esc(product.id)+'"':'')+'>'+esc(ctaLabel)+'</a>':'';
    var promo=product.promoActive?'<div class="promo-box"><strong>'+esc(product.promoText||'Promotion en cours')+'</strong><br><span class="promo-code">'+esc(product.promoCode)+'</span></div>':'';
    var testimonial=testimonialMarkup(product);
    var descriptionVideo=(videoPosition==='description'&&videoInfo(product.videoUrl))
      ?'<div class="product-video-block">'+videoMarkup(product,'description')+'</div>'
      :'';

    var productPriceText=currency(product);
    var productOldPrice=oldPrice(product);
    var productPriceBlock=productPriceText
      ?'<div class="price-row product-price"><span class="price">'+productPriceText+'</span>'+(productOldPrice?'<span class="old-price">'+esc(productOldPrice)+'</span>':'')+'</div>'
      :'';

    main.innerHTML='<a class="back-link" href="/univers.html?portail='+encodeURIComponent(portal.id)+'">← Revenir à l’univers '+esc(portal.name)+'</a>'
      +'<article class="product-layout"><div class="product-gallery"><div class="product-main-image'+(initialVideo?' video-active':'')+'" id="product-main-media">'+mainMedia+'</div>'+thumbs+'</div>'
      +'<div class="product-copy"><p class="eyebrow">'+esc(TYPE_LABELS[product.type]||product.type||'Découverte')+' · '+esc(portal.name)+'</p><h1>'+esc(product.title)+'</h1>'
      +(product.shortDescription?'<p class="lead">'+esc(product.shortDescription)+'</p>':'')
      +'<p class="description">'+esc(product.description||'')+'</p>'+descriptionVideo+productPriceBlock+promo+cta+testimonial+'</div></article>';

    if(hasGalleryVideo){
      var mediaBox=document.getElementById('product-main-media');
      document.querySelectorAll('[data-media-image]').forEach(function(button){
        button.addEventListener('click',function(){
          mediaBox.classList.remove('video-active');
          mediaBox.innerHTML='<img id="gallery-main" src="'+esc(button.getAttribute('data-media-image'))+'" alt="'+esc(product.title)+'">';
          document.querySelectorAll('.media-thumb').forEach(function(item){item.classList.remove('active');});
          button.classList.add('active');
        });
      });
      var videoButton=document.querySelector('[data-media-video]');
      if(videoButton){
        videoButton.addEventListener('click',function(){
          mediaBox.classList.add('video-active');
          mediaBox.innerHTML=videoMarkup(product,'gallery');
          document.querySelectorAll('.media-thumb').forEach(function(item){item.classList.remove('active');});
          videoButton.classList.add('active');
        });
      }
    }else{
      document.querySelectorAll('.thumb').forEach(function(button){
        button.addEventListener('click',function(){
          var image=document.getElementById('gallery-main');
          if(image)image.src=button.getAttribute('data-image');
          document.querySelectorAll('.thumb').forEach(function(item){item.classList.remove('active');});
          button.classList.add('active');
        });
      });
    }

    bindTestimonialLightbox();
    document.querySelectorAll('[data-nyxia-checkout]').forEach(function(link){
      link.addEventListener('click',function(){recordRefClick(link.getAttribute('data-nyxia-checkout'));});
    });
  }

  /* =========================================================
     MENU BURGER NYXIA
     ========================================================= */
  function initBurgerMenu(){
    var button=document.getElementById('burger-button');
    var menu=document.getElementById('nyxia-menu');
    var backdrop=document.getElementById('menu-backdrop');
    var closeButton=document.getElementById('menu-close');

    if(!button||!menu||!backdrop||!closeButton)return;

    var lastFocus=null;
    var hideTimer=null;

    function openMenu(){
      if(hideTimer){clearTimeout(hideTimer);hideTimer=null;}
      lastFocus=document.activeElement;
      backdrop.hidden=false;

      requestAnimationFrame(function(){
        backdrop.classList.add('is-visible');
        menu.classList.add('is-open');
      });

      document.body.classList.add('menu-open');
      button.setAttribute('aria-expanded','true');
      button.setAttribute('aria-label','Fermer le menu');
      menu.setAttribute('aria-hidden','false');

      setTimeout(function(){
        closeButton.focus({preventScroll:true});
      },40);
    }

    function closeMenu(returnFocus){
      menu.classList.remove('is-open');
      backdrop.classList.remove('is-visible');
      document.body.classList.remove('menu-open');

      button.setAttribute('aria-expanded','false');
      button.setAttribute('aria-label','Ouvrir le menu');
      menu.setAttribute('aria-hidden','true');

      hideTimer=setTimeout(function(){backdrop.hidden=true;},260);

      if(returnFocus!==false&&lastFocus&&typeof lastFocus.focus==='function'){
        lastFocus.focus({preventScroll:true});
      }
    }

    function toggleMenu(){
      if(menu.classList.contains('is-open'))closeMenu();
      else openMenu();
    }

    button.addEventListener('click',toggleMenu);
    closeButton.addEventListener('click',function(){closeMenu();});
    backdrop.addEventListener('click',function(){closeMenu();});

    menu.querySelectorAll('a').forEach(function(link){
      link.addEventListener('click',function(){closeMenu(false);});
    });

    document.addEventListener('keydown',function(event){
      if(event.key==='Escape'&&menu.classList.contains('is-open')){
        event.preventDefault();
        closeMenu();
      }
    });
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',initBurgerMenu,{once:true});
  }else{
    initBurgerMenu();
  }

  currentRef();
  var page=document.body.getAttribute('data-page');

  if(page==='home'){
    Promise.all([api('/api/config'),api('/api/catalog')])
      .then(function(result){renderHome(result[0].settings||{},result[1].products||[]);})
      .catch(function(error){document.getElementById('doors-grid').innerHTML='<div class="error-state">'+esc(error.message)+'</div>';});
  }else if(page==='universe'){
    var portalId=requestedPortal();
    Promise.all([api('/api/config'),api('/api/catalog?portal='+encodeURIComponent(portalId))])
      .then(function(result){renderUniverse(result[0].settings||{},result[1].products||[]);})
      .catch(function(error){document.querySelector('main').innerHTML='<div class="error-state">'+esc(error.message)+'</div>';});
  }else if(page==='product'){
    var productId=requestedProduct();
    Promise.all([api('/api/config'),api('/api/catalog?id='+encodeURIComponent(productId))])
      .then(function(result){
        var product=(result[1].products||[])[0];
        if(!product)throw new Error('Cette fiche produit est introuvable ou n’est pas encore publiée.');
        renderProduct(result[0].settings||{},product);
      })
      .catch(function(error){document.querySelector('main').innerHTML='<div class="error-state">'+esc(error.message)+' <a href="/">Revenir à la Boutique</a></div>';});
  }
})();
