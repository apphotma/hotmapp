import { elements } from './elements.js';
import { auth } from './firebase-config.js';
import { getUserProfile, updateUserProfile } from './database-service.js?v=1.0.7';
import { showToast } from './toast.js';
import { hideElement, showElement } from './utils.js';
import { subscribeToAuthChanges } from './auth-service.js';

export const translations = {
    en: {
        profileSettings: "Profile Settings",
        fullNameLabel: "Full Name",
        enableSounds: "Enable Notification Sounds",
        refreshLocation: "Refresh Location Data Cache",
        saveChanges: "Save Changes",
        logout: "Logout",
        settings: "Settings",
        profile: "Profile",
        account: "Account",
        privacy: "Privacy",
        chats: "Chats",
        notifications: "Notifications",
        storage: "Storage and Data",
        language: "App Language",
        invite: "Invite a Contact",
        help: "Help and Feedback",
        deleteAccountBtn: "Delete My Account",
        appLanguageTitle: "App Language",
        chooseLanguage: "Choose your preferred language:",
        saveLanguageBtn: "Save Language",
        languageSaved: "Language saved successfully!"
    },
    es: {
        profileSettings: "Ajustes de Perfil",
        fullNameLabel: "Nombre Completo",
        enableSounds: "Activar sonidos de notificación",
        refreshLocation: "Actualizar caché de datos de ubicación",
        saveChanges: "Guardar Cambios",
        logout: "Cerrar Sesión",
        settings: "Ajustes",
        profile: "Perfil",
        account: "Cuenta",
        privacy: "Privacidad",
        chats: "Chats",
        notifications: "Notificaciones",
        storage: "Almacenamiento y Datos",
        language: "Idioma de la aplicación",
        invite: "Invitar a un contacto",
        help: "Ayuda y Comentarios",
        deleteAccountBtn: "Eliminar mi cuenta",
        appLanguageTitle: "Idioma de la aplicación",
        chooseLanguage: "Elija su idioma preferido:",
        saveLanguageBtn: "Guardar Idioma",
        languageSaved: "¡Idioma guardado con éxito!"
    },
    fr: {
        profileSettings: "Paramètres du profil",
        fullNameLabel: "Nom complet",
        enableSounds: "Activer les sons de notification",
        refreshLocation: "Actualiser le cache des données de localisation",
        saveChanges: "Enregistrer les modifications",
        logout: "Déconnexion",
        settings: "Paramètres",
        profile: "Profil",
        account: "Compte",
        privacy: "Confidentialité",
        chats: "Discussions",
        notifications: "Notifications",
        storage: "Stockage et données",
        language: "Langue de l'application",
        invite: "Inviter un contact",
        help: "Aide et commentaires",
        deleteAccountBtn: "Supprimer mon compte",
        appLanguageTitle: "Langue de l'application",
        chooseLanguage: "Choisissez votre langue préférée :",
        saveLanguageBtn: "Enregistrer la langue",
        languageSaved: "Langue enregistrée avec succès !"
    },
    ar: {
        profileSettings: "إعدادات الملف الشخصي",
        fullNameLabel: "الاسم الكامل",
        enableSounds: "تمكين أصوات الإشعارات",
        refreshLocation: "تحديث ذاكرة التخزين المؤقت لبيانات الموقع",
        saveChanges: "حفظ التغييرات",
        logout: "تسجيل الخروج",
        settings: "الإعدادات",
        profile: "الملف الشخصي",
        account: "الحساب",
        privacy: "الخصوصية",
        chats: "الدردشات",
        notifications: "الإشعارات",
        storage: "التخزين والبيانات",
        language: "لغة التطبيق",
        invite: "دعوة جهة اتصال",
        help: "المساعدة والتعليقات",
        deleteAccountBtn: "حذف حسابي",
        appLanguageTitle: "لغة التطبيق",
        chooseLanguage: "اختر لغتك المفضلة:",
        saveLanguageBtn: "حفظ اللغة",
        languageSaved: "تم حفظ اللغة بنجاح!"
    },
    zh: {
        profileSettings: "个人资料设置",
        fullNameLabel: "姓名",
        enableSounds: "启用通知声音",
        refreshLocation: "刷新位置数据缓存",
        saveChanges: "保存更改",
        logout: "退出登录",
        settings: "设置",
        profile: "个人资料",
        account: "账户",
        privacy: "隐私",
        chats: "聊天",
        notifications: "通知",
        storage: "存储和数据",
        language: "应用语言",
        invite: "邀请联系人",
        help: "帮助与反馈",
        deleteAccountBtn: "删除我的账户",
        appLanguageTitle: "应用语言",
        chooseLanguage: "选择您偏好的语言：",
        saveLanguageBtn: "保存语言",
        languageSaved: "语言保存成功！"
    },
    de: {
        profileSettings: "Profileinstellungen",
        fullNameLabel: "Vollständiger Name",
        enableSounds: "Benachrichtigungstöne aktivieren",
        refreshLocation: "Standortdaten-Cache aktualisieren",
        saveChanges: "Änderungen speichern",
        logout: "Abmelden",
        settings: "Einstellungen",
        profile: "Profil",
        account: "Konto",
        privacy: "Privatsphäre",
        chats: "Chats",
        notifications: "Benachrichtigungen",
        storage: "Speicher und Daten",
        language: "App-Sprache",
        invite: "Kontakt einladen",
        help: "Hilfe und Feedback",
        deleteAccountBtn: "Mein Konto löschen",
        appLanguageTitle: "App-Sprache",
        chooseLanguage: "Wählen Sie Ihre bevorzugte Sprache:",
        saveLanguageBtn: "Sprache speichern",
        languageSaved: "Sprache erfolgreich gespeichert!"
    },
    ig: {
        profileSettings: "Ntọala Profaịlụ",
        fullNameLabel: "Aha zuru ezu",
        enableSounds: "Gbanye ụda ọkwa",
        refreshLocation: "Megharịa cache data ebe",
        saveChanges: "Chekwa mgbanwe",
        logout: "Pụọ",
        settings: "Ntọala",
        profile: "Profaịlụ",
        account: "Akaụntụ",
        privacy: "Nzuzo",
        chats: "Nkata",
        notifications: "Ọkwa",
        storage: "Nchekwa na Data",
        language: "Asụsụ ngwa",
        invite: "Kpọọ mmadụ n'ime nkata",
        help: "Enyemaka na Nzaghachi",
        deleteAccountBtn: "Hichapụ akaụntụ m",
        appLanguageTitle: "Asụsụ ngwa",
        chooseLanguage: "Họrọ asụsụ ị kacha chọọ:",
        saveLanguageBtn: "Chekwa asụsụ",
        languageSaved: "Echekwala asụsụ nke ọma!"
    }
};

export const languageList = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español (Spanish)' },
    { code: 'fr', name: 'Français (French)' },
    { code: 'ar', name: 'العربية (Arabic)' },
    { code: 'zh', name: '中文 (Chinese)' },
    { code: 'de', name: 'Deutsch (German)' },
    { code: 'ig', name: 'Igbo (Igbo)' },
    { code: 'yo', name: 'Yoruba (Yoruba)' },
    { code: 'ha', name: 'Hausa (Hausa)' },
    { code: 'pt', name: 'Português (Portuguese)' },
    { code: 'ru', name: 'Русский (Russian)' },
    { code: 'ja', name: '日本語 (Japanese)' },
    { code: 'hi', name: 'हिन्दी (Hindi)' },
    { code: 'it', name: 'Italiano (Italian)' },
    { code: 'nl', name: 'Nederlands (Dutch)' },
    { code: 'tr', name: 'Türkçe (Turkish)' },
    { code: 'ko', name: '한국어 (Korean)' },
    { code: 'vi', name: 'Tiếng Việt (Vietnamese)' },
    { code: 'pl', name: 'Polski (Polish)' },
    { code: 'id', name: 'Bahasa Indonesia (Indonesian)' },
    { code: 'ms', name: 'Bahasa Melayu (Malay)' },
    { code: 'sv', name: 'Svenska (Swedish)' },
    { code: 'no', name: 'Norsk (Norwegian)' },
    { code: 'da', name: 'Dansk (Danish)' },
    { code: 'fi', name: 'Suomi (Finnish)' },
    { code: 'cs', name: 'Čeština (Czech)' },
    { code: 'el', name: 'Ελληνικά (Greek)' },
    { code: 'he', name: 'עברית (Hebrew)' },
    { code: 'th', name: 'ไทย (Thai)' },
    { code: 'uk', name: 'Українська (Ukrainian)' },
    { code: 'hu', name: 'Magyar (Hungarian)' },
    { code: 'ro', name: 'Română (Romanian)' },
    { code: 'sk', name: 'Slovenčina (Slovak)' },
    { code: 'bg', name: 'Български (Bulgarian)' },
    { code: 'hr', name: 'Hrvatski (Croatian)' },
    { code: 'sr', name: 'Српски (Serbian)' },
    { code: 'ca', name: 'Català (Catalan)' },
    { code: 'fil', name: 'Filipino (Filipino)' },
    { code: 'fa', name: 'فارسی (Persian)' },
    { code: 'ur', name: 'اردو (Urdu)' },
    { code: 'bn', name: 'বাংলা (Bengali)' },
    { code: 'te', name: 'తెлуу (Telugu)' },
    { code: 'mr', name: 'मराठी (Marathi)' },
    { code: 'ta', name: 'தமிழ் (Tamil)' },
    { code: 'gu', name: 'ગુજરાતી (Gujarati)' },
    { code: 'kn', name: 'ಕನ್ನಡ (Kannada)' },
    { code: 'ml', name: 'മലയാളം (Malayalam)' },
    { code: 'pa', name: 'ਪੰਜਾਬੀ (Punjabi)' },
    { code: 'sw', name: 'Swahili (Swahili)' },
    { code: 'zu', name: 'Zulu (Zulu)' },
    { code: 'xh', name: 'Xhosa (Xhosa)' },
    { code: 'af', name: 'Afrikaans (Afrikaans)' },
    { code: 'am', name: 'Amharic (Amharic)' },
    { code: 'az', name: 'Azerbaijani (Azerbaijani)' },
    { code: 'eu', name: 'Euskara (Basque)' },
    { code: 'gl', name: 'Galego (Galician)' },
    { code: 'ka', name: 'ქართული (Georgian)' },
    { code: 'kk', name: 'Қазақ (Kazakh)' },
    { code: 'km', name: 'ខ្មែរ (Khmer)' },
    { code: 'lo', name: 'ລາວ (Lao)' },
    { code: 'lv', name: 'Latviešu (Latvian)' },
    { code: 'lt', name: 'Lietuvių (Lithuanian)' },
    { code: 'mk', name: 'Македонски (Macedonian)' },
    { code: 'sl', name: 'Slovenščina (Slovenian)' },
    { code: 'om', name: 'Oromoo (Oromo)' }
];

export let currentLanguage = 'en';

/**
 * Dynamically builds and inserts the 65 language option list into the modal element.
 */
export const renderLanguageOptions = () => {
    const listContainer = document.querySelector('.language-options-list');
    if (!listContainer) return;

    listContainer.innerHTML = languageList.map(lang => {
        const isChecked = lang.code === currentLanguage ? 'checked' : '';
        return `
            <label class="settings-menu-item"
                style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px;">
                <span>${lang.name}</span>
                <input type="radio" name="app-language-opt" value="${lang.code}" ${isChecked}
                    style="width: 20px; height: 20px; accent-color: var(--brand);">
            </label>
        `;
    }).join('');
};

/**
 * Applies the selected language translations to the UI and updates layout direction.
 * @param {string} lang The language code
 */
export const applyLanguage = (lang) => {
    currentLanguage = lang;
    localStorage.setItem('appLanguage', lang);

    // Toggle RTL layout direction for Arabic
    if (lang === 'ar') {
        document.documentElement.dir = 'rtl';
        document.documentElement.classList.add('rtl');
    } else {
        document.documentElement.dir = 'ltr';
        document.documentElement.classList.remove('rtl');
    }

    // Translate all elements marked with data-i18n
    const elementsToTranslate = document.querySelectorAll('[data-i18n]');
    elementsToTranslate.forEach(el => {
        const key = el.getAttribute('data-i18n');
        // Fallback: selected language -> English
        const translatedText = (translations[lang] && translations[lang][key]) 
            ? translations[lang][key] 
            : (translations['en'] && translations['en'][key]) ? translations['en'][key] : '';
        if (translatedText) {
            el.textContent = translatedText;
        }
    });

    // Re-render language options checked states
    renderLanguageOptions();
};

/**
 * Initializes the preferred language settings module.
 */
export const initLanguage = () => {
    // 1. Initial Load: Load language from localStorage, fallback to browser preference
    let savedLang = localStorage.getItem('appLanguage');
    if (!savedLang) {
        const browserLang = navigator.language || navigator.userLanguage;
        const shortLang = browserLang ? browserLang.split('-')[0].toLowerCase() : 'en';
        savedLang = translations[shortLang] ? shortLang : 'en';
    }
    applyLanguage(savedLang);

    // 2. Open Language Modal from Settings Menu
    elements.settingsAppLanguageBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        hideElement(elements.settingsModal);
        // Ensure options list is fully rendered and synced
        renderLanguageOptions();
        showElement(elements.languageModal, 'flex');
    });

    // 3. Close Language Modal
    elements.closeLanguageModalBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        hideElement(elements.languageModal);
        showElement(elements.settingsModal, 'flex');
    });

    // Close language modal when clicking the backdrop
    elements.languageModal?.addEventListener('click', (e) => {
        if (e.target === elements.languageModal) {
            hideElement(elements.languageModal);
            showElement(elements.settingsModal, 'flex');
        }
    });

    // 4. Save preferred language
    elements.saveLanguageBtn?.addEventListener('click', async (e) => {
        e.preventDefault();
        let selectedLang = currentLanguage;
        
        const liveOptions = document.querySelectorAll('[name="app-language-opt"]');
        if (liveOptions) {
            liveOptions.forEach(opt => {
                if (opt.checked) {
                    selectedLang = opt.value;
                }
            });
        }

        try {
            // Apply language translations immediately
            applyLanguage(selectedLang);

            // Sync choice with online Firebase profile if logged in
            const user = auth.currentUser;
            if (user) {
                await updateUserProfile(user.uid, { appLanguage: selectedLang });
            }

            const successMsg = (translations[selectedLang] && translations[selectedLang].languageSaved)
                ? translations[selectedLang].languageSaved
                : translations['en'].languageSaved;
            showToast(successMsg, "success");

            // Close modal and return to settings list
            hideElement(elements.languageModal);
            showElement(elements.settingsModal, 'flex');
        } catch (error) {
            console.error("Error saving preferred language settings:", error);
            showToast("Failed to save language settings", "error");
        }
    });

    // 5. Auto-sync user's synced setting on sign-in / profile update
    subscribeToAuthChanges(async (user) => {
        if (user) {
            try {
                const profile = await getUserProfile(user.uid);
                if (profile && profile.appLanguage && profile.appLanguage !== currentLanguage) {
                    applyLanguage(profile.appLanguage);
                }
            } catch (error) {
                console.error("Error fetching user profile language:", error);
            }
        }
    });
};
