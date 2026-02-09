import { useTranslation } from 'react-i18next';

export function LanguageSwitcher() {
    const { i18n } = useTranslation();

    const languages = [
        { code: 'en', label: 'English', flag: '🇬🇧' },
        { code: 'sv', label: 'Svenska', flag: '🇸🇪' },
        { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
    ];

    const currentLanguage = i18n.language || 'en';

    return (
        <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800/50 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800">
                {languages.map((lang) => (
                    <button
                        key={lang.code}
                        onClick={() => i18n.changeLanguage(lang.code)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${currentLanguage.startsWith(lang.code)
                            ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                            }`}
                    >
                        <span>{lang.flag}</span>
                        <span className="hidden sm:inline">{lang.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
