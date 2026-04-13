import { Search } from 'lucide-react'

export function SearchBar() {
    return (
        <div className="relative">
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-text-secondary">
                <Search size={18} />
            </div>
            <input
                type="text"
                placeholder="Buscar termo, campanha ou grupo..."
                className="w-full bg-[#11161D] border border-border/50 rounded-xl py-4 pl-14 pr-6 text-sm text-white focus:outline-none focus:ring-1 focus:ring-accent-blue/30 placeholder:text-text-secondary/60 transition-all font-medium"
            />
        </div>
    )
}
