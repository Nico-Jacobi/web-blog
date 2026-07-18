let currentAccent = '#ea580c';

export function applyAccentColor(hex) {
    if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return;
    currentAccent = hex;
    document.documentElement.style.setProperty('--accent', hex);
    let el = document.getElementById('accent-override');
    if (!el) {
        el = document.createElement('style');
        el.id = 'accent-override';
        document.head.appendChild(el);
    }
    el.textContent = [
        `.text-orange-600{color:${hex}!important}`,
        `.text-orange-500{color:${hex}!important}`,
        `.text-orange-400{color:color-mix(in srgb,${hex} 75%,#fff)!important}`,
        `.text-orange-300{color:color-mix(in srgb,${hex} 50%,#fff)!important}`,
        `.text-orange-200{color:color-mix(in srgb,${hex} 30%,#fff)!important}`,
        `.text-orange-100{color:color-mix(in srgb,${hex} 15%,#fff)!important}`,
        `.text-orange-50{color:color-mix(in srgb,${hex} 7%,#fff)!important}`,
        `.bg-orange-600{background-color:${hex}!important}`,
        `.bg-orange-500{background-color:${hex}!important}`,
        `.bg-orange-200{background-color:color-mix(in srgb,${hex} 30%,#fff)!important}`,
        `.bg-orange-100{background-color:color-mix(in srgb,${hex} 15%,#fff)!important}`,
        `.bg-orange-50{background-color:color-mix(in srgb,${hex} 7%,#fff)!important}`,
        `.border-orange-500{border-color:${hex}!important}`,
        `.border-orange-400{border-color:color-mix(in srgb,${hex} 75%,#fff)!important}`,
        `.border-orange-200{border-color:color-mix(in srgb,${hex} 30%,#fff)!important}`,
        `.border-orange-100{border-color:color-mix(in srgb,${hex} 15%,#fff)!important}`,
        `.shadow-orange-200{--tw-shadow-color:color-mix(in srgb,${hex} 30%,#fff)!important}`,
        `.dark .shadow-orange-200{--tw-shadow-color:color-mix(in srgb,${hex} 35%,#000)!important}`,
    ].join('');
}

export function getAccentColor() {
    return currentAccent;
}
