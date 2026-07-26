(function() {
    'use strict';

    // ============================================================
    // CONFIGURATION
    // ============================================================
    const CONFIG = {
        PASSWORD: '408408$$',
        MAX_PAGES: 100,
        STORAGE_KEY: 'appixo_book_pages',
        META_KEY: 'appixo_book_meta'
    };

    // ============================================================
    // TRADUCTIONS
    // ============================================================
    const TRANSLATIONS = {
        fr: {
            page: 'Page',
            noPages: 'Aucune page',
            prev: 'Préc.',
            next: 'Suiv.',
            print: 'Imprimer',
            download: 'Téléch.',
            add: 'Ajouter',
            save: 'Sauver',
            lock: 'Verrouiller',
            unlock: 'Déverrouiller',
            noImage: 'Aucune image sur cette page',
            dropHint: 'Ajoutez une image dans le dossier images/',
            wrongPassword: 'Mot de passe incorrect !',
            unlocked: 'Mode édition activé',
            locked: 'Mode lecture seule',
            pageAdded: 'Page ajoutée',
            saved: 'Sauvegarde effectuée',
            saveError: 'Erreur lors de la sauvegarde',
            clickToZoom: 'Cliquez pour agrandir',
            noPage: 'Aucune page à télécharger',
            maxPages: 'Nombre maximum de pages atteint (100)',
            downloadStarted: 'Téléchargement démarré'
        },
        en: {
            page: 'Page',
            noPages: 'No pages',
            prev: 'Prev',
            next: 'Next',
            print: 'Print',
            download: 'Download',
            add: 'Add',
            save: 'Save',
            lock: 'Lock',
            unlock: 'Unlock',
            noImage: 'No image on this page',
            dropHint: 'Add an image in the images/ folder',
            wrongPassword: 'Wrong password!',
            unlocked: 'Edit mode enabled',
            locked: 'Read-only mode',
            pageAdded: 'Page added',
            saved: 'Saved successfully',
            saveError: 'Error during save',
            clickToZoom: 'Click to zoom',
            noPage: 'No page to download',
            maxPages: 'Maximum pages reached (100)',
            downloadStarted: 'Download started'
        },
        ar: {
            page: 'صفحة',
            noPages: 'لا توجد صفحات',
            prev: 'السابق',
            next: 'التالي',
            print: 'طباعة',
            download: 'تحميل',
            add: 'إضافة',
            save: 'حفظ',
            lock: 'قفل',
            unlock: 'فتح',
            noImage: 'لا توجد صورة في هذه الصفحة',
            dropHint: 'أضف صورة في مجلد images/',
            wrongPassword: 'كلمة المرور غير صحيحة!',
            unlocked: 'تم تفعيل وضع التحرير',
            locked: 'وضع القراءة فقط',
            pageAdded: 'تم إضافة الصفحة',
            saved: 'تم الحفظ بنجاح',
            saveError: 'حدث خطأ أثناء الحفظ',
            clickToZoom: 'انقر للتكبير',
            noPage: 'لا توجد صفحة للتحميل',
            maxPages: 'تم الوصول إلى الحد الأقصى (100)',
            downloadStarted: 'تم بدء التحميل'
        }
    };

    // ============================================================
    // ÉTAT DE L'APPLICATION
    // ============================================================
    let state = {
        pages: [],
        currentIndex: 0,
        lang: 'fr',
        isLocked: true,
        isLoggedIn: false
    };

    // ============================================================
    // RÉFÉRENCES DOM
    // ============================================================
    const DOM = {};

    function cacheDom() {
        DOM.loginScreen = document.getElementById('loginScreen');
        DOM.loginPassword = document.getElementById('loginPassword');
        DOM.loginBtn = document.getElementById('loginBtn');
        DOM.loginError = document.getElementById('loginError');

        DOM.appContainer = document.getElementById('appContainer');
        DOM.pageContent = document.getElementById('pageContent');
        DOM.pageNum = document.getElementById('pageNum');
        DOM.pageTotal = document.getElementById('pageTotal');
        DOM.pageLabel = document.getElementById('pageLabel');
        DOM.pageCounter = document.getElementById('pageCounter');

        DOM.prevBtn = document.getElementById('prevBtn');
        DOM.nextBtn = document.getElementById('nextBtn');
        DOM.addBtn = document.getElementById('addBtn');
        DOM.saveBtn = document.getElementById('saveBtn');
        DOM.downloadBtn = document.getElementById('downloadBtn');
        DOM.printBtn = document.getElementById('printBtn');
        DOM.lockBtn = document.getElementById('lockBtn');
        DOM.bookView = document.getElementById('bookView');
        DOM.bottomActions = document.getElementById('bottomActions');

        DOM.toast = document.getElementById('toast');
        DOM.lightbox = document.getElementById('lightbox');
        DOM.lightboxImg = document.getElementById('lightboxImg');
        DOM.lightboxClose = document.getElementById('lightboxClose');

        DOM.langFr = document.getElementById('langFr');
        DOM.langEn = document.getElementById('langEn');
        DOM.langAr = document.getElementById('langAr');
    }

    // ============================================================
    // STOCKAGE
    // ============================================================
    function loadPages() {
        try {
            const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (raw) {
                const data = JSON.parse(raw);
                if (Array.isArray(data) && data.length > 0) return data;
            }
        } catch (_) { /* ignore */ }
        return null;
    }

    function savePages(pages) {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(pages));
            return true;
        } catch (_) { return false; }
    }

    function loadMeta() {
        try {
            const raw = localStorage.getItem(CONFIG.META_KEY);
            if (raw) return JSON.parse(raw);
        } catch (_) { /* ignore */ }
        return null;
    }

    function saveMeta(meta) {
        try {
            localStorage.setItem(CONFIG.META_KEY, JSON.stringify(meta));
        } catch (_) { /* ignore */ }
    }

    // ============================================================
    // TRADUCTION
    // ============================================================
    function t(key) {
        return TRANSLATIONS[state.lang]?.[key] || key;
    }

    // ============================================================
    // TOAST
    // ============================================================
    let toastTimer = null;

    function showToast(message, type) {
        type = type || 'info';
        if (toastTimer) clearTimeout(toastTimer);
        DOM.toast.className = 'toast';
        DOM.toast.textContent = message;
        DOM.toast.classList.add(type);
        DOM.toast.classList.add('show');
        toastTimer = setTimeout(function() {
            DOM.toast.classList.remove('show');
        }, 3000);
    }

    // ============================================================
    // LIGHTBOX
    // ============================================================
    function openLightbox(src) {
        if (!src) return;
        DOM.lightboxImg.src = src;
        DOM.lightbox.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
        DOM.lightbox.classList.remove('open');
        document.body.style.overflow = '';
        DOM.lightboxImg.src = '';
    }

    // Exposer pour les attributs onclick
    window.openLightbox = openLightbox;

    // ============================================================
    // CHEMIN DES IMAGES
    // ============================================================
    function getImagePath(pageIndex) {
        // Page 1 (index 0) → images/page1-image1.png
        return 'images/page' + (pageIndex + 1) + '-image1.png';
    }

    // ============================================================
    // RENDU
    // ============================================================
    function render() {
        const pages = state.pages;
        const index = state.currentIndex;

        if (!pages || pages.length === 0) {
            DOM.pageContent.innerHTML =
                '<div class="placeholder-empty"><span>📭</span><p>' + t('noPages') + '</p></div>';
            DOM.pageNum.textContent = '0';
            DOM.pageTotal.textContent = '/ 0';
            DOM.pageCounter.textContent = '(0/' + CONFIG.MAX_PAGES + ')';
            updateNavButtons();
            return;
        }

        DOM.pageNum.textContent = index + 1;
        DOM.pageTotal.textContent = '/ ' + pages.length;
        DOM.pageCounter.textContent = '(' + pages.length + '/' + CONFIG.MAX_PAGES + ')';

        const imagePath = getImagePath(index);
        const pageExists = pages[index] !== undefined;

        if (pageExists) {
            DOM.pageContent.innerHTML =
                '<div class="exercise-zone">' +
                '<img src="' + imagePath + '" class="full-image" alt="Page ' + (index + 1) + '" ' +
                'draggable="false" onclick="openLightbox(\'' + imagePath + '\')" ' +
                'onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'flex\';">' +
                '<div class="image-placeholder" style="display:none;">' +
                '<span>🖼️</span>' +
                '<div>' + t('dropHint') + '</div>' +
                '<div class="hint">' + t('noImage') + '</div>' +
                '</div>' +
                '<div class="click-hint">🔍 ' + t('clickToZoom') + '</div>' +
                '</div>';
        } else {
            DOM.pageContent.innerHTML =
                '<div class="image-placeholder" style="display:flex;">' +
                '<span>📄</span>' +
                '<div>' + t('noImage') + '</div>' +
                '<div class="hint">' + t('dropHint') + '</div>' +
                '</div>';
        }

        updateNavButtons();
    }

    // ============================================================
    // NAVIGATION
    // ============================================================
    function updateNavButtons() {
        const len = state.pages.length;
        DOM.prevBtn.disabled = (len === 0 || state.currentIndex === 0);
        DOM.nextBtn.disabled = (len === 0 || state.currentIndex === len - 1);
    }

    function goPrev() {
        if (state.currentIndex > 0) {
            state.currentIndex--;
            render();
        }
    }

    function goNext() {
        if (state.currentIndex < state.pages.length - 1) {
            state.currentIndex++;
            render();
        }
    }

    // ============================================================
    // GESTION DES PAGES
    // ============================================================
    function addPage() {
        if (state.isLocked) {
            showToast('🔒 ' + t('locked'), 'error');
            return;
        }
        if (state.pages.length >= CONFIG.MAX_PAGES) {
            showToast('⚠️ ' + t('maxPages'), 'error');
            return;
        }
        state.pages.push({});
        state.currentIndex = state.pages.length - 1;
        savePages(state.pages);
        render();
        showToast(t('pageAdded'), 'success');
    }

    function saveState() {
        if (state.isLocked) {
            showToast('🔒 ' + t('locked'), 'error');
            return;
        }
        if (savePages(state.pages)) {
            showToast(t('saved'), 'success');
        } else {
            showToast(t('saveError'), 'error');
        }
    }

    // ============================================================
    // TÉLÉCHARGEMENT / IMPRESSION
    // ============================================================
    function downloadPage() {
        if (state.pages.length === 0) {
            showToast(t('noPage'), 'error');
            return;
        }
        const index = state.currentIndex;
        const imagePath = getImagePath(index);

        const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Page ' + (index + 1) +
            '</title><style>*{margin:0;padding:0}body{display:flex;justify-content:center;align-items:center;height:100vh;background:#fff}img{max-width:100%;max-height:100%;object-fit:contain}</style></head><body><img src="' +
            imagePath + '"></body></html>';

        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'page-' + (index + 1) + '.html';
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast('⬇️ ' + t('downloadStarted'), 'success');
    }

    function printPage() {
        window.print();
    }

    // ============================================================
    // VERROUILLAGE
    // ============================================================
    function toggleLock() {
        if (state.isLocked) {
            // Déverrouiller → afficher l'écran de connexion
            showLoginScreen();
        } else {
            // Verrouiller
            state.isLocked = true;
            updateLockUI();
            render();
            showToast(t('locked'), 'info');
        }
    }

    function updateLockUI() {
        const label = state.isLocked ? t('lock') : t('unlock');
        DOM.lockBtn.innerHTML = '<span>' + (state.isLocked ? '🔒' : '🔓') + '</span><span class="label">' + label +
        '</span>';
        DOM.lockBtn.classList.toggle('locked', !state.isLocked);
        DOM.bottomActions.classList.toggle('locked', state.isLocked);
    }

    // ============================================================
    // CONNEXION
    // ============================================================
    function showLoginScreen() {
        DOM.loginScreen.classList.remove('hidden');
        DOM.loginPassword.value = '';
        DOM.loginError.classList.remove('show');
        DOM.loginPassword.focus();
        // Bloquer l'accès à l'app
    }

    function hideLoginScreen() {
        DOM.loginScreen.classList.add('hidden');
    }

    function attemptLogin() {
        const pwd = DOM.loginPassword.value.trim();
        if (pwd === CONFIG.PASSWORD) {
            state.isLocked = false;
            state.isLoggedIn = true;
            hideLoginScreen();
            updateLockUI();
            render();
            showToast(t('unlocked'), 'success');
            saveMeta({ currentIndex: state.currentIndex, lang: state.lang });
        } else {
            DOM.loginError.classList.add('show');
            DOM.loginPassword.value = '';
            DOM.loginPassword.focus();
            showToast(t('wrongPassword'), 'error');
        }
    }

    // ============================================================
    // LANGUE
    // ============================================================
    function setLanguage(lang) {
        if (lang === state.lang) return;
        state.lang = lang;
        document.querySelectorAll('.lang-switch button').forEach(function(btn) {
            btn.classList.toggle('active', btn.dataset.lang === lang);
        });
        DOM.pageLabel.textContent = t('page');
        updateLockUI();
        render();
        saveMeta({ currentIndex: state.currentIndex, lang: state.lang });
    }

    // ============================================================
    // SWIPE (mobile)
    // ============================================================
    let swipeStartX = 0;
    let isSwiping = false;

    function handleTouchStart(e) {
        swipeStartX = e.touches[0].clientX;
        isSwiping = true;
    }

    function handleTouchEnd(e) {
        if (!isSwiping) return;
        isSwiping = false;
        const diff = swipeStartX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 40) {
            diff > 0 ? goNext() : goPrev();
        }
    }

    let mouseDown = false;
    let mouseStartX = 0;

    function handleMouseDown(e) {
        mouseDown = true;
        mouseStartX = e.clientX;
    }

    function handleMouseUp(e) {
        if (!mouseDown) return;
        mouseDown = false;
        const diff = mouseStartX - e.clientX;
        if (Math.abs(diff) > 40) {
            diff > 0 ? goNext() : goPrev();
        }
    }

    // ============================================================
    // INITIALISATION
    // ============================================================
    function init() {
        cacheDom();

        // --- Charger les pages ---
        const savedPages = loadPages();
        if (savedPages) {
            state.pages = savedPages;
        } else {
            state.pages = [{}];
            savePages(state.pages);
        }

        // --- Charger les métadonnées ---
        const meta = loadMeta();
        if (meta) {
            if (meta.currentIndex !== undefined && meta.currentIndex < state.pages.length) {
                state.currentIndex = meta.currentIndex;
            }
            if (meta.lang) state.lang = meta.lang;
        }

        // --- Appliquer la langue ---
        document.querySelectorAll('.lang-switch button').forEach(function(btn) {
            btn.classList.toggle('active', btn.dataset.lang === state.lang);
        });
        DOM.pageLabel.textContent = t('page');

        // --- Verrouillé par défaut ---
        state.isLocked = true;
        updateLockUI();

        // --- Afficher l'écran de connexion ---
        showLoginScreen();

        // --- Rendre la page ---
        render();

        // --- Événements de connexion ---
        DOM.loginBtn.addEventListener('click', attemptLogin);
        DOM.loginPassword.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                attemptLogin();
            }
        });

        // --- Navigation ---
        DOM.prevBtn.addEventListener('click', goPrev);
        DOM.nextBtn.addEventListener('click', goNext);

        // --- Actions ---
        DOM.addBtn.addEventListener('click', addPage);
        DOM.saveBtn.addEventListener('click', saveState);
        DOM.downloadBtn.addEventListener('click', downloadPage);
        DOM.printBtn.addEventListener('click', printPage);
        DOM.lockBtn.addEventListener('click', toggleLock);

        // --- Langue ---
        DOM.langFr.addEventListener('click', function() { setLanguage('fr'); });
        DOM.langEn.addEventListener('click', function() { setLanguage('en'); });
        DOM.langAr.addEventListener('click', function() { setLanguage('ar'); });

        // --- Lightbox ---
        DOM.lightboxClose.addEventListener('click', closeLightbox);
        DOM.lightbox.addEventListener('click', function(e) {
            if (e.target === DOM.lightbox || e.target === DOM.lightboxImg) {
                closeLightbox();
            }
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') closeLightbox();
        });

        // --- Swipe ---
        DOM.bookView.addEventListener('touchstart', handleTouchStart, { passive: true });
        DOM.bookView.addEventListener('touchend', handleTouchEnd, { passive: true });
        DOM.bookView.addEventListener('mousedown', handleMouseDown);
        DOM.bookView.addEventListener('mouseup', handleMouseUp);
        DOM.bookView.addEventListener('mouseleave', function() {
            mouseDown = false;
        });

        // --- Sauvegarde automatique ---
        setInterval(function() {
            saveMeta({
                currentIndex: state.currentIndex,
                lang: state.lang,
                timestamp: Date.now()
            });
        }, 5000);

        console.log('📖 Appixo Book v3.0 · ' + state.pages.length + ' pages');
    }

    // Démarrer quand le DOM est prêt
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
