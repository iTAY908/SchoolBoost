import { ArrowUpRight } from 'lucide-react';

type LiveProjectButtonProps = {
  className?: string;
};

export default function LiveProjectButton({ className = '' }: LiveProjectButtonProps) {
  return (
    <button
      type="button"
      className={
        'inline-flex items-center gap-2 rounded-full border-2 border-[#D7E2EA] ' +
        'text-[#D7E2EA] font-medium uppercase tracking-widest ' +
        'px-8 py-3 sm:px-10 sm:py-3.5 text-sm sm:text-base ' +
        'transition-colors duration-200 hover:bg-[#D7E2EA]/10 ' +
        className
      }
    >
      Live Project
      <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2} />
    </button>
  );
}
