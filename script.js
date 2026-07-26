(function() {
    'use strict';

    // =====================================================
    // CONFIGURATION
    // =====================================================
    const ADMIN_PASSWORD = '408408$$';
    const MAX_PAGES = 100;
    const DEFAULT_COVER = 'images/cover-default.svg';

    // =====================================================
    // STOCKAGE LOCALSTORAGE
    // =====================================================
    const STORAGE_KEY = 'appixo_book_pages';

    function loadPages() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const pages = JSON.parse(raw);
                if (Array.isArray(pages) && pages.length > 0) {
                    return pages;
                }
            }
        } catch (e) {
            console.warn('Erreur chargement:', e);
        }
        return null;
    }

    function savePages(pages) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(pages));
            return true;
        } catch (e) {
            console.error('Erreur sauvegarde:', e);
            return false;
        }
    }

    // =====================================================
    // GESTION DES IMAGES
    // =====================================================
    function getImagePath(pageIndex) {
        if (pageIndex === 0) return DEFAULT_COVER;
        return 'images/page' + pageIndex + '-image1.png';
    }

    // =====================================================
    // APPLICATION
    // =====================================================
    var pages = [];
    var currentIndex = 0;
    var currentLang = 'fr';
    var isLocked = true;

    var translations = {
        fr: {
            pageLabel: 'Page', noPages: '📭 Aucune page',
            prev: 'Préc.', next: 'Suiv.', print: 'Imprimer', download: 'Téléch.',
            add: 'Ajouter', save: 'Sauvegarder', lock: 'Verrouiller', unlock: 'Déverrouiller',
            noImage: 'Aucune image sur cette page',
            dropHint: 'Ajoutez une image dans le dossier images/',
            wrongPassword: '❌ Mot de passe incorrect !',
            unlocked: '🔓 Mode édition activé',
            locked: '🔒 Mode lecture seule',
            pageAdded: '✅ Page ajoutée',
            saved: '✅ Sauvegarde effectuée',
            saveError: '❌ Erreur lors de la sauvegarde',
            clickToZoom: 'Cliquez pour agrandir',
            noPage: 'Aucune page à télécharger'
        },
        en: {
            pageLabel: 'Page', noPages: '📭 No pages',
            prev: 'Prev', next: 'Next', print: 'Print', download: 'Download',
            add: 'Add', save: 'Save', lock: 'Lock', unlock: 'Unlock',
            noImage: 'No image on this page',
            dropHint: 'Add an image in the images/ folder',
            wrongPassword: '❌ Wrong password!',
            unlocked: '🔓 Edit mode enabled',
            locked: '🔒 Read-only mode',
            pageAdded: '✅ Page added',
            saved: '✅ Saved successfully',
            saveError: '❌ Error during save',
            clickToZoom: 'Click to zoom',
            noPage: 'No page to download'
        },
        ar: {
            pageLabel: 'صفحة', noPages: '📭 لا توجد صفحات',
            prev: 'السابق', next: 'التالي', print: 'طباعة', download: 'تحميل',
            add: 'إضافة', save: 'حفظ', lock: 'قفل', unlock: 'فتح',
            noImage: 'لا توجد صورة في هذه الصفحة',
            dropHint: 'أضف صورة في مجلد images/',
            wrongPassword: '❌ كلمة المرور غير صحيحة!',
            unlocked: '🔓 تم تفعيل وضع التحرير',
            locked: '🔒 وضع القراءة فقط',
            pageAdded: '✅ تم إضافة الصفحة',
            saved: '✅ تم الحفظ بنجاح',
            saveError: '❌ حدث خطأ أثناء الحفظ',
            clickToZoom: 'انقر للتكبير',
            noPage: 'لا توجد صفحة للتحميل'
        }
    };

    function t(key) {
        return translations[currentLang][key] || key;
    }

    // --- DOM ---
    var pageContent = document.getElementById('pageContent');
    var pageNum = document.getElementById('pageNum');
    var pageTotal = document.getElementById('pageTotal');
    var pageLabel = document.getElementById('pageLabel');
    var pageCounter = document.getElementById('pageCounter');
    var printBtn = document.getElementById('printPageBtn');
    var downloadBtn = document.getElementById('downloadPageBtn');
    var prevBtn = document.getElementById('prevPageBtn');
    var nextBtn = document.getElementById('nextPageBtn');
    var addBtn = document.getElementById('addPageBtn');
    var saveBtn = document.getElementById('saveBtn');
    var lockBtn = document.getElementById('lockBtn');
    var lockText = document.getElementById('lockText');
    var bookView = document.getElementById('bookView');
    var toast = document.getElementById('toast');
    var progressBar = document.getElementById('progressBar');
    var progressFill = document.getElementById('progressFill');
    var translateBadge = document.getElementById('translateBadge');
    var lightboxOverlay = document.getElementById('lightboxOverlay');
    var lightboxImage = document.getElementById('lightboxImage');
    var lightboxCloseBtn = document.getElementById('lightboxCloseBtn');
    var bookContainer = document.getElementById('bookContainer');
    var bottomActions = document.getElementById('bottomActions');

    var translatable = {
        prevText: document.getElementById('prevText'),
        nextText: document.getElementById('nextText'),
        printText: document.getElementById('printText'),
        downloadText: document.getElementById('downloadText'),
        addText: document.getElementById('addText'),
        saveText: document.getElementById('saveText'),
        lockText: document.getElementById('lockText')
    };

    // --- Toast ---
    var toastTimeout = null;
    function showToast(message, type) {
        type = type || 'info';
        if (toastTimeout) clearTimeout(toastTimeout);
        toast.className = 'toast';
        toast.textContent = message;
        if (type === 'success') toast.classList.add('success');
        else if (type === 'error') toast.classList.add('error');
        else if (type === 'info') toast.classList.add('info');
        toast.classList.add('show');
        toastTimeout = setTimeout(function() {
            toast.classList.remove('show');
        }, 3000);
    }

    // --- Progress ---
    function showProgress(percent) {
        progressBar.classList.add('active');
        progressFill.style.width = percent + '%';
        if (percent >= 100) {
            setTimeout(function() {
                progressBar.classList.remove('active');
                progressFill.style.width = '0%';
            }, 400);
        }
    }

    // --- Lock ---
    var lockOverlay = document.getElementById('lockOverlay');
    var lockPassword = document.getElementById('lockPassword');
    var lockUnlockBtn = document.getElementById('lockUnlockBtn');
    var lockError = document.getElementById('lockError');

    function showLockOverlay() {
        lockOverlay.classList.add('active');
        lockPassword.value = '';
        lockError.classList.remove('show');
        lockPassword.focus();
        bookContainer.classList.add('locked-blur');
    }

    function hideLockOverlay() {
        lockOverlay.classList.remove('active');
        bookContainer.classList.remove('locked-blur');
        lockError.classList.remove('show');
    }

    function attemptUnlock() {
        var pwd = lockPassword.value.trim();
        if (pwd === ADMIN_PASSWORD) {
            isLocked = false;
            updateLockState();
            hideLockOverlay();
            renderCurrentPage();
            showToast(t('unlocked'), 'success');
        } else {
            lockError.classList.add('show');
            lockPassword.value = '';
            lockPassword.focus();
            showToast(t('wrongPassword'), 'error');
        }
    }

    function toggleLock() {
        if (isLocked) {
            showLockOverlay();
        } else {
            isLocked = true;
            updateLockState();
            renderCurrentPage();
            showToast(t('locked'), 'info');
        }
    }

    function updateLockState() {
        lockText.textContent = isLocked ? t('lock') : t('unlock');
        lockBtn.classList.toggle('locked', !isLocked);
        bottomActions.classList.toggle('locked', isLocked);
        if (isLocked) {
            lockBtn.innerHTML = '<span class="icon">🔒</span><span class="label" id="lockText">' + t('lock') + '</span>';
        } else {
            lockBtn.innerHTML = '<span class="icon">🔓</span><span class="label" id="lockText">' + t('unlock') + '</span>';
        }
        document.getElementById('lockText').id = 'lockText';
        translatable.lockText = document.getElementById('lockText');
    }

    // --- Langue ---
    function updateUILanguage() {
        pageLabel.textContent = t('pageLabel');
        pageCounter.textContent = '(' + pages.length + '/' + MAX_PAGES + ')';
        translatable.prevText.textContent = t('prev');
        translatable.nextText.textContent = t('next');
        translatable.printText.textContent = t('print');
        translatable.downloadText.textContent = t('download');
        translatable.addText.textContent = t('add');
        translatable.saveText.textContent = t('save');
        translateBadge.textContent = t('translated');

        var container = document.getElementById('bookContainer');
        container.style.direction = (currentLang === 'ar') ? 'rtl' : 'ltr';

        updateLockState();
    }

    function setLanguage(lang) {
        if (lang === currentLang) return;
        currentLang = lang;
        var btns = document.querySelectorAll('.lang-switch button');
        for (var i = 0; i < btns.length; i++) {
            btns[i].classList.toggle('active', btns[i].dataset.lang === currentLang);
        }
        updateUILanguage();
        renderCurrentPage();
    }

    // --- Lightbox ---
    function openLightbox(imgSrc) {
        if (!imgSrc) return;
        lightboxImage.src = imgSrc;
        lightboxOverlay.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
        lightboxOverlay.classList.remove('open');
        document.body.style.overflow = '';
        lightboxImage.src = '';
    }
    window.openLightbox = openLightbox;

    // ============================================================
    // RENDU
    // ============================================================
    function renderCurrentPage() {
        if (pages.length === 0) {
            pageContent.innerHTML =
                '<div class="empty-page-placeholder"><span>📭</span> ' + t('noPages') + '</div>';
            pageNum.textContent = '0';
            pageTotal.textContent = '/ 0';
            pageCounter.textContent = '(0/' + MAX_PAGES + ')';
            translateBadge.classList.remove('active');
            updateNavButtons();
            return;
        }

        var pageIndex = currentIndex;
        pageNum.textContent = pageIndex + 1;
        pageTotal.textContent = '/ ' + pages.length;
        pageCounter.textContent = '(' + pages.length + '/' + MAX_PAGES + ')';

        // Page 0 = couverture
        if (pageIndex === 0) {
            var coverImage = DEFAULT_COVER;
            pageContent.innerHTML =
                '<div class="page-cover" onclick="openLightbox(\'' + coverImage + '\')">' +
                '<img src="' + coverImage + '" class="cover-main" alt="Page de garde" draggable="false" />' +
                '<div class="click-hint">🔍 ' + t('clickToZoom') + '</div>' +
                '</div>';
            translateBadge.classList.remove('active');
            updateNavButtons();
            return;
        }

        // Pages 1 à N : charger l'image correspondante
        var imagePath = getImagePath(pageIndex);
        var pageExists = pages[pageIndex] !== undefined;

        var exerciseHtml = '';
        if (pageExists) {
            exerciseHtml =
                '<div class="exercise-zone">' +
                '<img src="' + imagePath + '" class="full-page-image" alt="Page ' + pageIndex + '" ' +
                'draggable="false" onclick="openLightbox(\'' + imagePath + '\')" ' +
                'onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'flex\';" />' +
                '<div class="image-placeholder" style="display:none;">' +
                '<span>🖼️</span>' +
                '<div>' + t('dropHint') + '</div>' +
                '<div class="hint">' + t('noImage') + '</div>' +
                '</div>' +
                '<div class="click-hint">🔍 ' + t('clickToZoom') + '</div>' +
                '</div>';
        } else {
            exerciseHtml =
                '<div class="image-placeholder" style="display:flex;">' +
                '<span>📄</span>' +
                '<div>' + t('noImage') + '</div>' +
                '<div class="hint">' + t('dropHint') + '</div>' +
                '</div>';
        }

        pageContent.innerHTML = exerciseHtml;

        translateBadge.classList.remove('active');
        updateNavButtons();
    }

    function updateNavButtons() {
        if (pages.length === 0) {
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            return;
        }
        prevBtn.disabled = (currentIndex === 0);
        nextBtn.disabled = (currentIndex === pages.length - 1);
    }

    function goToPrev() {
        if (pages.length === 0 || currentIndex === 0) return;
        currentIndex--;
        renderCurrentPage();
    }

    function goToNext() {
        if (pages.length === 0 || currentIndex === pages.length - 1) return;
        currentIndex++;
        renderCurrentPage();
    }

    // --- Gestion pages ---
    function addNewPage() {
        if (isLocked) {
            showToast('🔒 ' + t('locked'), 'error');
            return;
        }
        if (pages.length >= MAX_PAGES) {
            showToast('⚠️ Nombre maximum de pages atteint (100)', 'error');
            return;
        }
        var newIndex = pages.length;
        pages.push({});
        currentIndex = newIndex;
        renderCurrentPage();
        savePages(pages);
        showToast(t('pageAdded'), 'success');
    }

    function sauvegarder() {
        if (isLocked) {
            showToast('🔒 ' + t('locked'), 'error');
            return;
        }
        if (savePages(pages)) {
            showToast(t('saved'), 'success');
        } else {
            showToast(t('saveError'), 'error');
        }
    }

    // --- Print ---
    function printCurrentPage() {
        window.print();
    }

    // --- Download ---
    function downloadCurrentPage() {
        if (pages.length === 0) {
            showToast(t('noPage'), 'error');
            return;
        }
        var pageIndex = currentIndex;
        var imagePath = (pageIndex === 0) ? DEFAULT_COVER : getImagePath(pageIndex);

        var htmlContent =
            '<!DOCTYPE html>\n' +
            '<html>\n' +
            '<head><meta charset="UTF-8"><title>Page ' + (pageIndex + 1) + '</title>\n' +
            '<style>\n' +
            '* { margin:0; padding:0; box-sizing:border-box; }\n' +
            'body { background:white; margin:0; padding:0; display:flex; justify-content:center; align-items:center; min-height:100vh; font-family:system-ui,sans-serif; }\n' +
            '@page { margin:0; size:A4; }\n' +
            '.page-a4 { width:21cm; height:29.7cm; margin:0; padding:0; display:flex; justify-content:center; align-items:center; background:white; overflow:hidden; }\n' +
            '.page-a4 img { width:100%; height:100%; object-fit:contain; }\n' +
            '</style>\n' +
            '</head>\n' +
            '<body>\n' +
            '<div class="page-a4"><img src="' + imagePath + '" /></div>\n' +
            '</body>\n' +
            '</html>';

        var blob = new Blob([htmlContent], { type: 'text/html' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.download = 'page-' + (pageIndex + 1) + '-A4.html';
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast('⬇️ Téléchargement A4 démarré', 'success');
    }

    // --- Swipe ---
    var startX = 0,
        isSwiping = false;

    function handleTouchStart(e) {
        var touch = e.touches[0];
        startX = touch.clientX;
        isSwiping = true;
    }

    function handleTouchEnd(e) {
        if (!isSwiping) return;
        isSwiping = false;
        var endX = e.changedTouches[0].clientX;
        var diff = startX - endX;
        if (Math.abs(diff) > 40) {
            diff > 0 ? goToNext() : goToPrev();
        }
    }

    var mouseDown = false,
        mouseStartX = 0;

    function handleMouseDown(e) {
        mouseDown = true;
        mouseStartX = e.clientX;
    }

    function handleMouseUp(e) {
        if (!mouseDown) return;
        mouseDown = false;
        var diff = mouseStartX - e.clientX;
        if (Math.abs(diff) > 40) {
            diff > 0 ? goToNext() : goToPrev();
        }
    }

    // --- INIT ---
    function initBook() {
        var savedPages = loadPages();
        if (savedPages) {
            pages = savedPages;
        } else {
            pages = [{}];
            savePages(pages);
        }

        try {
            var meta = localStorage.getItem('appixo_book_meta');
            if (meta) {
                var parsed = JSON.parse(meta);
                if (parsed.currentIndex !== undefined && parsed.currentIndex < pages.length) {
                    currentIndex = parsed.currentIndex;
                }
                if (parsed.lang) currentLang = parsed.lang;
            }
        } catch (e) { /* ignore */ }

        var btns = document.querySelectorAll('.lang-switch button');
        for (var i = 0; i < btns.length; i++) {
            btns[i].classList.toggle('active', btns[i].dataset.lang === currentLang);
        }
        updateUILanguage();

        isLocked = true;
        updateLockState();

        renderCurrentPage();

        bookView.addEventListener('touchstart', handleTouchStart, { passive: true });
        bookView.addEventListener('touchend', handleTouchEnd, { passive: true });
        bookView.addEventListener('mousedown', handleMouseDown);
        bookView.addEventListener('mouseup', handleMouseUp);
        bookView.addEventListener('mouseleave', function() {
            mouseDown = false;
        });

        lockUnlockBtn.addEventListener('click', attemptUnlock);
        lockPassword.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                attemptUnlock();
            }
        });

        lightboxCloseBtn.addEventListener('click', closeLightbox);
        lightboxOverlay.addEventListener('click', function(e) {
            if (e.target === this || e.target === lightboxImage) {
                closeLightbox();
            }
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') closeLightbox();
        });

        prevBtn.addEventListener('click', goToPrev);
        nextBtn.addEventListener('click', goToNext);
        printBtn.addEventListener('click', printCurrentPage);
        downloadBtn.addEventListener('click', downloadCurrentPage);
        addBtn.addEventListener('click', addNewPage);
        saveBtn.addEventListener('click', sauvegarder);
        lockBtn.addEventListener('click', toggleLock);

        document.getElementById('langFr').addEventListener('click', function() { setLanguage('fr'); });
        document.getElementById('langEn').addEventListener('click', function() { setLanguage('en'); });
        document.getElementById('langAr').addEventListener('click', function() { setLanguage('ar'); });

        setInterval(function() {
            try {
                localStorage.setItem('appixo_book_meta', JSON.stringify({
                    currentIndex: currentIndex,
                    lang: currentLang,
                    timestamp: Date.now()
                }));
            } catch (e) { /* ignore */ }
        }, 5000);

        console.log('📖 Appixo Book · v3.0 · ' + pages.length + ' pages');
    }

    // Démarrer l'application
    initBook();
})();