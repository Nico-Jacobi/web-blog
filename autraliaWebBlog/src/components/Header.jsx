import React from 'react';
import { Globe } from 'lucide-react';

export default function Header() {
    return (
        <header className="h-16 bg-white border-b border-orange-100 flex items-center justify-between px-6 shadow-sm shrink-0">
            <div className="flex items-center gap-2">
                <div className="bg-orange-600 text-white p-2 rounded-xl">
                    <Globe size={20} />
                </div>
                <span className="font-bold text-xl">
                    Aussie<span className="text-orange-600">Quest</span>
                </span>
            </div>
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-500">
                <a href="#" className="text-orange-600">Explorer</a>
                <a href="#" className="hover:text-slate-800 transition">Route</a>
                <a href="#" className="hover:text-slate-800 transition">Journal</a>
            </nav>
        </header>
    );
}