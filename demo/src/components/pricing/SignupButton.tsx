import type { ReactNode } from 'react';

export interface SignupButtonProps {
  variant?: 'primary' | 'secondary';
  children: ReactNode;
  onClick?: () => void;
}

/**
 * Reusable action button styled for call-to-action cards and forms.
 */
export function SignupButton({
  variant = 'primary',
  children,
  onClick,
}: SignupButtonProps) {
  const baseClasses =
    'w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 cursor-pointer text-center';

  const variantClasses =
    variant === 'primary'
      ? 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-indigo-600 active:bg-indigo-700'
      : 'bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 hover:text-white focus-visible:outline-slate-500 active:bg-slate-750';

  return (
    <button type="button" onClick={onClick} className={`${baseClasses} ${variantClasses}`}>
      {children}
    </button>
  );
}

export default SignupButton;
