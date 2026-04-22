import React from 'react';
import { ROUTE_STYLES } from "../model/routeStyles.js";
import { useTranslation } from 'react-i18next';

export default function Legend({ usedModes }) {
    const { t } = useTranslation();
    if (!usedModes || usedModes.length === 0) return null;

    return (
        <div className="bg-white rounded-xl shadow-sm p-2 sm:p-2 px-3 sm:px-3 flex flex-wrap gap-2 sm:gap-3 items-center justify-center">
            {usedModes.map(mode => {
                const style = ROUTE_STYLES[mode];
                if (!style) return null;

                const Icon = style.icon;

                return (
                    <div key={mode} className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-slate-600 shrink-0">
                        {Icon ? (
                            <Icon size={14} className="sm:w-4 sm:h-4" style={{color: style.color}}/>
                        ) : (
                            <div
                                className="w-5 sm:w-6 h-0.5 shrink-0"
                                style={{
                                    backgroundColor: style.color,
                                    opacity: style.opacity,
                                    borderStyle: style.dashArray ? 'dashed' : 'solid'
                                }}
                            />
                        )}
                        <span className="truncate whitespace-nowrap">{style.labelKey ? t(style.labelKey) : mode}</span>
                    </div>
                );
            })}
        </div>
    );
}