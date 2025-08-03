import React from 'react';

const Avatar = React.forwardRef(({ className = '', children, ...props }, ref) => (
  <div
    ref={ref}
    className={`relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full ${className}`}
    {...props}
  >
    {children}
  </div>
));
Avatar.displayName = 'Avatar';

const AvatarImage = React.forwardRef(({ className = '', src, alt, ...props }, ref) => (
  <img 
    ref={ref} 
    className={`aspect-square h-full w-full ${className}`} 
    src={src}
    alt={alt}
    {...props} 
  />
));
AvatarImage.displayName = 'AvatarImage';

const AvatarFallback = React.forwardRef(({ className = '', children, ...props }, ref) => (
  <div
    ref={ref}
    className={`flex h-full w-full items-center justify-center rounded-full bg-gray-100 text-gray-600 font-medium ${className}`}
    {...props}
  >
    {children}
  </div>
));
AvatarFallback.displayName = 'AvatarFallback';

export { Avatar, AvatarImage, AvatarFallback };
