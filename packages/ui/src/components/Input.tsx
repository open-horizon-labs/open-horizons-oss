import * as React from 'react'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  children?: React.ReactNode
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (props: InputProps, ref: React.Ref<HTMLInputElement>) => {
    const { className = '', ...rest } = props
    return (
      <input
        ref={ref}
        className={
          'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ' +
          className
        }
        {...rest}
      />
    )
  }
)
Input.displayName = 'Input'
