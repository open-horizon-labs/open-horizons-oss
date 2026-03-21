import Link from 'next/link'

interface ImportButtonProps {
  className?: string
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
}

export function ImportButton({ 
  className = '', 
  variant = 'primary',
  size = 'md'
}: ImportButtonProps) {
  const baseClasses = 'inline-flex items-center space-x-2 rounded border font-medium transition-colors'
  
  const variantClasses = {
    primary: 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700',
    secondary: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
  }
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg'
  }
  
  const combinedClasses = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`
  
  return (
    <Link href="/settings/markdown-aims" className={combinedClasses}>
      <span>📄</span>
      <span>Import Markdown</span>
    </Link>
  )
}