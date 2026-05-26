interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const LoadingSpinner = ({ size = 'md', className = '' }: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  }

  return (
    <div className={`flex justify-center items-center ${className}`}>
      <div className={`relative ${sizeClasses[size]}`}>
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-slate-200 border-t-brand-800" />
        <div className="absolute inset-1 animate-spin rounded-full border-2 border-transparent border-t-accent-500" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
      </div>
    </div>
  )
}

export default LoadingSpinner
