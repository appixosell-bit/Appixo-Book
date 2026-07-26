// =====================================================
// STOCKAGE INDEXEDDB + LOCALSTORAGE (FALLBACK)
// =====================================================
class PersistentStorage {
    constructor() {
        this.dbName = 'CarnetA4_100_v8';
        this.storeName = 'pages';
        this.version = 10;
        this.db = null;
        this.ready = false;
        this.initPromise = null;
        this.MAX_IMAGES = 100;
        this.fallbackKey = 'appixo_book_fallback';
    }

    init() {
        if (this.initPromise) return this.initPromise;
        this.initPromise = new Promise((resolve) => {
            try {
                const request = indexedDB.open(this.dbName, this.version);
                request.onerror = () => {
                    console.warn('⚠️ IndexedDB indisponible, fallback localStorage');
                    this.ready = false;
                    resolve(false);
                };
                request.onsuccess = (e) => {
                    this.db = e.target.result;
                    this.ready = true;
                    console.log('✅ IndexedDB prêt');
                    resolve(true);
                };
                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(this.storeName)) {
                        const store = db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
                        store.createIndex('timestamp', 'timestamp', { unique: false });
                        store.createIndex('pageIndex', 'pageIndex', { unique: false });
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
            } catch (e) {
                console.warn('⚠️ IndexedDB non supporté, fallback localStorage');
                this.ready = false;
                resolve(false);
            }
        });
        return this.initPromise;
    }

    async savePages(pages) {
        const isReady = await this.init();
        if (isReady) {
            try {
                await this._saveToIndexedDB(pages);
            } catch (e) {
                console.warn('⚠️ Sauvegarde IndexedDB échouée, fallback localStorage');
                this._saveToLocalStorage(pages);
            }
        } else {
            this._saveToLocalStorage(pages);
        }
        this._saveToLocalStorage(pages);
    }

    _saveToLocalStorage(pages) {
        try {
            localStorage.setItem(this.fallbackKey, JSON.stringify(pages));
            console.log('💾 Sauvegarde localStorage OK');
        } catch (e) {
            console.error('❌ Erreur sauvegarde localStorage:', e);
        }
    }

    _saveToIndexedDB(pages) {
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
                        imagePath: page.imagePath || null,
                        isCover: page.isCover || false,
                        timestamp: Date.now() + i,
                        pageIndex: i
                    };
                    const addRequest = store.add(data);
                    addRequest.onsuccess = () => {
                        saved++;
                        if (saved === total) resolve();
                    };
                    addRequest.onerror = (e) => reject(e.target.error);
                }
                if (total === 0) resolve();
            };
            clearRequest.onerror = (e) => reject(e.target.error);
        });
    }

    async loadPages() {
        const isReady = await this.init();
        if (isReady) {
            try {
                const pages = await this._loadFromIndexedDB();
                if (pages && pages.length > 0) {
                    return pages;
                }
            } catch (e) {
                console.warn('⚠️ Chargement IndexedDB échoué, fallback localStorage');
            }
        }
        return this._loadFromLocalStorage();
    }

    _loadFromIndexedDB() {
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
                    imagePath: item.imagePath || null,
                    isCover: item.isCover || false
                }));
                resolve(pages);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    _loadFromLocalStorage() {
        try {
            const raw = localStorage.getItem(this.fallbackKey);
            if (raw) {
                const pages = JSON.parse(raw);
                if (Array.isArray(pages) && pages.length > 0) {
                    console.log('📂 Chargé depuis localStorage (' + pages.length + ' pages)');
                    return pages;
                }
            }
        } catch (e) {
            console.warn('Erreur lecture localStorage:', e);
        }
        return [];
    }

    async clear() {
        const isReady = await this.init();
        if (isReady) {
            try { await this._clearIndexedDB(); } catch (e) { /* ignore */ }
        }
        localStorage.removeItem(this.fallbackKey);
    }

    _clearIndexedDB() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }
}

// =====================================================
// DONNÉES PAR DÉFAUT (images depuis le dossier images/)
// =====================================================
const DEFAULT_PAGES = [
    {
        content: '',
        solution: '',
        imagePath: 'images/cover-default.svg',
        isCover: true
    },
    {
        content: '',
        solution: '',
        imagePath: 'images/page1-couverture.png',
        isCover: false
    },
    {
        content: '',
        solution: '',
        imagePath: 'images/page2-image1.png',
        isCover: false
    }
];

// =====================================================
// APPLICATION CONSULTATION
// =====================================================
const storage = new PersistentStorage();
const MAX_PAGES = 100;
const PASSWORD = 'MonCarnet2026!@#Secure';
const DEFAULT_COVER = 'images/cover-default.svg';

let pages = [];
let currentIndex = 0;
let currentLang = 'fr';
let solutionVisible = false;

const translations = {
    fr: {
        pageLabel: 'Page', noPages: '📭 Aucune page',
        prev: 'Préc.', next: 'Suiv.', print: 'Imprimer', download: 'Téléch.', export: 'Sauvegarder',
        noImage: 'Cette page est vide.', noPage: 'Aucune page à télécharger.',
        solutionTitle: '💡 Solution',
        noSolution: 'Aucune solution enregistrée pour cette page.',
        solutionPlaceholder: '📸 Aucune image de solution',
        dropHint: 'Déposez une image ici ou cliquez sur "Image"',
        noImagePage: 'Aucune image sur cette page',
        wrongPassword: '❌ Mot de passe incorrect !',
        unlocked: '🔓 Carnet déverrouillé',
        showSolution: '👁️ Afficher', hideSolution: '🔽 Masquer',
        solutionHidden: '🔽 Solution masquée',
        solutionShown: '💡 Solution affichée',
        translated: '🌐 Traduit',
        clickToZoom: 'Cliquez pour agrandir',
        exportSuccess: '✅ Données exportées avec succès !',
        dataLoaded: '📥 Données chargées depuis le paramètre URL',
        dataLoadError: '❌ Erreur de chargement des données depuis l\'URL',
    },
    en: {
        pageLabel: 'Page', noPages: '📭 No pages',
        prev: 'Prev', next: 'Next', print: 'Print', download: 'Download', export: 'Export',
        noImage: 'This page is empty.', noPage: 'No page to download.',
        solutionTitle: '💡 Solution',
        noSolution: 'No solution saved for this page.',
        solutionPlaceholder: '📸 No solution image',
        dropHint: 'Drop an image here or click "Image"',
        noImagePage: 'No image on this page',
        wrongPassword: '❌ Wrong password!',
        unlocked: '🔓 Notebook unlocked',
        showSolution: '👁️ Show', hideSolution: '🔽 Hide',
        solutionHidden: '🔽 Solution hidden',
        solutionShown: '💡 Solution shown',
        translated: '🌐 Translated',
        clickToZoom: 'Click to zoom',
        exportSuccess: '✅ Data exported successfully!',
        dataLoaded: '📥 Data loaded from URL parameter',
        dataLoadError: '❌ Error loading data from URL',
    },
    ar: {
        pageLabel: 'صفحة', noPages: '📭 لا توجد صفحات',
        prev: 'السابق', next: 'التالي', print: 'طباعة', download: 'تحميل', export: 'تصدير',
        noImage: 'هذه الصفحة فارغة.', noPage: 'لا توجد صفحة لتحميلها.',
        solutionTitle: '💡 الحل',
        noSolution: 'لا يوجد حل محفوظ لهذه الصفحة.',
        solutionPlaceholder: '📸 لا توجد صورة للحل',
        dropHint: 'اسحب صورة هنا أو انقر على "صورة"',
        noImagePage: 'لا توجد صورة في هذه الصفحة',
        wrongPassword: '❌ كلمة المرور غير صحيحة!',
        unlocked: '🔓 الدفتر مفتوح',
        showSolution: '👁️ عرض', hideSolution: '🔽 إخفاء',
        solutionHidden: '🔽 الحل مخفي',
        solutionShown: '💡 الحل معروض',
        translated: '🌐 مترجم',
        clickToZoom: 'انقر للتكبير',
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
const printBtn = document.getElementById('printPageBtn');
const downloadBtn = document.getElementById('downloadPageBtn');
const prevBtn = document.getElementById('prevPageBtn');
const nextBtn = document.getElementById('nextPageBtn');
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
const exportBtn = document.getElementById('exportBtn');

const translatable = {
    prevText: document.getElementById('prevText'),
    nextText: document.getElementById('nextText'),
    printText: document.getElementById('printText'),
    downloadText: document.getElementById('downloadText'),
    exportText: document.getElementById('exportText'),
};

// --- Toast ---
let toastTimeout = null;
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
    }, 3000);
}

// --- Progress ---
function showProgress(percent) {
    progressBar.classList.add('active');
    progressFill.style.width = percent + '%';
    if (percent >= 100) {
        setTimeout(() => {
            progressBar.classList.remove('active');
            progressFill.style.width = '0%';
        }, 400);
    }
}

// --- Lock ---
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
        hideLockOverlay();
        showToast(t('unlocked'), 'success');
        renderCurrentPage();
    } else {
        lockError.classList.add('show');
        lockPassword.value = '';
        lockPassword.focus();
        showToast(t('wrongPassword'), 'error');
    }
}

// --- Langue ---
function updateUILanguage() {
    pageLabel.textContent = t('pageLabel');
    pageCounter.textContent = `(${pages.length}/${MAX_PAGES})`;
    translatable.prevText.textContent = t('prev');
    translatable.nextText.textContent = t('next');
    translatable.printText.textContent = t('print');
    translatable.downloadText.textContent = t('download');
    translatable.exportText.textContent = t('export');
    translateBadge.textContent = t('translated');

    showSolutionTopBtn.textContent = t('showSolution');
    hideSolutionTopBtn.textContent = t('hideSolution');

    const container = document.getElementById('bookContainer');
    container.style.direction = (currentLang === 'ar') ? 'rtl' : 'ltr';
}

function setLanguage(lang) {
    if (lang === currentLang) return;
    currentLang = lang;
    document.querySelectorAll('.lang-switch button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === currentLang);
    });
    updateUILanguage();
    renderCurrentPage();
    sauvegarderEtat();
}

// --- Solution ---
function updateSolutionButtons() {
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

// --- Export ---
function exportData() {
    const data = {
        version: '2.3',
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
// RENDU
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

    if (currentIndex === 0) {
        page.isCover = true;
        const coverImage = page.imagePath || DEFAULT_COVER;
        pageContent.innerHTML = `
                <div class="page-cover" onclick="openLightbox('${coverImage}')">
                    <img src="${coverImage}" class="cover-main" alt="Page de garde" draggable="false" />
                    <div class="click-hint">🔍 ${t('clickToZoom')}</div>
                </div>
            `;
        translateBadge.classList.remove('active');
        updateNavButtons();
        showSolutionTopBtn.style.display = 'none';
        hideSolutionTopBtn.style.display = 'none';
        return;
    }

    page.isCover = false;
    showSolutionTopBtn.style.display = 'inline-flex';
    updateSolutionButtons();

    const hasImage = page.imagePath && page.imagePath.length > 0;

    let exerciseHtml = '';
    if (hasImage) {
        exerciseHtml = `
                <img src="${page.imagePath}" class="full-page-image" alt="Exercice" draggable="false" onclick="openLightbox('${page.imagePath}')" />
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
        const srcMatch = page.solution.match(/src=["']([^"']+)["']/);
        const solutionSrc = srcMatch ? srcMatch[1] : '';
        solutionHtml = page.solution.replace(
            /<img/,
            `<img onclick="openLightbox('${solutionSrc}')" style="cursor:pointer;"`
        );
    } else {
        solutionHtml = `<div class="placeholder">${t('solutionPlaceholder')}</div>`;
    }

    const solutionClass = solutionVisible ? '' : 'hidden';

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
                </div>
            </div>
        `;

    const solutionImg = document.querySelector('.solution-image-container .solution-image');
    if (solutionImg && !solutionImg.hasAttribute('onclick')) {
        const src = solutionImg.getAttribute('src');
        if (src) {
            solutionImg.style.cursor = 'pointer';
            solutionImg.addEventListener('click', function(e) {
                e.stopPropagation();
                openLightbox(src);
            });
        }
    }

    translateBadge.classList.remove('active');
    updateNavButtons();
}

function updateNavButtons() {
    if (pages.length === 0) { prevBtn.disabled = true; nextBtn.disabled = true; return; }
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

// --- Print ---
function printCurrentPage() { window.print(); }

// --- Download ---
function downloadCurrentPage() {
    if (pages.length === 0) { showToast(t('noPage'), 'error'); return; }
    const page = pages[currentIndex];
    if (!page || (!page.imagePath && !page.solution && !page.isCover)) {
        showToast(t('noImage'), 'info');
        return;
    }

    let bodyContent = '';
    if (currentIndex === 0) {
        const imgSrc = page.imagePath || DEFAULT_COVER;
        bodyContent = `
                <div style="width:21cm;height:29.7cm;margin:0;padding:0;display:flex;justify-content:center;align-items:center;background:white;overflow:hidden;">
                    <img src="${imgSrc}" style="width:100%;height:100%;object-fit:contain;" />
                </div>
            `;
    } else {
        const hasSolution = page.solution && page.solution.includes('<img');
        const solHtml = hasSolution ? page.solution :
            `<p style="color:#999;font-style:italic;text-align:center;">${t('noSolution')}</p>`;

        const hasImage = page.imagePath && page.imagePath.length > 0;
        const imgHtml = hasImage ?
            `<img src="${page.imagePath}" style="width:100%;height:100%;object-fit:contain;display:block;border:none;border-radius:0;" />` :
            `<div style="width:100%;height:100%;display:flex;justify-content:center;align-items:center;color:#c5d0e0;font-size:1.2rem;font-style:italic;">${t('noImagePage')}</div>`;

        bodyContent = `
                <div style="width:21cm;min-height:29.7cm;margin:0 auto;padding:0;background:white;display:flex;flex-direction:column;box-sizing:border-box;font-family:system-ui,sans-serif;">
                    <div style="padding:0;flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;">
                        ${imgHtml}
                    </div>
                    <div style="padding:12px 16px;flex:0 0 auto;background:white;border-top:1px solid #e0e0e0;">
                        <h4 style="color:#6d28d9;font-size:1rem;margin-bottom:8px;font-weight:700;">💡 ${t('solutionTitle')}</h4>
                        <div style="display:flex;justify-content:center;align-items:center;">
                            ${solHtml}
                        </div>
                    </div>
                </div>
            `;
    }

    const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head><meta charset="UTF-8"><title>Page ${currentIndex+1}</title>
            <style>
                * { margin:0; padding:0; box-sizing:border-box; }
                body { background:white; margin:0; padding:0; display:flex; justify-content:center; align-items:center; min-height:100vh; font-family:system-ui,sans-serif; }
                @page { margin:0; size:A4; }
                .download-a4 { width:21cm; min-height:29.7cm; margin:0 auto; padding:0; background:white; display:flex; flex-direction:column; box-sizing:border-box; font-family:system-ui,sans-serif; }
                .download-a4 .exercise-zone { padding:0; flex:1; border-bottom:none; background:white; display:flex; align-items:center; justify-content:center; overflow:hidden; }
                .download-a4 .exercise-zone img { width:100%; height:100%; object-fit:contain; display:block; border:none; border-radius:0; }
                .download-a4 .solution-zone-wrapper { padding:12px 16px; flex:0 0 auto; background:white; border-top:1px solid #e0e0e0; }
                .download-a4 .solution-zone-wrapper img { max-width:100%; max-height:45vh; object-fit:contain; display:block; margin:0 auto; border:none; border-radius:8px; }
                .download-a4 .solution-zone-wrapper .placeholder { color:#c5d0e0; font-style:italic; text-align:center; }
                .download-a4 .solution-header h4 { color:#6d28d9; font-size:1rem; margin-bottom:8px; font-weight:700; }
                .cover-a4 { width:21cm; height:29.7cm; margin:0; padding:0; display:flex; justify-content:center; align-items:center; background:white; overflow:hidden; }
                .cover-a4 img { width:100%; height:100%; object-fit:contain; }
                .click-hint { display:none !important; }
            </style>
            </head>
            <body>
                ${currentIndex === 0 ? `<div class="cover-a4"><img src="${page.imagePath || DEFAULT_COVER}" /></div>` : bodyContent}
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

// --- Sauvegarde ---
async function sauvegarderEtat() {
    await storage.savePages(pages);
    try {
        const meta = {
            currentIndex: currentIndex,
            lang: currentLang,
            pageCount: pages.length,
            solutionVisible: solutionVisible,
            timestamp: Date.now()
        };
        localStorage.setItem('carnetMeta_100_v5', JSON.stringify(meta));
    } catch (e) { /* ignore */ }
    console.log('💾 Sauvegarde effectuée');
}

// --- Chargement ---
async function loadState() {
    let loadedPages = await storage.loadPages();
    if (loadedPages && loadedPages.length > 0) {
        pages = loadedPages;
        const meta = localStorage.getItem('carnetMeta_100_v5');
        if (meta) {
            try {
                const parsed = JSON.parse(meta);
                currentIndex = (parsed.currentIndex !== undefined && parsed.currentIndex < pages.length) ?
                    parsed.currentIndex : 0;
                if (parsed.lang) currentLang = parsed.lang;
                if (parsed.solutionVisible !== undefined) solutionVisible = parsed.solutionVisible;
            } catch (e) { /* ignore */ }
        }
        if (pages.length > 0) pages[0].isCover = true;
        return true;
    }
    return false;
}

// --- Chargement depuis paramètre URL ---
function loadFromURLParam() {
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

// --- Swipe ---
let startX = 0, isSwiping = false;
function handleTouchStart(e) { const touch = e.touches[0]; startX = touch.clientX; isSwiping = true; }
function handleTouchEnd(e) {
    if (!isSwiping) return;
    isSwiping = false;
    const endX = e.changedTouches[0].clientX;
    const diff = startX - endX;
    if (Math.abs(diff) > 40) { diff > 0 ? goToNext() : goToPrev(); }
}
let mouseDown = false, mouseStartX = 0;
function handleMouseDown(e) { mouseDown = true; mouseStartX = e.clientX; }
function handleMouseUp(e) {
    if (!mouseDown) return;
    mouseDown = false;
    const diff = mouseStartX - e.clientX;
    if (Math.abs(diff) > 40) { diff > 0 ? goToNext() : goToPrev(); }
}

// ============================================================
// INITIALISATION
// ============================================================
async function initBook() {
    showLockOverlay();

    const loadedFromParam = loadFromURLParam();

    if (!loadedFromParam) {
        const loaded = await loadState();
        if (!loaded) {
            // Utiliser les pages par défaut avec les chemins d'images
            pages = JSON.parse(JSON.stringify(DEFAULT_PAGES));
            currentIndex = 0;
            solutionVisible = false;
            await storage.savePages(pages);
        }
    }

    document.querySelectorAll('.lang-switch button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === currentLang);
    });
    updateUILanguage();
    renderCurrentPage();
    updateSolutionButtons();

    bookView.addEventListener('touchstart', handleTouchStart, { passive: true });
    bookView.addEventListener('touchend', handleTouchEnd, { passive: true });
    bookView.addEventListener('mousedown', handleMouseDown);
    bookView.addEventListener('mouseup', handleMouseUp);
    bookView.addEventListener('mouseleave', () => { mouseDown = false; });

    showSolutionTopBtn.addEventListener('click', function() { toggleSolutionFromTop(true); });
    hideSolutionTopBtn.addEventListener('click', function() { toggleSolutionFromTop(false); });

    lockUnlockBtn.addEventListener('click', attemptUnlock);
    lockPassword.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); attemptUnlock(); }
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

    document.getElementById('langFr').addEventListener('click', () => setLanguage('fr'));
    document.getElementById('langEn').addEventListener('click', () => setLanguage('en'));
    document.getElementById('langAr').addEventListener('click', () => setLanguage('ar'));

    exportBtn.addEventListener('click', exportData);

    const stats = await storage.loadPages();
    console.log('📊 Nombre de pages chargées:', stats.length);
}

// Démarrer l'application
initBook();
console.log('📖 Appixo Book · Consultation v2.3 · Mobile-friendly');