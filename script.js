// Cart and wishlist functionality using localStorage

const PRODUCT_CATALOG = {
    '1': {
        id: '1',
        name: 'Rose Glow Bouquet',
        price: 15.99,
        oldPrice: 20.00,
        img: './images/45.jpg',
        images: ['./images/45.jpg', './images/44.jpg', './images/50.jpg'],
        description: 'A romantic bouquet design with soft floral tones, hand-finished for elegant gifting moments.'
    },
    '2': {
        id: '2',
        name: 'Blush Petal Box',
        price: 15.99,
        oldPrice: 20.00,
        img: './images/12.jpg',
        images: ['./images/12.jpg', './images/13.jpg', './images/14.jpg'],
        description: 'A compact premium arrangement styled in a keepsake box with a delicate blush aesthetic.'
    },
    '3': {
        id: '3',
        name: 'Bloom Candle Tray',
        price: 15.99,
        oldPrice: 20.00,
        img: './images/4.jpg',
        images: ['./images/4.jpg', './images/5.jpg', './images/6.jpg'],
        description: 'A tray presentation combining candle artistry and floral detailing for modern home decor.'
    },
    '4': {
        id: '4',
        name: 'Velvet Rose Set',
        price: 15.99,
        oldPrice: 20.00,
        img: './images/102.jpg',
        images: ['./images/102.jpg', './images/101.jpg', './images/105.jpg'],
        description: 'A rich velvet-inspired arrangement with layered petals that feels refined and luxurious.'
    },
    '5': {
        id: '5',
        name: 'Romance Bloom Vase',
        price: 15.99,
        oldPrice: 20.00,
        img: './images/100.jpg',
        images: ['./images/100.jpg', './images/99.jpg', './images/88.jpg'],
        description: 'A graceful vase composition designed for anniversaries, celebrations, and heartfelt gifts.'
    },
    '6': {
        id: '6',
        name: 'Sweet Peony Bundle',
        price: 15.99,
        oldPrice: 20.00,
        img: './images/99.jpg',
        images: ['./images/99.jpg', './images/88.jpg', './images/77.jpg'],
        description: 'A soft peony-forward bundle with premium wrapping and a timeless romantic style.'
    }
};

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

function syncStoredState() {
    updateCartCount();
    updateWishlistCount();

    if (document.querySelector('.cart')) {
        displayCart();
    }

    if (document.querySelector('.wishlist')) {
        displayWishlist();
    }
}

function startStoredStateRefresh() {
    syncStoredState();

    window.addEventListener('pageshow', syncStoredState);
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

function addToCart(id, name, price, img, quantity = 1, options = null) {
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

    let whatsappBtn = document.createElement('a');
    let whatsappMessage = `Hello! I'd like to order:\n`;
    cart.forEach(item => {
        whatsappMessage += `${item.name} - Quantity: ${item.quantity} - EGP ${item.price.toFixed(2)} each\n`;
    });
    whatsappMessage += `Total: EGP ${total.toFixed(2)}\nThank you!`;

    let whatsappNumber = '201010294098';
    let whatsappLink = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;
    whatsappBtn.href = whatsappLink;
    whatsappBtn.className = 'btn whatsapp-btn';
    whatsappBtn.innerHTML = '<i class="fab fa-whatsapp"></i> Send order';
    whatsappBtn.target = '_blank';
    whatsappBtn.rel = 'noopener noreferrer';
    whatsappBtn.addEventListener('click', function() {
        localStorage.removeItem('cart');
        updateCartCount();
        displayCart();
        showToast('Order sent! Cart cleared.');
    });
    cartContainer.appendChild(whatsappBtn);
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
                <span class="product-config-old-price">EGP ${product.oldPrice.toFixed(2)}</span>
                <span class="product-config-discount">-${discountPercentage}%</span>
            </div>
        </div>
    `;

    container.innerHTML = `
        <div class="product-config-card">
            <div class="product-config-media">
                <img id="product-main-image" src="${galleryImages[0]}" alt="${product.name}">
                <div class="product-thumb-strip">${thumbnailMarkup}</div>
            </div>
            <div class="product-config-form">
                <p class="product-config-description">${product.description}</p>
                ${pricingMarkup}

                <div class="product-config-actions">
                    <div class="config-qty-controls">
                        <button id="config-qty-minus" class="config-qty-btn" type="button">-</button>
                        <span id="config-qty-value" class="config-qty-value">1</span>
                        <button id="config-qty-plus" class="config-qty-btn" type="button">+</button>
                    </div>

                    <button id="add-configured-product" class="btn">Add to Cart</button>
                </div>
            </div>
        </div>
    `;

    let quantity = 1;
    let qtyValue = document.getElementById('config-qty-value');
    let minusButton = document.getElementById('config-qty-minus');
    let plusButton = document.getElementById('config-qty-plus');
    let mainImage = document.getElementById('product-main-image');

    function renderQuantity() {
        qtyValue.textContent = quantity;
    }

    document.querySelectorAll('.product-thumb').forEach(button => {
        button.addEventListener('click', function() {
            let selectedImage = this.dataset.image;
            mainImage.src = selectedImage;

            document.querySelectorAll('.product-thumb').forEach(thumb => {
                thumb.classList.remove('active');
            });
            this.classList.add('active');
        });
    });

    minusButton.addEventListener('click', function() {
        if (quantity > 1) {
            quantity -= 1;
            renderQuantity();
        }
    });

    plusButton.addEventListener('click', function() {
        quantity += 1;
        renderQuantity();
    });

    let addButton = document.getElementById('add-configured-product');
    addButton.addEventListener('click', function() {
        addToCart(
            product.id,
            product.name,
            product.price,
            product.img,
            quantity
        );
        showToast('Item added to cart.');
    });
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

document.addEventListener('DOMContentLoaded', function() {
    let menuToggler = document.getElementById('toggler');
    if (menuToggler) {
        document.querySelectorAll('header .navbar a').forEach(link => {
            link.addEventListener('click', function() {
                menuToggler.checked = false;
            });
        });
    }

    startStoredStateRefresh();

    let productsSection = document.querySelector('.products.luxury-grid');
    if (productsSection) {
        let params = new URLSearchParams(window.location.search);
        let category = params.get('category');
        let heading = productsSection.querySelector('.heading');
        let filterLinks = productsSection.querySelectorAll('.products-filter-link');
        let defaultHeading = 'Candle & Flower <span>Collection</span>';
        let categoryMap = {
            jars: 'Jars',
            bouquets: 'Bouquets'
        };

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
    }

    if (document.querySelector('.product-config')) {
        renderProductConfigPage();
    }

    if (!document.querySelector('.toast')) {
        let toast = document.createElement('div');
        toast.className = 'toast';
        toast.style.display = 'none';
        document.body.appendChild(toast);
    }

    document.querySelectorAll('.products.luxury-grid .box[data-detail-url]').forEach(box => {
        box.addEventListener('click', function(e) {
            if (e.target.closest('.wishlist-btn') || e.target.closest('.product-view-link')) {
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

window.addEventListener('pageshow', function() {
    syncStoredState();
});

document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
        syncStoredState();
    }
});