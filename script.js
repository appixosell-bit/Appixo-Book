(function() {
    "use strict";

    // ==================== CONFIG ====================
    const ACCESS_CODE = "408408$$";
    const ADMIN_PASS = "Labdl408//";

    // État global
    let currentPage = 1;
    let totalPages = 1;
    let language = 'fr';
    let adminVisible = false;
    let pagesData = [];

    // DOM refs
    const pageText = document.getElementById('pageText');
    const imageArea = document.getElementById('imageArea');
    const pageIndicator = document.getElementById('pageIndicator');
    const adminPanel = document.getElementById('adminPanel');
    const settingsToggle = document.getElementById('settingsToggle');
    const langSelector = document.getElementById('langSelector');

    // ==================== STOCKAGE ====================
    function loadFromStorage() {
        try {
            const stored = localStorage.getItem('bookPages');
            if (stored) {
                pagesData = JSON.parse(stored);
                if (!Array.isArray(pagesData) || pagesData.length === 0) {
                    pagesData = [{ text: 'Bienvenue dans votre livre numérique.', images: [] }];
                }
            } else {
                pagesData = [{ text: 'Bienvenue dans votre livre numérique.', images: [] }];
            }
            pagesData = pagesData.map(p => {
                if (!p.images) p.images = [];
                if (!p.text) p.text = 'Nouvelle page';
                return p;
            });
            totalPages = pagesData.length;
            if (currentPage > totalPages) currentPage = totalPages;
            if (currentPage < 1) currentPage = 1;
        } catch (e) {
            pagesData = [{ text: 'Bienvenue dans votre livre numérique.', images: [] }];
            totalPages = 1;
            currentPage = 1;
        }

        const langStored = localStorage.getItem('bookLang');
        if (langStored) language = langStored;
        langSelector.value = language;
        applyLanguage(language);

        const lastPage = localStorage.getItem('bookLastPage');
        if (lastPage) {
            const lp = parseInt(lastPage, 10);
            if (lp >= 1 && lp <= totalPages) currentPage = lp;
        }
    }

    function saveToStorage() {
        localStorage.setItem('bookPages', JSON.stringify(pagesData));
        localStorage.setItem('bookLang', language);
        localStorage.setItem('bookLastPage', String(currentPage));
    }

    // ==================== AFFICHAGE ====================
    function renderPage() {
        if (!pagesData.length) {
            pagesData = [{ text: 'Page vide', images: [] }];
            totalPages = 1;
            currentPage = 1;
        }
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const page = pagesData[currentPage - 1];
        if (!page) return;

        pageText.innerText = page.text || '';

        imageArea.innerHTML = '';
        if (page.images && page.images.length) {
            page.images.forEach(imgSrc => {
                const img = document.createElement('img');
                img.src = imgSrc;
                img.alt = 'Image de la page';
                img.loading = 'lazy';
                imageArea.appendChild(img);
            });
        } else {
            const placeholder = document.createElement('div');
            placeholder.style.cssText = 'padding: 28px; color: #8aa9c9; font-weight: 400; background: rgba(200,220,245,0.2); border-radius: 28px; width:100%; text-align:center;';
            placeholder.innerText = '🖼️ ' + (language === 'fr' ? 'Aucune image' : language === 'ar' ? 'لا توجد صور' : 'No image');
            imageArea.appendChild(placeholder);
        }

        pageIndicator.innerText = `Page ${currentPage} / ${totalPages}`;
        saveToStorage();
    }

    // ==================== LANGUE ====================
    const i18n = {
        fr: {
            prev: 'Précédent', next: 'Suivant', print: 'Imprimer', download: 'PNG',
            addPage: 'Ajouter page', deletePage: 'Supprimer page', addImage: 'Ajouter image',
            deleteImage: 'Supprimer image', clearHtml: 'Vider HTML', editText: 'Modifier le texte'
        },
        ar: {
            prev: 'السابق', next: 'التالي', print: 'طباعة', download: 'PNG',
            addPage: 'إضافة صفحة', deletePage: 'حذف صفحة', addImage: 'إضافة صورة',
            deleteImage: 'حذف صورة', clearHtml: 'مسح HTML', editText: 'تحرير النص'
        },
        en: {
            prev: 'Previous', next: 'Next', print: 'Print', download: 'PNG',
            addPage: 'Add page', deletePage: 'Delete page', addImage: 'Add image',
            deleteImage: 'Delete image', clearHtml: 'Clear HTML', editText: 'Edit text'
        }
    };

    function applyLanguage(lang) {
        language = lang;
        document.documentElement.lang = lang;
        if (lang === 'ar') {
            document.body.classList.add('rtl');
        } else {
            document.body.classList.remove('rtl');
        }

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (i18n[lang] && i18n[lang][key]) {
                el.innerText = i18n[lang][key];
            }
        });

        const placeholderKey = 'editText';
        if (i18n[lang] && i18n[lang][placeholderKey]) {
            pageText.setAttribute('placeholder', i18n[lang][placeholderKey]);
        }

        renderPage();
        saveToStorage();
    }

    // ==================== NAVIGATION ====================
    function goPrev() {
        if (currentPage > 1) { currentPage--; renderPage(); }
    }

    function goNext() {
        if (currentPage < totalPages) { currentPage++; renderPage(); }
    }

    // ==================== ADMIN ====================
    function toggleAdmin() {
        if (!adminVisible) {
            const pass = prompt('🔐 Mot de passe administrateur :');
            if (pass === ADMIN_PASS) {
                adminVisible = true;
                adminPanel.classList.add('open');
            } else {
                alert('Accès refusé.');
            }
        } else {
            adminVisible = false;
            adminPanel.classList.remove('open');
        }
    }

    function addPage() {
        pagesData.push({ text: 'Nouvelle page', images: [] });
        totalPages = pagesData.length;
        currentPage = totalPages;
        renderPage();
    }

    function deletePage() {
        if (totalPages <= 1) { alert('Impossible de supprimer la dernière page.'); return; }
        if (confirm('Supprimer cette page ?')) {
            pagesData.splice(currentPage - 1, 1);
            totalPages = pagesData.length;
            if (currentPage > totalPages) currentPage = totalPages;
            renderPage();
        }
    }

    function addImage() {
        const url = prompt('Entrez l\'URL de l\'image (ou nom dans images/) :');
        if (url && url.trim()) {
            const page = pagesData[currentPage - 1];
            if (!page.images) page.images = [];
            page.images.push(url.trim());
            renderPage();
        }
    }

    function deleteImage() {
        const page = pagesData[currentPage - 1];
        if (!page.images || page.images.length === 0) {
            alert('Aucune image sur cette page.');
            return;
        }
        page.images.pop();
        renderPage();
    }

    function clearHtml() {
        if (confirm('Vider le contenu texte de cette page ?')) {
            pagesData[currentPage - 1].text = '';
            renderPage();
        }
    }

    // ==================== IMPRESSION & PNG ====================
    function printPage() {
        window.print();
    }

    function downloadPng() {
        alert('💡 Utilisez la fonction "Imprimer" puis "Enregistrer au format PDF" pour un rendu PNG.\nOu utilisez une extension de capture.');
    }

    // ==================== ACCÈS ====================
    function checkAccess() {
        const code = prompt('🔑 Code d\'accès au livre numérique :');
        if (code !== ACCESS_CODE) {
            document.body.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:center; height:100vh; font-family:'Poppins'; background: #eaf3fc; color:#1e3d5e; font-size:1.6rem; flex-direction:column; gap:20px; text-align:center; padding:20px;">
                    <i class="fas fa-lock" style="font-size:4rem; color:#4b7aa1;"></i>
                    <span>⛔ Accès refusé. Code incorrect.</span>
                    <button onclick="location.reload()" style="padding:12px 32px; border:none; background:#2b6c9e; color:white; border-radius:60px; font-size:1rem; cursor:pointer;">Réessayer</button>
                </div>
            `;
            throw new Error('Accès refusé');
        }
    }

    // ==================== CHARGEMENT AUTO IMAGES ====================
    function autoLoadImagesFromFolder() {
        const imageNames = [
            'page1-image1.jpg', 'page1-image2.png', 'page2-image1.webp', 'page3-image1.jpg'
        ];
        const mapping = {};
        imageNames.forEach(name => {
            const match = name.match(/^page(\d+)-/);
            if (match) {
                const pageNum = parseInt(match[1], 10);
                if (!mapping[pageNum]) mapping[pageNum] = [];
                mapping[pageNum].push('images/' + name);
            }
        });

        pagesData.forEach((page, idx) => {
            const pageNum = idx + 1;
            if ((!page.images || page.images.length === 0) && mapping[pageNum]) {
                page.images = mapping[pageNum];
            }
        });
        renderPage();
    }

    // ==================== INIT ====================
    function init() {
        try {
            checkAccess();
        } catch (e) {
            return;
        }

        loadFromStorage();
        autoLoadImagesFromFolder();

        document.getElementById('prevPage').addEventListener('click', goPrev);
        document.getElementById('nextPage').addEventListener('click', goNext);
        document.getElementById('printPage').addEventListener('click', printPage);
        document.getElementById('downloadPng').addEventListener('click', downloadPng);

        settingsToggle.addEventListener('click', toggleAdmin);

        document.getElementById('addPageBtn').addEventListener('click', addPage);
        document.getElementById('deletePageBtn').addEventListener('click', deletePage);
        document.getElementById('addImageBtn').addEventListener('click', addImage);
        document.getElementById('deleteImageBtn').addEventListener('click', deleteImage);
        document.getElementById('clearHtmlBtn').addEventListener('click', clearHtml);

        langSelector.addEventListener('change', function(e) {
            applyLanguage(e.target.value);
        });

        pageText.addEventListener('input', function() {
            if (pagesData[currentPage - 1]) {
                pagesData[currentPage - 1].text = pageText.innerText;
                saveToStorage();
            }
        });

        renderPage();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();