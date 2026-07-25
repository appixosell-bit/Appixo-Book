(function() {
    'use strict';

    // =====================================================
    // 1. STOCKAGE INDEXEDDB
    // =====================================================
    class ImageStorage {
        constructor() {
            this.db = null;
            this.storeName = 'pages';
            this.dbName = 'CarnetA4_100_v8';
            this.version = 10;
            this.ready = false;
            this.initPromise = null;
            this.MAX_IMAGES = 100;
        }

        init() {
            if (this.initPromise) return this.initPromise;
            this.initPromise = new Promise((resolve, reject) => {
                const request = indexedDB.open(this.dbName, this.version);

                request.onerror = (e) => {
                    console.error('❌ Erreur IndexedDB:', e.target.error);
                    reject(e.target.error);
                };

                request.onsuccess = (e) => {
                    this.db = e.target.result;
                    this.ready = true;
                    console.log('✅ IndexedDB prêt');
                    resolve();
                };

                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(this.storeName)) {
                        const store = db.createObjectStore(this.storeName, {
                            keyPath: 'id',
                            autoIncrement: true
                        });
                        store.createIndex('timestamp', 'timestamp', { unique: false });
                        store.createIndex('pageIndex', 'pageIndex', { unique: false });
                        console.log('📦 ObjectStore créé');
                    } else {
                        const store = e.target.transaction.objectStore(this.storeName);
                        if (!store.indexNames.contains('timestamp')) {
                            store.createIndex('timestamp', 'timestamp', { unique: false });
                        }
                        if (!store.indexNames.contains('pageIndex')) {
                            store.createIndex('pageIndex', 'pageIndex', { unique: false });
                        }
                    }
                };
            });
            return this.initPromise;
        }

        async savePages(pages) {
            await this.init();
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction(this.storeName, 'readwrite');
                const store = tx.objectStore(this.storeName);

                const clearRequest = store.clear();
                clearRequest.onsuccess = () => {
                    let saved = 0;
                    const total = Math.min(pages.length, this.MAX_IMAGES);

                    for (let i = 0; i < total; i++) {
                        const page = pages[i];
                        const data = {
                            content: page.content || '',
                            solution: page.solution || '',
                            imageData: page.imageData || null,
                            isCover: page.isCover || false,
                            timestamp: Date.now() + i,
                            pageIndex: i
                        };
                        const addRequest = store.add(data);
                        addRequest.onsuccess = () => {
                            saved++;
                            if (saved === total) {
                                resolve();
                            }
                        };
                        addRequest.onerror = (e) => {
                            console.error('Erreur sauvegarde page', i, e);
                            reject(e.target.error);
                        };
                    }

                    if (total === 0) resolve();
                };
                clearRequest.onerror = (e) => reject(e.target.error);
            });
        }

        async loadPages() {
            await this.init();
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction(this.storeName, 'readonly');
                const store = tx.objectStore(this.storeName);
                const index = store.index('pageIndex');
                const request = index.getAll();

                request.onsuccess = () => {
                    const results = request.result;
                    results.sort((a, b) => a.pageIndex - b.pageIndex);
                    const pages = results.map(item => ({
                        content: item.content || '',
                        solution: item.solution || '',
                        imageData: item.imageData || null,
                        isCover: item.isCover || false
                    }));
                    resolve(pages);
                };
                request.onerror = (e) => {
                    console.error('Erreur chargement:', e);
                    resolve([]);
                };
            });
        }

        async clear() {
            await this.init();
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction(this.storeName, 'readwrite');
                const store = tx.objectStore(this.storeName);
                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = (e) => reject(e.target.error);
            });
        }

        async getStats() {
            await this.init();
            return new Promise((resolve) => {
                const tx = this.db.transaction(this.storeName, 'readonly');
                const store = tx.objectStore(this.storeName);
                const count = store.count();
                count.onsuccess = () => {
                    resolve({ count: count.result, max: this.MAX_IMAGES });
                };
                count.onerror = () => resolve({ count: 0, max: this.MAX_IMAGES });
            });
        }
    }

    // =====================================================
    // 2. APPLICATION
    // =====================================================
    const storage = new ImageStorage();
    const MAX_PAGES = 100;
    const PASSWORD = 'MonCarnet2026!@#Secure';
    const COVER_DEFAULT = 'images/cover-default.svg'; // chemin relatif

    let pages = [];
    let currentIndex = 0;
    let currentLang = 'fr';
    let solutionVisible = false;
    let isLocked = false;
    let isSaving = false;
    let menuOpen = false;
    let toastTimeout = null;

    // --- Détection du type de page ---
    const isConsultation = !!document.getElementById('exportBtn');
    const isParametres = !!document.getElementById('settingsToggle');

    // --- Traductions ---
    const translations = {
        fr: {
            pageLabel: 'Page',
            noPages: '📭 Aucune page',
            upload: 'Image',
            add: 'Ajouter',
            delete: 'Supprimer',
            prev: 'Préc.',
            next: 'Suiv.',
            print: 'Imprimer',
            download: 'Téléch.',
            save: 'Sauver',
            clear: 'Vider',
            confirmDelete: 'Voulez-vous supprimer cette page ?',
            onlyPage: 'C\'est la seule page, vous ne pouvez pas la supprimer. Ajoutez-en d\'abord.',
            noImage: 'Cette page est vide.',
            noPage: 'Aucune page à télécharger.',
            imageError: 'Veuillez sélectionner une image (jpg, png, ...)',
            readError: 'Erreur lors de la lecture du fichier.',
            saved: '✅ Sauvegarde effectuée !',
            saveError: '⚠️ Erreur lors de la sauvegarde.',
            saving: '💾 Sauvegarde en cours...',
            maxPages: '⚠️ Nombre maximum de pages atteint (100)',
            pageCounter: '(0/100)',
            clearConfirm: '⚠️ Voulez-vous vraiment supprimer TOUTES les pages ?',
            cleared: '✅ Toutes les pages ont été supprimées !',
            solution: '💡 Solution',
            solutionTitle: '💡 Solution',
            noSolution: 'Aucune solution enregistrée pour cette page.',
            solutionPlaceholder: '📸 Cliquez sur "Changer l\'image" pour insérer une image',
            changeImage: '🖼️ Changer l\'image',
            dropHint: 'Déposez une image ici ou cliquez sur "Image"',
            noImagePage: 'Aucune image sur cette page',
            lock: 'Verrouiller',
            unlock: 'Déverrouiller',
            enterPassword: 'Entrez le mot de passe :',
            wrongPassword: '❌ Mot de passe incorrect !',
            locked: '🔒 Carnet verrouillé',
            unlocked: '🔓 Carnet déverrouillé',
            showSolution: '👁️ Afficher la solution',
            hideSolution: '🔽 Masquer la solution',
            solutionHidden: '🔽 Solution masquée',
            solutionShown: '💡 Solution affichée',
            translated: '🌐 Traduit',
            clickToZoom: 'Cliquez pour agrandir',
            validate: '✅ Valider',
            validateMsg: '✅ Paramètres sauvegardés. Redirection vers le site de consultation...',
            goToSite: '🌐 Aller au site de consultation',
            export: 'Sauvegarder',
            exportSuccess: '✅ Données exportées avec succès !',
            dataLoaded: '📥 Données chargées depuis le paramètre URL',
            dataLoadError: '❌ Erreur de chargement des données depuis l\'URL',
        },
        en: {
            pageLabel: 'Page',
            noPages: '📭 No pages',
            upload: 'Image',
            add: 'Add',
            delete: 'Delete',
            prev: 'Prev',
            next: 'Next',
            print: 'Print',
            download: 'Download',
            save: 'Save',
            clear: 'Clear',
            confirmDelete: 'Do you want to delete this page?',
            onlyPage: 'This is the only page, you cannot delete it. Add more first.',
            noImage: 'This page is empty.',
            noPage: 'No page to download.',
            imageError: 'Please select an image (jpg, png, ...)',
            readError: 'Error reading file.',
            saved: '✅ Saved successfully!',
            saveError: '⚠️ Error during save.',
            saving: '💾 Saving...',
            maxPages: '⚠️ Maximum number of pages reached (100)',
            pageCounter: '(0/100)',
            clearConfirm: '⚠️ Do you really want to delete ALL pages?',
            cleared: '✅ All pages have been deleted!',
            solution: '💡 Solution',
            solutionTitle: '💡 Solution',
            noSolution: 'No solution saved for this page.',
            solutionPlaceholder: '📸 Click "Change image" to insert an image',
            changeImage: '🖼️ Change image',
            dropHint: 'Drop an image here or click "Image"',
            noImagePage: 'No image on this page',
            lock: 'Lock',
            unlock: 'Unlock',
            enterPassword: 'Enter password:',
            wrongPassword: '❌ Wrong password!',
            locked: '🔒 Notebook locked',
            unlocked: '🔓 Notebook unlocked',
            showSolution: '👁️ Show solution',
            hideSolution: '🔽 Hide solution',
            solutionHidden: '🔽 Solution hidden',
            solutionShown: '💡 Solution shown',
            translated: '🌐 Translated',
            clickToZoom: 'Click to zoom',
            validate: '✅ Validate',
            validateMsg: '✅ Settings saved. Redirecting to consultation site...',
            goToSite: '🌐 Go to consultation site',
            export: 'Export',
            exportSuccess: '✅ Data exported successfully!',
            dataLoaded: '📥 Data loaded from URL parameter',
            dataLoadError: '❌ Error loading data from URL',
        },
        ar: {
            pageLabel: 'صفحة',
            noPages: '📭 لا توجد صفحات',
            upload: 'صورة',
            add: 'إضافة',
            delete: 'حذف',
            prev: 'السابق',
            next: 'التالي',
            print: 'طباعة',
            download: 'تحميل',
            save: 'حفظ',
            clear: 'مسح',
            confirmDelete: 'هل تريد حذف هذه الصفحة؟',
            onlyPage: 'هذه هي الصفحة الوحيدة ولا يمكن حذفها، يمكنك إضافة صفحات جديدة.',
            noImage: 'هذه الصفحة فارغة.',
            noPage: 'لا توجد صفحة لتحميلها.',
            imageError: 'يرجى اختيار ملف صورة (jpg, png, ...)',
            readError: 'حدث خطأ أثناء قراءة الملف.',
            saved: '✅ تم الحفظ بنجاح!',
            saveError: '⚠️ حدث خطأ أثناء الحفظ.',
            saving: '💾 جاري الحفظ...',
            maxPages: '⚠️ تم الوصول إلى الحد الأقصى للصفحات (100)',
            pageCounter: '(0/100)',
            clearConfirm: '⚠️ هل تريد حقًا حذف جميع الصفحات؟',
            cleared: '✅ تم حذف جميع الصفحات!',
            solution: '💡 الحل',
            solutionTitle: '💡 الحل',
            noSolution: 'لا يوجد حل محفوظ لهذه الصفحة.',
            solutionPlaceholder: '📸 انقر على "تغيير الصورة" لإدراج صورة',
            changeImage: '🖼️ تغيير الصورة',
            dropHint: 'اسحب صورة هنا أو انقر على "صورة"',
            noImagePage: 'لا توجد صورة في هذه الصفحة',
            lock: 'قفل',
            unlock: 'فتح',
            enterPassword: 'أدخل كلمة المرور:',
            wrongPassword: '❌ كلمة المرور غير صحيحة!',
            locked: '🔒 الدفتر مقفل',
            unlocked: '🔓 الدفتر مفتوح',
            showSolution: '👁️ عرض الحل',
            hideSolution: '🔽 إخفاء الحل',
            solutionHidden: '🔽 الحل مخفي',
            solutionShown: '💡 الحل معروض',
            translated: '🌐 مترجم',
            clickToZoom: 'انقر للتكبير',
            validate: '✅ تأكيد',
            validateMsg: '✅ تم حفظ الإعدادات، جاري التوجيه إلى موقع العرض...',
            goToSite: '🌐 الذهاب إلى موقع العرض',
            export: 'تصدير',
            exportSuccess: '✅ تم تصدير البيانات بنجاح!',
            dataLoaded: '📥 تم تحميل البيانات من معامل URL',
            dataLoadError: '❌ حدث خطأ أثناء تحميل البيانات من URL',
        }
    };

    function t(key) { return translations[currentLang][key] || key; }

    // --- DOM ---
    const pageContent = document.getElementById('pageContent');
    const pageNum = document.getElementById('pageNum');
    const pageTotal = document.getElementById('pageTotal');
    const pageLabel = document.getElementById('pageLabel');
    const pageCounter = document.getElementById('pageCounter');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const printBtn = document.getElementById('printPageBtn');
    const downloadBtn = document.getElementById('downloadPageBtn');
    const bookView = document.getElementById('bookView');
    const toast = document.getElementById('toast');
    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');
    const translateBadge = document.getElementById('translateBadge');
    const showSolutionTopBtn = document.getElementById('showSolutionTopBtn');
    const hideSolutionTopBtn = document.getElementById('hideSolutionTopBtn');
    const lightboxOverlay = document.getElementById('lightboxOverlay');
    const lightboxImage = document.getElementById('lightboxImage');
    const lightboxCloseBtn = document.getElementById('lightboxCloseBtn');
    const bookContainer = document.getElementById('bookContainer');

    // Éléments spécifiques
    const exportBtn = document.getElementById('exportBtn');
    const settingsToggle = document.getElementById('settingsToggle');
    const bottomActions = document.getElementById('bottomActions');
    const lockBtn = document.getElementById('lockBtn');
    const lockLabel = document.getElementById('lockLabel');
    const validateBtn = document.getElementById('validateBtn');
    const addBtn = document.getElementById('addPageBtn');
    const deleteBtn = document.getElementById('deletePageBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const imageUpload = document.getElementById('imageUpload');
    const saveExplicitBtn = document.getElementById('saveExplicitBtn');

    // --- Toast ---
    function showToast(message, type = 'info') {
        if (toastTimeout) clearTimeout(toastTimeout);
        toast.className = 'toast';
        toast.textContent = message;
        if (type === 'success') toast.classList.add('success');
        else if (type === 'error') toast.classList.add('error');
        else if (type === 'info') toast.classList.add('info');
        toast.classList.add('show');
        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 3200);
    }

    // --- Progress ---
    function showProgress(percent) {
        progressBar.classList.add('active');
        progressFill.style.width = percent + '%';
        if (percent >= 100) {
            setTimeout(() => {
                progressBar.classList.remove('active');
                progressFill.style.width = '0%';
            }, 600);
        }
    }

    // --- Google Translate ---
    window.googleTranslateElementInit = function() {
        console.log('🌐 Google Translate chargé');
    };

    // ============================================================
    // 3. LOCK
    // ============================================================
    const lockOverlay = document.getElementById('lockOverlay');
    const lockPassword = document.getElementById('lockPassword');
    const lockUnlockBtn = document.getElementById('lockUnlockBtn');
    const lockError = document.getElementById('lockError');

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
        const pwd = lockPassword.value.trim();
        if (pwd === PASSWORD) {
            isLocked = false;
            if (lockLabel) {
                lockLabel.textContent = t('lock');
                lockBtn.classList.remove('locked');
            }
            applyLockState(false);
            hideLockOverlay();
            renderCurrentPage();
            sauvegarderEtat();
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
            if (lockLabel) {
                lockLabel.textContent = t('unlock');
                lockBtn.classList.add('locked');
            }
            applyLockState(true);
            showLockOverlay();
            renderCurrentPage();
            sauvegarderEtat();
            showToast(t('locked'), 'info');
        }
    }

    function applyLockState(locked) {
        if (!isParametres) return; // seulement pour paramètres
        if (locked) {
            bookContainer.classList.add('locked-state');
            const editButtons = bottomActions.querySelectorAll(
                'button:not(.lock-btn):not(.btn-prev):not(.btn-next):not(.btn-print):not(.btn-download):not(.btn-save):not(.btn-validate)');
            editButtons.forEach(btn => btn.disabled = true);
            const uploadLabel = document.getElementById('uploadLabel');
            if (uploadLabel) uploadLabel.style.pointerEvents = 'none';
            const solUploadBtn = document.querySelector('.solution-image-container .upload-btn');
            if (solUploadBtn) solUploadBtn.style.pointerEvents = 'none';
            showSolutionTopBtn.style.pointerEvents = 'auto';
            showSolutionTopBtn.style.opacity = '1';
            hideSolutionTopBtn.style.pointerEvents = 'auto';
            hideSolutionTopBtn.style.opacity = '1';
            bookView.style.touchAction = 'none';
        } else {
            bookContainer.classList.remove('locked-state');
            const allButtons = bottomActions.querySelectorAll('button:not(.lock-btn)');
            allButtons.forEach(btn => btn.disabled = false);
            const uploadLabel = document.getElementById('uploadLabel');
            if (uploadLabel) uploadLabel.style.pointerEvents = 'auto';
            const solUploadBtn = document.querySelector('.solution-image-container .upload-btn');
            if (solUploadBtn) solUploadBtn.style.pointerEvents = 'auto';
            showSolutionTopBtn.style.pointerEvents = 'auto';
            showSolutionTopBtn.style.opacity = '1';
            hideSolutionTopBtn.style.pointerEvents = 'auto';
            hideSolutionTopBtn.style.opacity = '1';
            bookView.style.touchAction = 'none';
        }
        if (lockBtn) lockBtn.disabled = false;
    }

    // ============================================================
    // 4. LANGUE
    // ============================================================
    function updateUILanguage() {
        pageLabel.textContent = t('pageLabel');
        pageCounter.textContent = `(${pages.length}/${MAX_PAGES})`;

        const translatableMap = {
            uploadLabelText: 'upload',
            addText: 'add',
            deleteText: 'delete',
            prevText: 'prev',
            nextText: 'next',
            printText: 'print',
            downloadText: 'download',
            saveText: 'save',
            clearText: 'clear',
            validateText: 'validate',
            exportText: 'export',
            lockLabel: isLocked ? 'unlock' : 'lock',
        };

        for (const [id, key] of Object.entries(translatableMap)) {
            const el = document.getElementById(id);
            if (el) {
                if (id === 'lockLabel') {
                    el.textContent = t(key);
                } else {
                    el.textContent = t(key);
                }
            }
        }

        translateBadge.textContent = t('translated');

        if (showSolutionTopBtn) {
            showSolutionTopBtn.textContent = t('showSolution');
            hideSolutionTopBtn.textContent = t('hideSolution');
        }

        const container = document.getElementById('bookContainer');
        if (currentLang === 'ar') {
            container.classList.add('lang-ar');
            container.style.direction = 'rtl';
        } else {
            container.classList.remove('lang-ar');
            container.style.direction = 'ltr';
        }
    }

    function setLanguage(lang) {
        if (lang === currentLang) return;
        currentLang = lang;
        updateLangButtons();
        updateUILanguage();
        renderCurrentPage();
        sauvegarderEtat();
    }

    function updateLangButtons() {
        document.querySelectorAll('.lang-switch button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === currentLang);
        });
    }

    // ============================================================
    // 5. SOLUTION
    // ============================================================
    function updateSolutionButtons() {
        if (!showSolutionTopBtn || !hideSolutionTopBtn) return;
        if (solutionVisible) {
            showSolutionTopBtn.style.display = 'none';
            hideSolutionTopBtn.style.display = 'inline-flex';
        } else {
            showSolutionTopBtn.style.display = 'inline-flex';
            hideSolutionTopBtn.style.display = 'none';
        }
    }

    function toggleSolutionFromTop(show) {
        const page = pages[currentIndex];
        if (!page || currentIndex === 0) {
            showToast('📖 La page de garde ne contient pas de solution.', 'info');
            return;
        }
        solutionVisible = show;
        renderCurrentPage();
        updateSolutionButtons();
        showToast(solutionVisible ? t('solutionShown') : t('solutionHidden'), 'info');
        sauvegarderEtat();
    }

    // ============================================================
    // 6. LIGHTBOX
    // ============================================================
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

    window.appOpenLightbox = openLightbox;

    // ============================================================
    // 7. RENDU
    // ============================================================
    function renderCurrentPage() {
        if (pages.length === 0) {
            pageContent.innerHTML =
                `<div class="empty-page-placeholder"><span>📭</span> ${t('noPages')}</div>`;
            pageNum.textContent = '0';
            pageTotal.textContent = '/ 0';
            pageCounter.textContent = `(0/${MAX_PAGES})`;
            translateBadge.classList.remove('active');
            updateNavButtons();
            updateSolutionButtons();
            return;
        }

        const page = pages[currentIndex];
        pageNum.textContent = currentIndex + 1;
        pageTotal.textContent = `/ ${pages.length}`;
        pageCounter.textContent = `(${pages.length}/${MAX_PAGES})`;

        // PAGE DE GARDE
        if (currentIndex === 0) {
            page.isCover = true;
            let coverImage = page.imageData || COVER_DEFAULT;
            pageContent.innerHTML = `
                    <div class="page-cover" onclick="window.appOpenLightbox('${coverImage}')">
                        <img src="${coverImage}" class="cover-main" alt="Page de garde" draggable="false" />
                        <div class="click-hint">🔍 ${t('clickToZoom')}</div>
                    </div>
                `;
            translateBadge.classList.remove('active');
            updateNavButtons();
            if (showSolutionTopBtn) {
                showSolutionTopBtn.style.display = 'none';
                hideSolutionTopBtn.style.display = 'none';
            }
            if (isParametres && isLocked) applyLockState(true);
            else if (isParametres) applyLockState(false);
            return;
        }

        // PAGES EXERCICE
        page.isCover = false;
        if (showSolutionTopBtn) {
            showSolutionTopBtn.style.display = 'inline-flex';
            updateSolutionButtons();
        }

        const hasImage = page.imageData && page.imageData.length > 100 && page.imageData.startsWith('data:image');

        let exerciseHtml = '';
        if (hasImage) {
            exerciseHtml = `
                    <img src="${page.imageData}" class="full-page-image" alt="Exercice" draggable="false" onclick="window.appOpenLightbox('${page.imageData}')" />
                    <div class="click-hint">🔍 ${t('clickToZoom')}</div>
                `;
        } else {
            exerciseHtml = `
                    <div class="image-placeholder">
                        <span>🖼️</span>
                        <div>${t('dropHint')}</div>
                        <div class="hint">${t('noImagePage')}</div>
                    </div>
                `;
        }

        let solutionHtml = '';
        const hasSolution = page.solution && page.solution.includes('<img');
        if (hasSolution) {
            solutionHtml = page.solution;
        } else {
            solutionHtml = `<div class="placeholder">${t('solutionPlaceholder')}</div>`;
        }

        const solutionClass = solutionVisible ? '' : 'hidden';

        // pour les paramètres, on ajoute le bouton d'upload de solution
        let uploadSolutionBtn = '';
        if (isParametres) {
            uploadSolutionBtn = `
                    <label class="upload-btn" id="solutionUploadBtn" style="${isLocked ? 'pointer-events:none;opacity:0.5;' : ''}">
                        <span>🖼️ ${t('changeImage')}</span>
                        <input type="file" accept="image/*" id="solutionFileInput" ${isLocked ? 'disabled' : ''}>
                    </label>
                `;
        }

        pageContent.innerHTML = `
                <div class="exercise-zone">
                    ${exerciseHtml}
                </div>
                <div class="solution-zone-wrapper ${solutionClass}" id="solutionZoneWrapper">
                    <div class="solution-header">
                        <h4>💡 ${t('solutionTitle')}</h4>
                    </div>
                    <div class="solution-image-container" id="solutionImageContainer">
                        ${solutionHtml}
                        ${uploadSolutionBtn}
                    </div>
                </div>
            `;

        // Gestion upload solution (paramètres)
        if (isParametres) {
            const solutionFileInput = document.getElementById('solutionFileInput');
            if (solutionFileInput) {
                solutionFileInput.addEventListener('change', function(e) {
                    if (isLocked) {
                        showToast('🔒 Carnet verrouillé', 'error');
                        this.value = '';
                        return;
                    }
                    const file = this.files[0];
                    if (file) {
                        handleSolutionImageUpload(file, currentIndex);
                    }
                    this.value = '';
                });
            }
        }

        // Clic sur l'image de solution pour zoom
        const solutionImg = document.querySelector('.solution-image-container .solution-image');
        if (solutionImg) {
            solutionImg.addEventListener('click', function(e) {
                e.stopPropagation();
                const src = this.getAttribute('src');
                if (src) {
                    openLightbox(src);
                }
            });
        }

        translateBadge.classList.remove('active');
        updateNavButtons();

        if (isParametres && isLocked) applyLockState(true);
        else if (isParametres) applyLockState(false);
    }

    function updateNavButtons() {
        if (pages.length === 0) { prevBtn.disabled = true;
            nextBtn.disabled = true; return; }
        prevBtn.disabled = (currentIndex === 0);
        nextBtn.disabled = (currentIndex === pages.length - 1);
    }

    function goToPrev() {
        if (pages.length === 0 || currentIndex === 0) return;
        currentIndex--;
        solutionVisible = false;
        renderCurrentPage();
        updateSolutionButtons();
    }

    function goToNext() {
        if (pages.length === 0 || currentIndex === pages.length - 1) return;
        currentIndex++;
        solutionVisible = false;
        renderCurrentPage();
        updateSolutionButtons();
    }

    // ============================================================
    // 8. FONCTIONS SPÉCIFIQUES : PARAMÈTRES
    // ============================================================
    function handleImageUpload(event) {
        if (isLocked) { showToast('🔒 Carnet verrouillé', 'error');
            imageUpload.value = ''; return; }
        const file = event.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showToast(t('imageError'), 'error');
            imageUpload.value = '';
            return;
        }

        if (currentIndex === 0) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const page = pages[0];
                if (page) {
                    page.imageData = e.target.result;
                    page.isCover = true;
                    sauvegarderEtat();
                    renderCurrentPage();
                    showToast('🖼️ Image de couverture mise à jour (qualité originale)', 'success');
                }
            };
            reader.readAsDataURL(file);
            imageUpload.value = '';
            return;
        }

        showProgress(20);
        const maxSize = 30 * 1024 * 1024;
        if (file.size > maxSize) {
            showToast('⚠️ Image trop volumineuse (max 30MB)', 'error');
            imageUpload.value = '';
            showProgress(0);
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                showProgress(50);
                const base64 = e.target.result;
                if (!base64 || !base64.startsWith('data:image')) {
                    showToast(t('readError'), 'error');
                    imageUpload.value = '';
                    showProgress(0);
                    return;
                }
                showProgress(90);
                if (pages.length === 0) {
                    pages.push({ content: '', solution: '', imageData: base64, isCover: false });
                    currentIndex = 0;
                } else {
                    pages[currentIndex].imageData = base64;
                    pages[currentIndex].isCover = false;
                }
                renderCurrentPage();
                sauvegarderEtat();
                imageUpload.value = '';
                showProgress(100);
                showToast('🖼️ Image insérée (qualité originale)', 'success');
            } catch (err) {
                showToast(t('readError'), 'error');
                imageUpload.value = '';
                showProgress(0);
            }
        };
        reader.onerror = function() {
            showToast(t('readError'), 'error');
            imageUpload.value = '';
            showProgress(0);
        };
        reader.readAsDataURL(file);
    }

    function handleSolutionImageUpload(file, pageIndex) {
        if (isLocked) {
            showToast('🔒 Carnet verrouillé', 'error');
            return;
        }
        const page = pages[pageIndex];
        if (!page) return;

        if (!file || !file.type.startsWith('image/')) {
            showToast(t('imageError'), 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const base64 = e.target.result;
            page.solution = `<img src="${base64}" class="solution-image" alt="Solution" />`;
            sauvegarderEtat();
            renderCurrentPage();
            showToast('🖼️ Image de solution insérée', 'success');
        };
        reader.readAsDataURL(file);
    }

    function addNewPage() {
        if (isLocked) { showToast('🔒 Carnet verrouillé', 'error'); return; }
        if (pages.length >= MAX_PAGES) {
            showToast(t('maxPages'), 'error');
            return;
        }
        pages.push({ content: '', solution: '', imageData: null, isCover: false });
        currentIndex = pages.length - 1;
        solutionVisible = false;
        renderCurrentPage();
        updateSolutionButtons();
        sauvegarderEtat();
        showToast('➕ Page ajoutée', 'success');
    }

    function deleteCurrentPage() {
        if (isLocked) { showToast('🔒 Carnet verrouillé', 'error'); return; }
        if (pages.length === 0) return;
        if (currentIndex === 0) {
            showToast('📖 La page de garde ne peut pas être supprimée.', 'info');
            return;
        }
        if (!confirm(t('confirmDelete'))) return;
        pages.splice(currentIndex, 1);
        if (currentIndex >= pages.length) currentIndex = pages.length - 1;
        solutionVisible = false;
        renderCurrentPage();
        updateSolutionButtons();
        sauvegarderEtat();
        showToast('🗑️ Page supprimée', 'success');
    }

    async function clearAllPages() {
        if (isLocked) { showToast('🔒 Carnet verrouillé', 'error'); return; }
        if (pages.length === 0 || (pages.length === 1 && !pages[0].content && !pages[0].imageData && !pages[0]
                .solution)) {
            showToast('📭 Aucune page à supprimer', 'info');
            return;
        }
        if (!confirm(t('clearConfirm'))) return;

        try {
            showProgress(20);
            await storage.clear();
            showProgress(50);
            pages = [{ content: '', solution: '', imageData: null, isCover: true }];
            currentIndex = 0;
            solutionVisible = false;
            localStorage.removeItem('carnetMeta_100_v5');
            localStorage.removeItem('bookData_100_v5');
            renderCurrentPage();
            updateUILanguage();
            updateSolutionButtons();
            showProgress(100);
            showToast(t('cleared'), 'success');
        } catch (e) {
            console.error('Erreur lors du vidage:', e);
            showToast(t('saveError'), 'error');
            showProgress(0);
        }
    }

    // ============================================================
    // 9. EXPORT (consultation)
    // ============================================================
    function exportData() {
        const data = {
            version: '2.0',
            exportedAt: new Date().toISOString(),
            pages: pages,
            currentIndex: currentIndex,
            lang: currentLang,
            solutionVisible: solutionVisible
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `appixo_book_backup_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(t('exportSuccess'), 'success');
    }

    // ============================================================
    // 10. IMPRESSION / TÉLÉCHARGEMENT (communs)
    // ============================================================
    function printCurrentPage() { window.print(); }

    function downloadCurrentPage() {
        if (pages.length === 0) { showToast(t('noPage'), 'error'); return; }
        const page = pages[currentIndex];
        if (!page || (!page.imageData && !page.solution && !page.isCover)) {
            showToast(t('noImage'), 'info');
            return;
        }

        let bodyContent = '';
        if (currentIndex === 0) {
            bodyContent = `
                    <div style="width:21cm;height:29.7cm;margin:0;padding:0;display:flex;justify-content:center;align-items:center;background:white;overflow:hidden;">
                        <img src="${page.imageData || COVER_DEFAULT}" style="width:100%;height:100%;object-fit:contain;" />
                    </div>
                `;
        } else {
            const hasSolution = page.solution && page.solution.includes('<img');
            const solHtml = hasSolution ? page.solution :
                `<p style="color:#999;font-style:italic;text-align:center;">${t('noSolution')}</p>`;

            const hasImage = page.imageData && page.imageData.length > 100 && page.imageData.startsWith('data:image');
            const imgHtml = hasImage ?
                `<img src="${page.imageData}" style="width:100%;height:100%;object-fit:contain;display:block;border:none;border-radius:0;" />` :
                `<div style="width:100%;height:100%;display:flex;justify-content:center;align-items:center;color:#c5d0e0;font-size:1.2rem;font-style:italic;">${t('noImagePage')}</div>`;

            bodyContent = `
                    <div class="download-a4" style="width:21cm;min-height:29.7cm;margin:0 auto;padding:0;background:white;display:flex;flex-direction:column;box-sizing:border-box;font-family:'Inter',sans-serif;">
                        <div class="exercise-zone" style="padding:0;flex:1;border-bottom:none;background:white;display:flex;align-items:center;justify-content:center;overflow:hidden;">
                            ${imgHtml}
                        </div>
                        <div class="solution-zone-wrapper" style="padding:12px 16px;flex:0 0 auto;background:white;border-top:1px solid #e0e0e0;display:flex;flex-direction:column;">
                            <h4 style="color:#6d28d9;font-size:1rem;margin-bottom:8px;font-weight:700;">💡 ${t('solutionTitle')}</h4>
                            <div style="display:flex;justify-content:center;align-items:center;flex:1;">
                                ${solHtml}
                            </div>
                        </div>
                    </div>
                `;
        }

        const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Page ${currentIndex+1}</title>
                    <style>
                        * { margin:0; padding:0; box-sizing:border-box; }
                        body { background:white; margin:0; padding:0; display:flex; justify-content:center; align-items:center; min-height:100vh; font-family:'Inter',sans-serif; }
                        @page { margin:0; size:A4; }
                        .download-a4 { width:21cm; min-height:29.7cm; margin:0 auto; padding:0; background:white; display:flex; flex-direction:column; box-sizing:border-box; font-family:'Inter',sans-serif; }
                        .download-a4 .exercise-zone { padding:0; flex:1; border-bottom:none; background:white; display:flex; align-items:center; justify-content:center; overflow:hidden; }
                        .download-a4 .exercise-zone img { width:100%; height:100%; object-fit:contain; display:block; border:none; border-radius:0; }
                        .download-a4 .solution-zone-wrapper { padding:12px 16px; flex:0 0 auto; background:white; border-top:1px solid #e0e0e0; display:flex; flex-direction:column; }
                        .download-a4 .solution-zone-wrapper img { max-width:100%; max-height:45vh; object-fit:contain; display:block; margin:0 auto; border:none; border-radius:8px; }
                        .download-a4 .solution-zone-wrapper .placeholder { color:#c5d0e0; font-style:italic; text-align:center; }
                        .download-a4 .solution-header h4 { color:#6d28d9; font-size:1rem; margin-bottom:8px; font-weight:700; }
                        .download-a4 .solution-image-container { border:none; padding:0; box-shadow:none; min-height:0; background:white; }
                        .cover-a4 { width:21cm; height:29.7cm; margin:0; padding:0; display:flex; justify-content:center; align-items:center; background:white; overflow:hidden; }
                        .cover-a4 img { width:100%; height:100%; object-fit:contain; }
                        .upload-btn, .click-hint { display:none !important; }
                    </style>
                </head>
                <body>
                    ${currentIndex === 0 ? `<div class="cover-a4"><img src="${page.imageData || COVER_DEFAULT}" /></div>` : bodyContent}
                </body>
                </html>
            `;

        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `page-${currentIndex+1}-A4.html`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast('⬇️ Téléchargement A4 démarré', 'success');
    }

    // ============================================================
    // 11. SAUVEGARDE / CHARGEMENT
    // ============================================================
    async function sauvegarderEtat() {
        if (isSaving) return;
        isSaving = true;
        try {
            showProgress(20);
            await storage.savePages(pages);
            showProgress(70);
            const meta = {
                currentIndex: currentIndex,
                lang: currentLang,
                pageCount: pages.length,
                isLocked: isLocked,
                solutionVisible: solutionVisible,
                timestamp: Date.now()
            };
            localStorage.setItem('carnetMeta_100_v5', JSON.stringify(meta));
            showProgress(100);
        } catch (e) {
            console.error('❌ Erreur sauvegarde:', e);
            try {
                localStorage.setItem('bookData_100_v5', JSON.stringify({
                    pages: pages,
                    currentIndex: currentIndex,
                    lang: currentLang,
                    isLocked: isLocked,
                    solutionVisible: solutionVisible
                }));
            } catch (e2) {
                showToast(t('saveError'), 'error');
            }
        }
        isSaving = false;
    }

    async function sauvegarderExplicite() {
        showToast(t('saving'), 'info');
        await sauvegarderEtat();
        showToast(t('saved'), 'success');
    }

    async function loadState() {
        try {
            const pagesFromDB = await storage.loadPages();
            if (pagesFromDB && pagesFromDB.length > 0) {
                pages = pagesFromDB;
                const meta = localStorage.getItem('carnetMeta_100_v5');
                if (meta) {
                    const parsed = JSON.parse(meta);
                    currentIndex = (parsed.currentIndex !== undefined && parsed.currentIndex < pages.length) ?
                        parsed.currentIndex : 0;
                    if (parsed.lang) currentLang = parsed.lang;
                    if (parsed.isLocked !== undefined) isLocked = parsed.isLocked;
                    if (parsed.solutionVisible !== undefined) solutionVisible = parsed.solutionVisible;
                }
                if (pages.length > 0) pages[0].isCover = true;
                if (pages.length === 0) {
                    pages = [{ content: '', solution: '', imageData: null, isCover: true }];
                    currentIndex = 0;
                }
                updateLangButtons();
                updateUILanguage();
                if (isLocked && isParametres) {
                    if (lockLabel) {
                        lockLabel.textContent = t('unlock');
                        lockBtn.classList.add('locked');
                    }
                    applyLockState(true);
                    showLockOverlay();
                } else {
                    if (lockLabel) {
                        lockLabel.textContent = t('lock');
                        lockBtn.classList.remove('locked');
                    }
                    applyLockState(false);
                    hideLockOverlay();
                }
                renderCurrentPage();
                updateSolutionButtons();
                return true;
            }

            const raw = localStorage.getItem('bookData_100_v5');
            if (raw) {
                const data = JSON.parse(raw);
                if (data.pages && Array.isArray(data.pages) && data.pages.length > 0) {
                    pages = data.pages;
                    currentIndex = (data.currentIndex !== undefined && data.currentIndex < pages.length) ?
                        data.currentIndex : 0;
                    if (data.lang) currentLang = data.lang;
                    if (data.isLocked !== undefined) isLocked = data.isLocked;
                    if (data.solutionVisible !== undefined) solutionVisible = data.solutionVisible;
                    if (pages.length > 0) pages[0].isCover = true;
                    await storage.savePages(pages);
                    localStorage.setItem('carnetMeta_100_v5', JSON.stringify({
                        currentIndex: currentIndex,
                        lang: currentLang,
                        pageCount: pages.length,
                        isLocked: isLocked,
                        solutionVisible: solutionVisible,
                        timestamp: Date.now()
                    }));
                    updateLangButtons();
                    updateUILanguage();
                    if (isLocked && isParametres) {
                        if (lockLabel) {
                            lockLabel.textContent = t('unlock');
                            lockBtn.classList.add('locked');
                        }
                        applyLockState(true);
                        showLockOverlay();
                    } else {
                        if (lockLabel) {
                            lockLabel.textContent = t('lock');
                            lockBtn.classList.remove('locked');
                        }
                        applyLockState(false);
                        hideLockOverlay();
                    }
                    renderCurrentPage();
                    updateSolutionButtons();
                    return true;
                }
            }
            return false;
        } catch (e) {
            console.warn('⚠️ Erreur chargement:', e);
            return false;
        }
    }

    // ============================================================
    // 12. CHARGEMENT DEPUIS URL (consultation)
    // ============================================================
    function loadFromURLParam() {
        if (!isConsultation) return false;
        const urlParams = new URLSearchParams(window.location.search);
        const dataParam = urlParams.get('data');
        if (!dataParam) return false;

        try {
            const decoded = atob(dataParam);
            const parsed = JSON.parse(decoded);
            if (!parsed.pages || !Array.isArray(parsed.pages)) {
                throw new Error('Format invalide');
            }
            pages = parsed.pages;
            if (parsed.currentIndex !== undefined && parsed.currentIndex < pages.length) {
                currentIndex = parsed.currentIndex;
            } else {
                currentIndex = 0;
            }
            if (parsed.lang) currentLang = parsed.lang;
            if (parsed.solutionVisible !== undefined) solutionVisible = parsed.solutionVisible;
            if (pages.length > 0) pages[0].isCover = true;

            sauvegarderEtat().then(() => {
                showToast(t('dataLoaded'), 'success');
                renderCurrentPage();
                updateUILanguage();
                updateSolutionButtons();
            });
            return true;
        } catch (e) {
            console.error('Erreur chargement paramètre URL:', e);
            showToast(t('dataLoadError'), 'error');
            return false;
        }
    }

    // ============================================================
    // 13. VALIDATION (paramètres) : sauvegarde + redirection
    // ============================================================
    function validateAndRedirect() {
        sauvegarderExplicite();
        setTimeout(() => {
            window.location.href = 'site.html';
        }, 800);
    }

    // ============================================================
    // 14. MENU (paramètres)
    // ============================================================
    function toggleMenu() {
        if (!isParametres) return;
        menuOpen = !menuOpen;
        bottomActions.classList.toggle('open', menuOpen);
        settingsToggle.classList.toggle('active', menuOpen);
    }

    // ============================================================
    // 15. SWIPE
    // ============================================================
    let startX = 0,
        isSwiping = false;

    function handleTouchStart(e) { const touch = e.touches[0];
        startX = touch.clientX;
        isSwiping = true; }

    function handleTouchEnd(e) {
        if (!isSwiping) return;
        isSwiping = false;
        const endX = e.changedTouches[0].clientX;
        const diff = startX - endX;
        if (Math.abs(diff) > 50) { diff > 0 ? goToNext() : goToPrev(); }
    }

    let mouseDown = false,
        mouseStartX = 0;

    function handleMouseDown(e) { mouseDown = true;
        mouseStartX = e.clientX;
        bookView.style.cursor = 'grabbing'; }

    function handleMouseUp(e) {
        if (!mouseDown) return;
        mouseDown = false;
        bookView.style.cursor = 'default';
        const diff = mouseStartX - e.clientX;
        if (Math.abs(diff) > 50) { diff > 0 ? goToNext() : goToPrev(); }
    }

    // ============================================================
    // 16. INIT
    // ============================================================
    async function init() {
        // Chargement depuis URL (consultation)
        const loadedFromParam = loadFromURLParam();

        if (!loadedFromParam) {
            const loaded = await loadState();
            if (!loaded) {
                pages = [{ content: '', solution: '', imageData: null, isCover: true }];
                currentIndex = 0;
                isLocked = false;
                solutionVisible = false;
                renderCurrentPage();
                updateSolutionButtons();
                await storage.savePages(pages);
            }
        }

        updateUILanguage();

        if (lockOverlay.classList.contains('active')) {
            lockPassword.focus();
        }

        // Événements communs
        bookView.addEventListener('touchstart', handleTouchStart, { passive: true });
        bookView.addEventListener('touchend', handleTouchEnd, { passive: true });
        bookView.addEventListener('mousedown', handleMouseDown);
        bookView.addEventListener('mouseup', handleMouseUp);
        bookView.addEventListener('mouseleave', () => { if (mouseDown) { mouseDown = false;
                bookView.style.cursor = 'default'; } });

        if (showSolutionTopBtn && hideSolutionTopBtn) {
            showSolutionTopBtn.addEventListener('click', function() { toggleSolutionFromTop(true); });
            hideSolutionTopBtn.addEventListener('click', function() { toggleSolutionFromTop(false); });
        }

        // Lock overlay
        lockUnlockBtn.addEventListener('click', attemptUnlock);
        lockPassword.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                attemptUnlock();
            }
        });

        // Lightbox
        lightboxCloseBtn.addEventListener('click', closeLightbox);
        lightboxOverlay.addEventListener('click', function(e) {
            if (e.target === this) closeLightbox();
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') closeLightbox();
        });

        // Navigation
        prevBtn.addEventListener('click', goToPrev);
        nextBtn.addEventListener('click', goToNext);
        printBtn.addEventListener('click', printCurrentPage);
        downloadBtn.addEventListener('click', downloadCurrentPage);

        // Langue
        document.getElementById('langFr').addEventListener('click', () => setLanguage('fr'));
        document.getElementById('langEn').addEventListener('click', () => setLanguage('en'));
        document.getElementById('langAr').addEventListener('click', () => setLanguage('ar'));

        // Spécifique consultation
        if (isConsultation && exportBtn) {
            exportBtn.addEventListener('click', exportData);
        }

        // Spécifique paramètres
        if (isParametres) {
            if (addBtn) addBtn.addEventListener('click', addNewPage);
            if (deleteBtn) deleteBtn.addEventListener('click', deleteCurrentPage);
            if (clearAllBtn) clearAllBtn.addEventListener('click', clearAllPages);
            if (imageUpload) imageUpload.addEventListener('change', handleImageUpload);
            if (saveExplicitBtn) saveExplicitBtn.addEventListener('click', sauvegarderExplicite);
            if (lockBtn) lockBtn.addEventListener('click', toggleLock);
            if (validateBtn) validateBtn.addEventListener('click', validateAndRedirect);
            if (settingsToggle) settingsToggle.addEventListener('click', toggleMenu);
            // clic sur la vue pour ouvrir/fermer le menu
            bookView.addEventListener('click', function(e) {
                if (e.target.closest('button') || e.target.closest('label') || e.target.closest('.lang-switch'))
                    return;
                toggleMenu();
            });
        }

        const stats = await storage.getStats();
        console.log('📊 Statistiques:', stats);
        console.log(`📖 Appixo Book · ${isConsultation ? 'Consultation' : 'Paramètres'} · Prêt`);
    }

    init();
})();