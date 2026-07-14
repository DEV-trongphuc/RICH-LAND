import React from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';

export function withRouterFreezer<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  configPathToCheck?: string | ((path: string) => boolean)
) {
  return function RouterFreezerWrapper(
    props: Omit<P, 'isActive' | 'searchParams' | 'setSearchParams' | 'location'> & {
      pathToCheck?: string | ((path: string) => boolean);
    }
  ) {
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const pathname = location.pathname;
    
    const pathChecker = configPathToCheck ?? props.pathToCheck;
    const isActive = pathChecker
      ? (typeof pathChecker === 'function' ? pathChecker(pathname) : pathname === pathChecker)
      : true;

    return (
      <WrappedComponent
        {...(props as any)}
        isActive={isActive}
        searchParams={searchParams}
        setSearchParams={setSearchParams}
        location={location}
      />
    );
  };
}
