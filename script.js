// Cart and wishlist functionality using localStorage

const PROMO_CODES = {
    'ALI10': { discount: 10, label: '10% off' }
};

let PRODUCT_CATALOG = {};

const REVIEWS_CACHE_PREFIX = 'jflamme_reviews_';
const REVIEWS_DEFAULTS = {
    supabaseUrl: '',
    supabaseAnonKey: '',
    pageSize: 3,
    cacheTTLms: 600000,
    table: 'reviews',
    summaryView: 'review_summaries'
};

function getReviewsConfig() {
    var runtimeConfig = window.JFLAMME_REVIEWS_CONFIG || {};
    return {
        supabaseUrl: String(runtimeConfig.supabaseUrl || REVIEWS_DEFAULTS.supabaseUrl).replace(/\/+$/, ''),
        supabaseAnonKey: String(runtimeConfig.supabaseAnonKey || REVIEWS_DEFAULTS.supabaseAnonKey),
        pageSize: Number(runtimeConfig.pageSize || REVIEWS_DEFAULTS.pageSize),
        cacheTTLms: Number(runtimeConfig.cacheTTLms || REVIEWS_DEFAULTS.cacheTTLms),
        table: String(runtimeConfig.table || REVIEWS_DEFAULTS.table),
        summaryView: String(runtimeConfig.summaryView || REVIEWS_DEFAULTS.summaryView)
    };
}

function reviewsEnabled() {
    var config = getReviewsConfig();
    return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}

function buildQueryString(params) {
    return Object.keys(params)
        .filter(function(key) {
            return params[key] !== undefined && params[key] !== null && params[key] !== '';
        })
        .map(function(key) {
            return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
        })
        .join('&');
}

function supabaseRequest(resource, options) {
    var config = getReviewsConfig();
    var requestOptions = options || {};
    var url = config.supabaseUrl + '/rest/v1/' + resource;
    if (requestOptions.query) {
        url += '?' + requestOptions.query;
    }

    var headers = {
        'apikey': config.supabaseAnonKey,
        'Authorization': 'Bearer ' + config.supabaseAnonKey
    };

    if (requestOptions.body) {
        headers['Content-Type'] = 'application/json';
    }

    if (requestOptions.prefer) {
        headers['Prefer'] = requestOptions.prefer;
    }

    return fetch(url, {
        method: requestOptions.method || 'GET',
        headers: headers,
        body: requestOptions.body ? JSON.stringify(requestOptions.body) : undefined
    }).then(function(response) {
        if (!response.ok) {
            return response.text().then(function(text) {
                throw new Error(text || 'Request failed');
            });
        }
        if (response.status === 204) {
            return null;
        }
        return response.json();
    });
}

function getReviewsCacheKey(productId) {
    return REVIEWS_CACHE_PREFIX + productId;
}

function loadReviewsCache(productId) {
    try {
        var raw = localStorage.getItem(getReviewsCacheKey(productId));
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        if (!parsed || !parsed.timestamp || !parsed.data) return null;
        return parsed;
    } catch (e) {
        return null;
    }
}

function saveReviewsCache(productId, data) {
    try {
        localStorage.setItem(getReviewsCacheKey(productId), JSON.stringify({
            timestamp: Date.now(),
            data: data
        }));
    } catch (e) {
    }
}

function clearReviewsCache(productId) {
    try {
        localStorage.removeItem(getReviewsCacheKey(productId));
    } catch (e) {
    }
}

function escapeHTML(value) {
    return String(value || '').replace(/[&<>"']/g, function(character) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[character];
    });
}

function renderStars(rating) {
    var safeRating = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
    var stars = '';
    for (var i = 1; i <= 5; i++) {
        stars += '<i class="' + (i <= safeRating ? 'fas' : 'far') + ' fa-star"></i>';
    }
    return stars;
}

function formatReviewDate(value) {
    if (!value) return '';
    var date = new Date(value);
    if (isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    }).format(date);
}

function averageFromReviews(reviews) {
    if (!reviews || reviews.length === 0) return 0;
    var total = reviews.reduce(function(sum, review) {
        return sum + (Number(review.rating) || 0);
    }, 0);
    return Math.round((total / reviews.length) * 10) / 10;
}

function renderReviewCard(review) {
    var hasComment = review.comment && String(review.comment).trim() !== '';
    return [
        '<article class="review-card">',
        '    <div class="review-card-head">',
        '        <h3>' + escapeHTML(review.reviewer_name || 'Anonymous') + '</h3>',
        '        <p class="review-date">' + escapeHTML(formatReviewDate(review.created_at)) + '</p>',
        '    </div>',
        '    <div class="review-stars review-card-stars" aria-label="' + escapeHTML(review.rating) + ' out of 5 stars">' + renderStars(review.rating) + '</div>',
        hasComment ? ('    <p class="review-comment">' + escapeHTML(review.comment) + '</p>') : '',
        '</article>'
    ].join('');
}

function renderReviewSummary(summary) {
    var count = Number(summary.review_count) || 0;
    var average = Number(summary.average_rating) || 0;
    if (count === 0) {
        return [
            '<div class="reviews-summary-meta">',
            '    <div class="review-stars" aria-label="5 star rating scale">' + renderStars(0) + '</div>',
            '    <p>Be the first to add a review</p>',
            '</div>'
        ].join('');
    }

    return [
        '<div class="reviews-summary-score">' + average.toFixed(1) + '</div>',
        '<div class="reviews-summary-meta">',
        '    <div class="review-stars" aria-hidden="true">' + renderStars(average) + '</div>',
        '    <p>' + count + ' review' + (count === 1 ? '' : 's') + '</p>',
        '</div>'
    ].join('');
}

function getRatingMeta(summary) {
    var count = summary && Number(summary.review_count) ? Number(summary.review_count) : 0;
    var average = summary && Number(summary.average_rating) ? Number(summary.average_rating) : 0;
    return {
        count: count,
        average: average,
        countLabel: count + ' review' + (count === 1 ? '' : 's')
    };
}

function buildCompactRatingInnerMarkup(summary) {
    var meta = getRatingMeta(summary);
    return [
        '<span class="product-rating-stars" aria-hidden="true">' + renderStars(meta.average) + '</span>',
        '<span class="product-rating-score">' + meta.average.toFixed(1) + '</span>'
    ].join('');
}

function buildProductRatingMarkup(productId, summary) {
    var meta = getRatingMeta(summary);
    if (meta.count <= 0) {
        return '';
    }
    return [
        '<a href="product.html?id=' + encodeURIComponent(productId) + '#product-reviews" class="product-rating-link" aria-label="Open reviews for this product">',
        buildCompactRatingInnerMarkup(summary),
        '</a>'
    ].join('');
}

function fetchReviewSummariesForProducts(productIds) {
    if (!reviewsEnabled() || !Array.isArray(productIds) || productIds.length === 0) {
        return Promise.resolve({});
    }

    var config = getReviewsConfig();
    var escapedIds = productIds
        .filter(function(id) { return id !== undefined && id !== null && String(id).trim() !== ''; })
        .map(function(id) { return '"' + String(id).replace(/"/g, '\\"') + '"'; });

    if (escapedIds.length === 0) {
        return Promise.resolve({});
    }

    return supabaseRequest(config.summaryView, {
        query: buildQueryString({
            select: 'product_id,review_count,average_rating',
            product_id: 'in.(' + escapedIds.join(',') + ')'
        })
    }).then(function(rows) {
        var map = {};
        (rows || []).forEach(function(row) {
            map[row.product_id] = row;
        });
        return map;
    }).catch(function() {
        return {};
    });
}

function applyProductGridRatings(summaryMap) {
    document.querySelectorAll('.products.luxury-grid .box').forEach(function(box) {
        var ratingHost = box.querySelector('.product-rating-slot');
        if (!ratingHost) return;
        var productId = box.dataset.id;
        var summary = summaryMap && summaryMap[productId] ? summaryMap[productId] : null;
        var markup = buildProductRatingMarkup(productId, summary);
        ratingHost.innerHTML = markup;
        ratingHost.style.display = markup ? '' : 'none';
    });
}

function fetchReviewSummary(productId) {
    var config = getReviewsConfig();
    return supabaseRequest(config.summaryView, {
        query: buildQueryString({
            select: 'product_id,review_count,average_rating',
            product_id: 'eq.' + productId,
            limit: '1'
        })
    }).then(function(rows) {
        if (!rows || rows.length === 0) {
            return {
                product_id: productId,
                review_count: 0,
                average_rating: 0
            };
        }
        return rows[0];
    });
}

function fetchReviewPage(productId, limit, offset) {
    var config = getReviewsConfig();
    return supabaseRequest(config.table, {
        query: buildQueryString({
            select: 'id,reviewer_name,rating,comment,created_at',
            product_id: 'eq.' + productId,
            status: 'eq.approved',
            order: 'created_at.desc',
            limit: String(limit),
            offset: String(offset)
        })
    });
}

function submitReview(productId, payload) {
    var config = getReviewsConfig();
    return supabaseRequest(config.table, {
        method: 'POST',
        prefer: 'return=representation',
        body: [{
            product_id: productId,
            reviewer_name: payload.reviewer_name,
            reviewer_phone: payload.reviewer_phone,
            rating: payload.rating,
            comment: payload.comment || null,
            status: 'approved'
        }]
    }).then(function(rows) {
        return rows && rows[0] ? rows[0] : null;
    });
}

function sendReviewEmailNotification(payload) {
    var body = new URLSearchParams({
        'form-name': 'product-review-email',
        product_id: payload.product_id,
        product_name: payload.product_name,
        reviewer_name: payload.reviewer_name,
        reviewer_phone: payload.reviewer_phone,
        rating: String(payload.rating),
        comment: payload.comment || ''
    }).toString();

    return fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body
    }).then(function(response) {
        if (!response.ok) {
            throw new Error('Review email notification failed');
        }
    });
}

function getReadableSupabaseError(error) {
    if (!error || !error.message) {
        return 'Could not submit your review right now.';
    }

    var message = String(error.message || '').trim();
    try {
        var parsed = JSON.parse(message);
        if (parsed && parsed.message) {
            return parsed.message;
        }
    } catch (e) {
    }

    if (message.length > 180) {
        return 'Could not submit your review right now.';
    }

    return message || 'Could not submit your review right now.';
}

function normalizePhoneValue(rawValue) {
    var raw = String(rawValue || '').trim();
    var hadLeadingPlus = raw.charAt(0) === '+';
    var digitsOnly = raw.replace(/\D/g, '');
    if (!digitsOnly) return '';
    return hadLeadingPlus ? ('+' + digitsOnly) : digitsOnly;
}

function fixInternalLinks() {
    var pages = ['products', 'cart', 'wishlist', 'checkout', 'product', 'thankyou', 'contact'];
    document.querySelectorAll('a[href]').forEach(function(a) {
        var href = a.getAttribute('href');
        if (!href) return;  
        if (href === '/') {
            a.setAttribute('href', 'index.html');
            return;
        }
        if (href.startsWith('/#')) {
            a.setAttribute('href', 'index.html' + href.substring(1));
            return;
        }
        for (var i = 0; i < pages.length; i++) {
            var page = pages[i];
            if (href === page || href.startsWith(page + '?')) {
                a.setAttribute('href', href.replace(page, page + '.html'));
                break;
            }
        }
    });
    document.querySelectorAll('[data-detail-url]').forEach(function(el) {
        var url = el.getAttribute('data-detail-url');
        if (!url) return;
        for (var i = 0; i < pages.length; i++) {
            var page = pages[i];
            if (url === page || url.startsWith(page + '?')) {
                el.setAttribute('data-detail-url', url.replace(page, page + '.html'));
                break;
            }
        }
    });
}

function parseCSVLine(line) {
    var result = [];
    var current = '';
    var inQuotes = false;
    for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (ch === '"') {
            if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current);
    return result;
}

function loadProductsFromCSV() {
    return fetch('products.csv')
        .then(function(response) {
            if (!response.ok) throw new Error('CSV not found');
            return response.text();
        })
        .then(function(csvText) {
            var lines = csvText.trim().split('\n');
            if (lines.length < 2) return;
            var headers = parseCSVLine(lines[0]);
            var catalog = {};
            for (var i = 1; i < lines.length; i++) {
                var values = parseCSVLine(lines[i]);
                if (values.length < headers.length) continue;
                var row = {};
                headers.forEach(function(h, idx) {
                    row[h.trim()] = (values[idx] || '').trim();
                });
                catalog[row.id] = {
                    id: row.id,
                    name: row.name,
                    price: parseFloat(row.price),
                    oldPrice: row.oldPrice ? parseFloat(row.oldPrice) : 0,
                    img: row.img,
                    images: row.images ? row.images.split('|') : [row.img],
                    description: row.description,
                    category: row.category || '',
                    badge: row.badge || '',
                    enabled: row.enabled !== '0'
                };
            }
            if (Object.keys(catalog).length > 0) {
                PRODUCT_CATALOG = catalog;
            }
        })
        .catch(function(e) {
            console.warn('Could not load products.csv, using default catalog.');
        });
}

function renderProductGrid() {
    var container = document.querySelector('.products.luxury-grid .box-container');
    if (!container) return;
    container.innerHTML = '';
    var products = Object.values(PRODUCT_CATALOG).filter(function(p) { return p.enabled !== false; });
    if (products.length === 0) {
        container.innerHTML = '<p>No products available.</p>';
        return;
    }
    products.forEach(function(product) {
        var badgeHTML = '';
        if (product.badge) {
            var label = product.badge.charAt(0).toUpperCase() + product.badge.slice(1);
            badgeHTML = '<span class="product-badge ' + product.badge + '">' + label + '</span>';
        }
        var box = document.createElement('div');
        box.className = 'box';
        box.dataset.id = product.id;
        box.dataset.name = product.name;
        box.dataset.price = product.price;
        box.dataset.img = product.img;
        box.dataset.category = product.category;
        box.dataset.detailUrl = 'product.html?id=' + product.id;
        box.tabIndex = 0;
        box.setAttribute('role', 'link');
        box.setAttribute('aria-label', 'View ' + product.name + ' details');
        box.innerHTML =
            badgeHTML +
            '<div class="images">' +
                '<img src="' + product.img + '" alt="' + product.name + '">' +
                '<button class="wishlist-btn" aria-label="Toggle wishlist for ' + product.name + '"><i class="far fa-heart"></i></button>' +
            '</div>' +
            '<div class="content">' +
                '<h3>' + product.name + '</h3>' +
                '<div class="price"><span class="current-price">EGP ' + product.price.toFixed(2) + '</span>' + (product.oldPrice > product.price ? '<span class="old-price">EGP ' + product.oldPrice.toFixed(2) + '</span>' : '') + '</div>' +
                '<div class="product-rating-slot">' + buildProductRatingMarkup(product.id, null) + '</div>' +
            '</div>' +
            '<div class="icons">' +
                '<a href="product.html?id=' + product.id + '" class="btn-cart product-view-link">View Details</a>' +
            '</div>';
        container.appendChild(box);
    });
}

function loadCart() {
    return JSON.parse(localStorage.getItem('cart')) || [];
}

function saveCart(cart) {
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
}

function loadWishlist() {
    return JSON.parse(localStorage.getItem('wishlist')) || [];
}

function saveWishlist(wishlist) {
    localStorage.setItem('wishlist', JSON.stringify(wishlist));
    updateWishlistCount();
}

function updateCartCount() {
    let cart = loadCart();
    let count = cart.reduce((sum, item) => sum + item.quantity, 0);
    let badge = document.getElementById('cart-count');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-flex' : 'none';
    }
}

function updateWishlistCount() {
    let wishlist = loadWishlist();
    let count = wishlist.length;
    let badge = document.getElementById('wishlist-count');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-flex' : 'none';
    }
}

let _lastCartSnapshot = null;
let _lastWishlistSnapshot = null;

function syncStoredState() {
    updateCartCount();
    updateWishlistCount();

    if (document.querySelector('.cart')) {
        let snap = JSON.stringify(loadCart());
        if (snap !== _lastCartSnapshot) {
            _lastCartSnapshot = snap;
            displayCart();
        }
    }

    if (document.querySelector('.wishlist')) {
        let snap = JSON.stringify(loadWishlist());
        if (snap !== _lastWishlistSnapshot) {
            _lastWishlistSnapshot = snap;
            displayWishlist();
        }
    }
}

function startStoredStateRefresh() {
    syncStoredState();

    window.addEventListener('pageshow', function(e) {
        if (e.persisted) {
            // Page restored from bfcache (back/forward button).
            // Reset snapshots so cart/wishlist always re-renders with fresh data.
            _lastCartSnapshot = null;
            _lastWishlistSnapshot = null;
        }
        syncStoredState();
    });
    window.addEventListener('focus', syncStoredState);

    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') {
            syncStoredState();
        }
    });

    window.addEventListener('storage', function(event) {
        if (!event.key || event.key === 'cart' || event.key === 'wishlist') {
            syncStoredState();
        }
    });

    window.setInterval(syncStoredState, 1000);
}

function addToCart(id, name, price, img, quantity = 1) {
    let cart = loadCart();
    let existingItem = cart.find(item => (item.key || item.id) === id);
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        cart.push({
            id,
            key: id,
            name,
            price: parseFloat(price),
            img,
            quantity
        });
    }
    saveCart(cart);
}

function addQuantity(id) {
    let cart = loadCart();
    let item = cart.find(cartItem => (cartItem.key || cartItem.id) === id);
    if (item) {
        item.quantity += 1;
    }
    saveCart(cart);
    displayCart();
}

function subtractQuantity(id) {
    let cart = loadCart();
    let item = cart.find(cartItem => (cartItem.key || cartItem.id) === id);
    if (item) {
        item.quantity -= 1;
        if (item.quantity <= 0) {
            cart = cart.filter(cartItem => (cartItem.key || cartItem.id) !== id);
        }
    }
    saveCart(cart);
    displayCart();
}

function displayCart() {
    let cart = loadCart();
    let cartContainer = document.querySelector('.cart-container');
    if (!cartContainer) return;

    cartContainer.innerHTML = '';

    if (cart.length === 0) {
        cartContainer.innerHTML = '<p>Your cart is currently empty. <a href="products.html">Shop now</a> to add your bouquet!</p>';
        return;
    }

    let total = 0;
    cart.forEach(item => {
        let itemDiv = document.createElement('div');
        itemDiv.className = 'cart-item';
        itemDiv.innerHTML = `
            <button class="cart-remove-btn" data-id="${item.key || item.id}" aria-label="Remove ${item.name} from cart">&times;</button>
            <img src="${item.img}" alt="${item.name}">
            <div class="item-details">
                <h3>${item.name}</h3>
                <p>Price: EGP ${item.price.toFixed(2)}</p>
            </div>
            <div class="qty-controls">
                <button class="qty-btn minus-btn" data-id="${item.key || item.id}">-</button>
                <span class="qty-display">${item.quantity}</span>
                <button class="qty-btn plus-btn" data-id="${item.key || item.id}">+</button>
            </div>
        `;
        cartContainer.appendChild(itemDiv);
        total += item.price * item.quantity;
    });

    let totalDiv = document.createElement('div');
    totalDiv.className = 'cart-total';
    totalDiv.innerHTML = `<h3>Total: EGP ${total.toFixed(2)}</h3>`;
    cartContainer.appendChild(totalDiv);

    let checkoutBtn = document.createElement('a');
    checkoutBtn.href = 'checkout.html';
    checkoutBtn.className = 'btn checkout-btn';
    checkoutBtn.innerHTML = '<i class="fas fa-bag-shopping"></i> Proceed to Checkout';
    cartContainer.appendChild(checkoutBtn);
}

function renderProductConfigPage() {
    let container = document.querySelector('.product-config-container');
    let pageTitle = document.getElementById('product-page-title');
    if (!container) return;

    let params = new URLSearchParams(window.location.search);
    let productId = params.get('id');
    let product = PRODUCT_CATALOG[productId];

    if (!product) {
        container.innerHTML = '<p>Product not found. <a href="products.html">Back to products</a></p>';
        return;
    }

    if (pageTitle) {
        pageTitle.textContent = product.name;
    }
    document.title = `${product.name} - J Flamme`;

    let galleryImages = product.images || [product.img];
    let discountPercentage = product.oldPrice && product.oldPrice > product.price
        ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
        : 0;
    let thumbnailMarkup = galleryImages.map((image, index) => `
        <button class="product-thumb${index === 0 ? ' active' : ''}" type="button" data-image="${image}" aria-label="View ${product.name} image ${index + 1}">
            <img src="${image}" alt="${product.name} thumbnail ${index + 1}">
        </button>
    `).join('');

    let pricingMarkup = `
        <div class="product-config-pricing">
            <p class="product-config-price">EGP ${product.price.toFixed(2)}</p>
            <div class="product-config-meta-price">
                ${product.oldPrice > product.price ? `<span class="product-config-old-price">EGP ${product.oldPrice.toFixed(2)}</span>` : ''}
                ${discountPercentage > 0 ? `<span class="product-config-discount">-${discountPercentage}%</span>` : ''}
            </div>
        </div>
    `;

    container.innerHTML = `
        <div class="product-config-card">
            <div class="product-config-media">
                <img id="product-main-image" src="${galleryImages[0]}" alt="${product.name}">
                <button id="config-wishlist-btn" class="config-wishlist-btn" type="button" aria-label="Add to wishlist">
                    <i class="${isInWishlist(product.id) ? 'fas' : 'far'} fa-heart"></i>
                </button>
                <div class="product-thumb-strip">${thumbnailMarkup}</div>
            </div>
            <div class="product-config-form">
                <div class="product-name-row">
                    <h2 class="product-config-name">${product.name}</h2>
                    <a href="#product-reviews" id="product-name-rating" class="product-media-rating-link" aria-label="View product reviews">
                        ${buildCompactRatingInnerMarkup(null)}
                    </a>
                </div>
                <p class="product-config-description">${product.description}</p>
                ${pricingMarkup}

                <div class="product-config-actions">
                    <div id="dynamic-cart-wrapper" class="dynamic-cart-wrapper"></div>
                    <button class="btn buy-now-btn" type="button" id="buy-now-btn"><i class="fas fa-bolt"></i> Buy Now</button>
                </div>
            </div>
        </div>

        <section class="product-reviews" id="product-reviews">
            <div class="product-reviews-head">
                <h2>Customer Reviews</h2>
                <button id="open-review-modal" class="review-open-btn" type="button"><i class="fas fa-plus"></i><span>Add Review</span></button>
            </div>

            <p id="reviews-status" class="reviews-status" hidden></p>
            <div id="reviews-list" class="reviews-list"></div>
            <div class="reviews-more">
                <button id="reviews-load-more" class="reviews-load-more-btn" type="button" hidden>+5 more</button>
            </div>

            <div id="review-modal" class="review-modal" hidden>
                <div class="review-modal-backdrop" data-close-review-modal="true"></div>
                <div class="review-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="review-modal-title">
                    <button id="close-review-modal" class="review-modal-close" type="button" aria-label="Close review form">&times;</button>
                    <form id="review-form" class="review-form review-form-modal">
                        <h3 id="review-modal-title">Leave a Review</h3>
                        <div class="review-form-row">
                            <div class="checkout-field">
                                <label for="reviewer_name">Your Name</label>
                                <input type="text" id="reviewer_name" name="reviewer_name" placeholder="Your Name" required maxlength="60">
                            </div>
                            <div class="checkout-field">
                                <label for="review_phone">Phone Number</label>
                                <input type="tel" id="review_phone" name="reviewer_phone" placeholder="Phone Number" required pattern="[0-9+]+" inputmode="tel">
                            </div>
                        </div>
                        <div class="review-form-row">
                            <div class="checkout-field">
                                <label for="review_rating">Rating</label>
                                <input type="hidden" id="review_rating" name="rating" value="">
                                <div class="review-rating-picker" role="group" aria-label="Select rating">
                                    <button type="button" class="review-rating-star" data-rating="1" aria-label="1 star"><i class="far fa-star"></i></button>
                                    <button type="button" class="review-rating-star" data-rating="2" aria-label="2 stars"><i class="far fa-star"></i></button>
                                    <button type="button" class="review-rating-star" data-rating="3" aria-label="3 stars"><i class="far fa-star"></i></button>
                                    <button type="button" class="review-rating-star" data-rating="4" aria-label="4 stars"><i class="far fa-star"></i></button>
                                    <button type="button" class="review-rating-star" data-rating="5" aria-label="5 stars"><i class="far fa-star"></i></button>
                                </div>
                                <p id="review-rating-text" class="review-rating-text">Tap stars to rate</p>
                            </div>
                        </div>
                        <div class="checkout-field">
                            <label for="review_comment">Review <span class="optional-label">(Optional)</span></label>
                            <textarea id="review_comment" name="comment" rows="4" maxlength="800" placeholder="Share what you liked about this product"></textarea>
                        </div>
                        <button type="submit" class="btn review-submit-btn">Submit Review</button>
                        <p id="review-form-message" class="review-form-message" hidden></p>
                    </form>
                </div>
            </div>
        </section>

        <div id="product-image-modal" class="product-image-modal" hidden>
            <div class="product-image-backdrop" data-close-image-modal="true"></div>
            <div class="product-image-dialog" role="dialog" aria-modal="true" aria-label="Expanded product image">
                <button id="close-image-modal" class="product-image-close" type="button" aria-label="Close image">&times;</button>
                <img id="expanded-product-image" src="${galleryImages[0]}" alt="${product.name}">
            </div>
        </div>
    `;

    let mainImage = document.getElementById('product-main-image');
    let cartWrapper = document.getElementById('dynamic-cart-wrapper');
    let productMediaRatingLink = document.getElementById('product-name-rating');
    let reviewsList = document.getElementById('reviews-list');
    let reviewsLoadMoreBtn = document.getElementById('reviews-load-more');
    let reviewsStatus = document.getElementById('reviews-status');
    let openReviewModalBtn = document.getElementById('open-review-modal');
    let reviewModal = document.getElementById('review-modal');
    let closeReviewModalBtn = document.getElementById('close-review-modal');
    let productImageModal = document.getElementById('product-image-modal');
    let closeImageModalBtn = document.getElementById('close-image-modal');
    let expandedProductImage = document.getElementById('expanded-product-image');
    let reviewForm = document.getElementById('review-form');
    let reviewFormMessage = document.getElementById('review-form-message');
    let reviewPhoneInput = document.getElementById('review_phone');
    let reviewRatingInput = document.getElementById('review_rating');
    let reviewRatingText = document.getElementById('review-rating-text');
    let reviewRatingStars = Array.from(document.querySelectorAll('.review-rating-star'));
    let reviewsConfig = getReviewsConfig();
    let reviewsBatchSize = Math.max(1, Number(reviewsConfig.pageSize) || 5);
    let reviewsState = {
        items: [],
        summary: {
            product_id: product.id,
            review_count: 0,
            average_rating: 0
        },
        hasMore: false,
        isLoadingMore: false
    };

    function setReviewsStatus(message, variant) {
        if (!reviewsStatus) return;
        if (!message) {
            reviewsStatus.hidden = true;
            reviewsStatus.textContent = '';
            reviewsStatus.className = 'reviews-status';
            return;
        }
        reviewsStatus.hidden = false;
        reviewsStatus.textContent = message;
        reviewsStatus.className = 'reviews-status' + (variant ? ' ' + variant : '');
    }

    function setReviewFormMessage(message, variant) {
        if (!reviewFormMessage) return;
        if (!message) {
            reviewFormMessage.hidden = true;
            reviewFormMessage.textContent = '';
            reviewFormMessage.className = 'review-form-message';
            return;
        }
        reviewFormMessage.hidden = false;
        reviewFormMessage.textContent = message;
        reviewFormMessage.className = 'review-form-message' + (variant ? ' ' + variant : '');
    }

    function renderReviewsState() {
        if (productMediaRatingLink) {
            productMediaRatingLink.innerHTML = buildCompactRatingInnerMarkup(reviewsState.summary);
        }

        if (reviewsList) {
            if (reviewsState.items.length === 0) {
                reviewsList.innerHTML = '';
            } else {
                reviewsList.innerHTML = reviewsState.items.map(renderReviewCard).join('');
            }
        }

        syncLoadMoreButton();
    }

    function updateHasMoreReviews() {
        var totalReviews = Number(reviewsState.summary.review_count) || 0;
        reviewsState.hasMore = reviewsState.items.length < totalReviews;
    }

    function getRemainingReviewsCount() {
        var totalReviews = Number(reviewsState.summary.review_count) || 0;
        var remaining = totalReviews - reviewsState.items.length;
        if (remaining < 0) return 0;
        return remaining;
    }

    function syncLoadMoreButton() {
        if (!reviewsLoadMoreBtn) return;
        var remaining = getRemainingReviewsCount();
        var nextChunk = Math.min(reviewsBatchSize, remaining);
        reviewsLoadMoreBtn.hidden = !reviewsState.hasMore;
        reviewsLoadMoreBtn.disabled = reviewsState.isLoadingMore;
        reviewsLoadMoreBtn.textContent = reviewsState.isLoadingMore
            ? 'Loading...'
            : ('+' + nextChunk + ' more');
    }

    function openReviewModal() {
        if (!reviewModal) return;
        reviewModal.hidden = false;
        document.body.classList.add('review-modal-open');
        setTimeout(function() {
            var firstInput = reviewForm ? reviewForm.querySelector('input, select, textarea') : null;
            if (firstInput) {
                firstInput.focus();
            }
        }, 0);
    }

    function closeReviewModal() {
        if (!reviewModal) return;
        reviewModal.hidden = true;
        document.body.classList.remove('review-modal-open');
        setReviewFormMessage('', '');
    }

    function openImageModal() {
        if (!productImageModal || !expandedProductImage || !mainImage) return;
        expandedProductImage.src = mainImage.src;
        expandedProductImage.alt = mainImage.alt;
        productImageModal.hidden = false;
        document.body.classList.add('product-image-modal-open');
    }

    function closeImageModal() {
        if (!productImageModal) return;
        productImageModal.hidden = true;
        document.body.classList.remove('product-image-modal-open');
    }

    function scrollToReviewsIfRequested() {
        if (window.location.hash !== '#product-reviews') return;
        setTimeout(function() {
            var reviewsSection = document.getElementById('product-reviews');
            if (reviewsSection) {
                reviewsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 120);
    }

    function setReviewRating(value) {
        var rating = Number(value) || 0;
        if (reviewRatingInput) {
            reviewRatingInput.value = rating > 0 ? String(rating) : '';
        }
        reviewRatingStars.forEach(function(button) {
            var starValue = Number(button.getAttribute('data-rating')) || 0;
            var icon = button.querySelector('i');
            var isActive = starValue <= rating && rating > 0;
            button.classList.toggle('active', isActive);
            if (icon) {
                icon.classList.toggle('fas', isActive);
                icon.classList.toggle('far', !isActive);
            }
        });
        if (reviewRatingText) {
            reviewRatingText.textContent = rating > 0 ? (rating + ' of 5 selected') : 'Tap stars to rate';
        }
    }

    function saveInitialReviewCache() {
        saveReviewsCache(product.id, {
            summary: reviewsState.summary,
            reviews: reviewsState.items.slice()
        });
    }

    function hydrateFromCache(cacheEntry) {
        if (!cacheEntry || !cacheEntry.data) return false;
        if (Date.now() - cacheEntry.timestamp > reviewsConfig.cacheTTLms) return false;
        reviewsState.summary = cacheEntry.data.summary || reviewsState.summary;
        reviewsState.items = Array.isArray(cacheEntry.data.reviews) ? cacheEntry.data.reviews : [];
        updateHasMoreReviews();
        renderReviewsState();
        setReviewsStatus('', '');
        return true;
    }

    function refreshReviewsFromServer(showLoadingState) {
        if (showLoadingState) {
            setReviewsStatus('Loading reviews...', '');
        }

        return Promise.all([
            fetchReviewSummary(product.id),
            fetchReviewPage(product.id, reviewsBatchSize, 0)
        ]).then(function(results) {
            reviewsState.summary = results[0];
            reviewsState.items = results[1] || [];
            updateHasMoreReviews();
            renderReviewsState();
            setReviewsStatus('', '');
            saveInitialReviewCache();
        });
    }

    function loadMoreReviews() {
        if (!reviewsEnabled() || reviewsState.isLoadingMore || !reviewsState.hasMore) {
            return;
        }

        reviewsState.isLoadingMore = true;
        syncLoadMoreButton();

        fetchReviewPage(product.id, reviewsBatchSize, reviewsState.items.length).then(function(nextReviews) {
            var rows = Array.isArray(nextReviews) ? nextReviews : [];
            if (rows.length === 0) {
                reviewsState.hasMore = false;
                return;
            }

            var existing = {};
            reviewsState.items.forEach(function(review) {
                if (review && review.id !== undefined && review.id !== null) {
                    existing[String(review.id)] = true;
                }
            });

            rows.forEach(function(review) {
                var reviewId = review && review.id !== undefined && review.id !== null
                    ? String(review.id)
                    : '';
                if (!reviewId || !existing[reviewId]) {
                    reviewsState.items.push(review);
                    if (reviewId) {
                        existing[reviewId] = true;
                    }
                }
            });

            updateHasMoreReviews();
            renderReviewsState();
            saveInitialReviewCache();
        }).catch(function() {
            setReviewsStatus('Could not load more reviews right now.', 'error');
        }).finally(function() {
            reviewsState.isLoadingMore = false;
            syncLoadMoreButton();
        });
    }

    function loadInitialReviews() {
        if (!reviewsEnabled()) {
            setReviewsStatus('Add your Supabase anon key in reviews-config.js to enable live reviews.', 'error');
            if (reviewForm) {
                Array.from(reviewForm.elements).forEach(function(field) {
                    field.disabled = true;
                });
            }
            return;
        }

        var cached = loadReviewsCache(product.id);
        var hasValidCache = hydrateFromCache(cached);

        refreshReviewsFromServer(!hasValidCache).catch(function() {
            setReviewsStatus('Could not load reviews right now.', 'error');
        });
    }

    function getCartQuantity() {
        let cart = loadCart();
        let item = cart.find(ci => ci.id === product.id || ci.key === product.id);
        return item ? item.quantity : 0;
    }

    function renderDynamicCartButton() {
        let qty = getCartQuantity();
        if (qty > 0) {
            cartWrapper.innerHTML = `
                <div class="dynamic-cart-qty">
                    <button class="dynamic-cart-btn dynamic-cart-minus" type="button" aria-label="Decrease quantity">\u2212</button>
                    <span class="dynamic-cart-count">${qty}</span>
                    <button class="dynamic-cart-btn dynamic-cart-plus" type="button" aria-label="Increase quantity">+</button>
                </div>
            `;
            cartWrapper.querySelector('.dynamic-cart-minus').addEventListener('click', function() {
                let cart = loadCart();
                let item = cart.find(ci => ci.id === product.id || ci.key === product.id);
                if (item) {
                    item.quantity -= 1;
                    if (item.quantity <= 0) {
                        cart = cart.filter(ci => (ci.key || ci.id) !== product.id);
                    }
                    saveCart(cart);
                }
                renderDynamicCartButton();
            });
            cartWrapper.querySelector('.dynamic-cart-plus').addEventListener('click', function() {
                let cart = loadCart();
                let item = cart.find(ci => ci.id === product.id || ci.key === product.id);
                if (item) {
                    item.quantity += 1;
                    saveCart(cart);
                }
                renderDynamicCartButton();
            });
        } else {
            cartWrapper.innerHTML = `
                <button class="btn dynamic-add-to-cart"><i class="fas fa-shopping-cart"></i> Add to Cart</button>
            `;
            cartWrapper.querySelector('.dynamic-add-to-cart').addEventListener('click', function() {
                addToCart(product.id, product.name, product.price, product.img, 1);
                this.innerHTML = '<i class="fas fa-check"></i> Item Added to Cart';
                this.disabled = true;
                this.classList.add('added-feedback');
                setTimeout(renderDynamicCartButton, 700);
            });
        }
    }

    renderDynamicCartButton();

    let buyNowBtn = document.getElementById('buy-now-btn');
    if (buyNowBtn) {
        buyNowBtn.addEventListener('click', function() {
            let cart = loadCart();
            let existing = cart.find(ci => ci.id === product.id || ci.key === product.id);
            if (!existing) {
                addToCart(product.id, product.name, product.price, product.img, 1);
            }
            window.location.href = 'checkout.html';
        });
    }

    document.querySelectorAll('.product-thumb').forEach(button => {
        button.addEventListener('click', function() {
            let selectedImage = this.dataset.image;
            mainImage.src = selectedImage;
            if (expandedProductImage) {
                expandedProductImage.src = selectedImage;
                expandedProductImage.alt = mainImage.alt;
            }

            document.querySelectorAll('.product-thumb').forEach(thumb => {
                thumb.classList.remove('active');
            });
            this.classList.add('active');
        });
    });

    if (mainImage) {
        mainImage.addEventListener('click', openImageModal);
    }

    if (closeImageModalBtn) {
        closeImageModalBtn.addEventListener('click', closeImageModal);
    }

    if (productImageModal) {
        productImageModal.addEventListener('click', function(event) {
            if (event.target && event.target.getAttribute('data-close-image-modal') === 'true') {
                closeImageModal();
            }
        });
    }

    let wishlistBtn = document.getElementById('config-wishlist-btn');
    if (wishlistBtn) {
        if (isInWishlist(product.id)) {
            wishlistBtn.classList.add('active');
        }
        wishlistBtn.addEventListener('click', function() {
            let added = toggleWishlist({
                id: product.id,
                name: product.name,
                price: product.price,
                img: product.img
            });
            this.classList.toggle('active', added);
            let icon = this.querySelector('i');
            icon.classList.toggle('fas', added);
            icon.classList.toggle('far', !added);
            showToast(added ? 'Added to wishlist.' : 'Removed from wishlist.');
        });
    }

    if (openReviewModalBtn) {
        openReviewModalBtn.addEventListener('click', openReviewModal);
    }

    if (closeReviewModalBtn) {
        closeReviewModalBtn.addEventListener('click', closeReviewModal);
    }

    if (reviewModal) {
        reviewModal.addEventListener('click', function(event) {
            if (event.target && event.target.getAttribute('data-close-review-modal') === 'true') {
                closeReviewModal();
            }
        });
    }

    if (reviewsLoadMoreBtn) {
        reviewsLoadMoreBtn.addEventListener('click', loadMoreReviews);
    }

    reviewRatingStars.forEach(function(button) {
        button.addEventListener('click', function() {
            setReviewRating(button.getAttribute('data-rating'));
        });
    });

    if (reviewPhoneInput) {
        reviewPhoneInput.addEventListener('input', function() {
            this.value = normalizePhoneValue(this.value);
        });
    }

    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && reviewModal && !reviewModal.hidden) {
            closeReviewModal();
        }
        if (event.key === 'Escape' && productImageModal && !productImageModal.hidden) {
            closeImageModal();
        }
    });

    if (reviewForm) {
        reviewForm.addEventListener('submit', function(event) {
            event.preventDefault();
            if (!reviewsEnabled()) {
                setReviewFormMessage('Add your Supabase anon key in reviews-config.js first.', 'error');
                return;
            }
            if (!reviewForm.checkValidity()) {
                reviewForm.reportValidity();
                return;
            }

            var formData = new FormData(reviewForm);
            var payload = {
                product_id: product.id,
                product_name: product.name,
                reviewer_name: String(formData.get('reviewer_name') || '').trim(),
                reviewer_phone: normalizePhoneValue(formData.get('reviewer_phone')),
                rating: Number(formData.get('rating')),
                comment: String(formData.get('comment') || '').trim()
            };

            if (!payload.reviewer_phone) {
                setReviewFormMessage('Phone number is required.', 'error');
                return;
            }

            if (!/^\+?[0-9]{6,19}$/.test(payload.reviewer_phone)) {
                setReviewFormMessage('Phone number must be numbers with optional + at the start.', 'error');
                return;
            }

            if (!payload.rating || payload.rating < 1 || payload.rating > 5) {
                setReviewFormMessage('Please select a star rating.', 'error');
                return;
            }

            reviewForm.querySelector('.review-submit-btn').disabled = true;
            setReviewFormMessage('Submitting review...', '');

            submitReview(product.id, payload).then(function(insertedReview) {
                if (insertedReview) {
                    var currentCount = Number(reviewsState.summary.review_count) || 0;
                    var currentAverage = Number(reviewsState.summary.average_rating) || 0;
                    var nextCount = currentCount + 1;
                    var nextAverage = ((currentAverage * currentCount) + payload.rating) / nextCount;
                    var visibleCount = Math.max(reviewsState.items.length, reviewsBatchSize);

                    reviewsState.summary = {
                        product_id: product.id,
                        review_count: nextCount,
                        average_rating: Math.round(nextAverage * 10) / 10
                    };
                    reviewsState.items = [insertedReview].concat(reviewsState.items).slice(0, visibleCount);
                    updateHasMoreReviews();
                    renderReviewsState();
                    saveInitialReviewCache();
                }
                reviewForm.reset();
                setReviewRating(0);
                showToast('Review submitted successfully.');
                closeReviewModal();

                // Email notifications are best-effort and should not block UX.
                return sendReviewEmailNotification(payload).catch(function() {
                });
            }).catch(function(error) {
                setReviewFormMessage(getReadableSupabaseError(error), 'error');
            }).finally(function() {
                reviewForm.querySelector('.review-submit-btn').disabled = false;
            });
        });
    }

    setReviewRating(0);

    loadInitialReviews();
    scrollToReviewsIfRequested();
}

function isInWishlist(id) {
    let wishlist = loadWishlist();
    return wishlist.some(item => item.id === id);
}

function setWishlistButtonState(button, isActive) {
    if (!button) return;
    let icon = button.querySelector('i');
    button.classList.toggle('active', isActive);
    if (icon) {
        icon.classList.toggle('fas', isActive);
        icon.classList.toggle('far', !isActive);
    }
}

function syncWishlistButtons() {
    document.querySelectorAll('.wishlist-btn').forEach(button => {
        let box = button.closest('.box');
        if (!box) return;
        setWishlistButtonState(button, isInWishlist(box.dataset.id));
    });
}

function toggleWishlist(product) {
    let wishlist = loadWishlist();
    let index = wishlist.findIndex(item => item.id === product.id);
    let added = false;

    if (index > -1) {
        wishlist.splice(index, 1);
    } else {
        wishlist.push({
            id: product.id,
            name: product.name,
            price: parseFloat(product.price),
            img: product.img
        });
        added = true;
    }

    saveWishlist(wishlist);
    return added;
}

function removeWishlistItem(id) {
    let wishlist = loadWishlist().filter(item => item.id !== id);
    saveWishlist(wishlist);
    displayWishlist();
    syncWishlistButtons();
}

function displayWishlist() {
    let wishlist = loadWishlist();
    let wishlistContainer = document.querySelector('.wishlist-container');
    if (!wishlistContainer) return;

    wishlistContainer.innerHTML = '';

    if (wishlist.length === 0) {
        wishlistContainer.innerHTML = '<p>Your wishlist is currently empty. <a href="products.html">Browse products</a> to add favorites.</p>';
        return;
    }

    wishlist.forEach(item => {
        let itemDiv = document.createElement('div');
        itemDiv.className = 'wishlist-item cart-item';
        itemDiv.innerHTML = `
            <img src="${item.img}" alt="${item.name}">
            <div class="item-details">
                <h3>${item.name}</h3>
                <p>Price: EGP ${item.price.toFixed(2)}</p>
            </div>
            <div class="wishlist-actions qty-controls wishlist-controls">
                <button class="qty-btn wishlist-add-cart-btn" data-id="${item.id}">Add to Cart</button>
                <button class="qty-btn wishlist-remove-btn" data-id="${item.id}">Remove from Wishlist</button>
            </div>
        `;
        wishlistContainer.appendChild(itemDiv);
    });
}

function showToast(message) {
    let toast = document.querySelector('.toast');
    if (!toast) return;
    toast.textContent = message;
    toast.style.display = 'block';
    toast.classList.add('toast-show');
    setTimeout(() => {
        toast.classList.remove('toast-show');
        toast.style.display = 'none';
    }, 2500);
}

function renderCheckoutPage() {
    let cart = loadCart();
    let summaryDiv = document.getElementById('checkout-summary');
    let orderField = document.getElementById('order_summary');
    let form = document.getElementById('checkout-form');

    if (!summaryDiv || !orderField) return;

    if (cart.length === 0) {
        summaryDiv.innerHTML = '<h2>Order Summary</h2><p>Your cart is empty. <a href="products.html">Shop now</a></p>';
        if (form) {
            form.querySelector('.checkout-submit-btn').disabled = true;
        }
        return;
    }

    let subtotal = 0;
    let summaryHTML = '<h2>Order Summary</h2><div class="checkout-items">';
    let orderText = '';

    cart.forEach(function(item) {
        let lineTotal = item.price * item.quantity;
        subtotal += lineTotal;
        summaryHTML += `
            <div class="checkout-item">
                <img src="${item.img}" alt="${item.name}">
                <div class="checkout-item-info">
                    <h3>${item.name}</h3>
                    <p>Qty: ${item.quantity} &times; EGP ${item.price.toFixed(2)}</p>
                </div>
                <span class="checkout-item-total">EGP ${lineTotal.toFixed(2)}</span>
            </div>
        `;
        orderText += `Product: ${item.name}\nQty: ${item.quantity}\nPrice: EGP ${lineTotal.toFixed(2)}\n\n`;
    });

    summaryHTML += '</div>';

    summaryHTML += `
        <div class="promo-section">
            <div class="promo-input-row">
                <input type="text" id="promo_code" placeholder="Promo code" autocomplete="off">
                <button type="button" id="apply-promo" class="btn promo-apply-btn">Apply</button>
            </div>
            <p id="promo-message" class="promo-message"></p>
        </div>
    `;

    summaryHTML += '<div id="checkout-totals" class="checkout-total"></div>';
    summaryDiv.innerHTML = summaryHTML;

    let currentDiscount = 0;
    let currentPromoCode = '';

    function updateTotals() {
        let totalsDiv = document.getElementById('checkout-totals');
        let discountAmount = subtotal * (currentDiscount / 100);
        let finalTotal = subtotal - discountAmount;
        let totalsHTML = '';
        if (currentDiscount > 0) {
            totalsHTML += '<div class="checkout-subtotal"><span>Subtotal:</span> <span>EGP ' + subtotal.toFixed(2) + '</span></div>';
            totalsHTML += '<div class="checkout-discount"><span>Discount (' + currentPromoCode + ' &ndash; ' + currentDiscount + '%):</span> <span>-EGP ' + discountAmount.toFixed(2) + '</span></div>';
        }
        totalsHTML += '<h3>Total: EGP ' + finalTotal.toFixed(2) + '</h3>';
        totalsDiv.innerHTML = totalsHTML;

        let updatedOrderText = orderText;
        if (currentDiscount > 0) {
            updatedOrderText += 'Promo Code: ' + currentPromoCode + ' (' + currentDiscount + '% off)\n';
            updatedOrderText += 'Discount: -EGP ' + discountAmount.toFixed(2) + '\n';
        }
        updatedOrderText += 'Total: EGP ' + finalTotal.toFixed(2);
        orderField.value = updatedOrderText;
    }

    updateTotals();

    let applyBtn = document.getElementById('apply-promo');
    let promoInput = document.getElementById('promo_code');
    let promoMessage = document.getElementById('promo-message');

    if (applyBtn) {
        applyBtn.addEventListener('click', function() {
            let code = promoInput.value.trim().toUpperCase();
            if (!code) {
                promoMessage.textContent = 'Please enter a promo code.';
                promoMessage.className = 'promo-message error';
                return;
            }
            if (PROMO_CODES[code]) {
                currentDiscount = PROMO_CODES[code].discount;
                currentPromoCode = code;
                promoMessage.textContent = PROMO_CODES[code].label + ' applied!';
                promoMessage.className = 'promo-message success';
                promoInput.disabled = true;
                applyBtn.disabled = true;
                applyBtn.textContent = 'Applied';
                updateTotals();
            } else {
                promoMessage.textContent = 'Invalid promo code.';
                promoMessage.className = 'promo-message error';
            }
        });
    }

    if (form) {
        let phoneInput = document.getElementById('phone');
        if (phoneInput) {
            phoneInput.addEventListener('input', function() {
                this.value = this.value.replace(/[^0-9+]/g, '');
            });
        }

        form.querySelectorAll('.checkout-field input[required]').forEach(function(input) {
            let star = input.closest('.checkout-field').querySelector('.required-star');
            if (!star) return;
            function toggleStar() {
                star.classList.toggle('hidden', input.value.trim() !== '');
            }
            toggleStar();
            input.addEventListener('input', toggleStar);
        });

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }
            let formData = new FormData(form);
            fetch('/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(formData).toString()
            }).then(function() {
                localStorage.removeItem('cart');
                updateCartCount();
                window.location.href = 'thankyou.html';
            }).catch(function() {
                alert('There was an error submitting your order. Please try again.');
            });
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    fixInternalLinks();

    let menuToggler = document.getElementById('toggler');
    if (menuToggler) {
        document.querySelectorAll('header .navbar a').forEach(link => {
            link.addEventListener('click', function() {
                menuToggler.checked = false;
            });
        });
    }

    startStoredStateRefresh();

    if (!document.querySelector('.toast')) {
        let toast = document.createElement('div');
        toast.className = 'toast';
        toast.style.display = 'none';
        document.body.appendChild(toast);
    }

    function initProductsPage() {
        let productsSection = document.querySelector('.products.luxury-grid');
        if (!productsSection) return;

        renderProductGrid();

        function refreshProductRatings() {
            var productIds = Object.values(PRODUCT_CATALOG)
                .filter(function(p) { return p.enabled !== false; })
                .map(function(p) { return p.id; });
            fetchReviewSummariesForProducts(productIds).then(function(summaryMap) {
                applyProductGridRatings(summaryMap);
            });
        }

        refreshProductRatings();

        window.addEventListener('pageshow', function() {
            if (!document.querySelector('.products.luxury-grid')) return;
            refreshProductRatings();
        });

        window.addEventListener('focus', function() {
            if (!document.querySelector('.products.luxury-grid')) return;
            refreshProductRatings();
        });

        document.addEventListener('visibilitychange', function() {
            if (document.visibilityState !== 'visible') return;
            if (!document.querySelector('.products.luxury-grid')) return;
            refreshProductRatings();
        });

        // Build dynamic category map from products
        let categoryMap = {};
        Object.values(PRODUCT_CATALOG).forEach(function(p) {
            if (p.enabled !== false && p.category) {
                categoryMap[p.category.toLowerCase()] = p.category.charAt(0).toUpperCase() + p.category.slice(1);
            }
        });

        // Render dynamic filter links
        let filterContainer = document.getElementById('products-filter');
        if (filterContainer) {
            filterContainer.innerHTML = '<a class="products-filter-link" data-category="all" href="products.html">All</a>';
            Object.keys(categoryMap).forEach(function(cat) {
                let a = document.createElement('a');
                a.className = 'products-filter-link';
                a.dataset.category = cat;
                a.href = 'products.html?category=' + encodeURIComponent(cat);
                a.textContent = categoryMap[cat];
                filterContainer.appendChild(a);
            });
        }

        let params = new URLSearchParams(window.location.search);
        let category = params.get('category');
        let heading = productsSection.querySelector('.heading');
        let filterLinks = productsSection.querySelectorAll('.products-filter-link');
        let defaultHeading = 'Candle & Flower <span>Collection</span>';

        let activeCategory = category && categoryMap[category] ? category : 'all';

        productsSection.querySelectorAll('.box-container .box').forEach(box => {
            box.style.display = activeCategory === 'all' || box.dataset.category === activeCategory ? '' : 'none';
        });

        if (heading) {
            heading.innerHTML = activeCategory === 'all'
                ? defaultHeading
                : `${categoryMap[activeCategory]} <span>Collection</span>`;
        }

        filterLinks.forEach(link => {
            let linkCategory = link.dataset.category || 'all';
            link.classList.toggle('active', linkCategory === activeCategory);
            if (linkCategory === activeCategory) {
                link.setAttribute('aria-current', 'page');
            } else {
                link.removeAttribute('aria-current');
            }
        });

        if (category && !categoryMap[category]) {
            window.history.replaceState({}, '', 'products.html');
        }

        document.querySelectorAll('.products.luxury-grid .box[data-detail-url]').forEach(box => {
            box.addEventListener('click', function(e) {
                if (e.target.closest('.wishlist-btn') || e.target.closest('.product-view-link') || e.target.closest('.product-rating-link')) {
                    return;
                }
                window.location.href = this.dataset.detailUrl;
            });
            box.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    window.location.href = this.dataset.detailUrl;
                }
            });
        });

        document.querySelectorAll('.wishlist-btn').forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                let box = this.closest('.box');
                if (!box) return;
                let product = {
                    id: box.dataset.id,
                    name: box.dataset.name,
                    price: box.dataset.price,
                    img: box.dataset.img
                };
                let added = toggleWishlist(product);
                setWishlistButtonState(this, added);
                showToast(added ? 'Added to wishlist.' : 'Removed from wishlist.');
            });
        });

        syncWishlistButtons();
    }

    loadProductsFromCSV().then(function() {
        initProductsPage();

        if (document.querySelector('.product-config')) {
            renderProductConfigPage();
        }

        if (document.querySelector('.checkout')) {
            renderCheckoutPage();
        }
    });

    if (document.querySelector('.thankyou')) {
        localStorage.removeItem('cart');
        updateCartCount();
        let countdown = 5;
        let countdownEl = document.getElementById('countdown');
        let redirectCancelled = false;
        let homeBtn = document.getElementById('thankyou-home-btn');
        if (homeBtn) {
            homeBtn.addEventListener('click', function() {
                redirectCancelled = true;
            });
        }
        let timer = setInterval(function() {
            if (redirectCancelled) { clearInterval(timer); return; }
            countdown--;
            if (countdownEl) countdownEl.textContent = countdown;
            if (countdown <= 0) {
                clearInterval(timer);
                window.location.href = 'products.html';
            }
        }, 1000);
    }

    document.addEventListener('click', function(e) {
        let plusButton = e.target.closest('.plus-btn');
        if (plusButton) {
            e.preventDefault();
            addQuantity(plusButton.dataset.id);
        }

        let minusButton = e.target.closest('.minus-btn');
        if (minusButton) {
            e.preventDefault();
            subtractQuantity(minusButton.dataset.id);
        }

        let cartRemoveBtn = e.target.closest('.cart-remove-btn');
        if (cartRemoveBtn) {
            e.preventDefault();
            let id = cartRemoveBtn.dataset.id;
            let cart = loadCart().filter(ci => (ci.key || ci.id) !== id);
            saveCart(cart);
            displayCart();
            showToast('Item removed from cart.');
        }

        let removeWishlistButton = e.target.closest('.wishlist-remove-btn');
        if (removeWishlistButton) {
            e.preventDefault();
            removeWishlistItem(removeWishlistButton.dataset.id);
            showToast('Removed from wishlist.');
        }

        let addWishlistToCartButton = e.target.closest('.wishlist-add-cart-btn');
        if (addWishlistToCartButton) {
            e.preventDefault();
            let wishlist = loadWishlist();
            let item = wishlist.find(wishlistItem => wishlistItem.id === addWishlistToCartButton.dataset.id);
            if (!item) return;
            addToCart(item.id, item.name, item.price, item.img);
            showToast('Item added to cart.');
        }
    });
});