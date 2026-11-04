document.getElementById('year').textContent = new Date().getFullYear();

// ─── Special Deals ────────────────────────────────────────────────────────
//
// Pulls live from a Supabase VIEW (public_special_deals), not a table — the view
// already does all the filtering and limiting (special_deal = true, status =
// 'listed', newest first, capped at 10), so this script never has to. There is
// no caching or snapshot anywhere in this flow: every page load re-queries
// Supabase directly, so an item that sells, gets unmarked, or goes inactive in
// Donny's Deals simply stops coming back on the very next load.
//
// SUPABASE_URL and SUPABASE_ANON_KEY are safe to be public, by Supabase's own
// design: the anon key is already compiled into the main Donny's Deals app's
// public browser bundle, and on its own it grants nothing — every table it
// could otherwise touch is locked `to authenticated` (see the main app's
// supabase_security.sql). It only works here because public_special_deals is a
// VIEW that explicitly grants it select, and that view exposes nothing but
// name/price/size/shipping/photos/listing id — never cost, profit, or any
// other field from the real `items` table. See supabase_special_deal.sql in
// the Donny's Deals repo for the exact view definition.
(function () {
  var SUPABASE_URL = 'https://wcndfbsdtfehjvgeaerl.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_Q8mnIjf31TOfv4wYFwsBgg_qGoUGHMP';

  var section = document.getElementById('specials');
  var grid = document.getElementById('specials-grid');
  if (!section || !grid) return;

  function money(value) {
    var n = parseFloat(value);
    return isFinite(n) ? '$' + n.toFixed(2) : null;
  }

  function leadPhoto(photos) {
    if (!Array.isArray(photos)) return null;
    var real = photos.filter(function (p) { return typeof p === 'string' && p.indexOf('tag:') !== 0; });
    return real[0] || photos[0] || null;
  }

  function shippingLine(item) {
    var cost = money(item.shipping_cost);
    if (!cost) return 'Shipping calculated at checkout';
    if (item.shipping_paid_by === 'seller') return 'Free shipping';
    return cost + ' shipping';
  }

  function card(item) {
    var article = document.createElement('article');
    article.className = 'deal-card';

    var photoUrl = leadPhoto(item.photos);
    var photoHtml = photoUrl
      ? '<img src="' + photoUrl + '" alt="' + (item.name || 'Item photo') + '" class="deal-photo">'
      : '<div class="deal-photo deal-photo-empty">No Photo</div>';

    var price = money(item.price);
    var sizeLine = [item.size, item.size_type].filter(Boolean).join(' · ');
    var listingHref = item.ebay_item_id ? ('https://www.ebay.com/itm/' + encodeURIComponent(item.ebay_item_id)) : null;

    article.innerHTML =
      photoHtml +
      '<div class="deal-info">' +
        '<span class="deal-availability">' + (item.availability || 'Available') + '</span>' +
        '<h3 class="deal-title"></h3>' +
        (sizeLine ? '<p class="deal-size"></p>' : '') +
        '<p class="deal-price-row">' +
          (price ? '<span class="deal-price"></span>' : '') +
          '<span class="deal-shipping"></span>' +
        '</p>' +
        (listingHref ? '<a class="btn btn-primary deal-link" target="_blank" rel="noopener">View Listing &rarr;</a>' : '') +
      '</div>';

    // Text content set via textContent, not interpolated into the HTML string above — these
    // values come straight from Supabase, and a title or size someone typed into the inventory
    // app is still untrusted input once it reaches this page.
    article.querySelector('.deal-title').textContent = item.name || 'Untitled item';
    if (sizeLine) article.querySelector('.deal-size').textContent = sizeLine;
    if (price) article.querySelector('.deal-price').textContent = price;
    article.querySelector('.deal-shipping').textContent = shippingLine(item);
    if (listingHref) article.querySelector('.deal-link').href = listingHref;

    return article;
  }

  fetch(SUPABASE_URL + '/rest/v1/public_special_deals?select=*', {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
    },
  })
    .then(function (res) { return res.ok ? res.json() : Promise.reject(new Error('Supabase returned ' + res.status)); })
    .then(function (items) {
      if (!Array.isArray(items) || items.length === 0) return; // section stays hidden
      items.forEach(function (item) { grid.appendChild(card(item)); });
      section.hidden = false;
    })
    .catch(function (err) {
      // Fails quietly: the rest of the site (which never depended on this) stays fully usable,
      // and a shopper never sees a half-built "Special Deals" section or a console-only error.
      console.error('Could not load Special Deals:', err.message);
    });
})();

// ─── Bundles ─────────────────────────────────────────────────────────────
//
// Same live-query, no-caching shape as Special Deals above, pulling from a different
// Supabase VIEW (public_bundle_deals — see supabase_bundles.sql in the Donny's Deals
// repo). A bundle has no eBay listing of its own: Donny picks the items and sets the
// combined price himself in the app, and buying it means clicking through to each
// item's own real eBay listing below — there's no single "buy the bundle" checkout.
(function () {
  var SUPABASE_URL = 'https://wcndfbsdtfehjvgeaerl.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_Q8mnIjf31TOfv4wYFwsBgg_qGoUGHMP';

  var section = document.getElementById('bundles');
  var grid = document.getElementById('bundles-grid');
  if (!section || !grid) return;

  function money(value) {
    var n = parseFloat(value);
    return isFinite(n) ? '$' + n.toFixed(2) : null;
  }

  function card(bundle) {
    var article = document.createElement('article');
    article.className = 'deal-card';

    var bundleItems = Array.isArray(bundle.items) ? bundle.items : [];
    var photosHtml = bundleItems.slice(0, 6).map(function (it) {
      return it.photo
        ? '<img src="' + it.photo + '" alt="" class="bundle-photo">'
        : '<div class="bundle-photo deal-photo-empty"></div>';
    }).join('');

    var price = money(bundle.price);

    article.innerHTML =
      '<div class="bundle-photos">' + photosHtml + '</div>' +
      '<div class="deal-info">' +
        '<span class="deal-availability">Bundle</span>' +
        '<h3 class="deal-title"></h3>' +
        (price ? '<p class="deal-price-row"><span class="deal-price"></span></p>' : '') +
        '<div class="bundle-items-list"></div>' +
      '</div>';

    // Text content set via textContent, not interpolated into the HTML string above — same
    // reasoning as Special Deals: a bundle name or item name Donny typed is still untrusted
    // input once it reaches this public page.
    article.querySelector('.deal-title').textContent = bundle.name || 'Bundle';
    if (price) article.querySelector('.deal-price').textContent = price + ' for all ' + bundleItems.length;

    var list = article.querySelector('.bundle-items-list');
    bundleItems.forEach(function (it) {
      if (!it.ebay_item_id) return;
      var a = document.createElement('a');
      a.className = 'bundle-item-link';
      a.target = '_blank';
      a.rel = 'noopener';
      a.href = 'https://www.ebay.com/itm/' + encodeURIComponent(it.ebay_item_id);
      a.textContent = (it.name || 'Item') + ' →';
      list.appendChild(a);
    });

    return article;
  }

  fetch(SUPABASE_URL + '/rest/v1/public_bundle_deals?select=*', {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
    },
  })
    .then(function (res) { return res.ok ? res.json() : Promise.reject(new Error('Supabase returned ' + res.status)); })
    .then(function (bundles) {
      if (!Array.isArray(bundles) || bundles.length === 0) return; // section stays hidden
      bundles.forEach(function (bundle) { grid.appendChild(card(bundle)); });
      section.hidden = false;
    })
    .catch(function (err) {
      console.error('Could not load Bundles:', err.message);
    });
})();
