import React, { useRef } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';

export function withRouterFreezer<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  configPathToCheck?: string | ((path: string) => boolean)
) {
  const MemoizedInner = React.memo(WrappedComponent) as any;

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

    const lastParams = useRef({ searchParams, location });
    if (isActive) {
      lastParams.current = { searchParams, location };
    }

    return (
      <MemoizedInner
        {...(props as any)}
        isActive={isActive}
        searchParams={lastParams.current.searchParams}
        setSearchParams={setSearchParams}
        location={lastParams.current.location}
      />
    );
  };
}
