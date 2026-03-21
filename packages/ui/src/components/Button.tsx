import * as React from 'react'

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost'
  children?: React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (props: ButtonProps, ref: React.Ref<HTMLButtonElement>) => {
    const { className = '', variant = 'primary', children, ...rest } = props
    const base =
      'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none h-10 px-4 py-2'
    const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
      primary: 'bg-black text-white hover:bg-gray-800 focus-visible:ring-black',
      secondary:
        'bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-400',
      ghost: 'bg-transparent text-gray-900 hover:bg-gray-100'
    }
    return (
      <button ref={ref} className={`${base} ${variants[variant]} ${className}`} {...rest}>
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
